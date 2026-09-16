/* ─────────────────────────────────────────────
 * 창원천 하류 범람 — 종료 사건의 대응 What-if (03 §26.2 · §22 B · 2026-09-16 창원천을 과거 종료 사건으로)
 *
 * 하천범람의 핵심은 "상류의 수위 변화가 하류로 전달되고 특정 구간이 기준 수위를 넘는 과정"이다(03 §22 B).
 * 창원천은 명곡동 부근 → 산단 구간 → 남천 합류 → 마산만 하구로 이어져, 상류가 먼저 차고 하류가 뒤따라 넘친다.
 *
 * 종료 사건이라 기준은 **실제로 한 대응**이다 — 14:50 둔치 산책로 통제 · 15:05 상류 저류지 방류 · 15:22 하구 천변도로 통제.
 * 합류부가 기준 수위 2.5 m 를 넘은 것도 15:22 였다. 천변도로 통제가 범람과 같은 시각이었고, 방류는 비가 거세진 뒤였다.
 * 그래서 묻는 것은 두 갈래다.
 *   대응 조건  그때 방류를 10분·20분 일찍 했다면 · 천변도로를 10분·20분 일찍 막았다면
 *   상황 조건  비가 20% 더 왔다면 · 만조가 첨두와 겹쳤다면 — 같은 대응으로 버틸 수 있었나(다음 대비 점검)
 * 실제 기록은 고치지 않는다. 실제 사건(기준 재현)은 그대로 두고 분석 기준(▲)부터 조건 하나만 바꾼 다른 진행을 만든다.
 *
 *   분석 기준  원장의 판단 시점 셋(범람 예측 발생 14:35 · 위험도 상향 14:50 · 천변도로 통제 15:22) 중 고른다. 아무 시각이나 입력하지 않는다.
 *             상황 조건 판은 판단 시점마다 사전 계산해 둔다(강우 악화 세 벌 · 만조 중첩 한 벌 — 만조 전이라 세 시점이 같다)
 *   지표      합류부 수위(EL.m) — 범람면을 채우는 수위와 같은 값. 기준 2.5 m 를 넘으면 하구 천변도로가 통행 지장에 들어간다
 *   도달      합류부 수위가 2.5 m 를 넘는 시각. 두 눈금 사이는 직선으로 끼워 분 단위로 정했다
 *   건물      합류부 저지대 건물 수는 범람 계산(굽기 단계별 침수 건물)의 결과다. 규칙으로 내지 않는다
 *
 * 좌표는 베이스맵 채록(하천·도로), 범람면은 10 m 지형에서 굽는다(scripts/bake-flood-changwoncheon.mjs).
 * 관측소 이름은 위치 설명이다 — 실제 관측소 명칭이 아니다. 상류 저류지·만조 시각·수위·시각은 시나리오 편집값이고 정확도를 주장하지 않는다.
 * ───────────────────────────────────────────── */

import type { Forecast, ForecastBasis, ForecastInput, ForecastMark, ImpactTarget, MarkImpact } from "../../model/forecast";
import type { ConditionLine, LngLat, PointTone, SceneLayer, SceneProfile } from "../../model/scene";
import type { WhatIfCase, WhatIfCombo, WhatIfResponse, WhatIfSituation } from "../../model/whatif";
import { CW_COAST_ROAD, CW_GEOMETRIES, CW_RIVER, CW_ROAD_WET, CW_STATIONS, CW_TRUNK_ROAD } from "./geometry.generated";

export const CW_INCIDENT_ID = "INC-2024-0828-CW01";
const t = (hhmm: string) => `2024-08-28T${hhmm}:00+09:00`;
/** 재현·대안 판의 기준시각 — 관측 입력이 끝난 사건 종료 시각. 둘 다 사건이 끝난 뒤 계산했다 */
const BASE = t("17:40");
const VALID_UNTIL = t("17:00");
const AT = [t("15:00"), t("15:30"), t("16:00"), t("16:30")] as const;
const TIDE_MARKER = [{ at: t("15:24"), label: "만조" }];

export const CHANGWONCHEON_GEOMETRIES = CW_GEOMETRIES;

/* ── 하천 구간 — 관측소에서 끊는다. 상류가 먼저 붉어지고 하류가 뒤따른다 ── */
type St = "a" | "b" | "c" | "d";
const idx = Object.fromEntries(CW_STATIONS.map((s) => [s.id, s.index])) as Record<St, number>;
const REACHES: { id: string; station: St; coords: LngLat[]; label?: string }[] = [
  { id: "cw-reach-up", station: "a", coords: CW_RIVER.slice(0, idx.b + 1), label: "창원천" },
  { id: "cw-reach-mid", station: "b", coords: CW_RIVER.slice(idx.b, idx.c + 1) },
  { id: "cw-reach-low", station: "c", coords: CW_RIVER.slice(idx.c, idx.d + 1) },
  { id: "cw-reach-mouth", station: "d", coords: CW_RIVER.slice(idx.d), label: "하구 → 마산만" },
];
const STATION_AT = Object.fromEntries(CW_STATIONS.map((s) => [s.id, s])) as Record<St, (typeof CW_STATIONS)[number]>;

/** 수위 → 상태. 기준을 넘으면 초과, 0.6 m 안이면 경계 — 예측판 작성 규칙이다(화면이 계산하지 않는다) */
const levelState = (level: number, threshold: number): { tone: PointTone; word: string } =>
  level >= threshold ? { tone: "danger", word: "기준 초과" } : level >= threshold - 0.6 ? { tone: "warning", word: "경계" } : { tone: "primary", word: "정상" };

/* ── 도로 상태 — 굽기가 뜬 잠긴 토막에만 선다(서항 해안도로와 같은 문법) ── */
type RoadState = "통행 가능" | "물고임" | "차로 침수 · 서행" | "통행 불가" | "통제됨";
const ROAD_TONE: Record<RoadState, PointTone> = { "통행 가능": "neutral", 물고임: "warning", "차로 침수 · 서행": "warning", "통행 불가": "danger", 통제됨: "primary" };
const ROAD_IMPACT_TONE: Record<RoadState, MarkImpact["tone"]> = { "통행 가능": "muted", 물고임: "warning", "차로 침수 · 서행": "warning", "통행 불가": "danger", 통제됨: "safe" };
const coastStateOf = (stage: string): RoadState =>
  stage === "GEO-CW-L20" ? "물고임" : stage === "GEO-CW-L25" ? "차로 침수 · 서행" : ["GEO-CW-L28", "GEO-CW-L32", "GEO-CW-L35"].includes(stage) ? "통행 불가" : "통행 가능";

