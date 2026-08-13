/* ─────────────────────────────────────────────
 * 관제 팝업 이력 탭 — KISA 관제 팝업 이식분
 *
 * 원본: cuvia_platform_web `kits/event-kit/src/control-popup/history-tab.tsx`
 *
 * 원본의 세로 타임라인 문법을 그대로 옮겼다: 좌측 점(굵은 테두리 + 표면색 채움)과
 * 세로선, 우측에 제목 · 태그 · 우측 정렬 시각, 그 아래 부연 한 줄.
 *
 * 행은 원본처럼 소비처가 넘긴다. DSMS 쪽 출처는 `demo/timeline.ts eventTimelineAt` 이고
 * 그것도 별도 원장이 아니라 단계 이력·전파·승인·실행 결과에서 파생한 것이다 —
 * 같은 사건을 두 원장이 말하지 않는다. 여기서 값을 만들지 않는다.
 * ───────────────────────────────────────────── */

import { EmptyState, Tag, cn } from "@ds";
import type { TimelineEntry, TimelineKind } from "../../../demo/timeline";
import { formatDateTime } from "../../../lib/datetime";

/** 점 색 — 행이 색을 들면(단계·승인·실패) 그것이 이기고, 아니면 종류별 기본색 */
const KIND_DOT: Record<TimelineKind, string> = {
  stage: "var(--color-foreground-subtle)",
  confirm: "var(--color-foreground-subtle)",
  dispatch: "var(--color-primary)",
  scenario: "var(--color-warning)",
  approve: "var(--color-primary)",
  fail: "var(--color-danger)",
  fallback: "var(--color-success)",
  clear: "var(--color-foreground-subtle)",
};

/** 한눈에 갈리는 행만 태그를 단다 — 전 행에 달면 색만 늘고 읽히지 않는다 */
const KIND_TAG: Partial<Record<TimelineKind, { label: string; tone: "neutral" | "success" | "warning" | "danger" }>> = {
  dispatch: { label: "전파", tone: "neutral" },
  approve: { label: "승인", tone: "warning" },
  fail: { label: "실패", tone: "danger" },
  fallback: { label: "대체 조치", tone: "success" },
};

export function HistoryTab({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        variant="inline"
        icon="mdi:timeline-clock-outline"
        message="아직 쌓인 이력이 없습니다."
      />
    );
  }

  return (
    <ol className="flex flex-col">
      {entries.map((entry, i) => {
        const last = i === entries.length - 1;
        const tag = KIND_TAG[entry.kind];
        return (
          <li key={`${entry.at.toISOString()}-${entry.kind}-${i}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className="z-10 mt-1 size-3 shrink-0 rounded-full border-2 bg-surface"
                style={{ borderColor: entry.color ?? KIND_DOT[entry.kind] }}
                aria-hidden
              />
              {!last && <span className="mt-1 w-px flex-1 bg-border" aria-hidden />}
            </div>
            <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-4")}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-body font-medium text-foreground">{entry.label}</span>
                {tag && <Tag tone={tag.tone}>{tag.label}</Tag>}
                <span className="ml-auto shrink-0 font-mono text-caption text-foreground-muted">
                  {formatDateTime(entry.at)}
                </span>
              </div>
              {entry.detail && (
                <p className="mt-0.5 text-caption text-foreground-muted">{entry.detail}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
