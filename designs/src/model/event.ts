/* ─────────────────────────────────────────────
 * 공통 이벤트 봉투 — 정본: docs/고도화/01_이벤트·사건모델.md §5 · §5.1 · §6
 *
 * CUVIA 가 받아들이는 모든 입력은 이 봉투 하나로 정규화된다. 원본은 `payload` 에 보존하고
 * 변환·판정·파생값은 별도 필드에 둔다(01 §5). 시간은 하나가 아니다(01 §5.2) —
 * `observedAt` 은 현상 시각, `receivedAt` 은 수신 시각이고, 예측 기준시각과 담당자 입력
 * 시각은 봉투가 아니라 payload 가 든다.
 *
 * 상태값은 정본의 한국어 값을 그대로 쓴다. 식별자만 영문 키다.
 *
 * ★ 제작 구분(dataOrigin · ingestionMode · sourceReadiness · calculationActor)은 내부 계약이다.
 *   기본 제품 UI 에 노출하지 않는다(CLAUDE.md · 01 §11).
 * ───────────────────────────────────────────── */

/** 표준 이벤트 유형 — 01 §6 표 그대로 */
export type EventType =
  | "OBSERVATION_RECORDED" | "THRESHOLD_CROSSED" | "RATE_CHANGED" | "DATA_QUALITY_CHANGED"
  | "SCENE_ANALYZED" | "OFFICIAL_ALERT_CHANGED" | "FORECAST_UPDATED" | "FACILITY_STATE_CHANGED"
  | "CONTROL_REQUESTED" | "CONTROL_RESULT_RECORDED" | "EXTERNAL_INCIDENT_CHANGED" | "FIELD_REPORT_RECORDED"
  | "MODEL_RUN_REQUESTED" | "MODEL_RUN_COMPLETED" | "MODEL_RUN_FAILED" | "ASSESSMENT_UPDATED"
  | "RECOMMENDATION_UPDATED" | "REVIEW_REQUESTED" | "INCIDENT_CREATED" | "INCIDENT_STATUS_CHANGED"
  | "INCIDENT_RELATION_CHANGED" | "CITY_STAGE_CHANGED" | "DECISION_RECORDED" | "ACTION_ASSIGNED"
  | "ACTION_STATUS_CHANGED" | "DISSEMINATION_REQUESTED" | "DISSEMINATION_RESULT_RECORDED"
  | "OUTCOME_RECORDED" | "REPORT_GENERATED" | "REFERENCE_DATA_UPDATED";

/** 이벤트 생성 계층 (01 §5.1) */
export type EventClass = "원천" | "파생" | "분석" | "업무";
/** 이벤트를 만든 주체의 역할 (01 §5) */
export type ProducerRole = "원천 기관" | "장비" | "CUVIA 규칙" | "모델" | "담당자" | "시스템";
/** 데이터 품질 (01 §11) */
export type DataQuality = "정상" | "지연" | "결측" | "의심" | "보정";
/** 출처·연계 준비도 (02 §5.1) */
export type SourceReadiness = "실연계" | "연계 가능" | "협의 필요" | "내부 생성";
/** 데이터 출처 (01 §11 · IA §14) */
export type DataOrigin = "실제 API" | "원본 파일" | "승인 표본" | "합성 데이터" | "사용자 입력";
/** 수집·시연 방식 (01 §11) */
export type IngestionMode = "실시간" | "재생" | "모의" | "수동";
/** 계산 주체 (01 §11) */
export type CalculationActor = "CUVIA 계산" | "외부 모델 수신" | "해당 없음";
/** 공간 범위 (01 §8.3) */
export type ScopeKind = "지점" | "시설" | "회랑" | "구역" | "전역";

/** 공간 참조 — 지도 표시 앵커와 실제 영향 범위를 가른다 (01 §8.3) */
export interface SpatialRef {
  kind: ScopeKind;
  /** 카드·핀을 놓을 자리 [경도, 위도] */
  displayAnchor: [number, number];
  /** 실제 영향 범위 식별자. 폴리곤은 fixture 의 geometry 표가 든다 */
  affectedGeometryId?: string;
  label: string;
}

export interface Measurement {
  value: number;
  unit: string;
}

/** 시나리오 구성 메타 — 02 §5.5 가 모든 시나리오 이벤트에 요구하는 내부 기록 */
export interface ScenarioMeta {
  scenarioRuleId: string;
  scenarioRuleVersion: string;
  generatedAt: string;
  /** 시나리오 시계의 시각 */
  scenarioTime: string;
  /** 실제 API·원본에서 온 값이면 원래 관측·기준 시각 */
  originalTime?: string;
}

/** 공통 이벤트 봉투 (01 §5 표) */
export interface EventEnvelope<P = unknown> {
  eventId: string;
  sourceSystem: string;
  sourceEventId?: string;
  eventType: EventType;
  eventClass: EventClass;
  producerRole: ProducerRole;
  subjectId: string;
  observedAt: string;
  receivedAt: string;
  validFrom?: string;
  validTo?: string;
  location?: SpatialRef;
  measurement?: Measurement;
  quality?: DataQuality;
  sourceReadiness: SourceReadiness;
  dataOrigin: DataOrigin;
  calculationActor?: CalculationActor;
  payload: P;
  schemaVersion: string;
  correlationKeys?: string[];
  supersedes?: string;
  cancels?: string;
  incidentId?: string;
  derivedFrom?: string[];
  references?: string[];
  actor?: string;
  ingestionMode: IngestionMode;
  scenario?: ScenarioMeta;
  /** 대표 데모 기획표 번호(E0~E10). 문서 대조용 */
  demoRef?: string;
  /** 사람이 읽는 한 줄 요약 */
  summary: string;
}
