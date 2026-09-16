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
  대응중: { badge: "live", color: "var(--color-risk-lv5)", dot: "bg-risk-lv5", text: "text-risk-lv5", pulse: true, meaning: "담당자가 사건으로 판단 · SOP 조치 진행" },
  종료: { badge: "done", color: "var(--color-foreground-subtle)", dot: "bg-foreground-subtle", text: "text-foreground-subtle", pulse: false, meaning: "종료 조건 충족" },
  오탐: { badge: "offline", color: "var(--color-foreground-subtle)", dot: "bg-foreground-subtle", text: "text-foreground-subtle", pulse: false, meaning: "시험·중복·오경보 판정" },
  병합됨: { badge: "offline", color: "var(--color-foreground-subtle)", dot: "bg-foreground-subtle", text: "text-foreground-subtle", pulse: false, meaning: "기준 사건에 흡수" },
};

/** 범례 순서 — 담당자가 밟는 순서. 오탐·병합됨은 예외 경로라 범례에 세우지 않는다 */
export const LEGEND_STATUSES: WorkflowStatus[] = ["후보", "확인중", "대응중", "종료"];

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

/** 지구 상태 — 진행 사건 최고 등급의 파생. 등급 램프를 그대로 쓴다: 심각 · 경계 · 주의, 없음 = 정상.
 *  전에는 심각 = 위험, 경계·주의 = 주의로 3단이었는데 경계 사건 지구가 지도·목록에서는 노랑, 카드에서는 주황이 되어
 *  같은 사건이 화면 안에서 두 색으로 갈렸다. 램프를 하나로 합쳤다(사용자 결정, 2026-09-14) */
export type DistrictStatus = "심각" | "경계" | "주의" | "정상";
/** 점·글자·CSS 색·테두리·후광이 한 상태에서 같은 색이다. 지도 핀·목록 줄·범례·지구 현황이 이 표 하나를 문다.
 *  심각·경계·주의는 RISK_GRADE_TONE 과 같은 토큰이라 사건 카드의 등급 색과 일치한다 */
export const DISTRICT_STATUS_TONE: Record<DistrictStatus, { dot: string; text: string; color: string; stroke: string; halo: string; meaning: string }> = {
  심각: { dot: "bg-risk-lv5", text: "text-risk-lv5", color: "var(--color-risk-lv5)", stroke: "border-risk-lv5", halo: "ring-risk-lv5/30", meaning: "심각 사건이나 심각 알림이 있는 지구" },
  경계: { dot: "bg-risk-lv4", text: "text-risk-lv4", color: "var(--color-risk-lv4)", stroke: "border-risk-lv4", halo: "ring-risk-lv4/30", meaning: "경계 사건이나 경계 알림이 있는 지구" },
  주의: { dot: "bg-risk-lv3", text: "text-risk-lv3", color: "var(--color-risk-lv3)", stroke: "border-risk-lv3", halo: "ring-risk-lv3/30", meaning: "주의 사건·후보나 주의 알림이 있는 지구" },
  /* 정상은 색을 세우지 않는다 · 12곳이 전부 초록이면 색이 신호가 아니라 배경이 된다. 지도 점과 목록 점이 같은 회색이다
     (사용자 결정, 2026-09-14 · 초록 ↔ 회색 중 회색) */
  정상: { dot: "bg-foreground-subtle", text: "text-foreground-muted", color: "var(--color-foreground-subtle)", stroke: "border-border", halo: "ring-border/30", meaning: "진행 중인 사건·알림이 없는 지구" },
};
export const DISTRICT_STATUS_ORDER: DistrictStatus[] = ["심각", "경계", "주의", "정상"];

/** 처리 3단 — 카드·목록 표기. 상세 8종은 사건 작업공간 (초안 §3) */
export type ProcessBucket = "미확인" | "대응중" | "종료";
export function processBucket(status: WorkflowStatus): ProcessBucket {
  if (status === "후보" || status === "확인중") return "미확인";
  if (status === "대응중") return "대응중";
  return "종료";
}
export const PROCESS_BADGE: Record<ProcessBucket, "live" | "pending" | "done"> = { 미확인: "live", 대응중: "pending", 종료: "done" };

/** 이벤트 유형 축 (초안 §2 우 2) — 관측 낱개는 세지 않는다 */
/* 화면 문구 규칙(2026-09-14 결정): 모델의 `품질`(quality)은 내부 계약이고 화면은 `데이터 상태`라 부른다.
   담당자에게 품질은 계측 정밀도로 읽히는데 우리가 말하는 것은 도착(지연·결측)과 값(의심·보정)의 상태다 */
