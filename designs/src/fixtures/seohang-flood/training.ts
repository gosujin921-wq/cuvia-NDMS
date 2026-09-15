/* ─────────────────────────────────────────────
 * 사전 조건 세트 — 대응 모의훈련이 사건 없이 여는 조건 조합과 그 예측판 (IA-T01 사전 조건분석 · IA §13.1)
 *
 * 조건 축은 둘이다. 강우 강도(보통·강함·매우 강함) × 만조 겹침(겹침·없음) = 여섯 조합.
 * 넷은 예측판이 준비돼 있고 둘은 비어 있다 — 비는 자리를 채우려고 값을 만들지 않는다. 실개발에서는
 * 그 자리가 같은 조건의 ModelRun 요청이 된다(02 §5.4 P0).
 *
 * ★ 여기 예측판은 대표 사건의 E8 결과 세트와 같은 문법의 **시나리오 결과 세트**다(시나리오 편집값 · 02 §5.5).
 *   정확도를 주장하지 않는다. 대표 조건(강함·겹침)은 실제 사건의 예측판 3벌을 그대로 쓴다.
 * ★ 기준시각은 사건 시나리오 기준시각 17:00 이고 눈금은 +20·+40·+60·+90 분이다. 훈련은 상대시간으로 읽는다.
 * ───────────────────────────────────────────── */

import type { Forecast, ForecastBasis, ForecastMark, ImpactTarget } from "../../model/forecast";
import type { TrainingConditionSet } from "../../model/training";
import { SUBJECTS } from "./subjects";
import { INCIDENT_ID, t } from "./incident";
import { FORECAST_BASE_ID, FORECAST_DRAIN_ID, FORECAST_ROAD_ID } from "./forecasts";
import { floodConditions, floodSceneAt, type PumpState, type RetentionState, type RoadState, type UnderpassState } from "./scene";
import type { SceneLayer } from "../../model/scene";

const BASE = t("17:00");
const VALID_UNTIL = t("18:40");
const AT = { m20: t("17:20"), m40: t("17:40"), m60: t("18:00"), m90: t("18:30") };

const basis = (assumptions: string[], overrides: Partial<ForecastBasis> = {}): ForecastBasis => ({
  modelName: "시나리오 침수 결과 세트", modelVersion: "0.1", baseTime: BASE, generatedAt: BASE,
  inputEventIds: [], assumptions,
  uncertainty: { grade: "높음", sensitiveTo: ["조건이 실측이 아닌 설정값"], unusableRanges: ["+90분 이후"] },
  inputQuality: "보정", calculationActor: "해당 없음",
  replacementNote: "모델 연계 시 같은 조건의 ModelRun 결과로 교체",
  ...overrides,
});

const marks = (depths: [number, number, number, number], geos: [string, string, string, string], notes: [string, string, string, string], sceneAt?: (extent: string, i: number) => SceneLayer[]): ForecastMark[] =>
  ([AT.m20, AT.m40, AT.m60, AT.m90] as const).map((validAt, i) => ({ validAt, maxDepthM: depths[i], extentGeometryId: geos[i], impactSummary: notes[i], ...(sceneAt ? { scene: sceneAt(geos[i], i) } : {}) }));
/** 장면 층 — 펌프·저류는 예측판 공통, 도로·지하차도는 눈금마다. 도로 상태는 그 눈금의 침수면에 닿는 구간에만 선다 (scene.ts) */
const scenes = (pump: PumpState, retention: RetentionState, steps: [RoadState, UnderpassState][]) => floodSceneAt({ pump, retention }, steps);
const TIDE_ON = "18:24 · 176 cm";
const TIDE_OFF = "없음 · 자연배수 가능";

const road = (exposure: ImpactTarget["exposure"], arrivalAt?: string): ImpactTarget => ({ kind: "도로", id: SUBJECTS.coastRoad, label: "해안도로 저지대 구간", arrivalAt, exposure });
const underpass = (exposure: ImpactTarget["exposure"], arrivalAt?: string): ImpactTarget => ({ kind: "중요시설", id: SUBJECTS.underpass, label: "신포 지하차도", arrivalAt, exposure });
const buildings = (label: string, exposure: ImpactTarget["exposure"], arrivalAt?: string): ImpactTarget => ({ kind: "건물", id: "BLD-SH-LOW", label, arrivalAt, exposure });
const people = (exposure: ImpactTarget["exposure"], arrivalAt?: string): ImpactTarget => ({ kind: "대상자", id: "POP-SH-COAST", label: "해안도로 보행·차량 이용자", arrivalAt, exposure });

