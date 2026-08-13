/* ─────────────────────────────────────────────
 * 진행 중 사건 타임라인 — 배경: docs/레거시/정본/04_데모_데이터.md §4-6 · 03 §2 · 차수 K-3
 *
 * **별도 타임라인 원장을 만들지 않는다.** 앞 절들이 이미 든 기록에서 파생 계산한다 —
 * 단계 이력(§4-2) · 최초 확인(§4-5) · 전파 기록(§7-3·§7-5) · 조건 시나리오(§10-3) ·
 * 승인(§10-2) · 실행 결과(§13) · 대체 조치(§13-1) · 해제(§4-1). 같은 사건을 두 원장이
 * 말하면 반드시 갈라진다(차수 K 확정 조건).
 *
 * 시나리오 시계로 잘라 **지나간 행만** 세운다(03 §0-7). 아직 없는 승인·실행·대체
 * 조치는 행 자체가 없다. 같은 시각이면 격상 → 시나리오, 승인 → SOP 전파 순으로 선다.
 *
 * SCR-02 는 현재 사건의 전 행을 접이식 상세로 펴고, SCR-04 사건 이력은 같은 파생에서
 * 전파·실패·대체 조치만 걸러 하위 행으로 쓴다 — 두 화면이 다른 원장을 보지 않는다.
 * ───────────────────────────────────────────── */

import { CHANNELS, type DispatchRecord } from "./dispatch";
import { eventViewAt, type AlertEvent } from "./events";
import { levelSpec, type AlertLevel } from "./levels";
import { scenarioOfDistrictAt } from "./forecast";
import { HERO_CONFIRMED_AT, sopResultsFor } from "./sop";
import { formatClock } from "../lib/datetime";

/** 행의 종류 — SCR-04 가 이 값으로 하위 행을 고른다(전파·실패·대체 조치) */
export type TimelineKind =
  | "stage"
  | "confirm"
  | "dispatch"
  | "scenario"
  | "approve"
  | "fail"
  | "fallback"
  | "clear";

export interface TimelineEntry {
  at: Date;
  kind: TimelineKind;
  label: string;
  /** 한 줄 부연 — 값·대상·기록자. 없으면 비운다 */
  detail?: string;
  /** 점 색 — 단계가 있는 행만. 나머지는 화면이 기본색으로 찍는다 */
  color?: string;
}

/**
 * 파생에 필요한 상태 한 벌 — 전부 엔진(ScenarioProvider)이 소유한 값이다.
 * 화면은 자기가 든 값을 넘기지 않는다. 넘기면 그 화면만 다른 타임라인을 갖는다.
 */
export interface TimelineContext {
  now: Date;
  dispatches: DispatchRecord[];
  approvedResponseLevel: AlertLevel | null;
  approvedAt: Date | null;
  sopExecutedItemIds: string[] | null;
  phoneReportedAt: Date | null;
}

/** 승인·실행 기록이 붙는 사건인가 — 그 트랙의 주인공(조건 시나리오를 가진 사건)이다 */
function isHeroEvent(event: AlertEvent): boolean {
  const scenario = scenarioOfDistrictAt(event.districtId, new Date(8.64e15));
  return scenario?.eventId === event.id;
}

function channelNames(record: DispatchRecord): string {
  return CHANNELS.filter((c) => record.channels.includes(c.id))
    .map((c) => c.label)
    .join(" · ");
}

