/* ─────────────────────────────────────────────
 * E8 침수예측판 — FORECAST_UPDATED 이벤트와 Forecast 결과 객체
 * 정본: 02 §5.4 E8 · §5.5 · D4~D5, 03 §6, IA §8
 *
 * 검증된 도시침수 모델 결과는 미확보다. 여기 Forecast 는 E0~E6 과 방향이 맞는 **시나리오 결과 세트**이고
 * 정확도를 주장하지 않는다. 대안 규칙(02 §5.5): 배수 대응은 개선 방향의 사전 작성 결과, 도로 통제는
 * 침수면 동일·노출 대상만 다름. 눈금은 17:10 기준 +10·+30·+50·+80 분 — "18:00 전망"이 눈금값이 되게.
 * ───────────────────────────────────────────── */

import type { EventEnvelope } from "../../model/event";

import type { Forecast, ForecastBasis, ForecastInput, ImpactTarget } from "../../model/forecast";
import { DRAINAGE_BASIN_ID, SUBJECTS, SUBJECT_LOCATION } from "./subjects";
import { FIXTURE_GENERATED_AT, INCIDENT_ID, SCENARIO_RULE, t } from "./incident";

export const FORECAST_BASE_ID = "FC-SH-20240921-1710-BASE";
export const FORECAST_DRAIN_ID = "FC-SH-20240921-1710-DRAIN";
export const FORECAST_ROAD_ID = "FC-SH-20240921-1710-ROAD";
export const FORECAST_BASE_2_ID = "FC-SH-20240921-1810-BASE";

import { floodConditions, floodScene, floodSceneAt, type UnderpassState } from "./scene";

const BASE_TIME = t("17:10");

/* 장면 층 — 도로·지하차도 상태는 눈금마다, 펌프·저류는 예측판마다 사전 작성 (scene.ts) */
const COND_BASE = floodConditions("20 mm/h 강함 · 19시 최대 17.8", "18:24 · 176 cm", "2호기 정지 · 가용 2/3");
const COND_DRAIN = floodConditions("20 mm/h 강함 · 19시 최대 17.8", "18:24 · 176 cm", "2호기 재가동 · 3/3");
/* 도달 17:52 = 통행 지장 시작. 그 전 눈금(17:40)은 물고임 확대·서행이지 차로 침수가 아니다 */
const SCENE_BASE = floodSceneAt({ pump: "2호기 정지 · 가용 2/3", retention: "여유 62 %" }, [["물고임", "정상"], ["물고임", "정상"], ["통행 불가", "유입 시작"], ["통행 불가", "부분 중단"]]);
const SCENE_DRAIN = floodSceneAt({ pump: "2호기 재가동 · 3/3", retention: "추가 유입 중" }, [["물고임", "정상"], ["물고임", "정상"], ["차로 침수 · 서행", "정상"], ["차로 침수 · 서행", "정상"]]);
/* 통제 완료 17:50 — 그 전 눈금(17:20·17:40)은 아직 열려 있다 */
const SCENE_ROAD = floodSceneAt({ pump: "2호기 정지 · 가용 2/3", retention: "여유 62 %" }, [["물고임", "정상"], ["물고임", "정상"], ["통제됨", "통제됨"], ["통제됨", "통제됨"]]);
const SCENE_BASE_2 = floodSceneAt({ pump: "2호기 정지 · 가용 2/3", retention: "여유 62 %" }, [["통제됨", "통제됨"], ["통제됨", "통제됨"], ["통제됨", "통제됨"], ["물고임", "통제됨"]]);

/* 무엇이 언제 들어와 이 전망을 만들었나 — 전망 타임라인의 관측 구간과 예측 기준 카드가 같이 쓴다.
   시각은 사건 이벤트(E1·E3·E4·E6)의 관측시각에 맞춘 시나리오 값이다 */
const INPUTS: ForecastInput[] = [
  { label: "강우 관측", at: t("17:09"), kind: "관측" },
  { label: "관로 수위", at: t("17:08"), kind: "관측" },
  { label: "도로 수위", at: t("17:08"), kind: "관측" },
  { label: "조위 예보", at: t("16:50"), kind: "예보" },
  { label: "펌프·저류 상태", at: t("17:09"), kind: "시설" },
];
/** 예측판 밖의 조건 — 타임라인에 마커로 선다 */
const TIDE_MARKER = [{ at: t("18:24"), label: "만조" }];

const basis = (overrides: Partial<ForecastBasis> = {}): ForecastBasis => ({
  modelName: "시나리오 침수 결과 세트", modelVersion: "0.1", baseTime: BASE_TIME, generatedAt: t("17:13"),
  observedFrom: t("16:00"), inputs: INPUTS,
  inputEventIds: ["EV-E1-01", "EV-E3A-01", "EV-E4A-06", "EV-E4B-01", "EV-E6A-01", "EV-E6B-01"],
  assumptions: ["현재 강우·조위 예보 유지", "펌프 가용 2/3 유지", "저류 여유 62 % 유지"],
  uncertainty: { grade: "보통", sensitiveTo: ["19시 전후 강우강도", "만조 시각의 자연배수 제약"], unusableRanges: ["18:40 이후 (다음 갱신판 필요)"] },
  inputQuality: "지연", calculationActor: "해당 없음",
  replacementNote: "검증된 도시침수 모델 결과 확보 시 ModelRun 결과로 교체 (02 §5.4 P0)",
  ...overrides,
});

