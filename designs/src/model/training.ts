/* ─────────────────────────────────────────────
 * 대응 모의훈련 — TrainingScenario · TrainingRun (IA §13.1 · §15)
 *
 * D8 의 훈련 생성은 사건 복제가 아니라 종료 시점 조건·근거의 **고정 스냅샷** 요청이다. 원 사건은
 * 바뀌지 않고 훈련 중 결정·조치·결과는 TrainingRun 에만 쌓인다. I0 범위는 생성 진입점과 계약까지.
 * ───────────────────────────────────────────── */

import type { HazardKind, TwinFamily } from "./incident";
import type { ScopeKind, SpatialRef } from "./event";

export interface SnapshotEventRef {
  eventId: string;
  demoRef?: string;
  schemaVersion: string;
}

export interface TrainingScenario {
  scenarioId: string;
  snapshotVersion: number;
  createdAt: string;
  source: { sourceIncidentId: string; hazardKind: HazardKind; twinFamily: TwinFamily; scopeKind: ScopeKind; scope: SpatialRef };
  timing: { snapshotAt: string; originalStartAt: string; trainingBaseTime: string };
  conditionEvents: SnapshotEventRef[];
  selectedForecast: { forecastId: string; validAt: string; alternativeId: string; affectedGeometryId?: string };
  history: { evidenceEventIds: string[]; decisionIds: string[]; actionIds: string[]; outcomeIds: string[] };
  training: { changeableConditions: string[]; alternativeForecastIds: string[]; objectives: string[] };
  provenance: { composition: string; transformRules: string[]; calculationActor: string; replacementTargets: string[] };
}

export interface TrainingRun {
  trainingRunId: string;
  scenarioId: string;
  status: "준비" | "진행중" | "완료" | "중단";
  participants: string[];
  startedAt?: string;
  endedAt?: string;
  decisions: { at: string; summary: string }[];
  actions: { at: string; summary: string }[];
  outcomes: { at: string; summary: string }[];
  retrospective?: string;
}

export interface TrainingScenarioRequest {
  sourceIncidentId: string;
  selectedForecastId: string;
  requestedAt: string;
  requestedBy: string;
}
