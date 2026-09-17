/* ─────────────────────────────────────────────
 * E0~E10 — 외부·관측·분석 이벤트 인스턴스
 * 정본: 02 §5.1 · §5.4 · §5.5, 01 §5 · §6
 *
 * 값은 하나의 인과 시나리오로 읽혀야 한다(02 §5.5). 관측 시계열은 관측 하나가 이벤트 하나다(01 §5) —
 * 표를 봉투로 펼치는 `series()` 가 그 규칙을 지킨다.
 * E1 만 실제 API 재생이다. 19시 17.8 mm/h 표본은 확인됐고(02 §5.4) 나머지 시각의 값은
 * adapters/open-meteo.ts 가 보유 격자 응답으로 채우기 전의 자리표시다.
 * ───────────────────────────────────────────── */

import type { CalculationActor, DataOrigin, DataQuality, EventEnvelope, EventType, IngestionMode, SourceReadiness } from "../../model/event";
import { DRAINAGE_BASIN_ID, SUBJECTS, SUBJECT_LOCATION, type SubjectId } from "./subjects";
import { FIXTURE_GENERATED_AT, INCIDENT_ID, SCENARIO_RULE, t } from "./incident";

const SCHEMA = "ndms.event/0.1";

function base<P>(args: {
  id: string; type: EventType; eventClass: EventEnvelope["eventClass"]; producerRole: EventEnvelope["producerRole"];
  source: string; subject: SubjectId; observedAt: string; receivedAt?: string; readiness: SourceReadiness; origin: DataOrigin;
  mode: IngestionMode; quality?: DataQuality; calc?: CalculationActor; demoRef: string; summary: string; payload: P;
  originalTime?: string; measurement?: { value: number; unit: string }; derivedFrom?: string[]; validFrom?: string; validTo?: string;
  supersedes?: string; incident?: boolean;
}): EventEnvelope<P> {
  return {
    eventId: args.id, sourceSystem: args.source, eventType: args.type, eventClass: args.eventClass, producerRole: args.producerRole,
    subjectId: args.subject, observedAt: args.observedAt, receivedAt: args.receivedAt ?? args.observedAt,
    validFrom: args.validFrom, validTo: args.validTo, location: SUBJECT_LOCATION[args.subject], measurement: args.measurement,
    quality: args.quality ?? "정상", sourceReadiness: args.readiness, dataOrigin: args.origin, calculationActor: args.calc,
    payload: args.payload, schemaVersion: SCHEMA, correlationKeys: [DRAINAGE_BASIN_ID, args.subject], supersedes: args.supersedes,
    incidentId: args.incident === false ? undefined : INCIDENT_ID, derivedFrom: args.derivedFrom, ingestionMode: args.mode,
    scenario: { scenarioRuleId: SCENARIO_RULE.id, scenarioRuleVersion: SCENARIO_RULE.version, generatedAt: FIXTURE_GENERATED_AT, scenarioTime: args.observedAt, originalTime: args.originalTime },
    demoRef: args.demoRef, summary: args.summary,
  };
}

/** 관측 시계열 → 이벤트 배열. [시각, 값, 품질?] 행 하나가 OBSERVATION_RECORDED 하나 */
function series(args: {
  prefix: string; subject: SubjectId; source: string; unit: string; label: string; readiness: SourceReadiness; origin: DataOrigin;
  mode: IngestionMode; demoRef: string; rows: [string, number, DataQuality?][]; delayMin?: number;
}): EventEnvelope<{ label: string }>[] {
  return args.rows.map(([hhmm, value, quality], i) => {
    const observedAt = t(hhmm);
    const receivedAt = quality === "지연" && args.delayMin ? new Date(new Date(observedAt).getTime() + args.delayMin * 60_000).toISOString() : observedAt;
    return base({
      id: `${args.prefix}-${String(i + 1).padStart(2, "0")}`, type: "OBSERVATION_RECORDED", eventClass: "원천", producerRole: "장비",
      source: args.source, subject: args.subject, observedAt, receivedAt, readiness: args.readiness, origin: args.origin, mode: args.mode,
      quality, demoRef: args.demoRef, summary: `${args.label} ${value} ${args.unit}`, measurement: { value, unit: args.unit },
      payload: { label: args.label }, incident: false,
    });
  });
}

