/* ─────────────────────────────────────────────
 * F 지반·구조 영향 — 교방동 급경사지 변위 · 종료 사건의 대응 What-if (03 §11 · §22 F · §26)
 *
 * 급경사지의 질문은 "어느 사면이 얼마나 움직이고 무엇을 막아야 하는가"다. 장마 강우가 누적되며 함수율이 오르고
 * 옹벽 배수로가 막혀 물이 사면에 고이자 변위가 가속했다. 경계 기준(10 mm)을 넘은 새벽에 하부 도로로 낙석이 떨어졌다.
 *
 * 종료 사건이라 기준은 **실제로 한 대응**이다 — 2일째 01:30 배수로 긴급 정비 착수 · 04:40 하부 도로 출입통제·주택 대피 권고.
 * 정비가 늦어 변위 가속을 못 막았고, 통제는 경계 기준을 넘은(04:10) 뒤였다.
 *   도로 통제   노출 감소 · 시점 — 변위는 그대로이고 낙석 구간을 지난 차가 준다(1시간 · 2시간 일찍)
 *   대피 범위   노출 감소 · 범위 — 변위는 그대로이고 대피 범위 밖에 남은 위험 주민이 준다. 대신 대피 인원이 는다
 * 배수로 정비·보강으로 몇 시간 안에 변위를 줄였다는 대안은 두지 않는다 — 사면 보강 효과는 한 사건의 시간 안에 드러나지 않는다(2026-09-16 검토).
 *   강우 악화   상황 — 누적 강우가 30% 더 왔다면 같은 통제·대피로 버텼나. 분석 기준(판단 시점)마다 사전 계산한 판이 있다
 *
 * 위험지도(원래 위험한 곳)와 변위 벡터(지금 움직이는 것)는 다른 정보다(03 §22 F). 폴리곤·변위·시각·인원은 시나리오 편집값이고
 * 붕괴 평가 모델 결과가 아니다.
 * ───────────────────────────────────────────── */

import type { Forecast, ForecastBasis, ForecastInput, ForecastMark, ImpactTarget, MarkImpact, MarkMetric } from "../../model/forecast";
import type { LngLat, SceneLayer, ScenePoint } from "../../model/scene";
import type { WhatIfCase, WhatIfCombo, WhatIfResponse, WhatIfSituation } from "../../model/whatif";

export const GB_INCIDENT_ID = "INC-2024-0710-GB01";
const t = (hhmm: string, day = "10") => `2024-07-${day}T${hhmm}:00+09:00`;
/** 재현·대안 판의 기준시각 — 관측 입력이 끝난 사건 종료 시각. 판은 모두 사건이 끝난 뒤 계산했다 */
const BASE = t("20:00", "11");
const AT = [t("19:00"), t("23:00"), t("05:00", "11"), t("17:00", "11")] as const;
const VALID_UNTIL = t("21:00", "11");

/* 급경사지 — 사면 하부 도로·주택 위 옹벽 구간 (마산합포구 교방동, 무학산 동사면 자락) */
export const GYOBANG_GEOMETRIES: Record<string, [number, number][]> = {
  "GEO-F-SCOPE": [[128.5605, 35.2175], [128.5685, 35.218], [128.569, 35.212], [128.561, 35.2115]],
  "GEO-F-SLOPE-1": [[128.5635, 35.216], [128.566, 35.2163], [128.5662, 35.2145], [128.5637, 35.2143]],
  "GEO-F-SLOPE-2": [[128.563, 35.2163], [128.567, 35.2167], [128.5673, 35.2137], [128.5633, 35.2133]],
  "GEO-F-SLOPE-3": [[128.5623, 35.2167], [128.5677, 35.2173], [128.5681, 35.2129], [128.5627, 35.2125]],
  "GEO-F-SLOPE-2C": [[128.563, 35.2163], [128.567, 35.2167], [128.5673, 35.2141], [128.5633, 35.2137]],
};

