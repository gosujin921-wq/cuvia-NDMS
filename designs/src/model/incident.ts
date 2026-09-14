/* ─────────────────────────────────────────────
 * 재난 사건(Incident) — 정본: 01 §7 · §8 · §8.1 · §8.2 · §6.2
 *
 * 사건은 특보·센서 경보·VLM 감지 중 하나와 같지 않다. 서로 다른 이벤트가 연결되어 만들어진
 * 담당자의 업무 단위다(02 §4). 처리상태·관측 위험단계·공식 특보·매트릭스 등급·도시 대응단계는
 * 서로 다른 질문에 답하는 값이라 섞지 않는다(01 §8.1).
 *
 * ★ 이 파일은 사건의 **정적 정의**만 든다. 처리상태·관계·근거·결정·조치·알림은 이벤트 원장과
 *   알림 원장을 현재 시계로 잘라 파생한다(model/selectors.ts).
 * ───────────────────────────────────────────── */

import type { ScopeKind, SpatialRef } from "./event";
import type { RiskMatrixResult } from "./risk-matrix";

export type WorkflowStatus = "후보" | "확인중" | "확인됨" | "대응중" | "통제" | "종료" | "오탐" | "병합됨";

/** 담당자가 작업 경로로 열 수 있는 상태. 오탐·종료·병합됨은 기록으로 안내한다(IA §5.2 예외) */
export const ACTIVE_WORKFLOW_STATUSES: readonly WorkflowStatus[] = ["후보", "확인중", "확인됨", "대응중", "통제"];

export type RelationKind = "원인" | "악화" | "파생" | "동시발생" | "외부참조" | "병합" | "파생 훈련";
export type HazardKind = "도시침수" | "하천범람" | "해안월류" | "산불" | "폭염" | "지반" | "기반시설 장애";
export type TwinFamily = "A" | "B" | "C" | "D" | "E" | "F" | "G";

/** 4축 설명값 — 매트릭스 결과를 담당자가 이해하도록 풀어낸 값 (01 §6.2) */
export type Severity = "낮음" | "보통" | "높음" | "매우 높음";
export type Urgency = "여유" | "주의" | "즉시";
export type Certainty = "낮음" | "보통" | "높음";
export type Trend = "완화" | "유지" | "악화";

/** 위험판단 — ASSESSMENT_UPDATED payload (01 §6.2 · §8 hazardAssessment · 02 D3) */
export interface HazardAssessment {
  /** 다지표 가중 매트릭스 결과 — 등급·점수·기여도의 정본 */
  matrix: RiskMatrixResult;
  /** 4축은 매트릭스를 설명한다. 별도 최종등급이 아니다 */
  severity: Severity;
  urgency: Urgency;
  certainty: Certainty;
  trend: Trend;
  riskFactors: string[];
  mitigatingFactors: string[];
  counterEvidence: string[];
  uncertainties: string[];
  missingData: string[];
  evidenceEventIds: string[];
}

export interface Ownership {
  organization: string;
  officer: string;
  /** 대응 승인자 — 담당자와 다를 수 있다(01 §8.2 승인 경계). 데모 역할명 */
  approver?: string;
  handover: "담당" | "인계 대기" | "인계됨";
}

export type ScenarioMode = "정렬된 과거 재생" | "혼합 데모" | "완전 모의";

export interface ScenarioContext {
  scenarioBaseTime: string;
  scenarioMode: ScenarioMode;
  demoWindow: { from: string; to: string };
}

/** 사건 정적 정의 */
export interface Incident {
  incidentId: string;
  title: string;
  hazardKind: HazardKind;
  twinFamily: TwinFamily;
  scopeKind: ScopeKind;
  scope: SpatialRef;
  /** 사건 공간의 연결 키. 이벤트 correlationKeys 와 맞물린다 */
  correlationKeys: string[];
  ownership: Ownership;
  scenarioContext: ScenarioContext;
  /** Phase 1 지구 (호환 진입점 매핑 · IA §5.2). 새 구조의 식별자가 아니다 */
  legacyDistrictId?: string;
}

export interface ExternalRecord {
  recordId: string;
  agency: string;
  sourceRecordId: string;
  kind: "특보" | "기관 사건";
  status: string;
  eventIds: string[];
}

export interface ReviewRequest {
  reviewId: string;
  incidentId: string;
  targetEventId: string;
  reason: string;
  assignee: string;
  status: "요청" | "확인" | "오탐" | "추가 확인";
}

/** 시 전체 대응단계 — 개별 사건 상태와 별도 객체 (01 §8.1) */
export interface CityOperationalState {
  stage: "상시대비" | "초기대응" | "비상대응";
  changedAt: string;
  decisionId?: string;
  relatedIncidentIds: string[];
}

export interface IncidentRelation {
  fromIncidentId: string;
  toIncidentId: string;
  kind: RelationKind;
  reason: string;
}

export interface StatusChange {
  from: WorkflowStatus;
  to: WorkflowStatus;
  reason: string;
  recordedAt: string;
  /** 병합됨일 때 기준 사건 (01 §7.5 merged_into) */
  mergedInto?: string;
}
