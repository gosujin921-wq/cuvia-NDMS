/* ─────────────────────────────────────────────
 * 이벤트 — 정본: docs/정본/04_데모_데이터.md §4
 *
 * 시연 기준 시각은 2026-08-12 17:44 (04 §0). 발생·해제 시각은 이 시각을 기준으로 적혀 있다.
 *
 * 최근 30일(2026-07-14~08-12) 원장 **18건 전부**다. 발췌가 아니다 — SCR-01 도넛 ·
 * SCR-03 목록 · SCR-04 통계 · SCR-06 답변이 모두 이 배열 하나에서 나온다(04 §4-1).
 * 날짜가 네 무리로 뭉쳐 있는 것도 의도다: 7/16 장마 · 7/28~30 태풍 · 8/4~5 집중호우 ·
 * 8/10~12 이번 사건. 30일에 고르게 흩으면 추이 그래프가 평평해져 "언제 몰렸나"가 사라진다.
 * ───────────────────────────────────────────── */

import type { AlertLevel } from "./levels";

/** 시연 기준 시각 — 상대 시간 계산의 "지금" */
export const DEMO_NOW = new Date("2026-08-12T17:44:00");

export type EventType = "수위" | "강우" | "변위";

export interface AlertEvent {
  id: string;
  districtId: string;
  /** 이벤트를 낸 장비 (demo/devices.ts 의 ID) */
  deviceId: string;
  /** 장비 표시명 (예: 수위계 1호기) */
  device: string;
  type: EventType;
  level: AlertLevel;
  /** 발생 시각 */
  raisedAt: string;
  /** 해제 시각. 진행 중이면 null */
  clearedAt: string | null;
  /** 발생 당시 측정값 */
  value: number;
  unit: string;
}

export const EVENTS: AlertEvent[] = [
  {
    id: "EVT-260812-006",
    districtId: "seohang",
    deviceId: "seohang-WL-001",
    device: "수위계 1호기",
    type: "수위",
    level: "warning",
    raisedAt: "2026-08-12T17:22:00",
    clearedAt: null,
    value: 3.41,
    unit: "EL.m",
  },
  {
    id: "EVT-260812-005",
    districtId: "myeongdong",
    deviceId: "myeongdong-WL-001",
    device: "수위계 1호기",
    type: "수위",
    level: "advisory",
    raisedAt: "2026-08-12T17:05:00",
    clearedAt: null,
    value: 2.81,
    unit: "EL.m",
  },
  {
    id: "EVT-260812-004",
    districtId: "guhang",
    deviceId: "guhang-WL-001",
    device: "수위계 1호기",
    type: "수위",
    level: "advisory",
    raisedAt: "2026-08-12T16:48:00",
    clearedAt: null,
    value: 2.84,
    unit: "EL.m",
  },
  {
    id: "EVT-260812-003",
    districtId: "yongwon",
    deviceId: "yongwon-WL-001",
    device: "수위계 1호기",
    type: "수위",
    level: "advisory",
    raisedAt: "2026-08-12T14:10:00",
    clearedAt: "2026-08-12T15:36:00",
    value: 2.88,
    unit: "EL.m",
  },
  {
    id: "EVT-260812-002",
    districtId: "bongam",
    deviceId: "bongam-RN-001",
    device: "강우량계 1호기",
    type: "강우",
    level: "advisory",
    raisedAt: "2026-08-12T11:20:00",
    clearedAt: "2026-08-12T12:05:00",
    value: 34,
    unit: "mm/h",
  },
  {
    id: "EVT-260811-004",
    districtId: "changwoncheon",
    deviceId: "changwoncheon-WL-001",
    device: "수위계 1호기",
    type: "수위",
    level: "evacuate",
    raisedAt: "2026-08-11T22:40:00",
    clearedAt: "2026-08-12T02:15:00",
    value: 3.62,
    unit: "EL.m",
  },
  {
    id: "EVT-260811-002",
    districtId: "namcheon",
    deviceId: "namcheon-WL-001",
    device: "수위계 1호기",
    type: "수위",
    level: "warning",
    raisedAt: "2026-08-11T21:55:00",
    clearedAt: "2026-08-12T01:30:00",
    value: 3.71,
    unit: "EL.m",
  },
  {
    id: "EVT-260810-003",
    districtId: "junam",
    deviceId: "junam-DP-001",
    device: "변위계 1호기",
    type: "변위",
    level: "advisory",
    raisedAt: "2026-08-10T08:12:00",
    clearedAt: "2026-08-10T10:44:00",
    value: 11.4,
    unit: "mm",
  },
  {
    id: "EVT-260805-001",
    districtId: "seohang",
    deviceId: "seohang-WL-001",
    device: "수위계 1호기",
    type: "수위",
    level: "advisory",
    raisedAt: "2026-08-05T02:30:00",
    clearedAt: "2026-08-05T05:45:00",
    value: 2.97,
    unit: "EL.m",
  },
  {
    id: "EVT-260804-003",
    districtId: "yangdeok",
    deviceId: "yangdeok-WL-001",
    device: "수위계 1호기",
    type: "수위",
    level: "advisory",
    raisedAt: "2026-08-04T14:55:00",
    clearedAt: "2026-08-04T17:20:00",
    value: 2.18,
    unit: "EL.m",
  },
  {
    id: "EVT-260804-001",
    districtId: "bongam",
    deviceId: "bongam-RN-001",
    device: "강우량계 1호기",
    type: "강우",
    level: "warning",
    raisedAt: "2026-08-04T13:40:00",
    clearedAt: "2026-08-04T15:10:00",
    value: 52,
    unit: "mm/h",
  },
  {
    id: "EVT-260730-001",
    districtId: "paryong",
    deviceId: "paryong-WL-001",
    device: "수위계 1호기",
    type: "수위",
    level: "advisory",
    raisedAt: "2026-07-30T06:25:00",
    clearedAt: "2026-07-30T08:15:00",
    value: 1.82,
    unit: "EL.m",
  },
  {
    id: "EVT-260729-003",
    districtId: "guhang",
    deviceId: "guhang-WL-001",
    device: "수위계 1호기",
    type: "수위",
    level: "advisory",
    raisedAt: "2026-07-29T04:02:00",
    clearedAt: "2026-07-29T07:50:00",
    value: 2.86,
    unit: "EL.m",
  },
  {
    id: "EVT-260729-001",
    districtId: "seohang",
    deviceId: "seohang-WL-001",
    device: "수위계 1호기",
    type: "수위",
    level: "evacuate",
    raisedAt: "2026-07-29T03:15:00",
    clearedAt: "2026-07-29T08:40:00",
    value: 4.26,
    unit: "EL.m",
  },
  {
    id: "EVT-260728-002",
    districtId: "seohang",
    deviceId: "seohang-WL-001",
    device: "수위계 1호기",
    type: "수위",
    level: "warning",
    raisedAt: "2026-07-28T21:10:00",
    clearedAt: "2026-07-29T01:25:00",
    value: 3.47,
    unit: "EL.m",
  },
  {
    id: "EVT-260718-001",
    districtId: "yeojwa",
    deviceId: "yeojwa-RN-001",
    device: "강우량계 1호기",
    type: "강우",
    level: "advisory",
    raisedAt: "2026-07-18T15:05:00",
    clearedAt: "2026-07-18T16:30:00",
    value: 32,
    unit: "mm/h",
  },
  {
    id: "EVT-260716-002",
    districtId: "bongam",
    deviceId: "bongam-WL-001",
    device: "수위계 1호기",
    type: "수위",
    level: "advisory",
    raisedAt: "2026-07-16T05:40:00",
    clearedAt: "2026-07-16T09:12:00",
    value: 3.52,
    unit: "EL.m",
  },
  {
    id: "EVT-260716-001",
    districtId: "gwangryeo",
    deviceId: "gwangryeo-WL-001",
    device: "수위계 1호기",
    type: "수위",
    level: "advisory",
    raisedAt: "2026-07-16T04:20:00",
    clearedAt: "2026-07-16T07:05:00",
    value: 2.02,
    unit: "EL.m",
  },
];

