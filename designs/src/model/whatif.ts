/* ─────────────────────────────────────────────
 * 사건 기반 디지털트윈 — 사건의 시간·공간 탐색과 대안 분석 준비물 (03 §25 · §26 · README §2.2 · 2026-09-16 확정)
 *
 * 정의: 독립 디지털트윈은 발생한 사건의 시간·공간 상태를 탐색하는 분석 공간이다. 진행 중 사건은 현재까지의 실제 상태와
 * 향후 전망을, 종료 사건은 실제 진행을 재현하며, 필요하면 사건의 상황 조건 또는 대응 조건을 바꿔 대안 결과를 비교한다.
 * "발생한 사건"에는 피해 전 예측으로 생긴 사건도 들어간다. 사건 없이 지역·날짜·강우부터 새로 만드는 시뮬레이션은 없다.
 *
 *   본체      사건 진행(기록) 위를 시간으로 훑는다 — 진행 중은 기록 | 지금 | 전망, 종료는 기록 전체(재현)
 *   확장      필요할 때만 조건을 바꾼다 — 상황 조건(사람이 조작하지 못한 환경·시설 상태) · 대응 조건(시점·수준·범위)
 *
 * ★ 비교의 기준 — 진행 중은 기준 전망, 종료는 기준 재현(실제 대응을 넣어 같은 방식으로 다시 계산한 것).
 *   실제 기록(관측·사후 조사)은 참고값이다. 효과 차이는 늘 같은 계산 방식끼리의 차이다(기록 − 계산을 빼지 않는다).
 *   규칙으로 내는 노출(진입 차량·잔류 인원)은 같은 기록에 조치 시각만 바꿔 적용하므로 기록 기반 비교가 그대로 선다.
 * ★ 현상을 바꾸는 대응과 상황 조건은 사전 계산 판을 고른다. 노출 대응은 규칙이다(fixtures/exposure.ts). 후행 피해(신고·부상·피해액)는 결과로 쓰지 않는다.
 * ★ 상황과 대응은 함께 고를 수 있다(2026-09-16 사용자 "같이 선택할 수 있어야"). 둘 다 고르면 비교가 세 칸이다 —
 *   실제(기준) → 상황만 바꾼 판 → 그 상황에서 대응도 바꾼 판. 칸마다 한 가지씩만 달라져 차이가 어느 쪽 때문인지 섞이지 않는다.
 *   가장 쓸모 있는 질문이 "상황이 나빠졌을 때 이 대응으로 버티나"라서다.
 * ★ 대안은 트윈에 유의미해야 한다 — 결과가 트윈이 계산한 도달·범위·파급에 달린 것만 둔다. 일찍 할수록 그만큼 줄어드는 산수(쉼터 연장·순회)는
 *   대안이 아니다. 유의미한 대응이 없는 사건은 트윈에 두지 않는다(2026-09-16 · 폭염 제외).
 *   바꿀 수 있는 목록 = 유형별 허용 조건 ∩ 사건 범위의 가용 시설·대응 ∩ 모델·규칙 입력.
 * ───────────────────────────────────────────── */

import type { AlternativeId } from "./forecast";
import type { HazardKind, TwinFamily } from "./incident";
import type { SpatialRef } from "./event";

export type WhatIfStatus = "진행 중" | "종료";

/** 사건 진행의 한 줄 — 타임라인 표식이자 목록. 실제 대응도 여기 선다(진행과 대응을 한 타임라인에) */
export interface RecordEntry {
  at: string;
  label: string;
  kind: "관측" | "예측" | "대응" | "영향";
  /** 분석 기준(▲)으로 고를 수 있는 판단 시점인가 — 원장이 남긴 주요 시점만 고른다. 아무 시각이나 입력하지 않는다(03 §26.2) */
  decision?: boolean;
}

/** 조정값 선택지 — 시각만 말하지 않고 지금·실제 대응과의 관계로 말한다("10분 뒤" · "10분 일찍" · "1등급 12동") */
export interface WhatIfPreset {
  id: string;
  label: string;
  /** 조치 시각 — 시점을 바꾸는 대응이면 선택지마다 다르고, 범위·수준을 바꾸는 대응이면 모두 같다 */
  at: string;
  /** 범위·수준을 바꾸는 선택지의 값 */
  value?: string;
  /** 이 선택의 대안 판. null 이면 기준 그대로(종료 사건의 "실제") */
  forecastId: string | null;
}

