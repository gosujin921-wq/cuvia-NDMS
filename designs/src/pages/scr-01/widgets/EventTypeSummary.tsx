/* ─────────────────────────────────────────────
 * 이벤트 유형 현황 — 종합상황 우 2 (초안 §2 · CSMS EventTypeSummary 문법 · NDMS RingDonut)
 *
 * 전체 경향을 보는 자리. 예측 갱신·임계·변화율·영상 분석·시설 상태·특보·품질을 유형 축으로 센다.
 * 관측 낱개는 세지 않는다 — 흔한 것과 위험한 것이 다르다는 것이 이 패널의 논지다.
 * 심각 사건이 서면 접힌다(헤더 한 줄만). 사람이 헤더를 눌러 다시 편다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { cn } from "@ds";
import { RingDonut } from "../../../components/RingDonut";
import { eventCategoryCountsAt } from "../../../model/selectors";
import { EVENT_CATEGORY_COLOR } from "../../../lib/status-tone";
import { useScenario } from "../../../state/ScenarioProvider";

export function EventTypeSummary({ collapsed = false, onToggle }: { collapsed?: boolean; onToggle?: () => void }) {
  const { demoNow: now } = useScenario();
  const counts = eventCategoryCountsAt(now);
  const total = counts.reduce((s, c) => s + c.count, 0);
  const segments = counts.filter((c) => c.count > 0).map((c) => ({ value: c.count, color: EVENT_CATEGORY_COLOR[c.category], label: c.category }));

  return (
    <section className="flex flex-col gap-3 p-3" aria-label="이벤트 유형 현황">
      <header className="flex items-baseline justify-between">
        {onToggle ? (
          <button type="button" onClick={onToggle} className="flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-body font-semibold text-foreground">
            이벤트 유형 현황
            <Icon icon="mdi:chevron-down" className={cn("size-4 text-foreground-subtle transition-transform", collapsed && "-rotate-90")} aria-hidden />
          </button>
        ) : (
          <h2 className="text-body font-semibold text-foreground">이벤트 유형 현황</h2>
        )}
        <span className="text-caption text-foreground-muted">{collapsed ? `${total}건 · ${counts.filter((c) => c.count > 0).map((c) => c.category).join(" · ")}` : "판정 + 분석"}</span>
      </header>
      {!collapsed && (
        <div className="flex items-center gap-4">
          <RingDonut segments={segments} size={100} thickness={10} ariaLabel={`이벤트 유형 현황. ${counts.map((c) => `${c.category} ${c.count}건`).join(", ")}`}>
            <span className="flex flex-col items-center leading-none">
              <span className="font-mono text-h5 font-semibold text-foreground">{total}</span>
              <span className="text-caption text-foreground-muted">건</span>
            </span>
          </RingDonut>
          <ul className="flex min-w-0 flex-1 flex-col gap-1">
            {counts.map((c) => (
              <li key={c.category} className="flex items-center gap-2 text-caption">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: EVENT_CATEGORY_COLOR[c.category] }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-foreground">{c.category}</span>
                <span className="shrink-0 font-mono text-foreground-muted">{c.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