const targetsBase: ImpactTarget[] = [
  { kind: "도로", id: SUBJECTS.coastRoad, label: "해안도로 저지대 구간", arrivalAt: t("17:52"), exposure: "노출" },
  { kind: "중요시설", id: SUBJECTS.underpass, label: "신포 지하차도", arrivalAt: t("18:20"), exposure: "부분 중단" },
  { kind: "건물", id: "BLD-SH-LOW", label: "저지대 건물", arrivalAt: t("18:05"), exposure: "노출" },
];

export const FORECAST_BASE: Forecast = {
  forecastId: FORECAST_BASE_ID, incidentId: INCIDENT_ID, alternativeId: "baseline", changedConditions: [],
  marks: [
    { validAt: t("17:20"), maxDepthM: 0.05, extentGeometryId: "GEO-FLOOD-T10", impactSummary: "해안도로 저지대 물고임 시작", scene: SCENE_BASE("GEO-FLOOD-T10", 0) },
    { validAt: t("17:40"), maxDepthM: 0.18, extentGeometryId: "GEO-FLOOD-T30", impactSummary: "해안도로 물고임 확대 · 서행", scene: SCENE_BASE("GEO-FLOOD-T30", 1) },
    { validAt: t("18:00"), maxDepthM: 0.32, extentGeometryId: "GEO-FLOOD-T50", impactSummary: "해안도로 통행 불가 · 지하차도 진입부 유입", scene: SCENE_BASE("GEO-FLOOD-T50", 2) },
    { validAt: t("18:30"), maxDepthM: 0.41, extentGeometryId: "GEO-FLOOD-T80", impactSummary: "저지대 건물 침수 노출 · 지하차도 부분 중단", scene: SCENE_BASE("GEO-FLOOD-T80", 3) },
  ],
  arrivalAt: t("17:52"), targets: targetsBase, basis: basis(), availability: "가용", sourceEventId: "EV-E8-01", validUntil: t("18:40"),
  conditions: COND_BASE,
  conditionMarkers: TIDE_MARKER,
};

export const FORECAST_DRAIN: Forecast = {
  forecastId: FORECAST_DRAIN_ID, incidentId: INCIDENT_ID, alternativeId: "drainage",
  changedConditions: ["펌프 2호기 재가동 (가용 3/3)", "저류시설 추가 유입"],
  marks: [
    { validAt: t("17:20"), maxDepthM: 0.05, extentGeometryId: "GEO-FLOOD-T10", impactSummary: "해안도로 저지대 물고임 시작", scene: SCENE_DRAIN("GEO-FLOOD-T10", 0) },
    { validAt: t("17:40"), maxDepthM: 0.14, extentGeometryId: "GEO-FLOOD-T30", impactSummary: "해안도로 물고임 확대 · 서행", scene: SCENE_DRAIN("GEO-FLOOD-T30", 1) },
    { validAt: t("18:00"), maxDepthM: 0.2, extentGeometryId: "GEO-FLOOD-DRAIN-T50", impactSummary: "해안도로 통행 지장 · 지하차도 유입 없음", scene: SCENE_DRAIN("GEO-FLOOD-DRAIN-T50", 2) },
    { validAt: t("18:30"), maxDepthM: 0.22, extentGeometryId: "GEO-FLOOD-DRAIN-T80", impactSummary: "침수 확대 정지 · 저지대 건물 노출", scene: SCENE_DRAIN("GEO-FLOOD-DRAIN-T80", 3) },
  ],
  arrivalAt: t("17:55"),
  targets: [
    { kind: "도로", id: SUBJECTS.coastRoad, label: "해안도로 저지대 구간", arrivalAt: t("17:55"), exposure: "노출" },
    { kind: "중요시설", id: SUBJECTS.underpass, label: "신포 지하차도", exposure: "영향 없음" },
    { kind: "건물", id: "BLD-SH-LOW", label: "저지대 건물", arrivalAt: t("18:20"), exposure: "노출" },
    { kind: "대상자", id: "VEH-SH-COAST", label: "침수 구간 진입 차량 17대", arrivalAt: t("17:55"), exposure: "노출" },
    { kind: "대상자", id: "POP-SH-COAST", label: "노출 인원 29명", arrivalAt: t("17:55"), exposure: "노출" },
  ],
  basis: basis({ assumptions: ["현재 강우·조위 예보 유지", "펌프 2호기 재가동 가정", "저류시설 추가 유입 가정"] }),
  availability: "가용", sourceEventId: "EV-E8-01", validUntil: t("18:40"),
  conditions: COND_DRAIN,
  conditionMarkers: TIDE_MARKER,
};

