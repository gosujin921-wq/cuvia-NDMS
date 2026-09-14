/* ─────────────────────────────────────────────
 * 침수예측판 — 사건 작업공간 우측 판단 모드 (IA §7 "침수예측판 갱신을 관측·영상과 같은 급의 근거로").
 * Phase 1 영향 분석 카드 자리
 *
 * 현재 유효한 기준 전망의 유효시각·침수심·도달·영향 요약 한 줄과 [디지털트윈 보기]. 예측판이 없으면
 * 대기 사유를 적는다(IA §8 데이터가 없을 때). 값을 여기서 계산하지 않는다.
 * ───────────────────────────────────────────── */

import { Button } from "@ds";
import { Icon } from "@iconify/react";
import type { Forecast } from "../../../model/forecast";
import { forecastHeadlineAt } from "../../../model/selectors";
import { formatClock } from "../../../lib/datetime";
import { useScenario } from "../../../state/ScenarioProvider";

export function ImpactPanel({ forecast, onOpenTwin }: { forecast: Forecast | null; onOpenTwin: (forecastId: string) => void }) {
  const { demoNow: now } = useScenario();
  return (
    <section className="flex flex-col gap-1.5 p-3" aria-label="전망">
      <h2 className="text-body font-semibold text-foreground">전망</h2>
      {forecast ? (
        <>
          <p className="flex items-center gap-1.5 text-body text-warning">
            <Icon icon="mdi:waves-arrow-up" className="size-4 shrink-0" aria-hidden />
            {forecastHeadlineAt(forecast, now)}
          </p>
          <dl className="flex flex-col text-caption">
            {forecast.marks.map((m) => (
              <div key={m.validAt} className="flex items-baseline gap-2 py-0.5">
                <dt className="w-[44px] shrink-0 font-mono text-foreground-subtle">{formatClock(m.validAt)}</dt>
                <dd className="flex min-w-0 flex-1 items-baseline gap-1.5">
                  <span className="shrink-0 font-mono text-foreground">{m.maxDepthM.toFixed(2)} m</span>
                  <span className="truncate text-foreground-muted">{m.impactSummary}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-caption text-foreground-subtle">
            {forecast.basis.modelName} {forecast.basis.modelVersion} · 기준 {formatClock(forecast.basis.baseTime)} · 불확실성 {forecast.basis.uncertainty.grade}
          </p>
          <Button variant="outline" size="sm" className="w-full" onClick={() => onOpenTwin(forecast.forecastId)}>
            <Icon icon="mdi:cube-scan" className="size-4" aria-hidden />
            디지털트윈 보기
          </Button>
        </>
      ) : (
        <p className="text-caption text-foreground-muted">유효한 전망 없음 · 예측 갱신을 기다림</p>
      )}
    </section>
  );
}
