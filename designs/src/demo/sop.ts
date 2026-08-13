/* ─────────────────────────────────────────────
 * 대응 절차(SOP) — 정본: docs/정본/04_데모_데이터.md §11 · §13 · §4-5
 *
 * 원칙: 되돌릴 수 있는 것은 자동 처리, 되돌릴 수 없는 것은 승인 후 실행(04 §11-1).
 * "수동"이라 쓰지 않는다 — 승인 한 번에 시스템이 실행하는 것이지 담당자가 전화를 돌리는
 * 것이 아니다.
 *
 * 자동 처리 = 사전 승인이 필요 없다는 뜻이지 결과 확인이 필요 없다는 뜻이 아니다.
 * 실행 조건은 항목마다 다르다 — 내부 3종은 발생·격상이 조건이라 표출 시점에 이미 끝나
 * 있고, 상급기관 보고는 등급 확정이 조건이라 승인 직후 자동으로 나간다(그리고 실패한다 · §13).
 * ───────────────────────────────────────────── */

import type { AlertLevel } from "./levels";
import { eventViewAt, type AlertEvent } from "./events";

export type SopMode = "auto" | "approval";

export interface SopItem {
  id: string;
  label: string;
  mode: SopMode;
  /** 대상 표기 — "412명" "마산합포구청" 등 */
  target: string;
  /** 이 항목이 뜨는 최저 등급 */
  minLevel: AlertLevel;
  /** 자동 처리의 실행 조건이 "등급 확정"인 항목 — 승인 전에는 조건 대기(⋯)다 */
  afterApproval?: boolean;
}

const LEVEL_RANK: Record<AlertLevel, number> = { advisory: 1, warning: 2, evacuate: 3 };

/** 해일 SOP 전체 항목 (04 §11-2 · §11-3 — 주인공 사건의 대상값) */
export const SOP_ITEMS: SopItem[] = [
  { id: "record", label: "이벤트 기록 · 격상 이력 저장", mode: "auto", target: "—", minLevel: "advisory" },
  { id: "notify", label: "담당 부서 알림", mode: "auto", target: "마산합포구 안전총괄과 4명", minLevel: "advisory" },
  { id: "cctv", label: "서항지구 CCTV 2대 집중 감시 전환", mode: "auto", target: "해안도로 · 방파제", minLevel: "advisory" },
  { id: "sms", label: "주민 긴급 재난문자 발송", mode: "approval", target: "412명", minLevel: "warning" },
  { id: "broadcast", label: "마을방송 · 전광판 송출", mode: "approval", target: "마을방송 1 · 전광판 2", minLevel: "advisory" },
  { id: "road", label: "해안도로 차단 · 대피소 개방 요청", mode: "approval", target: "마산합포구청", minLevel: "evacuate" },
  { id: "report", label: "경상남도 재난안전상황실 보고", mode: "auto", target: "—", minLevel: "warning", afterApproval: true },
];

/** 등급별 항목 (04 §11-2). 주의보 4 · 경보 6 · 대피 7 */
export function sopItemsFor(level: AlertLevel): SopItem[] {
  return SOP_ITEMS.filter((item) => LEVEL_RANK[item.minLevel] <= LEVEL_RANK[level]);
}

/* ── 실행 결과 (04 §13) ────────────────────────────────────
 * S6 [승인·실행] 뒤 채워진다. 경남 보고는 자동 처리인데 연계가 끊겨(04 §6) 실패한다 —
 * 승인 대상이 아니라서 "나갔겠거니" 하고 넘어가기 쉬운 자리가 자동 항목이라는 것이
 * 이 연출의 요지다(04 §11-1).
 * ───────────────────────────────────────────────────────── */

export interface SopResult {
  itemId: string;
  label: string;
  ok: boolean;
  /** 결과 표기 — "412명 발송" · "실패 — 연계 끊김 (09:02~)" */
  outcome: string;
  /** 실행 시각 오프셋(분) — 승인 시각 + offset */
  offsetMin: number;
}

export const HERO_SOP_RESULTS: SopResult[] = [
  { itemId: "sms", label: "주민 긴급 재난문자", ok: true, outcome: "412명 발송", offsetMin: 0 },
  { itemId: "broadcast", label: "마을방송 · 전광판", ok: true, outcome: "마을방송 1 · 전광판 2 송출", offsetMin: 0 },
  { itemId: "road", label: "해안도로 차단 · 대피소 개방 요청", ok: true, outcome: "마산합포구청 접수", offsetMin: 1 },
  { itemId: "report", label: "경상남도 재난안전상황실 보고", ok: false, outcome: "실패 — 연계 끊김 (09:02~)", offsetMin: 1 },
];

/* ── 이벤트 처리상태 (04 §4-5) ─────────────────────────────
 * 신규 → 확인중 → 대응중 → 종료. 상태 변경 버튼이 없다 — 전이는 담당자의 실제 행동
 * (열람 · 승인·실행 · 해제)에 물린다.
 * ───────────────────────────────────────────────────────── */

export type ProcessState = "신규" | "확인중" | "대응중" | "종료";

/** 주인공 사건의 확인 시각 — 17:05 발생 2분 뒤 (04 §4-2 · 최초 확인 2분) */
const HERO_CONFIRMED_AT = new Date("2026-08-12T17:07:00");
const HERO_EVENT_ID = "EVT-260812-006";

export function processStateAt(
  event: AlertEvent,
  now: Date,
  /** 주인공 사건의 승인 대응등급 — 엔진(ScenarioProvider)이 든다 */
  approvedLevel: AlertLevel | null,
): ProcessState {
  const view = eventViewAt(event, now);
  if (!view.active) return "종료";
  if (event.id === HERO_EVENT_ID) {
    if (approvedLevel) return "대응중";
    return now >= HERO_CONFIRMED_AT ? "확인중" : "신규";
  }
  /* 진행 중인 다른 사건(명동항·구항)은 담당자가 확인한 상태다 — 구항은 16:51 전파까지 나갔다 */
  return "확인중";
}
