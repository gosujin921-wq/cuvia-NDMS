/* ─────────────────────────────────────────────
 * 침수 시뮬레이션 대상(site) — /scr-00 디지털트윈 시뮬레이션의 데이터 층 (2026-09-17)
 *
 * 화면 논리: 현실 데이터 → 현재 상태 → 시뮬레이션 → 영향 분석 → 관련 SOP → 대응.
 * 이 파일은 그중 "현재 상태"와 "시뮬레이션"을 든다. 화면은 여기서 받은 판(Forecast)을 시간축으로 읽을 뿐 값을 만들지 않는다.
 *
 * ★ 조건은 **판이 있는 값에만** 멈춘다. "80 mm/h" 같은 자유 입력은 두지 않는다 — 강우 → 수위 곡선은 모델이 없어
 *   사전 작성 판이고(모델 연결 시 교체), 수위 → 범위·수심만 지형 계산이다. 화면의 근거 절이 이 둘을 가른다.
 * ★ 축은 둘로 가른다. `조건`(강우 · 환경)과 `조치`(펌프 · 방류 · 환경을 실제로 바꾸는 것). 조치 축을 바꾸면
 *   같은 조건의 기준 판(`baselineOf`)과 견줘 "재시뮬레이션 비교"가 선다. 재난문자·통제처럼 환경을 못 바꾸는 SOP 업무는
 *   시뮬레이션에 넣지 않고 관련 SOP 목록에서 수행 상태만 본다.
 * ★ 대상 둘. 서항(진행 중 · 데모 시계가 현재)과 창원천(2024-08-28 재현 · 14:35 가 현재). 창원천은 종단도(profile)를 든다.
 * ───────────────────────────────────────────── */

import type { Forecast, ForecastMark } from "../forecast";
import type { LngLat } from "../scene";
import type { TwinFamily } from "../incident";
import type { WhatIfCase } from "../whatif";
import { FORECAST_BASE, FORECAST_DRAIN, RAIN120_COMBOS, WHATIF_RAIN120 } from "../../fixtures/seohang-flood/forecasts";
import { INCIDENT_ID as SH_INCIDENT_ID } from "../../fixtures/seohang-flood/incident";
import { CW_INCIDENT_ID } from "../../fixtures/changwoncheon/whatif";
import { GEOMETRIES } from "../../fixtures";
import { findWhatIfCase, trainingResultOf, whatIfStateRowsAt } from "../selectors";
import { deviceKindSpec, devicesOf } from "../../demo/devices";
import { latestValue, tideReadingAt, trendSummaryAt } from "../../demo/measurements";
import { drainageOf } from "../../demo/drainage";
import { sopItemsFor } from "../../demo/sop";
import { floodSurfaceOf } from "../../lib/flood-surfaces";
import { formatMarkMetric, markMetricLabel } from "../../lib/forecast-twin";

export interface SimOption { id: string; label: string; detail?: string; /** 당시 관측값에 곱하는 배율(조건의 정의가 "당시 × 1.2"일 때) */ factor?: number }
export interface SimCondition {
  id: string;
  label: string;
  /** `조건` 은 환경(강우), `조치` 는 환경을 실제로 바꾸는 대응(펌프 · 방류). 조치 축만 재시뮬레이션 비교가 선다 */
  kind: "조건" | "조치";
  /** 이 조건이 바꾸는 관측 줄 이름 — 배율로 환산해 보인다(관측을 지어내는 것이 아니라 조건의 정의다) */
  stateLabel?: string;
  options: SimOption[];
}
export interface StateRow { label: string; value: string; note?: string }
/**
 * 관련 SOP 한 줄 — 기존 SOP 를 **매칭**한다(발동이 아니다).
 * `from` 은 이 줄이 해당되기 시작하는 상황 단계(`stageAt`)다. 사건이 든 규정(`WhatIfCase.sop`)은 대응 종류로 단계를 읽는다:
 * 현상 대응(방류 · 펌프)은 물이 예측되는 순간부터(advisory), 노출 대응(통제 · 대피)은 도로 도달부터(warning).
 * ★ 문구는 기관 SOP 가 오면 교체한다. 여기서 새 항목을 짓지 않는다.
 */
