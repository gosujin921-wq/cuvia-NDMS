/* ─────────────────────────────────────────────
 * 위험도 판정 — 배경: docs/레거시/정본/04_데모_데이터.md §10 · 03 §0-6
 *
 * 네 개의 층이다. 계측 단계는 지금 값이 정하고, 조건 시나리오는 만조 조건의 도달 예상이고,
 * 권고는 시스템이 내고, **확정(승인 대응등급)은 담당자가 한다** — [대응등급 {권고}로 상향].
 *
 * SOP 와 전파 문안은 승인 대응등급을 따른다. 승인 전에는 권고 기준의 제안 상태다.
 * ───────────────────────────────────────────── */

import { WATER_THRESHOLDS, ALERT_LEVELS, type AlertLevel } from "./levels";
import { floodImpactAt } from "./flood-impact";
import { drainageOf } from "./drainage";
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
  /** 지역 영향에서 대피 권고가 올라온 경우의 근거 (04 §15-9). 아니면 null */
  impactBasis: string | null;
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
  const byLevel =
    scenarioLevel && LEVEL_RANK[scenarioLevel] > LEVEL_RANK[measured.level]
      ? scenarioLevel
      : measured.level;

  /* 지역 영향 기반 승격 (04 §15-9) — 조건 시나리오의 도달 예상값에서 **대피 대상이
     생기면** 계측 기준과 무관하게 대피를 권고한다.
     서항은 두 기준이 겹쳐(영향 시작 4.2 = 계측 대피 기준) 결과가 같지만, 봉암은
     계측 대피 기준(5.83)에 끝내 닿지 않는데도 저지대 영향 시작(4.30)에서 328명이
     생긴다. 사람이 잠기기 시작하는 자리가 발령 기준표와 다를 수 있다는 것이 이
     한 줄의 요지다 — 기준표만 보면 봉암에서는 아무도 대피시키지 않는다 */
  const scenarioImpact = scenario ? floodImpactAt(event.districtId, scenario.peak) : null;
  const impactEvacuation = (scenarioImpact?.evacuees ?? 0) > 0;
  const recommended: AlertLevel = impactEvacuation ? "evacuate" : byLevel;

  return {
    measured,
    scenario,
    scenarioLevel,
    recommended,
    preemptive: LEVEL_RANK[recommended] > LEVEL_RANK[measured.level],
    basis: scenario?.basis ?? null,
    /* 권고가 계측·시나리오 단계가 아니라 지역 영향에서 올라온 경우의 근거 한 줄 */
    impactBasis:
      impactEvacuation && scenario && scenarioImpact
        ? `대피 대상 ${scenarioImpact.evacuees}명 발생` +
          (drainageOf(event.districtId) ? " · 배수 제약 지속" : "")
        : null,
  };
}