/** 한 눈금의 장면 — 하천 구간·관측소 상태, 천변도로·간선도로의 잠긴 토막, 통제면 차단 지점 */
function cwScene(levels: [number, number, number, number], stage: string, controlled: boolean): SceneLayer[] {
  const lv: Record<St, number> = { a: levels[0], b: levels[1], c: levels[2], d: levels[3] };
  const reaches: SceneLayer[] = REACHES.map((r) => ({ kind: "line", id: r.id, role: "하천", coords: r.coords, state: "on", tone: levelState(lv[r.station], STATION_AT[r.station].threshold).tone, label: r.label }));
  const stations: SceneLayer[] = CW_STATIONS.map((s) => {
    const v = lv[s.id as St], st = levelState(v, s.threshold);
    return { kind: "point", id: `cw-st-${s.id}`, at: s.at, icon: "mdi:waves", label: `${s.label} 수위계`, state: `${v.toFixed(1)} m · ${st.word}`, tone: st.tone, small: true };
  });
  const wet = CW_ROAD_WET[stage] ?? { coast: [], trunk: [] };
  const coastState: RoadState = controlled && wet.coast.length ? "통제됨" : coastStateOf(stage);
  const coastRuns: SceneLayer[] = wet.coast.map((run, i) => ({ kind: "line", id: `cw-coast-wet-${i}`, role: "도로", coords: run, state: coastState === "통제됨" ? "planned" : "on", tone: ROAD_TONE[coastState], label: i === 0 ? `하구 천변도로 · ${coastState}` : undefined }));
  const trunkRuns: SceneLayer[] = wet.trunk.map((run, i) => ({ kind: "line", id: `cw-trunk-wet-${i}`, role: "도로", coords: run, state: "on", tone: "warning", label: i === 0 ? "합류부 간선도로 · 부분 침수" : undefined }));
  const longest = [...wet.coast].sort((x, y) => y.length - x.length)[0];
  const blocks: SceneLayer[] = controlled && longest
    ? [
        { kind: "point", id: "cw-block-w", at: longest[0], icon: "mdi:traffic-cone", label: "차단 (서)", state: "통제 중", tone: "primary", small: true },
        { kind: "point", id: "cw-block-e", at: longest[longest.length - 1], icon: "mdi:traffic-cone", label: "차단 (동)", state: "통제 중", tone: "primary", small: true },
      ]
    : [];
  return [...reaches, ...stations, ...coastRuns, ...trunkRuns, ...blocks];
}

/** 예측판 공통 층 — 도로 전체(마른 구간 포함)와 남천 합류 지점 */
const CW_STATIC: SceneLayer[] = [
  { kind: "line", id: "cw-coast-road", role: "도로", coords: CW_COAST_ROAD, state: "on", tone: "neutral" },
  { kind: "line", id: "cw-trunk-road", role: "도로", coords: CW_TRUNK_ROAD, state: "on", tone: "neutral" },
  { kind: "point", id: "cw-confluence", at: CW_STATIONS[3].at, icon: "mdi:call-merge", label: "남천 합류", tone: "neutral", small: true },
];

const profileOf = (rows: Rows): SceneProfile => ({
  stations: CW_STATIONS.map((s) => ({ id: s.id, label: s.label, km: s.km, bed: s.bed, threshold: s.threshold })),
  threshold: CW_STATIONS[CW_STATIONS.length - 1].threshold,
  levelsByMark: Object.fromEntries(AT.map((at, i) => [at, rows[i]])),
});

/* 재현 입력 — 사건 동안의 관측·운영 기록. 예보는 쓰지 않는다(이미 일어난 일이다) */
const INPUTS: ForecastInput[] = [
  { label: "상류 강우 관측", at: t("17:40"), kind: "관측" },
  { label: "하천 수위 (상·중·하류)", at: t("17:40"), kind: "관측" },
  { label: "조위 관측 (마산만)", at: t("17:40"), kind: "관측" },
  { label: "상류 저류지 운영 기록", at: t("17:40"), kind: "시설" },
];
/** 기준 재현은 관측 강우·수위를 넣어 다시 계산한 것이고, 대안은 같은 계산 방식에 조건 하나만 바꾼 것이다(효과 = 대안 − 기준 재현).
    둘 다 사건이 끝난 뒤(18:30) 계산했다. 재현은 관측이 입력이라 불확실성이 낮고, 대안은 일어나지 않은 진행이라 높다 */
const basis = (assumptions: string[], modelName = "대안 계산 (재현과 같은 방식 · 대응만 변경)", grade: ForecastBasis["uncertainty"]["grade"] = "높음"): ForecastBasis => ({
  modelName, modelVersion: "0.1", baseTime: BASE, generatedAt: t("18:30"),
  observedFrom: t("13:30"), inputs: INPUTS, inputEventIds: [], assumptions,
  uncertainty: { grade, sensitiveTo: ["상류 강우 관측의 대표성", "만조와 하구 배수의 겹침"], unusableRanges: ["17:00 이후"] },
  inputQuality: "보정", calculationActor: "해당 없음",
  replacementNote: "홍수예측 제공 주체 확정 시 같은 조건의 ModelRun 결과로 교체",
});

const STAGE_LEVEL: Record<string, number> = { "GEO-CW-L10": 1.0, "GEO-CW-L15": 1.5, "GEO-CW-L20": 2.0, "GEO-CW-L25": 2.5, "GEO-CW-L28": 2.8, "GEO-CW-L32": 3.2, "GEO-CW-L35": 3.5 };
const SUMMARY: Record<string, string> = {
  "GEO-CW-L10": "둔치 가장자리 물참",
  "GEO-CW-L15": "둔치 산책로 잠김 · 상류 수위 상승",
  "GEO-CW-L20": "둔치 전면 잠김 · 하구 천변도로 물고임",
  "GEO-CW-L25": "하구 천변도로 차로 침수 · 합류부 기준 수위 도달",
  "GEO-CW-L28": "하구 천변도로 통행 불가 · 중·하류 기준 초과",
  "GEO-CW-L32": "합류부 저지대 범람 시작 · 만조 뒤 하구 정체",
  "GEO-CW-L35": "합류부 북안 저지대 범람",
};
type Rows = [number, number, number, number][];
type Stages = [string, string, string, string];
/** 그 시각에 물에 잠긴 합류부 저지대 건물 — 범람 계산 결과(판마다 편집). 사건 전체 건물 수(영향 대상)는 이 중 최대다 */
type Buildings = [number, number, number, number];
function marksOf(stages: Stages, rows: Rows, controlledFrom: string | null, buildings: Buildings): ForecastMark[] {
  return AT.map((validAt, i) => {
    const stage = stages[i];
    const controlled = controlledFrom !== null && validAt >= controlledFrom;
    const road: RoadState = controlled && (CW_ROAD_WET[stage]?.coast.length ?? 0) > 0 ? "통제됨" : coastStateOf(stage);
    return {
      validAt, extentGeometryId: stage, impactSummary: SUMMARY[stage],
      /* 그 시각의 핵심 영향 — 지표(합류부 수위) 아래 두 줄 */
      impacts: [
        { label: "하구 천변도로", value: road, tone: ROAD_IMPACT_TONE[road] },
        { label: "저지대 건물", value: buildings[i] > 0 ? "침수" : "침수 없음", tone: buildings[i] > 0 ? "danger" : "muted" },
      ],
      maxDepthM: Number(Math.max(0.05, STAGE_LEVEL[stage] - 1.0).toFixed(2)),
      metric: { label: "합류부 수위", value: rows[i][3], unit: "m", digits: 1 },
      /* 천변도로 통제는 그 시각 이후 눈금부터 선다 */
      scene: cwScene(rows[i], stage, controlled),
    };
  });
}
const conditionsOf = (reservoir: string, rain = "35 mm/h 매우 강함", tide = "15:24 · 마산만"): ConditionLine[] => [
  { label: "강우", value: rain, tone: "warning" },
  { label: "만조", value: tide },
  { label: "상류 저류지", value: reservoir },
];