export interface SimSop { id: string; label: string; detail: string; from: "advisory" | "warning" | "evacuate"; mode?: "auto" | "approval" }

/** 대상의 공통 뼈대 — 침수·폭염이 같은 좌측 레일(대상 · 시나리오 · 고른 조건)을 쓴다 */
export interface SimSiteBase {
  id: string;
  label: string;
  status: "진행 중" | "재현";
  /** 시뮬레이션의 "현재" — 진행 중 사건은 데모 시계, 재현은 그날의 판단 시각 */
  now: string;
  /** 재현 대상은 날짜를 화면에 명시한다 */
  dateLabel: string;
  conditions: SimCondition[];
  defaults: Record<string, string>;
  /** 기준 시나리오의 이름 — 안 주면 재현은 "실제 사건 · 그날 조건 · 그날 조치", 진행 중은 "기준 전망" */
  baselineTag?: string;
  baselineLabel?: string;
}

export interface FloodSite extends SimSiteBase {
  incidentId: string;
  family: TwinFamily;
  anchor: LngLat;
  scopeGeometryId?: string;
  boardOf(choice: Record<string, string>): Forecast | null;
  /** 같은 조건에서 조치 축을 기본(실제)으로 둔 판 — 재시뮬레이션 비교의 기준 */
  baselineOf(choice: Record<string, string>): Forecast | null;
  /** 현재 상태 — 관측·운영값. 시뮬레이션 결과가 아니다 */
  currentRows(now: Date): StateRow[];
  /** 이 대상에 매칭되는 기존 SOP */
  sop: SimSop[];
  wcase: WhatIfCase | null;
}

/** 사건이 든 규정 → 관련 SOP 줄. 대응 종류(현상 · 노출)로 해당 단계를 읽는다 */
export const sopOfCase = (wcase: WhatIfCase | null): SimSop[] =>
  (wcase?.sop ?? []).map((s) => {
    const kind = wcase?.responses.find((r) => r.responseId === s.responseId)?.kind;
    return { id: s.id, label: s.label, detail: s.trigger, from: kind === "현상" ? "advisory" : "warning", mode: "approval" };
  });

const ms = (iso: string) => new Date(iso).getTime();

/* ── 서항 — 진행 중 사건. 판은 사건에 붙은 전망(예보대로 · 예보 +20%) × 펌프(정지 · 재가동) ── */
const seohangSite = (demoNow: Date): FloodSite => {
  const wcase = findWhatIfCase(SH_INCIDENT_ID) ?? null;
  const rainDrain = RAIN120_COMBOS.find((c) => c.responseId === "drainage" && c.presetId === "now")?.forecast ?? null;
  const board = (rain: string, pump: string): Forecast | null =>
    rain === "p20" ? (pump === "on" ? rainDrain : WHATIF_RAIN120) : pump === "on" ? FORECAST_DRAIN : FORECAST_BASE;
  return {
    id: "seohang",
    label: "서항 배수권역",
    incidentId: SH_INCIDENT_ID,
    family: wcase?.twinFamily ?? "A",
    status: "진행 중",
    anchor: wcase?.scope.displayAnchor ?? [128.567, 35.197],
    scopeGeometryId: wcase?.scope.affectedGeometryId,
    now: demoNow.toISOString(),
    dateLabel: "진행 중 · 지금",
    conditions: [
      {
        id: "rain", label: "강우", kind: "조건",
        options: [
          { id: "fc", label: "예보대로", detail: "현재 강우·조위 전망 유지" },
          { id: "p20", label: "예보 +20%", detail: "19시 최대 21.4 mm/h · 상위 시나리오" },
        ],
      },
      {
        id: "pump", label: "배수펌프", kind: "조치",
        options: [
          { id: "off", label: "2호기 정지 · 가용 2/3", detail: "지금 상태 그대로" },
          { id: "on", label: "2호기 재가동 · 3/3", detail: "저류시설 추가 유입" },
        ],
      },
    ],
    defaults: { rain: "fc", pump: "off" },
    boardOf: (c) => board(c.rain ?? "fc", c.pump ?? "off"),
    baselineOf: (c) => board(c.rain ?? "fc", "off"),
    currentRows: (at) => {
      /* 진행 중 사건의 관측은 **지금까지**만 있다. 시간축을 미래로 옮겨도 관측 줄은 현재 값에 머문다(미래 관측을 지어내지 않는다) */
      const now = at.getTime() > demoNow.getTime() ? demoNow : at;
      const rows: StateRow[] = [];
      const wl = devicesOf("seohang").find((d) => d.kind === "WL");
      if (wl) {
        const v = latestValue(wl, now);
        const tr = trendSummaryAt(wl, now);
        rows.push({ label: wl.name, value: `${v.value.toFixed(2)} ${deviceKindSpec("WL").unit ?? ""}`.trim(), note: tr ? `최근 30분 ${tr.delta30 >= 0 ? "+" : ""}${tr.delta30.toFixed(2)} m · ${tr.direction}` : undefined });
      }
      const tide = tideReadingAt(now);
      rows.push({ label: "조위 (실측)", value: `${tide.measured.toFixed(2)} EL.m`, note: `해일 편차 +${tide.surge.toFixed(2)} m` });
      const dr = drainageOf("seohang");
      if (dr) rows.push({ label: "배수펌프", value: `${dr.pumpsRunning}/${dr.pumpsTotal} 가동` });
      for (const c of FORECAST_BASE.conditions ?? []) if (/강우|예보/.test(c.label)) rows.push({ label: c.label, value: c.value });
      return rows;
    },
    /* 서항의 SOP 표본은 해일 절차(SOP_ITEMS · 서항지구 대상값)다. 사건이 든 규정이 있으면 그것을 앞에 둔다 */
    sop: [
      ...sopOfCase(wcase),
      ...sopItemsFor("evacuate").map((s) => ({ id: `sh-${s.id}`, label: s.label, detail: s.target === "—" ? "" : s.target, from: s.minLevel, mode: s.mode })),
    ],
    wcase,
  };
};