export function eventTimelineAt(event: AlertEvent, ctx: TimelineContext): TimelineEntry[] {
  const { now } = ctx;
  const entries: TimelineEntry[] = [];
  const hero = isHeroEvent(event);

  /* 발생 · 격상 · 계측 도달 (§4-2) — 첫 행은 발생, 이후는 격상이다. 마지막 단계가
     그 지구의 대피 기준이면 "계측 대피 기준 도달"로 적는다 — 승인 등급과 헷갈리지
     않게 계측이라는 말을 붙인다 */
  const stages = event.stages ?? [{ at: event.raisedAt, level: event.level, value: event.value }];
  stages.forEach((stage, index) => {
    const at = new Date(stage.at);
    if (at > now) return;
    const spec = levelSpec(stage.level);
    entries.push({
      at,
      kind: "stage",
      label:
        index === 0
          ? `${spec.label} 발생`
          : stage.level === "evacuate"
            ? "계측 대피 기준 도달"
            : `${spec.label} 격상`,
      detail: `${stage.value} ${event.unit}`,
      color: spec.color,
    });
  });

  /* 담당자 확인 (§4-5) — 주인공 사건만 확인 시각이 등재돼 있다 */
  if (hero && HERO_CONFIRMED_AT >= new Date(event.raisedAt) && HERO_CONFIRMED_AT <= now) {
    entries.push({
      at: HERO_CONFIRMED_AT,
      kind: "confirm",
      label: "담당자 확인",
      detail: "상황실 담당",
    });
  }

  /* 전파 · 재전파 (§7-3 · §7-5) — 사전 원장과 시연 중 쌓인 기록이 같은 배열에 있다.
     최초 전파에만 durationMin(발생 → 전파 소요)이 있다 */
  for (const record of ctx.dispatches) {
    if (record.eventId !== event.id) continue;
    const at = new Date(record.sentAt);
    if (at > now) continue;
    const names = channelNames(record);
    entries.push({
      at,
      kind: "dispatch",
      label: record.dispatchKind === "manual-resend" ? "수정 문안 재전파" : "전파",
      detail: [
        names,
        `${record.recipients.toLocaleString()}명`,
        record.durationMin !== undefined ? `발생 ${record.durationMin}분 만에` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  /* 조건 시나리오 (§10-3) — 격상과 같은 시각에 세워진다 */
  const scenario = scenarioOfDistrictAt(event.districtId, now);
  if (scenario && scenario.eventId === event.id) {
    const at = new Date(scenario.createdAt);
    if (at <= now) {
      entries.push({
        at,
        kind: "scenario",
        label: `${scenario.conditionLabel} 시나리오`,
        detail: `${scenario.peak} EL.m 도달 예상 · ${formatClock(new Date(scenario.peakAt))}`,
      });
    }
  }

  /* 등급 승인 (§10-2) — 엔진이 든 승인 시각·등급 */
  if (hero && ctx.approvedAt && ctx.approvedResponseLevel && ctx.approvedAt <= now) {
    entries.push({
      at: ctx.approvedAt,
      kind: "approve",
      label: `대응등급 ${levelSpec(ctx.approvedResponseLevel).label}로 상향 승인`,
      detail: "상황실 담당",
      color: levelSpec(ctx.approvedResponseLevel).color,
    });
  }

  /* SOP 실행 실패 (§13) — 승인 시각 + 오프셋. 성공 항목은 타임라인에 세우지 않는다.
     여덟 줄이 다 서면 사건의 흐름이 실행 로그에 묻힌다 — 결과 전체는 실행 결과
     블록이 보이고, 여기 남는 것은 흐름을 바꾼 실패뿐이다 */
  if (hero && ctx.approvedAt && ctx.sopExecutedItemIds) {
    for (const result of sopResultsFor(event.hazardType === "내수침수" ? "내수침수" : undefined)) {
      if (result.ok) continue;
      const at = new Date(ctx.approvedAt.getTime() + result.offsetMin * 60_000);
      if (at > now) continue;
      entries.push({
        at,
        kind: "fail",
        label: `${result.label} 실패`,
        detail: result.outcome,
        color: "var(--color-danger)",
      });
    }
  }

  /* 대체 조치 (§13-1) — 실패 항목을 사람이 메운 기록 */
  if (hero && ctx.phoneReportedAt && ctx.phoneReportedAt <= now) {
    entries.push({
      at: ctx.phoneReportedAt,
      kind: "fallback",
      label: "유선 보고",
      detail: "경상남도 재난안전상황실 당직 · 기록자 상황실 담당",
    });
  }

  /* 해제 (§4-1) */
  if (event.clearedAt) {
    const at = new Date(event.clearedAt);
    if (at <= now) {
      entries.push({ at, kind: "clear", label: "해제", detail: eventViewAt(event, at).value + ` ${event.unit}` });
    }
  }

  /* 같은 시각이면 격상 → 시나리오, 승인 → SOP 전파 순 (§4-6). 아래 순서가 그 규칙이다 */
  const ORDER: Record<TimelineKind, number> = {
    stage: 0,
    confirm: 1,
    scenario: 2,
    approve: 3,
    dispatch: 4,
    fail: 5,
    fallback: 6,
    clear: 7,
  };
  return entries.sort(
    (a, b) => a.at.getTime() - b.at.getTime() || ORDER[a.kind] - ORDER[b.kind],
  );
}