/* 영향 대상 — 천변도로가 첫째다(도달 = 천변도로 통행 지장 시작).
   수는 적지 않는다. 대상과 상태만 둔다 — 통제로 줄어드는 차량·인원 수는 산수라 결과로 쓰지 않는다(README §2.3 기준 ③ · 2026-09-16) */
const targets = (arrival: string, trunkAt: string, onset: string | null, controlAt: string, buildings: number, trunk: ImpactTarget["exposure"] = "부분 중단"): ImpactTarget[] => {
  /* 물고임이 시작된 뒤에 통제가 끝나면 그 사이는 노출이다. 얼마나인지는 세지 않는다 */
  const exposed = onset !== null && controlAt > onset;
  /* 예측 범위 안에 기준 수위를 안 넘으면 도달이 없다 — 자리값(유효 종료)을 시각처럼 적지 않는다(2026-09-16) */
  const reach = (at: string) => (at >= VALID_UNTIL ? {} : { arrivalAt: at });
  return [
    { kind: "도로", id: "RD-CW-COAST", label: "하구 천변도로", ...reach(arrival), exposure: "통제됨" },
    { kind: "도로", id: "RD-CW-TRUNK", label: "합류부 간선도로", ...reach(trunkAt), exposure: trunk },
    { kind: "건물", id: "BLD-CW-LOW", label: "합류부 저지대 건물", exposure: buildings > 0 ? "노출" : "영향 없음" },
    { kind: "대상자", id: "POP-CW-PARK", label: "천변도로 이용자", exposure: exposed ? "노출" : "통제됨" },
  ];
};
/** 합류부 저지대 침수 건물 — 첨두 범람 단계의 결과(L32 범람 시작 · L35 북안 범람). 기준 재현 6동(첨두), 현장 조사는 7동이다 */
const ACTUAL_BUILDING_MARKS: Buildings = [0, 0, 6, 3];
/** 천변도로 물고임 시작 — 기준 재현은 15:00 눈금에 이미 물고임이다 */
const ONSET = t("15:00");

const ACTUAL_CONTROL = t("15:22");
const common = { incidentId: CW_INCIDENT_ID, availability: "가용" as const, validUntil: VALID_UNTIL, scene: CW_STATIC, conditionMarkers: TIDE_MARKER };

/* ── 판 한 벌의 편집값 — 네 관측소 수위 · 범람 단계 · 잠긴 건물 · 도달 · 물고임 시작. 예측판(Forecast)은 여기서 만든다 ── */
interface CwBoard {
  rows: Rows;
  /** 범람면 단계 — 비우면 합류부 수위에 가장 가까운 단계 */
  stages?: Stages;
  buildings: Buildings;
  /** 합류부 2.5 m 초과(천변도로 통행 지장) */
  arrival: string;
  trunkAt: string;
  /** 천변도로 물고임 시작 — 노출 규칙의 위험 시작 */
  onset: string | null;
  trunk?: ImpactTarget["exposure"];
  reservoir: string;
  rain?: string;
  tide?: string;
  markers?: { at: string; label: string }[];
}
const stageOf = (level: number): string =>
  Object.entries(STAGE_LEVEL).reduce((best, [id, lv]) => (Math.abs(lv - level) < Math.abs(STAGE_LEVEL[best] - level) ? id : best), "GEO-CW-L10");
const boardOf = (b: CwBoard, meta: { id: string; alternativeId: Forecast["alternativeId"]; changed: string[]; hypothesis?: string; basis: ForecastBasis; controlAt: string; actionAt?: { label: string; at: string } }): Forecast => ({
  ...common, forecastId: meta.id, alternativeId: meta.alternativeId, changedConditions: meta.changed,
  ...(meta.hypothesis ? { hypothesis: meta.hypothesis } : {}),
  marks: marksOf(b.stages ?? (b.rows.map((r) => stageOf(r[3])) as Stages), b.rows, meta.controlAt, b.buildings),
  arrivalAt: b.arrival,
  targets: targets(b.arrival, b.trunkAt, b.onset, meta.controlAt, Math.max(...b.buildings), b.trunk ?? "부분 중단"),
  basis: meta.basis,
  profile: profileOf(b.rows), conditions: conditionsOf(b.reservoir, b.rain, b.tide),
  ...(b.markers ? { conditionMarkers: b.markers } : {}),
  ...(meta.actionAt ? { actionAt: meta.actionAt } : {}),
});

/* ── 실제 — 방류 15:05 · 천변도로 통제 15:22. 합류부가 15:22 에 2.5 m 를 넘었다 ── */
const ACTUAL_ROWS: Rows = [[13.1, 5.8, 2.1, 1.9], [12.9, 6.4, 2.8, 2.7], [12.4, 6.3, 3.3, 3.2], [11.8, 5.9, 2.9, 2.8]];
const ACTUAL_B: CwBoard = { rows: ACTUAL_ROWS, stages: ["GEO-CW-L20", "GEO-CW-L28", "GEO-CW-L32", "GEO-CW-L28"], buildings: ACTUAL_BUILDING_MARKS, arrival: t("15:22"), trunkAt: t("15:30"), onset: ONSET, reservoir: "방류 15:05" };
export const CW_ACTUAL: Forecast = boardOf(ACTUAL_B, {
  id: "FC-CW-ACTUAL", alternativeId: "baseline", changed: [], controlAt: ACTUAL_CONTROL,
  basis: basis(["관측 강우·수위를 넣어 다시 계산", "만조 15:24 마산만", "실제 대응: 방류 15:05 · 천변도로 통제 15:22"], "재현 계산 (관측 강우·수위 입력)", "보통"),
});