/**
 * 대응 조건 — 언제 · 어디에 · 어느 수준. 세 줄을 늘 보이고, Phase 2 는 그중 하나(adjust)만 바꾼다.
 * 현상 대응은 사전 계산 판 선택지다. 노출 대응은 규칙이라 모델 없이 선다.
 */
/**
 * 대응의 성격 (03 §26.3 · 2026-09-16).
 *   현상  재난 자체를 바꾼다. 수위·도달·범위가 달라진다 (방류 · 배수 · 수문 · 방화선 · 비상전원)
 *   노출  사람·차량이 덜 닿게 한다. 대상 상태와 도달 전 여유만 달라진다 (통제 · 대피 · 쉼터 · 순회)
 * **훈련이 묻는 것은 그 유형의 현상 대응이다.** 노출 대응으로 물으면 결과가 "여유 n분"뿐이라 읽히지 않는다.
 * 현상 대응이 없는 유형(E 폭염)은 훈련 시나리오를 만들 수 없다.
 */
export type ResponseKind = "현상" | "노출";

export interface WhatIfResponse {
  responseId: AlternativeId;
  /** 현상을 바꾸나, 노출만 바꾸나 (03 §26.3) */
  kind: ResponseKind;
  /** 어디에 */
  target: string;
  /** 어느 수준 */
  level?: string;
  /** 바꿀 수 있는 줄 */
  adjust: "when" | "where" | "level";
  /** 선택지를 읽는 기준 — 진행 중 "침수 예상 17:52"(선택지는 지금 기준), 종료 "실제 방류 15:05"(선택지가 이 시각 기준) */
  anchor: { label: string; at: string };
  presets: WhatIfPreset[];
  /**
   * **이 조치가 무엇을 바꾸나** — 훈련의 조치 카드가 고를 이유로 적는다(03 §26.5).
   *
   * 화면이 `kind` 로 문장을 지으면 유형이 어긋난다. 노출 대응이라고 다 "도달까지의 여유"가 아니다 —
   * 폭염의 쉼터 연장은 도달이 아니라 **갈 곳 없는 시간**을 줄인다(2026-09-17).
   * 비우면 화면이 `kind` 기준의 기본 문장을 쓴다.
   */
  effect?: string;
  /** 결과를 어떻게 냈나 — 근거·저장·보고서가 그대로 적는다 */
  method: string;
}

/**
 * 상황 부여 — 훈련 시간표에 던져 넣는 상황 (README §2.3 기준 ③ · 03 §26.6 · HSEEP MSEL).
 * 결과 값을 낼 경로가 없는 조건은 수치를 만들지 않고 "이 시각에 이런 상황이 들어온다"로만 선다.
 * 계산 결과처럼 보이게 하지 않는다 — 판이 있는 조건은 `WhatIfSituation` 이다.
 */
export interface WhatIfInject {
  id: string;
  at: string;
  /** "하구 배수펌프장 정전" */
  label: string;
  /** 그래서 무엇이 달라지는가 — 담당자가 판단할 상황. 수치는 적지 않는다 */
  detail: string;
}

/** 상황 조건 — 사람이 조작하지 못한 환경·시설 상태의 변화. 사전 계산 시나리오만 고른다(자유 입력 없음) */
export interface WhatIfSituation {
  situationId: string;
  /** "강우 예보 +20%" */
  label: string;
  /**
   * 같은 조건의 세기 단계를 묶는 이름 — "강우 상향". 묶이면 화면에서 카드 하나에 단계 칩으로 선다.
   * 단계가 셋을 넘으면 칩 대신 단계 스냅 슬라이더로 바꾼다. 판이 없는 값에는 멈추지 않는다(2026-09-16).
   */
  group?: string;
  /** 그 묶음 안에서의 단계 이름 — "+20%" · "+50%" */
  step?: string;
  /** "19시 최대 17.8 → 21.4 mm/h" */
  detail: string;
  /** 진행 중 사건 — 지금부터 갈리는 판 하나 */
  forecastId?: string;
  /**
   * 종료 사건 — 분석 기준(▲, 원장의 판단 시점)마다 사전 계산한 판. 실제 사건은 기준으로 두고 그 시점부터 상황만 바꾼 다른 진행이다.
   * 판이 없는 분석 기준에서는 고를 수 없다(아무 시각이나 계산하지 않는다).
   */
  byBasis?: { at: string; forecastId: string }[];
  method: string;
}

