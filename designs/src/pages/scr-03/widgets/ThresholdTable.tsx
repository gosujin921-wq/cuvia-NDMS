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
import type { AlertEvent } from "../../../demo/events";
import type { WaterThreshold } from "../../../demo/levels";

interface ThresholdTableProps {
  event: AlertEvent;
  threshold: WaterThreshold;
}

export function ThresholdTable({ event, threshold }: ThresholdTableProps) {
  /* 구간 = [기준값, 다음 단계 기준값). 대피는 상한이 없다 */
  const rows = ALERT_LEVELS.map((level, index) => {
    const from = threshold[level.id];
    const next = ALERT_LEVELS[index + 1];
    const to = next ? threshold[next.id] : null;
    const inRange = event.value >= from && (to === null || event.value < to);
    return { level, from, to, inRange };
  });

  return (
    <section className="flex flex-col gap-1.5 p-3" aria-label="발령 기준표">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-caption font-semibold text-foreground-muted">발령 기준</h2>
        <span className="min-w-0 truncate text-caption text-foreground-subtle">{event.device}</span>
      </header>

      <Table className="text-caption">
        <TableBody>
          {rows.map(({ level, from, to, inRange }) => (
            <TableRow
              key={level.id}
              data-state={inRange ? "selected" : undefined}
              className="border-b-0"
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
        발생 당시{" "}
        <span className="font-mono text-foreground">
          {event.value} {event.unit}
        </span>
      </p>
    </section>
  );
}