/* ── 방류를 10분 일찍(14:55) — 첨두가 깎이고 도달이 15분 늦어진다. 천변도로 통제(15:22)가 범람보다 앞선다 ── */
const DIS10_B: CwBoard = { rows: [[13.0, 5.7, 2.0, 1.8], [12.7, 6.2, 2.6, 2.4], [12.2, 6.1, 2.9, 2.8], [11.7, 5.8, 2.6, 2.5]], stages: ["GEO-CW-L20", "GEO-CW-L25", "GEO-CW-L28", "GEO-CW-L25"], buildings: [0, 0, 0, 0], arrival: t("15:37"), trunkAt: t("16:00"), onset: ONSET, reservoir: "방류 14:55" };
/* ── 방류를 20분 일찍(14:45) — 합류부가 16:00 에야 기준에 닿는다. 천변도로 물고임이 15:25 에야 시작해 실제 통제(15:22)가 먼저 끝난다 ── */
const DIS20_B: CwBoard = { rows: [[12.8, 5.5, 1.8, 1.6], [12.5, 6.0, 2.4, 2.2], [12.0, 5.9, 2.6, 2.5], [11.5, 5.6, 2.3, 2.2]], stages: ["GEO-CW-L15", "GEO-CW-L20", "GEO-CW-L25", "GEO-CW-L20"], buildings: [0, 0, 0, 0], arrival: t("16:00"), trunkAt: t("16:00"), onset: t("15:25"), reservoir: "방류 14:45" };
/* ── 알린 직후 방류(14:35) — 예측이 뜨자마자 열었다면. 첨두가 2.3 m 에 그쳐 **합류부가 기준 수위(2.5 m)를 넘지 않는다**.
   넘지 않으면 도달이 없다 — 도달 시각 자리에는 유효 종료를 넣고 화면이 "없음"으로 읽는다(lib/forecast-compare) ── */
const DIS30_B: CwBoard = { rows: [[12.6, 5.3, 1.7, 1.5], [12.3, 5.8, 2.2, 2.0], [11.8, 5.7, 2.4, 2.3], [11.3, 5.4, 2.1, 2.0]], stages: ["GEO-CW-L15", "GEO-CW-L20", "GEO-CW-L20", "GEO-CW-L15"], buildings: [0, 0, 0, 0], arrival: VALID_UNTIL, trunkAt: VALID_UNTIL, onset: null, reservoir: "방류 14:35" };
const DISCHARGES = [
  { b: DIS30_B, at: t("14:35"), early: "알린 직후", key: "DIS-30", presetId: "fired" },
  { b: DIS10_B, at: t("14:55"), early: "10분 일찍", key: "DIS-10", presetId: "early10" },
  { b: DIS20_B, at: t("14:45"), early: "20분 일찍", key: "DIS-20", presetId: "early20" },
] as const;
const dischargeBoard = (d: (typeof DISCHARGES)[number]): Forecast => boardOf(d.b, {
  id: `FC-CW-${d.key}`, alternativeId: "discharge", controlAt: ACTUAL_CONTROL,
  changed: [`상류 저류지 방류 · ${d.at.slice(11, 16)} (실제보다 ${d.early})`],
  hypothesis: `상류 저류지 방류를 실제보다 ${d.early}(${d.at.slice(11, 16)}) 한 경우`,
  basis: basis(["관측 강우·수위 입력 (기준 재현과 같음)", "만조 15:24 마산만", `방류 ${d.at.slice(11, 16)} 가정 · 천변도로 통제는 실제(15:22) 그대로`]),
  actionAt: { label: "방류 시점", at: d.at },
});
export const CW_DISCHARGE_FIRED = dischargeBoard(DISCHARGES[0]);
export const CW_DISCHARGE_10 = dischargeBoard(DISCHARGES[1]);
export const CW_DISCHARGE_20 = dischargeBoard(DISCHARGES[2]);

/* ── 천변도로 통제를 일찍 — 물은 그대로, 들어간 차와 사람만 준다(노출 감소) ──
   선택지는 트윈이 계산한 물고임 시작(15:00) 앞뒤로 걸친다. 30분 일찍(14:52)이면 물보다 먼저 막는다 — 일찍 할수록 비례로 주는 산수가 아니게 */
const ROADS = [
  { at: t("14:35"), early: "알린 직후", key: "ROAD-35", presetId: "fired" },
  { at: t("15:12"), early: "10분 일찍", key: "ROAD-10", presetId: "early10" },
  { at: t("14:52"), early: "30분 일찍", key: "ROAD-30", presetId: "early30" },
] as const;
const roadOn = (b: CwBoard, r: { at: string; early: string }, id: string, basisLines: string[]): Forecast => boardOf(b, {
  id, alternativeId: "road-control", controlAt: r.at,
  changed: [`하구 천변도로 통제 · ${r.at.slice(11, 16)} (실제보다 ${r.early})`],
  hypothesis: `하구 천변도로를 실제보다 ${r.early}(${r.at.slice(11, 16)}) 막은 경우`,
  basis: basis([...basisLines, `천변도로 통제 ${r.at.slice(11, 16)} 가정`], "규칙 계산 (같은 기록에 통제 시각만 변경)"),
  actionAt: { label: "통제 시점", at: r.at },
});
export const CW_ROAD_FIRED = roadOn(ACTUAL_B, ROADS[0], "FC-CW-ROAD-35", ["범람면은 기준 재현과 동일"]);
export const CW_ROAD_10 = roadOn(ACTUAL_B, ROADS[1], "FC-CW-ROAD-10", ["범람면은 기준 재현과 동일"]);
export const CW_ROAD_30 = roadOn(ACTUAL_B, ROADS[2], "FC-CW-ROAD-30", ["범람면은 기준 재현과 동일"]);

/* ── 상황 조건 — 사람이 조작하지 못한 강우·조위가 달랐다면. 대응은 실제(방류 15:05 · 통제 15:22) 그대로 ──
   분석 기준(▲)까지는 실제와 같고 거기서부터 입력 하나만 바꾼다. 계산 방식은 기준 재현과 같다 */
const DECISIONS = [t("14:35"), t("14:50"), t("15:22")] as const;
interface SitBoard { f: Forecast; b: CwBoard; /** 이 판이 쓰이는 가장 이른 분석 기준 — 그보다 이른 선택지는 조합이 없다 */ from: string; change: string }
const sitBoard = (id: string, b: CwBoard, from: string, change: string, changed: string, hypothesis: string): SitBoard => ({
  b, from, change,
  f: boardOf(b, {
    id, alternativeId: "situation", controlAt: ACTUAL_CONTROL, changed: [changed], hypothesis,
    basis: basis([change, "실제 대응 그대로: 방류 15:05 · 천변도로 통제 15:22"], "대안 계산 (재현과 같은 방식 · 상황 입력만 변경)"),
  }),
});
/* 강우 +20% — 늦게 바뀔수록 차이가 준다. 14:35 부터면 합류부가 12분 일찍 넘고, 15:22 부터면 도달은 같고 첨두만 높다 */
const RAIN = "42 mm/h 매우 강함 (+20%)";
const rainSit = (from: string, b: Omit<CwBoard, "trunk" | "reservoir" | "rain">): SitBoard =>
  sitBoard(`FC-CW-RAIN120-${from.slice(11, 13)}${from.slice(14, 16)}`, { ...b, trunk: "중단", reservoir: "방류 15:05", rain: RAIN }, from,
    `상류 강우 +20% · 35 → 42 mm/h (${from.slice(11, 16)} 이후)`, `상류 강우 +20% · ${from.slice(11, 16)} 이후 42 mm/h (실제 35)`, `${from.slice(11, 16)} 이후 상류 강우가 실제보다 20% 강했던 경우`);
