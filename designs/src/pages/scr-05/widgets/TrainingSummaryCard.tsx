/* ─────────────────────────────────────────────
 * 훈련 완료 요약 — 무슨 조건에서 · 무슨 상황을 보고 · 언제 어떤 결정을 했는지 (IA §13.1 · 2026-09-15 사용자)
 *
 * 점수는 매기지 않는다. 정답 통제 시각도 평가 모델도 없는 데모에서 "대응 적절성 87점" 같은 숫자를 만들면 가짜 계산이 하나 더 생긴다.
 * 조건 · 목표 · 주요 상황 · 내 결정 · 결정 여유(도달 대비) · 추가 결정 · 기록 건수까지만 정확히 보인다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Button } from "@ds";
import { ALTERNATIVE_LABEL } from "../../../model/forecast";
import type { TrainingRun, TrainingScenario } from "../../../model/training";
import { formatClock } from "../../../lib/datetime";
import { minutesBetween } from "../../../lib/forecast-twin";

export function TrainingSummaryCard({ scenario, run, hazard, regionLabel, arrival, showRecords, onToggleRecords }: {
  scenario: TrainingScenario;
  run: TrainingRun;
  hazard: string;
  regionLabel: string;
  /** 주요 상황 — 기준 예측판의 핵심 도달 */
  arrival: { label: string; at: string | null } | null;
  showRecords: boolean;
  onToggleRecords: () => void;
}) {
  const decisions = run.decisions.filter((d) => d.alternativeId);
  const first = decisions[0];
  const rest = decisions.slice(1);
  const margin = first?.startAt && arrival?.at ? minutesBetween(new Date(first.startAt), new Date(arrival.at)) : null;
  const set = scenario.conditionSet;
  return (
    <section className="flex flex-col gap-2 p-3" aria-label="훈련 완료">
      <header className="flex items-center gap-1.5">
        <Icon icon="mdi:flag-checkered" className="size-4 text-success" aria-hidden />
        <h2 className="text-body font-semibold text-foreground">훈련 완료</h2>
        <span className="ml-auto font-mono text-caption text-foreground-subtle">{run.startedAt && formatClock(run.startedAt)}{run.endedAt && ` → ${formatClock(run.endedAt)}`}</span>
      </header>
      <p className="text-caption text-foreground">{hazard} · {regionLabel}</p>
      {set && <p className="text-caption text-foreground-muted">{set.params.map((p) => `${p.label} ${p.value}`).join(" · ")}</p>}
      {set && (
        <p className="flex items-start gap-1.5 text-caption">
          <Icon icon="mdi:target" className="mt-px size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
          <span className="text-foreground-muted">목표</span>
          <span className="min-w-0 flex-1 text-foreground">{set.goal ?? set.objectives[set.objectives.length - 1]}</span>
        </p>
      )}

      <dl className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-1.5 border-t border-border pt-2 text-caption">
        <dt className="text-foreground-muted">주요 상황</dt>
        <dd className="text-foreground">{arrival ? (arrival.at ? <>{arrival.label} <span className="font-mono">{formatClock(arrival.at)}</span></> : `${arrival.label.replace(/ 예상$/, "")} 없음`) : "-"}</dd>

        <dt className="text-foreground-muted">내 결정</dt>
        <dd className="flex flex-col leading-tight text-foreground">
          {first ? (
            <>
              <span><span className="font-mono">{formatClock(first.at)}</span> 판단</span>
              <span>→ {first.alternativeId === "baseline" ? "대응하지 않음" : `${first.startAt ? formatClock(first.startAt) + " " : ""}${ALTERNATIVE_LABEL[first.alternativeId!]} 시작`}</span>
            </>
          ) : <span className="text-foreground-subtle">기록한 결정 없음</span>}
        </dd>

        {margin !== null && (
          <>
            <dt className="text-foreground-muted">결정 여유</dt>
            <dd className={margin > 0 ? "font-semibold text-success" : "font-semibold text-danger"}>{margin > 0 ? `도달 ${margin}분 전 시작` : margin === 0 ? "도달과 동시 시작" : `도달 ${-margin}분 뒤 시작`}</dd>
          </>
        )}

        {rest.length > 0 && (
          <>
            <dt className="text-foreground-muted">추가 결정</dt>
            <dd className="flex flex-col leading-tight text-foreground">
              {rest.map((d, i) => (
                <span key={i}><span className="font-mono">{formatClock(d.at)}</span> {ALTERNATIVE_LABEL[d.alternativeId!]}{d.startAt && <span className="text-foreground-muted"> · {formatClock(d.startAt)} 시작</span>}</span>
              ))}
            </dd>
          </>
        )}
      </dl>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
        <span className="text-caption text-foreground-muted">결정 기록 {decisions.length}건</span>
        <Button size="sm" variant="secondary" onClick={onToggleRecords}>{showRecords ? "기록 접기" : "기록 보기"}</Button>
      </div>
    </section>
  );
}
