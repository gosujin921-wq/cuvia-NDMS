/* ─────────────────────────────────────────────
 * C 해안 경계·월류 — 구항 방파제 월류 · 종료 사건의 대응 What-if (03 §8 · §22 C · §26 · 2026-09-16 사용자 "지난 사건으로 넣으면 되잖아")
 *
 * 해안월류의 질문은 "언제 어디서 바다가 경계를 넘는가"다. 조위 편차 +30 cm · 파고 2 m 이상에서 만조(18:24) 전후로
 * 물양장이 먼저 월파되고, 역류방지 수문이 늦게 닫히면 배수구로 바닷물이 거꾸로 들어 해안도로·저지대 상가까지 번진다.
 *
 * 종료 사건이라 기준은 **실제로 한 대응**이다 — 17:50 물양장 접근통제 · 18:05 역류방지 수문 폐쇄 · 18:15 해안도로 통제.
 * 월파는 17:45 에 시작했고 해안도로는 18:00 부터 잠겼다. 수문과 도로 통제가 둘 다 물보다 늦었다.
 *   수문·차수   대응 · 현상 감소 — 역류가 줄어 월류 깊이·범위와 상가 침수가 준다
 *   해안 통제   대응 · 노출 감소 — 물은 그대로이고 해안도로에 들어간 차와 사람이 준다
 *   해일 악화   상황 — 조위 편차가 +50 cm 였다면 같은 대응으로 버텼나. 분석 기준(판단 시점)마다 사전 계산한 판이 있다
 *
 * 공간 단위는 배수권역이 아니라 해안선·월류 구간이다. 폴리곤은 시나리오 편집값(지형 굽기 없음)이고,
 * 조위·파고·시각·대상 수는 모두 시나리오 편집값이다. 폭풍해일 전용 모델 성능을 주장하지 않는다.
 * ───────────────────────────────────────────── */

import type { Forecast, ForecastBasis, ForecastInput, ForecastMark, ImpactTarget, MarkImpact } from "../../model/forecast";
import type { LngLat, SceneLayer, ScenePoint } from "../../model/scene";
import type { WhatIfCase, WhatIfCombo, WhatIfResponse, WhatIfSituation } from "../../model/whatif";

export const GH_INCIDENT_ID = "INC-2024-0820-GH01";
const ms = (iso: string) => new Date(iso).getTime();
const t = (hhmm: string) => `2024-08-20T${hhmm}:00+09:00`;
/** 재현·대안 판의 기준시각 — 관측 입력이 끝난 사건 종료 시각. 판은 모두 사건이 끝난 뒤 계산했다 */
const BASE = t("20:10");
const VALID_UNTIL = t("19:30");
const AT = [t("17:50"), t("18:10"), t("18:30"), t("18:50")] as const;

/** 해안선·월류 구간 — 시나리오 편집 폴리곤 */
export const GUHANG_GEOMETRIES: Record<string, [number, number][]> = {
  "GEO-GH-COAST": [[128.5745, 35.2032], [128.5775, 35.2034], [128.5778, 35.2008], [128.5748, 35.2006]],
  "GEO-GH-OVER-1": [[128.5752, 35.2026], [128.5766, 35.2028], [128.5767, 35.2019], [128.5753, 35.2017]],
  "GEO-GH-OVER-2": [[128.5748, 35.2028], [128.5772, 35.2031], [128.5774, 35.2013], [128.575, 35.201]],
  "GEO-GH-OVER-3": [[128.5742, 35.2031], [128.5778, 35.2035], [128.5782, 35.2006], [128.5744, 35.2002]],
};

/* ── 장면 층 (03 §22 C) — 방호시설 선이 먼저 읽히고, 물은 월류 지점에서 육지로 든다 ── */
const BREAKWATER: LngLat[] = [[128.5742, 35.2036], [128.5758, 35.2038], [128.5772, 35.2036], [128.5781, 35.2028]];
const SEAWALL: LngLat[] = [[128.5745, 35.2032], [128.5762, 35.2032], [128.5776, 35.2030]];
const WHARF_AT: LngLat = [128.576, 35.2029];
const ROAD_AT: LngLat = [128.5768, 35.2024];
const BOATS_AT: LngLat = [128.5766, 35.2036];
const GATE_AT: LngLat = [128.5754, 35.2031];
const BLOCK_AT: LngLat = [128.5776, 35.2019];
const C_STATIC: SceneLayer[] = [
  { kind: "line", id: "c-breakwater", role: "방호시설", coords: BREAKWATER, state: "on", label: "방파제" },
  { kind: "line", id: "c-seawall", role: "방호시설", coords: SEAWALL, state: "on", label: "물양장 호안" },
  { kind: "point", id: "c-tide", at: [128.5768, 35.2012], icon: "mdi:waves", label: "구항 조위계", state: "실측", tone: "primary", small: true },
];
/** 월류 지점 — 그 시각에 넘치는 곳만 켠다 */
const over = (id: string, at: LngLat, label: string, active: boolean): ScenePoint => ({ kind: "point", id, at, icon: "mdi:arrow-down-bold", label, state: active ? "월류 중" : "월류 전", tone: active ? "danger" : "neutral" });
type Boat = "정박" | "노출" | "이동 계류";
const boatPoint = (state: Boat): ScenePoint => ({ kind: "point", id: "c-boats", at: BOATS_AT, icon: "mdi:ferry", label: "계류 선박", state, tone: state === "노출" ? "warning" : state === "이동 계류" ? "success" : "neutral" });
/** 한 눈금의 장면 — 월류 지점 둘 · 선박 · 역류방지 수문 · 해안도로 차단 */
const sceneAt = (s: { wharf: boolean; road: boolean; boat: Boat; gate: boolean; block: boolean }): SceneLayer[] => [
  over("c-over-wharf", WHARF_AT, "물양장", s.wharf),
  over("c-over-road", ROAD_AT, "해안도로", s.road),
  boatPoint(s.boat),
  { kind: "point", id: "c-gate", at: GATE_AT, icon: "mdi:gate", label: "역류방지 수문", state: s.gate ? "폐쇄" : "개방", tone: s.gate ? "primary" : "warning", small: true },
  ...(s.block ? [{ kind: "point" as const, id: "c-block", at: BLOCK_AT, icon: "mdi:traffic-cone", label: "해안도로 차단", state: "통제 중", tone: "primary" as const, small: true }] : []),
];

