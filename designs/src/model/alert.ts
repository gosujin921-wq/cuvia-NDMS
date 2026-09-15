/* ─────────────────────────────────────────────
 * 복합 알림(AttentionAlert) — 정본: 01 §6.1, 02 §5.2.1, IA §6 · §15
 *
 * 외부 특보나 시민 전파 경보가 아니다. Event·Forecast 를 규칙으로 평가해 **담당자 확인이 필요함**을
 * 나타내는 CUVIA 내부 알림 객체다. 이벤트 원본을 대체하지 않으며 생성 근거와 규칙 버전을 참조한다.
 * 같은 원인의 반복 이벤트는 하나의 알림 근거·갱신 이력으로 누적하고 알림 수를 늘리지 않는다.
 *
 * 알림 유형은 01 §6.1 표의 다섯이고, 02 §5.2.1 의 시연 이름(사전 감시·복합 징후·영상 교차확인·
 * 예측 영향·품질·대체 확인)은 `demoRole` 이 든다 — 유형과 시연 역할은 다른 축이다.
 * ───────────────────────────────────────────── */

import type { SpatialRef } from "./event";

/** 알림 유형 (01 §6.1 표) */
export type AlertKind = "단일 심각" | "복합 징후" | "예측 영향" | "품질·연계" | "공식 상황";

/** 시연 역할 (02 §5.2.1 표) */
export type AlertDemoRole = "사전 감시 알림" | "단일 심각 알림" | "복합 징후 알림" | "영상 교차확인 알림" | "예측 영향 알림" | "품질·대체 확인 알림";

export type AlertGrade = "주의" | "경계" | "심각";
export type AlertStatus = "생성" | "갱신" | "확인" | "억제" | "해제";

/** 알림 갱신 이력 한 줄 — 반복 이벤트는 여기 누적된다 */
export interface AlertUpdate {
  at: string;
  status: AlertStatus;
  /** 이 갱신을 만든 이벤트·Forecast */
  eventIds: string[];
  note: string;
}

export interface AttentionAlert {
  alertId: string;
  kind: AlertKind;
  demoRole: AlertDemoRole;
  grade: AlertGrade;
  status: AlertStatus;
  createdAt: string;
  updatedAt: string;
  /** 대상 공간 */
  target: SpatialRef;
  /** 대상 업무 — 감시·확인·검토 등 담당자가 할 일 */
  task: string;
  evidenceEventIds: string[];
  forecastIds: string[];
  /** 연결 이유 — 공간·시간·의미·품질이 어떻게 맞았는가 */
  reason: string;
  ruleId: string;
  ruleVersion: string;
  assignee?: string;
  acknowledgedAt?: string;
  /** 반복 억제 — 같은 원인의 재알림을 막는 시간창(분)과 해제 조건 */
  suppression: { windowMin: number; releaseCondition: string };
  updates: AlertUpdate[];
  /** 이 알림이 만든·갱신한 사건 (후보 생성 뒤) */
  incidentId?: string;
  /** 사건 후보를 만들었는가 (01 §6.1 "사건 후보와의 관계") */
  createdIncident: boolean;
}

/** 알림 규칙표 한 행 (README §7 "I0 복합 알림 규칙표") */
export interface AlertRule {
  ruleId: string;
  ruleVersion: string;
  kind: AlertKind;
  demoRole: AlertDemoRole;
  /** 입력 이벤트 유형·Forecast */
  inputs: string[];
  /** 단일/복합 조건 서술 */
  condition: string;
  windowMin: number;
  spatialScope: string;
  qualityCondition: string;
  grade: AlertGrade;
  suppressionMin: number;
  releaseCondition: string;
  createsIncident: boolean;
  /** 데모 시나리오 조건인가 — 실개발 교체 대상 (README §7) */
  demoValue: boolean;
  replacementNote?: string;
}
