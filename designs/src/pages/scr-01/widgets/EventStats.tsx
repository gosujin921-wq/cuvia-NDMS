/* ─────────────────────────────────────────────
 * 이벤트 발생 통계 — 03 화면정의서 §1 우측
 *
 * 도넛 둘. 왼쪽 도넛은 "무엇이" (타입별), 오른쪽 도넛은 "얼마나 급했는지" (단계별)를 말한다.
 * 기준은 최근 30일 고정이다. 기간을 고르는 자리는 통계 화면(SCR-04)이다.
 * ───────────────────────────────────────────── */

import { RingDonut } from "../../../components/RingDonut";
import {
  STATS_PERIOD_DAYS,
  STATS_TOTAL,
  statsByHazardType,
  statsByLevelAt,
} from "../../../demo/events";
import { levelSpec } from "../../../demo/levels";
import { HAZARD_COLOR } from "../../../lib/hazard-colors";
import { useScenario } from "../../../state/ScenarioProvider";

export function EventStats() {
  /* 단계 도넛은 now 까지 확정된 계측 단계로 센다(04 §4-3) — 격상되면 숫자가 움직인다.
     유형 도넛은 재난유형 축이다 — 관측 축(수위·강우·변위)은 통계 화면 관측 분석 몫 */
  const { now } = useScenario();
  const statsByLevel = statsByLevelAt(now);
  const statsByHazard = statsByHazardType();
  const typeSegments = statsByHazard.map((s) => ({
    value: s.count,
    color: HAZARD_COLOR[s.type],
    label: s.label,
  }));
  const levelSegments = statsByLevel.map((s) => ({
    value: s.count,
    color: levelSpec(s.level).color,
    label: levelSpec(s.level).label,
  }));

  return (
    <section className="flex flex-col gap-3 p-3" aria-label="이벤트 발생 통계">
      <header className="flex items-baseline justify-between">
        <h2 className="text-body font-semibold text-foreground">재난유형별 발생 통계</h2>
        <span className="text-caption text-foreground-subtle">최근 {STATS_PERIOD_DAYS}일</span>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <StatDonut
          caption="유형별"
          ariaLabel={`재난유형별 발생 통계. ${statsByHazard.map((s) => `${s.label} ${s.count}건`).join(", ")}`}
          segments={typeSegments}
        />
        <StatDonut
          caption="단계별"
          ariaLabel={`단계별 발생 통계. ${statsByLevel.map((s) => `${levelSpec(s.level).label} ${s.count}건`).join(", ")}`}
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