export const FORECAST_ROAD: Forecast = {
  forecastId: FORECAST_ROAD_ID, incidentId: INCIDENT_ID, alternativeId: "road-control",
  changedConditions: ["해안도로 저지대 구간 선제 통제 (17:50 이전)"],
  hypothesis: "해안도로 저지대 구간을 17:50부터 통제하는 경우",
  marks: FORECAST_BASE.marks.map((m, i) => ({ ...m, scene: SCENE_ROAD(m.extentGeometryId, i) })), arrivalAt: t("17:52"),
  targets: [
    { kind: "도로", id: SUBJECTS.coastRoad, label: "해안도로 저지대 구간", arrivalAt: t("17:52"), exposure: "통제됨" },
    { kind: "중요시설", id: SUBJECTS.underpass, label: "신포 지하차도", arrivalAt: t("18:20"), exposure: "통제됨" },
    { kind: "건물", id: "BLD-SH-LOW", label: "저지대 건물", arrivalAt: t("18:05"), exposure: "노출" },
    { kind: "대상자", id: "VEH-SH-COAST", label: "침수 구간 진입 차량 2대", exposure: "통제됨" },
    { kind: "대상자", id: "POP-SH-COAST", label: "노출 인원 6명", exposure: "통제됨" },
  ],
  basis: basis({ assumptions: ["침수면은 기준 예측과 동일", "통제 완료 시각 17:50 가정"] }),
  availability: "가용", sourceEventId: "EV-E8-01", validUntil: t("18:40"),
  conditions: COND_BASE,
  conditionMarkers: TIDE_MARKER,
  actionAt: { label: "통제 시점", at: t("17:50") },
};

/* ── 디지털트윈 대응 What-if 선택지 (03 §26.3 · 2026-09-16) ────────────────────
 * 진행 중 사건의 질문은 "지금 하면 · 늦으면"이다. 시작 시점은 대안 비교 시각(d5 17:39)에서 즉시 17:40 · 10분 뒤 17:50 · 20분 뒤 18:00.
 * 해안도로 침수 예상이 17:52 라 10분 뒤는 침수 직전, 20분 뒤는 침수가 시작된 뒤다(2026-09-16 사용자 "응 정리해줘" · 앞선 즉시·20분 전·10분 전은
 * 17:13 예측판 시각에 묶여 있어 비교를 여는 17:39 에 이미 지난 시각으로 보였다).
 * 선택지마다 판을 미리 만든다. 조건에서 값을 계산하지 않는다. 기준은 FORECAST_BASE(추가 대응 없이 지금 상태 유지).
 * 도로 통제는 침수를 줄이지 않는다 — 침수면·깊이는 기준과 같고, 침수 구간 진입 차량 · 노출 인원만 달라진다.
 * 배수 대응은 침수를 줄인다 — 일찍 할수록 깊이·범위·영향 건물이 준다. 범위는 이미 구운 수위 단계(geometry.generated.ts)를 쓴다.
 * 20분 뒤 도로 통제(9대 · 22명)는 실제 흐름(통제 완료 18:06 · 17:50 관측 노출 9대 · 22명, workflow.ts)과 같은 크기로 맞췄다.
 * ───────────────────────────────────────────────────────────────────────── */
export const WHATIF_ROAD_NOW_ID = "FC-WI-SH-ROAD-NOW";
export const WHATIF_ROAD_D10_ID = "FC-WI-SH-ROAD-D10";
export const WHATIF_ROAD_D20_ID = "FC-WI-SH-ROAD-D20";
export const WHATIF_DRAIN_NOW_ID = "FC-WI-SH-DRAIN-NOW";
export const WHATIF_DRAIN_D10_ID = "FC-WI-SH-DRAIN-D10";
export const WHATIF_DRAIN_D20_ID = "FC-WI-SH-DRAIN-D20";

const P2 = { pump: "2호기 정지 · 가용 2/3" as const, retention: "여유 62 %" as const };
const P3 = { pump: "2호기 재가동 · 3/3" as const, retention: "추가 유입 중" as const };

/** 도로 통제 — 통제가 끝난 눈금부터 해안도로가 "통제됨". 지하차도는 대상 밖이라 기준 그대로 */
function roadVariant(id: string, at: string, when: string, steps: [RoadStateStep, RoadStateStep, RoadStateStep, RoadStateStep]): Forecast {
  const scene = floodSceneAt(P2, [[steps[0], "정상"], [steps[1], "정상"], [steps[2], "유입 시작"], [steps[3], "부분 중단"]]);
  return {
    forecastId: id, incidentId: INCIDENT_ID, alternativeId: "road-control",
    changedConditions: [`해안도로 저지대 구간 통제 · ${at.slice(11, 16)} (${when})`],
    hypothesis: `해안도로 저지대 구간을 ${at.slice(11, 16)} 에 통제하는 경우`,
    marks: FORECAST_BASE.marks.map((m, i) => ({ ...m, scene: scene(m.extentGeometryId, i) })), arrivalAt: t("17:52"),
    targets: [
      { kind: "도로", id: SUBJECTS.coastRoad, label: "해안도로 저지대 구간", arrivalAt: t("17:52"), exposure: "통제됨" },
      { kind: "중요시설", id: SUBJECTS.underpass, label: "신포 지하차도", arrivalAt: t("18:20"), exposure: "부분 중단" },
      { kind: "건물", id: "BLD-SH-LOW", label: "저지대 건물", arrivalAt: t("18:05"), exposure: "노출" },
    ],
    basis: basis({ assumptions: ["침수면은 기준 예측과 동일", `통제 완료 ${at.slice(11, 16)} 가정`] }),
    availability: "가용", sourceEventId: "EV-E8-01", validUntil: t("18:40"),
    conditions: COND_BASE, conditionMarkers: TIDE_MARKER,
    actionAt: { label: "통제 시점", at },
  };
}
type RoadStateStep = "물고임" | "차로 침수 · 서행" | "통행 불가" | "통제됨";

