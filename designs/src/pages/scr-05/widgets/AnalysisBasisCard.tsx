/* ─────────────────────────────────────────────
 * 예측 근거 · 가정 — 접힌 두 줄 (03 §21 · 사용자 재정비 2026-09-15)
 *
 * 판단 흐름은 결과를 보고 → 비교하고 → 필요하면 근거를 확인한다. 그래서 기본은 접혀 있고 눌러야 열린다.
 * 열면 기준시각 · 불확실성 · 근거(입력 이벤트) · 가정이 선다. 모델 이름·버전은 일반 사용자에게 뜻이 없어
 * 상세 맨 아래에 작게만 둔다.
 *
 * ★ 값은 예측판 basis 를 그대로 되쓴다(lib/forecast-twin forecastBasisOf). 여기서 새 숫자를 만들지 않는다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { formatClock } from "../../../lib/datetime";
import type { AnalysisBasis } from "../../../demo/analysis";

export function AnalysisBasisCard({ basis }: { basis: AnalysisBasis }) {
  const model = basis.terms.find((t) => t.label === "모델");
  const terms = basis.terms.filter((t) => t.label !== "모델");
  return (
    <section className="flex flex-col" aria-label="예측 근거와 가정">
      <Fold icon="mdi:database-outline" title="예측 근거" meta={`분석 ${formatClock(basis.at)}`}>
        <dl className="flex flex-col">
          {terms.map((term) => (
            <div key={term.label} className="flex items-baseline gap-2 py-0.5 text-caption" title={term.note}>
              <dt className="w-14 shrink-0 text-foreground-muted">{term.label}</dt>
              <dd className="min-w-0 flex-1 truncate font-mono text-foreground">{term.value}</dd>
            </div>
          ))}
        </dl>
        {basis.sources.length > 0 && (
          <ul className="flex flex-col gap-0.5 border-t border-border pt-1">
            {basis.sources.map((s) => <li key={s} className="text-caption text-foreground-muted">{s}</li>)}
          </ul>
        )}
        {model && <p className="border-t border-border pt-1 text-caption text-foreground-subtle" title={model.note}>{model.value}</p>}
      </Fold>
      {basis.assumptions.length > 0 && (
        <Fold icon="mdi:help-rhombus-outline" title="가정">
          <ul className="flex flex-col gap-0.5">
            {basis.assumptions.map((a) => <li key={a} className="text-caption text-foreground-muted">{a}</li>)}
          </ul>
        </Fold>
      )}
    </section>
  );
}

/** 접힘 한 칸 — 네이티브 details. 열림 상태는 브라우저가 든다 */
function Fold({ icon, title, meta, children }: { icon: string; title: string; meta?: string; children: React.ReactNode }) {
  return (
    <details className="group border-t border-border first:border-t-0">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-caption font-semibold text-foreground hover:bg-surface-raised [&::-webkit-details-marker]:hidden">
        <Icon icon={icon} className="size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
        <span className="min-w-0 flex-1">{title}</span>
        {meta && <span className="shrink-0 font-mono font-normal text-foreground-subtle">{meta}</span>}
        <Icon icon="mdi:chevron-right" className="size-4 shrink-0 text-foreground-subtle transition-transform group-open:rotate-90" aria-hidden />
      </summary>
      <div className="flex flex-col gap-1 px-3 pb-2.5">{children}</div>
    </details>
  );
}
