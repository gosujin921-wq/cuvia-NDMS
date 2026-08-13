/* ─────────────────────────────────────────────
 * 진행 시나리오 — 사전 모의분석의 시간 흐름 (03 §5 · 04 §10-3 · §15-7)
 *
 * ★ 수위는 사람이 미는 값이 아니다. 특히 내수침수에서 EL.m 은 원인이 아니라 **결과**다 —
 *   비가 들어오고 배수문이 닫혀 못 나간 결과가 그 수위다(demo/drainage.ts). 사람이 세우는
 *   것은 조건이고, 미는 것은 시간이며, 수위는 따라 나온다.
 *
 * 사건 연계 분석은 이미 그렇게 서 있다(demo/scenario-timeline.ts) — 시각을 옮기면 예상
 * 수위가 따라온다. 모의분석에만 수위 슬라이더가 남아 있어서, 같은 화면의 두 모드가 서로
 * 반대 방향의 인과를 말하고 있었다. 이 파일이 그 짝을 맞춘다.
 *
 * ★ 축은 **경과 시간**이지 시각이 아니다. 모의분석에는 관측도 예보도 없어 "09:35" 라고
 *   적으면 그 시각에 무슨 근거가 있는 것처럼 보인다. "주의보 발령에서 +55분" 은 근거를
 *   참칭하지 않으면서도 계획·훈련이 실제로 묻는 것을 그대로 묻는다 — **"이 비가 이대로
 *   오면 대피 기준까지 얼마나 남았나".** 리드타임은 이미 이 데모의 언어다(05 §3 · 승인
 *   17:37 → 계측 도달 19:22 = 1시간 45분).
 *
 * ★ 상승률은 지어내지 않는다. 두 트랙의 조건 시나리오(04 §10-3 · §15-7)가 앵커다:
 *
 *     봉암   08:52 4.02 → 09:35 4.68   43분에 +0.66 m  =  0.92 m/h  (시간당 42 mm 지속)
 *     서항   17:22 3.41 → 19:10 4.24  108분에 +0.83 m  =  0.46 m/h  (해일 편차 +1.15 m)
 *
 *   조건을 바꾸면 그 앵커에서 갈라진다. 눈금이 서는 자리(수위)는 04 가 정하고, 눈금이
 *   서는 시각은 상승률이 계산한다.
 *
 * 등재는 영향표가 있는 두 지구뿐이다(04 §12 · §15-8). 나머지 지구·유형은 null 로 두고
 * 화면이 "아직 등재되지 않음" 으로 정직하게 선다.
 * ───────────────────────────────────────────── */

import type { HazardType } from "./events";
import { formatElapsed } from "../lib/datetime";
import type { TimeMark, Timeline } from "./scenario-timeline";

/** 조건 한 벌 — 이 조건이 지속되면 수위가 이 속도로 오른다 */
export interface ProgressionCondition {
  id: string;
  /** 셀렉트에 서는 이름 — "시간당 42 mm" · "해일 편차 +1.15 m" */
  label: string;
  /** 수위 상승률 (m/h) */
  riseRate: number;
  /** 상승률의 산정 — 설정 카드와 저장되는 근거가 그대로 쓴다 */
  note: string;
}

/** 축 위 눈금 — **수위**로 등재한다. 시각은 상승률이 만든다 */
export interface ProgressionMark {
  id: string;
  label: string;
  level: number;
}

export interface ProgressionSpec {
  districtId: string;
  hazardType: HazardType;
  /** 조건 레버 제목 — "강우 강도" · "해일 편차" */
  leverLabel: string;
  /** 출발 수위와 그 이름 — 발령이 시작되는 지점이다 */
  startLevel: number;
  startLabel: string;
  marks: ProgressionMark[];
  conditions: ProgressionCondition[];
  unit: string;
}

/**
 * 봉암 내수침수 (04 §15-6 · §15-7 · §15-8).
 *
 * 상승률을 강우 유입과 배수 제약 둘로 가르는 것이 이 지구의 정체다 — 배수문이 닫혀 있는
 * 동안은 비가 그쳐도 0.21 m/h 가 남는다(04 §15-6 의 "안쪽 물이 못 나간다"). 비례 계수는
 * 앵커에서 역산했다: 42 mm/h 일 때 강우 유입 0.71 · 배수 초과 0.21 = 0.92 m/h.
 */
const BONGAM_PROGRESSION: ProgressionSpec = {
  districtId: "bongam",
  hazardType: "내수침수",
  leverLabel: "강우 강도",
  startLevel: 3.45,
  startLabel: "주의보 발령",
  marks: [
    /* 04 §15-8 의 대피 대상이 뜨는 행. 봉암은 계측 대피 기준(5.83)이 아니라 여기서 328명이
       뜬다 — 사건 트랙이 계측 미도달인데도 대피를 권고하는 근거와 같은 줄이다(§15-9) */
    { id: "lowland", label: "저지대 영향", level: 4.3 },
    { id: "evacuate", label: "대피 기준", level: 5.83 },
  ],
  conditions: [
    {
      id: "rain-30",
      label: "시간당 30 mm",
      riseRate: 0.72,
      note: "호우주의보 기준 · 강우 유입 0.51 + 배수 초과 0.21 m/h",
    },
    {
      id: "rain-42",
      label: "시간당 42 mm",
      riseRate: 0.92,
      note: "8/13 봉암 실측 조건 · 강우 유입 0.71 + 배수 초과 0.21 m/h",
    },
    {
      id: "rain-50",
      label: "시간당 50 mm",
      riseRate: 1.06,
      note: "호우경보 기준 · 강우 유입 0.85 + 배수 초과 0.21 m/h",
    },
    {
      id: "rain-70",
      label: "시간당 70 mm",
      riseRate: 1.39,
      note: "호우경보 기준 초과 · 강우 유입 1.18 + 배수 초과 0.21 m/h",
    },
  ],
  unit: "EL.m",
};

