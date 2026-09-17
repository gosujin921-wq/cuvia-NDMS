/* ─────────────────────────────────────────────
 * 보고서 차트 — 종이 위의 SVG (양식 정본: KISA 월간 운영 보고서 v0.5 · 2026-09-17)
 *
 * 양식의 차트 문법을 그대로 쓴다: 옅은 실선 격자 · 얇은 마크 · 끝만 둥근 막대 · 값은 끝에 한 번 · 범례는 두 계열부터.
 * 색은 ReportDocument 의 종이 팔레트 토큰(--p-*)만 쓴다. 앱의 어두운 화면 토큰과 섞지 않는다.
 * 데이터는 model/report-chart 계약 그대로 그리고, 여기서 값을 만들거나 다시 계산하지 않는다.
 *
 * ▸ 축은 하나다. 단위가 다른 계열은 패널을 나눈다(이중축 금지).
 * ▸ 글자는 데이터 색을 입지 않는다 — 잉크·회색만. 색은 옆의 마크가 든다.
 * ▸ 품질이 "정상"이 아닌 관측점은 속이 빈 점이다(지연·대체값을 숨기지 않는다).
 * ───────────────────────────────────────────── */

import type { ChartPoint, ChartTone, ReportChart } from "../model/report-chart";
import { formatClock } from "../lib/datetime";

/** 종이 내용 폭 — 794 − 60×2 */
export const REPORT_CHART_WIDTH = 674;
const W = REPORT_CHART_WIDTH;

const TONE: Record<ChartTone, string> = {
  neutral: "var(--p-muted)",
  good: "var(--p-ok)",
  warning: "var(--p-warn)",
  serious: "var(--p-serious)",
  critical: "var(--p-crit)",
  "series-1": "var(--p-s1)",
  "series-2": "var(--p-s2)",
};

const INK = "var(--p-ink)";
const SUB = "var(--p-sub)";
const MUTED = "var(--p-muted)";
const GRID = "var(--p-grid)";
const AXIS = "var(--p-axis)";
const SURFACE = "#fff";

const ms = (iso: string) => new Date(iso).getTime();
const fmt = (v: number, digits: number) => v.toFixed(digits);

function timeScale(from: number, to: number, x0: number, x1: number) {
  const span = Math.max(1, to - from);
  return (iso: string) => x0 + ((ms(iso) - from) / span) * (x1 - x0);
}

/** 깔끔한 축 최대값 — 1·2·2.5·3·4·5·10 배수 */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 3 ? 3 : n <= 4 ? 4 : n <= 5 ? 5 : 10;
  return m * p;
}

/** 시간 눈금 — 구간 길이에 맞춰 15분·30분·1시간 간격 */
function timeTicks(from: number, to: number): number[] {
  const span = to - from;
  const step = span <= 100 * 60_000 ? 15 * 60_000 : span <= 4 * 3_600_000 ? 30 * 60_000 : 3_600_000;
  const ticks: number[] = [];
  for (let t = Math.ceil(from / step) * step; t <= to; t += step) ticks.push(t);
  return ticks;
}

const clockOfMs = (t: number) => formatClock(new Date(t));

/** 11px 글자의 폭 어림 — 한글·전각 11px, 그 외 6px. 범례를 오른쪽에서 쌓을 때 쓴다 */
const legendWidth = (label: string) => [...label].reduce((w, ch) => w + (/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af\u3000-\u303f\uff00-\uffef]/.test(ch) ? 11 : 6), 0);

export function ReportChartView({ chart }: { chart: ReportChart }) {
  switch (chart.kind) {
    case "milestones": return <Milestones items={chart.items} />;
    case "series": return <SeriesPanels panels={chart.panels} markers={chart.markers ?? []} />;
    case "score-trend": return <ScoreTrend points={chart.points} thresholds={chart.thresholds} />;
    case "meters": return <Meters rows={chart.rows} digits={chart.digits} />;
    case "compare": return <Compare unit={chart.unit} digits={chart.digits} series={chart.series} verify={chart.verify} />;
    case "gantt": return <Gantt rows={chart.rows} />;
  }
}

