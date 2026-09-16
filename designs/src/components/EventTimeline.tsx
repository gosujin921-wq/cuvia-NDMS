/* ─────────────────────────────────────────────
 * 이벤트 이력 타임라인 — 한 사건이 어떻게 흘러갔나 (IA §10.1 · 2026-09-16 사용자 "KISA 나 CSMS 처럼")
 *
 * ▸ 구조 정본: CSMS `pages/scr-04/widgets/EventTimeline.tsx`(통합 타임라인). 레일은 KISA `scr-2500/HistoryTab.tsx` 와 같다.
 *   같은 모양으로 짜고 부품만 `@ds` 로 쓴다.
 *     머리    요약 한 줄(화면이 넘긴다) · 범례(● 사건 흐름 ■ 조치) · 정렬(시간순·최신순)
 *     줄      왼쪽 시각 칸(w-14 · HH:mm) → 레일(점 + 세로선, 마지막 줄은 선 없음) → 종류 뱃지 · 내용 · 담당(오른쪽 고정폭)
 *     점      사건 흐름은 둥근 점(등급·상태 색, 없으면 빈 점) · 조치는 네모 점(실패는 위험색) · 종료는 체크 아이콘
 *     날짜    날짜가 바뀌는 자리에 날짜 줄 하나. 시각 칸에는 날짜를 섞지 않는다
 *   CSMS 와 다른 점 하나: 기본 정렬이 시간순이다. CSMS 는 지금 벌어지는 일을 보는 관제라 최신이 위고,
 *   이력은 지난 일을 처음부터 되짚는 자리라 오래된 것이 위다. 최신순은 정렬 칩으로 바꾼다.
 *
 * 줄의 값은 model/records.ts 의 incidentTimelineAt 이 만든다 — 이 부품은 찍기만 한다.
 * TODO(ds): CSMS EventTimeline · KISA HistoryTab 과 같은 부품. DS 승격 대상
 * ───────────────────────────────────────────── */

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Icon } from "@iconify/react";
import { Badge, EmptyState, FilterCapsuleGroup, cn } from "@ds";
import { formatClock, formatDate } from "../lib/datetime";
import type { RecordTimelineEntry } from "../model/records";

const ORDERS = ["시간순", "최신순"];

export function EventTimeline({ entries, summary }: {
  entries: RecordTimelineEntry[];
  /** 머리 한 줄 — 상태·기간·조치·전파·실패 */
  summary?: ReactNode;
}) {
  const [order, setOrder] = useState(ORDERS[0]);
  const rows = useMemo(() => (order === "최신순" ? [...entries].reverse() : entries), [entries, order]);

  if (entries.length === 0) {
    return <EmptyState variant="inline" icon="mdi:timeline-clock-outline" message="기록된 이벤트가 없습니다" />;
  }

  return (
    <section aria-label="이벤트 이력" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {summary && <div className="min-w-0 flex-1 text-caption text-foreground-muted">{summary}</div>}
        <div className="ml-auto flex shrink-0 items-center gap-3 text-caption text-foreground-subtle">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full border border-foreground-subtle" aria-hidden />
            사건 흐름
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-foreground-muted" aria-hidden />
            조치
          </span>
          <FilterCapsuleGroup options={ORDERS} value={order} onChange={setOrder} />
        </div>
      </div>

      <ol className="flex flex-col">
        {rows.map((entry, i) => {
          const day = formatDate(entry.at);
          const newDay = i === 0 || formatDate(rows[i - 1].at) !== day;
          return (
            <Fragment key={entry.key}>
              {newDay && (
                <li aria-hidden className={cn("flex items-center gap-3 pb-2", i > 0 && "pt-1")}>
                  <span className="w-14 shrink-0 text-right font-mono text-caption text-foreground-subtle">{day.slice(5).replace("-", ".")}</span>
                  <span className="h-px flex-1 bg-border" />
                </li>
              )}
              <Row entry={entry} last={i === rows.length - 1} />
            </Fragment>
          );
        })}
      </ol>
    </section>
  );
}

function Row({ entry, last }: { entry: RecordTimelineEntry; last: boolean }) {
  return (
    <li className="flex gap-3">
      <span className="w-14 shrink-0 pt-0.5 text-right font-mono text-caption tabular-nums text-foreground-muted">
        {formatClock(entry.at)}
      </span>

      <div className="flex w-4 shrink-0 flex-col items-center">
        {entry.lane === "close" ? (
          <Icon
            icon={entry.closeKind === "종료" ? "mdi:check-circle" : "mdi:close-circle-outline"}
            className={cn("mt-0.5 size-4 shrink-0", entry.closeKind === "종료" ? "text-success" : "text-warning")}
            aria-hidden
          />
        ) : entry.lane === "flow" ? (
          <span
            className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", entry.dot ?? "border border-foreground-subtle bg-surface")}
            aria-hidden
          />
        ) : (
          <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-sm", entry.failed ? "bg-danger" : "bg-foreground-muted")} aria-hidden />
        )}
        {!last && <span className="mt-1 w-px flex-1 bg-border" aria-hidden />}
      </div>

      <div className={cn("flex min-w-0 flex-1 flex-col gap-1", last ? "pb-1" : "pb-4")}>
        <div className="flex min-w-0 items-start gap-2">
          <Badge variant={entry.badge} className="shrink-0">{entry.kind}</Badge>
          <span
            className={cn(
              "min-w-0 flex-1 text-body",
              entry.failed ? "font-medium text-danger" : entry.lane === "close" ? "font-semibold text-foreground" : entry.lane === "flow" ? "text-foreground-muted" : "text-foreground",
            )}
          >
            {entry.label}
          </span>
          {entry.actor && (
            <span className="w-28 shrink-0 truncate pt-0.5 text-right text-caption text-foreground-muted" title={entry.actor}>
              {entry.actor}
            </span>
          )}
        </div>
        {entry.detail && <p className="text-caption text-foreground-subtle">{entry.detail}</p>}
      </div>
    </li>
  );
}