/* 즉시 17:40 · 10분 뒤 17:50 — 둘 다 침수(17:52) 전에 닫혀 규칙상 노출이 없다. "침수 전에만 닫으면 된다"가 결과로 선다 */
export const WHATIF_ROAD_NOW = roadVariant(WHATIF_ROAD_NOW_ID, t("17:40"), "즉시", ["물고임", "통제됨", "통제됨", "통제됨"]);
export const WHATIF_ROAD_D10 = roadVariant(WHATIF_ROAD_D10_ID, t("17:50"), "10분 뒤", ["물고임", "물고임", "통제됨", "통제됨"]);
/* 20분 뒤 18:00 — 침수 8분 뒤. 17:52 부터 들어간 차와 사람이 규칙대로 남는다 */
export const WHATIF_ROAD_D20 = roadVariant(WHATIF_ROAD_D20_ID, t("18:00"), "20분 뒤", ["물고임", "물고임", "통제됨", "통제됨"]);

/** 배수 대응 — 재가동 시각별 판. 앞 두 눈금(17:20 · 17:40)은 재가동 전이라 기준과 같다 */
function drainVariant(id: string, at: string, when: string, rows: { depth: [number, number]; extent: [string, string]; summary: [string, string]; road: [RoadStateStep, RoadStateStep]; underpass: [UnderpassState, UnderpassState] },
  arrival: string, underpass: ImpactTarget, buildings: { at: string }): Forecast {
  const scene = floodSceneAt(P3, [["물고임", "정상"], ["물고임", "정상"], [rows.road[0], rows.underpass[0]], [rows.road[1], rows.underpass[1]]]);
  const [m0, m1] = FORECAST_BASE.marks;
  return {
    forecastId: id, incidentId: INCIDENT_ID, alternativeId: "drainage",
    changedConditions: [`펌프 2호기 재가동 (가용 3/3) · ${at.slice(11, 16)} (${when})`, "저류시설 추가 유입"],
    hypothesis: `펌프 2호기를 ${at.slice(11, 16)} 에 재가동하고 저류시설로 추가 유입하는 경우`,
    marks: [
      { ...m0, scene: scene(m0.extentGeometryId, 0) },
      { ...m1, scene: scene(m1.extentGeometryId, 1) },
      { validAt: t("18:00"), maxDepthM: rows.depth[0], extentGeometryId: rows.extent[0], impactSummary: rows.summary[0], scene: scene(rows.extent[0], 2) },
      { validAt: t("18:30"), maxDepthM: rows.depth[1], extentGeometryId: rows.extent[1], impactSummary: rows.summary[1], scene: scene(rows.extent[1], 3) },
    ],
    arrivalAt: arrival,
    targets: [
      { kind: "도로", id: SUBJECTS.coastRoad, label: "해안도로 저지대 구간", arrivalAt: arrival, exposure: "노출" },
      underpass,
      { kind: "건물", id: "BLD-SH-LOW", label: "저지대 건물", arrivalAt: buildings.at, exposure: "노출" },
    ],
    basis: basis({ assumptions: ["현재 강우·조위 예보 유지", `펌프 2호기 ${at.slice(11, 16)} 재가동 가정`, "저류시설 추가 유입 가정"] }),
    availability: "가용", sourceEventId: "EV-E8-01", validUntil: t("18:40"),
    conditions: COND_DRAIN, conditionMarkers: TIDE_MARKER,
    actionAt: { label: "재가동 시점", at },
  };
}

/* 즉시 17:40 — 18:00 수위가 T50 에 못 미쳐 지하차도에 물이 들지 않고, 18:30 에는 오히려 줄어든다 */
export const WHATIF_DRAIN_NOW = drainVariant(WHATIF_DRAIN_NOW_ID, t("17:40"), "즉시", {
  depth: [0.25, 0.23], extent: ["GEO-FLOOD-ACT", "GEO-FLOOD-DRAIN-T80"],
  summary: ["해안도로 통행 불가 · 지하차도 유입 없음", "침수 줄어듦 · 저지대 건물 노출"],
  road: ["통행 불가", "차로 침수 · 서행"], underpass: ["정상", "정상"],
}, t("17:53"), { kind: "중요시설", id: SUBJECTS.underpass, label: "신포 지하차도", exposure: "영향 없음" }, { at: t("18:10") });
/* 10분 뒤 17:50 — 침수 직전. 18:00 은 기준과 같고 18:30 부터 덜 커진다. 지하차도는 진입부만 젖는다 */
export const WHATIF_DRAIN_D10 = drainVariant(WHATIF_DRAIN_D10_ID, t("17:50"), "10분 뒤", {
  depth: [0.3, 0.33], extent: ["GEO-FLOOD-T50", "GEO-FLOOD-ACT"],
  summary: ["해안도로 통행 불가 · 지하차도 진입부 유입", "확대 둔화 · 저지대 건물 노출"],
  road: ["통행 불가", "통행 불가"], underpass: ["유입 시작", "유입 시작"],
}, t("17:52"), { kind: "중요시설", id: SUBJECTS.underpass, label: "신포 지하차도", arrivalAt: t("18:25"), exposure: "노출" }, { at: t("18:05") });
/* 20분 뒤 18:00 — 침수가 시작된 뒤. 18:30 확대만 멈추고 지하차도·도로 노출은 기준과 같다 */
export const WHATIF_DRAIN_D20 = drainVariant(WHATIF_DRAIN_D20_ID, t("18:00"), "20분 뒤", {
  depth: [0.32, 0.36], extent: ["GEO-FLOOD-T50", "GEO-FLOOD-T50"],
  summary: ["해안도로 통행 불가 · 지하차도 진입부 유입", "확대 정지 · 저지대 건물 노출"],
  road: ["통행 불가", "통행 불가"], underpass: ["유입 시작", "부분 중단"],
}, t("17:52"), { kind: "중요시설", id: SUBJECTS.underpass, label: "신포 지하차도", arrivalAt: t("18:20"), exposure: "부분 중단" }, { at: t("18:05") });

