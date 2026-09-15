/* ─────────────────────────────────────────────
 * 예측판(Forecast) · 모델 실행(ModelRun) · 영향공간(AffectedArea)
 * 정본: 01 §8 · §8.2, 02 D4~D5 · §5.5, 03 §4, IA §8
 *
 * Forecast 는 이벤트가 아니다. `FORECAST_UPDATED` 이벤트가 **참조하는 결과 객체**다(IA §13.1).
 * ★ 대안은 런타임 계수로 계산하지 않는다. 사전에 작성한 시나리오 결과 세트이고, 실제 모델이
 *   붙으면 ModelRun 결과로 같은 계약 그대로 교체한다.
 * ───────────────────────────────────────────── */

import type { CalculationActor, DataQuality } from "./event";
import type { ConditionLine, SceneLayer, SceneProfile, SceneSystem } from "./scene";

/** 대안 종류 — A 배수·통제, B 방류·대피, C 수문·해안 통제 (03 §6~§8 대안 조건). 결과 세트가 어느 것을 가지는지는 fixture 가 정한다 */
export type AlternativeId = "baseline" | "drainage" | "road-control" | "discharge" | "evacuation" | "gate" | "coast-control" | "containment" | "backup-power" | "inspection-priority" | "recovery-order" | "shelter-extend" | "patrol";

export const ALTERNATIVE_LABEL: Record<AlternativeId, string> = {
  baseline: "현재 조건",
  drainage: "배수 대응",
  "road-control": "도로 통제",
  discharge: "방류 조정",
  evacuation: "대피 개시",
  gate: "수문·차수",
  "coast-control": "해안 통제",
  containment: "차단선·진압",
  "backup-power": "비상전원 투입",
  "inspection-priority": "점검·보강 우선순위",
  "recovery-order": "복구 순서",
  "shelter-extend": "쉼터 연장",
  patrol: "순회 자원",
};

/** 눈금의 핵심 지표 — 유형이 정한다. 없으면 침수심(maxDepthM · m)이다 */
export interface MarkMetric {
  label: string;
  value: number;
  unit: string;
  digits?: number;
  /** 숫자 대신 보일 문장 — "50분 뒤" · "물양장 월류 중" · "19:00 복구". 있으면 value·unit 대신 이걸 보인다 */
  text?: string;
}

export type ForecastAvailability = "가용" | "만료" | "대안 계산 불가" | "대기";

export interface ForecastMark {
  /** 유효시각. 눈금값만 판단에 쓴다(IA §8) */
  validAt: string;
  /** 최대 침수심(m). 물 유형의 기본 지표. 다른 유형은 0 으로 두고 `metric` 이 든다 */
  maxDepthM: number;
  /** 유형별 핵심 지표 — 화선 확산 거리(km) · 누적 변위(mm) · 중단 권역(곳). 있으면 침수심 대신 이걸 보인다 */
  metric?: MarkMetric;
  /** 이 시각에만 서는 장면 층 — 플룸 · 시설 상태 · 노드 상태 · 벡터 (model/scene.ts) */
  scene?: SceneLayer[];
  extentGeometryId: string;
  impactSummary: string;
}

export interface ImpactTarget {
  kind: "도로" | "건물" | "중요시설" | "대상자";
  id: string;
  label: string;
  arrivalAt?: string;
  /** 영향 없음 = 예측 범위 안에서 물이 닿지 않는다. 통제됨 = 사람이 막아 노출을 없앴다 */
  exposure: "영향 없음" | "노출" | "부분 중단" | "중단" | "통제됨";
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
  /** 이 예측판을 참조하는 E8 이벤트. 사전 조건 세트의 예측판은 이벤트 없이 존재한다 */
  sourceEventId?: string;
  validUntil: string;
  /** 시각과 무관하게 서는 장면 층 — 방호시설 · 하천 · 발화점 · 관측소 · 위험지도 (model/scene.ts) */
  scene?: SceneLayer[];
  /** 보조 분석뷰 · 종단도 (B) */
  profile?: SceneProfile;
  /** 보조 분석뷰 · 계통도 (G) */
  system?: SceneSystem;
  /** 조건 요약 카드 — 없으면 날씨 카드 */
  conditions?: ConditionLine[];
  /** 대응 시점 — "통제 시점 17:50". 도달 시각과의 여유가 결정의 핵심이라 시간 줄·비교표가 세운다 */
  actionAt?: { label: string; at: string };
  /** 가정 한 문장 — "해안도로 저지대 구간을 17:50부터 통제하는 경우". 대응 버튼은 이 가정의 미리보기다 */
  hypothesis?: string;
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
