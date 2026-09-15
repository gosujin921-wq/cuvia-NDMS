/* ─────────────────────────────────────────────
 * 전망 탭 우측 레일 (IA-03 · 02 D4·D5 · 04 W3, 2026-09-15 정리)
 *
 * 이 탭이 답하는 질문은 "무엇을 바꾸면 달라지나" 다. 그래서 맨 위가 대안 비교표다 — 열 머리가 곧 선택 버튼이고 고른 열이
 * 강조된다. 지도는 고른 대안·고른 시각의 범위를 그린다. 그 아래 시간축(시계 시각 눈금 · 지난 눈금은 흐리게 · 지금 위치),
 * 고른 시각 한 줄, 근거 한 줄, 버튼 둘. 모델명·입력 이벤트는 툴팁으로 내린다 — 담당자가 읽을 것은 기준시각·가정·불확실성이다.
 * 눈금 사이 값은 판단에 쓰지 않는다(IA §8). 예측판이 유효하지 않으면 다른 것으로 바꾸지 않고 목록에서 다시 고른다(IA §5.2).
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Button, GlassPanel, Notice, cn } from "@ds";
import type { AlternativeId, Forecast, ForecastMark, ImpactTarget } from "../../../model/forecast";
import { ALTERNATIVE_LABEL } from "../../../model/forecast";
import type { resolveForecast } from "../../../model/selectors";
import { formatClock } from "../../../lib/datetime";
import { formatMarkMetric, markMetricLabel, minutesBetween } from "../../../lib/forecast-twin";

const KIND_LABEL: Record<ImpactTarget["kind"], string> = { 도로: "도로", 중요시설: "중요시설", 건물: "건물", 대상자: "이용자" };
const KIND_ORDER: ImpactTarget["kind"][] = ["도로", "중요시설", "건물", "대상자"];

/** 비교표 한 칸 — 대안마다 그 대상이 어떻게 되나. 없으면 영향 없음, 통제되면 통제됨, 아니면 도달시각과 노출 */
function cellOf(t: ImpactTarget | undefined): { main: string; state: string; tone: "muted" | "success" | "warning" | "danger" } {
  if (!t) return { main: "", state: "영향 없음", tone: "muted" };
  if (t.exposure === "통제됨") return { main: "", state: "통제됨", tone: "success" };
  const count = t.kind === "건물" ? t.label.match(/(\d+)동/)?.[1] : undefined;
  const when = t.arrivalAt ? formatClock(t.arrivalAt) : "";
  return { main: count ? `${count}동${when ? ` · ${when}` : ""}` : when, state: count ? "" : t.exposure, tone: t.exposure === "노출" ? "warning" : "danger" };
}
const TONE_TEXT = { muted: "text-foreground-subtle", success: "text-success", warning: "text-warning", danger: "text-danger" } as const;