/* 재현 입력 — 사건 동안의 관측·운영 기록. 예보는 쓰지 않는다(이미 일어난 일이다) */
const INPUTS: ForecastInput[] = [
  { label: "조위 관측 (구항)", at: t("20:10"), kind: "관측" },
  { label: "파고 관측 (마산만 부이)", at: t("20:10"), kind: "관측" },
  { label: "기압·바람 관측", at: t("20:10"), kind: "관측" },
  { label: "수문·방호시설 운영 기록", at: t("20:10"), kind: "시설" },
];
/** 재현은 관측이 입력이라 불확실성이 보통, 대안은 일어나지 않은 진행이라 높다. 둘 다 사건이 끝난 뒤(20:40) 계산했다 */
const basis = (assumptions: string[], modelName = "대안 계산 (재현과 같은 방식 · 대응만 변경)", grade: ForecastBasis["uncertainty"]["grade"] = "높음"): ForecastBasis => ({
  modelName, modelVersion: "0.1", baseTime: BASE, generatedAt: t("20:40"),
  observedFrom: t("16:00"), inputs: INPUTS, inputEventIds: [], assumptions,
  uncertainty: { grade, sensitiveTo: ["만조 시각 전후 기압·바람", "방파제 마루고·수문 제원"], unusableRanges: ["19:30 이후"] },
  inputQuality: "보정", calculationActor: "해당 없음",
  replacementNote: "폭풍해일 전용 모델·조위 실연계 확보 시 ModelRun 결과로 교체",
});

/** 첫 줄 지표 — 월류 시작·구간(03 §27). 값은 월류 깊이라 지도 진하기에 쓰고, 문장이 첫 줄에 선다 */
type Four<T> = [T, T, T, T];
/** 그 시각의 핵심 영향 — 해안도로 상태(잠김 · 통제)와 그 시각 물이 든 상가 수 */
/**
 * 그 시각의 핵심 영향 — 해안도로 상태 · **막히기 전 노출 시간** · 저지대 상가.
 *
 * ★ 상태만 있으면 통제 시각이 결과를 못 가른다. 도로는 잠기면 `침수 · 통행 불가`, 막으면 `통제됨` 둘뿐이라
 *   17:55 에 막은 것과 18:15(실제)에 막은 것이 눈금 위에서 같은 글자가 된다(2026-09-17 측정).
 *   달라지는 것은 **잠긴 채로 열려 있던 시간**이고 그것이 일찍 막은 보람이다. 시간 차라 산수가 아니다.
 */
const impactsOf = (w: Four<[boolean, boolean]>, blockAt: string, shops: Four<number>, roadOnset: string | null = null): Four<MarkImpact[]> =>
  AT.map((at, i) => {
    const blocked = at >= blockAt;
    const road = w[i][1] ? (blocked ? "통제됨" : "침수 · 통행 불가") : blocked ? "통제됨" : "통행 가능";
    const open = roadOnset === null ? 0 : Math.max(0, Math.round((Math.min(ms(blockAt), ms(at)) - ms(roadOnset)) / 60_000));
    return [
      { label: "해안도로", value: road, tone: road === "통제됨" ? "safe" : road === "통행 가능" ? "muted" : "danger" },
      { label: "막히기 전 노출", value: open > 0 ? `${open}분` : "없음", tone: open >= 20 ? "danger" : open > 0 ? "warning" : "muted" },
      { label: "저지대 상가", value: shops[i] > 0 ? `유입 ${shops[i]}동` : "유입 없음", tone: shops[i] > 0 ? "danger" : "muted" },
    ] satisfies MarkImpact[];
  }) as Four<MarkImpact[]>;
const marksOf = (d: Four<number>, g: Four<string>, n: Four<string>, overText: Four<string>, scenes: Four<SceneLayer[]>, impacts: Four<MarkImpact[]>): ForecastMark[] =>
  AT.map((validAt, i) => ({
    validAt, maxDepthM: d[i], extentGeometryId: g[i], impactSummary: n[i],
    metric: { label: "월류", value: d[i], unit: "m", digits: 2, text: overText[i] },
    scene: scenes[i], impacts: impacts[i],
  }));

/* 영향 대상 — 물양장이 첫째다(도달 = 월파 시작).
   수는 적지 않는다. 대상과 상태만 둔다 — 통제로 줄어드는 차량·인원 수는 산수라 결과로 쓰지 않는다(README §2.3 기준 ③ · 2026-09-16) */