/* ── 보통 · 만조 겹침 ── */
const R1T1_BASE: Forecast = {
  forecastId: "FC-COND-R1T1-BASE", incidentId: INCIDENT_ID, alternativeId: "baseline", changedConditions: [],
  marks: marks([0.03, 0.09, 0.14, 0.18], ["GEO-FLOOD-T10", "GEO-FLOOD-T10", "GEO-FLOOD-T30", "GEO-FLOOD-T30"], ["해안도로 저지대 물고임", "물고임 확대 · 통행 가능", "차로 일부 침수 · 서행", "만조 정점 · 차로 침수 정체"], scenes("가용 3/3", "여유 62 %", [["물고임", "정상"], ["물고임", "정상"], ["차로 침수 · 서행", "정상"], ["차로 침수 · 서행", "정상"]])),
  arrivalAt: t("17:55"),
  targets: [road("노출", t("17:55")), underpass("영향 없음"), buildings("저지대 건물 4동", "노출", t("18:20")), people("노출", t("17:55"))],
  basis: basis(["강우 10 mm/h 지속", "만조 18:24 겹침 · 자연배수 제약", "펌프 가용 3/3"]),
  availability: "가용", validUntil: VALID_UNTIL,
  conditions: floodConditions("10 mm/h 보통", TIDE_ON, "가용 3/3"),
};
const R1T1_DRAIN: Forecast = {
  forecastId: "FC-COND-R1T1-DRAIN", incidentId: INCIDENT_ID, alternativeId: "drainage", changedConditions: ["저류시설 사전 방류 (16:30)"],
  deltaSummary: "최대 침수심 0.18 → 0.10 m · 차로 침수 없음",
  hypothesis: "저류시설을 16:30에 사전 방류한 경우",
  marks: marks([0.03, 0.07, 0.09, 0.10], ["GEO-FLOOD-T10", "GEO-FLOOD-T10", "GEO-FLOOD-T10", "GEO-FLOOD-T10"], ["해안도로 저지대 물고임", "물고임 유지", "물고임 유지 · 통행 가능", "만조 정점 · 확대 없음"], scenes("가용 3/3", "여유 90 % · 사전 방류", [["물고임", "정상"], ["물고임", "정상"], ["물고임", "정상"], ["물고임", "정상"]])),
  arrivalAt: t("18:40"),
  targets: [road("영향 없음"), underpass("영향 없음"), buildings("저지대 건물 4동", "영향 없음"), people("영향 없음")],
  basis: basis(["강우 10 mm/h 지속", "만조 18:24 겹침", "저류시설 사전 방류로 여유 90 %"]),
  availability: "가용", validUntil: VALID_UNTIL,
  conditions: floodConditions("10 mm/h 보통", TIDE_ON, "가용 3/3"),
};

