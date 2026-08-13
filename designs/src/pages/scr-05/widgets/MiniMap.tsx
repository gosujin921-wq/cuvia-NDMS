/* ─────────────────────────────────────────────
 * 시 전체 미니맵 — 03 화면정의서 §5 우상단
 *
 * 3D 로 들어가면 지금 보는 곳이 시 어디쯤인지 감이 끊긴다. 12개 지구를 점으로 찍고
 * 현재 지구를 짚어, 화면이 어디를 보고 있는지 남긴다. 지구를 눌러 옮겨 다닐 수도 있다.
 *
 * ★ 지도가 아니라 **다이어그램**이다 — 차량 상세 경로 요약도(plaform_web RouteSketch)와
 *   같은 문법. MapLibre 인스턴스를 하나 더 띄우지 않고, 시 형상(5개 구 경계)을 SVG 로
 *   깔아 "어디쯤"이 읽히게 한다. 점만 띄우면 마산만·진해만이 없어서 해일 지구가
 *   내륙 지구와 구분되지 않는다.
 *
 * ★ 좌표 → 화면은 선형 변환이다. 시 폭이 45km 남짓이라 위경도를 그대로 늘려도 눈에
 *   띄는 왜곡이 없다(위도에 따라 경도 1도가 줄어드는 것만 cos 로 보정). 가로세로
 *   비율은 유지한다 — 안 그러면 시 형상이 눌려 다른 도시처럼 보인다.
 * ───────────────────────────────────────────── */

import { DISTRICTS, type District } from "../../../demo/districts";
import { activeEventOfAt, eventViewAt } from "../../../demo/events";
import { useScenario } from "../../../state/ScenarioProvider";
import { levelSpec } from "../../../demo/levels";
import { CITY_NAME } from "../../../lib/map-config";
import { CITY_GU_SHAPES } from "../../../lib/city-shape";

const WIDTH = 260;
/* 분석 보조 부품이라 레일에서 접힌 자리로 내려갔다(03 §5) — 펼쳤을 때 결과 카드를 밀어내지
   않도록 시 형상이 읽히는 최소 높이까지만 쓴다 */
const HEIGHT = 150;
const PAD = 10;

/* 투영은 시 형상 기준으로 한 번만 만든다 — 형상·지구 좌표 모두 정적이다 */
const project = makeProjection();

const GU_POLYGONS = CITY_GU_SHAPES.flatMap((gu) =>
  gu.rings.map((ring, i) => ({
    key: `${gu.name}-${i}`,
    points: ring.map((c) => project(c).join(",")).join(" "),
  })),
);

export function MiniMap({
  current,
  onSelect,
}: {
  current: District;
  onSelect: (district: District) => void;
}) {
  const { now } = useScenario();

  return (
    <section className="flex flex-col gap-1" aria-label="시 전체 미니맵">
      <header className="flex items-baseline justify-between">
        <h3 className="text-caption font-semibold text-foreground-muted">{CITY_NAME}</h3>
        <span className="text-caption text-foreground-subtle">{current.name}</span>
      </header>

      <svg width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="지구 위치">
        {/* 배경 — 구 경계. 채도 없는 면으로 깔아 지구 점(색이 있는 것)이 위로 뜨게 한다 */}
        {GU_POLYGONS.map((poly) => (
          <polygon
            key={poly.key}
            points={poly.points}
            fill="var(--color-surface-raised)"
            stroke="var(--color-border)"
            strokeWidth={0.7}
          />
        ))}

        {DISTRICTS.map((district) => {
          const active = district.id === current.id;
          const event = activeEventOfAt(district.id, now);
          const color = event
            ? levelSpec(eventViewAt(event, now).level).color
            : "var(--color-foreground-subtle)";
          const [cx, cy] = project(district.center);

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
                  cx={cx}
                  cy={cy}
                  r={9}
                  fill="none"
                  stroke="var(--color-primary-text)"
                  strokeWidth={1.5}
                />
              )}
              <circle cx={cx} cy={cy} r={active ? 4.5 : 3} fill={active ? "var(--color-primary-text)" : color} />
              {active && (
                <text
                  x={cx}
                  y={cy - 13}
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

/**
 * 위경도 → SVG 좌표. 시 형상 전체를 담는 사각형에 맞춰 늘리고 남는 쪽은 가운데로 둔다.
 */
function makeProjection() {
  const coords = CITY_GU_SHAPES.flatMap((gu) => gu.rings.flat());
  const lats = coords.map((c) => c[1]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);

  const xs = coords.map((c) => c[0] * kx);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...lats);
  const maxY = Math.max(...lats);

  const scale = Math.min(
    (WIDTH - PAD * 2) / (maxX - minX),
    (HEIGHT - PAD * 2) / (maxY - minY),
  );
  const offX = (WIDTH - (maxX - minX) * scale) / 2;
  const offY = (HEIGHT - (maxY - minY) * scale) / 2;

  return (c: [number, number]): [number, number] => {
    const x = offX + (c[0] * kx - minX) * scale;
    /* SVG 는 y 가 아래로 자란다 — 위도는 위로 자라니 뒤집는다 */
    const y = HEIGHT - offY - (c[1] - minY) * scale;
    return [x, y];
  };
}
