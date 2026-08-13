/* ─────────────────────────────────────────────
 * 해당 지구 이벤트 목록 — 03 화면정의서 §5 우측
 *
 * 이 마을에서 최근에 무슨 일이 있었는지. 침수 시뮬레이션이 "만약"이라면, 이 목록은
 * "실제로 있었던 일"이다. 둘이 한 화면에 있어야 예측이 근거를 얻는다.
 * ───────────────────────────────────────────── */

import { EmptyState, cn } from "@ds";
import { EVENTS, eventViewAt, type AlertEvent } from "../../../demo/events";
import { levelSpec } from "../../../demo/levels";
import { levelTone } from "../../../lib/level-tone";
import { formatDate } from "../../../lib/datetime";
import { useScenario } from "../../../state/ScenarioProvider";

export function DistrictEventList({
  districtId,
  onOpen,
}: {
  districtId: string;
  /** 항목 클릭 — 그 사건이 선택된 채 상황대응이 열린다 (02 §2 · 감사 B-2) */
  onOpen: (event: AlertEvent) => void;
}) {
  const { now } = useScenario();
  const events = EVENTS.filter((event) => event.districtId === districtId);

  return (
    <section className="flex flex-col gap-1.5 p-3" aria-label="해당 지구 이벤트 목록">
      <header className="flex items-baseline justify-between">
        <h2 className="text-body font-semibold text-foreground">해당 지구 이벤트</h2>
        <span className="text-caption text-foreground-subtle">{events.length}건</span>
      </header>

      {events.length === 0 ? (
        <EmptyState
          variant="inline"
          icon="mdi:calendar-blank-outline"
          message="최근 발생한 이벤트가 없습니다"
        />
      ) : (
        <ul className="flex flex-col">
          {events.map((event) => {
            const view = eventViewAt(event, now);
            const spec = levelSpec(view.level);
            return (
              <li key={event.id} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => onOpen(event)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded border-none bg-transparent py-1.5 text-left text-caption transition-colors hover:bg-surface-raised"
                >
                  <span
                    className={cn("size-2 shrink-0 rounded-sm", levelTone(view.level).dot)}
                    aria-hidden
                  />
                  <span className="shrink-0 text-foreground-muted">{formatDate(event.raisedAt)}</span>
                  <span className="min-w-0 flex-1 truncate text-foreground-subtle">
                    {event.type} {spec.label}
                  </span>
                  <span className="shrink-0 font-mono text-foreground">
                    {view.value}
                    <span className="ml-1 text-foreground-subtle">{event.unit}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
