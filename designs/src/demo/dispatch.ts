/* ─────────────────────────────────────────────
 * 상황전파 — 정본: docs/정본/04_데모_데이터.md §7
 *
 * 문안은 이벤트에서 자동 작성된다. 형식과 단계별 행동 안내는 04 §7-2 에 있고,
 * 담당자가 고쳐 보낼 수 있다. 데모에서 [전파]는 실제 발송 없이 내역만 쌓는다.
 * ───────────────────────────────────────────── */

import { findDistrict } from "./districts";
import { levelSpec, type AlertLevel } from "./levels";
import { eventViewAt, type AlertEvent } from "./events";
import type { TideScenario } from "./forecast";

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

/** 등급별 기본 선택 (04 §7-1) — 주의보 방송 → 경보 +문자 → 대피 +전광판.
 *  로고젝터는 기본에서 뺀다 — 담당자가 필요 시 더하는 선택 수단이다 */
export function defaultChannelsFor(level: AlertLevel): ChannelId[] {
  if (level === "advisory") return ["broadcast"];
  if (level === "warning") return ["sms", "broadcast"];
  return ["sms", "broadcast", "sign"];
}

/** 단계별 행동 안내 (04 §7-2) */
const ACTION_LINE: Record<AlertLevel, string> = {
  advisory: "하천·해안 접근을 자제해 주시기 바랍니다.",
  warning: "해안가 접근을 자제하고 안내 방송에 따라 주시기 바랍니다.",
  evacuate: "즉시 인근 대피소로 이동해 주시기 바랍니다.",
};

/**
 * 이벤트에서 전파 문안을 만든다 — 문안은 계측 단계가 아니라 **승인 대응등급**을 따른다(04 §7-2).
 *
 * 등급이 조건 시나리오에서 올라온 경우(effective > 계측) 형식이 바뀐다 —
 * `[창원시] {도달 예상 시각} 만조 조건에서 {지구명} 침수 우려.` 발생 시각이 아니라
 * 도달 예상 시각을 쓰고, "예상"으로 단정하지 않고 "우려"로 쓴다. 화면이 지키는
 * 조건 시나리오 어법(04 §10)을 주민 문자만 어길 수 없다.
 */
export function draftMessage(
  event: AlertEvent,
  now: Date,
  options: { effectiveLevel?: AlertLevel; scenario?: TideScenario | null } = {},
): string {
  const district = findDistrict(event.districtId);
  const view = eventViewAt(event, now);
  const level = options.effectiveLevel ?? view.level;

  const RANK: Record<AlertLevel, number> = { advisory: 1, warning: 2, evacuate: 3 };
  if (options.scenario && RANK[level] > RANK[view.level]) {
    const at = new Date(options.scenario.peakAt);
    const when = `${at.getMonth() + 1}월 ${at.getDate()}일 ${String(at.getHours()).padStart(2, "0")}시 ${String(at.getMinutes()).padStart(2, "0")}분`;
    return `[창원시] ${when} 만조 조건에서 ${district?.name ?? ""} 침수 우려.\n${ACTION_LINE[level]}`;
  }

  const at = new Date(view.stageAt);
  const when = `${at.getMonth() + 1}월 ${at.getDate()}일 ${String(at.getHours()).padStart(2, "0")}시 ${String(at.getMinutes()).padStart(2, "0")}분`;
  return `[창원시] ${when} ${district?.name ?? ""} ${event.type} ${levelSpec(level).label}.\n${ACTION_LINE[level]}`;
}

export interface DispatchRecord {
  id: string;
  /** 전파한 시각 */
  at: string;
  /** 대상 이벤트 — 전파 기록은 이벤트에 붙는다(04 §7-3). "언제 난 사건을 몇 분 만에
   *  알렸나"가 계산되려면 이 연결이 있어야 한다. 시연 중 쌓는 기록도 채운다 */
  eventId?: string;
  /** 어떤 이벤트를 알렸나 */
  summary: string;
  channels: ChannelId[];
  /** 받은 사람 수 */
  recipients: number;
  /** 발생 → 전파 소요(분). SCR-04 대응 KPI(평균 3.8분)가 여기서 나온다 */
  durationMin?: number;
}