/* ── 경과 마일스톤 ────────────────────────────── */
function Milestones({ items }: { items: { label: string; at: string }[] }) {
  if (items.length === 0) return null;
  const H = 92, y = 46, x0 = 40, x1 = W - 40;
  const step = items.length > 1 ? (x1 - x0) / (items.length - 1) : 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="경과 마일스톤">
      <line x1={x0} y1={y} x2={x1} y2={y} stroke={AXIS} strokeWidth={1} />
      {items.map((m, i) => {
        const x = x0 + i * step;
        const above = i % 2 === 0;
        const last = i === items.length - 1;
        return (
          <g key={`${m.label}-${m.at}`}>
            <circle cx={x} cy={y} r={5} fill={last ? TONE.neutral : TONE["series-1"]} stroke={SURFACE} strokeWidth={2} />
            <text x={x} y={above ? 14 : 80} fontSize={11} fill={MUTED} textAnchor="middle" className="num-t">{formatClock(m.at)}</text>
            <text x={x} y={above ? 30 : 66} fontSize={12} fontWeight={700} fill={INK} textAnchor="middle">{m.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── 관측 시계열 소형 다중 ─────────────────────── */
function SeriesPanels({ panels, markers }: { panels: { title: string; unit: string; points: ChartPoint[]; digits?: number }[]; markers: { at: string; label: string }[] }) {
  const all = panels.flatMap((p) => p.points);
  if (all.length === 0) return null;
  const from = Math.min(...all.map((p) => ms(p.at)), ...markers.map((m) => ms(m.at)));
  const to = Math.max(...all.map((p) => ms(p.at)), ...markers.map((m) => ms(m.at)));
  const PH = 96, x0 = 52, x1 = W - 12, top = 22, bottom = 82;
  const H = panels.length * PH + 22;
  const sx = timeScale(from, to, x0, x1);
  const ticks = timeTicks(from, to);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="관측 시계열">
      {panels.map((p, pi) => {
        const oy = pi * PH;
        const max = niceMax(Math.max(...p.points.map((d) => d.value)));
        const digits = p.digits ?? 0;
        const sy = (v: number) => oy + bottom - (v / max) * (bottom - top);
        const peak = p.points.reduce((a, b) => (b.value > a.value ? b : a), p.points[0]);
        const px = sx(peak.at);
        const labelAnchor = px > x1 - 90 ? "end" : px < x0 + 90 ? "start" : "middle";
        return (
          <g key={p.title}>
            <text x={0} y={oy + 14} fontSize={12} fontWeight={700} fill={INK}>{p.title}</text>
            <text x={W} y={oy + 14} fontSize={11} fill={MUTED} textAnchor="end">{p.unit}</text>
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line x1={x0} y1={sy(max * f)} x2={x1} y2={sy(max * f)} stroke={GRID} strokeWidth={1} />
                <text x={x0 - 6} y={sy(max * f) + 3.5} fontSize={10} fill={MUTED} textAnchor="end" className="num-t">{fmt(max * f, digits)}</text>
              </g>
            ))}
            {markers.map((m) => (
              <line key={m.at} x1={sx(m.at)} y1={oy + top} x2={sx(m.at)} y2={oy + bottom} stroke={AXIS} strokeWidth={1} />
            ))}
            <polyline
              fill="none" stroke={TONE["series-1"]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
              points={p.points.map((d) => `${sx(d.at).toFixed(1)},${sy(d.value).toFixed(1)}`).join(" ")}
            />
            {p.points.filter((d) => d.quality && d.quality !== "정상").map((d) => (
              <circle key={d.at} cx={sx(d.at)} cy={sy(d.value)} r={3.5} fill={SURFACE} stroke={TONE["series-1"]} strokeWidth={1.5} />
            ))}
            <circle cx={px} cy={sy(peak.value)} r={4.5} fill={TONE["series-1"]} stroke={SURFACE} strokeWidth={2} />
            <text x={px} y={sy(peak.value) - 8} fontSize={11} fontWeight={700} fill={INK} textAnchor={labelAnchor} className="num-t">
              최대 {fmt(peak.value, digits)} {p.unit} · {formatClock(peak.at)}
            </text>
          </g>
        );
      })}
      {(() => {
        const oy = panels.length * PH;
        return (
          <g>
            {ticks.map((t) => (
              <text key={t} x={sx(new Date(t).toISOString())} y={oy + 12} fontSize={10} fill={SUB} textAnchor="middle" className="num-t">{clockOfMs(t)}</text>
            ))}
            {markers.map((m) => (
              <text key={m.at} x={Math.min(sx(m.at), x1 - 4)} y={oy + 12} fontSize={10} fontWeight={700} fill={INK} textAnchor="end" dx={-6}>{m.label}</text>
            ))}
          </g>
        );
      })()}
    </svg>
  );
}

/* ── 위험도 추이 ──────────────────────────────── */
function ScoreTrend({ points, thresholds }: { points: { at: string; score: number; grade: string; tone: ChartTone }[]; thresholds: { grade: string; minScore: number; tone: ChartTone }[] }) {
  if (points.length === 0) return null;
  const H = 156, x0 = 40, x1 = W - 56, top = 12, bottom = 124;
  const from = ms(points[0].at), to = ms(points[points.length - 1].at);
  const pad = Math.max(5 * 60_000, (to - from) * 0.06);
  const sx = timeScale(from - pad, to + pad, x0, x1);
  const sy = (v: number) => bottom - v * (bottom - top);
  const bands = [...thresholds].sort((a, b) => a.minScore - b.minScore);
  const peak = points.reduce((a, b) => (b.score > a.score ? b : a), points[0]);
  const last = points[points.length - 1];
  /* 계단선 — 판단은 다음 판단까지 유지된다 */
  const path = points.map((p, i) => {
    const x = sx(p.at), y = sy(p.score);
    if (i === 0) return `M${x.toFixed(1)},${y.toFixed(1)}`;
    return `H${x.toFixed(1)}V${y.toFixed(1)}`;
  }).join("") + `H${(x1).toFixed(1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="위험도 추이">
      {bands.map((b, i) => {
        const hi = bands[i + 1]?.minScore ?? 1;
        return (
          <g key={b.grade}>
            <rect x={x0} y={sy(hi)} width={x1 - x0} height={sy(b.minScore) - sy(hi)} fill={TONE[b.tone]} opacity={0.08} />
            <line x1={x0} y1={sy(b.minScore)} x2={x1} y2={sy(b.minScore)} stroke={GRID} strokeWidth={1} />
            <text x={x1 + 8} y={(sy(hi) + sy(b.minScore)) / 2 + 4} fontSize={11} fill={SUB}>{b.grade}</text>
            <text x={x0 - 6} y={sy(b.minScore) + 3.5} fontSize={10} fill={MUTED} textAnchor="end" className="num-t">{b.minScore.toFixed(2)}</text>
          </g>
        );
      })}
      <line x1={x0} y1={sy(1)} x2={x1} y2={sy(1)} stroke={GRID} strokeWidth={1} />
      <text x={x0 - 6} y={sy(1) + 3.5} fontSize={10} fill={MUTED} textAnchor="end" className="num-t">1.00</text>
      <path d={path} fill="none" stroke={TONE["series-1"]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p) => (
        <circle key={p.at} cx={sx(p.at)} cy={sy(p.score)} r={5} fill={TONE[p.tone]} stroke={SURFACE} strokeWidth={2}>
          <title>{`${formatClock(p.at)} ${p.grade} ${p.score.toFixed(2)}`}</title>
        </circle>
      ))}
      {[peak, ...(last !== peak ? [last] : [])].map((p) => (
        <text key={`l-${p.at}`} x={sx(p.at)} y={sy(p.score) - 10} fontSize={11} fontWeight={700} fill={INK} textAnchor="middle" className="num-t">
          {p.grade} {p.score.toFixed(2)}
        </text>
      ))}
      {points.map((p) => (
        <text key={`t-${p.at}`} x={sx(p.at)} y={H - 8} fontSize={10} fill={SUB} textAnchor="middle" className="num-t">{formatClock(p.at)}</text>
      ))}
    </svg>
  );
}

/* ── 기여도 미터 ──────────────────────────────── */
function Meters({ rows, digits }: { rows: { label: string; band: string; value: number; max: number; degraded: boolean }[]; digits: number }) {
  if (rows.length === 0) return null;
  const RH = 26, H = rows.length * RH + 4, lx = 0, bx = 232, bxEnd = W - 96, barH = 12;
  const scaleMax = Math.max(...rows.map((r) => r.max), 0.0001);
  const sw = (v: number) => ((bxEnd - bx) * v) / scaleMax;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="지표별 기여도">
      {rows.map((r, i) => {
        const y = i * RH + 2, cy = y + barH / 2;
        const track = sw(r.max), fill = sw(r.value);
        return (
          <g key={r.label}>
            <text x={lx} y={cy + 4} fontSize={12} fontWeight={700} fill={INK}>{r.label}</text>
            <text x={112} y={cy + 4} fontSize={11} fill={SUB}>{r.band}{r.degraded ? " · 지연·결측" : ""}</text>
            <path d={roundedRight(bx, y, track, barH)} fill="var(--p-s1-soft)" />
            {fill > 0 && <path d={roundedRight(bx, y, fill, barH)} fill={TONE["series-1"]} />}
            <text x={bx + track + 8} y={cy + 4} fontSize={11} fontWeight={700} fill={INK} className="num-t">
              {fmt(r.value, digits)} / {fmt(r.max, digits)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** 오른쪽 끝만 둥근 가로 막대 — 바닥(왼쪽)은 각지고 데이터 끝만 4px 둥글다 */
function roundedRight(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2);
  return `M${x},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 -${r},${r}h-${w - r}z`;
}

/* ── 예측 대 실측 ─────────────────────────────── */
function Compare({ unit, digits, series, verify }: { unit: string; digits: number; series: { label: string; points: ChartPoint[]; tone: ChartTone }[]; verify?: { at: string; label: string } }) {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return null;
  const H = 176, x0 = 44, x1 = W - 12, top = 26, bottom = 140;
  const from = Math.min(...all.map((p) => ms(p.at))), to = Math.max(...all.map((p) => ms(p.at)));
  const max = niceMax(Math.max(...all.map((p) => p.value)));
  const sx = timeScale(from, to, x0, x1);
  const sy = (v: number) => bottom - (v / max) * (bottom - top);
  const ticks = timeTicks(from, to);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="예측 대 실측">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={x0} y1={sy(max * f)} x2={x1} y2={sy(max * f)} stroke={GRID} strokeWidth={1} />
          <text x={x0 - 6} y={sy(max * f) + 3.5} fontSize={10} fill={MUTED} textAnchor="end" className="num-t">{fmt(max * f, digits)}</text>
        </g>
      ))}
      <text x={x0} y={12} fontSize={11} fill={MUTED}>{unit}</text>
      {/* 범례 — 두 계열이라 항상 선다. 오른쪽 끝에서 왼쪽으로 쌓는다(글자 폭은 11px 글자 기준 어림) */}
      {(() => {
        const widths = series.map((s) => 15 + legendWidth(s.label) + 14);
        /* 뒤 계열부터 오른쪽에 놓아야 첫 계열이 왼쪽에 선다 */
        let x = x1;
        return [...series.keys()].reverse().map((i) => {
          const s = series[i];
          x -= widths[i];
          return (
            <g key={s.label} transform={`translate(${x}, 4)`}>
              <rect x={0} y={0} width={10} height={10} rx={2} fill={TONE[s.tone]} />
              <text x={15} y={9} fontSize={11} fill={SUB}>{s.label}</text>
            </g>
          );
        });
      })()}
      {verify && <line x1={sx(verify.at)} y1={top} x2={sx(verify.at)} y2={bottom} stroke={AXIS} strokeWidth={1} />}
      {series.map((s) => (
        <g key={s.label}>
          <polyline
            fill="none" stroke={TONE[s.tone]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
            points={s.points.map((d) => `${sx(d.at).toFixed(1)},${sy(d.value).toFixed(1)}`).join(" ")}
          />
          {s.points.length <= 8 && s.points.map((d) => (
            <circle key={d.at} cx={sx(d.at)} cy={sy(d.value)} r={4.5} fill={TONE[s.tone]} stroke={SURFACE} strokeWidth={2}>
              <title>{`${s.label} ${formatClock(d.at)} ${fmt(d.value, digits)} ${unit}`}</title>
            </circle>
          ))}
        </g>
      ))}
      {verify && (
        <text x={Math.min(sx(verify.at) + 8, x1 - 4)} y={top + 10} fontSize={11} fontWeight={700} fill={INK} textAnchor={sx(verify.at) > x1 - 200 ? "end" : "start"} dx={sx(verify.at) > x1 - 200 ? -16 : 0} className="num-t">
          {verify.label}
        </text>
      )}
      {ticks.map((t) => (
        <text key={t} x={sx(new Date(t).toISOString())} y={H - 20} fontSize={10} fill={SUB} textAnchor="middle" className="num-t">{clockOfMs(t)}</text>
      ))}
    </svg>
  );
}

/* ── 조치 간트 ────────────────────────────────── */
function Gantt({ rows }: { rows: { label: string; sub: string; from: string; to: string; status: string; tone: ChartTone }[] }) {
  if (rows.length === 0) return null;
  const RH = 26, AX = 18, H = rows.length * RH + AX + 4, bx = 300, bxEnd = W - 56, barH = 12;
  const from = Math.min(...rows.map((r) => ms(r.from))), to = Math.max(...rows.map((r) => ms(r.to)));
  const pad = Math.max(3 * 60_000, (to - from) * 0.05);
  const sx = timeScale(from - pad, to + pad, bx, bxEnd);
  const ticks = timeTicks(from - pad, to + pad);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="조치 경과">
      {ticks.map((t) => {
        const x = sx(new Date(t).toISOString());
        return (
          <g key={t}>
            <line x1={x} y1={AX} x2={x} y2={H - 4} stroke={GRID} strokeWidth={1} />
            <text x={x} y={11} fontSize={10} fill={SUB} textAnchor="middle" className="num-t">{clockOfMs(t)}</text>
          </g>
        );
      })}
      {rows.map((r, i) => {
        const y = AX + i * RH + (RH - barH) / 2 + 2, cy = y + barH / 2;
        const x = sx(r.from), w = Math.max(4, sx(r.to) - x);
        return (
          <g key={`${r.label}-${r.from}`}>
            <text x={0} y={cy + 4} fontSize={12} fontWeight={700} fill={INK}>{r.label}</text>
            <text x={176} y={cy + 4} fontSize={11} fill={SUB}>{r.sub}</text>
            <path d={roundedRight(x, y, w, barH)} fill={TONE[r.tone]}>
              <title>{`${r.label} · ${formatClock(r.from)} → ${formatClock(r.to)} · ${r.status}`}</title>
            </path>
            <text x={x + w + 6} y={cy + 4} fontSize={11} fill={INK} className="num-t">{formatClock(r.to)} {r.status}</text>
          </g>
        );
      })}
    </svg>
  );
}