/* E0 실측강우 (mm/h) — 시나리오 시계열. 17:16~17:28 미수신은 E10 과 맞물린다 */
export const E0_RAIN = series({
  prefix: "EV-E0", subject: SUBJECTS.rainGauge, source: "창원 계측", unit: "mm/h", label: "강우강도",
  readiness: "연계 가능", origin: "합성 데이터", mode: "모의", demoRef: "E0", delayMin: 4,
  rows: [["16:00", 2.5], ["16:30", 4.0], ["16:50", 6.5], ["17:00", 8.5], ["17:10", 12.0], ["17:30", 15.5, "지연"], ["17:40", 16.0], ["18:00", 18.0], ["18:30", 16.5], ["19:00", 17.5], ["19:30", 14.0], ["20:00", 9.0], ["20:30", 5.0], ["21:00", 2.0]],
});

/* E1 예측강우 — 실제 API 재생. 19시 17.8 mm/h 확인 표본. 그 외는 자리표시
   // TODO(adapter): adapters/open-meteo.ts 가 보유 격자(51×41 · 12~21시) 응답으로 교체 */
export const E1_FORECAST_RAIN = base({
  id: "EV-E1-01", type: "FORECAST_UPDATED", eventClass: "원천", producerRole: "원천 기관", source: "Open-Meteo Historical Forecast",
  subject: SUBJECTS.forecastGrid, observedAt: t("16:30"), originalTime: "2024-09-21T16:00:00+09:00", validFrom: t("17:00"), validTo: t("21:00"),
  readiness: "연계 가능", origin: "실제 API", mode: "재생", calc: "외부 모델 수신", demoRef: "E1",
  summary: "60분 예측강우 상향 · 19시 최대 17.8 mm/h",
  payload: {
    forecastBaseTime: "2024-09-21T16:00:00+09:00", model: "확인 전 (02 §5.4 선택 모델 단정 금지)",
    hourly: [{ at: t("17:00"), mmPerH: 6.4 }, { at: t("18:00"), mmPerH: 11.2 }, { at: t("19:00"), mmPerH: 17.8 }, { at: t("20:00"), mmPerH: 12.5 }, { at: t("21:00"), mmPerH: 5.1 }],
    confirmedSample: { at: t("19:00"), mmPerH: 17.8 },
  },
  incident: false,
});

/* E2 호우특보 — 시나리오 통보문 (기상청 API허브 인증 미완료) */
export const E2_ALERT_ADVISORY = base({
  id: "EV-E2-01", type: "OFFICIAL_ALERT_CHANGED", eventClass: "원천", producerRole: "원천 기관", source: "기상청(시나리오 통보문)",
  subject: SUBJECTS.alertArea, observedAt: t("15:30"), validFrom: t("15:30"), readiness: "연계 가능", origin: "합성 데이터", mode: "모의",
  demoRef: "E2", summary: "호우주의보 발표 · 창원시", payload: { level: "호우주의보", change: "발표", area: "창원시", issuedAt: t("15:30") }, incident: false,
});
export const E2_ALERT_WARNING = base({
  id: "EV-E2-02", type: "OFFICIAL_ALERT_CHANGED", eventClass: "원천", producerRole: "원천 기관", source: "기상청(시나리오 통보문)",
  subject: SUBJECTS.alertArea, observedAt: t("16:40"), validFrom: t("16:40"), validTo: t("21:30"), readiness: "연계 가능", origin: "합성 데이터", mode: "모의",
  demoRef: "E2", summary: "호우경보 변경 · 창원시 · 21:30 까지", supersedes: "EV-E2-01", payload: { level: "호우경보", change: "변경", area: "창원시", issuedAt: t("16:40"), validUntil: t("21:30") }, incident: false,
});

