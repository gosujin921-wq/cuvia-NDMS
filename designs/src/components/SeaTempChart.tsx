/* ─────────────────────────────────────────────
 * 표층수온 곡선 — 발령 기준선 2줄 + 머문 자리 띠 + 조건 구간 점선
 *
 * TrendChart 는 계측 한 계열에 기준선을 얹는 부품이라 이 화면에 못 쓴다. 여기 필요한 것이
 * 셋 더 있다.
 *
 *   · **기준선 두 줄** (25 예비특보 · 28 주의보) — 한 줄만 그리면 "높다" 는 알아도
 *     어느 단계인지를 모른다
 *   · **28℃ 이상 구간의 띠** — 이 편이 세는 것은 값이 아니라 **머문 날수**다. 점 하나가
 *     높은 것과 보름을 위에 있는 것은 다른 이야기인데, 곡선만으로는 그게 안 보인다
 *   · **조건 구간 점선** — 오늘 값에서 수평으로 뻗는다. "이만큼 더 오른다" 가 아니라
 *     **"28℃ 아래로 안 내려간다"** 를 그리는 선이다. 오르내림을 그리면 없는 정밀도를
 *     파는 것이 된다
 *
 * 점선과 실선은 색이 아니라 **모양으로** 갈린다. 색만 다르면 좁은 폭에서 안 읽히고,
 * 색각 차이가 있는 사람에게는 아예 한 선이 된다.
 * ───────────────────────────────────────────── */

import { useEffect, useId, useRef, useState } from "react";

export interface SeaTempChartPoint {
  /** `YYYY-MM-DD` */
  date: string;
  value: number;
}

export interface SeaTempThreshold {
  value: number;
  label: string;
  color: string;
}

/** 오늘 값에서 수평으로 뻗는 조건 구간 */
export interface SeaTempHold {
  days: number;
  label: string;
}

export interface SeaTempChartProps {
  points: SeaTempChartPoint[];
  thresholds?: SeaTempThreshold[];
  /** 이 값 이상인 자리에 옅은 띠를 깐다 (보통 주의보 기준 28℃) */
  shadeAbove?: number;
  hold?: SeaTempHold | null;
  height?: number;
  ariaLabel: string;
}

/**
 * 좌표계 폭을 **그려질 실제 폭에 맞춘다.**
 *
 * 한때 960 으로 고정하고 `preserveAspectRatio="none"` 으로 늘렸다. 선은 늘어나도 되지만
 * **글자까지 같이 늘어난다** — 컨테이너가 1,420px 이면 가로만 1.48배가 되어 기준선 라벨이
 * 옆으로 퍼진다. 눈금 숫자도 같이 퍼져서 표와 글꼴이 안 맞는다.
 *
 * 그래서 폭을 재서 1:1 로 그린다. 재기 전에는 이 값으로 한 번 그리고, 재고 나면 다시
 * 그린다 — 잠깐 어긋나는 것이 계속 늘어나 있는 것보다 낫다.
 */
const FALLBACK_WIDTH = 960;
/**
 * 안쪽 여백.
 *
 * 오른쪽이 넓은 것은 기준선 라벨(`28℃ 주의보`)이 거기 서기 때문이다. 좁게 두면 글자가
 * 판 끝에 붙어 잘린 것처럼 보이고, 곡선의 마지막 점과도 겹친다. 라벨이 앉을 자리를
 * 아예 비워 둔다.
 */
const PAD = { top: 16, right: 78, bottom: 28, left: 40 };
/** 세로 축 여유 — 곡선이 위아래 벽에 닿으면 꼭짓점이 잘려 보인다 */
const HEADROOM = 1;
const LINE_COLOR = "var(--color-risk-lv5)";