const targets = (shops: number, roadOnset: string | null, blockAt: string): ImpactTarget[] => {
  /* 갓길이 잠긴 뒤에 통제가 끝나면 그 사이는 노출이다. 얼마나인지는 세지 않는다 */
  const exposed = roadOnset !== null && blockAt > roadOnset;
  return [
    /* 월파가 시작되는 시각은 조위가 정한다 — 수문·통제로 바뀌지 않으므로 도달로 세우지 않는다.
       세우면 강평에 `17:45 → 17:45` 가 서서 "달라진 게 없다"로 읽힌다(2026-09-17) */
    { kind: "중요시설", id: "FAC-GH-WHARF", label: "물양장·방파제 등대", exposure: "부분 중단" },
    { kind: "도로", id: "RD-GH-COAST", label: "해안도로 구항 구간", exposure: "통제됨" },
    { kind: "건물", id: "BLD-GH-LOW", label: "저지대 상가", exposure: shops > 0 ? "노출" : "영향 없음" },
    { kind: "대상자", id: "POP-GH-ROAD", label: "해안도로·상가 이용자", exposure: exposed ? "노출" : "통제됨" },
  ];
};
/** 해안도로 침수 시작 — 기준 재현은 18:00 에 배수구 역류로 갓길이 잠긴다. 수문을 일찍 닫으면 늦어지거나 없다 */
const ROAD_ONSET = t("18:00");
const conditions = (gate: string, surge = "+30 cm · 저기압 통과", tide = "18:24 · 176 cm"): Forecast["conditions"] => [
  { label: "만조", value: tide },
  { label: "조위 편차", value: surge, tone: "warning" },
  { label: "파고", value: "2.3 m · 월파" },
  { label: "수문", value: gate },
];
const common = { incidentId: GH_INCIDENT_ID, availability: "가용" as const, validUntil: VALID_UNTIL, scene: C_STATIC, conditionMarkers: [{ at: t("18:24"), label: "만조" }] };

/* 실제 대응 시각 — 수문 18:05 · 해안도로 통제 18:15. 눈금마다 그 시각이 지났는지로 장면을 세운다 */
const ACTUAL_GATE = t("18:05");
const ACTUAL_BLOCK = t("18:15");
const scenes = (gateAt: string, blockAt: string, water: Four<[boolean, boolean]>): Four<SceneLayer[]> =>
  AT.map((at, i) => sceneAt({ wharf: water[i][0], road: water[i][1], boat: i === 3 ? "정박" : "노출", gate: at >= gateAt, block: at >= blockAt })) as Four<SceneLayer[]>;

/* ── 실제 — 수문 18:05 · 통제 18:15. 역류가 들어 18:30 해안도로·상가까지 잠겼다 ── */
const ACTUAL_D: Four<number> = [0.05, 0.18, 0.26, 0.14];
const ACTUAL_G: Four<string> = ["GEO-GH-OVER-1", "GEO-GH-OVER-1", "GEO-GH-OVER-2", "GEO-GH-OVER-1"];
const ACTUAL_N: Four<string> = ["처오름 월파 시작 · 물양장 물고임", "월파 지속 · 배수구 역류 · 해안도로 갓길 침수", "만조 정점 · 방파제 월류 · 해안도로 통행 불가 · 상가 유입", "조위 하강 · 배수 지연"];
const ACTUAL_O: Four<string> = ["월파 시작", "월파·역류", "방파제 월류", "배수 지연"];
const ACTUAL_W: Four<[boolean, boolean]> = [[true, false], [true, true], [true, true], [false, false]];
/** 그 시각 물이 든 상가 — 월류 계산 결과. 사건 전체 상가 수(영향 대상)는 이 중 최대다 */
const ACTUAL_SHOPS: Four<number> = [0, 0, 5, 3];
export const GH_ACTUAL: Forecast = {
  ...common, forecastId: "FC-GH-ACTUAL", alternativeId: "baseline", changedConditions: [],
  marks: marksOf(ACTUAL_D, ACTUAL_G, ACTUAL_N, ACTUAL_O, scenes(ACTUAL_GATE, ACTUAL_BLOCK, ACTUAL_W), impactsOf(ACTUAL_W, ACTUAL_BLOCK, ACTUAL_SHOPS, ROAD_ONSET)),
  arrivalAt: t("17:45"),
  targets: targets(5, ROAD_ONSET, ACTUAL_BLOCK),
  basis: basis(["관측 조위·파고를 넣어 다시 계산", "만조 18:24", "실제 대응: 수문 폐쇄 18:05 · 해안도로 통제 18:15"], "재현 계산 (관측 조위·파고 입력)", "보통"),
  conditions: conditions("폐쇄 18:05"),
};

