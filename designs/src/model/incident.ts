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

/** 처리상태 — CSMS 이벤트상세의 발생·접수·조치중·완료·오탐과 같은 다섯 자리 (2026-09-14 확정).
 *  후보 = 시스템이 만들고 아무도 안 맡음 · 확인중 = 담당자가 열어 보는 중 · 대응중 = 사람이 "사건"이라 했고 SOP 가 돎.
 *  `확인됨`은 대응중에 합쳤고 `통제`는 상태가 아니라 대응중 안의 국면(IncidentPhase)이다 */
export type WorkflowStatus = "후보" | "확인중" | "대응중" | "종료" | "오탐" | "병합됨";
/** 대응중 안의 국면 — 확대가 멈추고 잔여 대응·감시만 남았을 때 `통제`. 보고용 꼬리표이지 승인 경계가 아니다 */
export type IncidentPhase = "통제";

/** 담당자가 작업 경로로 열 수 있는 상태. 오탐·종료·병합됨은 기록으로 안내한다(IA §5.2 예외) */
export const ACTIVE_WORKFLOW_STATUSES: readonly WorkflowStatus[] = ["후보", "확인중", "대응중"];

export type RelationKind = "원인" | "악화" | "파생" | "동시발생" | "외부참조" | "병합" | "파생 훈련";
export type HazardKind = "도시침수" | "하천범람" | "해안월류" | "산불" | "폭염" | "지반" | "기반시설 장애";
export type TwinFamily = "A" | "B" | "C" | "D" | "E" | "F" | "G";

/** 트윈 유형군 이름 — 03 §5 Phase 2 트윈 유형군 */
export const TWIN_FAMILY_LABEL: Record<TwinFamily, string> = {
  A: "도시 배수·침수",
  B: "하천 흐름·범람",
  C: "해안 경계·월류",
  D: "이동 전선·확산",
  E: "대기·면 노출",
  F: "지반·구조 영향",
  G: "기반시설·네트워크 장애",
};

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
  /** 담당자가 읽는 판단 요약 1~3줄 — 왜 이 등급인가 · 무엇이 달라졌고 어디쯤인가 · 무엇을 못 믿나. 실개발은 시스템 생성 (2026-09-14 결정) */
  narrative: string[];
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
  /** 대응중 안의 국면 전환 — from·to 가 둘 다 대응중이고 phase 만 바뀐다 */
  phase?: IncidentPhase;
}