/* ── 창원천 — 2024-08-28 재현. 판은 훈련 조합(강우 당시 · +20% · +50% × 방류 실제 15:05 · 14:35 조기) ── */
const changwoncheonSite = (): FloodSite | null => {
  const wcase = findWhatIfCase(CW_INCIDENT_ID) ?? null;
  const t = wcase?.training ?? null;
  if (!wcase || !t) return null;
  const now = t.stops[0]?.at ?? wcase.occurredAt;
  const rainSteps = t.conditions[0]?.steps ?? [];
  const actsOf = (discharge: string): Record<string, string> => (discharge === "early" ? { S2: now } : {});
  return {
    id: "changwoncheon",
    label: wcase.title,
    incidentId: CW_INCIDENT_ID,
    family: wcase.twinFamily,
    status: "재현",
    anchor: wcase.scope.displayAnchor,
    scopeGeometryId: wcase.scope.affectedGeometryId,
    now,
    dateLabel: `${now.slice(0, 10).replace(/-/g, ".")} 재현 · ${now.slice(11, 16)} 기준`,
    conditions: [
      { id: "rain", label: "강우", kind: "조건", stateLabel: t.conditions[0]?.stateLabel, options: rainSteps.map((s) => ({ id: s.id, label: s.label, detail: s.detail, factor: s.factor })) },
      {
        id: "discharge", label: "상류 저류지 방류", kind: "조치",
        options: [
          { id: "actual", label: "실제 · 15:05", detail: "그날 한 대로" },
          { id: "early", label: `${now.slice(11, 16)} 조기 방류`, detail: "예측 발생 즉시" },
        ],
      },
    ],
    defaults: { rain: rainSteps[0]?.id ?? "now", discharge: "actual" },
    boardOf: (c) => trainingResultOf(wcase, c.rain ?? "now", actsOf(c.discharge ?? "actual")).mine,
    baselineOf: (c) => trainingResultOf(wcase, c.rain ?? "now", {}).mine,
    currentRows: (at) => whatIfStateRowsAt(wcase, at.toISOString()).rows.map((r) => ({ label: r.label, value: r.value })),
    /* 창원천은 사건이 든 규정(S1 둔치 통제 · S2 상류 저류지 방류 · S3 천변도로 통제)만. 봉암 표본을 끌어오지 않는다(지명이 틀린다) */
    sop: sopOfCase(wcase),
    wcase,
  };
};

