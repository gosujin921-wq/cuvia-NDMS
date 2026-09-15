/* ─────────────────────────────────────────────
 * 위험도 — 사건 작업공간 우측 판단 탭 (IA §7 · 01 §6.2 · 02 D3 · 04 §4, 2026-09-14 정리)
 *
 * 좌측 근거가 "무슨 일이 있었나"라면 여기는 "그래서 어떻게 봤나"다. 같은 이벤트를 다시 그리지 않는다 — 기여도
 * 상자는 좌측 근거와 중복이라 걷어냈고(2026-09-14 사용자 지적), 판단에 들어간 근거는 좌측의 `위험도에 쓰인 것만`
 * 토글이 보여준다.
 *
 * 등급 배지 + 등급 띠(관심·주의·경계·심각 위 위치 점) + 판단 문장 1~3줄. 점수·4축·기여도 값은 화면에 없다 —
 * 데이터로만 남아 CAP 등급·기록·검증이 쓴다. 문장은 판단(fixture)이 들고 실개발은 시스템이 만든다.
 * 근거 목록에 없는 것만 접힌 두 줄로 남긴다: `반대로 볼 근거`(완화 요인 + 반대 근거) · `아직 모르는 것`(불확실성 + 누락 정보).
 * ───────────────────────────────────────────── */

import { useState } from "react";
import { Icon } from "@iconify/react";
import { Badge, cn } from "@ds";
import type { HazardAssessment } from "../../../model/incident";
import { riskBandOf, riskBandSentence } from "../../../model/selectors";
import { RISK_GRADE_TONE } from "../../../lib/status-tone";
import { formatClock } from "../../../lib/datetime";

export function RiskCard({ assessment, previous = null, compact = false }: {
  assessment: HazardAssessment | null;
  /** 직전 판단 — 띠 툴팁의 변화 방향 */
  previous?: HazardAssessment | null;
  compact?: boolean;
}) {
  const [showNotes, setShowNotes] = useState(false);
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
  const band = riskBandOf(m, previous?.matrix ?? null);
  const against = [...assessment.mitigatingFactors, ...assessment.counterEvidence];
  const unknown = [...assessment.uncertainties, ...assessment.missingData];

  return (
    <section className="flex flex-col px-3 py-2.5" aria-label="위험도">
      <header className="flex items-baseline justify-between">
        <h2 className="text-body font-semibold text-foreground">{compact ? "판단 요약" : "위험도"}</h2>
        <span className="text-caption text-foreground-subtle">{formatClock(m.computedAt)} 갱신</span>
      </header>

      <div className="mt-1.5 flex items-center gap-2">
        <Badge variant={tone.badge}>{m.grade}</Badge>
        {/* 등급 띠 — 관심·주의·경계·심각 구간 위에 현재 위치 점. 숫자 대신 "어디쯤인가" */}
        <span className="relative flex h-1.5 flex-1 overflow-visible rounded" aria-label={`위험도 위치 · ${riskBandSentence(band)}`} title={riskBandSentence(band)}>
          {band.segments.map((seg) => (
            <span key={seg.grade} className={cn("h-full first:rounded-l last:rounded-r", seg.grade === m.grade ? "opacity-90" : "opacity-30")} style={{ width: `${(seg.to - seg.from) * 100}%`, backgroundColor: RISK_GRADE_TONE[seg.grade].color }} />
          ))}
          <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow-sm" style={{ left: `${band.position * 100}%`, backgroundColor: tone.color }} aria-hidden />
        </span>
      </div>

      <div className="mt-2 flex flex-col gap-0.5 text-caption text-foreground">
        {assessment.narrative.map((line) => <p key={line}>{line}</p>)}
      </div>

      {!compact && (against.length > 0 || unknown.length > 0) && (
        <button type="button" onClick={() => setShowNotes((v) => !v)} className="mt-1.5 flex cursor-pointer items-center gap-0.5 self-end border-none bg-transparent p-0 text-caption text-foreground-subtle hover:text-foreground" aria-expanded={showNotes}>
          {showNotes ? "접기" : `반대로 볼 근거 ${against.length} · 아직 모르는 것 ${unknown.length}`}
          <Icon icon="mdi:chevron-down" className={cn("size-3.5 transition-transform", showNotes && "rotate-180")} aria-hidden />
        </button>
      )}

      {!compact && showNotes && (
        <dl className="mt-1 flex flex-col gap-1 text-caption">
          <Row label="반대로 볼 근거">{against.join(" · ") || "-"}</Row>
          <Row label="아직 모르는 것">{unknown.join(" · ") || "-"}</Row>
        </dl>
      )}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 py-0.5">
      <dt className="w-[84px] shrink-0 text-foreground-subtle">{label}</dt>
      <dd className="min-w-0 flex-1 text-foreground-muted">{children}</dd>
    </div>
  );
}