/* ── 상황 조건 — 강우 예보 +20% (예보 상위 시나리오 · 사전 계산) ─────────────────────
 * 대응이 아니라 "예보가 틀려 비가 더 오면"이다. 진행 중 사건에서 전망의 불확실성을 보는 자리다(2026-09-16 사용자 "사전계산으로 넣고 싶어").
 * 침수가 5분 일찍 시작되고 만조와 겹치는 18:30 에 가장 크게 벌어진다. 자유 입력은 없다 — 예보 제공자가 준 시나리오 한 벌이다.
 * ───────────────────────────────────────────────────────────────────────── */
export const WHATIF_RAIN120_ID = "FC-WI-SH-RAIN120";
export const WHATIF_RAIN120: Forecast = {
  forecastId: WHATIF_RAIN120_ID, incidentId: INCIDENT_ID, alternativeId: "situation",
  changedConditions: ["강우 예보 +20% · 19시 최대 21.4 mm/h (상위 시나리오)"],
  hypothesis: "강우가 예보보다 20% 강하게 오는 경우",
  marks: (() => {
    const scene = floodSceneAt(P2, [["물고임", "정상"], ["차로 침수 · 서행", "정상"], ["통행 불가", "부분 중단"], ["통행 불가", "중단"]]);
    return [
      { validAt: t("17:20"), maxDepthM: 0.07, extentGeometryId: "GEO-FLOOD-T10", impactSummary: "해안도로 저지대 물고임 시작", scene: scene("GEO-FLOOD-T10", 0) },
      { validAt: t("17:40"), maxDepthM: 0.24, extentGeometryId: "GEO-FLOOD-ACT", impactSummary: "해안도로 차로 침수 · 서행", scene: scene("GEO-FLOOD-ACT", 1) },
      { validAt: t("18:00"), maxDepthM: 0.4, extentGeometryId: "GEO-FLOOD-T50", impactSummary: "해안도로 통행 불가 · 지하차도 부분 중단", scene: scene("GEO-FLOOD-T50", 2) },
      { validAt: t("18:30"), maxDepthM: 0.52, extentGeometryId: "GEO-FLOOD-T80", impactSummary: "저지대 건물 침수 노출 · 지하차도 중단", scene: scene("GEO-FLOOD-T80", 3) },
    ];
  })(),
  arrivalAt: t("17:47"),
  targets: [
    { kind: "도로", id: SUBJECTS.coastRoad, label: "해안도로 저지대 구간", arrivalAt: t("17:47"), exposure: "노출" },
    { kind: "중요시설", id: SUBJECTS.underpass, label: "신포 지하차도", arrivalAt: t("18:10"), exposure: "중단" },
    { kind: "건물", id: "BLD-SH-LOW", label: "저지대 건물", arrivalAt: t("17:58"), exposure: "노출" },
  ],
  basis: basis({ assumptions: ["강우 예보 +20% (예보 상위 시나리오)", "조위 예보 · 펌프 가용 2/3 유지"] }),
  availability: "가용", sourceEventId: "EV-E8-01", validUntil: t("18:40"),
  conditions: floodConditions("24 mm/h 매우 강함 · 19시 최대 21.4", "18:24 · 176 cm", "2호기 정지 · 가용 2/3"),
  conditionMarkers: TIDE_MARKER,
};

/* ── 상황과 대응을 함께 — 비가 예보보다 더 오면 지금 대응으로 버티나 (2026-09-16 사용자 "같이 선택할 수 있어야") ─────────
 * 강우 +20% 판 위에 대응 선택지를 얹은 사전 계산 판이다. 편집 규칙 둘:
 *   배수(현상 대응)   침수심 = 강우 판 + (배수 판 − 기준 예측). 범위는 그 깊이의 구운 단계, 영향 건물·도달은 차이만큼 옮긴다
 *   도로 통제         강우 판 그대로에 통제 시각만 바꿔 같은 노출 규칙 — 침수가 17:47 로 당겨져 "10분 뒤"도 3분 늦는다
 * 실개발은 조합마다 같은 조건의 ModelRun 으로 교체한다.
 * ───────────────────────────────────────────────────────────────────────── */
