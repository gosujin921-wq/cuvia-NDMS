/* ─────────────────────────────────────────────
 * 이벤트 단계 색상 기준표 — 03 화면정의서 §1 좌하단
 *
 * 지도와 목록에서 색이 무엇을 뜻하는지 화면에 상시 세워 둔다. 시연을 처음 보는 사람이
 * "빨간 건 뭔가요"를 묻지 않게 하는 자리다.
 * ───────────────────────────────────────────── */

import { cn } from "@ds";
import { ALERT_LEVELS } from "../../../demo/levels";
import { levelTone } from "../../../lib/level-tone";

export function LevelLegend() {
  return (
    <section className="flex flex-col gap-1.5 p-3" aria-label="이벤트 발생 단계별 색상 기준">
      <h2 className="text-caption font-semibold text-foreground-muted">이벤트 단계</h2>
      <ul className="flex flex-col gap-1">
        {ALERT_LEVELS.map((level) => (
          <li key={level.id} className="flex items-center gap-2 text-caption">
            <span
              className={cn("size-2.5 shrink-0 rounded-sm", levelTone(level.id).dot)}
              aria-hidden
            />
            <span className="font-medium text-foreground">{level.label}</span>
            <span className="text-foreground-subtle">{level.meaning}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
