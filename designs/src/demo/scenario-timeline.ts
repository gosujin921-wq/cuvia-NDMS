/* ─────────────────────────────────────────────
 * 시간대별 영향 시나리오 — 배경: docs/레거시/정본/04_데모_데이터.md §4-2 · §10 · §15-7
 *
 * SCR-05 의 주 조작축. 조건값(수위)이 아니라 **시각**을 옮기면 예상 수위·영향 범위·
 * 대응 대상이 함께 바뀐다. 조건은 그 시각을 만드는 산정 근거로 내려간다(03 §5).
 *
 * ★ 눈금은 전부 문서에서 나온다. 축을 자유롭게 스크럽하되(차수 T · 조건 슬라이더와 같은
 *   문법) **눈금이 서는 자리**는 04 가 정한다.
 *
 *   1. 사이는 선형 보간이다(valueAt). 미래 쪽에 등재된 점은 조건 시나리오 하나뿐이라
 *      (04 §10 · §15-7) 중간 시각의 값은 04 에 없는 수다. 그것을 허용하는 근거가 화면
 *      이름 "현재 조건 유지 시" 이고, 그래서 판단·기록에 서는 값은 점프 버튼이 데려가는
 *      눈금값이다. 사이에 선 값은 화면이 "사용자 시각"으로 구분해 말한다.
 *
 *   2. ★ 더 중요한 것: 원장에는 이미 미래가 들어 있다. 서항 stages 의 19:22 대피 4.31 은
 *      **나중에 일어난 일**이고, S4(17:29)의 운영자는 모른다. 축의 오른쪽 끝을 그리로
 *      늘리면 답안지를 펴 놓고 판단하는 화면이 된다. 05 §3 의 "계측 도달보다 1시간
 *      45분 먼저 결정했다"가 무너진다. 그래서 과거 눈금은 now 로 자르고(eventViewAt 과
 *      같은 규율), 미래 눈금은 **조건 시나리오가 세운 한 점만** 세운다 — 축이 자유로워도
 *      끝점이 19:10 이라 원장의 미래는 여전히 손이 닿지 않는다.
 *
 * 전망과 실측이 다른 것은 흠이 아니라 정직함이다. 서항 전망 19:10 4.24 · 실측 19:22 4.31.
 * ───────────────────────────────────────────── */

import { levelSpec, type AlertLevel } from "./levels";
import type { AlertEvent } from "./events";
import type { TideScenario } from "./forecast";

export type TimeMarkKind = "past" | "now" | "projection";

export interface TimeMark {
  id: string;
  at: Date;
  /** 눈금 이름 — "경보 격상" · "현재" · "바닷물 최고" */
  label: string;
  kind: TimeMarkKind;
  /** 그 시각의 값. 과거는 원장 계측, 현재는 계측, 전망은 조건 시나리오 */
  value: number;
  /** 계측 단계 — 핀·뱃지 색이 여기서 나온다. 전망은 값으로 판정하므로 비운다 */
  level: AlertLevel | null;
}

export interface Timeline {
  marks: TimeMark[];
  /** 지금 눈금의 인덱스 — 축을 과거/미래로 가르는 자리 */
  nowIndex: number;
  /** 전망 눈금까지 남은 시간(분). 전망이 없으면 null */
  leadMinutes: number | null;
  unit: string;
}

