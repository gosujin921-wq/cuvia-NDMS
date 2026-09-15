/* ─────────────────────────────────────────────
 * E8 침수예측판 — FORECAST_UPDATED 이벤트와 Forecast 결과 객체
 * 정본: 02 §5.4 E8 · §5.5 · D4~D5, 03 §6, IA §8
 *
 * 검증된 도시침수 모델 결과는 미확보다. 여기 Forecast 는 E0~E6 과 방향이 맞는 **시나리오 결과 세트**이고
 * 정확도를 주장하지 않는다. 대안 규칙(02 §5.5): 배수 대응은 개선 방향의 사전 작성 결과, 도로 통제는
 * 침수면 동일·노출 대상만 다름. 눈금은 17:10 기준 +10·+30·+50·+80 분 — "18:00 전망"이 눈금값이 되게.
 * ───────────────────────────────────────────── */

import type { EventEnvelope } from "../../model/event";
import type { Forecast, ForecastBasis, ImpactTarget } from "../../model/forecast";
import { DRAINAGE_BASIN_ID, SUBJECTS, SUBJECT_LOCATION } from "./subjects";
import { FIXTURE_GENERATED_AT, INCIDENT_ID, SCENARIO_RULE, t } from "./incident";

export const FORECAST_BASE_ID = "FC-SH-20240921-1710-BASE";
export const FORECAST_DRAIN_ID = "FC-SH-20240921-1710-DRAIN";
export const FORECAST_ROAD_ID = "FC-SH-20240921-1710-ROAD";
export const FORECAST_BASE_2_ID = "FC-SH-20240921-1810-BASE";

import { floodConditions, floodSceneAt } from "./scene";

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

const basis = (overrides: Partial<ForecastBasis> = {}): ForecastBasis => ({
  modelName: "시나리오 침수 결과 세트", modelVersion: "0.1", baseTime: BASE_TIME, generatedAt: t("17:13"),
  inputEventIds: ["EV-E1-01", "EV-E3A-01", "EV-E4A-06", "EV-E4B-01", "EV-E6A-01", "EV-E6B-01"],
  assumptions: ["현재 강우·조위 전망 유지", "펌프 가용 2/3 유지", "저류 여유 62 % 유지"],
  uncertainty: { grade: "보통", sensitiveTo: ["19시 전후 강우강도", "만조 시각의 자연배수 제약"], unusableRanges: ["18:40 이후 (다음 갱신판 필요)"] },
  inputQuality: "지연", calculationActor: "해당 없음",
  replacementNote: "검증된 도시침수 모델 결과 확보 시 ModelRun 결과로 교체 (02 §5.4 P0)",
  ...overrides,
});

const targetsBase: ImpactTarget[] = [
  { kind: "도로", id: SUBJECTS.coastRoad, label: "해안도로 저지대 구간", arrivalAt: t("17:52"), exposure: "노출" },
  { kind: "중요시설", id: SUBJECTS.underpass, label: "신포 지하차도", arrivalAt: t("18:20"), exposure: "부분 중단" },
  { kind: "건물", id: "BLD-SH-LOW", label: "저지대 건물 12동", arrivalAt: t("18:05"), exposure: "노출" },
  { kind: "대상자", id: "POP-SH-COAST", label: "해안도로 보행·차량 이용자", arrivalAt: t("17:52"), exposure: "노출" },
];

export const FORECAST_BASE: Forecast = {
  forecastId: FORECAST_BASE_ID, incidentId: INCIDENT_ID, alternativeId: "baseline", changedConditions: [],
  marks: [
    { validAt: t("17:20"), maxDepthM: 0.05, extentGeometryId: "GEO-FLOOD-T10", impactSummary: "해안도로 저지대 물고임 시작", scene: SCENE_BASE("GEO-FLOOD-T10", 0) },
    { validAt: t("17:40"), maxDepthM: 0.18, extentGeometryId: "GEO-FLOOD-T30", impactSummary: "해안도로 물고임 확대 · 서행", scene: SCENE_BASE("GEO-FLOOD-T30", 1) },
    { validAt: t("18:00"), maxDepthM: 0.32, extentGeometryId: "GEO-FLOOD-T50", impactSummary: "해안도로 통행 불가 · 지하차도 진입부 유입", scene: SCENE_BASE("GEO-FLOOD-T50", 2) },
    { validAt: t("18:30"), maxDepthM: 0.41, extentGeometryId: "GEO-FLOOD-T80", impactSummary: "저지대 건물 12동 침수 노출 · 지하차도 부분 중단", scene: SCENE_BASE("GEO-FLOOD-T80", 3) },
  ],
  arrivalAt: t("17:52"), targets: targetsBase, basis: basis(), availability: "가용", sourceEventId: "EV-E8-01", validUntil: t("18:40"),
  conditions: COND_BASE,
};