/* 14:35 부터 — 천변도로 물고임 14:52(8분 이르다) · 합류부 15:10 기준 초과 · 첨두 3.6 m 북안 저지대까지 */
const RAIN_1435 = rainSit(DECISIONS[0], { rows: [[13.4, 6.1, 2.3, 2.2], [13.3, 6.9, 3.2, 3.1], [12.9, 6.8, 3.7, 3.6], [12.2, 6.3, 3.3, 3.2]], stages: ["GEO-CW-L20", "GEO-CW-L32", "GEO-CW-L35", "GEO-CW-L32"], buildings: [0, 5, 14, 8], arrival: t("15:10"), trunkAt: t("15:18"), onset: t("14:52") });
/* 14:50 부터 — 물고임 14:57 · 합류부 15:17 · 첨두 3.5 m */
const RAIN_1450 = rainSit(DECISIONS[1], { rows: [[13.2, 5.9, 2.2, 2.0], [13.2, 6.7, 3.0, 2.9], [12.8, 6.7, 3.6, 3.5], [12.1, 6.2, 3.2, 3.1]], stages: ["GEO-CW-L20", "GEO-CW-L28", "GEO-CW-L35", "GEO-CW-L32"], buildings: [0, 0, 12, 7], arrival: t("15:17"), trunkAt: t("15:24"), onset: t("14:57") });
/* 15:22 부터 — 이미 기준을 넘은 뒤라 도달·물고임은 실제와 같고, 첨두가 3.4 m 로 오른다 */
const RAIN_1522 = rainSit(DECISIONS[2], { rows: [[13.1, 5.8, 2.1, 1.9], [13.0, 6.5, 2.9, 2.8], [12.7, 6.6, 3.5, 3.4], [12.0, 6.1, 3.1, 3.0]], stages: ["GEO-CW-L20", "GEO-CW-L28", "GEO-CW-L35", "GEO-CW-L32"], buildings: [0, 0, 10, 6], arrival: t("15:22"), trunkAt: t("15:28"), onset: ONSET });
/* 강우 +50% — 같은 방식에 세기만 한 단계 더. "어디까지 버티나"를 보려면 단계가 둘은 있어야 한다(2026-09-16 사용자).
   합류부 첨두가 4 m 를 넘어 범람면은 구운 마지막 단계(L35)에서 멈춘다 — 그 위 단계는 굽지 않았다 */
const RAIN50 = "53 mm/h 매우 강함 (+50%)";
const rain50Sit = (from: string, b: Omit<CwBoard, "trunk" | "reservoir" | "rain">): SitBoard =>
  sitBoard(`FC-CW-RAIN150-${from.slice(11, 13)}${from.slice(14, 16)}`, { ...b, trunk: "중단", reservoir: "방류 15:05", rain: RAIN50 }, from,
    `상류 강우 +50% · 35 → 53 mm/h (${from.slice(11, 16)} 이후)`, `상류 강우 +50% · ${from.slice(11, 16)} 이후 53 mm/h (실제 35)`, `${from.slice(11, 16)} 이후 상류 강우가 실제보다 50% 강했던 경우`);
/* 14:35 부터 — 물고임 14:45 · 합류부 15:02 기준 초과(20분 이르다) · 첨두 4.1 m */
const RAIN50_1435 = rain50Sit(DECISIONS[0], { rows: [[13.6, 6.4, 2.6, 2.5], [13.6, 7.3, 3.6, 3.5], [13.2, 7.2, 4.2, 4.1], [12.5, 6.7, 3.8, 3.7]], stages: ["GEO-CW-L25", "GEO-CW-L35", "GEO-CW-L35", "GEO-CW-L35"], buildings: [0, 9, 20, 13], arrival: t("15:02"), trunkAt: t("15:10"), onset: t("14:45") });
/* 14:50 부터 — 물고임 14:50 · 합류부 15:08 · 첨두 3.9 m */
const RAIN50_1450 = rain50Sit(DECISIONS[1], { rows: [[13.4, 6.2, 2.4, 2.3], [13.5, 7.1, 3.4, 3.3], [13.1, 7.0, 4.0, 3.9], [12.4, 6.6, 3.6, 3.5]], stages: ["GEO-CW-L20", "GEO-CW-L35", "GEO-CW-L35", "GEO-CW-L35"], buildings: [0, 6, 18, 11], arrival: t("15:08"), trunkAt: t("15:16"), onset: t("14:50") });
/* 15:22 부터 — 이미 넘은 뒤라 도달은 같고 첨두가 3.7 m 로 오른다 */
const RAIN50_1522 = rain50Sit(DECISIONS[2], { rows: [[13.1, 5.8, 2.1, 1.9], [13.2, 6.8, 3.1, 3.0], [12.9, 6.9, 3.8, 3.7], [12.2, 6.4, 3.4, 3.3]], stages: ["GEO-CW-L20", "GEO-CW-L32", "GEO-CW-L35", "GEO-CW-L32"], buildings: [0, 0, 15, 9], arrival: t("15:22"), trunkAt: t("15:26"), onset: ONSET });
/* 만조 중첩 — 만조가 16:05 로 늦어 첨두와 겹치면 하구로 빠지지 못한다. 도달은 같고 첨두가 높고 오래 간다. 만조 전 판단 시점 셋에 같은 판 */
const TIDE = sitBoard("FC-CW-TIDE-PEAK", {
  rows: [[13.1, 5.8, 2.1, 1.9], [12.9, 6.4, 2.8, 2.7], [12.5, 6.5, 3.6, 3.5], [12.0, 6.2, 3.4, 3.3]], stages: ["GEO-CW-L20", "GEO-CW-L28", "GEO-CW-L35", "GEO-CW-L32"],
  buildings: [0, 0, 11, 9], arrival: t("15:22"), trunkAt: t("15:30"), onset: ONSET, trunk: "중단", reservoir: "방류 15:05", tide: "16:05 · 첨두와 겹침", markers: [{ at: t("16:05"), label: "만조" }],
}, DECISIONS[0], "만조 15:24 → 16:05 · 첨두와 겹침 (만조 전 판단 시점 셋에 같은 판)", "만조 16:05 · 합류부 첨두와 겹침 (실제 15:24)", "만조가 합류부 첨두(16:05)와 겹친 경우");
export const CW_RAIN120_1435 = RAIN_1435.f;
export const CW_RAIN120_1450 = RAIN_1450.f;
export const CW_RAIN120_1522 = RAIN_1522.f;
export const CW_RAIN150_1435 = RAIN50_1435.f;
export const CW_RAIN150_1450 = RAIN50_1450.f;
export const CW_RAIN150_1522 = RAIN50_1522.f;
export const CW_TIDE_PEAK = TIDE.f;

