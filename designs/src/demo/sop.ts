/* ─────────────────────────────────────────────
 * 대응 절차(SOP) — 배경: docs/레거시/정본/04_데모_데이터.md §11 · §13 · §4-5
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
import { activeEventsAt, eventViewAt, type AlertEvent, type HazardType } from "./events";

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

/** 내수침수 SOP (04 §15-10 · 트랙 B) — 해일 7항목에 **배수펌프장 가동 상태 확인**이
 *  더해진 8항목이다. 내수 지구에만 있는 항목이고, "물이 왜 안 빠지나"를 절차가 직접
 *  묻는 자리다. 통제 대상도 해안도로가 아니라 저지대 도로다 */
export const FLOOD_SOP_ITEMS: SopItem[] = [
  { id: "record", label: "이벤트 기록 · 격상 이력 저장", mode: "auto", target: "—", minLevel: "advisory" },
  { id: "notify", label: "담당 부서 알림", mode: "auto", target: "마산회원구 안전총괄과 5명", minLevel: "advisory" },
  { id: "cctv", label: "봉암지구 CCTV 3대 집중 감시 전환", mode: "auto", target: "배수문 · 수로 합류부 · 저지대 도로", minLevel: "advisory" },
  { id: "pump", label: "배수펌프장 가동 상태 확인 요청", mode: "auto", target: "봉암 배수펌프장", minLevel: "advisory" },
  { id: "sms", label: "주민 긴급 재난문자 발송", mode: "approval", target: "328명", minLevel: "warning" },
  { id: "broadcast", label: "마을방송 · 전광판 송출", mode: "approval", target: "마을방송 3 · 전광판 2", minLevel: "advisory" },
  { id: "road", label: "저지대 도로 통제 · 대피소 개방 요청", mode: "approval", target: "마산회원구청", minLevel: "evacuate" },
  { id: "report", label: "경상남도 재난안전상황실 보고", mode: "auto", target: "—", minLevel: "warning", afterApproval: true },
];

/** 등급별 항목 (04 §11-2 · §15-10). 재난유형이 절차를 고르고, 등급이 그중 몇 줄이
 *  설지를 고른다. 해일 주의보 4 · 경보 6 · 대피 7 / 내수침수 대피 8 */
export function sopItemsFor(level: AlertLevel, hazardType?: HazardType): SopItem[] {
  const items = hazardType === "내수침수" ? FLOOD_SOP_ITEMS : SOP_ITEMS;
  return items.filter((item) => LEVEL_RANK[item.minLevel] <= LEVEL_RANK[level]);
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

/**
 * 내수침수 실행 결과 (04 §15-11 · 트랙 B).
 *
 * 실패가 **목록 가운데** 선다. 서항은 맨 아래(경남 보고 · 행정 연계)였고 여기는
 * 가운데(CCTV · 현장 장비)다 — 자동 항목이라 승인 대상이 아니었고, 그래서 짚기
 * 전까지 아무도 안 본다는 것이 이 배치의 요지다.
 *
 * 통신 장애만으로 원인을 확정하지 않는다. `원인 확인 중`으로 두고, 사건 이력에
 * 현장 확인 결과가 들어온 뒤에만 침수 영향으로 확정한다(봉암 대본 S7 주의).
 */
export const BONGAM_SOP_RESULTS: SopResult[] = [
  { itemId: "record", label: "이벤트 기록", ok: true, outcome: "내수침수 경보 격상 08:52 저장", offsetMin: 0 },
  { itemId: "notify", label: "담당 부서 알림", ok: true, outcome: "마산회원구 안전총괄과 5명", offsetMin: 0 },
  { itemId: "cctv", label: "CCTV 집중 감시 전환", ok: false, outcome: "실패 — 2/3대 · 수로 합류부 CCTV 통신끊김 (08:58~) · 원인 확인 중", offsetMin: 1 },
  { itemId: "pump", label: "배수펌프장 가동 상태 확인", ok: true, outcome: "3대 전량 가동 중 (07:52~) · 배수문 폐쇄 08:47", offsetMin: 1 },
  { itemId: "sms", label: "주민 긴급 재난문자", ok: true, outcome: "328명 발송", offsetMin: 1 },
  { itemId: "broadcast", label: "마을방송 · 전광판", ok: true, outcome: "마을방송 3 · 전광판 2 송출", offsetMin: 2 },
  { itemId: "road", label: "저지대 도로 통제 · 대피소 개방 요청", ok: true, outcome: "마산회원구청 접수", offsetMin: 2 },
  { itemId: "report", label: "경상남도 재난안전상황실 보고", ok: true, outcome: "접수 09:19", offsetMin: 2 },
];

/** 재난유형이 결과표를 고른다 (04 §13 · §15-11) */
export function sopResultsFor(hazardType?: HazardType): SopResult[] {
  return hazardType === "내수침수" ? BONGAM_SOP_RESULTS : HERO_SOP_RESULTS;
}

/* ── 이벤트 처리상태 (04 §4-5) ─────────────────────────────
 * 신규 → 확인중 → 대응중 → 종료. 상태 변경 버튼이 없다 — 전이는 담당자의 실제 행동
 * (열람 · 승인·실행 · 해제)에 물린다.
 * ───────────────────────────────────────────────────────── */

export type ProcessState = "신규" | "확인중" | "대응중" | "종료";

/** 주인공 사건의 확인 시각 — 17:05 발생 2분 뒤 (04 §4-2 · 최초 확인 2분) */
export const HERO_CONFIRMED_AT = new Date("2026-08-12T17:07:00");
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

/** SCR-01 상단 요약의 "확인 필요" (04 §4-7). 진행 중 가운데 처리상태가 신규·확인중인
 *  사건 수. 아직 대응(승인·실행)에 들어가지 않은 것이다. 처리상태의 집계지 새 축이 아니다 */
export function needsConfirmCountAt(now: Date, approvedLevel: AlertLevel | null): number {
  return activeEventsAt(now).filter((event) => {
    const state = processStateAt(event, now, approvedLevel);
    return state === "신규" || state === "확인중";
  }).length;
}
