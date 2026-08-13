import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AgentChartData } from "../types";

/**
 * 차트 카테고리 팔레트 — DS primitive 토큰만 쓴다. 고정 순서(순환 금지).
 * 계열이 이보다 많으면 뒤쪽을 "기타" 한 칸으로 접는다(색을 새로 만들지 않음).
 *
 * 상태색(--cuvia-green/-yellow/-red = success/warning/danger)은 제외했다 —
 * 그건 "정상/경고/위험"이라는 뜻을 이미 갖고 있어 계열 구분색으로 쓰면 오독된다.
 *
 * 다크 표면(#1a1a1a) 기준 검증: 인접쌍 CVD 분리 ΔE 28.9(deutan),
 * 정상시야 분리 34.0 — 둘 다 통과. purple 은 표면 대비 2.92 로 3:1 에
 * 못 미치는데, 범례를 항상 띄워 색 외 식별 수단을 주는 것으로 보완한다.
 * 순서를 바꾸면 인접쌍 분리가 달라지므로 바꿀 때는 검증기를 다시 돌릴 것.
 */
const SERIES_COLORS = [
  "var(--cuvia-brand-blue)",
  "var(--cuvia-coral)",
  "var(--cuvia-purple)",
  "var(--cuvia-risk-blue)",
];
const MAX_SERIES = SERIES_COLORS.length;
const OTHER_LABEL = "기타";

/** 등장 애니메이션이 끝나기 전 hover 를 받으면 프레임이 튄다 → 끝난 뒤에만 반응. */
const ANIM_BEGIN = 400;
const ANIM_DURATION = 1500;
const ANIM_SETTLE = ANIM_BEGIN + ANIM_DURATION + 200;
const DIM_OPACITY = 0.25;

/**
 * 점 하나가 차지할 최소 가로 폭(px).
 *
 * 패널이 480px 인데 두 달치 일별 곡선은 마흔 점이 넘는다. 폭에 맞춰 욱여넣으면 점이
 * 서로 겹쳐 어느 날 값인지 짚을 수 없고, 가로 눈금도 몇 개만 남아 날짜를 못 읽는다.
 *
 * 그래서 **좁히지 않고 넘긴다** — 점마다 이만큼을 확보하고, 판이 칸보다 넓어지면 그 칸을
 * 가로로 민다. 세로는 그대로라 위아래 스크롤과 안 다툰다.
 *
 * 점 지름이 8px(r=4)이라 그 세 배쯤이면 이웃과 붙지 않고 손가락으로도 짚힌다.
 */
const MIN_POINT_WIDTH = 24;

const AXIS_TICK = { fill: "var(--color-foreground-muted)", fontSize: 11 };
const TOOLTIP_STYLE = {
  contentStyle: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-lg)",
  },
  labelStyle: { color: "var(--color-foreground)", fontWeight: 600 },
  itemStyle: { color: "var(--color-foreground-muted)" },
  wrapperStyle: { outline: "none" },
};

/** 등장 애니메이션이 끝났는지 — 데이터가 바뀌면 다시 잠근다. */
function useChartReveal(resetKey: unknown) {
  const [revealed, setRevealed] = useState(false);
  const revealedRef = useRef(false);

  useEffect(() => {
    revealedRef.current = false;
    setRevealed(false);
    const id = setTimeout(() => {
      revealedRef.current = true;
      setRevealed(true);
    }, ANIM_SETTLE);
    return () => clearTimeout(id);
  }, [resetKey]);

  return { revealed, revealedRef };
}

interface LegendItem {
  label: string;
  color: string;
  /** 파이 계열에서만 — 항목 값을 범례에 직접 표기(색 외 2차 인코딩). */
  value?: number;
}

interface ChartLegendProps {
  items: LegendItem[];
  activeIndex: number | null;
  onHover: (index: number | null) => void;
  interactive: boolean;
  /** 파이는 세로(우측), 막대/선은 가로(상단). */
  orientation: "row" | "column";
}

/**
 * 범례 — 계열이 2개 이상이면 항상 노출한다(색만으로 정체를 구분시키지 않기 위해).
 */
