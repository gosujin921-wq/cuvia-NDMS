/* ─────────────────────────────────────────────
 * 예측 케이스 — 사건이 끝난 뒤 남는 "예측 대 실제" 한 건 (IA §13.1 · 03 §25 · 2026-09-15 확정)
 *
 * 모의훈련 모드는 두지 않는다. 디지털트윈은 예측 시뮬레이션이고, 사건이 끝나면 쌓이는 단위는
 * 훈련 회차가 아니라 이 케이스다. 한 사건의 예측판 하나가 케이스 한 건이고, 종료(D8)에서 실제 결과가 붙어 확정된다.
 *
 * ★ 점수를 매기지 않는다. "잘했다·못했다"를 말하지 않고 예측과 실제를 나란히 두고 차이와 개선 항목만 남긴다.
 * ★ 원 Incident·Forecast·Decision·Action·Outcome 을 참조만 하고 고치지 않는다 — 여기 값은 전부 그것들에서 파생한다.
 * ───────────────────────────────────────────── */

import type { TwinFamily } from "./incident";
import type { ForecastInput } from "./forecast";
import type { Improvement } from "./response";

/** 예측이 실제보다 컸나 작았나 — 색이 아니라 방향이다. 어느 쪽이 "좋다"가 아니다 */
export type ErrorDirection = "과대" | "과소" | "일치";

/** 예측 대 실제 한 줄 — 침수 도달 · 최대 침수심 · 영향 건물 */
export interface CaseRow {
  label: string;
  predicted: string;
  actual: string;
  /** "+6분" · "−0.05 m" · "−2동". 비교할 수 없으면 null */
  error: string | null;
  direction: ErrorDirection;
  /** 비교할 수 없는 이유 — error 가 null 일 때만 */
  unavailable?: string;
}

/** 영향 대상 하나의 예측 대 실제 */
export interface CaseTargetRow {
  id: string;
  kind: string;
  predicted: string;
  actual: string | null;
  /** 상태가 같으면 적중. 실제를 확인 못 했으면 null */
  hit: boolean | null;
  /** 대응으로 노출이 막혔다 — 예측이 빗나간 것이 아니라 대응이 들어간 것이다 */
  byResponse: boolean;
}

export interface CaseAction {
  at: string;
  text: string;
  eventId?: string;
}

export interface PredictionCase {
  caseId: string;
  sourceIncidentId: string;
  incidentTitle: string;
  hazardLabel: string;
  twinFamily: TwinFamily;
  regionLabel: string;
  /** 예측판 기준시각 */
  baseTime: string;
  /** 케이스가 확정된 시각 = 사건 종료 */
  confirmedAt: string;
  forecastId: string;
  /** 무슨 정보로 예측했나 */
  inputs: ForecastInput[];
  modelName: string;
  modelVersion: string;
  inputQuality: string;
  rows: CaseRow[];
  targets: CaseTargetRow[];
  /** 예측 범위 · 실제 범위 — 지도가 겹쳐 그린다 */
  predictedGeometryId: string;
  actualGeometryId: string | null;
  /** 이 예측 옆에 같이 만들었던 대안 전망 */
  alternatives: { label: string; headline: string }[];
  /** 실제로 무엇을 언제 했나 */
  actions: CaseAction[];
  improvements: Improvement[];
  /** 검증할 수 없었으면 그 이유 */
  unavailableReason?: string;
}
