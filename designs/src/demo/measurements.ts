/* ─────────────────────────────────────────────
 * 계측 시계열·부가 데이터 — 배경: docs/레거시/정본/04_데모_데이터.md §8
 *
 * 값은 고정 시드로 만든다. 새로고침할 때마다 모양이 바뀌면 시연에서 같은 화면을 두 번
 * 못 보여준다. 진행 중인 이벤트가 있는 지구는 마지막 값이 그 이벤트 측정값과 맞물린다.
 * ───────────────────────────────────────────── */

import { DEMO_DAY, EVENTS, activeEventOfAt, eventViewAt } from "./events";
import {
  ALERT_LEVELS,
  DISPLACEMENT_THRESHOLD,
  RAIN_THRESHOLD,
  WATER_THRESHOLDS,
  type WaterThreshold,
} from "./levels";
import { TIDE_CURVE } from "./weather";
import type { Device } from "./devices";
import { hashSeed, seededRandom } from "../lib/seed";

export interface Sample {
  at: Date;
  value: number;
}

/* ── 조위계 (04 §8) ─────────────────────────────
 * 실측 조위 = 천문조 + 해일 편차. 천문조는 저조(13:05)→만조(19:10) 코사인 보간이라
 * 저조 앞 구간은 내림 물때로 자연히 이어지고, 편차는 앵커 선형 보간 후 끝값 유지다.
 * 절대 시각의 함수라 6시간 창이 흘러도 같은 시각은 같은 값을 낸다. */