/* ── 장면 층 (03 §22 F) ── */
const RISKMAP: LngLat[] = [[128.5618, 35.2172], [128.5678, 35.2176], [128.5682, 35.2138], [128.5622, 35.2132]];
const SLOPE_DIR = 155; /* 사면 아래 방향(남남동) */
const VEC_AT: LngLat[] = [[128.564, 35.2158], [128.5652, 35.216], [128.5664, 35.2157]];
const WALL_AT: LngLat = [128.5652, 35.2148];
const ROAD_AT: LngLat = [128.5648, 35.2141];
const HOMES_AT: LngLat = [128.5662, 35.2136];
const CONTROL_LINE: LngLat[] = [[128.5628, 35.2152], [128.5686, 35.2156]];
const F_STATIC: SceneLayer[] = [
  { kind: "area", id: "f-riskmap", role: "위험지도", ring: RISKMAP, label: "산사태 위험지도 1등급" },
  { kind: "point", id: "f-sensor", at: [128.5646, 35.2163], icon: "mdi:axis-arrow", label: "변위계", state: "10분 주기", tone: "primary", small: true },
];
type Tone = "success" | "warning" | "danger" | "neutral" | "primary";
const toneOf = (st: string): Tone => (st === "사용 가능" || st === "통제됨" || st === "대피 완료" ? "success" : st === "점검 필요" ? "warning" : st === "위험" || st === "대피 중" ? "danger" : st === "정비 중" ? "primary" : "neutral");
const vectors = (mm: number): SceneLayer[] => VEC_AT.map((at, i) => ({ kind: "vector" as const, id: `f-vec-${i}`, role: "변위" as const, at, bearing: SLOPE_DIR, magnitude: mm, unit: "mm", ...(i === 1 ? { label: `${mm.toFixed(1)} mm` } : {}) }));
const states = (wall: string, road: string, homes: string): ScenePoint[] => [
  { kind: "point", id: "f-wall", at: WALL_AT, icon: "mdi:wall", label: "옹벽·배수로", state: wall, tone: toneOf(wall) },
  { kind: "point", id: "f-road", at: ROAD_AT, icon: "mdi:road-variant", label: "사면 하부 도로", state: road, tone: toneOf(road) },
  { kind: "point", id: "f-homes", at: HOMES_AT, icon: "mdi:home-group", label: "하부 주택 8동", state: homes, tone: toneOf(homes) },
];
const sceneAt = (mm: number, wall: string, road: string, homes: string, control: "planned" | "on" | null): SceneLayer[] => [
  ...vectors(mm),
  ...states(wall, road, homes),
  ...(control ? [{ kind: "line" as const, id: "f-control", role: "통제 경계" as const, coords: CONTROL_LINE, state: control, label: control === "on" ? "출입통제 경계" : "통제 예정" }] : []),
];

/* 재현 입력 — 사건 동안의 관측·운영 기록. 예보는 쓰지 않는다(이미 일어난 일이다) */
const INPUTS: ForecastInput[] = [
  { label: "변위계 (옹벽 상부)", at: t("20:00", "11"), kind: "관측" },
  { label: "강우 관측 (교방동)", at: t("20:00", "11"), kind: "관측" },
  { label: "옹벽·배수로 점검·정비 기록", at: t("20:00", "11"), kind: "시설" },
];
/** 재현은 관측이 입력이라 불확실성이 보통, 대안은 일어나지 않은 진행이라 높다. 둘 다 사건이 끝난 뒤(2일째 20:30) 계산했다 */
const basis = (assumptions: string[], modelName = "규칙 계산 (같은 기록에 통제 시각·대피 범위만 변경)", grade: ForecastBasis["uncertainty"]["grade"] = "높음"): ForecastBasis => ({
  modelName, modelVersion: "0.1", baseTime: BASE, generatedAt: t("20:30", "11"),
  observedFrom: t("06:00"), inputs: INPUTS, inputEventIds: [], assumptions,
  uncertainty: { grade, sensitiveTo: ["강우 지속 시간", "변위계 기준선·결측"], unusableRanges: ["2일째 21:00 이후"] },
  inputQuality: "보정", calculationActor: "해당 없음",
  replacementNote: "급경사지 계측 연계·붕괴 평가 모델 확보 시 같은 계약으로 교체",
});

