/* ─────────────────────────────────────────────
 * 계측 시계열·부가 데이터 — 정본: docs/정본/04_데모_데이터.md §8
 *
 * 값은 고정 시드로 만든다. 새로고침할 때마다 모양이 바뀌면 시연에서 같은 화면을 두 번
 * 못 보여준다. 진행 중인 이벤트가 있는 지구는 마지막 값이 그 이벤트 측정값과 맞물린다.
 * ───────────────────────────────────────────── */

import { DEMO_NOW, EVENTS, activeEventOf } from "./events";
import { WATER_THRESHOLDS } from "./levels";
import type { Device } from "./devices";
import { hashSeed, seededRandom } from "../lib/seed";

export interface Sample {
  at: Date;
  value: number;
}

interface SeriesOptions {
  /** 되짚을 시간 (기본 6시간) */
  hours?: number;
  /** 표본 간격 (분, 기본 10분) */
  stepMin?: number;
  /** 마지막 표본의 시각 (기본 시연 기준 시각) */
  until?: Date;
}

/**
 * 장비 계측 시계열.
 *
 * 수위는 지구 발령 기준의 아래쪽에서 조석처럼 오르내리고, 진행 중 이벤트가 있으면
 * 마지막 구간에서 기준선을 넘어 이벤트 측정값에 닿는다. 강우는 평소 0 근처에 있다가
 * 이벤트 구간에만 솟는다. 변위는 아주 느리게 누적된다.
 */
export function sensorSeries(device: Device, options: SeriesOptions = {}): Sample[] {
  const hours = options.hours ?? 6;
  const stepMin = options.stepMin ?? 10;
  const until = options.until ?? DEMO_NOW;
  const count = Math.floor((hours * 60) / stepMin) + 1;

  const rand = seededRandom(hashSeed(device.id));
  const event = activeEventOf(device.districtId);
  const matched =
    event &&
    ((device.kind === "WL" && event.type === "수위") ||
      (device.kind === "RN" && event.type === "강우") ||
      (device.kind === "DP" && event.type === "변위"));

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
      const target = matched && event ? event.value : base + 0.12;
      value = base + tide + (target - base) * rise + (rand() - 0.5) * 0.03;
    } else if (device.kind === "RN") {
      const burst = matched && event ? event.value : 8;
      value = Math.max(0, burst * rise * (0.6 + rand() * 0.5) - 0.4);
    } else {
      const base = matched && event ? event.value * 0.6 : 3.4;
      value = base + rise * (matched && event ? event.value * 0.4 : 0.6) + rand() * 0.15;
    }

    samples.push({ at, value: Number(value.toFixed(2)) });
  }

  return samples;
}

/** 최근 측정값 — 팝업·패널의 현재값 */
export function latestValue(device: Device): Sample {
  const series = sensorSeries(device);
  return series[series.length - 1];
}

/** 월별 이벤트 발생 건수 — 최근 12개월. 이번 달은 실제 이벤트 건수와 맞춘다 */
export function monthlyEvents(districtId: string): { month: string; count: number }[] {
  const rand = seededRandom(hashSeed(`monthly-${districtId}`));
  const thisMonth = EVENTS.filter(
    (e) => e.districtId === districtId && new Date(e.raisedAt).getMonth() === DEMO_NOW.getMonth(),
  ).length;

  const out: { month: string; count: number }[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(DEMO_NOW.getFullYear(), DEMO_NOW.getMonth() - i, 1);
    /* 여름(6~9월)에 몰린다. 겨울은 0~1건 */
    const summer = d.getMonth() >= 5 && d.getMonth() <= 8;
    const count = i === 0 ? thisMonth : Math.floor(rand() * (summer ? 5 : 2));
    out.push({ month: `${d.getMonth() + 1}월`, count });
  }
  return out;
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

/** 이벤트가 몰린 두 구간 — 시계열의 봉우리 자리 */
const SURGE_WINDOWS = [
  { from: new Date("2026-08-11T20:00:00"), to: new Date("2026-08-12T03:00:00"), peak: 1 },
  { from: new Date("2026-08-12T14:00:00"), to: new Date("2026-08-12T17:44:00"), peak: 0.85 },
];

/** 구간 안에서 0 → 1 → 0 으로 솟는 값 */
function surgeAt(at: Date): number {
  let out = 0;
  for (const window of SURGE_WINDOWS) {
    const span = window.to.getTime() - window.from.getTime();
    const t = (at.getTime() - window.from.getTime()) / span;
    if (t < 0 || t > 1) continue;
    out = Math.max(out, Math.sin(t * Math.PI) * window.peak);
  }
  return out;
}

/** 지구·기간 수위·강우 시계열 */
export function historySeries(districtId: string, from: Date, to: Date): HistorySample[] {
  const days = Math.max(1, (to.getTime() - from.getTime()) / 86_400_000);
  const step = sampleStepMinutes(days) * 60_000;
  const rand = seededRandom(hashSeed(`history-${districtId}`));
  const threshold = WATER_THRESHOLDS[districtId];
  const base = (threshold?.advisory ?? 2.5) * 0.7;

  /* 봉우리는 그 지구에서 실제로 났던 이벤트 측정값까지 오른다. 통계 화면의 최고 수위가
     이벤트 목록의 측정값과 어긋나면 같은 사건을 두 화면이 다르게 말하는 셈이 된다 */
  const peakEvent = Math.max(
    base + 0.4,
    ...EVENTS.filter((e) => e.districtId === districtId && e.type === "수위").map((e) => e.value),
  );
  const headroom = peakEvent - base;

  const out: HistorySample[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += step) {
    const at = new Date(t);
    const surge = surgeAt(at);
    /* 조석 — 하루 두 번. 저수지는 조석이 없어 진폭을 줄인다.
       표본 간격이 벌어지면 12시간 주기가 표본에 걸려 톱니처럼 튄다. 긴 기간에서는
       진폭을 눌러 "평균 수위의 흐름"으로 읽히게 한다 */
    const tideAmp = (districtId === "junam" ? 0.02 : 0.09) * (step <= 3_600_000 ? 1 : step <= 21_600_000 ? 0.3 : 0.12);
    const tide = Math.sin((t / 3_600_000) * (Math.PI / 6)) * tideAmp;
    /* 봉우리에서는 조석·잡음을 걷는다. 그래야 최고 수위가 이벤트 측정값과 정확히 맞는다 */
    const water =
      base + tide * (1 - surge) + surge * headroom + (rand() - 0.5) * 0.04 * (1 - surge);
    const rain = surge > 0.05 ? surge * 22 * (0.5 + rand() * 0.7) : rand() < 0.06 ? rand() * 2 : 0;
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
  const startHour = DEMO_NOW.getHours();

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