function clockMs(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(DEMO_DAY);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function astroLevelAt(at: Date): number {
  const lowMs = clockMs(TIDE_CURVE.low.at);
  const half = clockMs(TIDE_CURVE.high.at) - lowMs;
  const mid = (TIDE_CURVE.low.level + TIDE_CURVE.high.level) / 2;
  const amp = (TIDE_CURVE.high.level - TIDE_CURVE.low.level) / 2;
  return mid - amp * Math.cos((Math.PI * (at.getTime() - lowMs)) / half);
}

function surgeRiseAt(at: Date): number {
  const anchors = TIDE_CURVE.surge;
  let rise = anchors[anchors.length - 1].rise;
  for (let i = 0; i < anchors.length; i += 1) {
    const ms = clockMs(anchors[i].at);
    if (at.getTime() > ms) continue;
    if (i === 0) {
      rise = anchors[0].rise;
    } else {
      const prevMs = clockMs(anchors[i - 1].at);
      rise =
        anchors[i - 1].rise +
        ((anchors[i].rise - anchors[i - 1].rise) * (at.getTime() - prevMs)) / (ms - prevMs);
    }
    break;
  }
  return rise;
}

function tideLevelAt(at: Date): number {
  return astroLevelAt(at) + surgeRiseAt(at);
}

/** 조위 읽기 (04 §8·§10-4) — 천문조 현재값·실측·해일 편차를 한 번에.
 *  교차검증 패널의 조위 비교 4행과 판정 카드가 같은 곡선을 읽는다 (17:22 = 2.36 / 3.51 / +1.15) */
export interface TideReading {
  astro: number;
  measured: number;
  surge: number;
}

export function tideReadingAt(at: Date): TideReading {
  return {
    astro: Number(astroLevelAt(at).toFixed(2)),
    /* 실측은 원곡선 합의 반올림 — 조위계 시계열(sensorSeries TD)의 표본과 같은 값이어야 한다 */
    measured: Number(tideLevelAt(at).toFixed(2)),
    surge: Number(surgeRiseAt(at).toFixed(2)),
  };
}

interface SeriesOptions {
  /** 되짚을 시간 (기본 6시간) */
  hours?: number;
  /** 표본 간격 (분, 기본 10분) */
  stepMin?: number;
  /** 마지막 표본의 시각 (기본 now) */
  until?: Date;
}

/**
 * 장비 계측 시계열.
 *
 * 수위는 지구 발령 기준의 아래쪽에서 조석처럼 오르내리고, 진행 중 이벤트가 있으면
 * 마지막 구간에서 기준선을 넘어 이벤트 측정값에 닿는다. 강우는 평소 0 근처에 있다가
 * 이벤트 구간에만 솟는다. 변위는 아주 느리게 누적된다.
 */
export function sensorSeries(device: Device, now: Date, options: SeriesOptions = {}): Sample[] {
  const hours = options.hours ?? 6;
  const stepMin = options.stepMin ?? 10;
  const until = options.until ?? now;
  const count = Math.floor((hours * 60) / stepMin) + 1;

  const rand = seededRandom(hashSeed(device.id));
  const event = activeEventOfAt(device.districtId, now);
  /* 격상 전후로 끝점이 달라진다(04 §8) — 목표값은 now 시점의 단계 측정값이다 */
  const view = event ? eventViewAt(event, now) : null;
  const matched =
    event &&
    ((device.kind === "WL" && event.type === "수위") ||
      (device.kind === "RN" && event.type === "강우") ||
      (device.kind === "DP" && event.type === "변위"));
  /* 측정값에 정확히 닿는 건 원장에 적힌 그 장비뿐이다(04 §8). 같은 종류의 이웃 장비는
     조금 아래에서 따라간다. 두 장비가 같은 값을 찍으면 계측이 아니라 복사로 보인다 */
  const primary = !!(event && matched && event.deviceId === device.id);
  const follow = primary ? 0 : 0.05 + (hashSeed(device.id) % 6) * 0.02;

  const threshold = WATER_THRESHOLDS[device.districtId];
  const samples: Sample[] = [];

  for (let i = 0; i < count; i += 1) {
    const at = new Date(until.getTime() - (count - 1 - i) * stepMin * 60_000);
    /* 0 → 1 로 가는 진행도. 사건은 뒤쪽 1/3 구간에서 자란다 */
    const t = i / (count - 1);
    const rise = Math.max(0, (t - 0.62) / 0.38);
    let value: number;

    if (device.kind === "WL") {
      const base = (threshold?.advisory ?? 2.5) * 0.72;
      const tide = Math.sin(t * Math.PI * 1.6 + hashSeed(device.id) % 3) * 0.08;
      const target = matched && view ? view.value - follow : base + 0.12;
      /* 이벤트 구간에선 끝으로 갈수록 조석·잡음을 걷는다 — 마지막 표본이 현재 단계
         측정값에 정확히 닿아야 한다(04 §8). 격상되면 target 이 3.02 → 3.41 로 따라온다 */
      const damp = matched && view ? 1 - rise : 1;
      value = base + tide * damp + (target - base) * rise + (rand() - 0.5) * 0.03 * damp;
    } else if (device.kind === "RN") {
      const burst = matched && view ? view.value - follow : 8;
      value = Math.max(0, burst * rise * (0.6 + rand() * 0.5) - 0.4);
    } else if (device.kind === "TD") {
      /* 조석 합성 곡선이라 잡음을 얹지 않는다(04 §8) — 17:22 3.51 · 19:22 3.95 가
         §10-3 판정 카드의 편차(+1.15 → +1.24)와 정확히 맞물려야 한다 */
      value = tideLevelAt(at);
    } else {
      const base = matched && view ? (view.value - follow) * 0.6 : 3.4;
      value = base + rise * (matched && view ? (view.value - follow) * 0.4 : 0.6) + rand() * 0.15;
    }

    /* 마지막 표본은 이벤트 측정값 그 자체다 — 팝업·패널의 "현재값"이 카드·뱃지의
       단계 측정값과 한 자리도 다르면 안 된다(04 §8). 원장 장비만이다 — 이웃은 follow 만큼 아래 */
    if (primary && view && i === count - 1) value = view.value;

    samples.push({ at, value: Number(value.toFixed(2)) });
  }

  return samples;
}

/** 최근 측정값 — 팝업·패널의 현재값 */
export function latestValue(device: Device, now: Date): Sample {
  const series = sensorSeries(device, now);
  return series[series.length - 1];
}

/* ── 추세 요약 (04 §8 · SCR-02 좌측 계측 추이) ──────────────
 * 그래프에서 파생 계산한다. 별도 수치를 두지 않는다 — 요약과 그래프가 다른 원천을
 * 읽으면 "숫자와 그래프를 같이 보여준다"는 목적 자체가 깨진다.
 * ───────────────────────────────────────────── */

export interface TrendSummary {
  /** 최근 30분 변화량 — 현재값 − 30분 전 표본값 */
  delta30: number;
  direction: "상승" | "하강" | "유지";
  /** 현재값이 넘은 최고 발령 기준. 기준이 없는 장비(조위계)는 null */
  exceeded: { label: string; value: number; color: string } | null;
  /** 다음 기준과 남은 폭. 이미 대피 구간이면 null */
  next: { label: string; value: number; gap: number; color: string } | null;
  /** 조위계 한정 — 천문조 대비 편차 (§10-3 판정 카드의 그 값) */
  surge: number | null;
}

function thresholdOf(device: Device): WaterThreshold | null {
  if (device.kind === "WL") return WATER_THRESHOLDS[device.districtId] ?? null;
  if (device.kind === "RN") return RAIN_THRESHOLD;
  if (device.kind === "DP") return DISPLACEMENT_THRESHOLD;
  return null;
}

export function trendSummaryAt(device: Device, now: Date): TrendSummary | null {
  if (device.status === "통신끊김") return null;
  const series = sensorSeries(device, now);
  const last = series[series.length - 1].value;
  /* 표본 간격 10분 — 3칸 전이 30분 전이다 */
  const prev = series[series.length - 4]?.value ?? last;
  const delta30 = Number((last - prev).toFixed(2));
  const direction = delta30 > 0.02 ? "상승" : delta30 < -0.02 ? "하강" : "유지";

  const base = thresholdOf(device);
  let exceeded: TrendSummary["exceeded"] = null;
  let next: TrendSummary["next"] = null;
  if (base) {
    for (const level of ALERT_LEVELS) {
      const value = base[level.id];
      if (last >= value) {
        exceeded = { label: level.label, value, color: level.color };
      } else if (!next) {
        next = { label: level.label, value, gap: Number((value - last).toFixed(2)), color: level.color };
      }
    }
  }

  return {
    delta30,
    direction,
    exceeded,
    next,
    surge: device.kind === "TD" ? tideReadingAt(now).surge : null,
  };
}

/* ── 기간 조회용 시계열 (SCR-04) ────────────────────────────
 * 표본 간격은 기간에 따라 바뀐다(04 §8). 1주일 이하 1시간, 1개월 6시간, 3개월 이상 1일.
 * 8/11 밤과 8/12 오후에 이벤트 구간이 있고, 강우도 같은 구간에 몰린다. 두 구간이
 * §4-2 이벤트와 맞아야 통계 화면에서 "그날 이랬구나"가 읽힌다.
 * ───────────────────────────────────────────────────────── */

export interface HistorySample {
  at: Date;
  /** 수위 (EL.m) */
  water: number;
  /** 강우량 (mm) */
  rain: number;
}

/** 기간 길이(일)에 따른 표본 간격 (분) */
export function sampleStepMinutes(days: number): number {
  if (days <= 7) return 60;
  if (days <= 31) return 360;
  return 1440;
}

/* 봉우리 구간은 지구마다 다르다(04 §8 · 감사 B-8) — 그 지구 원장의 발생~해제를 그대로
   창으로 쓰고, 봉우리 값은 그 이벤트의 측정값으로 둔다. 전 지구 공통 구간을 쓰면
   이벤트가 없던 날의 봉우리가 기준선을 넘고, 정작 이벤트가 난 날은 기준선 아래에 머문다.
   띠·봉우리·이벤트 목록 셋이 한 사건을 같게 말해야 한다. */

interface SurgeWindow {
  from: number;
  to: number;
  peakAt: number;
  /** 봉우리에서 닿는 값 — 수위 창은 EL.m, 강우 창은 mm/h */
  peakVal: number;
}

/** 창 안에서 0 → 1(peakAt) → 0 으로 솟는 모양 */
function shapeAt(t: number, w: SurgeWindow): number {
  if (t <= w.from || t >= w.to) return 0;
  if (t <= w.peakAt) {
    const rise = (t - w.from) / (w.peakAt - w.from || 1);
    return Math.sin((rise * Math.PI) / 2);
  }
  const fall = (t - w.peakAt) / (w.to - w.peakAt || 1);
  return Math.cos((fall * Math.PI) / 2);
}

const RAMP_LEAD_MS = 150 * 60_000;
const RAMP_TAIL_MS = 90 * 60_000;

/** 지구의 수위 봉우리 창 — 수위 이벤트만. 단계 이력이 있으면 to 까지 도달한 최고 단계의
 *  값·시각이 봉우리가 된다(주인공 사건: 19:22 에 4.31) */
function waterWindows(districtId: string, until: Date): SurgeWindow[] {
  return EVENTS.filter((e) => e.districtId === districtId && e.type === "수위").map((e) => {
    const raised = new Date(e.raisedAt).getTime();
    const cleared = new Date(e.clearedAt ?? until).getTime();
    let peakVal = e.value;
    let peakAt = raised + (cleared - raised) * 0.6;
    for (const stage of e.stages ?? []) {
      const at = new Date(stage.at).getTime();
      if (at <= until.getTime() && stage.value > peakVal) {
        peakVal = stage.value;
        peakAt = at;
      }
    }
    return { from: raised - RAMP_LEAD_MS, to: cleared + RAMP_TAIL_MS, peakAt, peakVal };
  });
}

/** 지구의 강우 창 — 강우량은 그 지구 이벤트 구간에 집중된다(04 §8). 강우 이벤트는
 *  그 측정값(mm/h)까지 솟고, 수위 이벤트 구간에도 비가 온다 */
function rainWindows(districtId: string, until: Date): SurgeWindow[] {
  return EVENTS.filter(
    (e) => e.districtId === districtId && (e.type === "수위" || e.type === "강우"),
  ).map((e) => {
    const raised = new Date(e.raisedAt).getTime();
    const cleared = new Date(e.clearedAt ?? until).getTime();
    return {
      from: raised - RAMP_LEAD_MS,
      to: cleared + RAMP_TAIL_MS,
      peakAt: raised + (cleared - raised) * 0.45,
      peakVal: e.type === "강우" ? e.value : 18,
    };
  });
}

/** 지구·기간 수위·강우 시계열 */
export function historySeries(districtId: string, from: Date, to: Date): HistorySample[] {
  const days = Math.max(1, (to.getTime() - from.getTime()) / 86_400_000);
  const step = sampleStepMinutes(days) * 60_000;
  const rand = seededRandom(hashSeed(`history-${districtId}`));
  const threshold = WATER_THRESHOLDS[districtId];
  const base = (threshold?.advisory ?? 2.5) * 0.7;

  const wWindows = waterWindows(districtId, to);
  const rWindows = rainWindows(districtId, to);

  /* 표본 격자에 봉우리 시각을 강제로 넣는다 — 격자가 19:22 를 비껴가면 최고 수위가
     4.31 이 아니라 4.30 이 되어 이벤트 목록과 0.01 어긋난다(04 §8 "정확히 맞아야") */
  const times: number[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += step) times.push(t);
  for (const w of wWindows) {
    if (w.peakAt >= from.getTime() && w.peakAt <= to.getTime() && !times.includes(w.peakAt))
      times.push(w.peakAt);
  }
  times.sort((a, b) => a - b);

  const out: HistorySample[] = [];
  for (const t of times) {
    const at = new Date(t);

    /* 수위 — 창마다 그 이벤트의 측정값을 향해 오른다. 겹치면 높은 쪽을 따른다 */
    let lift = 0;
    let surge = 0;
    for (const w of wWindows) {
      const s = shapeAt(t, w);
      if (s <= 0) continue;
      surge = Math.max(surge, s);
      lift = Math.max(lift, s * (w.peakVal - base));
    }

    /* 조석 — 하루 두 번. 저수지는 조석이 없어 진폭을 줄인다.
       표본 간격이 벌어지면 12시간 주기가 표본에 걸려 톱니처럼 튄다. 긴 기간에서는
       진폭을 눌러 "평균 수위의 흐름"으로 읽히게 한다 */
    const tideAmp = (districtId === "junam" ? 0.02 : 0.09) * (step <= 3_600_000 ? 1 : step <= 21_600_000 ? 0.3 : 0.12);
    const tide = Math.sin((t / 3_600_000) * (Math.PI / 6)) * tideAmp;
    /* 봉우리에서는 조석·잡음을 걷는다. 그래야 최고 수위가 이벤트 측정값과 정확히 맞는다 */
    const water = base + tide * (1 - surge) + lift + (rand() - 0.5) * 0.04 * (1 - surge);

    let rainSurge = 0;
    let rainPeak = 0;
    for (const w of rWindows) {
      const s = shapeAt(t, w);
      if (s <= 0) continue;
      if (s * w.peakVal > rainSurge * rainPeak) {
        rainSurge = s;
        rainPeak = w.peakVal;
      }
    }
    const rain =
      rainSurge > 0.05
        ? rainSurge * rainPeak * (0.6 + rand() * 0.4)
        : rand() < 0.06
          ? rand() * 2
          : 0;

    out.push({ at, water: Number(water.toFixed(2)), rain: Number(rain.toFixed(1)) });
  }
  return out;
}

export interface ForecastSlot {
  /** 시각 라벨 (예: 18시) */
  label: string;
  windDirection: string;
  windSpeed: number;
  rain: number;
  rainProbability: number;
}

const WIND_DIRECTIONS = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];

/** 시간대별 예보 — 3시간 간격 8구간 (04 §5) */
export function hourlyForecast(districtId: string): ForecastSlot[] {
  const rand = seededRandom(hashSeed(`forecast-${districtId}`));
  /* 예보 슬롯은 정적 앵커(17시)에서 시작 — 시연 중 시계가 흘러도 슬롯이 밀리지 않는다 */
  const startHour = DEMO_DAY.getHours();

  return Array.from({ length: 8 }, (_, i) => {
    const hour = (startHour + i * 3) % 24;
    const gust = 4 + rand() * 6;
    const probability = Math.round(rand() * 70);
    return {
      label: `${String(hour).padStart(2, "0")}시`,
      windDirection: WIND_DIRECTIONS[Math.floor(rand() * WIND_DIRECTIONS.length)],
      windSpeed: Number(gust.toFixed(1)),
      rain: probability > 50 ? Number((rand() * 6).toFixed(1)) : 0,
      rainProbability: probability,
    };
  });
}
