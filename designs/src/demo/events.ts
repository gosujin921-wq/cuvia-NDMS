/* ─────────────────────────────────────────────
 * 이벤트 — 정본: docs/정본/04_데모_데이터.md §4
 *
 * "지금"은 이 파일에 없다 — 시나리오 시계(state/ScenarioProvider)가 단일 source of truth 고,
 * 이 파일은 원장(정적 사실)과 now 를 받아 자르는 파생 함수만 든다 (CLAUDE.md).
 *
 * 최근 30일(2026-07-14~08-12) 원장 **18건 전부**다. 발췌가 아니다 — SCR-01 도넛 ·
 * SCR-03 목록 · SCR-04 통계 · SCR-06 답변이 모두 이 배열 하나에서 나온다(04 §4-1).
 * 날짜가 네 무리로 뭉쳐 있는 것도 의도다: 7/16 장마 · 7/28~30 태풍 · 8/4~5 집중호우 ·
 * 8/10~12 이번 사건. 30일에 고르게 흩으면 추이 그래프가 평평해져 "언제 몰렸나"가 사라진다.
 *
 * 주인공 사건(EVT-260812-006)만 단계가 움직인다(04 §4-2). stages 가 그 이력이고,
 * 화면이 보는 단계·측정값은 eventViewAt(event, now) 로 자른다 — 원장 필드를 직접 읽지 않는다.
 * ───────────────────────────────────────────── */

import type { AlertLevel } from "./levels";

/** 정적 앵커 — 월 경계·예보 슬롯 등 시연 중 변하지 않는 달력 계산에만 쓴다.
 *  "지금"으로 쓰지 않는다 — 지금은 ScenarioProvider.now 다 */
export const DEMO_DAY = new Date("2026-08-12T17:16:00");

export type EventType = "수위" | "강우" | "변위";

/* ── 재난 분류 (04 §4-0) ──────────────────────────────────
 * 재난 분야 → 재난유형(위험현상) → 관측 → 계측 단계.
 * 분야는 필터·그룹 축이고 도넛·집계는 유형 축이다 — 분야로 도넛을 돌리면
 * 풍수해 17 / 산지·지반 1 로 사실상 단색이 된다.
 * 분류 기준은 시설이 아니라 발생 현상 — 주남 변위는 저수지 지구지만 산지·지반이다.
 * ───────────────────────────────────────────────────────── */

export type HazardType = "폭풍해일" | "하천범람" | "내수침수" | "집중호우" | "지반변위";
export type HazardField = "풍수해" | "기상·기후" | "수자원" | "산지·지반";

/** 분야는 유형에서 1:1 로 정해진다. 데이터 필드는 둘 다 갖되 원장 표기는 유형만 적는다 */
export const HAZARD_FIELD: Record<HazardType, HazardField> = {
  폭풍해일: "풍수해",
  하천범람: "풍수해",
  내수침수: "풍수해",
  집중호우: "풍수해",
  지반변위: "산지·지반",
};

export const HAZARD_ORDER: HazardType[] = ["폭풍해일", "하천범람", "내수침수", "집중호우", "지반변위"];

/** 표시명 규칙(04 §4-0) — 하천범람·내수침수는 센서 임계 초과지 확인된 범람·침수가 아니라
 *  "위험"을 붙여 표시한다. 폭풍해일(특보)·집중호우(실측)·지반변위(실측)는 그대로 쓴다 */
export function hazardLabel(type: HazardType): string {
  return type === "하천범람" || type === "내수침수" ? `${type} 위험` : type;
}

/** 단계 이력의 한 행 (04 §4-2) — at 시각에 이 단계·측정값이 됐다 */
export interface StageChange {
  at: string;
  level: AlertLevel;
  value: number;
}

export interface AlertEvent {
  id: string;
  districtId: string;
  /** 이벤트를 낸 장비 (demo/devices.ts 의 ID) */
  deviceId: string;
  /** 장비 표시명 (예: 수위계 1호기) */
  device: string;
  type: EventType;
  /** 재난유형 — 04 §4-0 매핑. 역산이 아니라 원장에 직접 든 값이다 */
  hazardType: HazardType;
  /** 발생 시점 단계. 단계가 움직인 사건은 stages 의 첫 행과 같다 */
  level: AlertLevel;
  /** 발생 시각 */
  raisedAt: string;
  /** 해제 시각 — 원장의 진실. 화면의 "진행 중" 판정은 eventViewAt 이 now 로 자른다 */
  clearedAt: string | null;
  /** 발생 당시 측정값 */
  value: number;
  unit: string;
  /** 단계 이력 (04 §4-2). 첫 행 = 발생. 없으면 단계가 하나인 사건 */
  stages?: StageChange[];
}

