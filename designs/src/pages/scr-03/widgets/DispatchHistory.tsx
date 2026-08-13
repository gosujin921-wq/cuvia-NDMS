/* ─────────────────────────────────────────────
 * 이벤트 전파 내역 — 03 화면정의서 §3 우하단
 *
 * 언제·어떤 수단으로·몇 명에게 갔는지가 남는다. 나중에 되짚을 수 있어야 전파가 기록으로
 * 성립한다. 새로 전파하면 맨 위에 쌓인다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { CHANNELS, type DispatchRecord } from "../../../demo/dispatch";
import { DEMO_NOW } from "../../../demo/events";
import { formatClock, formatRelative } from "../../../lib/datetime";

export function DispatchHistory({ records }: { records: DispatchRecord[] }) {
  return (
    /* 레일에서 남는 높이를 받는 패널 — 헤더는 자리를 지키고 내역만 스크롤한다.
       전파가 쌓일수록 목록만 길어지고 위 패널(그래프·전파 버튼)은 그대로 서 있다 */
    <section className="flex min-h-0 flex-1 flex-col gap-1.5 p-3" aria-label="이벤트 전파 내역">
      <header className="flex shrink-0 items-baseline justify-between">
        <h2 className="text-body font-semibold text-foreground">이벤트 전파 내역</h2>
        <span className="text-caption text-foreground-subtle">{records.length}건</span>
      </header>

      <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {records.map((record) => (
          <li
            key={record.id}
            className="flex flex-col gap-1 border-b border-border py-2 last:border-b-0"
          >
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate text-caption text-foreground">
                {record.summary}
              </span>
              <span className="shrink-0 font-mono text-caption text-foreground-muted">
                {formatClock(record.at)}
              </span>
            </div>
            {/* 수단이 넷까지 늘어난다. 라벨이 줄 안에서 쪼개지지 않게 묶어서 넘긴다 */}
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                {CHANNELS.filter((c) => record.channels.includes(c.id)).map((channel) => (
                  <span
                    key={channel.id}
                    className="flex shrink-0 items-center gap-1 whitespace-nowrap text-caption text-foreground-subtle"
                  >
                    <Icon icon={channel.icon} className="size-3.5 shrink-0" aria-hidden />
                    {channel.label}
                  </span>
                ))}
              </div>
              <span className="ml-auto shrink-0 whitespace-nowrap text-caption text-foreground-subtle">
                {record.recipients.toLocaleString()}명 · {formatRelative(record.at, DEMO_NOW)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