/**
 * 대상 목록 — **과거 실제 사건이 먼저다.** 실측 결과가 있어 기준(Baseline)을 설명할 수 있다(2026-09-17 방향:
 * 과거 사건으로 모델 신뢰를 확보하고 그 모델로 "그때 조건이 달랐다면"을 본다). 진행 중 사건은 기준이 전망이라 둘째다.
 */
export function floodSites(demoNow: Date): FloodSite[] {
  return [changwoncheonSite(), seohangSite(demoNow)].filter((s): s is FloodSite => s !== null);
}

/* ═══ 시나리오 — 실제 사건(기준) · A 조건 변경 · B 조치 변경 · A+B. 조건 축의 선택지에서 만든다 ═══ */

export interface SimScenario {
  id: string;
  /** "실제 사건" · "A" · "B" · "A+B" */
  tag: string;
  label: string;
  choice: Record<string, string>;
  /** 기준인가 — 과거 사건이면 실측 결과가 붙는다 */
  baseline: boolean;
}

export function scenariosOf(site: SimSiteBase): SimScenario[] {
  const cond = site.conditions.find((c) => c.kind === "조건");
  const act = site.conditions.find((c) => c.kind === "조치");
  const altCond = cond?.options.find((o) => o.id !== site.defaults[cond.id]) ?? null;
  const altAct = act?.options.find((o) => o.id !== site.defaults[act.id]) ?? null;
  const out: SimScenario[] = [{
    id: "base",
    tag: site.baselineTag ?? (site.status === "재현" ? "실제 사건" : "기준 전망"),
    label: site.baselineLabel ?? (site.status === "재현" ? "그날 조건 · 그날 조치" : "예보대로 · 지금 상태"),
    choice: { ...site.defaults }, baseline: true,
  }];
  if (cond && altCond) out.push({ id: "A", tag: "A", label: `${cond.label} ${altCond.label}`, choice: { ...site.defaults, [cond.id]: altCond.id }, baseline: false });
  if (act && altAct) out.push({ id: "B", tag: "B", label: altAct.label, choice: { ...site.defaults, [act.id]: altAct.id }, baseline: false });
  if (cond && altCond && act && altAct) out.push({ id: "AB", tag: "A+B", label: `${altCond.label} · ${altAct.label}`, choice: { ...site.defaults, [cond.id]: altCond.id, [act.id]: altAct.id }, baseline: false });
  return out;
}

/** 비교표 한 열 — 판 전체에서 읽는다(시각과 무관). 실측은 사건 `observed` 에서 라벨로 찾는다 */
export interface ScenarioSummary {
  startAt: string | null;
  startLabel: string | null;
  /** 판의 핵심 지표 이름 — 창원천은 합류부 수위, 서항은 침수심 */
  metricLabel: string;
  maxDepthM: number;
  maxDepthAt: string | null;
  maxAreaHa: number;
  /** 도달이 적힌 대상 수 */
  hitTargets: number;
}
export function summarizeForecast(f: Forecast): ScenarioSummary {
  const sorted = marksSorted(f);
  const peak = sorted.reduce<ForecastMark | null>((a, m) => (!a || m.maxDepthM > a.maxDepthM ? m : a), null);
  const area = Math.max(0, ...sorted.map((m) => { const r = ringOf(m.extentGeometryId); return r ? ringAreaHa(r) : 0; }));
  const start = f.arrivalAt ?? null;
  return {
    startAt: start,
    startLabel: start ? f.targets.find((t) => t.arrivalAt === start)?.label ?? null : null,
    metricLabel: peak ? markMetricLabel(peak) : "침수심",
    maxDepthM: peak ? (peak.metric?.value ?? peak.maxDepthM) : 0,
    maxDepthAt: peak?.validAt ?? null,
    maxAreaHa: area,
    hitTargets: f.targets.filter((t) => t.arrivalAt && t.exposure !== "영향 없음").length,
  };
}

