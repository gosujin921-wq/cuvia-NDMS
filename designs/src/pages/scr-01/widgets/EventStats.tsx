/* ─────────────────────────────────────────────
 * 이벤트 발생 통계 — 03 화면정의서 §1 우측
 *
 * 도넛 둘. 왼쪽 도넛은 "무엇이" (타입별), 오른쪽 도넛은 "얼마나 급했는지" (단계별)를 말한다.
 * 기준은 최근 30일 고정이다. 기간을 고르는 자리는 통계 화면(SCR-04)이다.
 * ───────────────────────────────────────────── */

import { RingDonut } from "../../../components/RingDonut";
import {
  STATS_BY_LEVEL,
  STATS_BY_TYPE,
  STATS_PERIOD_DAYS,
  STATS_TOTAL,
  type EventType,
} from "../../../demo/events";
import { levelSpec } from "../../../demo/levels";

/** 타입별 색 — 장비 종류 색과 맞춘다(04 §2-1). 단계 색과 겹치지 않아야 한다 */
const TYPE_COLOR: Record<EventType, string> = {
  수위: "var(--color-primary)",
  강우: "var(--color-primary-text)",
  변위: "var(--color-success)",
};

export function EventStats() {
  const typeSegments = STATS_BY_TYPE.map((s) => ({
    value: s.count,
    color: TYPE_COLOR[s.type],
    label: s.type,
  }));
  const levelSegments = STATS_BY_LEVEL.map((s) => ({
    value: s.count,
    color: levelSpec(s.level).color,
    label: levelSpec(s.level).label,
  }));

  return (
    <section className="flex flex-col gap-3 p-3" aria-label="이벤트 발생 통계">
      <header className="flex items-baseline justify-between">
        <h2 className="text-body font-semibold text-foreground">이벤트 발생 통계</h2>
        <span className="text-caption text-foreground-subtle">최근 {STATS_PERIOD_DAYS}일</span>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <StatDonut
          caption="타입별"
          ariaLabel={`타입별 발생 통계. ${STATS_BY_TYPE.map((s) => `${s.type} ${s.count}건`).join(", ")}`}
          segments={typeSegments}
        />
        <StatDonut
          caption="단계별"
          ariaLabel={`단계별 발생 통계. ${STATS_BY_LEVEL.map((s) => `${levelSpec(s.level).label} ${s.count}건`).join(", ")}`}
          segments={levelSegments}
        />
      </div>
    </section>
  );
}

function StatDonut({
  caption,
  ariaLabel,
  segments,
}: {
  caption: string;
  ariaLabel: string;
  segments: { value: number; color: string; label: string }[];
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <RingDonut segments={segments} size={92} thickness={9} ariaLabel={ariaLabel}>
        <span className="font-mono text-h6 font-semibold leading-none text-foreground">
          {STATS_TOTAL}
        </span>
        <span className="mt-0.5 text-caption text-foreground-subtle">{caption}</span>
      </RingDonut>
      <ul className="flex w-full flex-col gap-0.5">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center gap-1.5 text-caption">
            <span
              className="size-2 shrink-0 rounded-sm"
              style={{ backgroundColor: seg.color }}
              aria-hidden
            />
            <span className="flex-1 truncate text-foreground-muted">{seg.label}</span>
            <span className="font-mono text-foreground">{seg.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