/* ── 수문·차수를 일찍 — 역류가 줄어 월류가 물양장에 머문다 ── */
interface WaterSpec { d: Four<number>; g: Four<string>; n: Four<string>; o: Four<string>; w: Four<[boolean, boolean]>; shops: Four<number>; roadOnset: string | null }
const GATE_10: WaterSpec = {
  d: [0.05, 0.15, 0.21, 0.1], g: ["GEO-GH-OVER-1", "GEO-GH-OVER-1", "GEO-GH-OVER-1", "GEO-GH-OVER-1"],
  n: ["처오름 월파 시작 · 물양장 물고임", "월파 지속 · 역류 없음", "만조 정점 · 물양장 월류 · 해안도로 갓길 침수", "조위 하강 · 물 빠짐"],
  o: ["월파 시작", "월파 지속", "물양장 월류", "물 빠짐"], w: [[true, false], [true, false], [true, true], [false, false]], shops: [0, 0, 3, 1], roadOnset: t("18:25"),
};
const GATE_20: WaterSpec = {
  d: [0.05, 0.12, 0.17, 0.08], g: ["GEO-GH-OVER-1", "GEO-GH-OVER-1", "GEO-GH-OVER-1", "GEO-GH-OVER-1"],
  n: ["처오름 월파 시작 · 물양장 물고임", "월파 지속 · 역류 없음", "만조 정점 · 물양장 월류 · 해안도로 침수 없음", "조위 하강 · 물 빠짐"],
  o: ["월파 시작", "월파 지속", "물양장 월류", "물 빠짐"], w: [[true, false], [true, false], [true, false], [false, false]], shops: [0, 0, 1, 0], roadOnset: null,
};
const gateEarly = (id: string, at: string, early: string, { d, g, n, o, w, shops, roadOnset }: WaterSpec): Forecast => ({
  ...common, forecastId: id, alternativeId: "gate",
  changedConditions: [`역류방지 수문 폐쇄 · 물양장 차수판 · ${at.slice(11, 16)} (실제보다 ${early})`],
  hypothesis: `역류방지 수문을 실제보다 ${early}(${at.slice(11, 16)}) 닫은 경우`,
  marks: marksOf(d, g, n, o, scenes(at, ACTUAL_BLOCK, w), impactsOf(w, ACTUAL_BLOCK, shops, roadOnset)),
  arrivalAt: t("17:45"),
  targets: targets(Math.max(...shops), roadOnset, ACTUAL_BLOCK),
  basis: basis(["관측 조위·파고 · 만조 18:24", `수문 폐쇄 ${at.slice(11, 16)} 가정 · 해안도로 통제는 실제(18:15) 그대로`]),
  conditions: conditions(`폐쇄 ${at.slice(11, 16)}`),
  actionAt: { label: "수문 폐쇄", at },
});
export const GH_GATE_10 = gateEarly("FC-GH-GATE-10", t("17:55"), "10분 일찍", GATE_10);
export const GH_GATE_20 = gateEarly("FC-GH-GATE-20", t("17:45"), "20분 일찍", GATE_20);

/* ── 해안도로를 일찍 막기 — 물은 실제와 같고, 들어간 차와 사람만 준다 ── */
const ACTUAL_SPEC: WaterSpec = { d: ACTUAL_D, g: ACTUAL_G, n: ACTUAL_N, o: ACTUAL_O, w: ACTUAL_W, shops: ACTUAL_SHOPS, roadOnset: ROAD_ONSET };
/** 해안도로를 막는 시각만 바꾼다 — 물은 그 판 그대로(기준 재현 또는 해일 악화 판), 들어간 차와 사람만 준다 */
const blockOn = (id: string, at: string, early: string, spec: WaterSpec, wharfAt: string, lines: string[], cond: Forecast["conditions"], extraChanged: string[] = []): Forecast => ({
  ...common, forecastId: id, alternativeId: "coast-control",
  changedConditions: [...extraChanged, `해안도로 통제 · 상가 대피 안내 · ${at.slice(11, 16)} (실제보다 ${early})`],
  hypothesis: `해안도로를 실제보다 ${early}(${at.slice(11, 16)}) 막은 경우`,
  marks: marksOf(spec.d, spec.g, spec.n, spec.o, scenes(ACTUAL_GATE, at, spec.w), impactsOf(spec.w, at, spec.shops, spec.roadOnset)),
  arrivalAt: wharfAt,
  targets: targets(Math.max(...spec.shops), spec.roadOnset, at),
  basis: basis([...lines, `해안도로 통제 ${at.slice(11, 16)} 가정`], "규칙 계산 (같은 기록에 통제 시각만 변경)"),
  conditions: cond,
  actionAt: { label: "통제 시점", at },
});
const BLOCKS = [
  { at: t("18:05"), early: "10분 일찍", key: "BLOCK-10", presetId: "early10" },
  { at: t("17:55"), early: "20분 일찍", key: "BLOCK-20", presetId: "early20" },
] as const;
export const GH_BLOCK_10 = blockOn("FC-GH-BLOCK-10", BLOCKS[0].at, BLOCKS[0].early, ACTUAL_SPEC, t("17:45"), ["월류면은 기준 재현과 동일"], conditions("폐쇄 18:05"));
export const GH_BLOCK_20 = blockOn("FC-GH-BLOCK-20", BLOCKS[1].at, BLOCKS[1].early, ACTUAL_SPEC, t("17:45"), ["월류면은 기준 재현과 동일"], conditions("폐쇄 18:05"));

/* ── 상황 조건 · 해일 악화 — 조위 편차가 +30 이 아니라 +50 cm 였다면(만조 196 cm). 대응은 실제(수문 18:05 · 통제 18:15) 그대로 ──
   분석 기준(▲)까지는 실제와 같고 거기서부터 조위 편차만 바꾼다. 늦게 바뀔수록 앞 눈금이 실제와 같아진다 */
