/* ─────────────────────────────────────────────
 * 위험 현황 — 종합상황 우 1 (초안 §2 · CSMS RiskSummary 문법)
 *
 *   심각 {n}   경계 {n}   대응중 {n}
 * 앞의 둘은 위험도(매트릭스 등급) 축, 대응중은 처리 축이다. 셋이 한 줄에 서지만 합이 맞지 않는 것이
 * 정상이다. 관측 낱개 수를 넣지 않는다 — 여기는 "담당자가 판단해야 할 사건이 몇 건인가"다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { cn } from "@ds";
import { riskCountsAt } from "../../../model/selectors";
import { RISK_GRADE_TONE } from "../../../lib/status-tone";
import { useScenario } from "../../../state/ScenarioProvider";

export function RiskSummary() {
  const { demoNow: now } = useScenario();
  const r = riskCountsAt(now);
  return (
    <section className="flex flex-col gap-2.5 p-3" aria-label="위험 현황">
      <header className="flex items-baseline justify-between">
        <h2 className="text-body font-semibold text-foreground">위험 현황</h2>
      </header>
      <div className="grid grid-cols-3 gap-2">
        <Cell label="심각" value={r.severe} dotClass={RISK_GRADE_TONE.심각.dot} valueClass={r.severe > 0 ? RISK_GRADE_TONE.심각.text : "text-foreground-muted"} />
        <Cell label="경계" value={r.high} dotClass={RISK_GRADE_TONE.경계.dot} valueClass={r.high > 0 ? RISK_GRADE_TONE.경계.text : "text-foreground-muted"} />
        <Cell label="대응중" value={r.responding} icon="mdi:progress-wrench" title="대응안이 승인되어 조치가 진행 중인 사건 수. 위험도와 별개 축이다" valueClass={r.responding > 0 ? "text-foreground" : "text-foreground-muted"} />
      </div>
    </section>
  );
}

function Cell({ label, value, dotClass, icon, valueClass, title }: { label: string; value: number; dotClass?: string; icon?: string; valueClass: string; title?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-surface-raised px-2.5 py-2" title={title}>
      <span className="flex items-center gap-1.5 text-caption text-foreground-muted">
        {dotClass && <span className={cn("size-2 shrink-0 rounded-full", dotClass)} aria-hidden />}
        {icon && <Icon icon={icon} className="size-3.5 shrink-0 text-foreground-subtle" aria-hidden />}
        <span className="truncate">{label}</span>
      </span>
      <span className={cn("font-mono text-h5 font-semibold leading-none tabular-nums", valueClass)}>{value}</span>
    </div>
  );
}