/* ═══ 시간축 읽기 — 판의 눈금 사이를 보간한다. 수위(해발)는 연속 값이라 보간이 뜻이 있고, 범위 링은 눈금 것을 쓴다 ═══ */

export const marksSorted = (f: Forecast): ForecastMark[] => [...f.marks].sort((a, b) => ms(a.validAt) - ms(b.validAt));

/** 그 시각 이하의 마지막 눈금 — 범위 링·장면은 이것이다. 첫 눈금 전이면 없다(물이 아직 안 왔다) */
export function floorMarkAt(f: Forecast, atIso: string): ForecastMark | null {
  const sorted = marksSorted(f);
  return [...sorted].reverse().find((m) => ms(m.validAt) <= ms(atIso)) ?? null;
}

/** 두 눈금 사이 선형 보간 — 앞 눈금 전은 0, 마지막 눈금 뒤는 마지막 값 */
function lerpMarks(f: Forecast, atIso: string, valueOf: (m: ForecastMark) => number | null): number | null {
  const sorted = marksSorted(f);
  if (sorted.length === 0) return null;
  const at = ms(atIso);
  if (at <= ms(sorted[0].validAt)) return null;
  for (let i = 1; i < sorted.length; i += 1) {
    const a = sorted[i - 1], b = sorted[i];
    if (at <= ms(b.validAt)) {
      const va = valueOf(a), vb = valueOf(b);
      if (va === null || vb === null) return vb ?? va;
      const p = (at - ms(a.validAt)) / Math.max(1, ms(b.validAt) - ms(a.validAt));
      return va + (vb - va) * p;
    }
  }
  return valueOf(sorted[sorted.length - 1]);
}

/**
 * 그 시각의 수면 높이(해발 m) — 지형 수면 채우기의 입력.
 * 첫 눈금 전에는 **관측 수위**를 쓴다(있으면). 예측판 첫 눈금을 당겨 쓰면 시작부터 잠긴 지도가 된다.
 */
export function surfaceLevelAt(f: Forecast, wcase: WhatIfCase | null, atIso: string): number | null {
  const sorted = marksSorted(f);
  const first = sorted[0];
  if (!first) return null;
  if (ms(atIso) < ms(first.validAt)) {
    if (!wcase) return null;
    const label = markMetricLabel(first);
    const raw = whatIfStateRowsAt(wcase, atIso).rows.find((r) => r.label === label)?.value;
    const v = Number.parseFloat(raw ?? "");
    return Number.isFinite(v) ? v : null;
  }
  return lerpMarks(f, atIso, (m) => floodSurfaceOf(m.extentGeometryId)?.spec.level ?? null);
}

/** 그 시각의 최대 침수심(m) — 눈금 사이 보간. 첫 눈금 전은 0 */
export function depthAt(f: Forecast, atIso: string): number {
  return lerpMarks(f, atIso, (m) => m.maxDepthM) ?? 0;
}

/**
 * 그 시각 상태 줄 — 관측 기록 위에 시나리오를 얹는다.
 *   핵심 지표 줄(합류부 수위 · 침수심)   관측이 아니라 **그 시나리오 판의 값**이다. 관측을 그대로 두면 "막은 판"에 넘친 수위가 선다
 *   조건이 바꾸는 줄(상류 강우계)        조건의 배율로 환산한다(정의가 "당시 × 1.2")
 *   나머지                              당시 기록 그대로
 */
export function stateRowsAt(site: FloodSite, f: Forecast | null, choice: Record<string, string>, atIso: string): (StateRow & { computed?: boolean; scaled?: boolean })[] {
  const raw = site.currentRows(new Date(atIso));
  const mark = f ? floorMarkAt(f, atIso) : null;
  const metricLabel = mark ? markMetricLabel(mark) : null;
  const cond = site.conditions.find((c) => c.stateLabel);
  const factor = cond ? cond.options.find((o) => o.id === (choice[cond.id] ?? site.defaults[cond.id]))?.factor ?? 1 : 1;
  return raw.map((r) => {
    if (mark && metricLabel && r.label === metricLabel) return { ...r, value: formatMarkMetric(mark), note: undefined, computed: true };
    if (cond?.stateLabel && factor !== 1 && r.label === cond.stateLabel) {
      const n = Number.parseFloat(r.value);
      if (!Number.isFinite(n)) return r;
      const unit = r.value.replace(/^[\d.]+\s*/, "");
      return { ...r, value: `${Math.round(n * factor)} ${unit}`.trim(), scaled: true };
    }
    return r;
  });
}