const DECISIONS = [t("17:20"), t("17:50"), t("18:15")] as const;
interface SurgeSpec extends WaterSpec { from: string; wharfAt: string; roadOnset: string }
const SURGE_COND = conditions("폐쇄 18:05", "+50 cm · 해일 악화", "18:24 · 196 cm");
const surgeLine = (from: string) => `조위 편차 +30 → +50 cm (${from.slice(11, 16)} 이후) · 만조 196 cm`;
const surgeFrom = ({ from, d, g, n, o, w, shops, wharfAt, roadOnset }: SurgeSpec): Forecast => ({
  ...common, forecastId: `FC-GH-SURGE-${from.slice(11, 13)}${from.slice(14, 16)}`, alternativeId: "situation",
  changedConditions: [`조위 편차 +50 cm · ${from.slice(11, 16)} 이후 (실제 +30 cm)`],
  hypothesis: `${from.slice(11, 16)} 이후 조위 편차가 실제보다 20 cm 컸던 경우`,
  marks: marksOf(d, g, n, o, scenes(ACTUAL_GATE, ACTUAL_BLOCK, w), impactsOf(w, ACTUAL_BLOCK, shops, roadOnset)),
  arrivalAt: wharfAt,
  targets: targets(Math.max(...shops), roadOnset, ACTUAL_BLOCK),
  basis: basis([surgeLine(from), "실제 대응 그대로: 수문 18:05 · 해안도로 통제 18:15"], "대안 계산 (재현과 같은 방식 · 상황 입력만 변경)"),
  conditions: SURGE_COND,
});
const SURGES: SurgeSpec[] = [
  /* 17:20 부터 — 월파가 7분 이르고(17:38) 해안도로가 17:50 부터 잠긴다. 만조에 방파제 월류가 넓어져 상가 9동 */
  {
    from: DECISIONS[0], d: [0.09, 0.26, 0.36, 0.22], g: ["GEO-GH-OVER-1", "GEO-GH-OVER-2", "GEO-GH-OVER-3", "GEO-GH-OVER-2"],
    n: ["월파 시작 · 해안도로 갓길 침수", "월파·역류 확대 · 해안도로 통행 불가", "만조 정점 196 cm · 방파제 월류 확대 · 상가 유입", "조위 하강 · 물양장 월파 지속"],
    o: ["월파·갓길 침수", "월파·역류", "방파제 월류", "월파 지속"], w: [[true, true], [true, true], [true, true], [true, false]], shops: [0, 2, 9, 5], wharfAt: t("17:38"), roadOnset: t("17:50"),
  },
  /* 17:50 부터 — 17:50 까지는 실제와 같다. 해안도로가 17:56 부터 잠기고 상가 8동 */
  {
    from: DECISIONS[1], d: [0.05, 0.24, 0.35, 0.2], g: ["GEO-GH-OVER-1", "GEO-GH-OVER-2", "GEO-GH-OVER-3", "GEO-GH-OVER-2"],
    n: [ACTUAL_N[0], "월파·역류 확대 · 해안도로 통행 불가", "만조 정점 196 cm · 방파제 월류 확대 · 상가 유입", "조위 하강 · 물양장 월파 지속"],
    o: [ACTUAL_O[0], "월파·역류", "방파제 월류", "월파 지속"], w: [[true, false], [true, true], [true, true], [true, false]], shops: [0, 1, 8, 4], wharfAt: t("17:45"), roadOnset: t("17:56"),
  },
  /* 18:15 부터 — 이미 잠긴 뒤라 도달·노출은 같고, 만조 월류만 커져 상가 7동 */
  {
    from: DECISIONS[2], d: [0.05, 0.18, 0.33, 0.19], g: ["GEO-GH-OVER-1", "GEO-GH-OVER-1", "GEO-GH-OVER-3", "GEO-GH-OVER-2"],
    n: [ACTUAL_N[0], ACTUAL_N[1], "만조 정점 196 cm · 방파제 월류 확대 · 상가 유입", "조위 하강 · 물양장 월파 지속"],
    o: [ACTUAL_O[0], ACTUAL_O[1], "방파제 월류", "월파 지속"], w: [[true, false], [true, true], [true, true], [true, false]], shops: [0, 0, 7, 4], wharfAt: t("17:45"), roadOnset: ROAD_ONSET,
  },
];
const SURGE_BOARDS = SURGES.map(surgeFrom);
export const [GH_SURGE_1720, GH_SURGE_1750, GH_SURGE_1815] = SURGE_BOARDS;

/* ── 상황과 대응을 함께 — 해일이 더 큰 날 수문·통제로 버티나 ─────────────────────
 * 해일 악화 판(분석 기준마다) 위에 대응 선택지를 얹은 사전 계산 판이다. 편집 규칙 둘:
 *   수문(현상 대응)   월류 깊이 = 해일 판 + (수문 판 − 기준 재현). 해안도로는 깊이 0.18 m 넘는 동안 잠기고, 잠기기 시작하는 시각은
 *                    해일 판의 시각에 두 판의 0.18 m 도달 차이만큼 옮긴다. 상가 유입도 차이를 더한다
 *                    — 해일이 크면 월파만으로도 도로가 잠겨 수문을 일찍 닫아도 도로 노출은 조금만 준다
 *   해안도로 통제      해일 판 그대로에 통제 시각만 바꿔 같은 노출 규칙 — 해일이 크면 도로가 일찍 잠겨 20분 일찍 막아도 늦을 수 있다
 * 분석 기준보다 이른 선택지는 화면이 먼저 닫으므로 그 조합은 만들지 않는다. 실개발은 조합마다 ModelRun 으로 교체한다.
 * ─────────────────────────────────────────────────────────────────── */
