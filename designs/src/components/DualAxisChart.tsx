/* ─────────────────────────────────────────────
 * 수위·강우량 이중축 그래프 — 03 화면정의서 §4
 *
 * 좌축 수위(EL.m)는 꺾은선, 우축 강우량(mm)은 위에서 내려오는 막대다. 비가 온 뒤 물이
 * 오르는 시간차가 한 화면에서 보여야 "얼마나 오면 위험해지는지"가 읽힌다.
 *
 * 이벤트가 있던 구간은 단계 색 띠로 남긴다. 통계 화면에서 그날을 짚을 수 있어야 한다.
 *
 * 폭은 컨테이너를 재서 1:1 좌표로 그린다. viewBox 를 늘려 채우면 축 글자가 가로로 눌린다.
 * ───────────────────────────────────────────── */

import { useEffect, useId, useRef, useState } from "react";
import { EmptyState } from "@ds";
import type { HistorySample } from "../demo/measurements";
import type { ThresholdLine } from "./TrendChart";
import { formatClock } from "../lib/datetime";

export interface EventBand {
  from: Date;
  to: Date;
  color: string;
  label: string;
}

interface DualAxisChartProps {
  samples: HistorySample[];
  thresholds?: ThresholdLine[];
  bands?: EventBand[];
  /** 픽셀 높이, 또는 "fill" 로 부모 높이를 채운다 */
  height?: number | "fill";
}

const PAD = { top: 18, right: 52, bottom: 26, left: 46 };
/** 강우 막대가 차지하는 위쪽 비율 — 수위 선과 겹치는 구간을 줄인다 */
const RAIN_ZONE = 0.42;
/**
 * 축·기준선 글자 크기. 토큰 최저치(--text-caption 13px)를 따른다 — 그보다 작은 글자는 금지다.
 * 이 차트는 컨테이너를 재서 1:1 좌표로 그리므로 viewBox 스케일에 눌리지 않아 SVG text 로 둔다.
 */
const AXIS_FONT = 13;

function tickLabel(at: Date, spanDays: number): string {
  if (spanDays <= 2) return formatClock(at);
  return `${at.getMonth() + 1}.${at.getDate()}`;
}

export function DualAxisChart({
  samples,
  thresholds = [],
  bands = [],
  height = 300,
}: DualAxisChartProps) {
  const gradientId = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setBox({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(el);
    setBox({ width: el.clientWidth, height: el.clientHeight });
    return () => observer.disconnect();
  }, []);

  const plotHeight = height === "fill" ? box.height : height;

  return (
    <div
      ref={hostRef}
      className={height === "fill" ? "h-full min-h-0 w-full" : "w-full"}
      style={height === "fill" ? undefined : { height }}
    >
      {samples.length === 0 ? (
        <EmptyState
          icon="mdi:chart-line"
          message="조회할 계측값이 없습니다"
          className="h-full"
        />
      ) : box.width > 0 && plotHeight > 0 ? (
        <Plot
          samples={samples}
          thresholds={thresholds}
          bands={bands}
          width={box.width}
          height={plotHeight}
          gradientId={gradientId}
        />
      ) : null}
    </div>
  );
}

