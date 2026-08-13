/* ─────────────────────────────────────────────
 * 링 도넛 — 구성비 표시
 *
 * 12시 방향에서 시계 방향으로 세그먼트를 두르고 중앙에 대표 수치를 앉힌다.
 * 세그먼트 사이 4° 간격, 0 이 아닌 극소 세그먼트는 최소 6° 를 보장해 눈에서 사라지지 않게 한다.
 * 등장 시 세그먼트가 순서대로 감긴다.
 *
 * ▸ 제품에 대응 정본이 없다(dashboard-kit 은 KpiCard·ChartWidget 뿐이고 둘 다 뼈대다).
 *   TrendChart 와 같이 dashboard-kit 승격 후보로 둔다.
 * ───────────────────────────────────────────── */

import { useEffect, useState, type ReactNode } from "react";

export interface RingSegment {
  value: number;
  /** CSS 색 값 (var(--color-…) 권장) */
  color: string;
  label?: string;
}

interface RingDonutProps {
  segments: RingSegment[];
  /** 분모. 생략하면 세그먼트 합 */
  total?: number;
  size?: number;
  thickness?: number;
  /** 접근성 라벨 — 중앙 수치와 별개로 전체 요약을 담는다 */
  ariaLabel: string;
  /** 중앙 슬롯 */
  children?: ReactNode;
}

const GAP_DEG = 4;
const MIN_DEG = 6;

/** 극좌표 → 화면 좌표 (0° = 12시, 시계 방향) */
function polar(c: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: c + r * Math.cos(rad), y: c + r * Math.sin(rad) };
}

function arcPath(c: number, r: number, a0: number, a1: number) {
  const p0 = polar(c, r, a0);
  const p1 = polar(c, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
}

export function RingDonut({
  segments,
  total,
  size = 104,
  thickness = 10,
  ariaLabel,
  children,
}: RingDonutProps) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const c = size / 2;
  const r = (size - thickness) / 2;

  const visible = segments.filter((seg) => seg.value > 0);
  const denom = Math.max(total ?? 0, visible.reduce((sum, seg) => sum + seg.value, 0)) || 1;

  /* 각도 배분 — 극소 세그먼트에 최소각을 보장하고 초과분은 최대 세그먼트에서 덜어낸다 */
  const sweeps = visible.map((seg) => (seg.value / denom) * 360);
  const shortage = sweeps.reduce((sum, deg) => sum + (deg < MIN_DEG ? MIN_DEG - deg : 0), 0);
  if (shortage > 0) {
    const maxIndex = sweeps.indexOf(Math.max(...sweeps));
    for (let i = 0; i < sweeps.length; i += 1) {
      if (sweeps[i] < MIN_DEG) sweeps[i] = MIN_DEG;
    }
    sweeps[maxIndex] = Math.max(MIN_DEG, sweeps[maxIndex] - shortage);
  }

  const gap = visible.length > 1 ? GAP_DEG : 0;
  let cursor = 0;
  const arcs = visible.map((seg, index) => {
    const a0 = cursor + gap / 2;
    const a1 = cursor + Math.max(sweeps[index] - gap, 1);
    cursor += sweeps[index];
    const d = arcPath(c, r, a0, a1);
    const len = ((a1 - a0) / 360) * 2 * Math.PI * r;
    return { key: seg.label ?? String(index), color: seg.color, d, len, index };
  });

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--color-surface-raised)"
          strokeWidth={thickness}
        />
        {arcs.map((arc) => (
          <path
            key={arc.key}
            d={arc.d}
            fill="none"
            stroke={arc.color}
            strokeWidth={thickness}
            strokeDasharray={arc.len}
            strokeDashoffset={drawn ? 0 : arc.len}
            style={{ transition: `stroke-dashoffset 0.9s ease-out ${arc.index * 120}ms` }}
          />
        ))}
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
      )}
    </div>
  );
}
