/* ─────────────────────────────────────────────
 * 시간대별 풍향·풍속 — 03 화면정의서 §2 우측
 *
 * 해일 지구는 바람이 곧 위험이다. 3시간 간격 8구간으로 풍향·풍속과 강수 확률을 함께 둔다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { hourlyForecast } from "../../../demo/measurements";

/** 풍향 → 화살표 회전각. 화살표는 "바람이 가는 쪽"을 가리킨다 */
const DIRECTION_DEG: Record<string, number> = {
  북: 180,
  북동: 225,
  동: 270,
  남동: 315,
  남: 0,
  남서: 45,
  서: 90,
  북서: 135,
};

export function WindPanel({ districtId, districtName }: { districtId: string; districtName: string }) {
  const slots = hourlyForecast(districtId);

  return (
    <section className="flex flex-col gap-2 p-3" aria-label={`${districtName} 시간대별 풍향·풍속`}>
      <h2 className="text-body font-semibold text-foreground">시간대별 풍향·풍속</h2>

      <ul className="flex gap-1">
        {slots.map((slot) => (
          <li key={slot.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="truncate text-caption text-foreground-subtle">{slot.label}</span>
            <Icon
              icon="mdi:navigation"
              className="size-4 text-primary-text"
              style={{ transform: `rotate(${DIRECTION_DEG[slot.windDirection] ?? 0}deg)` }}
              aria-hidden
            />
            <span className="font-mono text-caption text-foreground">{slot.windSpeed}</span>
            <span className="text-caption text-foreground-subtle">{slot.rainProbability}%</span>
          </li>
        ))}
      </ul>
      <p className="text-caption text-foreground-subtle">풍속 m/s · 아래는 강수확률</p>
    </section>
  );
}