function Plot({
  samples,
  thresholds,
  bands,
  width,
  height,
  gradientId,
}: Required<Omit<DualAxisChartProps, "height">> & {
  width: number;
  height: number;
  gradientId: string;
}) {
  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = height - PAD.top - PAD.bottom;

  const waters = samples.map((s) => s.water);
  const rains = samples.map((s) => s.rain);
  const waterPeak = Math.max(...waters);
  /* 대피 기준처럼 아주 높은 선까지 담으면 실제 변화가 눌린다 (TrendChart 와 같은 규칙) */
  const near = thresholds.map((t) => t.value).filter((v) => v <= waterPeak * 1.35);
  const wMax = Math.max(waterPeak, ...near);
  const wMin = Math.min(...waters);
  const wSpan = wMax - wMin || 1;
  const rMax = Math.max(1, ...rains);

  const t0 = samples[0].at.getTime();
  const t1 = samples[samples.length - 1].at.getTime();
  const tSpan = t1 - t0 || 1;
  const spanDays = tSpan / 86_400_000;

  const x = (at: Date) => PAD.left + ((at.getTime() - t0) / tSpan) * plotWidth;
  const yWater = (v: number) => PAD.top + (1 - (v - wMin) / wSpan) * plotHeight;
  const rainHeight = (v: number) => (v / rMax) * plotHeight * RAIN_ZONE;

  const line = samples
    .map((s, i) => `${i === 0 ? "M" : "L"} ${x(s.at).toFixed(1)} ${yWater(s.water).toFixed(1)}`)
    .join(" ");
  const area = `${line} L ${PAD.left + plotWidth} ${PAD.top + plotHeight} L ${PAD.left} ${PAD.top + plotHeight} Z`;
  const barWidth = Math.max(1, (plotWidth / samples.length) * 0.55);
  const ticks = Array.from({ length: 5 }, (_, i) => new Date(t0 + (tSpan * i) / 4));

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={`수위·강우량 기간 그래프. 수위 ${wMin.toFixed(2)}~${waterPeak.toFixed(2)} EL.m, 최대 강우 ${rMax.toFixed(1)} mm`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary-text)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--color-primary-text)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {bands.map((band) => {
        const bx = x(band.from);
        const bw = Math.max(2, x(band.to) - bx);
        return (
          <rect
            key={`${band.label}-${band.from.getTime()}`}
            x={bx}
            y={PAD.top}
            width={bw}
            height={plotHeight}
            fill={band.color}
            opacity={0.14}
          />
        );
      })}

      {thresholds
        .filter((t) => t.value >= wMin && t.value <= wMax)
        .map((t) => (
          <g key={t.label}>
            <line
              x1={PAD.left}
              x2={PAD.left + plotWidth}
              y1={yWater(t.value)}
              y2={yWater(t.value)}
              stroke={t.color}
              strokeWidth={1}
              strokeDasharray="5 5"
            />
            <text
              x={PAD.left + plotWidth - 4}
              y={yWater(t.value) - 4}
              fill={t.color}
              fontSize={AXIS_FONT}
              textAnchor="end"
            >
              {t.label} {t.value}
            </text>
          </g>
        ))}

      {samples.map((s) =>
        s.rain > 0 ? (
          <rect
            key={`rain-${s.at.getTime()}`}
            x={x(s.at) - barWidth / 2}
            y={PAD.top}
            width={barWidth}
            height={rainHeight(s.rain)}
            fill="var(--cuvia-blue-light)"
            opacity={0.5}
          />
        ) : null,
      )}

      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="var(--color-primary-text)"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      <line
        x1={PAD.left}
        x2={PAD.left + plotWidth}
        y1={PAD.top + plotHeight}
        y2={PAD.top + plotHeight}
        stroke="var(--color-border)"
      />
      <text x={4} y={PAD.top + 4} fill="var(--color-foreground-subtle)" fontSize={AXIS_FONT}>
        {wMax.toFixed(1)}
      </text>
      <text
        x={4}
        y={PAD.top + plotHeight}
        fill="var(--color-foreground-subtle)"
        fontSize={AXIS_FONT}
      >
        {wMin.toFixed(1)}
      </text>
      <text
        x={width - PAD.right + 5}
        y={PAD.top + 4}
        fill="var(--color-foreground-subtle)"
        fontSize={AXIS_FONT}
      >
        {rMax.toFixed(0)}
      </text>

      {ticks.map((tick, i) => (
        <text
          key={tick.getTime()}
          x={x(tick)}
          y={height - 8}
          fill="var(--color-foreground-subtle)"
          fontSize={AXIS_FONT}
          textAnchor={i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"}
        >
          {tickLabel(tick, spanDays)}
        </text>
      ))}
    </svg>
  );
}