const kst = (m: number): string => {
  const d = new Date(Math.round(m / 60_000) * 60_000 + 9 * 3600_000);
  return t(`${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`);
};
/** 월류 깊이가 level 을 넘는 시각 — 17:20(0 m)부터 눈금 사이 직선 */
const crossAt = (d: Four<number>, level: number): number | null => {
  const pts: [number, number][] = [[ms(t("17:20")), 0], ...AT.map((a, i) => [ms(a), d[i]] as [number, number])];
  for (let i = 1; i < pts.length; i += 1) {
    const [t0, v0] = pts[i - 1], [t1, v1] = pts[i];
    if (v0 < level && v1 >= level) return t0 + ((level - v0) / (v1 - v0)) * (t1 - t0);
  }
  return null;
};
const overOf = (v: number) => (v < 0.22 ? "GEO-GH-OVER-1" : v < 0.33 ? "GEO-GH-OVER-2" : "GEO-GH-OVER-3");
const withGate = (sit: SurgeSpec, gate: WaterSpec): WaterSpec => {
  const d = sit.d.map((v, i) => Number(Math.max(0.03, v + gate.d[i] - ACTUAL_D[i]).toFixed(2))) as Four<number>;
  const shift = (crossAt(d, 0.18) ?? ms(t("19:30"))) - (crossAt(sit.d, 0.18) ?? ms(sit.roadOnset));
  const roadOnset = crossAt(d, 0.18) === null ? null : kst(ms(sit.roadOnset) + shift);
  const w = AT.map((at, i) => [i < 3 || d[i] >= 0.2, roadOnset !== null && at >= roadOnset && d[i] >= 0.12]) as Four<[boolean, boolean]>;
  const shops = sit.shops.map((v, i) => Math.max(0, v + gate.shops[i] - ACTUAL_SHOPS[i])) as Four<number>;
  const o = AT.map((_, i) => (i === 0 ? sit.o[0] : i === 1 ? (w[1][1] ? "월파·역류" : "월파 지속") : i === 2 ? (d[2] >= 0.25 ? "방파제 월류" : "물양장 월류") : w[3][0] ? "월파 지속" : "물 빠짐")) as Four<string>;
  const n = AT.map((_, i) => (i === 0 ? sit.n[0] : `${i === 2 ? "만조 정점 196 cm · " : ""}${o[i]}${w[i][1] ? " · 해안도로 잠김" : ""}${shops[i] ? ` · 상가 ${shops[i]}동 유입` : ""}`)) as Four<string>;
  return { d, g: d.map(overOf) as Four<string>, n, o, w, shops, roadOnset };
};
const GATES = [
  { spec: GATE_10, at: t("17:55"), early: "10분 일찍", key: "GATE-10", presetId: "early10" },
  { spec: GATE_20, at: t("17:45"), early: "20분 일찍", key: "GATE-20", presetId: "early20" },
] as const;
const COMBO_FORECASTS: Forecast[] = [];
const COMBOS: WhatIfCombo[] = [];
SURGES.forEach((sit, si) => {
  const sitF = SURGE_BOARDS[si];
  for (const gt of GATES) {
    if (ms(gt.at) < ms(sit.from)) continue;
    const c = withGate(sit, gt.spec);
    const f: Forecast = {
      ...common, forecastId: `${sitF.forecastId}-${gt.key}`, alternativeId: "gate",
      changedConditions: [...sitF.changedConditions, `역류방지 수문 폐쇄 · ${gt.at.slice(11, 16)} (실제보다 ${gt.early})`],
      hypothesis: `${sitF.hypothesis}에 수문을 ${gt.early}(${gt.at.slice(11, 16)}) 닫았다면`,
      marks: marksOf(c.d, c.g, c.n, c.o, scenes(gt.at, ACTUAL_BLOCK, c.w), impactsOf(c.w, ACTUAL_BLOCK, c.shops, c.roadOnset)),
      arrivalAt: sit.wharfAt,
      targets: targets(Math.max(...c.shops), c.roadOnset, ACTUAL_BLOCK),
      basis: basis([surgeLine(sit.from), `수문 폐쇄 ${gt.at.slice(11, 16)} 가정 · 해안도로 통제는 실제(18:15) 그대로`, "조합 판 = 해일 판 + (수문 판 − 기준 재현)"], "대안 계산 (재현과 같은 방식 · 상황과 대응 변경)"),
      conditions: conditions(`폐쇄 ${gt.at.slice(11, 16)}`, "+50 cm · 해일 악화", "18:24 · 196 cm"),
      actionAt: { label: "수문 폐쇄", at: gt.at },
    };
    COMBO_FORECASTS.push(f);
    COMBOS.push({ situationForecastId: sitF.forecastId, responseId: "gate", presetId: gt.presetId, forecastId: f.forecastId });
  }
  for (const bl of BLOCKS) {
    if (ms(bl.at) < ms(sit.from)) continue;
    const f = blockOn(`${sitF.forecastId}-${bl.key}`, bl.at, bl.early, sit, sit.wharfAt, [surgeLine(sit.from), "월류면은 해일 판과 동일"], SURGE_COND, sitF.changedConditions);
    COMBO_FORECASTS.push(f);
    COMBOS.push({ situationForecastId: sitF.forecastId, responseId: "coast-control", presetId: bl.presetId, forecastId: f.forecastId });
  }
});

/* ═══ 훈련 조합 판 (03 §26.10 · 2026-09-17) ═══════════════════════════════
 *
 * 훈련이 묻는 것은 **수문을 언제 닫을까**다(현상 대응). 바다가 경계를 넘는 시각은 조위가 정하고,
 * 우리가 정하는 것은 그 전에 배수구를 막느냐다. 해안도로 통제(노출 대응)는 도로에 들어간 차와 사람을 바꾼다.
 *
 * ★ **판단 국면이 하나다.** 만조가 18:24 이고 월파가 17:45 에 시작하므로 결정 창이 17:50 하나뿐이다 —
 *   다음 눈금(18:10)에는 실제 대응 시각(수문 18:05 · 통제 18:15)이 이미 지나 고를 것이 남지 않는다.
 *   창원천·무학산은 판단이 둘인데 여기는 하나인 것이 **이 유형의 성질**이고, 그 촉박함이 훈련이 보게 하려는 것이다.
 * ★ 조합 판은 `withGate`(해일 판에 수문 얹기) 규칙으로 만든다. 통제는 물을 바꾸지 않고 노출만 바꾼다.
 * ═══════════════════════════════════════════════════════════════════════ */

