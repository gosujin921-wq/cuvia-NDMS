/* ─────────────────────────────────────────────
 * 연계 현황 — 03 화면정의서 §1 우하단
 *
 * 상급기관과 데이터가 실제로 오가고 있는지를 화면에서 바로 보이는 자리. 기관별 점 하나와
 * 최근 전송 시각만 둔다. 상세 화면은 두지 않는다.
 * ───────────────────────────────────────────── */

import { StatusDotLabel } from "@ds";
import { INTEROP_LINKS } from "../../../demo/interop";
import { DEMO_NOW } from "../../../demo/events";
import { formatClock, formatRelative } from "../../../lib/datetime";

export function InteropPanel() {
  const broken = INTEROP_LINKS.filter((link) => link.status === "끊김").length;

  return (
    /* 레일에서 남는 높이를 받는 패널 — 헤더는 자리를 지키고 목록만 스크롤한다.
       레일 전체를 스크롤하면 기관 목록을 내리는 동안 제목이 같이 사라진다 */
    <section className="flex min-h-0 flex-1 flex-col gap-2 p-3" aria-label="연계 현황">
      <header className="flex shrink-0 items-baseline justify-between">
        <h2 className="text-body font-semibold text-foreground">연계 현황</h2>
        <span className="text-caption text-foreground-subtle">
          {broken > 0 ? `${INTEROP_LINKS.length}곳 중 ${broken}곳 끊김` : `${INTEROP_LINKS.length}곳 정상`}
        </span>
      </header>

      <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {INTEROP_LINKS.map((link) => (
          <li
            key={link.id}
            className="flex items-center justify-between gap-2 border-b border-border py-1.5 last:border-b-0"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <StatusDotLabel
                status={link.status === "정상" ? "success" : "danger"}
                label={link.org}
              />
              <span className="truncate pl-3 text-caption text-foreground-subtle">
                {link.subject}
              </span>
            </div>
            <span className="shrink-0 text-right text-caption text-foreground-muted">
              <span className="font-mono">{formatClock(link.lastSyncAt)}</span>
              <span className="block text-foreground-subtle">
                {formatRelative(link.lastSyncAt, DEMO_NOW)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