/** 진행 중인 이벤트 — 해제 시각이 없는 것 */
export const ACTIVE_EVENTS = EVENTS.filter((e) => e.clearedAt === null);

/** 지구별 진행 중 이벤트. 지도·목록에서 지구를 단계 색으로 세울 때 쓴다 */
export function activeEventOf(districtId: string): AlertEvent | undefined {
  return ACTIVE_EVENTS.find((e) => e.districtId === districtId);
}

/** 장비별 진행 중 이벤트. 그 장비 자리에 이벤트 핀을 세울지 판단한다 (03 §0-5) */
export function activeEventOfDevice(deviceId: string): AlertEvent | undefined {
  return ACTIVE_EVENTS.find((e) => e.deviceId === deviceId);
}

/* ── 최근 30일 통계 (04 §4-3) ──────────────────────────────
 * **집계 상수를 두지 않는다.** 위 원장 하나에서 센다 — 상수와 원장이 갈라지면 같은
 * 30일을 SCR-01 도넛과 SCR-03 목록이 다르게 센다. 원장에 한 건을 더하면 도넛이 따라온다.
 *
 * 단계별 집계는 **지금 화면 시계까지 확정된 단계**로 센다. 주인공 사건(EVT-260812-006)의
 * 단계가 시연 도중 움직이므로 S0(주의보)과 지금(경보)의 숫자가 다르다. 버그가 아니라
 * 사건이 진행한 결과다 (04 §4-3).
 * ───────────────────────────────────────────────────────── */

export const STATS_PERIOD_DAYS = 30;

function countBy<K extends string | number>(pick: (event: AlertEvent) => K): Map<K, number> {
  const acc = new Map<K, number>();
  for (const event of EVENTS) {
    const key = pick(event);
    acc.set(key, (acc.get(key) ?? 0) + 1);
  }
  return acc;
}

const TYPE_ORDER: EventType[] = ["수위", "강우", "변위"];
const LEVEL_ORDER: AlertLevel[] = ["advisory", "warning", "evacuate"];

export const STATS_BY_TYPE: { type: EventType; count: number }[] = (() => {
  const counted = countBy((event) => event.type);
  return TYPE_ORDER.map((type) => ({ type, count: counted.get(type) ?? 0 }));
})();

export const STATS_BY_LEVEL: { level: AlertLevel; count: number }[] = (() => {
  const counted = countBy((event) => event.level);
  return LEVEL_ORDER.map((level) => ({ level, count: counted.get(level) ?? 0 }));
})();

export const STATS_TOTAL = EVENTS.length;
