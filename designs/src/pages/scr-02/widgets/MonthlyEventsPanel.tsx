/* ─────────────────────────────────────────────
 * 월별 이벤트 발생 현황 — 03 화면정의서 §2 우측
 *
 * 이 지구가 어느 달에 위험했는지를 12개월로 본다. 여름에 몰리는 것이 한눈에 보여야
 * "지금이 그 시기"라는 판단이 선다.
 * ───────────────────────────────────────────── */

import { monthlyEvents } from "../../../demo/measurements";

export function MonthlyEventsPanel({ districtId }: { districtId: string }) {
  const months = monthlyEvents(districtId);
  const max = Math.max(1, ...months.map((m) => m.count));
  const total = months.reduce((sum, m) => sum + m.count, 0);

  return (
    <section className="flex flex-col gap-2 p-3" aria-label="월별 이벤트 발생 현황">
      <header className="flex items-baseline justify-between">
        <h2 className="text-body font-semibold text-foreground">월별 이벤트 발생 현황</h2>
        <span className="text-caption text-foreground-subtle">최근 12개월 {total}건</span>
      </header>

      <ul className="flex h-24 items-end gap-1" role="img" aria-label={`월별 발생 건수, 총 ${total}건`}>
        {months.map((month, index) => (
          <li key={`${month.month}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="font-mono text-caption text-foreground-muted">
              {month.count > 0 ? month.count : ""}
            </span>
            <span
              className="w-full rounded-t bg-primary"
              style={{
                height: `${Math.max(2, (month.count / max) * 56)}px`,
                opacity: index === months.length - 1 ? 1 : 0.55,
              }}
              aria-hidden
            />
            <span className="truncate text-caption text-foreground-subtle">{month.month}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
