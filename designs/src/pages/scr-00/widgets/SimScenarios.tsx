/* ─────────────────────────────────────────────
 * 시나리오 — 좌측 레일 (scr-00 · 2026-09-17)
 *
 *   대상        과거 실제 사건(기준 · 실측 있음)이 먼저, 진행 중 사건은 둘째
 *   시나리오    실제 사건 | A 조건 변경 | B 조치 변경 | A+B. 누르면 지도와 결과가 그 시나리오로 선다
 *   조건 요약   고른 시나리오가 무엇을 바꿨나
 * 판이 있는 값에만 멈춘다. 자유 입력은 두지 않는다(강우 → 수위 곡선이 사전 작성 판이라).
 * ───────────────────────────────────────────── */

import { Tag, cn } from "@ds";
import type { SimScenario, SimSiteBase } from "../../../model/sim/flood";

export function SimScenarios({ sites, site, onSite, scenarios, selected, onSelect, onSlide }: {
  sites: SimSiteBase[];
  site: SimSiteBase;
  onSite: (id: string) => void;
  scenarios: SimScenario[];
  selected: SimScenario;
  onSelect: (id: string) => void;
  /** 연속 축 — 배율을 옮기면 대상이 C 시나리오를 세운다. 규칙 대상만 준다 */
  onSlide?: (factor: number) => void;
}) {
  const slider = site.slider;
  const factor = slider ? slider.factorOf(selected.choice) : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col divide-y divide-border overflow-y-auto overflow-x-hidden rounded-[inherit]">
      <section className="flex shrink-0 flex-col gap-1.5 p-3" aria-label="대상">
        <header className="flex items-baseline justify-between gap-2">
          <h2 className="shrink-0 text-body font-semibold text-foreground">대상</h2>
          <span className="min-w-0 truncate text-caption text-foreground-subtle" title={site.dateLabel}>{site.dateLabel}</span>
        </header>
        <div className="flex flex-col gap-1">
          {sites.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSite(s.id)}
              aria-pressed={s.id === site.id}
              className={cn("flex cursor-pointer items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-caption",
                s.id === site.id ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-foreground-muted hover:text-foreground")}
            >
              <span className="min-w-0 truncate font-medium">{s.label}</span>
              <Tag tone={s.status === "진행 중" ? "warning" : undefined}>{s.status}</Tag>
            </button>
          ))}
        </div>
      </section>

      <section className="flex shrink-0 flex-col gap-1.5 p-3" aria-label="시나리오">
        <header className="flex items-baseline justify-between gap-2">
          <h2 className="text-body font-semibold text-foreground">시나리오</h2>
          <span className="shrink-0 text-caption text-foreground-subtle">그때 조건이 달랐다면</span>
        </header>
        <div className="flex flex-col gap-1">
          {scenarios.map((s) => {
            const on = s.id === selected.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelect(s.id)}
                aria-pressed={on}
                className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-left",
                  on ? (s.baseline ? "border-foreground-muted bg-surface-raised" : "border-primary bg-primary/10") : "border-border bg-card hover:bg-surface-raised")}
              >
                <span className={cn("shrink-0 rounded px-1.5 py-0.5 font-mono text-caption font-semibold",
                  s.baseline ? "bg-foreground-muted text-surface" : on ? "bg-primary text-primary-foreground" : "bg-surface-raised text-foreground-muted")}>{s.tag}</span>
                <span className={cn("min-w-0 break-keep text-caption leading-snug", on ? "text-foreground" : "text-foreground-muted")}>{s.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex shrink-0 flex-col gap-1.5 p-3" aria-label="고른 조건">
        <h2 className="text-body font-semibold text-foreground">고른 조건</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-md border border-border bg-card px-2.5 py-2 text-caption">
          {site.conditions.map((c) => {
            const raw = selected.choice[c.id] ?? site.defaults[c.id];
            const o = c.options.find((x) => x.id === raw);
            /* 슬라이더가 준 직접 배율은 선택지가 아니다 — "실제 × 1.62" 로 읽는다 */
            const label = o?.label ?? (raw.startsWith("x:") ? `실제 × ${raw.slice(2)}` : raw);
            const changed = raw !== site.defaults[c.id];
            return (
              <div key={c.id} className="contents">
                <dt className="truncate text-foreground-muted">{c.label}</dt>
                <dd className={cn("text-right", changed ? (c.kind === "조치" ? "font-semibold text-primary-text" : "font-semibold text-warning") : "text-foreground")}>{label}</dd>
              </div>
            );
          })}
        </dl>
        {/* 연속 축 — 규칙 대상. 눈금은 근거 있는 앵커뿐이고 그 사이 어디든 멈춘다. 옮기면 C 열이 선다 */}
        {slider && factor !== null && onSlide && (
          <div className="flex flex-col gap-1 rounded-md border border-border bg-card px-2.5 py-2">
            <div className="flex items-baseline justify-between text-caption">
              <span className="text-foreground-muted">{site.conditions.find((c) => c.id === slider.condId)?.label ?? "조건"} 배율</span>
              <span className={cn("font-mono font-semibold", factor === 1 ? "text-foreground" : "text-warning")}>실제 × {factor.toFixed(2)}</span>
            </div>
            <div className="relative h-7">
              {slider.anchors.map((a) => {
                const pct = ((a.value - slider.min) / (slider.max - slider.min)) * 100;
                return (
                  <span key={a.label} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${pct}%` }} aria-hidden>
                    <u className={cn("h-2 w-0.5 rounded-sm", Math.abs(a.value - factor) < 0.026 ? "bg-primary-text" : "bg-border-light")} />
                    <span className="mt-3 whitespace-nowrap font-mono text-caption text-foreground-subtle">{a.label}</span>
                  </span>
                );
              })}
              <i className="absolute left-0 top-[6px] h-1 rounded-full bg-primary" style={{ width: `${((factor - slider.min) / (slider.max - slider.min)) * 100}%` }} aria-hidden />
              <i className="absolute right-0 top-[6px] h-1 rounded-full bg-border" style={{ left: `${((factor - slider.min) / (slider.max - slider.min)) * 100}%` }} aria-hidden />
              <input
                type="range" min={slider.min} max={slider.max} step={slider.step} value={factor}
                onChange={(e) => onSlide(Number(e.target.value))}
                aria-label="강우 배율"
                className="absolute inset-x-0 top-0 h-4 w-full cursor-pointer appearance-none bg-transparent opacity-0"
              />
            </div>
            <p className="break-keep text-caption leading-snug text-foreground-subtle">계산은 연속입니다. 눈금은 근거 있는 값(실제 · 기상청 호우특보 3시간 기준)만 세웠습니다</p>
          </div>
        )}
        <p className="break-keep text-caption leading-snug text-foreground-subtle">
          환경을 바꾸는 조치만 다시 계산합니다. 전파·통제는 관련 SOP에서 봅니다
        </p>
      </section>
    </div>
  );
}
