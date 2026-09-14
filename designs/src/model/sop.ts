/* ─────────────────────────────────────────────
 * SOP 항목 — 대응 탭이 읽는 한 줄의 계약 (초안 사건작업공간_화면상세 §3 대응 · §5, 결정 2026-09-14)
 *
 * 구조는 CSMS 판단 팝업 SOP 대응 탭(sop-section.tsx · response-chain.tsx)을 따른다. 두 축을 동시에 든다:
 *   우선순위  MUST / SHOULD / MAY   · 얼마나 급한가
 *   실행방식  자동 / 수동            · 누가 하는가
 * 상태는 네 값이다. 실패는 자동 항목에도 생기고 재시도·대체조치는 사람이 누른다.
 * 미응답·확인대기·대체됨·취소(Action 8종)는 상태를 늘리지 않고 상태 칸 문구·줄 아래 상세로 적는다.
 *
 * ★ 이 파일은 타입과 표기만 든다. 값은 model/selectors.ts 가 권고·결정·조치·전파 이벤트를 현재 시계로
 *   잘라 만든다. 항목 목록(무엇이 SOP 에 서는가)은 fixtures 의 SOP 카탈로그가 든다.
 * ───────────────────────────────────────────── */

export type SopPriority = "MUST" | "SHOULD" | "MAY";
export const SOP_PRIORITY_ORDER: SopPriority[] = ["MUST", "SHOULD", "MAY"];
export const SOP_PRIORITY_BADGE: Record<SopPriority, "red" | "yellow" | "gray"> = { MUST: "red", SHOULD: "yellow", MAY: "gray" };

export type SopExecMode = "자동" | "수동";

export type SopItemStatus = "대기" | "진행 중" | "완료" | "실패";

/**
 * 대응 흐름 4단계 — CSMS 본사 → 현장 체인의 단계 키·상태 4값·상태 문구를 그대로 쓰고 이름만 NDMS 담당으로 준다.
 *   HQ      상황실 관제 · 항목이 아니라 처리상태에서 파생한다
 *   AGENCY  담당기관   · 조치 담당 부서 통보 자동 항목
 *   PUBLIC  주민 전파  · CAP 문안 전파 항목
 *   FIELD   현장 조치  · 현장이 수행하는 수동 항목. MUST 가 전부 끝나야 완료
 */
export type ChainStage = "HQ" | "AGENCY" | "PUBLIC" | "FIELD";
export const CHAIN_STAGES: ChainStage[] = ["HQ", "AGENCY", "PUBLIC", "FIELD"];
export const CHAIN_ACTOR: Record<ChainStage, string> = { HQ: "상황실 관제", AGENCY: "담당기관", PUBLIC: "주민 전파", FIELD: "현장 조치" };
export const CHAIN_NOTE: Record<ChainStage, Record<SopItemStatus, string>> = {
  HQ: { 대기: "대기", "진행 중": "확인 중", 완료: "상황 확인", 실패: "-" },
  AGENCY: { 대기: "대기", "진행 중": "전달 중", 완료: "수신 완료", 실패: "응답 없음" },
  PUBLIC: { 대기: "대기", "진행 중": "전파 중", 완료: "경고 전파", 실패: "전파 실패" },
  FIELD: { 대기: "대기", "진행 중": "조치 중", 완료: "조치 완료", 실패: "-" },
};

export interface ChainStageView {
  stage: ChainStage;
  actor: string;
  state: SopItemStatus;
  note: string;
}

/** 수신자·채널 한 줄 — 담당기관 통보의 부서, 주민 전파의 채널 */
export interface SopRecipient {
  name: string;
  sent: "완료" | "실패" | "대기" | "확인 대기";
  detail?: string;
  at?: string;
  /** 실패 뒤 대체조치 — 기록되면 실패 줄 아래 붙는다. 실패 기록은 남는다 */
  fallback?: { channel: string; detail: string; at?: string; done: boolean };
}

export interface SopItem {
  id: string;
  label: string;
  priority: SopPriority;
  execMode: SopExecMode;
  status: SopItemStatus;
  chain?: ChainStage;
  /** 수동 조치의 담당 — 조치의 일부다 */
  assignee?: string;
  organization?: string;
  /** 상태가 마지막으로 바뀐 시각 */
  at?: string;
  /** 상태 칸 아래 한 줄 */
  detail?: string;
  /** 실패 사유 — 실패일 때 detail 대신 선다 */
  failReason?: string;
  recipients?: SopRecipient[];
  /** 시설 항목 — 가동 여부 한 줄 */
  facility?: { label: string; engaged: boolean };
  /** 이 항목이 묶인 Action (수동) */
  actionId?: string;
  /** 승인에 집중 확인이 필요한가 — 주민 전파는 CAP 문안 확인창을 거친다 */
  confirm?: "cap";
  /** 실패 뒤 담당자가 누를 수 있는 대체조치 — 아직 기록 전일 때만 */
  fallbackAvailable?: boolean;
}

export function sopProgress(items: SopItem[]): { done: number; total: number; pct: number } {
  const total = items.length;
  const done = items.filter((i) => i.status === "완료").length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}
