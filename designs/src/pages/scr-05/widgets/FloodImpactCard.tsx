/* ─────────────────────────────────────────────
 * 침수 영향 — 03 화면정의서 §5 · 04 §12
 *
 * 물이 차오르는 그림만으로는 판단이 서지 않는다. "이만큼 잠깁니다"와
 * "47동이 잠기고 412명이 대피 대상입니다"는 다른 말이고, 대응 등급을 올릴지 정하는
 * 자리에서 필요한 것은 뒤쪽이다. 슬라이더를 올리면 넷이 함께 바뀐다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { floodImpactAt } from "../../../demo/flood-impact";

export function FloodImpactCard({ districtId, level }: { districtId: string; level: number }) {
  const impact = floodImpactAt(districtId, level);
  if (!impact) return null;

  const rows = [
    { icon: "mdi:texture-box", label: "침수 면적", value: `${impact.areaHa.toFixed(1)} ha` },
    { icon: "mdi:home-group", label: "영향 건물", value: `${impact.buildings}동` },
    {
      icon: "mdi:road-variant",
      label: "침수 도로",
      value: impact.roadM > 0 ? `해안도로 ${impact.roadM} m` : "—",
      extra: impact.wharfRoad ? "물양장 진입로 전 구간" : undefined,
    },
    {
      icon: "mdi:account-group",
      label: "대피 대상",
      value: impact.evacuees > 0 ? `${impact.evacuees}명` : "—",
      danger: impact.evacuees > 0,
    },
  ];

  return (
    <section className="flex flex-col gap-1.5 p-3" aria-label="침수 영향">
      <header className="flex items-baseline justify-between">
        <h2 className="text-body font-semibold text-foreground">침수 영향</h2>
        <span className="font-mono text-caption text-foreground-subtle">
          {level.toFixed(2)} EL.m 기준
        </span>
      </header>

      <dl className="flex flex-col">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center gap-2 border-b border-border py-1.5 text-caption last:border-b-0"
          >
            <Icon
              icon={row.icon}
              className="size-4 shrink-0 text-foreground-subtle"
              aria-hidden
            />
            <dt className="w-16 shrink-0 text-foreground-muted">{row.label}</dt>
            <dd className="flex min-w-0 flex-1 flex-col items-end">
              <span
                className={
                  row.danger
                    ? "font-mono font-semibold text-danger"
                    : "font-mono text-foreground"
                }
              >
                {row.value}
              </span>
              {row.extra && (
                <span className="text-caption text-foreground-subtle">{row.extra}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <p className="text-caption text-foreground-subtle">
        시연용 고정값 · 사이값은 선형 보간 (04 §12)
      </p>
    </section>
  );
}