type Four<T> = [T, T, T, T];
const mm = (v: number): MarkMetric => ({ label: "누적 변위", value: v, unit: "mm", digits: 1 });
type Row = [wall: string, road: string, homes: string];
const impactTone = (st: string): MarkImpact["tone"] => { const t = toneOf(st); return t === "success" ? "safe" : t === "danger" ? "danger" : t === "warning" || t === "primary" ? "warning" : "muted"; };
const marksOf = (d: Four<number>, g: Four<string>, n: Four<string>, rows: Four<Row>, controlAt: string): ForecastMark[] =>
  AT.map((validAt, i) => ({
    validAt, maxDepthM: 0, metric: mm(d[i]), extentGeometryId: g[i], impactSummary: n[i],
    scene: sceneAt(d[i], rows[i][0], rows[i][1], rows[i][2], validAt >= controlAt ? "on" : i > 0 ? "planned" : null),
    /* 그 시각의 핵심 영향 — 하부 도로와 하부 주택의 상태 */
    impacts: [
      { label: "사면 하부 도로", value: rows[i][1], tone: impactTone(rows[i][1]) },
      { label: "하부 주택 8동", value: rows[i][2], tone: impactTone(rows[i][2]) },
    ],
  }));

/** 경계 기준 초과·낙석 시작 */
const ONSET = t("04:10", "11");
/** 변위 재현이 정한 붕괴 위험 주택 — 강우 악화(상황 조건)에서만 달라진다 */
const RISK_HOMES = 12;

/* 영향 대상 — 하부 도로가 첫째다(도달 = 경계 초과·낙석 시작).
   수는 적지 않는다. 대상과 상태만 둔다 — 대피 범위를 넓힌 만큼 비례로 주는 인원은 산수라 결과로 쓰지 않는다(README §2.3 기준 ③ · 2026-09-16).
   대피 범위 대응의 결과는 "대피 범위 밖에 위험 주택이 남는가"다 */
const targets = (controlAt: string, evacHomes: number, onset = ONSET, riskHomes: number = RISK_HOMES): ImpactTarget[] => {
  const passed = controlAt > onset;
  return [
    { kind: "도로", id: "RD-GB-BELOW", label: "사면 하부 도로", arrivalAt: onset, exposure: "통제됨" },
    { kind: "중요시설", id: "FAC-GB-WALL", label: "옹벽·배수로", exposure: "부분 중단" },
    { kind: "건물", id: "BLD-GB-RISK", label: "붕괴 위험 주택", exposure: "노출" },
    { kind: "대상자", id: "VEH-GB-BELOW", label: "낙석 구간 통과 차량", exposure: passed ? "노출" : "통제됨" },
    { kind: "대상자", id: "POP-GB-OUTSIDE", label: "대피 범위 밖 위험 주택", exposure: evacHomes < riskHomes ? "노출" : "영향 없음" },
  ];
};
const hhmm = (at: string) => `${at.slice(8, 10) === "11" ? "2일째 " : ""}${at.slice(11, 16)}`;
const conditions = (controlAt: string, range: string, rain = "176 mm · 장마전선 정체"): Forecast["conditions"] => [
  { label: "누적 강우", value: rain, tone: "warning" },
  { label: "변위 기준", value: "주의 5 · 경계 10 · 심각 15 mm" },
  { label: "출입통제", value: `${hhmm(controlAt)} · 하부 도로` },
  { label: "대피 범위", value: range },
];
const common = { incidentId: GB_INCIDENT_ID, availability: "가용" as const, validUntil: VALID_UNTIL, scene: F_STATIC };

/* 실제 대응 — 배수로 정비 2일째 01:30(재현에 들어 있다) · 출입통제·대피 권고 04:40 · 대피 범위 하부 주택 8동 */
const ACTUAL_CONTROL = t("04:40", "11");
const ACTUAL_RANGE = 8;

/* ── 기준 재현 — 04:10 경계 초과 · 낙석. 17:00 심각 기준 초과로 붕괴 위험 구간이 주택 12동까지 넓어졌다 ── */
const ACTUAL_D: Four<number> = [4.1, 7.8, 11.2, 15.8];
const ACTUAL_G: Four<string> = ["GEO-F-SLOPE-1", "GEO-F-SLOPE-2", "GEO-F-SLOPE-2", "GEO-F-SLOPE-3"];
const ACTUAL_N: Four<string> = ["강우 누적 80 mm · 변위 4.1 mm · 주의 기준(5 mm) 이하", "함수율 상승 · 변위 가속 · 옹벽 배수로 월류", "경계 기준(10 mm) 초과 · 하부 도로 낙석", "심각 기준(15 mm) 초과 · 붕괴 위험 구간 주택 12동"];
const ACTUAL_ROWS: Four<Row> = [["사용 가능", "사용 가능", "사용 가능"], ["점검 필요", "사용 가능", "사용 가능"], ["정비 중", "통제됨", "대피 중"], ["위험", "통제됨", "대피 완료"]];
export const GB_ACTUAL: Forecast = {
  ...common, forecastId: "FC-GB-ACTUAL", alternativeId: "baseline", changedConditions: [],
  marks: marksOf(ACTUAL_D, ACTUAL_G, ACTUAL_N, ACTUAL_ROWS, ACTUAL_CONTROL),
  arrivalAt: ONSET,
  targets: targets(ACTUAL_CONTROL, ACTUAL_RANGE),
  basis: basis(["관측 강우·변위계 값으로 다시 계산", "실제 대응: 배수로 정비 2일째 01:30 · 출입통제 04:40 · 대피 하부 8동"], "재현 계산 (관측 강우·변위계 입력)", "보통"),
  conditions: conditions(ACTUAL_CONTROL, "하부 주택 8동"),
};