/** 남은 시간 표기 — "1시간 41분" · "41분" */
export function formatLead(minutes: number): string {
  if (minutes <= 0) return "지금";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

/**
 * 이 사건의 시간축.
 *
 * 과거 눈금은 단계가 움직인 시각(04 §4-2)이고, 그중 now 를 넘지 않은 것만 선다.
 * 눈금이 빽빽해지지 않도록 **가장 최근 한 개**만 남긴다 — 340px 레일에서 17:05·17:22·
 * 17:29 를 다 세우면 왼쪽 20%에 뭉친다. 이 화면이 묻는 것은 사건의 내력이 아니라
 * "지금부터 무엇이 오는가"라 최근 한 걸음이면 맥락이 선다(내력은 SCR-04 의 몫).
 */
export function timelineOf(
  event: AlertEvent,
  scenario: TideScenario | null,
  now: Date,
  currentValue: number,
): Timeline {
  const marks: TimeMark[] = [];
  const stages = event.stages ?? [];

  /* 과거 — now 이하만. 같은 시각이면 현재 눈금이 대신하므로 미만으로 자른다 */
  const past = stages
    .map((stage, index) => ({ stage, index }))
    .filter(({ stage }) => new Date(stage.at) < now);
  const recent = past[past.length - 1];
  if (recent) {
    marks.push({
      id: `stage-${recent.index}`,
      at: new Date(recent.stage.at),
      /* 첫 행은 발생, 이후는 격상 (04 §4-2) */
      label: `${levelSpec(recent.stage.level).label} ${recent.index === 0 ? "발생" : "격상"}`,
      kind: "past",
      value: recent.stage.value,
      level: recent.stage.level,
    });
  }

  const nowIndex = marks.length;
  marks.push({
    id: "now",
    at: now,
    label: "현재",
    kind: "now",
    value: currentValue,
    level: null,
  });

  /* 미래 — 조건 시나리오가 세운 한 점만. 원장의 이후 단계는 세우지 않는다 */
  let leadMinutes: number | null = null;
  if (scenario) {
    const at = new Date(scenario.peakAt);
    if (at > now) {
      marks.push({
        id: "projection",
        at,
        label: scenario.peakLabel,
        kind: "projection",
        value: scenario.peak,
        level: null,
      });
      leadMinutes = Math.round((at.getTime() - now.getTime()) / 60000);
    }
  }

  return { marks, nowIndex, leadMinutes, unit: event.unit };
}

/**
 * 이 시각이 눈금 위인가 — 사이를 짚었으면 undefined.
 *
 * ★ 값이 아니라 **시각**으로 찾는다. 서항은 17:22 격상값과 17:29 현재값이 둘 다 3.41 이라
 *   (그 사이 단계가 안 움직였으니 당연하다) 값으로 되찾으면 [경보 격상]을 짚어도 선택이
 *   [현재]로 튄다. 시각은 눈금마다 하나뿐이라 그런 일이 없다.
 */
export function markAt(timeline: Timeline, at: Date): TimeMark | undefined {
  const t = at.getTime();
  return timeline.marks.find((mark) => mark.at.getTime() === t);
}

/**
 * 이 시각의 값 — 눈금 사이는 **선형 보간**이다 (03 §5 · 차수 T).
 *
 * ★ 여기서 나온 중간값은 04 어디에도 없는 수다. 그것을 허용하는 근거가 화면 이름
 *   "현재 조건 유지 시" 다 — 지금 조건이 그대로 간다는 가정 아래 두 눈금을 잇는 램프이고,
 *   기상 모델이 낸 곡선이 아니다. 그래서 판단·기록에 서는 값은 점프 버튼이 데려가는
 *   눈금값이고, 사이에 선 값은 화면에서 "사용자 시각"으로 구분해 표시한다.
 *
 * 조건 슬라이더와 같은 0.01 눈금으로 떨군다. 두 축이 같은 자리를 가리킬 때 3.6600000000004
 * 와 3.66 이 서로 다른 값이 되면 [현재] 버튼이 안 켜진다.
 */
export function valueAt(timeline: Timeline, at: Date): number {
  const marks = timeline.marks;
  const t = at.getTime();
  if (t <= marks[0].at.getTime()) return marks[0].value;
  const last = marks[marks.length - 1];
  if (t >= last.at.getTime()) return last.value;

  for (let i = 1; i < marks.length; i += 1) {
    const from = marks[i - 1];
    const to = marks[i];
    if (t > to.at.getTime()) continue;
    const span = to.at.getTime() - from.at.getTime();
    const ratio = span === 0 ? 0 : (t - from.at.getTime()) / span;
    return Math.round((from.value + (to.value - from.value) * ratio) * 100) / 100;
  }
  return last.value;
}
