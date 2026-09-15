/* ─────────────────────────────────────────────
 * 대응 모의훈련 — TrainingScenario · TrainingRun (IA §13.1 · §15)
 *
 * D8 의 훈련 생성은 사건 복제가 아니라 종료 시점 조건·근거의 **고정 스냅샷** 요청이다. 원 사건은
 * 바뀌지 않고 훈련 중 결정·조치·결과는 TrainingRun 에만 쌓인다. I0 범위는 생성 진입점과 계약까지.
 * ───────────────────────────────────────────── */

import type { AlternativeId } from "./forecast";
import type { HazardKind, TwinFamily } from "./incident";
import type { ScopeKind, SpatialRef } from "./event";

export interface SnapshotEventRef {
  eventId: string;
  demoRef?: string;
  schemaVersion: string;
}

/** 시나리오 출처 — 종료 사건 스냅샷(D8) 또는 사전 조건 세트(사건 없이 조건을 골라 연다) */
export type TrainingOrigin = "incident-snapshot" | "condition-set";

/** 조건 축의 한 값 — "강우 강도 = 강함(20 mm/h)" */
export interface ConditionParam {
  key: string;
  label: string;
  value: string;
  /** 값의 부연 — "20 mm/h" */
  note?: string;
}

/**
 * 사전 조건 세트 — 조건 조합 하나에 준비된 예측판을 묶는다 (IA-T01 사전 조건분석).
 * ★ 예측판은 사전 작성 결과다. 조건에서 값을 계산하지 않는다. 준비 안 된 조합은 `baselineForecastId: null` 로
 *   정직하게 비우고, 실개발에서는 그 자리가 같은 조건의 ModelRun 요청이 된다.
 */
/** 훈련 지역 — 유형별 대상지 후보. 예측판이 준비된 지역만 고를 수 있고 나머지는 목록에 이름만 선다 */
export interface TrainingRegion {
  regionId: string;
  twinFamily: TwinFamily;
  label: string;
  /** 범위를 빌려 올 사건. 후보 지역은 없을 수 있다 */
  incidentId?: string;
}

export interface TrainingConditionSet {
  setId: string;
  /** 어느 유형군의 조건인가 — 유형 축이 이걸로 세트를 거른다 */
  twinFamily: TwinFamily;
  /** 어느 지역의 조건인가 — 지역 축이 이걸로 세트를 거른다 */
  regionId: string;
  label: string;
  /** 범위·유형을 빌려 올 대표 사건. 개념 장면은 사건이 없어 `source` 가 대신 든다 */
  incidentId?: string;
  /** 사건 없는 개념 장면의 범위·유형 */
  source?: { title: string; hazardKind: HazardKind; twinFamily: TwinFamily; scope: SpatialRef };
  params: ConditionParam[];
  baselineForecastId: string | null;
  alternativeForecastIds: string[];
  objectives: string[];
  /** 한 줄 목표 — "해안도로 통제 시점을 결정하세요". 화면 첫 카드가 이것만 보인다 */
  goal?: string;
  changeableConditions: string[];
  /** 준비 안 된 조합의 사유 — 화면 안내 */
  unavailableReason?: string;
}

export interface TrainingScenario {
  scenarioId: string;
  snapshotVersion: number;
  createdAt: string;
  origin: TrainingOrigin;
  /** 조건 세트 출처일 때 그 세트 */
  conditionSet?: TrainingConditionSet;
  source: { sourceIncidentId: string; hazardKind: HazardKind; twinFamily: TwinFamily; scopeKind: ScopeKind; scope: SpatialRef };
  timing: { snapshotAt: string; originalStartAt: string; trainingBaseTime: string };
  conditionEvents: SnapshotEventRef[];
  /** 기준 예측판. 조건 세트에 준비된 예측판이 없으면 null */
  selectedForecast: { forecastId: string; validAt: string; alternativeId: string; affectedGeometryId?: string } | null;
  history: { evidenceEventIds: string[]; decisionIds: string[]; actionIds: string[]; outcomeIds: string[] };
  training: { changeableConditions: string[]; alternativeForecastIds: string[]; objectives: string[] };
  provenance: { composition: string; transformRules: string[]; calculationActor: string; replacementTargets: string[] };
}

/** 훈련 기록 한 줄 — 결정은 어느 대응을 언제부터 하기로 했는지를 같이 든다. 대응 버튼은 미리보기이고 이 기록만이 "내가 결정했다"다 */
export interface TrainingEntry {
  /** 훈련 축 위 시각(유효 시각) */
  at: string;
  summary: string;
  /** 결정한 대응 — 없으면 결정이 아니라 조치·결과 줄 */
  alternativeId?: AlternativeId;
  /** 대응 시작 시각 */
  startAt?: string;
  memo?: string;
}

export interface TrainingRun {
  trainingRunId: string;
  scenarioId: string;
  status: "준비" | "진행중" | "완료" | "중단";
  participants: string[];
  startedAt?: string;
  endedAt?: string;
  decisions: TrainingEntry[];
  actions: TrainingEntry[];
  outcomes: TrainingEntry[];
  retrospective?: string;
}

export interface TrainingScenarioRequest {
  sourceIncidentId: string;
  selectedForecastId: string;
  requestedAt: string;
  requestedBy: string;
}
