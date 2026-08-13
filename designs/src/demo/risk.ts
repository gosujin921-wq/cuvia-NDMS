/* ─────────────────────────────────────────────
 * 위험도 판정 — 정본: docs/정본/04_데모_데이터.md §10 · 03 §0-6
 *
 * 네 개의 층이다. 계측 단계는 지금 값이 정하고, 조건 시나리오는 만조 조건의 도달 예상이고,
 * 권고는 시스템이 내고, **확정(승인 대응등급)은 담당자가 한다** — [대응등급 {권고}로 상향].
 *
 * SOP 와 전파 문안은 승인 대응등급을 따른다. 승인 전에는 권고 기준의 제안 상태다.
 * ───────────────────────────────────────────── */

import { WATER_THRESHOLDS, ALERT_LEVELS, type AlertLevel } from "./levels";
import { eventViewAt, type AlertEvent, type EventView } from "./events";
import { scenarioOfDistrictAt, type TideScenario } from "./forecast";

const LEVEL_RANK: Record<AlertLevel, number> = { advisory: 1, warning: 2, evacuate: 3 };

export interface RiskAssessment {
  /** 계측 단계 — now 시점의 이벤트 모습 */
  measured: EventView;
  /** 만조 조건 시나리오 — 격상 후 주인공 사건에만 있다 */
  scenario: TideScenario | null;
  /** 시나리오 도달 예상 수위가 드는 단계 구간 */
  scenarioLevel: AlertLevel | null;
  /** 권고 대응수준 — 계측과 시나리오 중 높은 쪽 */
  recommended: AlertLevel;
  /** 권고가 계측보다 높은가 — "선제 대응 권고" 라벨 자리 */
  preemptive: boolean;
  /** 근거 한 줄. 시나리오가 없으면 null */
  basis: string | null;
}

/** 수위가 발령 기준의 어느 구간에 드는가 */
function levelOfValue(districtId: string, value: number): AlertLevel | null {
  const threshold = WATER_THRESHOLDS[districtId];
  if (!threshold) return null;
  let hit: AlertLevel | null = null;
  for (const level of ALERT_LEVELS) {
    if (value >= threshold[level.id]) hit = level.id;
  }
  return hit;
}

export function assessRisk(event: AlertEvent, now: Date): RiskAssessment {
  const measured = eventViewAt(event, now);
  const scenario = scenarioOfDistrictAt(event.districtId, now);
  const scenarioLevel = scenario ? levelOfValue(event.districtId, scenario.peak) : null;

  /* 권고 = max(계측, 시나리오). 시나리오가 낮으면 계측을 따른다 —
     물이 빠지고 있다고 이미 난 경보를 내리지 않는다 (04 §10-1) */
  const recommended =
    scenarioLevel && LEVEL_RANK[scenarioLevel] > LEVEL_RANK[measured.level]
      ? scenarioLevel
      : measured.level;

  return {
    measured,
    scenario,
    scenarioLevel,
    recommended,
    preemptive: LEVEL_RANK[recommended] > LEVEL_RANK[measured.level],
    basis: scenario?.basis ?? null,
  };
}
