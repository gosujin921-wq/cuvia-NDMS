/* ─────────────────────────────────────────────
 * 상황전파 — 정본: docs/정본/04_데모_데이터.md §7
 *
 * 문안은 이벤트에서 자동 작성된다. 형식과 단계별 행동 안내는 04 §7-2 에 있고,
 * 담당자가 고쳐 보낼 수 있다. 데모에서 [전파]는 실제 발송 없이 내역만 쌓는다.
 * ───────────────────────────────────────────── */

import { findDistrict } from "./districts";
import { levelSpec, type AlertLevel } from "./levels";
import type { AlertEvent } from "./events";

export type ChannelId = "sms" | "broadcast" | "sign" | "projector";

export interface ChannelSpec {
  id: ChannelId;
  label: string;
  icon: string;
}

export const CHANNELS: ChannelSpec[] = [
  { id: "sms", label: "재난문자", icon: "mdi:message-alert" },
  { id: "broadcast", label: "마을방송", icon: "mdi:bullhorn" },
  { id: "sign", label: "전광판", icon: "mdi:sign-text" },
  { id: "projector", label: "로고젝터", icon: "mdi:projector" },
];

/** 기본 선택 — 재난문자 + 마을방송 (04 §7-1) */
export const DEFAULT_CHANNELS: ChannelId[] = ["sms", "broadcast"];

/** 단계별 행동 안내 (04 §7-2) */
const ACTION_LINE: Record<AlertLevel, string> = {
  advisory: "하천·해안 접근을 자제해 주시기 바랍니다.",
  warning: "해안가 접근을 자제하고 안내 방송에 따라 주시기 바랍니다.",
  evacuate: "즉시 인근 대피소로 이동해 주시기 바랍니다.",
};

/** 이벤트에서 전파 문안을 만든다 */
export function draftMessage(event: AlertEvent): string {
  const district = findDistrict(event.districtId);
  const at = new Date(event.raisedAt);
  const when = `${at.getMonth() + 1}월 ${at.getDate()}일 ${String(at.getHours()).padStart(2, "0")}시 ${String(at.getMinutes()).padStart(2, "0")}분`;
  return `[창원시] ${when} ${district?.name ?? ""} ${event.type} ${levelSpec(event.level).label}.\n${ACTION_LINE[event.level]}`;
}

export interface DispatchRecord {
  id: string;
  /** 전파한 시각 */
  at: string;
  /** 어떤 이벤트를 알렸나 */
  summary: string;
  channels: ChannelId[];
  /** 받은 사람 수 */
  recipients: number;
}

/** 이미 나간 전파 내역 (04 §7-3) */
export const DISPATCH_HISTORY: DispatchRecord[] = [
  {
    id: "DSP-260812-003",
    at: "2026-08-12T17:24:00",
    summary: "서항지구 수위 경보",
    channels: ["sms", "broadcast"],
    recipients: 412,
  },
  {
    id: "DSP-260812-002",
    at: "2026-08-12T16:51:00",
    summary: "구항지구 수위 주의보",
    channels: ["broadcast"],
    recipients: 187,
  },
  {
    id: "DSP-260811-006",
    at: "2026-08-11T22:43:00",
    summary: "창원천 수위 대피",
    channels: ["sms", "broadcast", "sign", "projector"],
    recipients: 1043,
  },
];

/**
 * 전파 대상 인원 — 지구 규모에 따른 고정값.
 *
 * 화면에 "몇 명에게 갔는지"가 남아야 전파가 실제 행동으로 읽힌다. 실제 수신 대상은
 * 백엔드가 정하므로(03 §7), 데모에서는 지구별 고정값을 쓴다.
 */
export const RECIPIENTS: Record<string, number> = {
  bongam: 328,
  yangdeok: 145,
  guhang: 187,
  seohang: 412,
  myeongdong: 264,
  gwangryeo: 203,
  yeojwa: 176,
  changwoncheon: 1043,
  namcheon: 231,
  yongwon: 198,
  junam: 154,
  paryong: 119,
};