const RAIN_UNDERPASS: UnderpassState[] = ["정상", "정상", "부분 중단", "중단"];
const RAIN_ROAD: RoadStateStep[] = ["물고임", "차로 침수 · 서행", "통행 불가", "통행 불가"];
const RAIN_LINE = "강우 예보 +20% (예보 상위 시나리오)";
const rainRoad = (key: string, at: string, when: string): Forecast => {
  const steps = WHATIF_RAIN120.marks.map((m, i): [RoadStateStep, UnderpassState] => [m.validAt >= at ? "통제됨" : RAIN_ROAD[i], RAIN_UNDERPASS[i]]);
  const scene = floodSceneAt(P2, steps);
  return {
    ...WHATIF_RAIN120, forecastId: `FC-WI-SH-RAIN120-${key}`, alternativeId: "road-control",
    changedConditions: [...WHATIF_RAIN120.changedConditions, `해안도로 저지대 구간 통제 · ${at.slice(11, 16)} (${when})`],
    hypothesis: `강우가 예보보다 20% 강할 때 해안도로를 ${at.slice(11, 16)} 에 통제하는 경우`,
    marks: WHATIF_RAIN120.marks.map((m, i) => ({ ...m, scene: scene(m.extentGeometryId, i) })),
    targets: [
      { kind: "도로", id: SUBJECTS.coastRoad, label: "해안도로 저지대 구간", arrivalAt: t("17:47"), exposure: "통제됨" },
      { kind: "중요시설", id: SUBJECTS.underpass, label: "신포 지하차도", arrivalAt: t("18:10"), exposure: "중단" },
      { kind: "건물", id: "BLD-SH-LOW", label: "저지대 건물", arrivalAt: t("17:58"), exposure: "노출" },
    ],
    basis: basis({ assumptions: [RAIN_LINE, "침수면은 강우 판과 동일", `통제 완료 ${at.slice(11, 16)} 가정`] }),
    actionAt: { label: "통제 시점", at },
  };
};
/** 깊이 → 구운 침수 단계 */
const extentOf = (d: number) => (d < 0.1 ? "GEO-FLOOD-T10" : d < 0.22 ? "GEO-FLOOD-T30" : d < 0.29 ? "GEO-FLOOD-ACT" : d < 0.405 ? "GEO-FLOOD-T50" : "GEO-FLOOD-T80");
const plusMin = (iso: string, m: number) => {
  const [h, mi] = iso.slice(11, 16).split(":").map(Number);
  const tot = h * 60 + mi + m;
  return t(`${String(Math.floor(tot / 60)).padStart(2, "0")}:${String(tot % 60).padStart(2, "0")}`);
};
const minutes = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000);
const rainDrain = (key: string, drain: Forecast, when: string): Forecast => {
  const depth = WHATIF_RAIN120.marks.map((m, i) => Number(Math.max(0.05, m.maxDepthM + drain.marks[i].maxDepthM - FORECAST_BASE.marks[i].maxDepthM).toFixed(2)));
  const road = (d: number): RoadStateStep => (d >= 0.3 ? "통행 불가" : d >= 0.2 ? "차로 침수 · 서행" : "물고임");
  const underpass = (d: number): UnderpassState => (d >= 0.42 ? "중단" : d >= 0.33 ? "부분 중단" : d >= 0.3 ? "유입 시작" : "정상");
  const steps = depth.map((d, i): [RoadStateStep, UnderpassState] => (i < 2 ? [RAIN_ROAD[i], RAIN_UNDERPASS[i]] : [road(d), underpass(d)]));
  const scene = floodSceneAt(P3, steps);
  const arrival = plusMin(t("17:47"), minutes(FORECAST_BASE.arrivalAt, drain.arrivalAt));
  const worst = steps[3][1];
  const at = drain.actionAt!.at;
  return {
    ...WHATIF_RAIN120, forecastId: `FC-WI-SH-RAIN120-${key}`, alternativeId: "drainage",
    changedConditions: [...WHATIF_RAIN120.changedConditions, `펌프 2호기 재가동 · ${at.slice(11, 16)} (${when})`],
    hypothesis: `강우가 예보보다 20% 강할 때 펌프 2호기를 ${at.slice(11, 16)} 에 재가동하는 경우`,
    marks: WHATIF_RAIN120.marks.map((m, i) => (i < 2 ? { ...m, scene: scene(m.extentGeometryId, i) } : {
      validAt: m.validAt, maxDepthM: depth[i], extentGeometryId: extentOf(depth[i]),
      impactSummary: `${steps[i][0] === "통행 불가" ? "해안도로 통행 불가" : "해안도로 서행"} · 지하차도 ${steps[i][1]}${i === 3 ? " · 저지대 건물 침수 노출" : ""}`,
      scene: scene(extentOf(depth[i]), i),
    })),
    arrivalAt: arrival,
    targets: [
      { kind: "도로", id: SUBJECTS.coastRoad, label: "해안도로 저지대 구간", arrivalAt: arrival, exposure: "노출" },
      { kind: "중요시설", id: SUBJECTS.underpass, label: "신포 지하차도", ...(worst === "정상" ? {} : { arrivalAt: t("18:15") }), exposure: worst === "정상" ? "영향 없음" : worst === "유입 시작" ? "노출" : worst === "통제됨" ? "통제됨" : worst },
      { kind: "건물", id: "BLD-SH-LOW", label: "저지대 건물", arrivalAt: t("18:00"), exposure: "노출" },
    ],
    basis: basis({ assumptions: [RAIN_LINE, `펌프 2호기 ${at.slice(11, 16)} 재가동 가정`, "조합 판 = 강우 판 + (배수 판 − 기준 예측)"] }),
    conditions: floodConditions("24 mm/h 매우 강함 · 19시 최대 21.4", "18:24 · 176 cm", "2호기 재가동 · 3/3"),
    actionAt: { label: "재가동 시점", at },
  };
};
export const RAIN120_COMBOS: { presetId: string; responseId: "drainage" | "road-control"; forecast: Forecast }[] = [
  { presetId: "now", responseId: "road-control", forecast: rainRoad("ROAD-NOW", t("17:40"), "즉시") },
  { presetId: "d10", responseId: "road-control", forecast: rainRoad("ROAD-D10", t("17:50"), "10분 뒤") },
  { presetId: "d20", responseId: "road-control", forecast: rainRoad("ROAD-D20", t("18:00"), "20분 뒤") },
  { presetId: "now", responseId: "drainage", forecast: rainDrain("DRAIN-NOW", WHATIF_DRAIN_NOW, "즉시") },
  { presetId: "d10", responseId: "drainage", forecast: rainDrain("DRAIN-D10", WHATIF_DRAIN_D10, "10분 뒤") },
  { presetId: "d20", responseId: "drainage", forecast: rainDrain("DRAIN-D20", WHATIF_DRAIN_D20, "20분 뒤") },
];