/** 지평선 끝 — 마지막 눈금 */
export function horizonOf(f: Forecast): string {
  const s = marksSorted(f);
  return s[s.length - 1]?.validAt ?? f.validUntil ?? f.basis.baseTime;
}

/* ═══ 영향 분석 — 시뮬레이션 결과(범위 링)와 공간 객체의 교차. 수를 지어내지 않는다 ═══ */

/** 링 안에 점이 있나 — 광선 교차 */
export function pointInRing(pt: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 링 면적(ha) — 위도 보정한 평면 근사 */
export function ringAreaHa(ring: LngLat[]): number {
  if (ring.length < 3) return 0;
  const lat0 = (ring.reduce((a, p) => a + p[1], 0) / ring.length) * (Math.PI / 180);
  const kx = 111_320 * Math.cos(lat0), ky = 110_540;
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    s += ring[j][0] * kx * ring[i][1] * ky - ring[i][0] * kx * ring[j][1] * ky;
  }
  return Math.abs(s) / 2 / 10_000;
}

export const ringOf = (geometryId: string | null | undefined): LngLat[] | null => (geometryId ? GEOMETRIES[geometryId] ?? null : null);

export type ImpactStatus = "영향" | "예상" | "영향 없음" | "범위 안";
export interface ImpactObject { id: string; kind: string; label: string; status: ImpactStatus; at?: string; exposure?: string }

/**
 * 그 시각의 영향 객체.
 *   판의 대상(`targets`)  도달 시각이 지났으면 `영향`, 아직이면 `예상`(시각), 도달이 없으면 `영향 없음`
 *   장면의 점 객체        범위 링 안에 들어온 것은 `범위 안` — 판이 대상으로 안 적었어도 공간 교차로 잡는다
 */
export function impactsAt(f: Forecast, atIso: string, scenePoints: { id: string; label: string; at: LngLat }[]): ImpactObject[] {
  const out: ImpactObject[] = f.targets.map((t) => ({
    id: t.id, kind: t.kind, label: t.label,
    status: t.arrivalAt ? (ms(t.arrivalAt) <= ms(atIso) ? "영향" : "예상") : "영향 없음",
    at: t.arrivalAt, exposure: t.exposure,
  }));
  const ring = ringOf(floorMarkAt(f, atIso)?.extentGeometryId);
  if (ring) {
    const known = new Set(out.map((o) => o.label));
    for (const p of scenePoints) {
      if (!known.has(p.label) && pointInRing(p.at, ring)) out.push({ id: p.id, kind: "지점", label: p.label, status: "범위 안" });
    }
  }
  /* 영향 중인 것이 먼저, 예상이 그다음, 없음은 아래 */
  const rank: Record<ImpactStatus, number> = { 영향: 0, "범위 안": 1, 예상: 2, "영향 없음": 3 };
  return out.sort((a, b) => rank[a.status] - rank[b.status] || (a.at ?? "").localeCompare(b.at ?? ""));
}

/**
 * 시뮬레이션이 읽는 상황 단계 — 관련 SOP 의 `minLevel` 과 맞춘다(demo/sop.ts).
 *   물이 없다 → 없음 · 물고임 시작 → advisory · 도로 도달 → warning · 건물·중요시설 도달 → evacuate
 * ★ 이것은 화면의 강조 규칙이지 발령이 아니다. 발령·전파는 담당자 승인 경계를 따른다.
 */
export function stageAt(f: Forecast, atIso: string): "none" | "advisory" | "warning" | "evacuate" {
  const reached = f.targets.filter((t) => t.arrivalAt && ms(t.arrivalAt) <= ms(atIso));
  if (reached.some((t) => t.kind === "건물" || t.kind === "중요시설")) return "evacuate";
  if (reached.some((t) => t.kind === "도로")) return "warning";
  if (depthAt(f, atIso) > 0 || reached.length > 0) return "advisory";
  return "none";
}
