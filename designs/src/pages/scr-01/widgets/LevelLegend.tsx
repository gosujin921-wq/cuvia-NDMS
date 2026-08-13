/* ─────────────────────────────────────────────
 * 계측단계 색상 기준표 — 03 화면정의서 §0-2 · §1 좌하단
 *
 * 지도와 목록에서 색이 무엇을 뜻하는지 화면에 상시 세워 둔다. 시연을 처음 보는 사람이
 * "빨간 건 뭔가요"를 묻지 않게 하는 자리다.
 *
 * `계측단계` 라벨을 단 한 줄 범례다. 같은 화면에 특보의 "주의보"(기상 카드)와 계측의
 * "주의보"가 함께 서므로, 이 범례가 어느 축을 말하는지부터 밝힌다(03 §0-8).
 * 단계의 뜻(기준선에 닿음 등)은 tooltip 으로 내렸다.
 * ───────────────────────────────────────────── */

import { cn } from "@ds";
import { ALERT_LEVELS } from "../../../demo/levels";
import { levelTone } from "../../../lib/level-tone";

export function LevelLegend() {
  return (
    <section
      className="flex items-center gap-3 px-3 py-2"
      aria-label="계측단계 색상 기준"
    >
      <h2 className="shrink-0 text-caption font-semibold text-foreground-muted">계측단계</h2>
      <ul className="flex items-center gap-3">
        {ALERT_LEVELS.map((level) => (
          <li
            key={level.id}
            className="flex items-center gap-1.5 text-caption text-foreground"
            title={level.meaning}
          >
            <span
              className={cn("size-2.5 shrink-0 rounded-sm", levelTone(level.id).dot)}
              aria-hidden
            />
            {level.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