function ChartLegend({
  items,
  activeIndex,
  onHover,
  interactive,
  orientation,
}: ChartLegendProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (!interactive) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onHover(activeIndex === index ? null : index);
  };

  return (
    <div
      className={
        orientation === "row"
          ? "flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-border pb-2"
          : "flex shrink-0 flex-col justify-center overflow-auto border-l border-border pl-3"
      }
      style={{ pointerEvents: interactive ? "auto" : "none" }}
    >
      {items.map((item, index) => (
        <div
          key={item.label}
          role="button"
          tabIndex={0}
          aria-label={
            item.value === undefined
              ? item.label
              : `${item.label}: ${item.value}`
          }
          onMouseEnter={() => interactive && onHover(index)}
          onMouseLeave={() => interactive && onHover(null)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          className={`flex cursor-pointer items-center gap-2 text-caption transition-opacity ${
            orientation === "column" ? "py-1.5" : ""
          }`}
          style={{
            opacity:
              activeIndex === null || activeIndex === index ? 1 : DIM_OPACITY,
          }}
        >
          <span
            aria-hidden
            className="h-3 w-3 shrink-0 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          <span className="truncate text-foreground" title={item.label}>
            {item.label}
          </span>
          {item.value !== undefined && (
            <span className="shrink-0 text-foreground-muted">{item.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/** 계열이 팔레트보다 많으면 초과분을 "기타" 하나로 합친다. */
function foldSeries(labels: string[], values: number[][]) {
  if (labels.length <= MAX_SERIES) return { labels, values };
  const keptLabels = labels.slice(0, MAX_SERIES - 1);
  const keptValues = values.slice(0, MAX_SERIES - 1);
  const rest = values.slice(MAX_SERIES - 1);
  const merged = rest[0].map((_, i) =>
    rest.reduce((sum, series) => sum + (series[i] ?? 0), 0),
  );
  return {
    labels: [...keptLabels, OTHER_LABEL],
    values: [...keptValues, merged],
  };
}

interface CartesianChartProps {
  data: AgentChartData;
  kind: "bar" | "line";
}

/** 막대/선 — x축이 라벨, 계열이 datasets. */
function CartesianChart({ data, kind }: CartesianChartProps) {
  const labels = useMemo(() => data.labels ?? [], [data.labels]);
  const datasets = useMemo(() => data.datasets ?? [], [data.datasets]);

  const { seriesKeys, rows } = useMemo(() => {
    const folded = foldSeries(
      datasets.map((ds, i) => ds.label || `계열 ${i + 1}`),
      datasets.map((ds) => ds.data ?? []),
    );
    return {
      seriesKeys: folded.labels,
      rows: labels.map((label, i) => {
        const row: Record<string, string | number> = { name: label };
        folded.labels.forEach((key, s) => {
          row[key] = folded.values[s]?.[i] ?? 0;
        });
        return row;
      }),
    };
  }, [labels, datasets]);

  const { revealed, revealedRef } = useChartReveal(rows);
  const [hovered, setHovered] = useState<number | null>(null);
  const activeIndex = revealed ? hovered : null;

  const legendItems = seriesKeys.map((label, i) => ({
    label,
    color: SERIES_COLORS[i],
  }));

  const handleHover = (index: number | null) => {
    if (!revealedRef.current) return;
    setHovered(index);
  };

  const seriesOpacity = (i: number) =>
    activeIndex === null || activeIndex === i ? 1 : DIM_OPACITY;

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ pointerEvents: revealed ? "auto" : "none" }}
    >
      {seriesKeys.length > 1 && (
        <ChartLegend
          items={legendItems}
          activeIndex={activeIndex}
          onHover={handleHover}
          interactive={revealed}
          orientation="row"
        />
      )}
      {/* 넘치면 이 칸만 가로로 민다. 세로는 그대로라 패널의 위아래 스크롤과 안 다툰다 */}
      <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="h-full" style={{ minWidth: rows.length * MIN_POINT_WIDTH }}>
        <ResponsiveContainer width="100%" height="100%">
          {kind === "line" ? (
            <LineChart
              data={rows}
              margin={{ top: 4, right: 20, left: 4, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={AXIS_TICK}
                tickMargin={8}
                interval="preserveStartEnd"
                padding={{ left: 4, right: 12 }}
              />
              <YAxis
                tick={AXIS_TICK}
                width={36}
                tickSize={0}
                axisLine={false}
              />
              {revealed && <Tooltip {...TOOLTIP_STYLE} />}
              {seriesKeys.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={SERIES_COLORS[i]}
                  strokeWidth={2}
                  strokeOpacity={seriesOpacity(i)}
                  dot={{ r: 4, fill: SERIES_COLORS[i], strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                  animationBegin={ANIM_BEGIN}
                  animationDuration={ANIM_DURATION}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart
              data={rows}
              margin={{ top: 4, right: 20, left: 4, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={AXIS_TICK}
                tickMargin={8}
                interval="preserveStartEnd"
                padding={{ left: 4, right: 12 }}
              />
              <YAxis
                tick={AXIS_TICK}
                width={36}
                tickSize={0}
                axisLine={false}
              />
              {revealed && (
                <Tooltip
                  {...TOOLTIP_STYLE}
                  cursor={{ fill: "rgb(255 255 255 / 0.04)" }}
                />
              )}
              {seriesKeys.map((key, i) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={SERIES_COLORS[i]}
                  fillOpacity={seriesOpacity(i)}
                  radius={[4, 4, 0, 0]}
                  animationBegin={ANIM_BEGIN}
                  animationDuration={ANIM_DURATION}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/** 파이/도넛 — 첫 계열만 쓴다(구성비는 계열 하나가 전부여야 의미가 있다). */
function ProportionChart({
  data,
  donut,
}: {
  data: AgentChartData;
  donut: boolean;
}) {
  const slices = useMemo(() => {
    const values = data.datasets?.[0]?.data ?? [];
    const labels = data.labels ?? [];
    const all = labels.map((name, i) => ({ name, value: values[i] ?? 0 }));
    if (all.length <= MAX_SERIES) return all;
    const kept = all.slice(0, MAX_SERIES - 1);
    const restTotal = all
      .slice(MAX_SERIES - 1)
      .reduce((sum, s) => sum + s.value, 0);
    return [...kept, { name: OTHER_LABEL, value: restTotal }];
  }, [data]);

  const { revealed, revealedRef } = useChartReveal(slices);
  const [hovered, setHovered] = useState<number | null>(null);
  const activeIndex = revealed ? hovered : null;

  const handleHover = (index: number | null) => {
    if (!revealedRef.current) return;
    setHovered(index);
  };

  return (
    <div
      className="flex h-full w-full"
      style={{ pointerEvents: revealed ? "auto" : "none" }}
    >
      <div className="flex min-w-0 flex-1 items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={donut ? "52%" : 0}
              outerRadius="80%"
              paddingAngle={1}
              animationBegin={ANIM_BEGIN}
              animationDuration={ANIM_DURATION}
              onMouseEnter={(_: unknown, index: number) => handleHover(index)}
              onMouseLeave={() => handleHover(null)}
            >
              {slices.map((slice, index) => (
                <Cell
                  key={slice.name}
                  fill={SERIES_COLORS[index]}
                  /* 인접 조각 사이 2px 표면 간격 — 경계가 색 대비에 기대지 않게. */
                  stroke="var(--color-card)"
                  strokeWidth={2}
                  opacity={
                    activeIndex === null || activeIndex === index
                      ? 1
                      : DIM_OPACITY
                  }
                />
              ))}
            </Pie>
            {revealed && <Tooltip {...TOOLTIP_STYLE} />}
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend
        items={slices.map((slice, i) => ({
          label: slice.name,
          color: SERIES_COLORS[i],
          value: slice.value,
        }))}
        activeIndex={activeIndex}
        onHover={handleHover}
        interactive={revealed}
        orientation="column"
      />
    </div>
  );
}

/** 응답 차트 한 개 — type 에 따라 막대/선/파이/도넛으로 갈린다. */
export function AgentChart({ data }: { data: AgentChartData }) {
  switch ((data.type || "bar").toLowerCase()) {
    case "line":
      return <CartesianChart data={data} kind="line" />;
    case "pie":
      return <ProportionChart data={data} donut={false} />;
    case "doughnut":
      return <ProportionChart data={data} donut />;
    default:
      return <CartesianChart data={data} kind="bar" />;
  }
}
