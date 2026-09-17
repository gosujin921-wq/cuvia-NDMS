/* ─────────────────────────────────────────────
 * I0 규칙표 — 복합 알림 규칙표 · 위험도 매트릭스 표
 * 정본: README §7 (I0 규칙표 두 개), 01 §6.1 · §6.2, 02 §5.2.1 · §5.2.2
 *
 * ★ 전부 데모 시나리오 조건이다(`demoValue: true`). 운영 수치·가중치·등급 경계가 아니며 실제
 *   운영 기준처럼 쓰지 않는다. 원본 명세가 오면 같은 계약의 값만 교체한다(replacementNote).
 * ───────────────────────────────────────────── */

import type { AlertRule } from "../../model/alert";
import type { RiskMatrixSpec } from "../../model/risk-matrix";

export const ALERT_RULES: AlertRule[] = [
  {
    ruleId: "AR-WATCH", ruleVersion: "0.1", kind: "공식 상황", demoRole: "사전 감시 알림",
    inputs: ["E1 FORECAST_UPDATED(예측강우)", "E2 OFFICIAL_ALERT_CHANGED", "E3a FORECAST_UPDATED(조위)", "침수흔적·배수취약성(기준 데이터)"],
    condition: "예측강우 최대 ≥ 15 mm/h 이고 호우특보 발효, 만조가 예측 강우 정점 ±3시간 안. 취약 배수권역에 한함",
    windowMin: 180, spatialScope: "배수권역", qualityCondition: "예측 유효시간 안", grade: "주의", suppressionMin: 120,
    releaseCondition: "특보 해제 또는 예측강우 하향", createsIncident: false, demoValue: true,
    replacementNote: "취약성 지도·감시 기준은 기관 기준 확보 시 교체",
  },
  {
    ruleId: "AR-COMPOSITE", ruleVersion: "0.1", kind: "복합 징후", demoRole: "복합 징후 알림",
    inputs: ["E4b RATE_CHANGED", "E5a OBSERVATION_RECORDED(도로수위)", "E8 FORECAST_UPDATED", "E6a FACILITY_STATE_CHANGED"],
    condition: "같은 배수권역·15분 창에서 관로 변화율 ≥ 30 cm/10분 이고 (도로수위 상승 또는 침수예측 도달 ≤ 60분). 펌프 가용 저하는 등급 상향",
    windowMin: 15, spatialScope: "배수권역", qualityCondition: "관로수위 정상 품질", grade: "경계", suppressionMin: 30,
    releaseCondition: "사건 후보 생성 시 사건으로 이관", createsIncident: true, demoValue: true,
  },
  {
    ruleId: "AR-SCENE", ruleVersion: "0.1", kind: "복합 징후", demoRole: "영상 교차확인 알림",
    inputs: ["E7 SCENE_ANALYZED", "E4b", "E5b", "E8"],
    condition: "VLM 신뢰도 ≥ 0.7 의 물고임·침수 장면이 기존 징후와 같은 공간·30분 안",
    windowMin: 30, spatialScope: "카메라 시야 · 배수권역", qualityCondition: "영상 수신 정상", grade: "경계", suppressionMin: 20,
    releaseCondition: "담당자 확인·오탐 결정", createsIncident: false, demoValue: true,
    replacementNote: "실제 VLM 결과·신뢰도 기준은 모델 확정 시 교체",
  },
  {
    ruleId: "AR-FORECAST", ruleVersion: "0.1", kind: "예측 영향", demoRole: "예측 영향 알림",
    inputs: ["E8 FORECAST_UPDATED(기준·대안)"],
    condition: "예상 최대 침수심 ≥ 0.2 m 또는 도로·중요시설 도달 ≤ 60분, 또는 갱신판이 이전 판과 도달시각 ±20분 차이",
    windowMin: 0, spatialScope: "영향 폴리곤", qualityCondition: "Forecast 가용", grade: "경계", suppressionMin: 30,
    releaseCondition: "예측판 만료·갱신", createsIncident: true, demoValue: true,
    replacementNote: "영향 기준은 검증 모델 확보 시 교체",
  },
  {
    ruleId: "AR-QUALITY", ruleVersion: "0.1", kind: "품질·연계", demoRole: "품질·대체 확인 알림",
    inputs: ["E10 DATA_QUALITY_CHANGED", "MODEL_RUN_FAILED", "시설 미응답"],
    condition: "판단에 쓰는 원천이 ≥ 5분 결측·지연이거나 모델 실패. 현재 사건·예측에 영향을 줄 때",
    windowMin: 5, spatialScope: "해당 원천", qualityCondition: "해당 없음", grade: "주의", suppressionMin: 15,
    releaseCondition: "수신 복구", createsIncident: false, demoValue: true,
  },
];