/* ── 상황과 대응을 함께 — 그 상황에서 이 대응으로 버티나(2026-09-16 사용자 "같이 선택할 수 있어야") ──────────────
 * 상황 판(분석 기준마다 하나) 위에 대응 선택지를 얹은 사전 계산 판이다. 편집 규칙 둘:
 *   방류(현상 대응)  상황 판 수위 + (방류 판 − 기준 재현)의 차이. 도달·물고임·잠긴 건물은 그 수위에서 다시 읽는다
 *                    (2.5 m · 1.9 m 넘는 시각 · 아래 수위-건물 표 — 표는 손으로 쓴 판들의 값에 맞췄다)
 *   천변도로 통제    상황 판 그대로에 통제 시각만 바꿔 같은 노출 규칙 — 비가 더 오면 물고임이 당겨져 같은 통제도 늦는다
 * 분석 기준보다 이른 선택지는 화면이 먼저 닫으므로 그 조합은 만들지 않는다. 실개발은 조합마다 같은 조건의 ModelRun 으로 교체한다.
 * ─────────────────────────────────────────────────────────────────── */
const ms = (iso: string) => new Date(iso).getTime();
/** 밀리초 → 이 사건 날짜의 한국 시각 문자열(t 와 같은 모양 — 눈금 비교가 문자열이라 모양이 같아야 한다) */
const kst = (m: number): string => {
  const d = new Date(Math.round(m / 60_000) * 60_000 + 9 * 3600_000);
  return t(`${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`);
};
/** 합류부 수위가 기준을 넘는 시각 — 분석 앞 14:35(1.3 m)부터 눈금 사이를 직선으로 끼워 분 단위로 */
const crossAt = (conf: number[], level: number): string | null => {
  const pts: [number, number][] = [[ms(t("14:35")), 1.3], ...AT.map((a, i) => [ms(a), conf[i]] as [number, number])];
  for (let i = 1; i < pts.length; i += 1) {
    const [t0, v0] = pts[i - 1], [t1, v1] = pts[i];
    if (v0 < level && v1 >= level) return kst(t0 + ((level - v0) / (v1 - v0)) * (t1 - t0));
  }
  return null;
};
/* 합류부 수위 → 잠긴 저지대 건물. 물이 빠질 때는 같은 수위에서도 더 많이 남는다(오를 때 · 빠질 때 표를 따로) */
const RISE: [number, number][] = [[2.9, 0], [3.0, 2], [3.1, 5], [3.2, 6], [3.3, 8], [3.4, 10], [3.5, 12], [3.6, 14], [3.7, 16]];
const FALL: [number, number][] = [[2.5, 0], [2.6, 1], [2.7, 2], [2.8, 3], [2.9, 4], [3.0, 6], [3.1, 7], [3.2, 8], [3.3, 9], [3.4, 10]];
const lookup = (tbl: [number, number][], v: number): number => {
  if (v <= tbl[0][0]) return tbl[0][1];
  const hit = [...tbl].reverse().find(([lv]) => v >= lv - 1e-9);
  return hit ? hit[1] : tbl[tbl.length - 1][1];
};
const buildingsOf = (conf: number[]): Buildings => {
  const peak = conf.indexOf(Math.max(...conf));
  const atPeak = lookup(RISE, conf[peak]);
  return conf.map((v, i) => (i <= peak ? lookup(RISE, v) : Math.min(lookup(FALL, v), atPeak))) as Buildings;
};
const withDischarge = (sit: CwBoard, dis: CwBoard): CwBoard => {
  const rows = sit.rows.map((r, i) => r.map((v, k) => Number((v + dis.rows[i][k] - ACTUAL_ROWS[i][k]).toFixed(1)))) as Rows;
  const conf = rows.map((r) => r[3]);
  /* 기준을 안 넘으면 도달이 없다 — 원래 조건의 도달로 되돌리면 "안 넘었는데 도달이 있다"가 된다(2026-09-16 수정).
     VALID_UNTIL 은 자리값이고 targets 의 reach() 가 시각으로 적지 않는다 */
  const arrival = crossAt(conf, 2.5) ?? VALID_UNTIL;
  return {
    rows, buildings: buildingsOf(conf),
    /* 간선도로는 천변도로보다 8분 뒤에 잠긴다(기준 재현 15:22 → 15:30 과 같은 간격) */
    arrival, trunkAt: kst(ms(arrival) + 8 * 60_000),
    onset: crossAt(conf, 1.9) ?? sit.onset, trunk: Math.max(...conf) >= 3.4 ? "중단" : "부분 중단",
    reservoir: dis.reservoir, rain: sit.rain, tide: sit.tide, markers: sit.markers,
  };
};
const COMBO_FORECASTS: Forecast[] = [];
const COMBOS: WhatIfCombo[] = [];
for (const sit of [RAIN_1435, RAIN_1450, RAIN50_1435, RAIN50_1450, TIDE]) {
  for (const d of DISCHARGES) {
    if (ms(d.at) < ms(sit.from)) continue;
    const f = boardOf(withDischarge(sit.b, d.b), {
      id: `${sit.f.forecastId}-${d.key}`, alternativeId: "discharge", controlAt: ACTUAL_CONTROL,
      changed: [...sit.f.changedConditions, `상류 저류지 방류 · ${d.at.slice(11, 16)} (실제보다 ${d.early})`],
      hypothesis: `${sit.f.hypothesis}에 방류를 ${d.early}(${d.at.slice(11, 16)}) 했다면`,
      basis: basis([sit.change, `방류 ${d.at.slice(11, 16)} 가정 · 천변도로 통제는 실제(15:22) 그대로`, "조합 판 = 상황 판 + (방류 판 − 기준 재현)"], "대안 계산 (재현과 같은 방식 · 상황과 대응 변경)"),
      actionAt: { label: "방류 시점", at: d.at },
    });
    COMBO_FORECASTS.push(f);
    COMBOS.push({ situationForecastId: sit.f.forecastId, responseId: "discharge", presetId: d.presetId, forecastId: f.forecastId });
  }
  for (const r of ROADS) {
    if (ms(r.at) < ms(sit.from)) continue;
    const f = roadOn(sit.b, r, `${sit.f.forecastId}-${r.key}`, [sit.change, "범람면은 상황 판과 동일"]);
    COMBO_FORECASTS.push(f);
    COMBOS.push({ situationForecastId: sit.f.forecastId, responseId: "road-control", presetId: r.presetId, forecastId: f.forecastId });
  }
}

/* ── 훈련 조합 판 (03 §26.10 · 2026-09-16) ────────────────────────────────
 * 훈련은 방류와 통제를 **함께** 고를 수 있어야 하는데 그 판이 없었다.
 * 새 수치를 손으로 적지 않는다 — `roadOn` 이 임의의 판 위에 통제 시각만 얹는 규칙 함수라
 * (범람면·수위는 아래 판이 정하고 통제는 대상 상태만 바꾼다) 방류 판 위에 통제를 얹으면 된다.
 * 근거 카드에 "규칙 계산"이라고 그대로 적는다.
 *
 * 훈련에서 고를 수 있는 조합만 만든다(정지점 14:35 · 14:55):
 *   조건 3(당시 · 강우 +20% · +50%) × 방류 3(14:35 · 14:55 · 안 함) × 통제 3(14:35 · 14:52 · 안 함)
 * "안 함"은 판을 만들지 않는다 — 실제와 같은 시각에 한 것으로 보므로 아래 판이 그대로 기준이 된다.
 * ───────────────────────────────────────────────────────────────── */