/* E3a 예측조위 · E3b 실측조위 — 시나리오 (기존 바다누리 API 중단) */
export const E3A_TIDE_FORECAST = base({
  id: "EV-E3A-01", type: "FORECAST_UPDATED", eventClass: "원천", producerRole: "원천 기관", source: "해양 데이터",
  subject: SUBJECTS.tide, observedAt: t("16:20"), validFrom: t("16:20"), validTo: t("22:00"), readiness: "협의 필요", origin: "합성 데이터",
  mode: "모의", calc: "외부 모델 수신", demoRef: "E3a", summary: "예측 만조 18:24 · 176 cm",
  payload: { forecastBaseTime: t("16:00"), highTideAt: t("18:24"), highTideCm: 176 }, incident: false,
});
export const E3B_TIDE = series({
  prefix: "EV-E3B", subject: SUBJECTS.tide, source: "해양 데이터", unit: "cm", label: "실측조위",
  readiness: "협의 필요", origin: "합성 데이터", mode: "모의", demoRef: "E3b",
  rows: [["16:20", 118], ["16:50", 132], ["17:20", 151], ["17:50", 166], ["18:20", 175], ["18:50", 172], ["19:20", 160], ["19:50", 143], ["20:20", 124], ["20:50", 106]],
});

/* E4a 관로수위 (m) — 급상승 구간 17:00→17:10 */
export const E4A_PIPE = series({
  prefix: "EV-E4A", subject: SUBJECTS.pipeLevel, source: "창원 계측", unit: "m", label: "관로수위",
  readiness: "연계 가능", origin: "합성 데이터", mode: "모의", demoRef: "E4a",
  rows: [["16:30", 0.58], ["16:40", 0.62], ["16:50", 0.71], ["17:00", 0.96], ["17:05", 1.28], ["17:10", 1.6], ["17:15", 1.82], ["17:20", 2.04], ["17:30", 2.21], ["17:40", 2.36], ["17:50", 2.44], ["18:00", 2.48], ["18:20", 2.41], ["18:40", 2.3], ["19:00", 2.35], ["19:30", 2.12], ["20:00", 1.74], ["20:30", 1.38], ["21:00", 1.02]],
});

/* E4b 관로수위 급상승 — CUVIA 규칙 파생 (변화율 기준 10분 30 cm · 데모 조건) */
export const E4B_PIPE_RATE = base({
  id: "EV-E4B-01", type: "RATE_CHANGED", eventClass: "파생", producerRole: "CUVIA 규칙", source: "CUVIA 규칙", subject: SUBJECTS.pipeLevel,
  observedAt: t("17:10"), receivedAt: t("17:12"), readiness: "내부 생성", origin: "합성 데이터", mode: "모의", demoRef: "E4b",
  summary: "10분간 관로수위 64 cm 상승 (17:00→17:10)", measurement: { value: 64, unit: "cm/10분" }, derivedFrom: ["EV-E4A-04", "EV-E4A-06"],
  payload: { ruleId: "RULE-RATE-PIPE", ruleVersion: "0.1", thresholdCmPer10Min: 30, from: 0.96, to: 1.6 },
});

/* E5a 도로수위 (cm) — 관로 상승 뒤 지표면 영향 */
export const E5A_ROAD = series({
  prefix: "EV-E5A", subject: SUBJECTS.roadLevel, source: "창원 계측", unit: "cm", label: "도로수위",
  readiness: "연계 가능", origin: "합성 데이터", mode: "모의", demoRef: "E5a",
  rows: [["16:40", 0], ["17:00", 0], ["17:10", 1], ["17:15", 3], ["17:20", 6], ["17:22", 8], ["17:30", 12], ["17:40", 17], ["17:50", 22], ["18:00", 26], ["18:10", 27], ["18:20", 25], ["18:40", 21], ["19:00", 23], ["19:30", 16], ["20:00", 9], ["20:30", 3], ["21:00", 0]],
});