export const EVENTS: AlertEvent[] = [
  {
    /* 주인공 사건 — 주의보(17:05) → 경보 격상(17:22 · 시연 중 목격) → 대피 도달(19:22)
       → 해제(21:48). 시연 시계(S0=17:16)에서는 아직 주의보고, S8(22:10)에서는 해제다 */
    id: "EVT-260812-006",
    districtId: "seohang",
    deviceId: "seohang-WL-001",
    device: "수위계 1호기",
    type: "수위",
    hazardType: "폭풍해일",
    level: "advisory",
    raisedAt: "2026-08-12T17:05:00",
    clearedAt: "2026-08-12T21:48:00",
    value: 3.02,
    unit: "EL.m",
    stages: [
      { at: "2026-08-12T17:05:00", level: "advisory", value: 3.02 },
      { at: "2026-08-12T17:22:00", level: "warning", value: 3.41 },
      { at: "2026-08-12T19:22:00", level: "evacuate", value: 4.31 },
    ],
  },
  {
    id: "EVT-260812-005",
    districtId: "myeongdong",
    deviceId: "myeongdong-WL-001",
    device: "수위계 1호기",
    type: "수위",
    hazardType: "폭풍해일",
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
    hazardType: "폭풍해일",
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
    hazardType: "폭풍해일",
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
    hazardType: "집중호우",
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
    hazardType: "하천범람",
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
    hazardType: "하천범람",
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
    hazardType: "지반변위",
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
    hazardType: "폭풍해일",
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
    hazardType: "내수침수",
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
    hazardType: "집중호우",
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
    hazardType: "내수침수",
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
    hazardType: "폭풍해일",
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
    hazardType: "폭풍해일",
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
    hazardType: "폭풍해일",
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
    hazardType: "집중호우",
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
    hazardType: "내수침수",
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
    hazardType: "하천범람",
    level: "advisory",
    raisedAt: "2026-07-16T04:20:00",
    clearedAt: "2026-07-16T07:05:00",
    value: 2.02,
    unit: "EL.m",
  },
];

/* ── now 기반 파생 (04 §4-2 · CLAUDE.md) ──────────────────
 * 화면이 이벤트를 그릴 때는 원장 필드가 아니라 이 함수들을 거친다. 주인공 사건의
 * 단계·측정값·진행 여부가 시나리오 시계에 따라 다르기 때문이다.
 * ───────────────────────────────────────────────────────── */

/** now 시점의 이벤트 모습 — 단계·측정값·이 단계에 든 시각·진행 여부 */
export interface EventView {
  level: AlertLevel;
  value: number;
  /** 지금 단계에 든 시각. 첫 단계면 발생 시각, 격상 뒤면 격상 시각 */
  stageAt: string;
  /** 발생 단계 이후로 격상됐는가 — 팝업 머리의 "발생/격상" 라벨 (03 §2) */
  escalated: boolean;
  /** now 기준 진행 중인가 */
  active: boolean;
}

export function eventViewAt(event: AlertEvent, now: Date): EventView {
  let level = event.level;
  let value = event.value;
  let stageAt = event.raisedAt;
  let escalated = false;

  for (const stage of event.stages ?? []) {
    if (new Date(stage.at) > now) break;
    level = stage.level;
    value = stage.value;
    stageAt = stage.at;
    escalated = stage.at !== event.raisedAt;
  }

  const raised = new Date(event.raisedAt) <= now;
  const cleared = event.clearedAt !== null && new Date(event.clearedAt) <= now;
  return { level, value, stageAt, escalated, active: raised && !cleared };
}

/** now 기준 진행 중인 이벤트 — 원장 순서(최신순) 유지 */
export function activeEventsAt(now: Date): AlertEvent[] {
  return EVENTS.filter((e) => eventViewAt(e, now).active);
}

/** 지구별 진행 중 이벤트. 지도·목록에서 지구를 단계 색으로 세울 때 쓴다 */
export function activeEventOfAt(districtId: string, now: Date): AlertEvent | undefined {
  return activeEventsAt(now).find((e) => e.districtId === districtId);
}

/** 장비별 진행 중 이벤트. 그 장비 자리에 이벤트 핀을 세울지 판단한다 (03 §0-5) */
export function activeEventOfDeviceAt(deviceId: string, now: Date): AlertEvent | undefined {
  return activeEventsAt(now).find((e) => e.deviceId === deviceId);
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

/** 재난유형별 집계 (04 §4-3) — 도넛은 이 축으로 돌린다. 관측 축(수위·강우·변위)은
 *  재난 집계가 아니라 통계 화면의 관측 분석 축이다 */
export function statsByHazardType(): { type: HazardType; label: string; count: number }[] {
  const counted = countBy((event) => event.hazardType);
  return HAZARD_ORDER.map((type) => ({
    type,
    label: hazardLabel(type),
    count: counted.get(type) ?? 0,
  }));
}

/** now 까지 확정된 계측 단계 — 도달한 최고 단계다(04 §4-3). 집계·필터가 같은 값을 쓴다 */
export function confirmedLevelAt(event: AlertEvent, now: Date): AlertLevel {
  let level = event.level;
  for (const stage of event.stages ?? []) {
    if (new Date(stage.at) > now) break;
    level = stage.level;
  }
  return level;
}

/** 단계별 집계 — now 까지 확정된 계측 단계로 센다(04 §4-3). 주인공 사건이 움직이므로
 *  S0(주의보 13 · 대피 2)과 S8(주의보 12 · 대피 3)의 숫자가 다르다.
 *  버그가 아니라 사건이 진행한 결과다 */
export function statsByLevelAt(now: Date): { level: AlertLevel; count: number }[] {
  const acc = new Map<AlertLevel, number>();
  for (const event of EVENTS) {
    const level = confirmedLevelAt(event, now);
    acc.set(level, (acc.get(level) ?? 0) + 1);
  }
  return LEVEL_ORDER.map((level) => ({ level, count: acc.get(level) ?? 0 }));
}

export const STATS_TOTAL = EVENTS.length;