const TRAIN_STOPS = ["14:35", "14:55"] as const;
/** 훈련에서 고를 수 있는 방류 — 정지점과 겹치는 선택지만 */
const TRAIN_DIS = DISCHARGES.filter((d) => TRAIN_STOPS.some((t) => d.at.slice(11, 16) === t));
/** 훈련에서 고를 수 있는 통제 — **정지점 시각 그대로**. 조합 판과 정지점이 어긋나면 그 시각에 고를 수가 없다(2026-09-16 수정) */
const TRAIN_ROAD = TRAIN_STOPS.map((hhmm) => ({
  at: t(hhmm), early: "훈련", key: `TR-ROAD-${hhmm.replace(":", "")}`, presetId: `tr-road-${hhmm.replace(":", "")}`,
}));
/** 방류를 안 한 판 = 그 조건의 상황 판(실제 방류 15:05 그대로) */
const TRAIN_BASE: { id: string; b: CwBoard; label: string }[] = [
  { id: "now", b: ACTUAL_B, label: "당시 강우" },
  { id: "rain-plus20", b: RAIN_1435.b, label: "강우 +20%" },
  { id: "rain-plus50", b: RAIN50_1435.b, label: "강우 +50%" },
];
const CW_TRAINING_COMBOS: { conditionStepId: string; acts: Record<string, string>; forecastId: string }[] = [];
const TRAIN_FORECASTS: Forecast[] = [];
for (const cond of TRAIN_BASE) {
  /* 방류를 바꾼 판 넷: 안 함(= 조건 판 그대로) + 정지점 둘 */
  const withDis: { at: string | null; b: CwBoard; id: string }[] = [
    { at: null, b: cond.b, id: `${cond.id}-DIS-NONE` },
    ...TRAIN_DIS.map((d) => ({ at: d.at, b: withDischarge(cond.b, d.b), id: `${cond.id}-DIS-${d.at.slice(11, 16).replace(":", "")}` })),
  ];
  for (const dis of withDis) {
    for (const road of [null, ...TRAIN_ROAD]) {
      const roadAt = road ? road.at : null;
      const id = `FC-CW-TR-${dis.id}${roadAt ? `-ROAD-${roadAt.slice(11, 16).replace(":", "")}` : ""}`;
      const lines = [cond.label === "당시 강우" ? "관측 강우 그대로" : `${cond.label} 적용`,
        dis.at ? `방류 ${dis.at.slice(11, 16)} 가정` : "방류는 실제(15:05) 그대로",
        roadAt ? `천변도로 통제 ${roadAt.slice(11, 16)} 가정` : "천변도로 통제는 실제(15:22) 그대로"];
      const f = road
        ? roadOn(dis.b, road, id, lines)
        : boardOf(dis.b, {
            id, alternativeId: "discharge", controlAt: ACTUAL_CONTROL,
            changed: lines, hypothesis: `훈련 · ${lines.join(" · ")}`,
            basis: basis(lines, "규칙 계산 (조건 판에 조치 시각만 변경)"),
            ...(dis.at ? { actionAt: { label: "방류 시점", at: dis.at } } : {}),
          });
      TRAIN_FORECASTS.push(f);
      CW_TRAINING_COMBOS.push({
        conditionStepId: cond.id,
        /* 고른 조치만 담는다 — 없는 것은 실제와 같은 시각에 한 것이다 */
        acts: { ...(dis.at ? { S2: dis.at } : {}), ...(roadAt ? { S3: roadAt } : {}) },
        forecastId: id,
      });
    }
  }
}

export const CHANGWONCHEON_FORECASTS: Forecast[] = [...TRAIN_FORECASTS, CW_ACTUAL, CW_DISCHARGE_FIRED, CW_DISCHARGE_10, CW_DISCHARGE_20, CW_ROAD_FIRED, CW_ROAD_10, CW_ROAD_30, CW_RAIN120_1435, CW_RAIN120_1450, CW_RAIN120_1522, CW_RAIN150_1435, CW_RAIN150_1450, CW_RAIN150_1522, CW_TIDE_PEAK, ...COMBO_FORECASTS];

const SITUATIONS: WhatIfSituation[] = [
  {
    situationId: "rain-plus20", label: "강우 상향", group: "강우 상향", step: "+20%", detail: "당시 강우 +20% · 35 → 42 mm/h",
    byBasis: [RAIN_1435, RAIN_1450, RAIN_1522].map((x, i) => ({ at: DECISIONS[i], forecastId: x.f.forecastId })),
    method: "사전 계산 · 기준 재현과 같은 방식에 강우 입력만 변경",
  },
  {
    situationId: "rain-plus50", label: "강우 상향", group: "강우 상향", step: "+50%", detail: "당시 강우 +50% · 35 → 53 mm/h",
    byBasis: [RAIN50_1435, RAIN50_1450, RAIN50_1522].map((x, i) => ({ at: DECISIONS[i], forecastId: x.f.forecastId })),
    method: "사전 계산 · 기준 재현과 같은 방식에 강우 입력만 변경",
  },
  {
    situationId: "tide-peak", label: "만조 중첩", detail: "만조 15:24 → 16:05 · 합류부 첨두와 중첩",
    byBasis: DECISIONS.map((at) => ({ at, forecastId: TIDE.f.forecastId })),
    method: "사전 계산 · 기준 재현과 같은 방식에 조위 입력만 변경",
  },
];

const RESPONSES: WhatIfResponse[] = [
  {
    responseId: "discharge", kind: "현상", target: "상류 저류지", level: "사전 방류로 저류 여유 확보", adjust: "when",
    effect: "이 판단이 합류부 수위와 도달 시각을 바꿉니다",
    anchor: { label: "실제 방류", at: t("15:05") },
    /* 선택지는 알린 직후 · 문턱 · 실제 셋이다(README §2.3 규칙 3). 임의 눈금("10분 일찍")은 쓰지 않는다.
       문턱 14:55 = 합류부 저지대 범람(L32)을 막는 가장 늦은 방류 시각. 20분 일찍 판은 조합용으로 남는다 */
    presets: [
      { id: "fired", label: "알린 직후", at: t("14:35"), forecastId: CW_DISCHARGE_FIRED.forecastId },
      { id: "early10", label: "문턱", at: t("14:55"), forecastId: CW_DISCHARGE_10.forecastId },
      { id: "actual", label: "실제", at: t("15:05"), forecastId: null },
    ],
    method: "사전 계산 · 기준 재현과 같은 방식에 방류 시각만 변경. 문턱은 저지대 범람을 막는 가장 늦은 시각(14:55)",
  },
  {
    responseId: "road-control", kind: "노출", target: "하구 천변도로", level: "양방향 통제", adjust: "when",
    effect: "물이 오는 시각은 그대로이고, 도달까지의 여유가 달라집니다",
    anchor: { label: "실제 통제", at: ACTUAL_CONTROL },
    presets: [
      { id: "fired", label: "알린 직후", at: t("14:35"), forecastId: CW_ROAD_FIRED.forecastId },
      { id: "early10", label: "도달 10분 전", at: t("15:12"), forecastId: CW_ROAD_10.forecastId },
      { id: "actual", label: "실제", at: ACTUAL_CONTROL, forecastId: null },
    ],
    method: "사전 계산 · 통제 시각별 판. 결과는 통제 완료와 통행 지장 도달 사이의 여유로 읽는다",
  },
];