export type EventCategory = "관측 임계·변화율" | "시설 상태" | "영상 분석" | "예측 갱신" | "특보" | "데이터 상태";
export const EVENT_CATEGORY_ORDER: EventCategory[] = ["예측 갱신", "관측 임계·변화율", "영상 분석", "시설 상태", "특보", "데이터 상태"];
export const EVENT_CATEGORY_COLOR: Record<EventCategory, string> = {
  "예측 갱신": "var(--color-risk-lv4)",
  "관측 임계·변화율": "var(--color-primary)",
  "영상 분석": "var(--color-primary-text)",
  "시설 상태": "var(--color-success)",
  특보: "var(--color-risk-lv3)",
  "데이터 상태": "var(--color-foreground-subtle)",
};
export function eventCategoryOf(type: EventType): EventCategory | null {
  switch (type) {
    case "THRESHOLD_CROSSED": case "RATE_CHANGED": return "관측 임계·변화율";
    case "FACILITY_STATE_CHANGED": return "시설 상태";
    case "SCENE_ANALYZED": return "영상 분석";
    case "FORECAST_UPDATED": return "예측 갱신";
    case "OFFICIAL_ALERT_CHANGED": return "특보";
    case "DATA_QUALITY_CHANGED": return "데이터 상태";
    default: return null;
  }
}

/* ── 사건 작업공간 축 (초안 사건작업공간_화면상세 §5) ── */

import type { SopItemStatus } from "../model/sop";

/** 근거 종류 — 담당자 질문은 "무슨 근거인가"다. 이벤트 계층(원천·파생·분석·업무)은 화면에 노출하지 않는다 */
export type EvidenceKind = "수위" | "강우" | "조위" | "특보" | "영상" | "시설" | "예측" | "데이터" | "현장";
export const EVIDENCE_KIND_ICON: Record<EvidenceKind, string> = {
  수위: "mdi:waves-arrow-up", 강우: "mdi:weather-pouring", 조위: "mdi:waves", 특보: "mdi:alert-outline", 영상: "mdi:cctv",
  시설: "mdi:pump", 예측: "mdi:chart-timeline-variant", 데이터: "mdi:database-alert-outline", 현장: "mdi:account-hard-hat",
};
export function evidenceKindOf(e: { eventType: EventType; subjectId: string }): EvidenceKind {
  switch (e.eventType) {
    case "OFFICIAL_ALERT_CHANGED": return "특보";
    case "SCENE_ANALYZED": return "영상";
    case "FACILITY_STATE_CHANGED": return "시설";
    case "FORECAST_UPDATED": return e.subjectId.startsWith("TD-") ? "조위" : e.subjectId.startsWith("OM-") || e.subjectId.startsWith("RN-") ? "강우" : "예측";
    case "DATA_QUALITY_CHANGED": return "데이터";
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

/** 매트릭스 지표 화면 문구 — `품질` 지표는 `데이터 상태`로 */
export function indicatorLabel(indicator: string): string {
  return indicator === "품질" ? "데이터 상태" : indicator;
}
/** 알림 종류·역할 화면 문구 — 정본 이름은 그대로, 화면만 `데이터 상태` */
export function alertKindLabel(kind: string): string {
  return kind === "품질·연계" ? "데이터 상태" : kind;
}
export function alertRoleLabel(role: string): string {
  return role === "품질·대체 확인 알림" ? "데이터 상태 · 대체 확인 알림" : role;
}

/** 매트릭스 구간명 화면 문구 — 규칙표 용어를 사람 말로. 구간 기준은 툴팁 몫 */
export const BAND_LABEL: Record<string, string> = {
  "급상승·기준 진입": "급상승", "만관·침수": "만관·침수", "상승": "상승", "정상": "정상",
  "경보": "호우경보", "주의보": "호우주의보", "약함": "약함", "극한": "극한 강우",
  "물고임 추정": "물고임", "침수 확인": "침수 확인", "이상 없음": "이상 없음", "미확인": "영상 미확인",
  "제약": "배수 제약", "심각 제약": "배수 심각", "양호": "양호",
  "통행 불가·시설 영향": "통행 불가", "통행 지장": "통행 지장", "영향 없음": "영향 없음",
  "일부 지연": "일부 지연", "결측": "결측",
};
export function bandLabel(band: string): string {
  return BAND_LABEL[band] ?? band;
}

/* ── 이력·통계 축 (IA §10 · 2026-09-16) ──
   처리상태 여섯을 읽는 쪽 넷으로 접은 것(model/records RecordStatus). 진행 중만 살아 있는 색이고 나머지는 닫힌 색이다 */

import type { RecordStatus } from "../model/records";

export const RECORD_STATUS_TONE: Record<RecordStatus, { badge: "live" | "done" | "offline"; meaning: string }> = {
  "진행 중": { badge: "live", meaning: "아직 닫히지 않은 사건" },
  종료: { badge: "done", meaning: "종료 조건을 채우고 닫힌 사건" },
  오탐: { badge: "offline", meaning: "시험·오경보로 닫힌 사건" },
  병합: { badge: "offline", meaning: "기준 사건에 흡수된 사건" },
};

/** 조치·전파 결과 뱃지 — 이력의 대응 절과 경과 타임라인이 같은 색을 쓴다. 실패·미응답만 위험색 */
import type { ActionStatus } from "../model/response";
export const ACTION_RESULT_BADGE: Partial<Record<ActionStatus, "green" | "red" | "yellow" | "gray" | "blue">> = {
  성공: "green", 실패: "red", 미응답: "red", 확인대기: "yellow", 대체됨: "gray", 취소: "gray", 진행중: "blue",
};