/* ── 출입통제를 일찍 — 변위는 같고, 경계 초과(04:10) 전에 닫히면 통과 차량이 없다 ── */
const controlEarly = (id: string, at: string, early: string): Forecast => ({
  ...common, forecastId: id, alternativeId: "road-control",
  changedConditions: [`하부 도로 출입통제 · 주택 대피 권고 · ${hhmm(at)} (실제보다 ${early})`],
  hypothesis: `하부 도로를 실제보다 ${early}(${hhmm(at)}) 막은 경우`,
  marks: marksOf(ACTUAL_D, ACTUAL_G, ACTUAL_N, [ACTUAL_ROWS[0], ACTUAL_ROWS[1], ["정비 중", "통제됨", "대피 완료"], ACTUAL_ROWS[3]], at),
  arrivalAt: ONSET,
  targets: targets(at, ACTUAL_RANGE),
  basis: basis(["변위는 기준 재현과 동일", `출입통제 ${hhmm(at)} 가정`]),
  conditions: conditions(at, "하부 주택 8동"),
  actionAt: { label: "통제 시점", at },
});
export const GB_CONTROL_1H = controlEarly("FC-GB-CONTROL-1H", t("03:40", "11"), "1시간 일찍");
export const GB_CONTROL_2H = controlEarly("FC-GB-CONTROL-2H", t("02:40", "11"), "2시간 일찍");

/* ── 대피 범위를 넓히면 — 변위는 같고, 범위 밖에 남는 위험 주민이 준다. 대피 인원은 는다(트레이드오프를 그대로 보인다) ── */
const rangeWide = (id: string, homes: number, range: string): Forecast => ({
  ...common, forecastId: id, alternativeId: "evacuation-range",
  changedConditions: [`대피 권고 범위 · ${range} (실제 하부 주택 8동)`],
  hypothesis: `대피 권고 범위를 ${range}(으)로 넓힌 경우`,
  marks: marksOf(ACTUAL_D, ACTUAL_G, ACTUAL_N, ACTUAL_ROWS, ACTUAL_CONTROL),
  arrivalAt: ONSET,
  targets: targets(ACTUAL_CONTROL, homes),
  basis: basis(["변위는 기준 재현과 동일", `대피 범위 ${range} 가정 · 통제 시각은 실제(04:40) 그대로`]),
  conditions: conditions(ACTUAL_CONTROL, range),
});
export const GB_RANGE_12 = rangeWide("FC-GB-RANGE-12", 12, "위험지도 1등급 12동");
export const GB_RANGE_20 = rangeWide("FC-GB-RANGE-20", 20, "위험지도 1·2등급 20동");

/* ── 상황 조건 · 강우 악화 — 누적 강우가 30% 더 왔다면(176 → 229 mm). 대응은 실제(통제 04:40 · 대피 하부 8동) 그대로 ──
   분석 기준(▲) 이후 강우만 늘린다. 변위가 빨라져 경계 초과가 앞당겨지고 붕괴 위험 구간이 넓어진다.
   통과 차량·범위 밖 주민은 같은 노출 규칙이다(경계 초과 시각 · 붕괴 위험 주택 수만 재현에서 온다) */
