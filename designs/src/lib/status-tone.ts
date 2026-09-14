/* ─────────────────────────────────────────────
 * 사건 처리상태 표시 톤 — lib/level-tone.ts(Phase 1 계측 단계)와 같은 규칙
 *
 * 원색은 점·바·짧은 텍스트에만, 뱃지는 DS variant. 지도 마커·목록·범례·큐가 전부 이 표 하나를 문다.
 * 램프는 **주의를 요하는 정도**다. 후보(lv2)·확인중(lv3)·확인됨(lv4)·대응중(lv5)으로 오르고, 통제는
 * 브랜드색(감시 유지), 종료·오탐·병합됨은 무채색이다.
 * ───────────────────────────────────────────── */

import type { WorkflowStatus } from "../model/incident";
import type { AlertGrade } from "../model/alert";

export interface StatusTone {
  badge: "live" | "active" | "running" | "pending" | "offline" | "done";
  /** CSS 색 값 — 지도 마커·차트 */
  color: string;
  dot: string;
  text: string;
  pulse: boolean;
  meaning: string;
}

export const STATUS_TONE: Record<WorkflowStatus, StatusTone> = {
  후보: { badge: "pending", color: "var(--color-risk-lv2)", dot: "bg-risk-lv2", text: "text-risk-lv2", pulse: true, meaning: "규칙이 만든 후보 · 담당자 검토 전" },
  확인중: { badge: "pending", color: "var(--color-risk-lv3)", dot: "bg-risk-lv3", text: "text-risk-lv3", pulse: true, meaning: "담당자가 근거를 확인하는 중" },
  확인됨: { badge: "active", color: "var(--color-risk-lv4)", dot: "bg-risk-lv4", text: "text-risk-lv4", pulse: true, meaning: "실제 대응할 사건으로 확인" },
  대응중: { badge: "live", color: "var(--color-risk-lv5)", dot: "bg-risk-lv5", text: "text-risk-lv5", pulse: true, meaning: "대응안 승인 · 조치 진행" },
  통제: { badge: "running", color: "var(--color-primary)", dot: "bg-primary", text: "text-primary", pulse: false, meaning: "확대 중단 · 감시와 잔여 대응" },
  종료: { badge: "done", color: "var(--color-foreground-subtle)", dot: "bg-foreground-subtle", text: "text-foreground-subtle", pulse: false, meaning: "종료 조건 충족" },
  오탐: { badge: "offline", color: "var(--color-foreground-subtle)", dot: "bg-foreground-subtle", text: "text-foreground-subtle", pulse: false, meaning: "시험·중복·오경보 판정" },
  병합됨: { badge: "offline", color: "var(--color-foreground-subtle)", dot: "bg-foreground-subtle", text: "text-foreground-subtle", pulse: false, meaning: "기준 사건에 흡수" },
};

/** 범례 순서 — 담당자가 밟는 순서. 오탐·병합됨은 예외 경로라 범례에 세우지 않는다 */
export const LEGEND_STATUSES: WorkflowStatus[] = ["후보", "확인중", "확인됨", "대응중", "통제", "종료"];

export function statusTone(status: WorkflowStatus): StatusTone {
  return STATUS_TONE[status];
}

/** 알림 등급 톤 — 주의 lv3 · 경계 lv4 · 심각 lv5 (계측 단계 램프와 같은 자리) */
export const ALERT_GRADE_TONE: Record<AlertGrade, { color: string; text: string; badge: "yellow" | "orange" | "red" }> = {
  주의: { color: "var(--color-risk-lv3)", text: "text-risk-lv3", badge: "yellow" },
  경계: { color: "var(--color-risk-lv4)", text: "text-risk-lv4", badge: "orange" },
  심각: { color: "var(--color-risk-lv5)", text: "text-risk-lv5", badge: "red" },
};

/* ── 종합상황 축 (초안 §3 · CSMS lib/risk-tone.ts · platform_web event-kit 문법) ──
   위험도(매트릭스 등급)와 처리(3단), 지구 상태(집계 파생)는 다른 축이다. 범례에 축 이름을 단다 */

import type { RiskGrade } from "../model/risk-matrix";
import type { EventType } from "../model/event";

/** 매트릭스 등급 톤 — HIGH·MEDIUM·LOW 자리. 판단 전은 배지를 그리지 않는다 */
export const RISK_GRADE_TONE: Record<RiskGrade, { badge: "red" | "orange" | "yellow" | "gray"; text: string; dot: string; color: string; stroke: string; halo: string }> = {
  심각: { badge: "red", text: "text-risk-lv5", dot: "bg-risk-lv5", color: "var(--color-risk-lv5)", stroke: "border-risk-lv5", halo: "ring-risk-lv5/30" },
  경계: { badge: "orange", text: "text-risk-lv4", dot: "bg-risk-lv4", color: "var(--color-risk-lv4)", stroke: "border-risk-lv4", halo: "ring-risk-lv4/30" },
  주의: { badge: "yellow", text: "text-risk-lv3", dot: "bg-risk-lv3", color: "var(--color-risk-lv3)", stroke: "border-risk-lv3", halo: "ring-risk-lv3/30" },
  관심: { badge: "gray", text: "text-foreground-muted", dot: "bg-foreground-subtle", color: "var(--color-foreground-subtle)", stroke: "border-border", halo: "ring-border/30" },
};

