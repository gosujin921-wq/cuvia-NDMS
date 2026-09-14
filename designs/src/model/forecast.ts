/* ─────────────────────────────────────────────
 * 예측판(Forecast) · 모델 실행(ModelRun) · 영향공간(AffectedArea)
 * 정본: 01 §8 · §8.2, 02 D4~D5 · §5.5, 03 §4, IA §8
 *
 * Forecast 는 이벤트가 아니다. `FORECAST_UPDATED` 이벤트가 **참조하는 결과 객체**다(IA §13.1).
 * ★ 대안은 런타임 계수로 계산하지 않는다. 사전에 작성한 시나리오 결과 세트이고, 실제 모델이
 *   붙으면 ModelRun 결과로 같은 계약 그대로 교체한다.
 * ───────────────────────────────────────────── */

import type { CalculationActor, DataQuality } from "./event";

export type AlternativeId = "baseline" | "drainage" | "road-control";

export const ALTERNATIVE_LABEL: Record<AlternativeId, string> = {
  baseline: "그대로",
  drainage: "배수 대응",
  "road-control": "도로 통제",
};

export type ForecastAvailability = "가용" | "만료" | "대안 계산 불가" | "대기";

export interface ForecastMark {
  /** 유효시각. 눈금값만 판단에 쓴다(IA §8) */
  validAt: string;
  maxDepthM: number;
  extentGeometryId: string;
  impactSummary: string;
}

export interface ImpactTarget {
  kind: "도로" | "건물" | "중요시설" | "대상자";
  id: string;
  label: string;
  arrivalAt?: string;
  exposure: "노출" | "부분 중단" | "중단" | "통제됨";
}

export interface ForecastBasis {
  modelName: string;
  modelVersion: string;
  baseTime: string;
  generatedAt: string;
  inputEventIds: string[];
  assumptions: string[];
  uncertainty: { grade: "낮음" | "보통" | "높음"; sensitiveTo: string[]; unusableRanges: string[] };
  inputQuality: DataQuality;
  calculationActor: CalculationActor;
  replacementNote?: string;
}

export interface Forecast {
  forecastId: string;
  incidentId: string;
  alternativeId: AlternativeId;
  changedConditions: string[];
  deltaSummary?: string;
  marks: ForecastMark[];
  arrivalAt: string;
  targets: ImpactTarget[];
  basis: ForecastBasis;
  availability: ForecastAvailability;
  sourceEventId: string;
  validUntil: string;
}

export type ModelRunStatus = "미지원·미실행" | "실행중" | "완료" | "실패";

export interface ModelRun {
  runId: string;
  incidentId: string;
  requestedAt: string;
  conditions: string[];
  status: ModelRunStatus;
  failure?: { reason: string; fallback: string };
  forecastId?: string;
}

export interface AffectedArea {
  areaId: string;
  incidentId: string;
  kind: "현재" | "예상";
  geometryId: string;
  at: string;
  targets: ImpactTarget[];
  forecastId?: string;
}