/* ── 매우 강함 · 만조 겹침 ── */
const R3T1_BASE: Forecast = {
  forecastId: "FC-COND-R3T1-BASE", incidentId: INCIDENT_ID, alternativeId: "baseline", changedConditions: [],
  marks: marks([0.08, 0.28, 0.46, 0.58], ["GEO-FLOOD-T10", "GEO-FLOOD-T50", "GEO-FLOOD-T80", "GEO-FLOOD-T80"], ["해안도로 저지대 물고임 · 급확대", "해안도로 통행 불가 · 지하차도 유입 시작", "지하차도 중단 · 저지대 건물 12동 침수", "만조 정점 · 2층 이하 침수 노출 확대"], scenes("2호기 정지 · 가용 2/3", "여유 62 %", [["물고임", "정상"], ["통행 불가", "유입 시작"], ["통행 불가", "중단"], ["통행 불가", "중단"]])),
  arrivalAt: t("17:30"),
  targets: [road("노출", t("17:30")), underpass("중단", t("17:40")), buildings("저지대 건물 12동", "노출", t("17:50")), people("노출", t("17:30"))],
  basis: basis(["강우 35 mm/h 지속", "만조 18:24 겹침 · 자연배수 제약", "펌프 가용 2/3"]),
  availability: "가용", validUntil: VALID_UNTIL,
  conditions: floodConditions("35 mm/h 매우 강함", TIDE_ON, "2호기 정지 · 가용 2/3"),
};
const R3T1_DRAIN: Forecast = {
  forecastId: "FC-COND-R3T1-DRAIN", incidentId: INCIDENT_ID, alternativeId: "drainage", changedConditions: ["펌프 3/3 가동", "저류시설 사전 방류"],
  deltaSummary: "최대 침수심 0.58 → 0.36 m · 지하차도 유입 40분 지연",
  hypothesis: "펌프 3대를 가동하고 저류시설을 사전 방류한 경우",
  marks: marks([0.08, 0.22, 0.31, 0.36], ["GEO-FLOOD-T10", "GEO-FLOOD-T30", "GEO-FLOOD-DRAIN-T50", "GEO-FLOOD-DRAIN-T80"], ["해안도로 저지대 물고임", "해안도로 차로 침수", "해안도로 통행 불가 · 지하차도 유입 시작", "저지대 건물 6동 침수 노출"], scenes("2호기 재가동 · 3/3", "여유 90 % · 사전 방류", [["물고임", "정상"], ["차로 침수 · 서행", "정상"], ["통행 불가", "유입 시작"], ["통행 불가", "부분 중단"]])),
  arrivalAt: t("17:35"),
  targets: [road("노출", t("17:35")), underpass("부분 중단", t("18:20")), buildings("저지대 건물 6동", "노출", t("18:25")), people("노출", t("17:35"))],
  basis: basis(["강우 35 mm/h 지속", "만조 18:24 겹침", "펌프 3/3 가동 · 저류 여유 90 %"]),
  availability: "가용", validUntil: VALID_UNTIL,
  conditions: floodConditions("35 mm/h 매우 강함", TIDE_ON, "2호기 재가동 · 3/3"),
};
const R3T1_ROAD: Forecast = {
  forecastId: "FC-COND-R3T1-ROAD", incidentId: INCIDENT_ID, alternativeId: "road-control", changedConditions: ["해안도로·지하차도 선제 통제 (17:10)"],
  deltaSummary: "침수 영향 동일 · 이용자 노출 감소 · 건물 대피 안내 선행",
  hypothesis: "해안도로와 지하차도를 17:10부터 통제하는 경우",
  marks: R3T1_BASE.marks.map((m, i) => ({ ...m, scene: scenes("2호기 정지 · 가용 2/3", "여유 62 %", [["통제됨", "통제됨"], ["통제됨", "통제됨"], ["통제됨", "통제됨"], ["통제됨", "통제됨"]])(m.extentGeometryId, i) })), arrivalAt: t("17:30"),
  targets: [road("통제됨", t("17:30")), underpass("통제됨", t("17:40")), buildings("저지대 건물 12동", "노출", t("17:50")), people("통제됨")],
  basis: basis(["강우 35 mm/h 지속", "만조 18:24 겹침", "통제 완료 17:10 가정"]),
  availability: "가용", validUntil: VALID_UNTIL,
  conditions: floodConditions("35 mm/h 매우 강함", TIDE_ON, "2호기 정지 · 가용 2/3"),
  actionAt: { label: "통제 시점", at: t("17:10") },
};

