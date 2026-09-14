/* ─────────────────────────────────────────────
 * 상태·관계 이력 — 사건 작업공간 우측 (IA §7). Phase 1 사건 진행 카드의 골격 그대로
 *
 * 후보 생성 → 검토 인수 → 확인 → 판단 → 권고 → 승인 → 조치 → 전파 → 통제 → 종료가 시간순 한 줄기로 읽힌다.
 * 행은 사건의 업무·분석 이벤트를 현재 시계로 자른 것이다 — 여기서 값을 만들지 않는다. 접지 않는다.
 * ───────────────────────────────────────────── */

import { cn } from "@ds";
import type { EventEnvelope } from "../../../model/event";
import { formatClock } from "../../../lib/datetime";

const DOT: Partial<Record<string, string>> = {
  INCIDENT_STATUS_CHANGED: "var(--color-primary)",
  DECISION_RECORDED: "var(--color-warning)",
  DISSEMINATION_RESULT_RECORDED: "var(--color-success)",
  ACTION_STATUS_CHANGED: "var(--color-success)",
};

export function EventTimeline({ events }: { events: EventEnvelope[] }) {
  const entries = events.filter((e) => e.eventClass === "업무" || e.eventClass === "분석").slice().reverse();
  if (entries.length === 0) return null;
  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="이력">
      <header className="flex shrink-0 items-baseline gap-2 px-3 pb-1 pt-2.5">
        <h2 className="text-body font-semibold text-foreground">이력</h2>
        <span className="text-caption text-foreground-subtle">{entries.length}건</span>
      </header>
      <ol className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-2">
        {entries.map((e, index) => {
          const failed = e.summary.includes("실패");
          return (
            <li key={e.eventId} className="flex gap-2">
              <div className="flex w-2 shrink-0 flex-col items-center">
                <span className="mt-1 size-2 shrink-0 rounded-full" style={{ backgroundColor: failed ? "var(--color-danger)" : DOT[e.eventType] ?? "var(--color-foreground-subtle)" }} aria-hidden />
                {index < entries.length - 1 && <span className="w-px flex-1 bg-border" aria-hidden />}
              </div>
              <div className={cn("min-w-0 flex-1", index < entries.length - 1 && "pb-2")}>
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-caption text-foreground">{e.summary}</span>
                  <span className="shrink-0 font-mono text-caption text-foreground-subtle">{formatClock(e.observedAt)}</span>
                </div>
                <p className="truncate text-caption text-foreground-subtle">{e.actor ?? e.sourceSystem}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