/**
 * 훈련이 보는 조치 — SOP 항목 하나 (README §2.3 규칙 1·2 · 03 §26.3).
 *
 * 대응 목록을 사건마다 손으로 적지 않는다. 규정(SOP)이 무엇을 할지 정하고, 센서 임계가 언제 뜰지 정한다.
 * 훈련 지표는 **발동에서 조치까지 걸린 시간** 하나다 — 두 시각 모두 원장에서 나오므로 근거가 있다.
 * 실개발에서는 SOP 카탈로그와 사건 원장이 이 값을 준다. 데모는 사건 fixture 가 같은 모양으로 적는다.
 */
export interface WhatIfSopItem {
  /** "S3" — 화면 표기와 저장에 쓰는 짧은 이름 */
  id: string;
  label: string;
  /** 발동 근거가 된 센서 임계 한 줄 — "합류부 기준 수위 2.5 m 도달 예측" */
  trigger: string;
  /** 발동 시각 — 그 임계를 알린 원장의 관측·예측 시각 */
  firedAt: string;
  /** 실제로 한 시각. 없으면 하지 않은 것이다 */
  actedAt?: string;
  /** 이 항목을 바꿔 보는 대응(있으면 시간표의 대안과 이어진다) */
  responseId?: AlternativeId;
}

/**
 * 훈련 준비물 (03 §26.2·§26.4 · 2026-09-16).
 * 이것이 있는 사건만 훈련할 수 있다. 없으면 목록에서 "훈련 시나리오 없음"으로 서고 조용히 대체하지 않는다.
 */
export interface TrainingScenario {
  incidentId: string;
  /**
   * 정지점 — 새로 결정할 일이 생기는 시각. 시계는 여기서만 선다.
   *   판단  조치를 정한다. 사람의 시간이라 자동으로 넘어가지 않는다
   *   결과  조치 창이 닫히고 결과가 나온다. 시간이 스스로 흐른다
   * 조치 가능 시각은 여기 적지 않는다 — 조합 판이 정본이고 정지점과 겹치는 것만 화면에 뜬다.
   */
  stops: { at: string; phase: "판단" | "결과"; note: string }[];
  /** 훈련 시작 전에 고르는 조건. 단계마다 상황 판을 가리키고, `situationId` 가 null 이면 당시 조건 그대로 */
  conditions: {
    id: string;
    label: string;
    /**
     * 이 조건이 바꾸는 상태 줄의 이름 — 훈련 중 그 줄을 배율로 환산해 보인다.
     * 강우를 +20%로 훈련하는데 강우계가 당시 값 그대로면 모순이다. 지어내는 것이 아니라
     * **조건의 정의가 "당시 강우 × 1.2"** 이므로 그 값이 화면에 서는 것이 맞다(2026-09-16 사용자).
     */
    stateLabel?: string;
    steps: {
      id: string;
      label: string;
      detail: string;
      situationId: string | null;
      /** 당시 값에 곱하는 배율. 1 이면 당시 그대로 */
      factor?: number;
    }[];
  }[];
  /** 이 훈련에서 발동하는 규정 (WhatIfSopItem.id) */
  firedSopIds: string[];
  /**
   * 결과 판을 가르는 조치 — 이 조치들의 시각 조합마다 사전 작성 판이 있다.
   * 결과판이 없는 조치(창원천 S1 둔치 통제)는 여기 넣지 않는다. 조치 시각은 기록되지만 결과를 바꾸지 않는다.
   */
  resultSopIds: string[];
  /**
   * 조건 × 조치 조합의 결과 판. 빌드 때 규칙으로 생성한다(03 §26.10).
   * `acts` 에 없는 조치는 **실제와 같은 시각에 한 것**이다(안 한 판을 따로 만들지 않는다).
   */
  combos: { conditionStepId: string; acts: Record<string, string>; forecastId: string }[];
}

/**
 * 훈련 한 회의 기록 (03 §26.9 · 2026-09-16).
 * `AnalysisResult`(사건 작업공간 전망 탭의 대안 분석 한 건)와 다른 물건이다. 섞지 않는다.
 * ★ 판 id 와 보고서용 표시값을 **둘 다** 담는다 — id 만 두면 판을 고치거나 모델을 교체할 때
 *   과거 훈련 결과가 소급해서 바뀌어 "그때 이렇게 나왔다"는 기록이 아니게 된다.
 */