/** 이미 나간 전파 내역 (04 §7-3) */
export const DISPATCH_HISTORY: DispatchRecord[] = [
  {
    /* 주인공 사건의 주의보 단계 전파(04 §7-3). 대피 전파는 사전 내역에 없다 —
       시연 S6 에서 담당자가 승인해 쌓는 것이 첫 대피 전파다. 주의보=방송 한 갈래 →
       대피=문자+방송+전광판, 등급이 오르면 알리는 폭이 넓어지는 대비가 여기서 선다 */
    id: "DSP-260812-003",
    at: "2026-08-12T17:09:00",
    eventId: "EVT-260812-006",
    summary: "서항지구 수위 주의보",
    channels: ["broadcast"],
    recipients: 412,
    durationMin: 4,
  },
  {
    id: "DSP-260812-002",
    at: "2026-08-12T16:51:00",
    eventId: "EVT-260812-004",
    summary: "구항지구 수위 주의보",
    channels: ["broadcast"],
    recipients: 187,
    durationMin: 3,
  },
  {
    id: "DSP-260811-006",
    at: "2026-08-11T22:43:00",
    eventId: "EVT-260811-004",
    summary: "창원천 수위 대피",
    channels: ["sms", "broadcast", "sign", "projector"],
    recipients: 1043,
    durationMin: 3,
  },
  {
    id: "DSP-260811-003",
    at: "2026-08-11T21:59:00",
    eventId: "EVT-260811-002",
    summary: "남천 수위 경보",
    channels: ["sms", "broadcast"],
    recipients: 231,
    durationMin: 4,
  },
  {
    id: "DSP-260805-001",
    at: "2026-08-05T02:35:00",
    eventId: "EVT-260805-001",
    summary: "서항지구 수위 주의보",
    channels: ["broadcast"],
    recipients: 412,
    durationMin: 5,
  },
  {
    id: "DSP-260804-002",
    at: "2026-08-04T13:43:00",
    eventId: "EVT-260804-001",
    summary: "봉암지구 강우 경보",
    channels: ["sms", "broadcast"],
    recipients: 328,
    durationMin: 3,
  },
  {
    id: "DSP-260730-001",
    at: "2026-07-30T06:31:00",
    eventId: "EVT-260730-001",
    summary: "팔용지구 수위 주의보",
    channels: ["broadcast"],
    recipients: 119,
    durationMin: 6,
  },
  {
    id: "DSP-260729-004",
    at: "2026-07-29T04:07:00",
    eventId: "EVT-260729-003",
    summary: "구항지구 수위 주의보",
    channels: ["broadcast"],
    recipients: 187,
    durationMin: 5,
  },
  {
    id: "DSP-260729-002",
    at: "2026-07-29T03:17:00",
    eventId: "EVT-260729-001",
    summary: "서항지구 수위 대피",
    channels: ["sms", "broadcast", "sign", "projector"],
    recipients: 412,
    durationMin: 2,
  },
  {
    id: "DSP-260728-003",
    at: "2026-07-28T21:13:00",
    eventId: "EVT-260728-002",
    summary: "서항지구 수위 경보",
    channels: ["sms", "broadcast"],
    recipients: 412,
    durationMin: 3,
  },
  {
    id: "DSP-260718-001",
    at: "2026-07-18T15:09:00",
    eventId: "EVT-260718-001",
    summary: "여좌천 강우 주의보",
    channels: ["broadcast"],
    recipients: 176,
    durationMin: 4,
  },
  {
    id: "DSP-260716-003",
    at: "2026-07-16T05:44:00",
    eventId: "EVT-260716-002",
    summary: "봉암지구 수위 주의보",
    channels: ["broadcast"],
    recipients: 328,
    durationMin: 4,
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
