/* ─────────────────────────────────────────────
 * 실시간 주요 사건 — 종합상황 우 3 (초안 §2 · CSMS SituationFeed 문법)
 *
 * 담당자 판단이 필요한 것을 든다. 관측 낱개는 오지 않는다. 사건 전 알림은 `감지` 카드로 서고, 후보가
 * 되면 같은 자리에서 사건 카드로 바뀐다. 카드를 누르면 사건 작업공간(/scr-02/:districtId)이 열린다.
 * ───────────────────────────────────────────── */

import { useMemo } from "react";
import { EmptyState } from "@ds";
import { IncidentCard } from "../../../components/IncidentCard";
import { feedItemsAt, type FeedItem } from "../../../model/selectors";
import { useScenario } from "../../../state/ScenarioProvider";

export function SituationFeed({ onOpen }: { onOpen: (item: FeedItem) => void }) {
  const { demoNow: now, heroIncidentId } = useScenario();
  const items = useMemo(() => feedItemsAt(now), [now]);
  const active = items.filter((i) => i.active).length;
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2 p-3" aria-label="실시간 주요 사건">
      <header className="flex shrink-0 items-baseline justify-between">
        <h2 className="text-body font-semibold text-foreground">실시간 주요 사건</h2>
        <span className="text-caption text-foreground-muted">{active}건 진행 중</span>
      </header>
      {items.length === 0 ? (
        <EmptyState variant="inline" icon="mdi:check-circle-outline" message="진행 중인 사건이 없습니다." />
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id}>
              <IncidentCard item={item} highlighted={item.incidentId === heroIncidentId && item.active} onOpen={() => onOpen(item)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