const DECISIONS = [t("18:40"), t("23:00"), t("04:10", "11")] as const;
interface RainSpec { from: string; d: Four<number>; g: Four<string>; n: Four<string>; rows: Four<Row>; onset: string; riskHomes: number }
const rainBoard = (r: RainSpec, id: string, meta: { alternativeId: Forecast["alternativeId"]; controlAt: string; range: number; rows: Four<Row>; changed: string[]; hypothesis: string; lines: string[]; model: string; actionAt?: { label: string; at: string }; rangeText: string }): Forecast => ({
  ...common, forecastId: id, alternativeId: meta.alternativeId,
  changedConditions: meta.changed, hypothesis: meta.hypothesis,
  marks: marksOf(r.d, r.g, r.n, meta.rows, meta.controlAt),
  arrivalAt: r.onset,
  targets: targets(meta.controlAt, meta.range, r.onset, r.riskHomes),
  basis: basis([`누적 강우 176 → 229 mm (${hhmm(r.from)} 이후)`, ...meta.lines], meta.model),
  conditions: conditions(meta.controlAt, meta.rangeText, "229 mm · 강우 악화"),
  ...(meta.actionAt ? { actionAt: meta.actionAt } : {}),
});
const RAINS: RainSpec[] = [
  /* 18:40 부터 — 경계 초과가 02:50 으로 80분 이르고, 통제(04:40)까지 낙석 구간을 지난 차가 는다. 붕괴 위험 16동 */
  {
    from: DECISIONS[0], d: [4.6, 9.4, 13.8, 19.2], g: ["GEO-F-SLOPE-1", "GEO-F-SLOPE-2", "GEO-F-SLOPE-3", "GEO-F-SLOPE-3"],
    n: ["강우 누적 92 mm · 변위 4.6 mm · 주의 기준 접근", "함수율 포화 · 변위 9.4 mm · 옹벽 배수로 월류", "경계 기준 초과(02:50) · 하부 도로 낙석 · 통제 04:40", "심각 기준 초과 · 붕괴 위험 구간 주택 16동"],
    rows: [["사용 가능", "사용 가능", "사용 가능"], ["점검 필요", "점검 필요", "사용 가능"], ["위험", "통제됨", "대피 중"], ["위험", "통제됨", "대피 완료"]], onset: t("02:50", "11"), riskHomes: 16,
  },
  /* 23:00 부터 — 23:00 까지는 실제와 같다. 경계 초과 03:30 · 붕괴 위험 15동 */
  {
    from: DECISIONS[1], d: [4.1, 7.8, 12.6, 18.0], g: ["GEO-F-SLOPE-1", "GEO-F-SLOPE-2", "GEO-F-SLOPE-3", "GEO-F-SLOPE-3"],
    n: [ACTUAL_N[0], ACTUAL_N[1], "경계 기준 초과(03:30) · 하부 도로 낙석 · 통제 04:40", "심각 기준 초과 · 붕괴 위험 구간 주택 15동"],
    rows: [ACTUAL_ROWS[0], ACTUAL_ROWS[1], ["위험", "통제됨", "대피 중"], ["위험", "통제됨", "대피 완료"]], onset: t("03:30", "11"), riskHomes: 15,
  },
  /* 2일째 04:10 부터 — 이미 경계를 넘은 뒤라 낙석·통과 차량은 같고, 심각 기준 뒤 붕괴 위험 구간만 14동으로 넓어진다 */
  {
    from: DECISIONS[2], d: [4.1, 7.8, 11.2, 17.4], g: ["GEO-F-SLOPE-1", "GEO-F-SLOPE-2", "GEO-F-SLOPE-2", "GEO-F-SLOPE-3"],
    n: [ACTUAL_N[0], ACTUAL_N[1], ACTUAL_N[2], "심각 기준 초과 · 붕괴 위험 구간 주택 14동"], rows: ACTUAL_ROWS, onset: ONSET, riskHomes: 14,
  },
];
const rainId = (r: RainSpec) => `FC-GB-RAIN-${r.from.slice(8, 10)}${r.from.slice(11, 13)}${r.from.slice(14, 16)}`;
const RAIN_BOARDS = RAINS.map((r) => rainBoard(r, rainId(r), {
  alternativeId: "situation", controlAt: ACTUAL_CONTROL, range: ACTUAL_RANGE, rows: r.rows, rangeText: "하부 주택 8동",
  changed: [`누적 강우 +30% · ${hhmm(r.from)} 이후 (실제 176 mm)`], hypothesis: `${hhmm(r.from)} 이후 강우가 실제보다 30% 많았던 경우`,
  lines: ["실제 대응 그대로: 출입통제 04:40 · 대피 하부 8동"], model: "대안 계산 (재현과 같은 방식 · 상황 입력만 변경)",
}));
export const [GB_RAIN_1840, GB_RAIN_2300, GB_RAIN_0410] = RAIN_BOARDS;

