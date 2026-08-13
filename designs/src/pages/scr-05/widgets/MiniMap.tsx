/* ─────────────────────────────────────────────
 * 시 전체 미니맵 — 03 화면정의서 §5 우상단
 *
 * 3D 로 들어가면 지금 보는 곳이 시 어디쯤인지 감이 끊긴다. 12개 지구를 점으로 찍고
 * 현재 지구를 짚어, 화면이 어디를 보고 있는지 남긴다. 지구를 눌러 옮겨 다닐 수도 있다.
 * ───────────────────────────────────────────── */

import { DISTRICTS, type District } from "../../../demo/districts";
import { activeEventOfAt, eventViewAt } from "../../../demo/events";
import { useScenario } from "../../../state/ScenarioProvider";
import { levelSpec } from "../../../demo/levels";
import { CITY_NAME } from "../../../lib/map-config";

const WIDTH = 260;
const HEIGHT = 190;
const PAD = 18;

export function MiniMap({
  current,
  onSelect,
}: {
  current: District;
  onSelect: (district: District) => void;
}) {
  const { now } = useScenario();
  const lngs = DISTRICTS.map((d) => d.center[0]);
  const lats = DISTRICTS.map((d) => d.center[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const x = (lng: number) =>
    PAD + ((lng - minLng) / (maxLng - minLng || 1)) * (WIDTH - PAD * 2);
  /* 위도는 위쪽이 커야 하므로 뒤집는다 */
  const y = (lat: number) =>
    HEIGHT - PAD - ((lat - minLat) / (maxLat - minLat || 1)) * (HEIGHT - PAD * 2);

  return (
    <section className="flex flex-col gap-1 p-3" aria-label="시 전체 미니맵">
      <header className="flex items-baseline justify-between">
        <h2 className="text-caption font-semibold text-foreground-muted">{CITY_NAME}</h2>
        <span className="text-caption text-foreground-subtle">{current.name}</span>
      </header>

      <svg width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="지구 위치">
        {DISTRICTS.map((district) => {
          const active = district.id === current.id;
          const event = activeEventOfAt(district.id, now);
          const color = event
            ? levelSpec(eventViewAt(event, now).level).color
            : "var(--color-foreground-subtle)";

          return (
            <g
              key={district.id}
              onClick={() => onSelect(district)}
              className="cursor-pointer"
              role="button"
              aria-label={district.name}
            >
              {active && (
                <circle
                  cx={x(district.center[0])}
                  cy={y(district.center[1])}
                  r={9}
                  fill="none"
                  stroke="var(--color-primary-text)"
                  strokeWidth={1.5}
                />
              )}
              <circle
                cx={x(district.center[0])}
                cy={y(district.center[1])}
                r={active ? 4.5 : 3}
                fill={active ? "var(--color-primary-text)" : color}
              />
              {active && (
                <text
                  x={x(district.center[0])}
                  y={y(district.center[1]) - 13}
                  fill="var(--color-foreground)"
                  fontSize={11}
                  textAnchor="middle"
                >
                  {district.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </section>
  );
}
