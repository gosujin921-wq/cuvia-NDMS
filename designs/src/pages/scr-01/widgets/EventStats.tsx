/* ─────────────────────────────────────────────
 * 최근 30일 발생 통계 — 03 화면정의서 §1 우측 중단
 *
 * 총 건수 + 재난유형 축 도넛 하나다. 계측 단계별 분포(주의보·경보·대피)는 SCR-04 몫
 * (03 §1). 종합상황은 지금을 보는 화면이라 30일 단계 분포는 우선순위가 낮고, 같은
 * 화면에 "주의보"가 또 서면 특보·계측과 세 번째로 겹친다.
 * ───────────────────────────────────────────── */

import { RingDonut } from "../../../components/RingDonut";
import { STATS_PERIOD_DAYS, statsByHazardTypeAt, statsTotalAt } from "../../../demo/events";
import { HAZARD_COLOR } from "../../../lib/hazard-colors";
import { useScenario } from "../../../state/ScenarioProvider";

export function EventStats() {
  /* 유형 도넛은 재난유형 축이다. 관측 축(수위·강우·변위)은 통계 화면 관측 분석 몫.
     30일 창은 트랙 시계를 따른다 (04 §15) */
  const { now } = useScenario();
  const statsByHazard = statsByHazardTypeAt(now);
  const segments = statsByHazard.map((s) => ({
    value: s.count,
    color: HAZARD_COLOR[s.type],
    label: s.label,
  }));

  return (
    <section className="flex flex-col gap-3 p-3" aria-label="최근 30일 발생 통계">
      <header className="flex items-baseline justify-between">
        <h2 className="text-body font-semibold text-foreground">
          최근 {STATS_PERIOD_DAYS}일 발생 통계
        </h2>
        <span className="text-caption text-foreground-subtle">재난유형별</span>
      </header>

      <div className="flex items-center gap-4">
        <RingDonut
          segments={segments}
          size={100}
          thickness={10}
          ariaLabel={`재난유형별 발생 통계. ${statsByHazard.map((s) => `${s.label} ${s.count}건`).join(", ")}`}
        >
          <span className="font-mono text-h5 font-semibold leading-none text-foreground">
            {statsTotalAt(now)}
          </span>
          <span className="mt-0.5 text-caption text-foreground-subtle">건</span>
        </RingDonut>
        <ul className="flex min-w-0 flex-1 flex-col gap-1">
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
    </section>
  );
}
