/* ─────────────────────────────────────────────
 * 대응·실행 객체 — 권고 · 결정 · 조치 · 전파(CAP) · 결과 · 보고서
 * 정본: 01 §8 · §8.2 · §2.4, 02 D6~D8, IA §9 · §10
 *
 * 업무 이벤트의 payload 로 기록된다. 화면은 이벤트 원장을 현재 시계로 잘라 파생한 목록을 읽는다.
 * ★ 대응수준은 공식 대응단계가 아니라 데모 역할명이다(01 §8.2). `CONTROL_*` 원격제어는 대표 데모에서
 *   쓰지 않는다 — 시설 점검·운영 요청은 Action 이다.
 * ───────────────────────────────────────────── */

import type { AlternativeId, ImpactTarget } from "./forecast";

/** 대응 수준 — 권고·승인이 고르는 대응안의 세기. 사건 국면(통제)과 다른 축이라 이름을 겹치지 않게 둔다 (2026-09-14) */
export type ResponseLevel = "감시 강화" | "현장 확인" | "선제 통제 검토" | "선제 통제" | "종료 검토";

export interface Recommendation {
  recommendationId: string;
  incidentId: string;
  status: "제안" | "변경" | "철회";
  proposedLevel: ResponseLevel;
  /** 담당자가 트윈에서 고른 전망 기준 — "18:00 전망 · 도로 통제 기준" (02 D6) */
  basis: { forecastId: string; validAt: string; alternativeId: AlternativeId } | null;
  reasons: string[];
  counterReasons: string[];
  proposedActions: ActionDraft[];
  producer: string;
}

export interface ActionDraft {
  kind: ActionKind;
  target: string;
  organization: string;
  summary: string;
  /** 시스템이 이 조치를 채운 이유 — 전망·판단 한 줄. SOP 항목 아래 `근거` 줄 (2026-09-14) */
  basis?: string;
}

export type DecisionStatus = "검토중" | "선택" | "승인" | "기각" | "취소";
export type DecisionKind = "사건 확인" | "대응 승인" | "종료 판단" | "도시 대응단계";

export interface Decision {
  decisionId: string;
  incidentId: string;
  kind: DecisionKind;
  status: DecisionStatus;
  level?: ResponseLevel;
  references: string[];
  approver: string;
  recordedAt: string;
  reason: string;
}

export type ActionKind = "도로 통제" | "현장 확인" | "시설 점검" | "운영 요청" | "대피 안내";
export type ActionStatus = "대기" | "진행중" | "성공" | "실패" | "미응답" | "확인대기" | "대체됨" | "취소";

export interface Action {
  actionId: string;
  incidentId: string;
  kind: ActionKind;
  target: string;
  organization: string;
  assignee: string;
  summary: string;
  decisionId: string;
  replacesActionId?: string;
}

export type ChannelId = "알림톡" | "마을방송" | "전광판" | "기관 통보" | "유선 연락";

/** CAP 1.2 필드 구성 (01 §2.4 · 02 D6) */
export interface CapMessage {
  identifier: string;
  sender: string;
  sent: string;
  msgType: "Alert" | "Update" | "Cancel";
  severity: "Extreme" | "Severe" | "Moderate" | "Minor";
  urgency: "Immediate" | "Expected" | "Future";
  certainty: "Observed" | "Likely" | "Possible";
  areaDesc: string;
  headline: string;
  description: string;
  instruction: string;
  references?: string;
}

export interface Dissemination {
  disseminationId: string;
  incidentId: string;
  decisionId: string;
  channels: ChannelId[];
  recipients: string;
  message: CapMessage;
}

export interface DisseminationResult {
  disseminationId: string;
  channel: ChannelId;
  status: ActionStatus;
  detail: string;
  fallback?: { channel: ChannelId; actionId?: string; detail: string };
}

/** 예측판 영향 대상 하나의 실제 상태 — 예측 대 실제의 "적중 여부"를 세우는 자리 (IA §13.1) */
export interface ObservedTarget {
  /** 예측판 ImpactTarget 과 같은 id */
  id: string;
  /** 실제로 확인된 이름표. 수가 적힌 대상은 실측 수를 든다 — "저지대 건물 10동" */
  label: string;
  exposure: ImpactTarget["exposure"];
  /** 실제 도달·전환 시각 */
  at?: string;
  /** 무엇으로 확인했나 */
  eventId?: string;
}

export interface Outcome {
  outcomeId: string;
  incidentId: string;
  verification:
    | {
        available: true;
        forecastId: string;
        predictedDepthM: number;
        observedDepthM: number;
        predictedArrivalAt: string;
        observedArrivalAt: string;
        verdict: "과대예측" | "과소예측" | "일치";
        /** 실측 침수 범위 — 예측 범위와 겹쳐 본다(geometry.generated.ts) */
        observedGeometryId?: string;
        /** 예측판 대상별 실제 상태. 비면 대상 적중은 "확인 못 함"이다 */
        observedTargets?: ObservedTarget[];
      }
    | { available: false; reason: string; requiredObservations: string[] };
  milestones: { label: string; at: string; eventId: string }[];
  referencedEventIds: string[];
  improvements: Improvement[];
}

/** 사후 개선 과제 — 축은 IA §10 의 임계치·모델·데이터·SOP 넷이다. 점수를 매기지 않는다 */
export interface Improvement {
  area: "임계치" | "모델" | "데이터" | "SOP";
  text: string;
}

export interface Report {
  reportId: string;
  incidentId: string;
  status: "초안" | "확정본";
  version: number;
  generatedAt: string;
  sections: { title: string; body: string; evidenceEventIds: string[] }[];
}