/** 훈련 조건 — 당시 +30 cm · 해일 악화 +50 cm. 악화는 훈련 시작 시각(17:50)부터 */
const GH_TR_SURGE: { id: string; spec: SurgeSpec | null }[] = [
  { id: "now", spec: null },
  { id: "surge", spec: SURGES[1] },
];

const ghTrainBoard = (surgeId: string, gateStop: string | null, blockStop: string | null): Forecast => {
  const sit = GH_TR_SURGE.find((x) => x.id === surgeId)?.spec ?? null;
  const gate = gateStop ? GATE_10 : null;
  /* 물 — 해일이면 해일 판에 수문을 얹고, 아니면 수문 판(없으면 실제 재현) */
  const spec: WaterSpec = sit ? (gate ? withGate(sit, gate) : sit) : (gate ?? ACTUAL_SPEC);
  const gateAt = gate ? GATES[0].at : ACTUAL_GATE;
  const blockAt = blockStop ? BLOCKS[1].at : ACTUAL_BLOCK;
  const wharfAt = sit ? sit.wharfAt : t("17:45");
  const changed = [
    ...(sit ? ["조위 편차 +50 cm · 해일 악화"] : []),
    ...(gate ? [`역류방지 수문 폐쇄 ${gateAt.slice(11, 16)}`] : []),
    ...(blockStop ? [`해안도로 통제 ${blockAt.slice(11, 16)}`] : []),
  ];
  return {
    ...common,
    forecastId: `FC-GH-TR-${surgeId}-${gateStop ? "g" : "x"}-${blockStop ? "b" : "x"}`,
    alternativeId: gate ? "gate" : blockStop ? "coast-control" : "baseline",
    changedConditions: changed,
    ...(changed.length > 0 ? { hypothesis: changed.join(" · ") } : {}),
    marks: marksOf(spec.d, spec.g, spec.n, spec.o, scenes(gateAt, blockAt, spec.w), impactsOf(spec.w, blockAt, spec.shops, spec.roadOnset)),
    arrivalAt: wharfAt,
    targets: targets(Math.max(...spec.shops), spec.roadOnset, blockAt),
    basis: basis([
      sit ? surgeLine(sit.from) : "관측 조위·파고 · 만조 18:24",
      `수문 폐쇄 ${gateAt.slice(11, 16)} · 해안도로 통제 ${blockAt.slice(11, 16)}`,
    ], "규칙 계산 (같은 기록에 조위·수문·통제 시각만 변경)"),
    conditions: sit ? SURGE_COND : conditions(`폐쇄 ${gateAt.slice(11, 16)}`),
    ...(gate ? { actionAt: { label: "수문 폐쇄", at: gateAt } } : {}),
  };
};

const GH_TR_CHOICES: (string | null)[] = [AT[0], null];
const GH_TRAIN_BOARDS: Forecast[] = GH_TR_SURGE.flatMap((s) =>
  GH_TR_CHOICES.flatMap((g) => GH_TR_CHOICES.map((bk) => ghTrainBoard(s.id, g, bk))));
const GH_TRAINING_COMBOS = GH_TR_SURGE.flatMap((s) =>
  GH_TR_CHOICES.flatMap((g) => GH_TR_CHOICES.map((bk) => ({
    conditionStepId: s.id,
    acts: { ...(g ? { C1: g } : {}), ...(bk ? { C2: bk } : {}) } as Record<string, string>,
    forecastId: ghTrainBoard(s.id, g, bk).forecastId,
  }))));

export const GUHANG_FORECASTS: Forecast[] = [GH_ACTUAL, GH_GATE_10, GH_GATE_20, GH_BLOCK_10, GH_BLOCK_20, ...SURGE_BOARDS, ...COMBO_FORECASTS, ...GH_TRAIN_BOARDS];

const SITUATIONS: WhatIfSituation[] = [
  {
    situationId: "surge-up", label: "해일 악화", detail: "조위 편차 +30 → +50 cm · 만조 196 cm",
    byBasis: SURGE_BOARDS.map((f, i) => ({ at: DECISIONS[i], forecastId: f.forecastId })),
    method: "사전 계산 · 기준 재현과 같은 방식에 조위 편차 입력만 변경",
  },
];

const RESPONSES: WhatIfResponse[] = [
  {
    responseId: "gate", kind: "현상", target: "역류방지 수문 · 물양장 차수판", level: "배수구 역류 차단", adjust: "when", method: "사전 계산 · 기준 재현과 같은 방식에 수문 폐쇄 시각만 변경",
    anchor: { label: "실제 수문 폐쇄", at: ACTUAL_GATE },
    presets: [
      { id: "actual", label: "실제", at: ACTUAL_GATE, forecastId: null },
      { id: "early10", label: "10분 일찍", at: t("17:55"), forecastId: GH_GATE_10.forecastId },
      { id: "early20", label: "20분 일찍", at: t("17:45"), forecastId: GH_GATE_20.forecastId },
    ],
  },
  {
    responseId: "coast-control", kind: "노출", target: "해안도로 구항 구간 · 저지대 상가", level: "통제 · 상가 대피 안내", adjust: "when", method: "사전 계산 · 통제 시각별 판. 결과는 통제 완료와 해안도로 침수 시작 사이의 여유로 읽는다",
    anchor: { label: "실제 해안도로 통제", at: ACTUAL_BLOCK },
    presets: [
      { id: "actual", label: "실제", at: ACTUAL_BLOCK, forecastId: null },
      { id: "early10", label: "10분 일찍", at: BLOCKS[0].at, forecastId: GH_BLOCK_10.forecastId },
      { id: "early20", label: "20분 일찍", at: BLOCKS[1].at, forecastId: GH_BLOCK_20.forecastId },
    ],
  },
];