/* E5b 도로수위 기준 진입 — CUVIA 규칙 파생 (경계 기준 8 cm · 데모 조건) */
export const E5B_ROAD_THRESHOLD = base({
  id: "EV-E5B-01", type: "THRESHOLD_CROSSED", eventClass: "파생", producerRole: "CUVIA 규칙", source: "CUVIA 규칙", subject: SUBJECTS.roadLevel,
  observedAt: t("17:22"), readiness: "내부 생성", origin: "합성 데이터", mode: "모의", demoRef: "E5b",
  summary: "도로수위 경계 기준(8 cm) 진입", measurement: { value: 8, unit: "cm" }, derivedFrom: ["EV-E5A-06"],
  payload: { ruleId: "RULE-THRESHOLD-ROAD", ruleVersion: "0.1", level: "경계", thresholdCm: 8 },
});
/* D7 대응 중 악화 — 도로수위가 침수 기준(20 cm)을 10분 넘게 넘는다. 위험도가 심각으로 오르고 SOP 항목이 는다 (2026-09-14 결정) */
export const E5B_ROAD_FLOODED = base({
  id: "EV-E5B-02", type: "THRESHOLD_CROSSED", eventClass: "파생", producerRole: "CUVIA 규칙", source: "CUVIA 규칙", subject: SUBJECTS.roadLevel,
  observedAt: t("18:00"), readiness: "내부 생성", origin: "합성 데이터", mode: "모의", demoRef: "E5b",
  summary: "도로수위 침수 기준(20 cm) 10분 지속 · 26 cm", measurement: { value: 26, unit: "cm" }, derivedFrom: ["EV-E5A-09", "EV-E5A-10"],
  payload: { ruleId: "RULE-THRESHOLD-ROAD", ruleVersion: "0.1", level: "심각", thresholdCm: 20 },
});

/* E6a 펌프 가용성 — 사건 전 악화 조건 (17:05 2호기 정지) → D7 재가동 (18:35) */
export const E6A_PUMP_DOWN = base({
  id: "EV-E6A-01", type: "FACILITY_STATE_CHANGED", eventClass: "원천", producerRole: "원천 기관", source: "시설물 시스템",
  subject: SUBJECTS.pumpStation, observedAt: t("17:05"), readiness: "협의 필요", origin: "합성 데이터", mode: "모의", demoRef: "E6a",
  summary: "펌프 2호기 정지 · 가용 2/3", payload: { unit: "2호기", state: "정지", available: 2, total: 3, cause: "전기 계통 점검 필요" },
});
export const E6A_PUMP_UP = base({
  id: "EV-E6A-02", type: "FACILITY_STATE_CHANGED", eventClass: "원천", producerRole: "원천 기관", source: "시설물 시스템",
  subject: SUBJECTS.pumpStation, observedAt: t("18:35"), readiness: "협의 필요", origin: "합성 데이터", mode: "모의", demoRef: "E6a",
  summary: "펌프 2호기 재가동 · 가용 3/3", supersedes: "EV-E6A-01", payload: { unit: "2호기", state: "가동", available: 3, total: 3, cause: null },
});

/* E6b 저류시설 상태 */
export const E6B_RETENTION = base({
  id: "EV-E6B-01", type: "FACILITY_STATE_CHANGED", eventClass: "원천", producerRole: "원천 기관", source: "시설물 시스템",
  subject: SUBJECTS.retention, observedAt: t("17:18"), readiness: "협의 필요", origin: "합성 데이터", mode: "모의", demoRef: "E6b",
  summary: "저류시설 여유 62 %", measurement: { value: 62, unit: "%" }, payload: { state: "정상", spareRatio: 0.62 },
});