export const FORECAST_DRAIN: Forecast = {
  forecastId: FORECAST_DRAIN_ID, incidentId: INCIDENT_ID, alternativeId: "drainage",
  changedConditions: ["펌프 2호기 재가동 (가용 3/3)", "저류시설 추가 유입"],
  deltaSummary: "최대 침수심 0.41 → 0.22 m · 지하차도 유입 없음 · 40분 빨리 빠짐",
  hypothesis: "펌프 2호기를 재가동하고 저류시설로 추가 유입하는 경우",
  marks: [
    { validAt: t("17:20"), maxDepthM: 0.05, extentGeometryId: "GEO-FLOOD-T10", impactSummary: "해안도로 저지대 물고임 시작", scene: SCENE_DRAIN("GEO-FLOOD-T10", 0) },
    { validAt: t("17:40"), maxDepthM: 0.14, extentGeometryId: "GEO-FLOOD-T30", impactSummary: "해안도로 물고임 확대 · 서행", scene: SCENE_DRAIN("GEO-FLOOD-T30", 1) },
    { validAt: t("18:00"), maxDepthM: 0.2, extentGeometryId: "GEO-FLOOD-DRAIN-T50", impactSummary: "해안도로 통행 지장 · 지하차도 유입 없음", scene: SCENE_DRAIN("GEO-FLOOD-DRAIN-T50", 2) },
    { validAt: t("18:30"), maxDepthM: 0.22, extentGeometryId: "GEO-FLOOD-DRAIN-T80", impactSummary: "침수 확대 정지 · 저지대 건물 노출 4동", scene: SCENE_DRAIN("GEO-FLOOD-DRAIN-T80", 3) },
  ],
  arrivalAt: t("17:55"),
  targets: [
    { kind: "도로", id: SUBJECTS.coastRoad, label: "해안도로 저지대 구간", arrivalAt: t("17:55"), exposure: "노출" },
    { kind: "중요시설", id: SUBJECTS.underpass, label: "신포 지하차도", exposure: "영향 없음" },
    { kind: "건물", id: "BLD-SH-LOW", label: "저지대 건물 4동", arrivalAt: t("18:20"), exposure: "노출" },
    { kind: "대상자", id: "POP-SH-COAST", label: "해안도로 보행·차량 이용자", arrivalAt: t("17:55"), exposure: "노출" },
  ],
  basis: basis({ assumptions: ["현재 강우·조위 전망 유지", "펌프 2호기 재가동 가정", "저류시설 추가 유입 가정"] }),
  availability: "가용", sourceEventId: "EV-E8-01", validUntil: t("18:40"),
  conditions: COND_DRAIN,
};

export const FORECAST_ROAD: Forecast = {
  forecastId: FORECAST_ROAD_ID, incidentId: INCIDENT_ID, alternativeId: "road-control",
  changedConditions: ["해안도로 저지대 구간 선제 통제 (17:50 이전)"],
  deltaSummary: "침수 영향 동일 · 도로 이용자 노출 감소 · 지하차도 진입 차단",
  hypothesis: "해안도로 저지대 구간을 17:50부터 통제하는 경우",
  marks: FORECAST_BASE.marks.map((m, i) => ({ ...m, scene: SCENE_ROAD(m.extentGeometryId, i) })), arrivalAt: t("17:52"),
  targets: [
    { kind: "도로", id: SUBJECTS.coastRoad, label: "해안도로 저지대 구간", arrivalAt: t("17:52"), exposure: "통제됨" },
    { kind: "중요시설", id: SUBJECTS.underpass, label: "신포 지하차도", arrivalAt: t("18:20"), exposure: "통제됨" },
    { kind: "건물", id: "BLD-SH-LOW", label: "저지대 건물 12동", arrivalAt: t("18:05"), exposure: "노출" },
    { kind: "대상자", id: "POP-SH-COAST", label: "해안도로 보행·차량 이용자", exposure: "통제됨" },
  ],
  basis: basis({ assumptions: ["침수면은 기준 전망과 동일", "통제 완료 시각 17:50 가정"] }),
  availability: "가용", sourceEventId: "EV-E8-01", validUntil: t("18:40"),
  conditions: COND_BASE,
  actionAt: { label: "통제 시점", at: t("17:50") },
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
  basis: basis({ baseTime: t("18:00"), generatedAt: t("18:10"), inputEventIds: ["EV-E1-01", "EV-E3B-05", "EV-E4A-12", "EV-E5A-10", "EV-E6A-01", "EV-E9-01"], assumptions: ["도로 통제 유지", "펌프 가용 2/3 유지"], uncertainty: { grade: "보통", sensitiveTo: ["19시 전후 강우강도"], unusableRanges: ["21:00 이후"] }, inputQuality: "정상" }),
  availability: "가용", sourceEventId: "EV-E8-02", validUntil: t("21:00"),
  conditions: floodConditions("19시 최대 17.8 mm/h · 이후 약화", "18:24 지남 · 배수 재개", "2호기 정지 · 가용 2/3"),
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
export const E8_FORECAST_2 = forecastEvent({ id: "EV-E8-02", observedAt: t("18:10"), baseTime: t("18:00"), forecastIds: [FORECAST_BASE_2_ID], supersedes: "EV-E8-01", derivedFrom: FORECAST_BASE_2.basis.inputEventIds, summary: "침수예측판 갱신 · 만조 이후 축소 전망 · 20:30 물 빠짐" });

export const FORECAST_EVENTS: EventEnvelope[] = [E8_FORECAST_1, E8_FORECAST_2];