export const GUHANG_WHATIF: WhatIfCase = {
  incidentId: GH_INCIDENT_ID,
  title: "구항 방파제 월류",
  hazardKind: "해안월류",
  twinFamily: "C",
  scope: { kind: "시설", displayAnchor: [128.576, 35.202], affectedGeometryId: "GEO-GH-COAST", label: "구항 방파제 · 물양장" },
  legacyDistrictId: "guhang",
  occurredAt: t("17:20"),
  closedAt: t("20:10"),
  record: [
    { at: t("17:05"), label: "조위 편차 +30 cm · 파고 2.1 m", kind: "관측" },
    { at: t("17:08"), label: "방파제 수위계 결측", kind: "관측" },
    { at: t("17:20"), label: "월류 예측 발생 · 물양장 17:45 월파", kind: "예측", decision: true },
    { at: t("17:45"), label: "물양장 월파 시작", kind: "영향" },
    { at: t("17:50"), label: "물양장 접근통제", kind: "대응", decision: true },
    { at: t("18:00"), label: "배수구 역류 · 해안도로 갓길 침수", kind: "영향" },
    { at: t("18:05"), label: "역류방지 수문 폐쇄", kind: "대응" },
    { at: t("18:15"), label: "해안도로 통제 · 상가 대피 안내", kind: "대응", decision: true },
    { at: t("18:24"), label: "만조 · 176 cm", kind: "관측" },
    { at: t("18:30"), label: "방파제 월류 · 저지대 상가 유입", kind: "영향" },
    { at: t("20:10"), label: "조위 하강 · 사건 종료", kind: "관측" },
  ],
  reconstructionForecastId: GH_ACTUAL.forecastId,
  stateByTime: [
    { at: t("17:20"), rows: [{ label: "구항 조위계", value: "149 cm" }, { label: "파고 (부이)", value: "2.1 m" }, { label: "방파제 수위계", value: "결측" }, { label: "역류방지 수문", value: "개방" }] },
    { at: t("17:50"), rows: [{ label: "구항 조위계", value: "164 cm" }, { label: "파고 (부이)", value: "2.3 m" }, { label: "방파제 수위계", value: "결측" }, { label: "역류방지 수문", value: "개방" }] },
    { at: t("18:15"), rows: [{ label: "구항 조위계", value: "172 cm" }, { label: "파고 (부이)", value: "2.4 m" }, { label: "방파제 수위계", value: "결측" }, { label: "역류방지 수문", value: "폐쇄 (18:05)" }] },
    { at: t("18:30"), rows: [{ label: "구항 조위계", value: "176 cm" }, { label: "파고 (부이)", value: "2.4 m" }, { label: "방파제 수위계", value: "결측" }, { label: "역류방지 수문", value: "폐쇄" }] },
  ],
  observed: [
    { label: "최고 조위 (실측)", value: "176 cm · 18:22" },
    { label: "상가 침수 (현장 조사)", value: "6동" },
  ],
  responses: RESPONSES,
  /* 발동한 규정 — 17:20 월류 예측이 둘 다 띄웠다. 실제로는 수문 18:05 · 통제 18:15 에 움직였다 */
  sop: [
    { id: "C1", label: "역류방지 수문 폐쇄", trigger: "월류 예측 · 물양장 17:45 월파", firedAt: t("17:20"), actedAt: ACTUAL_GATE, responseId: "gate" },
    { id: "C2", label: "해안도로 통제", trigger: "배수구 역류 · 해안도로 갓길 침수 예상", firedAt: t("17:20"), actedAt: ACTUAL_BLOCK, responseId: "coast-control" },
  ],
  training: {
    incidentId: GH_INCIDENT_ID,
    stops: [
      { at: AT[0], phase: "판단", note: "물양장 월파가 시작됐다 · 만조 18:24 · 여기서 정하지 않으면 실제와 같아진다" },
      { at: AT[1], phase: "결과", note: "배수구 역류 · 조치 창이 닫혔다" },
      { at: AT[2], phase: "결과", note: "만조 정점" },
      { at: AT[3], phase: "결과", note: "조위 하강" },
    ],
    conditions: [
      {
        id: "surge", label: "조위", stateLabel: "조위 편차",
        steps: [
          { id: "now", label: "당시", detail: "조위 편차 +30 cm · 만조 176 cm", situationId: null },
          { id: "surge", label: "+20 cm", detail: "조위 편차 +50 cm · 만조 196 cm", situationId: "surge-up" },
        ],
      },
    ],
    firedSopIds: ["C1", "C2"],
    /* 수문은 물을, 통제는 도로 노출을 가른다 */
    resultSopIds: ["C1", "C2"],
    combos: GH_TRAINING_COMBOS,
  },
  situations: SITUATIONS,
  combos: COMBOS,
};