/* ── 상황과 대응을 함께 — 비가 더 온 날 같은 통제·대피로 버티나 ──
   두 대응 모두 노출 규칙이라 조합도 규칙이다 — 강우 악화 판의 경계 초과 시각 · 붕괴 위험 주택 수에 통제 시각 · 대피 범위만 바꿔 적용한다.
   경계 초과가 당겨지면(02:50) 1시간 일찍 통제(03:40)도 늦고, 붕괴 위험이 16동으로 넓어지면 1등급 12동 대피로도 모자란다 */
const CONTROLS = [
  { at: t("03:40", "11"), early: "1시간 일찍", presetId: "early1h", key: "CONTROL-1H" },
  { at: t("02:40", "11"), early: "2시간 일찍", presetId: "early2h", key: "CONTROL-2H" },
] as const;
const RANGES = [
  { homes: 12, text: "위험지도 1등급 12동", presetId: "grade1", key: "RANGE-12" },
  { homes: 20, text: "위험지도 1·2등급 20동", presetId: "grade12", key: "RANGE-20" },
] as const;
const COMBO_FORECASTS: Forecast[] = [];
const COMBOS: WhatIfCombo[] = [];
RAINS.forEach((r, i) => {
  const sitId = RAIN_BOARDS[i].forecastId;
  for (const c of CONTROLS) {
    if (new Date(c.at) < new Date(r.from)) continue;
    const f = rainBoard(r, `${sitId}-${c.key}`, {
      alternativeId: "road-control", controlAt: c.at, range: ACTUAL_RANGE, rangeText: "하부 주택 8동",
      rows: [r.rows[0], r.rows[1], [r.rows[2][0], "통제됨", "대피 완료"], r.rows[3]],
      changed: [`누적 강우 +30% · ${hhmm(r.from)} 이후`, `하부 도로 출입통제 · ${hhmm(c.at)} (실제보다 ${c.early})`],
      hypothesis: `${hhmm(r.from)} 이후 강우가 30% 많은 날 하부 도로를 ${c.early}(${hhmm(c.at)}) 막았다면`,
      lines: [`출입통제 ${hhmm(c.at)} 가정`], model: "규칙 계산 (강우 악화 판에 통제 시각만 변경)", actionAt: { label: "통제 시점", at: c.at },
    });
    COMBO_FORECASTS.push(f);
    COMBOS.push({ situationForecastId: sitId, responseId: "road-control", presetId: c.presetId, forecastId: f.forecastId });
  }
  for (const g of RANGES) {
    const f = rainBoard(r, `${sitId}-${g.key}`, {
      alternativeId: "evacuation-range", controlAt: ACTUAL_CONTROL, range: g.homes, rangeText: g.text, rows: r.rows,
      changed: [`누적 강우 +30% · ${hhmm(r.from)} 이후`, `대피 권고 범위 · ${g.text} (실제 하부 주택 8동)`],
      hypothesis: `${hhmm(r.from)} 이후 강우가 30% 많은 날 대피 범위를 ${g.text}(으)로 넓혔다면`,
      lines: [`대피 범위 ${g.text} 가정 · 통제 시각은 실제(04:40) 그대로`], model: "규칙 계산 (강우 악화 판에 대피 범위만 변경)",
    });
    COMBO_FORECASTS.push(f);
    COMBOS.push({ situationForecastId: sitId, responseId: "evacuation-range", presetId: g.presetId, forecastId: f.forecastId });
  }
});

export const GYOBANG_FORECASTS: Forecast[] = [GB_ACTUAL, GB_CONTROL_1H, GB_CONTROL_2H, GB_RANGE_12, GB_RANGE_20, ...RAIN_BOARDS, ...COMBO_FORECASTS];

const SITUATIONS: WhatIfSituation[] = [
  {
    situationId: "rain-up", label: "강우 악화", detail: "누적 강우 +30% · 176 → 229 mm",
    byBasis: RAIN_BOARDS.map((f, i) => ({ at: DECISIONS[i], forecastId: f.forecastId })),
    method: "사전 계산 · 기준 재현과 같은 방식에 강우 입력만 변경",
  },
];

