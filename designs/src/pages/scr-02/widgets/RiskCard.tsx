/* ─────────────────────────────────────────────
 * 위험도 — 사건 작업공간 우측 판단 탭 (IA §7 · 01 §6.2 · 02 D3). Phase 1 위험도 판정 카드 자리
 *
 * 판단만 싣는다: 매트릭스 등급 배지·점수 / 4축 칩 / 지표별 기여도 / 위험·완화 요인 / 반대 근거·불확실성·누락.
 * 4축은 별도 등급이 아니라 매트릭스 결과의 설명이다. 등급 배지는 종합상황 사건 카드와 같은 톤(RISK_GRADE_TONE).
 * 판단 갱신(ASSESSMENT_UPDATED) 전에는 "근거 확인 중"으로 눕는다 — 값을 지어내지 않는다. 승인은 대응 탭이 든다.
 * ───────────────────────────────────────────── */

import { Badge, Tag, cn } from "@ds";
import type { HazardAssessment } from "../../../model/incident";
import { RISK_GRADE_TONE } from "../../../lib/status-tone";
import { formatClock } from "../../../lib/datetime";

export function RiskCard({ assessment, compact = false }: { assessment: HazardAssessment | null; compact?: boolean }) {
  if (!assessment) {
    return (
      <section className="flex flex-col px-3 py-2.5" aria-label="위험도">
        <h2 className="text-body font-semibold text-foreground">위험도</h2>
        <p className="mt-1 text-caption text-foreground-muted">근거 확인 중 · 판단은 확인 뒤 갱신</p>
      </section>
    );
  }
  const m = assessment.matrix;
  const tone = RISK_GRADE_TONE[m.grade];
  const top = [...m.contributions].sort((a, b) => b.contribution - a.contribution);
  const shown = compact ? top.slice(0, 3) : top;

  return (
    <section className="flex flex-col px-3 py-2.5" aria-label="위험도">
      <header className="flex items-baseline justify-between">
        <h2 className="text-body font-semibold text-foreground">{compact ? "판단 요약" : "위험도"}</h2>
        <span className="text-caption text-foreground-subtle">{m.ruleId} {m.ruleVersion} · {formatClock(m.computedAt)}</span>
      </header>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Badge variant={tone.badge}>{m.grade}</Badge>
        <span className="font-mono text-body font-semibold text-foreground">{m.score.toFixed(2)}</span>
        <span className="ml-auto flex flex-wrap gap-1">
          <Tag>심각 {assessment.severity}</Tag>
          <Tag tone={assessment.urgency === "즉시" ? "warning" : "neutral"}>긴급 {assessment.urgency}</Tag>
          <Tag>확실 {assessment.certainty}</Tag>
          <Tag tone={assessment.trend === "악화" ? "danger" : "neutral"}>{assessment.trend}</Tag>
        </span>
      </div>

      {/* 지표별 기여도 — 무엇이 위험을 만들었나. 막대 폭 = 기여도 */}
      <ul className="mt-2 flex flex-col gap-1">
        {shown.map((c) => (
          <li key={c.indicator} className="flex items-center gap-2 text-caption">
            <span className="w-[88px] shrink-0 truncate text-foreground-muted">{c.indicator}</span>
            <span className="h-1.5 flex-1 rounded bg-surface-raised">
              <span className={cn("block h-full rounded", c.degraded ? "bg-warning" : "bg-primary")} style={{ width: `${Math.round(c.contribution * 100 / 0.3)}%` }} />
            </span>
            <span className="w-[36px] shrink-0 text-right font-mono text-foreground">{c.contribution.toFixed(2)}</span>
            <span className="w-[86px] shrink-0 truncate text-foreground-subtle">{c.band}{c.degraded ? " · 품질↓" : ""}</span>
          </li>
        ))}
      </ul>

      {!compact && (
        <dl className="mt-2 flex flex-col gap-1 border-t border-border pt-2 text-caption">
          <Row label="위험 요인">{assessment.riskFactors.join(" · ")}</Row>
          <Row label="완화 요인">{assessment.mitigatingFactors.join(" · ")}</Row>
          <Row label="반대 근거">{assessment.counterEvidence.join(" · ") || "-"}</Row>
          <Row label="불확실성">{assessment.uncertainties.join(" · ")}</Row>
          <Row label="누락 정보">{assessment.missingData.join(" · ")}</Row>
        </dl>
      )}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 py-0.5">
      <dt className="w-[60px] shrink-0 text-foreground-subtle">{label}</dt>
      <dd className="min-w-0 flex-1 text-foreground-muted">{children}</dd>
    </div>
  );
}
