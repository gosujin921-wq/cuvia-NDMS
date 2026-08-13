/* ─────────────────────────────────────────────
 * 사건 타임라인 — 03 화면정의서 §3 동작 · 04 §4-6 · 차수 L
 *
 * 선택한 카드 아래 **접이식 상세**로 선다. 발생 → 확인 → 전파 → 격상 → 시나리오 →
 * 승인 → 실행 → 실패 → 대체 조치가 시간순 한 줄기로 읽히는 자리다. 행은 전부
 * 파생이다(demo/timeline.ts) — 여기서 값을 만들지 않는다.
 *
 * 접지 않는다 — 사건이 어디까지 왔는지는 항상 보여야 한다. 레일에서 남는 높이를 이
 * 카드가 받아 늘어나고, 그래도 넘치면 본문 목록만 자기 안에서 스크롤한다. 해제 사건의
 * 복기와 전체 기록 열람은 좌측 메뉴 [통계·분석](SCR-04 사건 이력 탭)이 맡는다.
 * ───────────────────────────────────────────── */

import { cn } from "@ds";
import type { AlertEvent } from "../../../demo/events";
import { eventTimelineAt } from "../../../demo/timeline";
import { formatClock } from "../../../lib/datetime";
import { useScenario } from "../../../state/ScenarioProvider";

export function EventTimeline({ event }: { event: AlertEvent }) {
  const {
    now,
    dispatches,
    approvedResponseLevel,
    approvedAt,
    sopExecutedItemIds,
    phoneReportedAt,
  } = useScenario();

  const entries = eventTimelineAt(event, {
    now,
    dispatches,
    approvedResponseLevel,
    approvedAt,
    sopExecutedItemIds,
    phoneReportedAt,
  });
  if (entries.length === 0) return null;

  return (
    /* 독립 카드다(03 §2 판단·대응) — 사건의 시간 흐름이지 위험도 판정의 하위가 아니다.
       접지 않는다. 레일에 남는 높이를 이 카드가 받아 늘어나고, 넘치면 본문만 스크롤한다 */
    <section className="flex h-full min-h-0 flex-col" aria-label="사건 진행">
      <header className="flex shrink-0 items-baseline gap-2 px-3 pb-1 pt-2.5">
        <h2 className="text-body font-semibold text-foreground">사건 진행</h2>
        <span className="text-caption text-foreground-subtle">{entries.length}건</span>
      </header>

      <ol className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-2">
        {entries.map((entry, index) => (
          <li key={`${entry.at.toISOString()}-${entry.kind}-${index}`} className="flex gap-2">
            {/* 점과 세로선 — 마지막 행은 선을 내리지 않는다 */}
            <div className="flex w-2 shrink-0 flex-col items-center">
              <span
                className="mt-1 size-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color ?? "var(--color-foreground-subtle)" }}
                aria-hidden
              />
              {index < entries.length - 1 && <span className="w-px flex-1 bg-border" aria-hidden />}
            </div>
            <div className={cn("min-w-0 flex-1", index < entries.length - 1 && "pb-2")}>
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-caption text-foreground">
                  {entry.label}
                </span>
                <span className="shrink-0 font-mono text-caption text-foreground-subtle">
                  {formatClock(entry.at)}
                </span>
              </div>
              {entry.detail && (
                <p className="truncate text-caption text-foreground-subtle">{entry.detail}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
