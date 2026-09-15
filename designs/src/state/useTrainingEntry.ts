/* ─────────────────────────────────────────────
 * D8 훈련 진입점 — 종료된 사건으로 TrainingScenario 를 만들고 대응 모의훈련(/scr-05)으로 간다 (02 D8 · IA §13.1)
 *
 * 사건 작업공간(종료 사건 안내)과 기록·검증([보고서 생성] 옆) 두 자리가 같은 진입점이다. 만드는 규칙은 한 벌:
 *   기준 전망 = 담당자가 마지막으로 고른 예측판(query) → 없으면 사건의 기준 예측판
 *   같은 사건은 한 번만 만든다 — 이미 있으면 그것을 연다
 * 원 사건은 바뀌지 않는다.
 * ───────────────────────────────────────────── */

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@ds";
import type { Incident } from "../model/incident";
import type { TrainingScenario } from "../model/training";
import { forecastsOf } from "../model/selectors";
import { useScenario } from "./ScenarioProvider";

export function useTrainingEntry() {
  const { demoNow: now, trainingScenarios, createTrainingScenario } = useScenario();
  const navigate = useNavigate();

  const existingFor = useCallback(
    (incidentId: string): TrainingScenario | null => trainingScenarios.find((s) => s.source.sourceIncidentId === incidentId) ?? null,
    [trainingScenarios],
  );

  const open = useCallback(
    (incident: Incident, preferredForecastId?: string | null) => {
      const existing = existingFor(incident.incidentId);
      const all = forecastsOf(incident.incidentId, now);
      const forecastPick = preferredForecastId || all.find((f) => f.alternativeId === "baseline")?.forecastId || all[0]?.forecastId;
      if (!existing && !forecastPick) {
        toast.error("훈련 스냅샷을 만들 수 없습니다", { description: "이 사건이 참조한 예측판이 없습니다" });
        return;
      }
      const scenario = existing ?? createTrainingScenario({ sourceIncidentId: incident.incidentId, selectedForecastId: forecastPick!, requestedAt: now.toISOString(), requestedBy: incident.ownership.officer });
      if (!scenario) return;
      toast.success(existing ? "이미 만든 스냅샷을 디지털트윈에서 엽니다" : "종료 시점 스냅샷을 만들었습니다", { description: `${scenario.scenarioId} · 디지털트윈에서 훈련할 수 있습니다 · 원 사건은 바뀌지 않습니다` });
      navigate(`/scr-05?scenarioId=${scenario.scenarioId}`);
    },
    [existingFor, now, createTrainingScenario, navigate],
  );

  return { existingFor, open };
}