export function SeaTempChart({
  points,
  thresholds = [],
  shadeAbove,
  hold = null,
  height = 300,
  ariaLabel,
}: SeaTempChartProps) {
  const shadeId = useId();

  /* 그려질 폭을 잰다 — 좌표계를 그 폭에 맞춰야 글자가 안 늘어난다(FALLBACK_WIDTH 주석) */
  const boxRef = useRef<HTMLDivElement>(null);
  const [viewWidth, setViewWidth] = useState(FALLBACK_WIDTH);
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setViewWidth(next);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  if (points.length < 2) {
    return (
      <div
        ref={boxRef}
        className="flex items-center justify-center rounded border border-dashed border-border text-caption text-foreground-subtle"
        style={{ height }}
      >
        수온 자료를 읽는 중
      </div>
    );
  }

  const values = points.map((point) => point.value);
  const holdDays = hold?.days ?? 0;
  /* 점선이 붙는 만큼 가로 눈금이 늘어난다 — 실측이 끝나는 자리가 오른쪽 끝이 아니게 된다 */
  const slots = points.length - 1 + holdDays;

  const min = Math.floor(Math.min(...values, ...thresholds.map((t) => t.value)) - HEADROOM);
  const max = Math.ceil(Math.max(...values, ...thresholds.map((t) => t.value)) + HEADROOM);
  const span = max - min || 1;

  const plotWidth = viewWidth - PAD.left - PAD.right;
  const plotHeight = height - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (i / (slots || 1)) * plotWidth;
  const y = (v: number) => PAD.top + (1 - (v - min) / span) * plotHeight;

  const line = points
    .map((point, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(point.value).toFixed(1)}`)
    .join(" ");

  const lastIndex = points.length - 1;
  const last = points[lastIndex];

  /* 가로 눈금 — 처음·끝과 1·10·20일 */
  const ticks = points
    .map((point, i) => ({ point, i }))
    .filter(({ point, i }) => {
      const day = Number(point.date.slice(8, 10));
      return i === 0 || i === lastIndex || day === 1 || day === 10 || day === 20;
    });

  /* 28℃ 이상 구간의 띠 — 이어진 자리마다 한 칸 */
  const bands: { from: number; to: number }[] = [];
  if (shadeAbove !== undefined) {
    let start: number | null = null;
    points.forEach((point, i) => {
      if (point.value >= shadeAbove) {
        if (start === null) start = i;
        return;
      }
      if (start !== null) {
        bands.push({ from: start, to: i - 1 });
        start = null;
      }
    });
    if (start !== null) bands.push({ from: start, to: lastIndex });
  }

  return (
    <div ref={boxRef} className="w-full">
    <svg
      viewBox={`0 0 ${viewWidth} ${height}`}
      width={viewWidth}
      height={height}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id={shadeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={LINE_COLOR} stopOpacity="0.22" />
          <stop offset="100%" stopColor={LINE_COLOR} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 28℃ 위에 머문 자리 — 이 편이 세는 것은 값이 아니라 날수다 */}
      {bands.map((band) => (
        <rect
          key={`${band.from}-${band.to}`}
          x={x(band.from)}
          width={Math.max(1.5, x(band.to) - x(band.from))}
          y={PAD.top}
          height={plotHeight}
          fill={LINE_COLOR}
          opacity={0.07}
        />
      ))}

      {/* 세로 눈금 — 2℃ 마다 */}
      {Array.from({ length: span + 1 }, (_, i) => min + i)
        .filter((value) => value % 2 === 0)
        .map((value) => (
          <g key={`grid-${value}`}>
            <line
              x1={PAD.left}
              x2={viewWidth - PAD.right}
              y1={y(value)}
              y2={y(value)}
              stroke="var(--color-border)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={PAD.left - 8}
              y={y(value) + 3}
              textAnchor="end"
              className="fill-foreground-subtle"
              style={{ fontSize: 10 }}
            >
              {value}
            </text>
          </g>
        ))}

      {/* 발령 기준선 */}
      {thresholds.map((threshold) => (
        <g key={threshold.label}>
          <line
            x1={PAD.left}
            x2={viewWidth - PAD.right}
            y1={y(threshold.value)}
            y2={y(threshold.value)}
            stroke={threshold.color}
            strokeWidth={1.5}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
          {/* 라벨은 격자 오른쪽 끝 **바깥**에 세운다 — 곡선 위에 겹쳐 앉으면 둘 다 안 읽힌다 */}
          <text
            x={viewWidth - PAD.right + 6}
            y={y(threshold.value) + 3}
            textAnchor="start"
            fill={threshold.color}
            style={{ fontSize: 10 }}
          >
            {threshold.label}
          </text>
        </g>
      ))}

      {/* 실측 — 면과 선 */}
      <path
        d={`${line} L ${x(lastIndex)} ${PAD.top + plotHeight} L ${x(0)} ${PAD.top + plotHeight} Z`}
        fill={`url(#${shadeId})`}
      />
      <path
        d={line}
        fill="none"
        stroke={LINE_COLOR}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* 조건 구간 — 오늘 값에서 수평으로. 오르내림을 그리지 않는다 */}
      {hold && holdDays > 0 && (
        <>
          <line
            x1={x(lastIndex)}
            x2={x(lastIndex + holdDays)}
            y1={y(last.value)}
            y2={y(last.value)}
            stroke={LINE_COLOR}
            strokeWidth={2}
            strokeDasharray="2 5"
            strokeLinecap="round"
            opacity={0.75}
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={x(lastIndex + holdDays)}
            y={y(last.value) - 8}
            textAnchor="end"
            className="fill-foreground-muted"
            style={{ fontSize: 10 }}
          >
            {hold.label}
          </text>
        </>
      )}

      {/* 오늘 */}
      <circle cx={x(lastIndex)} cy={y(last.value)} r={3.5} fill={LINE_COLOR} />

      {/* 가로 눈금 */}
      {ticks.map(({ point, i }) => (
        <text
          key={point.date}
          x={x(i)}
          y={height - 8}
          textAnchor={i === 0 ? "start" : "middle"}
          className="fill-foreground-subtle"
          style={{ fontSize: 10 }}
        >
          {`${Number(point.date.slice(5, 7))}/${Number(point.date.slice(8, 10))}`}
        </text>
      ))}

      <title>{ariaLabel}</title>
    </svg>
    </div>
  );
}