/* E7 CCTV/VLM — 보유 표본 + 시나리오 분석 문장 (사건 일치·사용권·실제 VLM 미확인)
   // TODO(adapter): 실제 VLM 결과가 오면 model·version·still 교체 */
export const E7_SCENE = base({
  id: "EV-E7-01", type: "SCENE_ANALYZED", eventClass: "분석", producerRole: "모델", source: "CCTV·VLM", subject: SUBJECTS.cctvPump,
  observedAt: t("17:24"), readiness: "협의 필요", origin: "합성 데이터", mode: "모의", calc: "CUVIA 계산", demoRef: "E7",
  summary: "차로 일부 침수 추정 · 신뢰도 0.82", derivedFrom: [],
  payload: { model: "VLM-scene", version: "0.3", analyzedAt: t("17:24"), confidence: 0.82, description: "해안도로 방향 차로 일부에 물고임이 보이며 차량 통행이 느려지고 있다.", still: "/cctv/06_city_flood_start.jpg", clip: "/cctv/02_car.mp4", calmStill: "/cctv/05_city_normal_01.jpg" },
});
/* 같은 채널의 뒤 분석 — 팝업 영상이 17:24 문장에 머물지 않게 현장 보고(E9)와 같은 국면을 따라간다.
   침수가 더 깊은 표본이 없어 18:06 은 17:24 사진을 그대로 쓴다. 영상은 침수 중 02_car · 물 빠진 뒤 01_car (실촬 클립) */
export const E7_SCENE_FLOODED = base({
  id: "EV-E7-02", type: "SCENE_ANALYZED", eventClass: "분석", producerRole: "모델", source: "CCTV·VLM", subject: SUBJECTS.cctvPump,
  observedAt: t("18:06"), readiness: "협의 필요", origin: "합성 데이터", mode: "모의", calc: "CUVIA 계산", demoRef: "E7",
  summary: "차로 침수 · 통행 거의 멈춤 · 신뢰도 0.88", derivedFrom: [],
  payload: { model: "VLM-scene", version: "0.3", analyzedAt: t("18:06"), confidence: 0.88, description: "해안도로 방향 차로 대부분이 물에 잠겼고 차량 통행이 거의 멈췄다.", still: "/cctv/06_city_flood_start.jpg", clip: "/cctv/02_car.mp4" },
});
/* 18:40 상황 안정 전환(EV-W-15)과 같은 국면 — 도로수위가 27 → 21 cm 로 내려가는 중. 안정 뒤 영상 창을 다시 열면 물 빠진 도로 클립이 선다 */
export const E7_SCENE_EASING = base({
  id: "EV-E7-04", type: "SCENE_ANALYZED", eventClass: "분석", producerRole: "모델", source: "CCTV·VLM", subject: SUBJECTS.cctvPump,
  observedAt: t("18:40"), readiness: "협의 필요", origin: "합성 데이터", mode: "모의", calc: "CUVIA 계산", demoRef: "E7",
  summary: "차로 고인 물 감소 · 통행 재개 · 신뢰도 0.84", derivedFrom: [],
  payload: { model: "VLM-scene", version: "0.3", analyzedAt: t("18:40"), confidence: 0.84, description: "해안도로 방향 차로의 고인 물이 줄어들고 차량 통행이 다시 이어지고 있다.", still: "/cctv/05_city_normal_01.jpg", clip: "/cctv/01_car.mp4" },
});
export const E7_SCENE_RECEDED = base({
  id: "EV-E7-03", type: "SCENE_ANALYZED", eventClass: "분석", producerRole: "모델", source: "CCTV·VLM", subject: SUBJECTS.cctvPump,
  observedAt: t("20:50"), readiness: "협의 필요", origin: "합성 데이터", mode: "모의", calc: "CUVIA 계산", demoRef: "E7",
  summary: "물 빠짐 · 노면 드러남 · 신뢰도 0.85", derivedFrom: [],
  payload: { model: "VLM-scene", version: "0.3", analyzedAt: t("20:50"), confidence: 0.85, description: "해안도로 노면이 드러났고 차로에 고인 물이 보이지 않는다.", still: "/cctv/05_city_normal_01.jpg", clip: "/cctv/01_car.mp4" },
});