export const CHANGWONCHEON_WHATIF: WhatIfCase = {
  incidentId: CW_INCIDENT_ID,
  title: "창원천 하류 범람",
  hazardKind: "하천범람",
  twinFamily: "B",
  scope: { kind: "구역", displayAnchor: [128.636, 35.228], affectedGeometryId: "GEO-CW-SCOPE", label: "창원천 상류 → 하구 구간" },
  legacyDistrictId: "changwoncheon",
  occurredAt: t("14:20"),
  closedAt: t("17:40"),
  record: [
    { at: t("14:20"), label: "상류 강우 급증 · 28 mm/h", kind: "관측" },
    { at: t("14:35"), label: "범람 예측 발생 · 합류부 15:22 기준 초과", kind: "예측", decision: true },
    { at: t("14:50"), label: "위험도 상향 · 둔치 산책로 출입 통제", kind: "대응", decision: true },
    { at: t("15:00"), label: "하구 천변도로 물고임", kind: "영향" },
    { at: t("15:05"), label: "상류 저류지 방류", kind: "대응" },
    { at: t("15:22"), label: "합류부 기준 수위 초과 · 하구 천변도로 통제", kind: "대응", decision: true },
    { at: t("15:24"), label: "만조 · 마산만", kind: "관측" },
    { at: t("16:05"), label: "합류부 최고 수위 3.3 m (실측)", kind: "영향" },
    { at: t("17:40"), label: "수위 하강 · 사건 종료", kind: "관측" },
  ],
  reconstructionForecastId: CW_ACTUAL.forecastId,
  stateByTime: [
    { at: t("14:35"), rows: [{ label: "상류 강우계", value: "28 mm/h" }, { label: "상류 수위", value: "12.4 m" }, { label: "합류부 수위", value: "1.3 m" }, { label: "상류 저류지", value: "현행 운영" }] },
    { at: t("14:50"), rows: [{ label: "상류 강우계", value: "33 mm/h" }, { label: "상류 수위", value: "12.8 m" }, { label: "합류부 수위", value: "1.6 m" }, { label: "상류 저류지", value: "현행 운영" }] },
    { at: t("15:22"), rows: [{ label: "상류 강우계", value: "35 mm/h" }, { label: "상류 수위", value: "13.1 m" }, { label: "합류부 수위", value: "2.5 m" }, { label: "상류 저류지", value: "방류 중 (15:05)" }] },
    { at: t("16:05"), rows: [{ label: "상류 강우계", value: "22 mm/h" }, { label: "상류 수위", value: "12.3 m" }, { label: "합류부 수위", value: "3.3 m" }, { label: "상류 저류지", value: "방류 중" }] },
  ],
  observed: [
    { label: "합류부 최고 수위 (실측)", value: "3.3 m · 16:05" },
    { label: "최대 범람 범위 (침수흔적 조사)", value: "34 ha" },
    { label: "건물 침수 (현장 조사)", value: "7동" },
  ],
  /* 규정 — 센서 임계가 띄운 조치 셋(README §6.1 창원천 확정안).
     14:35 범람 예측이 "합류부 15:22 기준 초과"를 알리면서 셋이 함께 떴다. 조치까지 15분 · 30분 · 47분 걸렸다.
     주민 전파는 넣지 않는다 — 결과를 확인할 경로가 없다(README §2.3 규칙 6) */
  sop: [
    { id: "S1", label: "둔치 산책로 출입통제", trigger: "상류 수위 상승 · 둔치 잠김 예상", firedAt: t("14:35"), actedAt: t("14:50") },
    { id: "S2", label: "상류 저류지 방류", trigger: "합류부 기준 수위 2.5 m 초과 예측", firedAt: t("14:35"), actedAt: t("15:05"), responseId: "discharge" },
    { id: "S3", label: "하구 천변도로 통제", trigger: "합류부 기준 수위 2.5 m 도달 예측", firedAt: t("14:35"), actedAt: t("15:22"), responseId: "road-control" },
  ],
  /* 훈련 준비물 (03 §26.2·§26.4 · 2026-09-16 v2).
     정지점은 새로 결정할 일이 생기는 시각이다. 조치 가능 시각은 여기 적지 않는다 —
     대응의 presets 가 정본이고 정지점과 겹치는 것만 화면에 뜬다. */
  training: {
    incidentId: CW_INCIDENT_ID,
    stops: [
      { at: t("14:35"), phase: "판단", note: "범람 예측 발생 · 합류부 기준 수위 2.5 m 초과 예측" },
      { at: t("14:55"), phase: "판단", note: "방류가 효과를 낼 수 있는 마지막 시각" },
      { at: t("15:30"), phase: "결과", note: "조치 창이 닫히고 물이 온다" },
      { at: t("16:00"), phase: "결과", note: "합류부 최고 수위" },
    ],
    conditions: [
      {
        id: "rain", label: "강우", stateLabel: "상류 강우계",
        steps: [
          { id: "now", label: "당시", detail: "최대 35 mm/h", situationId: null, factor: 1 },
          { id: "rain-plus20", label: "+20%", detail: "최대 35 → 42 mm/h", situationId: "rain-plus20", factor: 1.2 },
          { id: "rain-plus50", label: "+50%", detail: "최대 35 → 53 mm/h", situationId: "rain-plus50", factor: 1.5 },
        ],
      },
    ],
    firedSopIds: ["S2", "S3", "S1"],
    /* S1(둔치 통제)은 결과판이 없다 — 조치 시각은 기록하되 결과를 가르지 않는다 */
    resultSopIds: ["S2", "S3"],
    combos: CW_TRAINING_COMBOS,
  },
  responses: RESPONSES,
  situations: SITUATIONS,
  /* 상황 부여 — 판이 없는 조건이다. 수치를 만들지 않고 시간표에 전개로만 선다(README §2.3 기준 ③ · 03 §26.6).
     하구 배수펌프장은 이 사건의 계산 입력이 아니다. 정전이 나면 무엇을 할지가 훈련의 질문이다 */
  injects: [
    { id: "cw-pump-out", at: t("15:40"), label: "하구 배수펌프장 정전", detail: "배수 중단 · 하구 구간 수위 하강 지연" },
  ],
  combos: COMBOS,
};
