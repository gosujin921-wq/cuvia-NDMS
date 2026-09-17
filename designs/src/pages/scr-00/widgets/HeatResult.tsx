/* ─────────────────────────────────────────────
 * 폭염 결과 — 우측 레일 (scr-00 · 2026-09-17)
 *
 *   비교표      예보대로 | A(+2°C). 행은 최고 체감온도 · 주의보 기준(33°C↑) 시간 · 경보 기준(35°C↑) 시간 · 고온 지속 지역
 *   그 시각     도심 기준 칸의 기온 · 습도 · 체감, 고온 칸 비율
 *   관련 SOP    폭염 대응 규정 매칭 — 단계는 체감온도 기준에서 읽은 강조
 *   근거        출처 · 격자 · 산식. 한 줄씩
 * 침수처럼 "이 건물이 위험"으로 잇지 않는다. 폭염의 결과는 공간적 위험 상태의 지속이다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Tag, cn } from "@ds";
import { formatClock } from "../../../lib/datetime";
import type { SimScenario, SimSop, StateRow } from "../../../model/sim/flood";
import { HEAT_ADVISORY, HEAT_WARNING, HOT_HOURS, type HeatSummary } from "../../../model/sim/heat";

type Stage = "none" | "advisory" | "warning";
const LEVEL_LABEL = { advisory: "주의보", warning: "경보", evacuate: "대피" } as const;
const RANK = { none: 0, advisory: 1, warning: 2, evacuate: 3 } as const;

export function HeatResult({ scenarios, selected, onSelect, summaries, at, rows, hotShareNow, stage, sop, range, basis }: {
  scenarios: SimScenario[];
  selected: SimScenario;
  onSelect: (id: string) => void;
  summaries: Record<string, HeatSummary | null>;
  at: string;
  rows: StateRow[];
  hotShareNow: number;
  stage: Stage;
  sop: SimSop[];
  range: { min: number; max: number } | null;
  basis: string[];
}) {
  const cols = scenarios.map((s) => ({ s, sum: summaries[s.id] ?? null }));
  const base = summaries[scenarios[0]?.id ?? ""] ?? null;
  const cell = (v: string, worse: boolean | null, on: boolean) => (
    <span className={cn("whitespace-nowrap text-right font-mono tabular-nums", on ? "font-semibold" : "", worse === null ? (on ? "text-foreground" : "text-foreground-muted") : worse ? "text-warning" : "text-success")}>{v}</span>
  );
  const worse = (v: number | null | undefined, b: number | null | undefined) => (v == null || b == null || v === b ? null : v > b);

  return (
    <div className="flex min-h-0 flex-1 flex-col divide-y divide-border overflow-y-auto overflow-x-hidden rounded-[inherit]">
      <section className="flex shrink-0 flex-col gap-2 p-3" aria-label="시나리오 비교">
        <header className="flex items-baseline justify-between gap-2">
          <h2 className="text-body font-semibold text-foreground">시나리오 비교</h2>
          <span className="shrink-0 text-caption text-foreground-subtle">도심 기준 칸 · 하루치</span>
        </header>
        <div className="overflow-x-auto rounded-md border border-border bg-card px-2.5 py-2 text-caption">
          <div className="grid gap-x-2 gap-y-1" style={{ gridTemplateColumns: `auto repeat(${cols.length}, minmax(64px, 1fr))` }}>
            <span />
            {cols.map(({ s }) => (
              <button key={s.id} type="button" onClick={() => onSelect(s.id)} aria-pressed={s.id === selected.id}
                className={cn("cursor-pointer whitespace-nowrap rounded px-1 text-right font-mono font-semibold", s.id === selected.id ? (s.baseline ? "bg-surface-raised text-foreground" : "bg-primary text-primary-foreground") : "text-foreground-muted hover:text-foreground")}>
                {s.baseline ? "예보" : s.tag}
              </button>
            ))}
            <span className="text-foreground-muted">최고 체감온도</span>
            {cols.map(({ s, sum }) => <span key={s.id} className="contents">{cell(sum ? `${sum.maxFeel.toFixed(1)}°C · ${formatClock(sum.maxFeelAt)}` : "-", worse(sum?.maxFeel, base?.maxFeel), s.id === selected.id)}</span>)}
            <span className="text-foreground-muted">{HEAT_ADVISORY}°C↑ 시간</span>
            {cols.map(({ s, sum }) => <span key={s.id} className="contents">{cell(sum ? `${sum.advisoryHours}시간` : "-", worse(sum?.advisoryHours, base?.advisoryHours), s.id === selected.id)}</span>)}
            <span className="text-foreground-muted">{HEAT_WARNING}°C↑ 시간</span>
            {cols.map(({ s, sum }) => <span key={s.id} className="contents">{cell(sum ? `${sum.warningHours}시간` : "-", worse(sum?.warningHours, base?.warningHours), s.id === selected.id)}</span>)}
            <span className="text-foreground-muted">고온 지속 지역</span>
            {cols.map(({ s, sum }) => <span key={s.id} className="contents">{cell(sum ? `${Math.round(sum.hotShare * 100)} %` : "-", worse(sum?.hotShare, base?.hotShare), s.id === selected.id)}</span>)}
          </div>
        </div>
        <p className="break-keep text-caption leading-snug text-foreground-subtle">
          고온 지속 지역 = 체감 {HEAT_ADVISORY}°C 이상이 {HOT_HOURS}시간 넘게 이어지는 격자의 비율 · 특보 기준은 기상청(주의보 {HEAT_ADVISORY} · 경보 {HEAT_WARNING}°C, 2일 이상 지속 예상). 하루치라 도달만 봅니다
        </p>
      </section>

      <section className="flex shrink-0 flex-col gap-1.5 p-3" aria-label="그 시각 상태">
        <header className="flex items-baseline justify-between gap-2">
          <h2 className="text-body font-semibold text-foreground">그 시각 · {selected.baseline ? "예보" : selected.tag}</h2>
          <span className="shrink-0 font-mono text-caption text-foreground-subtle">{formatClock(at)}</span>
        </header>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-md border border-border bg-card px-2.5 py-2 text-caption">
          {rows.map((r) => (
            <div key={r.label} className="contents">
              <dt className="truncate text-foreground-muted">{r.label}</dt>
              <dd className={cn("text-right font-mono tabular-nums", r.label === "체감온도" ? "font-semibold text-foreground" : "text-foreground")}>
                {r.value}{r.note && <span className={cn("ml-1 font-sans", r.note.includes("기준") ? "text-warning" : "text-foreground-subtle")}>{r.note}</span>}
              </dd>
            </div>
          ))}
          <div className="contents">
            <dt className="truncate text-foreground-muted">고온 격자 (지금)</dt>
            <dd className="text-right font-mono tabular-nums text-foreground">{Math.round(hotShareNow * 100)} %</dd>
          </div>
        </dl>
        {range && (
          <p className="break-keep text-caption leading-snug text-foreground-subtle">
            지도 색면은 체감온도 {range.min}~{range.max}°C 한 램프입니다. 시각과 시나리오를 바꿔도 같은 색은 같은 값입니다
          </p>
        )}
      </section>

      <section className="flex shrink-0 flex-col gap-1.5 p-3" aria-label="관련 SOP">
        <header className="flex items-baseline justify-between gap-2">
          <h2 className="text-body font-semibold text-foreground">관련 SOP</h2>
          {stage === "none"
            ? <span className="shrink-0 text-caption text-foreground-subtle">해당 단계 없음</span>
            : <Tag tone={stage === "warning" ? "danger" : "warning"}>폭염{LEVEL_LABEL[stage]} 기준 해당</Tag>}
        </header>
        <ul className="flex flex-col text-caption">
          {sop.map((s) => {
            const hit = RANK[s.from] <= RANK[stage];
            return (
              <li key={s.id} className={cn("flex flex-col gap-0.5 border-b border-border py-1 last:border-0", hit ? "text-foreground" : "text-foreground-subtle")}>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <Icon icon={hit ? "mdi:checkbox-blank-circle" : "mdi:checkbox-blank-circle-outline"} className={cn("size-2.5 shrink-0 self-center", hit ? "text-primary-text" : "text-border-light")} aria-hidden />
                    <span className="min-w-0 break-keep">{s.label}</span>
                  </span>
                  <span className="shrink-0 font-mono text-foreground-subtle">{LEVEL_LABEL[s.from]}부터</span>
                </span>
                {s.detail && <span className="break-keep pl-4 text-caption leading-snug text-foreground-subtle">{s.detail}</span>}
              </li>
            );
          })}
        </ul>
        <p className="break-keep text-caption leading-snug text-foreground-subtle">
          이 조건이면 해당되는 기존 SOP입니다. 쉼터·살수차의 효과는 모델이 없어 계산하지 않습니다
        </p>
      </section>

      <section className="flex shrink-0 flex-col gap-1 p-3" aria-label="근거">
        <h2 className="text-body font-semibold text-foreground">근거 · 입력과 산식</h2>
        <ul className="flex flex-col gap-0.5 text-caption text-foreground-muted">
          {basis.map((b) => <li key={b} className="break-keep leading-snug">· {b}</li>)}
        </ul>
      </section>
    </div>
  );
}