/* E9 현장 보고 — 사용자 입력·수동 */
export const E9_FIELD_CONTROL = base({
  id: "EV-E9-01", type: "FIELD_REPORT_RECORDED", eventClass: "원천", producerRole: "담당자", source: "현장 담당자", subject: SUBJECTS.coastRoad,
  observedAt: t("18:05"), readiness: "내부 생성", origin: "사용자 입력", mode: "수동", demoRef: "E9",
  summary: "해안도로 통제 완료 · 통행 불가 확인", payload: { recordedAt: t("18:05"), reporter: "교통과 현장반", passable: false, waterDepthCm: 25, note: "차량 우회 안내 중" },
});
export const E9_FIELD_RECEDE = base({
  id: "EV-E9-02", type: "FIELD_REPORT_RECORDED", eventClass: "원천", producerRole: "담당자", source: "현장 담당자", subject: SUBJECTS.coastRoad,
  observedAt: t("20:50"), readiness: "내부 생성", origin: "사용자 입력", mode: "수동", demoRef: "E9",
  summary: "도로 물 빠짐 확인 · 잔류 토사 정리 필요", payload: { recordedAt: t("20:50"), reporter: "교통과 현장반", passable: true, waterDepthCm: 0, note: "잔류 토사 정리 후 통제 해제 예정" },
});

/* E10 데이터 지연·복구 — CUVIA 품질 규칙 파생 */
export const E10_QUALITY_DELAY = base({
  id: "EV-E10-01", type: "DATA_QUALITY_CHANGED", eventClass: "파생", producerRole: "CUVIA 규칙", source: "CUVIA 품질 규칙", subject: SUBJECTS.rainGauge,
  observedAt: t("17:16"), readiness: "내부 생성", origin: "합성 데이터", mode: "모의", quality: "지연", demoRef: "E10",
  summary: "강우계 6분 미수신 · 지연", derivedFrom: ["EV-E0-05"], payload: { ruleId: "RULE-QUALITY-GAP", ruleVersion: "0.1", state: "지연", gapMin: 6 },
});
export const E10_QUALITY_RECOVER = base({
  id: "EV-E10-02", type: "DATA_QUALITY_CHANGED", eventClass: "파생", producerRole: "CUVIA 규칙", source: "CUVIA 품질 규칙", subject: SUBJECTS.rainGauge,
  observedAt: t("17:34"), readiness: "내부 생성", origin: "합성 데이터", mode: "모의", demoRef: "E10",
  summary: "강우계 수신 복구", supersedes: "EV-E10-01", derivedFrom: ["EV-E0-06"], payload: { ruleId: "RULE-QUALITY-GAP", ruleVersion: "0.1", state: "복구", gapMin: 0 },
});

/** 관측·외부·분석 이벤트 전부 (E8 은 forecasts.ts 가 Forecast 객체와 함께 든다) */
export const SOURCE_EVENTS: EventEnvelope[] = [
  ...E0_RAIN, E1_FORECAST_RAIN, E2_ALERT_ADVISORY, E2_ALERT_WARNING, E3A_TIDE_FORECAST, ...E3B_TIDE, ...E4A_PIPE, E4B_PIPE_RATE,
  ...E5A_ROAD, E5B_ROAD_THRESHOLD, E5B_ROAD_FLOODED, E6A_PUMP_DOWN, E6A_PUMP_UP, E6B_RETENTION, E7_SCENE, E7_SCENE_FLOODED, E7_SCENE_EASING, E7_SCENE_RECEDED, E9_FIELD_CONTROL, E9_FIELD_RECEDE,
  E10_QUALITY_DELAY, E10_QUALITY_RECOVER,
];