/* ── 강함 · 만조 없음 ── */
const R2T0_BASE: Forecast = {
  forecastId: "FC-COND-R2T0-BASE", incidentId: INCIDENT_ID, alternativeId: "baseline", changedConditions: [],
  marks: marks([0.04, 0.11, 0.16, 0.14], ["GEO-FLOOD-T10", "GEO-FLOOD-T10", "GEO-FLOOD-T30", "GEO-FLOOD-T30"], ["해안도로 저지대 물고임", "물고임 확대", "차로 일부 침수 · 서행", "자연배수 · 축소 시작"], scenes("2호기 정지 · 가용 2/3", "여유 62 %", [["물고임", "정상"], ["물고임", "정상"], ["차로 침수 · 서행", "정상"], ["물고임", "정상"]])),
  arrivalAt: t("17:55"),
  targets: [road("노출", t("17:55")), underpass("영향 없음"), buildings("저지대 건물 4동", "노출", t("18:05")), people("노출", t("17:55"))],
  basis: basis(["강우 20 mm/h 지속", "만조 없음 · 자연배수 가능", "펌프 가용 2/3"]),
  availability: "가용", validUntil: VALID_UNTIL,
  conditions: floodConditions("20 mm/h 강함", TIDE_OFF, "2호기 정지 · 가용 2/3"),
};
const R2T0_DRAIN: Forecast = {
  forecastId: "FC-COND-R2T0-DRAIN", incidentId: INCIDENT_ID, alternativeId: "drainage", changedConditions: ["펌프 3/3 가동"],
  deltaSummary: "최대 침수심 0.16 → 0.09 m · 차로 침수 없음",
  hypothesis: "펌프 3대를 가동한 경우",
  marks: marks([0.04, 0.08, 0.09, 0.07], ["GEO-FLOOD-T10", "GEO-FLOOD-T10", "GEO-FLOOD-T10", "GEO-FLOOD-T10"], ["해안도로 저지대 물고임", "물고임 유지", "물고임 유지 · 통행 가능", "물 빠짐 시작"], scenes("2호기 재가동 · 3/3", "여유 62 %", [["물고임", "정상"], ["물고임", "정상"], ["물고임", "정상"], ["통행 가능", "정상"]])),
  arrivalAt: t("18:40"),
  targets: [road("영향 없음"), underpass("영향 없음"), buildings("저지대 건물 4동", "영향 없음"), people("영향 없음")],
  basis: basis(["강우 20 mm/h 지속", "만조 없음", "펌프 3/3 가동"]),
  availability: "가용", validUntil: VALID_UNTIL,
  conditions: floodConditions("20 mm/h 강함", TIDE_OFF, "2호기 재가동 · 3/3"),
};

export const CONDITION_FORECASTS: Forecast[] = [R1T1_BASE, R1T1_DRAIN, R3T1_BASE, R3T1_DRAIN, R3T1_ROAD, R2T0_BASE, R2T0_DRAIN];

const RAIN = {
  R1: { key: "rain", label: "강우 강도", value: "보통", note: "10 mm/h" },
  R2: { key: "rain", label: "강우 강도", value: "강함", note: "20 mm/h" },
  R3: { key: "rain", label: "강우 강도", value: "매우 강함", note: "35 mm/h" },
} as const;
const TIDE = {
  T1: { key: "tide", label: "만조", value: "겹침", note: "18:24 만조" },
  T0: { key: "tide", label: "만조", value: "없음", note: "자연배수 가능" },
} as const;

const OBJECTIVES = ["조건별 도달 시간과 영향 범위 비교", "배수·통제 대안의 효과 확인", "통제 시작 시각 결정"];
const CHANGEABLE = ["펌프 가용성", "저류시설 방류", "통제 시작 시각"];

const set = (setId: string, rain: typeof RAIN[keyof typeof RAIN], tide: typeof TIDE[keyof typeof TIDE], base: string | null, alts: string[], unavailableReason?: string): TrainingConditionSet => ({
  setId, twinFamily: "A", regionId: "seohang", label: `강우 ${rain.value} · 만조 ${tide.value}`, incidentId: INCIDENT_ID,
  params: [rain, tide], baselineForecastId: base, alternativeForecastIds: alts,
  objectives: OBJECTIVES, goal: "해안도로 통제 시점을 결정하세요", changeableConditions: CHANGEABLE, unavailableReason,
});

/** 조건 조합 여섯 — 축 순서(강우 → 만조)대로. 첫 항목이 메뉴 진입 기본값(대표 사건 조건) */
export const TRAINING_CONDITION_SETS: TrainingConditionSet[] = [
  set("R2T1", RAIN.R2, TIDE.T1, FORECAST_BASE_ID, [FORECAST_DRAIN_ID, FORECAST_ROAD_ID]),
  set("R1T1", RAIN.R1, TIDE.T1, R1T1_BASE.forecastId, [R1T1_DRAIN.forecastId]),
  set("R3T1", RAIN.R3, TIDE.T1, R3T1_BASE.forecastId, [R3T1_DRAIN.forecastId, R3T1_ROAD.forecastId]),
  set("R2T0", RAIN.R2, TIDE.T0, R2T0_BASE.forecastId, [R2T0_DRAIN.forecastId]),
  set("R1T0", RAIN.R1, TIDE.T0, null, [], "보통 강우에 만조가 없으면 배수권역 침수 조건에 들지 않아 예측판을 두지 않았다 · 모델 연계 시 같은 조건으로 계산 요청"),
  set("R3T0", RAIN.R3, TIDE.T0, null, [], "이 조합의 예측판은 준비되지 않았다 · 모델 연계 시 같은 조건으로 계산 요청"),
];