export function ForecastRail({ now, resolution, forecast, mark, alternatives, onPickAlternative, onPickValidAt, onBack, onReview, onRepick }: {
  now: Date;
  resolution: ReturnType<typeof resolveForecast> | null;
  forecast: Forecast | null;
  mark: ForecastMark | null;
  alternatives: { id: AlternativeId; forecast: Forecast }[];
  onPickAlternative: (id: AlternativeId) => void;
  onPickValidAt: (at: string) => void;
  onBack: () => void;
  onReview: () => void;
  onRepick: (forecastId: string) => void;
}) {
  if (!forecast || !mark) {
    const reason = !resolution ? "예측판을 고르지 않았습니다." : resolution.kind === "not-found" ? "존재하지 않는 예측판입니다." : resolution.kind === "expired" ? `유효 종료 ${formatClock(resolution.forecast.validUntil)}가 지난 예측판입니다.` : "이 시각에는 아직 생성되지 않은 예측판입니다.";
    return (
      <GlassPanel className="pointer-events-auto flex flex-col gap-3 p-3">
        <Notice variant="warning" title="이 전망은 지금 쓸 수 없습니다" description={`${reason} 다른 전망으로 바꾸지 않습니다. 아래에서 다시 고르세요.`} />
        <ul className="flex flex-col gap-1.5">
          {alternatives.map((a) => (
            <li key={a.forecast.forecastId}>
              <Button size="sm" variant="secondary" className="w-full justify-start" onClick={() => onRepick(a.forecast.forecastId)}>
                {ALTERNATIVE_LABEL[a.id]} · {formatClock(a.forecast.basis.baseTime)} 기준 · ~{formatClock(a.forecast.validUntil)}
              </Button>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="ghost" onClick={onBack}>판단으로</Button>
      </GlassPanel>
    );
  }

  const baseline = alternatives.find((a) => a.id === "baseline")?.forecast ?? forecast;
  const kinds = KIND_ORDER.filter((k) => alternatives.some((a) => a.forecast.targets.some((t) => t.kind === k)));
  const peakOf = (f: Forecast) => f.marks.reduce((best, m) => (m.maxDepthM > best.maxDepthM ? m : best), f.marks[0]);
  const nextMark = forecast.marks.find((m) => new Date(m.validAt) > now) ?? null;
  const b = forecast.basis;
  const basisLine = `${formatClock(b.baseTime)} 기준 · ${b.assumptions.join(", ")} · 불확실성 ${b.uncertainty.grade}`;
  const basisTip = [`${b.modelName} ${b.modelVersion}`, `생성 ${formatClock(b.generatedAt)}`, `입력 데이터 ${b.inputQuality}`, b.uncertainty.sensitiveTo.length ? `민감 · ${b.uncertainty.sensitiveTo.join(" · ")}` : ""].filter(Boolean).join("\n");

  return (
    <>
      {/* 브라우저 높이에 맞춘다 — 표·시간축·고른 시각은 이 묶음 안에서 스크롤하고 버튼은 바닥 고정 (2026-09-15) */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
      {/* 비교표 — 열 머리가 선택 버튼. 이 탭의 답은 여기서 끝난다 */}
      <GlassPanel className="pointer-events-auto shrink-0 p-3">
        <header className="flex items-baseline justify-between">
          <h2 className="text-body font-semibold text-foreground">전망 · {formatClock(baseline.basis.baseTime)} 기준</h2>
          <span className="text-caption text-foreground-subtle">유효 ~{formatClock(forecast.validUntil)}</span>
        </header>
        <table className="mt-2 w-full border-separate border-spacing-0 text-caption" aria-label="대안 비교">
          <thead>
            <tr>
              <th className="w-[60px] pb-1.5 text-left font-normal text-foreground-subtle" scope="col" />
              {alternatives.map((a) => (
                <th key={a.id} className={cn("rounded-t-md pb-1.5 text-center", a.id === forecast.alternativeId && "bg-primary/10")} scope="col">
                  <button
                    type="button"
                    onClick={() => onPickAlternative(a.id)}
                    aria-pressed={a.id === forecast.alternativeId}
                    className={cn("w-full cursor-pointer rounded-md border px-1 py-1.5 text-caption font-medium", a.id === forecast.alternativeId ? "border-primary-text bg-primary text-primary-foreground" : "border-border bg-transparent text-foreground hover:bg-surface-raised")}
                  >
                    {ALTERNATIVE_LABEL[a.id]}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th className="border-b border-border/60 py-1.5 text-left font-normal text-foreground-muted" scope="row">{markMetricLabel(mark)}</th>
              {alternatives.map((a) => (
                <td key={a.id} className={cn("border-b border-border/60 py-1.5 text-center font-mono font-medium text-foreground", a.id === forecast.alternativeId && "bg-primary/10")}>{formatMarkMetric(peakOf(a.forecast))}</td>
              ))}
            </tr>
            {kinds.map((kind, i) => (
              <tr key={kind}>
                <th className={cn("py-1.5 text-left font-normal text-foreground-muted", i < kinds.length - 1 && "border-b border-border/60")} scope="row">{KIND_LABEL[kind]}</th>
                {alternatives.map((a) => {
                  const c = cellOf(a.forecast.targets.find((t) => t.kind === kind));
                  return (
                    <td key={a.id} className={cn("py-1.5 text-center leading-tight", i < kinds.length - 1 && "border-b border-border/60", a.id === forecast.alternativeId && "bg-primary/10", i === kinds.length - 1 && a.id === forecast.alternativeId && "rounded-b-md")}>
                      {c.main && <span className="font-mono text-foreground">{c.main}</span>}
                      {c.main && c.state && " "}
                      {c.state && <span className={cn("font-medium", TONE_TEXT[c.tone])}>{c.state}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1.5 text-caption text-foreground-muted">
          {forecast.alternativeId === "baseline" ? `조치 없을 때 · ${peakOf(forecast).impactSummary}` : `기준 대비 · ${forecast.deltaSummary ?? forecast.changedConditions.join(" · ")}`}
        </p>
      </GlassPanel>

      {/* 시간축 — 눈금은 예측판 유효시각(시계 시각). 지난 눈금은 흐리고, 지금이 어디인지 한 줄 */}
      <GlassPanel className="pointer-events-auto shrink-0 p-3">
        <header className="flex items-baseline justify-between">
          <span className="text-caption font-semibold text-foreground-muted">유효 시각</span>
          <span className="text-caption text-foreground-subtle">도달 예상 {formatClock(forecast.arrivalAt)}</span>
        </header>
        <ol className="mt-2 flex gap-1" aria-label="유효 시각 눈금">
          {forecast.marks.map((m) => {
            const past = new Date(m.validAt) <= now;
            const selected = m.validAt === mark.validAt;
            return (
              <li key={m.validAt} className="flex-1">
                <button
                  type="button"
                  onClick={() => onPickValidAt(m.validAt)}
                  aria-pressed={selected}
                  title={`${formatClock(m.validAt)} · ${markMetricLabel(m)} ${formatMarkMetric(m)}${past ? " · 지난 시각" : ""}`}
                  className={cn("flex w-full cursor-pointer flex-col items-center gap-0.5 rounded-md border px-1 py-1.5", selected ? "border-primary-text bg-primary text-primary-foreground" : "border-border bg-transparent", !selected && (past ? "text-foreground-subtle" : "text-foreground-muted hover:text-foreground"))}
                >
                  <span className="font-mono text-caption font-medium">{formatClock(m.validAt)}</span>
                  <span className="font-mono text-caption">{formatMarkMetric(m)}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-1.5 flex items-center gap-1 text-caption text-foreground-subtle">
          <Icon icon="mdi:clock-outline" className="size-3.5 shrink-0" aria-hidden />
          지금 {formatClock(now)}{nextMark ? ` · 다음 눈금 ${formatClock(nextMark.validAt)} · ${minutesBetween(now, nextMark.validAt)}분 뒤` : " · 남은 눈금 없음"}
        </p>
      </GlassPanel>

      {/* 고른 시각 — 지도가 그리고 있는 그 장면 한 줄 */}
      <GlassPanel className="pointer-events-auto shrink-0 px-3 py-2.5">
        <p className="text-caption text-foreground"><span className="font-mono font-medium">{formatClock(mark.validAt)}</span> · {markMetricLabel(mark)} {formatMarkMetric(mark)} · {mark.impactSummary}</p>
        <p className="mt-1 truncate text-caption text-foreground-subtle" title={basisTip}>{basisLine}</p>
      </GlassPanel>
      </div>

      <GlassPanel className="pointer-events-auto flex shrink-0 gap-2 p-2">
        <Button variant="ghost" size="sm" className="flex-1" onClick={onBack}>판단으로</Button>
        <Button size="sm" className="flex-1" onClick={onReview}>이 전망으로 조치안 갱신</Button>
      </GlassPanel>
    </>
  );
}
