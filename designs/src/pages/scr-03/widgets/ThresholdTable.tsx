/* ─────────────────────────────────────────────
 * 이벤트 발생 센서 발령 기준표 — 03 화면정의서 §3 좌하단
 *
 * 그 장비가 몇 미터부터 주의보이고 몇 미터부터 대피인지를 색과 숫자로 세운다.
 * 현재값이 어느 구간에 있는지 표시해, "지금 어디쯤인가"를 표에서 바로 읽게 한다.
 *
 * DS Table 을 쓴다. 지금 값이 든 구간은 TableRow 의 data-state="selected" 로 세운다 —
 * 오버레이 패널이라 셀 여백만 DS 기본(p-3)에서 조인다.
 * ───────────────────────────────────────────── */

import { Table, TableBody, TableCell, TableRow, cn } from "@ds";
import { levelTone } from "../../../lib/level-tone";
import { ALERT_LEVELS } from "../../../demo/levels";
import type { AlertEvent, EventView } from "../../../demo/events";
import type { WaterThreshold } from "../../../demo/levels";
import type { TideScenario } from "../../../demo/forecast";

interface ThresholdTableProps {
  event: AlertEvent;
  /** now 시점의 이벤트 모습 — 짚는 구간·값이 격상을 따라온다 (04 §4-2) */
  view: EventView;
  threshold: WaterThreshold;
  /** 만조 조건 시나리오 — 있으면 도달 예상 수위가 든 구간을 점선으로 함께 짚는다 (03 §3) */
  scenario?: TideScenario | null;
}

export function ThresholdTable({ event, view, threshold, scenario }: ThresholdTableProps) {
  /* 구간 = [기준값, 다음 단계 기준값). 대피는 상한이 없다 */
  const rows = ALERT_LEVELS.map((level, index) => {
    const from = threshold[level.id];
    const next = ALERT_LEVELS[index + 1];
    const to = next ? threshold[next.id] : null;
    const inRange = view.value >= from && (to === null || view.value < to);
    /* 시나리오 구간 — 현재값과 다른 구간일 때만 점선이 뜻을 가진다. 같은 구간이면
       채움 표시가 이미 말하고 있다 */
    const scenarioHit =
      scenario != null &&
      scenario.peak >= from &&
      (to === null || scenario.peak < to) &&
      !inRange;
    return { level, from, to, inRange, scenarioHit };
  });

  return (
    <section className="flex flex-col gap-1.5 p-3" aria-label="발령 기준표">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-caption font-semibold text-foreground-muted">발령 기준</h2>
        <span className="min-w-0 truncate text-caption text-foreground-subtle">{event.device}</span>
      </header>

      <Table className="text-caption">
        <TableBody>
          {rows.map(({ level, from, to, inRange, scenarioHit }) => (
            <TableRow
              key={level.id}
              data-state={inRange ? "selected" : undefined}
              className={cn(
                "border-b-0",
                /* 조건 시나리오 값이 든 구간 — 점선으로 함께 짚는다(03 §3). 채움(현재)과
                   점선(도달 예상)이 한 표에서 "지금"과 "곧"을 가른다 */
                scenarioHit && "outline-dashed outline-1 -outline-offset-1 outline-foreground-subtle",
              )}
            >
              <TableCell className="w-5 px-1.5 py-1">
                <span
                  className={cn("block size-2.5 rounded-sm", levelTone(level.id).dot)}
                  aria-hidden
                />
              </TableCell>
              <TableCell
                className={
                  inRange
                    ? "px-1.5 py-1 font-medium text-foreground"
                    : "px-1.5 py-1 font-medium text-foreground-muted"
                }
              >
                {level.label}
              </TableCell>
              <TableCell className="px-1.5 py-1 text-right font-mono text-foreground-muted">
                {to === null ? `${from} ${event.unit} 이상` : `${from} ~ ${to} ${event.unit}`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className="text-caption text-foreground-subtle">
        {view.active ? "현재" : "발생 당시"}{" "}
        <span className="font-mono text-foreground">
          {view.value} {event.unit}
        </span>
        {scenario != null && (
          <>
            {" · "}시나리오{" "}
            <span className="font-mono text-foreground">
              {scenario.peak} {event.unit}
            </span>
          </>
        )}
      </p>
    </section>
  );
}