export const RISK_MATRIX_SPEC: RiskMatrixSpec = {
  ruleId: "RM-FLOOD", ruleVersion: "0.1",
  indicators: [
    { indicator: "수위·변화율", inputs: ["E4a", "E4b", "E5a", "E5b"], weight: 0.3, missingHandling: "관로·도로 한쪽 결측이면 남은 쪽으로 구간 산정, 확실성 1단계 하향", demoValue: true,
      bands: [{ label: "정상", score: 0.1, criterion: "변화율 < 10 cm/10분, 도로 0 cm" }, { label: "상승", score: 0.5, criterion: "변화율 ≥ 10 cm/10분 또는 도로 > 0" }, { label: "급상승·기준 진입", score: 0.85, criterion: "변화율 ≥ 30 cm/10분 또는 도로 ≥ 8 cm" }, { label: "만관·침수", score: 1, criterion: "관로 ≥ 2.6 m 또는 도로 ≥ 20 cm" }] },
    { indicator: "강우·공식 상황", inputs: ["E0", "E1", "E2"], weight: 0.2, missingHandling: "실측 결측이면 예측강우로 대체, 확실성 하향", demoValue: true,
      bands: [{ label: "약함", score: 0.1, criterion: "< 5 mm/h · 특보 없음" }, { label: "주의보", score: 0.5, criterion: "≥ 5 mm/h 또는 호우주의보" }, { label: "경보", score: 0.8, criterion: "≥ 15 mm/h 예측 또는 호우경보" }, { label: "극한", score: 1, criterion: "≥ 30 mm/h" }] },
    { indicator: "영상·현장", inputs: ["E7", "E9"], weight: 0.15, missingHandling: "영상 없음은 0 이 아니라 미확인 · 확실성 하향", demoValue: true,
      bands: [{ label: "이상 없음", score: 0.1, criterion: "물고임 미검출" }, { label: "물고임 추정", score: 0.6, criterion: "VLM 신뢰도 ≥ 0.7" }, { label: "침수 확인", score: 1, criterion: "현장 보고 통행 불가" }] },
    { indicator: "시설·배수 여건", inputs: ["E3a", "E3b", "E6a", "E6b"], weight: 0.15, missingHandling: "시설 상태 미수신은 마지막 상태 유지 · 확실성 하향", demoValue: true,
      bands: [{ label: "양호", score: 0.1, criterion: "펌프 전량 가동 · 저조" }, { label: "제약", score: 0.6, criterion: "펌프 1대 정지 또는 만조 ±2시간" }, { label: "심각 제약", score: 1, criterion: "펌프 2대 이상 정지 · 저류 여유 < 20 %" }] },
    { indicator: "디지털트윈 예측", inputs: ["E8"], weight: 0.15, missingHandling: "예측 없음은 0 이 아니라 미평가 · 확실성 하향", demoValue: true,
      bands: [{ label: "영향 없음", score: 0.1, criterion: "최대 침수심 < 0.1 m" }, { label: "통행 지장", score: 0.6, criterion: "0.1 ~ 0.3 m 또는 도달 ≤ 60분" }, { label: "통행 불가·시설 영향", score: 1, criterion: "≥ 0.3 m 또는 중요시설 도달" }] },
    { indicator: "품질", inputs: ["E10"], weight: 0.05, missingHandling: "품질 지표는 위험을 낮추지 않고 확실성만 낮춘다", demoValue: true,
      bands: [{ label: "정상", score: 0, criterion: "결측·지연 없음" }, { label: "일부 지연", score: 0.5, criterion: "핵심 원천 1개 지연" }, { label: "결측", score: 1, criterion: "핵심 원천 결측" }] },
  ],
  gradeThresholds: [{ grade: "관심", minScore: 0 }, { grade: "주의", minScore: 0.35 }, { grade: "경계", minScore: 0.55 }, { grade: "심각", minScore: 0.8 }],
  replacementNote: "제품 자료의 다지표 가중 분석 기준으로 구성한 데모 설정값. 가중치·구간·경계는 실증 데이터로 교체",
};
