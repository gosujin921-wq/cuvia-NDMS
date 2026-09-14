/* ─────────────────────────────────────────────
 * 위험도 매트릭스 — 정본: 01 §6.2, 02 §5.2.2, README §7 "I0 위험도 매트릭스 표"
 *
 * 제품 자료의 `복합 위험도 분석(다지표 가중)` 을 기준으로 수위·강우·영상 맥락을 중심에 두고
 * 시설·Forecast·품질을 함께 평가한다. 일반적인 발생가능성×영향도 표로 치환하지 않는다.
 *
 * 결측·지연·의심 데이터는 0 으로 넣어 위험을 낮추지 않는다 — 확실성을 낮추고 품질 알림으로 잇는다.
 * 가중치·구간·등급 경계는 데모 설정값이다(`demoValue`). 실제 운영 기준처럼 쓰지 않는다.
 *
 * 4축(심각도·긴급도·확실성·추세)은 별도 최종등급이 아니라 이 결과의 설명이다(HazardAssessment).
 * ───────────────────────────────────────────── */

/** 입력군 (02 §5.2.2 표) */
export type MatrixIndicator = "수위·변화율" | "강우·공식 상황" | "영상·현장" | "시설·배수 여건" | "디지털트윈 예측" | "품질";

export type RiskGrade = "관심" | "주의" | "경계" | "심각";

/** 지표 구간 하나 — 값 범위 → 구간 점수 */
export interface MatrixBand {
  label: string;
  /** 구간 점수 0~1 */
  score: number;
  criterion: string;
}

/** 매트릭스 설정 한 지표 (README §7 표: 입력 지표·가중치·구간·결측 처리) */
export interface MatrixIndicatorSpec {
  indicator: MatrixIndicator;
  /** 대표 이벤트 (E4a·E4b …) */
  inputs: string[];
  /** 가중치 — 합 1.0 */
  weight: number;
  bands: MatrixBand[];
  /** 결측·지연 처리 — 0 으로 두지 않는다 */
  missingHandling: string;
  demoValue: boolean;
}

export interface RiskMatrixSpec {
  ruleId: string;
  ruleVersion: string;
  indicators: MatrixIndicatorSpec[];
  /** 등급 경계 — 점수 하한 */
  gradeThresholds: { grade: RiskGrade; minScore: number }[];
  replacementNote: string;
}

/** 지표별 기여도 — 화면이 "무엇이 위험을 만들었나"를 보이는 자리 */
export interface MatrixContribution {
  indicator: MatrixIndicator;
  /** 적용된 구간 */
  band: string;
  bandScore: number;
  weight: number;
  /** weight × bandScore */
  contribution: number;
  /** 근거 이벤트 */
  evidenceEventIds: string[];
  /** 결측·지연으로 확실성이 깎였는가 */
  degraded: boolean;
}

/** 매트릭스 결과 (01 §6.2 출력) */
export interface RiskMatrixResult {
  ruleId: string;
  ruleVersion: string;
  computedAt: string;
  /** 0~1 */
  score: number;
  grade: RiskGrade;
  contributions: MatrixContribution[];
}