/**
 * 서항 폭풍해일 (04 §10-2 · §10-3 · §12).
 *
 * 해일은 밖에서 오는 물이라 조건이 곧 편차다. 편차가 0 이어도 천문조가 만조를 향해
 * 오르므로 기저 상승률 0.18 m/h 를 두고, 편차가 그 위에 얹힌다.
 */
const SEOHANG_PROGRESSION: ProgressionSpec = {
  districtId: "seohang",
  hazardType: "폭풍해일",
  leverLabel: "해일 편차",
  startLevel: 2.9,
  startLabel: "주의보 발령",
  marks: [
    { id: "warning", label: "경보 기준", level: 3.35 },
    { id: "evacuate", label: "대피 기준", level: 4.2 },
  ],
  conditions: [
    {
      id: "surge-060",
      label: "+0.60 m",
      riseRate: 0.33,
      note: "천문조 상승 0.18 + 해일 편차 기여 0.15 m/h",
    },
    {
      id: "surge-115",
      label: "+1.15 m",
      riseRate: 0.46,
      note: "8/12 서항 관측 조건 · 천문조 상승 0.18 + 해일 편차 기여 0.28 m/h",
    },
    {
      id: "surge-160",
      label: "+1.60 m",
      riseRate: 0.57,
      note: "천문조 상승 0.18 + 해일 편차 기여 0.39 m/h",
    },
  ],
  unit: "EL.m",
};

const SPECS: ProgressionSpec[] = [BONGAM_PROGRESSION, SEOHANG_PROGRESSION];

/** 기본 조건 — 각 트랙이 실제로 겪은 조건을 첫 화면에 세운다 */
const DEFAULT_CONDITION: Record<string, string> = {
  bongam: "rain-42",
  seohang: "surge-115",
};

/** 이 지구·이 유형의 진행 스펙. 등재되지 않았으면 null */
export function progressionSpecOf(
  districtId: string,
  hazardType: HazardType,
): ProgressionSpec | null {
  return (
    SPECS.find((spec) => spec.districtId === districtId && spec.hazardType === hazardType) ?? null
  );
}

/** 고른 조건 — 없거나 못 찾으면 그 지구의 기본 조건으로 물러난다 */
export function conditionOf(spec: ProgressionSpec, id: string | null): ProgressionCondition {
  const found = id ? spec.conditions.find((c) => c.id === id) : null;
  if (found) return found;
  const fallback = DEFAULT_CONDITION[spec.districtId];
  return spec.conditions.find((c) => c.id === fallback) ?? spec.conditions[0];
}

/**
 * 축의 기준점. 표기에는 쓰이지 않는다 — 경과만 보이므로 어느 날 몇 시인지는 뜻이 없다.
 *
 * Timeline 이 Date 를 드는 것은 사건 연계와 **같은 부품**(TimelinePanel)에 서기 위해서다.
 * 슬라이더·눈금·보간이 두 벌이면 하나는 자유롭고 하나는 자석인 축이 다시 생긴다(차수 T).
 * 시계가 흘러도 이 값은 안 움직인다 — 모의분석 축은 시나리오 시계와 무관해야 한다.
 */
const AXIS_ORIGIN = new Date("2026-01-01T00:00:00");

/** 이 조건에서 그 수위에 닿기까지 걸리는 분 */
function minutesTo(spec: ProgressionSpec, condition: ProgressionCondition, level: number): number {
  return Math.max(0, Math.round(((level - spec.startLevel) / condition.riseRate) * 60));
}

/**
 * 진행 시나리오의 시간축.
 *
 * 사건 연계의 timelineOf 와 같은 Timeline 을 낸다. 다른 것은 눈금의 출처뿐이다 — 저쪽은
 * 원장 계측과 조건 시나리오가 세우고, 이쪽은 발령 기준·영향표가 세운다.
 *
 * `leadMinutes` 는 비운다. 사건 연계의 "1시간 41분 남음" 은 지금부터 재는 말인데
 * 모의분석에는 지금이 없다 — 축 자체가 이미 경과로 읽힌다.
 */
export function progressionTimelineOf(
  spec: ProgressionSpec,
  condition: ProgressionCondition,
): Timeline {
  const marks: TimeMark[] = [
    {
      id: "start",
      at: AXIS_ORIGIN,
      label: spec.startLabel,
      kind: "past",
      value: spec.startLevel,
      level: null,
    },
    ...spec.marks.map((mark) => ({
      id: mark.id,
      at: new Date(AXIS_ORIGIN.getTime() + minutesTo(spec, condition, mark.level) * 60_000),
      label: mark.label,
      kind: "projection" as const,
      value: mark.level,
      level: null,
    })),
  ];

  return { marks, nowIndex: 0, leadMinutes: null, unit: spec.unit };
}

/** 축 위 표기 — 모의분석이 읽는 것은 시각이 아니라 출발점에서의 경과다 */
export function formatOffset(timeline: Timeline, at: Date): string {
  return `+${formatElapsed(timeline.marks[0].at, at)}`;
}