export interface TrainingRun {
  runId: string;
  incidentId: string;
  incidentTitle: string;
  /** 고른 조건 단계 id. 당시 조건이면 비어 있다 */
  conditionStepIds: string[];
  conditionLabel: string;
  /** 훈련 구조 — 그 회가 지나온 정지점. 시나리오를 고쳐도 지난 보고서가 안 바뀐다 */
  stops: { at: string; phase: string; note: string }[];
  /**
   * 발동한 규정 전부. **안 한 것도 담는다** — "안 함"도 훈련의 결과다.
   * 내가 실행한 것만 보려면 `mineAt` 이 있는 줄을 고른다(목록·보고서가 같은 줄을 읽는다).
   */
  sopRows: {
    id: string;
    label: string;
    firedAt: string;
    /** 내가 실행한 시각. 안 했으면 null(실제와 같은 시각에 한 것으로 본다) */
    mineAt: string | null;
    /** 발동에서 내 조치까지(분). 안 했으면 null */
    mineLagMin: number | null;
    /** 발동에서 실제 조치까지(분). 원장에 없으면 null */
    realLagMin: number | null;
  }[];
  /** 내 조치가 만든 판 · 같은 조건에서 실제와 같게 했을 때의 판 */
  resultForecastId: string;
  baselineForecastId: string;
  /** 보고서가 그대로 쓰는 저장 시점의 값 */
  rows: { label: string; base: string; mine: string }[];
  headline: string;
  /** 마지막 정지점의 상태 — 훈련이 끝났을 때 무엇이 어떠했나 */
  stateRows: { label: string; value: string }[];
  improvements?: { axis: ImprovementAxis; text: string }[];
  /** 저장 시점의 지도 한 장(dataURL). 숫자만으로는 "그때 어땠는지"가 안 남는다 */
  mapImage?: string;
  author: string;
  startedAt: string;
  finishedAt: string;
}

export interface WhatIfCase {
  incidentId: string;
  title: string;
  hazardKind: HazardKind;
  twinFamily: TwinFamily;
  scope: SpatialRef;
  /** Phase 1 지구 — 장비 핀·날씨 카드가 문다 */
  legacyDistrictId?: string;
  occurredAt: string;
  /** 종료 사건이면 종료 시각. 진행 중 여부는 원장에서 읽는다(selectors.whatIfStatusOf) */
  closedAt?: string;
  /** 진행 중 사건의 준비물이 열리는 시각 — 그 전에는 사건 목록에 서지 않는다 */
  availableFrom?: string;
  /** 사건 진행 — 관측 · 당시 예측 · 대응 · 영향. 진행 중 사건은 지금까지만 보인다 */
  record: RecordEntry[];
  /**
   * 기록 구간의 지도 — 관측과 재현 계산(관측 입력으로 다시 돌린 범위). 예측판을 기록 구간에 그리지 않는다.
   * 종료 사건은 이것이 비교의 기준(기준 재현)이고, 진행 중 사건은 지금 이전 구간만 쓴다.
   */
  reconstructionForecastId: string;
  /** 진행 중 사건의 기준 전망 — 지금 이후 구간과 비교의 기준 */
  forecastId?: string;
  /** 시각별 상태 줄 — 과거 사건의 복원값. 없으면 원장에서 읽는다 */
  stateByTime?: { at: string; rows: { label: string; value: string }[] }[];
  /** 실제 기록(참고) — 관측·사후 조사 값. 효과 차이 계산에는 쓰지 않는다 */
  observed?: { label: string; value: string }[];
  /** 규정 — 센서 임계가 띄운 조치. 훈련의 지표(발동 → 조치)가 여기서 나온다 */
  sop?: WhatIfSopItem[];
  /** 훈련 준비물 — 있는 사건만 훈련할 수 있다(03 §26.2) */
  training?: TrainingScenario;
  responses: WhatIfResponse[];
  situations?: WhatIfSituation[];
  /** 판이 없는 상황 — 시간표에 전개로만 선다(§26.6) */
  injects?: WhatIfInject[];
  /** 상황과 대응을 함께 바꾼 판 — 상황 판(분석 기준마다 하나)에 대응 선택지를 얹어 사전 계산했다. 없는 조합은 고를 수 없다 */
  combos?: WhatIfCombo[];
}

/**
 * 개선 항목 — 훈련의 산출물 (README §2.3 · IA §10.1 · 03 §26.8).
 * 사람이 비교를 보고 적는다. 시스템이 문장을 짓지 않는다.
 * 축에 `모델`은 없다 — 시뮬레이션 결과로 모델을 고치면 자기 출력을 되먹는다. 모델 축은 예측 검증에서만 나온다.
 */