export const WHATIF_FORECASTS: Forecast[] = [WHATIF_ROAD_NOW, WHATIF_ROAD_D10, WHATIF_ROAD_D20, WHATIF_DRAIN_NOW, WHATIF_DRAIN_D10, WHATIF_DRAIN_D20, WHATIF_RAIN120, ...RAIN120_COMBOS.map((c) => c.forecast)];

/* ── 관측 재현 — 지금 이전 구간의 지도 (03 §26 · 2026-09-16 "기록 구간에는 확인된 것만") ─────────────
 * 사건이 진행되는 동안 지금 이전은 예측판이 아니라 기록이다. 17:13 예측판의 17:20 눈금을 지난 구간에 그리면 예측이 기록으로 둔갑한다.
 * 도로수위(17:36 12 cm · 17:44 17 cm) · 영상 판독(17:24 차로 일부 침수 추정) · 현장 보고 · 조치 기록을 넣어 다시 그린 범위다.
 * 최대 0.27 m 는 기록·검증의 실측 범위(GEO-FLOOD-ACT)와 같다. 15분 간격이고 지금 이전 눈금만 화면에 선다.
 * ───────────────────────────────────────────────────────────────────────── */
export const FORECAST_SH_RECORD_ID = "FC-SH-RECORD";
const recordMark = (hhmm: string, depth: number, extent: string, summary: string, road: Parameters<typeof floodScene>[0]["road"], underpass: Parameters<typeof floodScene>[0]["underpass"], pump: Parameters<typeof floodScene>[0]["pump"]) => ({
  validAt: t(hhmm), maxDepthM: depth, extentGeometryId: extent, impactSummary: summary,
  scene: floodScene({ road, underpass, pump, retention: "여유 62 %", extent }),
});
export const FORECAST_SH_RECORD: Forecast = {
  forecastId: FORECAST_SH_RECORD_ID, incidentId: INCIDENT_ID, alternativeId: "baseline", changedConditions: [],
  marks: [
    recordMark("17:00", 0, "", "침수 없음 · 관로수위 상승", "통행 가능", "정상", "2호기 정지 · 가용 2/3"),
    recordMark("17:15", 0, "", "침수 없음 · 펌프 2호기 정지", "통행 가능", "정상", "2호기 정지 · 가용 2/3"),
    recordMark("17:30", 0.06, "GEO-FLOOD-T10", "해안도로 저지대 물고임 (영상 판독 17:24)", "물고임", "정상", "2호기 정지 · 가용 2/3"),
    recordMark("17:45", 0.14, "GEO-FLOOD-DRAIN-T50", "도로수위 17 cm · 차로 일부 침수", "차로 침수 · 서행", "정상", "2호기 정지 · 가용 2/3"),
    recordMark("18:00", 0.22, "GEO-FLOOD-DRAIN-T80", "해안도로 통행 불가 · 지하차도 진입부 유입", "통행 불가", "유입 시작", "2호기 정지 · 가용 2/3"),
    recordMark("18:15", 0.27, "GEO-FLOOD-ACT", "해안도로 통제 · 지하차도 진입 통제 · 실측 최대 0.27 m", "통제됨", "통제됨", "2호기 정지 · 가용 2/3"),
    recordMark("18:30", 0.26, "GEO-FLOOD-ACT", "만조 · 침수 정체", "통제됨", "통제됨", "2호기 정지 · 가용 2/3"),
    recordMark("18:45", 0.23, "GEO-FLOOD-DRAIN-T80", "펌프 2호기 재가동 · 물 빠지기 시작", "통제됨", "통제됨", "2호기 재가동 · 3/3"),
  ],
  arrivalAt: t("17:52"),
  targets: [
    { kind: "도로", id: SUBJECTS.coastRoad, label: "해안도로 저지대 구간", arrivalAt: t("17:52"), exposure: "통제됨" },
    { kind: "중요시설", id: SUBJECTS.underpass, label: "신포 지하차도", arrivalAt: t("18:00"), exposure: "통제됨" },
  ],
  basis: basis({
    modelName: "관측 재현 (도로수위 · 영상 판독 · 현장 보고)", baseTime: t("17:00"), generatedAt: t("18:45"),
    assumptions: ["관측 입력으로 다시 그린 범위", "지금 이전 구간만 화면에 선다"],
    uncertainty: { grade: "낮음", sensitiveTo: ["도로수위계 한 점의 대표성"], unusableRanges: [] },
    inputQuality: "정상",
  }),
  availability: "가용", validUntil: t("18:45"),
  conditions: COND_BASE,
};

