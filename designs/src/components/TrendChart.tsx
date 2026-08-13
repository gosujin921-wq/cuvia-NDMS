/* ─────────────────────────────────────────────
 * 추이 꺾은선 — 계측값 + 발령 기준선
 *
 * 값만 그리면 "높은 건지"를 읽을 수 없다. 발령 기준선을 같이 얹어야 선이 어느 단계를
 * 넘었는지가 그래프에서 바로 보인다(03 화면정의서 §2·§3).
 *
 * ▸ 제품에 대응 정본이 없다. cuvia_platform_web kits/dashboard-kit 의 ChartWidget 은
 *   "차트 렌더러 연결 예정" 플레이스홀더고, 차트 라이브러리도 아직 안 정해졌다.
 *   그래서 여기가 앞서 있다 — 이관 방향은 반대로, 이 구현이 dashboard-kit 승격 후보다.
 *   제품 kit 에 맞춰 낮추지 말 것.
 * ───────────────────────────────────────────── */

import { useId } from "react";
import type { Sample } from "../demo/measurements";

export interface ThresholdLine {
  value: number;
  color: string;
  label: string;
}

interface TrendChartProps {
  samples: Sample[];
  /** 발령 기준선. 축 범위 계산에도 들어간다 */
  thresholds?: ThresholdLine[];
  /** 선 색 */
  color?: string;
  height?: number;
  unit?: string;
  ariaLabel: string;
}

const PAD_TOP = 8;
const PAD_BOTTOM = 16;
const VIEW_WIDTH = 300;

/**
 * 세로 축 범위.
 *
 * 기준선까지 담아야 선이 어느 단계를 넘었는지 보인다. 다만 대피 기준처럼 현재값에서
 * 아주 먼 기준선까지 담으면 실제 변화가 눌려 평평해지므로, 값 폭의 2.5배 밖에 있는
 * 기준선은 축에서 뺀다. 그래서 그려지지 않는 기준선이 생기고, 범례는 이 함수로
 * "범위 밖"을 판정해 흐리게 둔다.
 */
export function chartRange(samples: Sample[], thresholds: ThresholdLine[] = []) {
  const values = samples.map((s) => s.value);
  const valueMax = Math.max(...values);
  const valueMin = Math.min(...values);
  const near = thresholds
    .map((t) => t.value)
    .filter((v) => v <= valueMax + (valueMax - valueMin || 1) * 2.5);
  return { min: Math.min(valueMin, ...near), max: Math.max(valueMax, ...near) };
}

export function TrendChart({
  samples,
  thresholds = [],
  color = "var(--color-primary-text)",
  height = 96,
  unit,
  ariaLabel,
}: TrendChartProps) {
  const gradientId = useId();

  if (samples.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded border border-dashed border-border text-caption text-foreground-subtle"
        style={{ height }}
      >
        계측값 없음
      </div>
    );
  }

  const values = samples.map((s) => s.value);
  const { min, max } = chartRange(samples, thresholds);
  const span = max - min || 1;
  const plotHeight = height - PAD_TOP - PAD_BOTTOM;

  const x = (i: number) => (i / (samples.length - 1 || 1)) * VIEW_WIDTH;
  const y = (v: number) => PAD_TOP + (1 - (v - min) / span) * plotHeight;

  const line = samples.map((s, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(s.value).toFixed(1)}`).join(" ");
  const area = `${line} L ${VIEW_WIDTH} ${PAD_TOP + plotHeight} L 0 ${PAD_TOP + plotHeight} Z`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {thresholds
        .filter((t) => t.value >= min && t.value <= max)
        .map((t) => (
          <g key={t.label}>
            <line
              x1={0}
              x2={VIEW_WIDTH}
              y1={y(t.value)}
              y2={y(t.value)}
              stroke={t.color}
              strokeWidth={1}
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}

      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={x(samples.length - 1)} cy={y(values[values.length - 1])} r={3} fill={color} />

      <title>
        {ariaLabel}
        {unit ? ` (단위 ${unit})` : ""}
      </title>
    </svg>
  );
}
