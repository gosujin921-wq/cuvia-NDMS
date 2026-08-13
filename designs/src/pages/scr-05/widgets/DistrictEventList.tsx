/* ─────────────────────────────────────────────
 * 이 지구 과거 이벤트 — 03 화면정의서 §5 참고 자리
 *
 * ★ 레일의 본줄이 아니라 접힌 참고정보다. "이 지구에서 있었던 일"의 본적은 SCR-04
 *   사건 이력이고, 트윈에서 그것과 같은 목록을 본줄에 세우면 두 화면의 역할이 겹친다.
 *   트윈이 머리말에 세우는 것은 **지금 분석 중인 사건 하나**다(AnalysisHeader).
 *
 * 그래도 지우지 않는 것은, 조건을 밀어 본 뒤 "전에도 이만큼 온 적이 있나"가 바로 이
 * 자리에서 나는 질문이기 때문이다. 묻는 사람만 펼친다.
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
    <section className="flex flex-col gap-1.5" aria-label="이 지구 과거 이벤트">
      <header className="flex items-baseline justify-between">
        <h3 className="text-caption font-semibold text-foreground-muted">과거 이벤트</h3>
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