export type ImprovementAxis = "임계치" | "데이터" | "SOP";

export interface ImprovementItem {
  id: string;
  incidentId: string;
  axis: ImprovementAxis;
  /** 사람이 쓴 한 줄 */
  text: string;
  /** 어디서 나왔나 — `훈련`(모의훈련) · `검증`(예측 케이스) */
  source: "훈련" | "검증";
  /** 근거 — 어느 시점의 어떤 조건을 보다가 적었나. 자동으로 붙는다 */
  context: string;
  author: string;
  createdAt: string;
}

export interface WhatIfCombo {
  /** 어느 상황 판 위인가 — 종료 사건은 분석 기준마다 판이 달라 판 id 로 잇는다 */
  situationForecastId: string;
  responseId: AlternativeId;
  presetId: string;
  forecastId: string;
}

/**
 * 분석 결과 — 대안 분석 한 건의 저장 단위 (03 §26.9).
 * 결과 숫자만 남기지 않는다. 다시 열 수 있게 사건 · 분석 기준 · 기준 · 바꾼 조건 · 결과 · 산출 방식을 함께 남긴다.
 * 값은 저장 시점의 판 그대로다 — 저장하면서 새 숫자를 만들지 않는다.
 */
export interface AnalysisResult {
  analysisId: string;
  /** 분석명 — 저장할 때 사람이 쓴다. 비우면 사건·조건으로 만든 기본값 */
  name: string;
  memo?: string;
  author: string;
  savedAt: string;
  incidentId: string;
  incidentTitle: string;
  incidentStatus: WhatIfStatus;
  hazardName: string;
  twinFamily: TwinFamily;
  regionLabel: string;
  /** 분석 기준(▲) — 진행 중은 분석한 시각(지금), 종료는 고른 판단 시점 */
  basisAt: string;
  /** "범람 예측 발생" · "지금" */
  basisLabel: string;
  /** 분석 기준의 상태 줄 */
  stateRows: { label: string; value: string }[];
  /** 종료 사건의 실제 대응 — 사건 진행에서 뽑는다 */
  actualResponses?: { label: string; at: string }[];
  /** 실제 기록(참고) — 종료 사건만 */
  observed?: { label: string; value: string }[];
  /** 저장 당시 보던 시각 */
  validAt: string;
  /** 기준 요약 — 도달 · 핵심 지표 · 영향 대상 */
  baselineRows: { label: string; value: string }[];
  arrivalText: string;
  /** 바꾼 조건 — 상황만 · 대응만 · 상황과 대응. 상황과 대응을 함께 바꾸면 비교가 세 칸이다(기준 → 상황 → 상황+대응) */
  kind: "대응" | "상황" | "상황·대응";
  situation?: {
    id: string;
    /** "강우 악화" */
    label: string;
    /** "14:35부터 당시 강우 +20% · 35 → 42 mm/h" */
    detail: string;
    method: string;
  };
  response?: {
    id: string;
    label: string;
    /** "10분 일찍" · "강우 예보 +20%" */
    presetLabel: string;
    at: string;
    /** 선택지를 읽는 기준 — "실제 방류 15:05" · "분석 시점 17:44" */
    anchor: string;
    target: string;
    level?: string;
    effect: "현상 감소" | "노출 감소" | "변화 없음";
    /** 결과를 어떻게 냈나 */
    method: string;
  };
  /** 비교 열의 이름 — "그대로" · "실제(재현)" | (상황과 대응을 함께 바꾸면) "강우 악화" | "10분 일찍 14:55" */
  baseLabel: string;
  midLabel?: string;
  altLabel: string;
  /** 달라진 지표만 — 기준 | (상황) | 대안 */
  compareRows: { label: string; base: string; mid?: string; alt: string }[];
  /** 그대로인 지표 이름 — "침수심은 동일" 을 말하려고 남긴다 */
  unchanged: string[];
  /** 요약 한 줄 */
  headline: string;
  /** 이 분석에서 남긴 개선 항목 — 저장 시점의 것만 담는다 */
  improvements?: { axis: ImprovementAxis; text: string }[];
  restore: { incidentId: string; basisAt: string; situationId: string | null; responseId: string | null; presetId: string | null; validAt: string };
  /** 저장 순간의 지도 한 장 — 보고서에서만 쓴다 */
  mapImage?: string;
}
