/* ─────────────────────────────────────────────
 * 시간대별 영향 시나리오 — 정본: docs/정본/04_데모_데이터.md §4-2 · §10 · §15-7
 *
 * SCR-05 의 주 조작축. 조건값(수위)이 아니라 **시각**을 옮기면 예상 수위·영향 범위·
 * 대응 대상이 함께 바뀐다. 조건은 그 시각을 만드는 산정 근거로 내려간다(03 §5).
 *
 * ★ 눈금은 전부 문서에서 나온다. 눈금 사이를 자유롭게 스크럽하지 않는 이유가 둘이다.
 *
 *   1. 곡선이 없다. 미래 쪽에 등재된 점은 조건 시나리오 하나뿐이라(04 §10 · §15-7),
 *      중간 시각의 값은 아무도 쓰지 않은 숫자가 된다. 조건 슬라이더의 중간값은
 *      "사용자가 가정한 조건"이지만 시간축의 중간값은 "시스템이 계산한 예측"으로
 *      읽힌다 — 없는 모델을 있다고 말하게 된다.
 *
 *   2. ★ 더 중요한 것: 원장에는 이미 미래가 들어 있다. 서항 stages 의 19:22 대피 4.31 은
 *      **나중에 일어난 일**이고, S4(17:29)의 운영자는 모른다. 시간축을 미래로 밀 수
 *      있게 하면 답안지를 펴 놓고 판단하는 화면이 된다. 05 §3 의 "계측 도달보다 1시간
 *      45분 먼저 결정했다"가 무너진다. 그래서 과거 눈금은 now 로 자르고(eventViewAt 과
 *      같은 규율), 미래 눈금은 **조건 시나리오가 세운 한 점만** 세운다.
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
 * 이 값이 어느 눈금인가 — 상세 조건으로 손수 민 값이면 undefined.
 *
 * ★ 같은 값을 가진 눈금이 여럿일 때 **현재가 이긴다.** 서항은 17:22 격상값과 17:29 현재값이
 *   둘 다 3.41 이다(그 사이 단계가 안 움직였으니 당연하다). 앞선 것을 잡으면 화면에 막
 *   들어왔는데 "17:22 경보 격상 기준"이라고 뜬다. 지금 보고 있는 것은 지금이다.
 */
export function markOfValue(timeline: Timeline, value: number): TimeMark | undefined {
  const hits = timeline.marks.filter((mark) => Math.abs(mark.value - value) < 0.005);
  return hits.find((mark) => mark.kind === "now") ?? hits[0];
}