/** 지구 상태 — 진행 사건 최고 등급의 파생. 심각 = 위험, 그 외 활성 사건 = 주의, 없음 = 정상 */
export type DistrictStatus = "위험" | "주의" | "정상";
export const DISTRICT_STATUS_TONE: Record<DistrictStatus, { dot: string; text: string; color: string; meaning: string }> = {
  위험: { dot: "bg-risk-lv5", text: "text-risk-lv5", color: "var(--color-risk-lv5)", meaning: "진행 중인 심각 사건이 있는 지구" },
  주의: { dot: "bg-risk-lv3", text: "text-risk-lv3", color: "var(--color-risk-lv3)", meaning: "진행 중인 사건·후보가 있는 지구" },
  정상: { dot: "bg-success", text: "text-success", color: "var(--color-success)", meaning: "진행 중인 사건이 없는 지구" },
};
export const DISTRICT_STATUS_ORDER: DistrictStatus[] = ["위험", "주의", "정상"];

/** 처리 3단 — 카드·목록 표기. 상세 8종은 사건 작업공간 (초안 §3) */
export type ProcessBucket = "미확인" | "대응중" | "종료";
export function processBucket(status: WorkflowStatus): ProcessBucket {
  if (status === "후보" || status === "확인중") return "미확인";
  if (status === "확인됨" || status === "대응중" || status === "통제") return "대응중";
  return "종료";
}
export const PROCESS_BADGE: Record<ProcessBucket, "live" | "pending" | "done"> = { 미확인: "live", 대응중: "pending", 종료: "done" };

/** 이벤트 유형 축 (초안 §2 우 2) — 관측 낱개는 세지 않는다 */
export type EventCategory = "관측 임계·변화율" | "시설 상태" | "영상 분석" | "예측 갱신" | "특보" | "품질";
export const EVENT_CATEGORY_ORDER: EventCategory[] = ["예측 갱신", "관측 임계·변화율", "영상 분석", "시설 상태", "특보", "품질"];
export const EVENT_CATEGORY_COLOR: Record<EventCategory, string> = {
  "예측 갱신": "var(--color-risk-lv4)",
  "관측 임계·변화율": "var(--color-primary)",
  "영상 분석": "var(--color-primary-text)",
  "시설 상태": "var(--color-success)",
  특보: "var(--color-risk-lv3)",
  품질: "var(--color-foreground-subtle)",
};
export function eventCategoryOf(type: EventType): EventCategory | null {
  switch (type) {
    case "THRESHOLD_CROSSED": case "RATE_CHANGED": return "관측 임계·변화율";
    case "FACILITY_STATE_CHANGED": return "시설 상태";
    case "SCENE_ANALYZED": return "영상 분석";
    case "FORECAST_UPDATED": return "예측 갱신";
    case "OFFICIAL_ALERT_CHANGED": return "특보";
    case "DATA_QUALITY_CHANGED": return "품질";
    default: return null;
  }
}

/* ── 사건 작업공간 축 (초안 사건작업공간_화면상세 §5) ── */

import type { SopItemStatus } from "../model/sop";

/** 근거 종류 — 담당자 질문은 "무슨 근거인가"다. 이벤트 계층(원천·파생·분석·업무)은 화면에 노출하지 않는다 */
export type EvidenceKind = "수위" | "강우" | "조위" | "특보" | "영상" | "시설" | "예측" | "품질" | "현장";
export const EVIDENCE_KIND_ICON: Record<EvidenceKind, string> = {
  수위: "mdi:waves-arrow-up", 강우: "mdi:weather-pouring", 조위: "mdi:waves", 특보: "mdi:alert-outline", 영상: "mdi:cctv",
  시설: "mdi:pump", 예측: "mdi:chart-timeline-variant", 품질: "mdi:database-alert-outline", 현장: "mdi:account-hard-hat",
};
export function evidenceKindOf(e: { eventType: EventType; subjectId: string }): EvidenceKind {
  switch (e.eventType) {
    case "OFFICIAL_ALERT_CHANGED": return "특보";
    case "SCENE_ANALYZED": return "영상";
    case "FACILITY_STATE_CHANGED": return "시설";
    case "FORECAST_UPDATED": return e.subjectId.startsWith("TD-") ? "조위" : e.subjectId.startsWith("OM-") || e.subjectId.startsWith("RN-") ? "강우" : "예측";
    case "DATA_QUALITY_CHANGED": return "품질";
    case "FIELD_REPORT_RECORDED": return "현장";
    default: return e.subjectId.startsWith("RN-") ? "강우" : e.subjectId.startsWith("TD-") ? "조위" : "수위";
  }
}

/** SOP 상태 톤 — 아이콘 빈 원 · 회전 · 체크 · 경고 (CSMS sop-section 문법) */
export const SOP_STATUS_TONE: Record<SopItemStatus, { icon: string; text: string; spin: boolean }> = {
  대기: { icon: "mdi:circle-outline", text: "text-foreground-subtle", spin: false },
  "진행 중": { icon: "mdi:loading", text: "text-primary-text", spin: true },
  완료: { icon: "mdi:check-circle", text: "text-success", spin: false },
  실패: { icon: "mdi:alert-circle-outline", text: "text-danger", spin: false },
};
