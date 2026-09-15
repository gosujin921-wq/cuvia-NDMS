/* ─────────────────────────────────────────────
 * 판단 기준 전망 — 사건 작업공간 우측 판단 탭 (IA §7 "침수예측판 갱신을 관측·영상과 같은 급의 근거로").
 * Phase 1 영향 분석 카드 자리
 *
 * "지금 위험 판단이 어떤 예측을 전제했나"를 보이는 카드다(2026-09-14 결정). 매트릭스의 디지털트윈 예측 지표와
 * 예측 영향 알림이 이 기준 전망에서 나온다. 헤드라인 한 줄 · 기준시각·대안·유효 종료 · [전망 탭에서 비교].
 * 대안 비교와 유효시각별 표는 전망 탭이 든다. 예측판이 없으면 대기 사유를 적는다(IA §8). 값을 여기서 계산하지 않는다.
 * ───────────────────────────────────────────── */

import { Button } from "@ds";
import { Icon } from "@iconify/react";
import { ALTERNATIVE_LABEL, type Forecast } from "../../../model/forecast";
import { forecastHeadlineAt } from "../../../model/selectors";
import { formatClock } from "../../../lib/datetime";
import { useScenario } from "../../../state/ScenarioProvider";

export function ImpactPanel({ forecast, onOpenTwin }: { forecast: Forecast | null; onOpenTwin: (forecastId: string) => void }) {
  const { demoNow: now } = useScenario();
  return (
    <section className="flex flex-col gap-1.5 p-3" aria-label="판단 기준 전망">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-body font-semibold text-foreground">판단 기준 전망</h2>
        {forecast && <span className="text-caption text-foreground-subtle">유효 ~{formatClock(forecast.validUntil)}</span>}
      </header>
      {forecast ? (
        <>
          <p className="flex items-center gap-1.5 text-body text-warning">
            <Icon icon="mdi:waves-arrow-up" className="size-4 shrink-0" aria-hidden />
            {forecastHeadlineAt(forecast, now)}
          </p>
          <p className="text-caption text-foreground-subtle">
            {formatClock(forecast.basis.baseTime)} 기준 · {forecast.alternativeId === "baseline" ? "지금 조건이 이어질 때" : `${ALTERNATIVE_LABEL[forecast.alternativeId]} 때`}
          </p>
          <Button variant="outline" size="sm" className="w-full" onClick={() => onOpenTwin(forecast.forecastId)}>
            <Icon icon="mdi:cube-scan" className="size-4" aria-hidden />
            전망 탭에서 비교
          </Button>
        </>
      ) : (
        <p className="text-caption text-foreground-muted">유효한 전망 없음 · 예측 갱신을 기다림. 판단의 디지털트윈 예측 지표는 미평가</p>
      )}
    </section>
  );
}