/** 18:10 갱신판 — 실측 반영. 이후 첫 판은 `만료` */
export const FORECAST_BASE_2: Forecast = {
  forecastId: FORECAST_BASE_2_ID, incidentId: INCIDENT_ID, alternativeId: "baseline", changedConditions: [],
  marks: [
    { validAt: t("18:20"), maxDepthM: 0.27, extentGeometryId: "GEO-FLOOD-T50", impactSummary: "해안도로 통제 유지 · 수위 정체", scene: SCENE_BASE_2("GEO-FLOOD-T50", 0) },
    { validAt: t("18:50"), maxDepthM: 0.24, extentGeometryId: "GEO-FLOOD-T30", impactSummary: "만조 이후 배수 재개 · 침수 범위 축소", scene: SCENE_BASE_2("GEO-FLOOD-T30", 1) },
    { validAt: t("19:30"), maxDepthM: 0.17, extentGeometryId: "GEO-FLOOD-T30", impactSummary: "강우 정점 · 축소 정체", scene: SCENE_BASE_2("GEO-FLOOD-T30", 2) },
    { validAt: t("20:30"), maxDepthM: 0.06, extentGeometryId: "GEO-FLOOD-T10", impactSummary: "저지대 물 빠짐", scene: SCENE_BASE_2("GEO-FLOOD-T10", 3) },
  ],
  arrivalAt: t("17:52"),
  targets: [
    { kind: "도로", id: SUBJECTS.coastRoad, label: "해안도로 저지대 구간", exposure: "통제됨" },
    { kind: "중요시설", id: SUBJECTS.underpass, label: "신포 지하차도", exposure: "통제됨" },
  ],
  basis: basis({ baseTime: t("18:00"), generatedAt: t("18:10"), observedFrom: t("17:00"), inputs: [{ label: "강우 관측", at: t("18:09"), kind: "관측" }, { label: "도로 수위", at: t("18:08"), kind: "관측" }, { label: "조위 관측", at: t("18:05"), kind: "관측" }, { label: "펌프·저류 상태", at: t("18:09"), kind: "시설" }], inputEventIds: ["EV-E1-01", "EV-E3B-05", "EV-E4A-12", "EV-E5A-10", "EV-E6A-01", "EV-E9-01"], assumptions: ["도로 통제 유지", "펌프 가용 2/3 유지"], uncertainty: { grade: "보통", sensitiveTo: ["19시 전후 강우강도"], unusableRanges: ["21:00 이후"] }, inputQuality: "정상" }),
  availability: "가용", sourceEventId: "EV-E8-02", validUntil: t("21:00"),
  conditions: floodConditions("19시 최대 17.8 mm/h · 이후 약화", "18:24 지남 · 배수 재개", "2호기 정지 · 가용 2/3"),
  conditionMarkers: TIDE_MARKER,
};

export const FORECASTS: Forecast[] = [FORECAST_BASE, FORECAST_DRAIN, FORECAST_ROAD, FORECAST_BASE_2];

function forecastEvent(args: { id: string; observedAt: string; forecastIds: string[]; supersedes?: string; summary: string; baseTime: string; derivedFrom: string[] }): EventEnvelope {
  return {
    eventId: args.id, sourceSystem: "계산 제공 주체 확인 전" /* TODO(정본 02 E8): 계산 제공 주체 확정 시 출처기관 이름으로 교체 */, eventType: "FORECAST_UPDATED", eventClass: "분석", producerRole: "모델",
    subjectId: DRAINAGE_BASIN_ID, observedAt: args.observedAt, receivedAt: args.observedAt, validFrom: args.observedAt,
    validTo: FORECASTS.find((f) => f.forecastId === args.forecastIds[0])?.validUntil,
    location: { ...SUBJECT_LOCATION[SUBJECTS.forecastGrid], affectedGeometryId: "GEO-BASIN-SH-01", label: "서항 검증 배수권역" },
    quality: "정상", sourceReadiness: "협의 필요", dataOrigin: "합성 데이터", calculationActor: "해당 없음",
    payload: { forecastBaseTime: args.baseTime, forecastIds: args.forecastIds }, schemaVersion: "ndms.event/0.1",
    correlationKeys: [DRAINAGE_BASIN_ID], supersedes: args.supersedes, incidentId: INCIDENT_ID, derivedFrom: args.derivedFrom, ingestionMode: "모의",
    scenario: { scenarioRuleId: SCENARIO_RULE.id, scenarioRuleVersion: SCENARIO_RULE.version, generatedAt: FIXTURE_GENERATED_AT, scenarioTime: args.observedAt },
    demoRef: "E8", summary: args.summary,
  };
}

export const E8_FORECAST_1 = forecastEvent({ id: "EV-E8-01", observedAt: t("17:13"), baseTime: BASE_TIME, forecastIds: [FORECAST_BASE_ID, FORECAST_DRAIN_ID, FORECAST_ROAD_ID], derivedFrom: FORECAST_BASE.basis.inputEventIds, summary: "침수예측판 생성 · 18:00 최대 0.32 m · 해안도로 17:52 도달 예상" });
export const E8_FORECAST_2 = forecastEvent({ id: "EV-E8-02", observedAt: t("18:10"), baseTime: t("18:00"), forecastIds: [FORECAST_BASE_2_ID], supersedes: "EV-E8-01", derivedFrom: FORECAST_BASE_2.basis.inputEventIds, summary: "침수예측판 갱신 · 만조 이후 축소 예측 · 20:30 물 빠짐" });

export const FORECAST_EVENTS: EventEnvelope[] = [E8_FORECAST_1, E8_FORECAST_2];