const RESPONSES: WhatIfResponse[] = [
  {
    responseId: "road-control", kind: "노출", target: "사면 하부 도로 · 하부 주택", level: "출입통제 · 대피 권고", adjust: "when",
    anchor: { label: "실제 출입통제", at: ACTUAL_CONTROL },
    presets: [
      { id: "actual", label: "실제", at: ACTUAL_CONTROL, forecastId: null },
      { id: "early1h", label: "1시간 일찍", at: t("03:40", "11"), forecastId: GB_CONTROL_1H.forecastId },
      { id: "early2h", label: "2시간 일찍", at: t("02:40", "11"), forecastId: GB_CONTROL_2H.forecastId },
    ],
    method: "사전 계산 · 같은 변위 재현에 통제 시각·대피 범위만 바꾼 판",
  },
  {
    responseId: "evacuation-range", kind: "노출", target: "대피 권고 범위", level: "대피 권고 · 출입통제와 함께", adjust: "where",
    anchor: { label: "실제 대피 범위 하부 주택 8동 · 산사태 위험지도 등급 기준", at: ACTUAL_CONTROL },
    presets: [
      { id: "actual", label: "실제", value: "하부 8동", at: ACTUAL_CONTROL, forecastId: null },
      { id: "grade1", label: "1등급", value: "12동", at: ACTUAL_CONTROL, forecastId: GB_RANGE_12.forecastId },
      { id: "grade12", label: "1·2등급", value: "20동", at: ACTUAL_CONTROL, forecastId: GB_RANGE_20.forecastId },
    ],
    method: "사전 계산 · 같은 변위 재현에 통제 시각·대피 범위만 바꾼 판",
  },
];

export const GYOBANG_WHATIF: WhatIfCase = {
  incidentId: GB_INCIDENT_ID,
  title: "교방동 급경사지 변위",
  hazardKind: "지반",
  twinFamily: "F",
  scope: { kind: "시설", displayAnchor: [128.565, 35.2148], affectedGeometryId: "GEO-F-SCOPE", label: "교방동 급경사지 옹벽 구간" },
  occurredAt: t("18:40"),
  closedAt: t("20:00", "11"),
  record: [
    { at: t("18:40"), label: "변위 주의 기준 접근 · 4.0 mm", kind: "관측", decision: true },
    { at: t("19:30"), label: "감시 강화 · 변위계 10분 주기", kind: "대응" },
    { at: t("23:00"), label: "옹벽 배수로 월류 신고", kind: "관측", decision: true },
    { at: t("01:30", "11"), label: "배수로 긴급 정비 착수", kind: "대응" },
    { at: t("04:10", "11"), label: "경계 기준(10 mm) 초과 · 하부 도로 낙석", kind: "영향", decision: true },
    { at: t("04:40", "11"), label: "하부 도로 출입통제 · 하부 8동 대피 권고", kind: "대응" },
    { at: t("05:30", "11"), label: "하부 주택 8동 대피 완료", kind: "대응" },
    { at: t("17:00", "11"), label: "심각 기준(15 mm) 초과 · 붕괴 위험 12동", kind: "영향" },
    { at: t("20:00", "11"), label: "강우 종료 · 사건 종료", kind: "관측" },
  ],
  reconstructionForecastId: GB_ACTUAL.forecastId,
  stateByTime: [
    { at: t("19:00"), rows: [{ label: "누적 강우", value: "80 mm" }, { label: "누적 변위", value: "4.1 mm" }, { label: "함수율", value: "상승 중" }, { label: "옹벽 배수로", value: "정상" }] },
    { at: t("23:00"), rows: [{ label: "누적 강우", value: "132 mm" }, { label: "누적 변위", value: "7.8 mm" }, { label: "함수율", value: "포화 근접" }, { label: "옹벽 배수로", value: "월류" }] },
    { at: t("04:40", "11"), rows: [{ label: "누적 강우", value: "176 mm" }, { label: "누적 변위", value: "11.0 mm" }, { label: "함수율", value: "포화" }, { label: "옹벽 배수로", value: "정비 중" }] },
    { at: t("17:00", "11"), rows: [{ label: "누적 강우", value: "210 mm" }, { label: "누적 변위", value: "15.8 mm" }, { label: "함수율", value: "포화" }, { label: "옹벽 배수로", value: "정비 중" }] },
  ],
  observed: [
    { label: "최대 누적 변위 (실측)", value: "16.4 mm" },
    { label: "옹벽 부분 붕괴 (현장 조사)", value: "2일째 18:20 · 주택 2동 파손" },
  ],
  responses: RESPONSES,
  situations: SITUATIONS,
  combos: COMBOS,
};
