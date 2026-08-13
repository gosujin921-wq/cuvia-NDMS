/* ─────────────────────────────────────────────
 * 분석 조건과 영향 결과 — 정본: docs/정본/04_데모_데이터.md §10 · §12
 *
 * SCR-05 는 "물을 올려보는 화면"이 아니라 "사건 조건을 바꿔 공간 영향과 대응 대상을
 * 비교하는 화면"이다. 그래서 축을 둘로 가른다.
 *
 *   조건 (ConditionSpec)  재난유형마다 다르다. 해일은 수위, 호우는 강우 지속시간,
 *                         화학 누출은 풍향·풍속 — 조절할 변수 자체가 그 유형의 정체성이다.
 *                         공통 슬라이더 하나로 뭉치면 유형을 늘릴 때 화면을 다시 짜야 한다.
 *   영향 (ImpactResult)   재난유형이 달라도 같다. 범위·인구·건물·도로·대피 대상은
 *                         무엇이 덮치든 대응이 물어보는 것이 같기 때문이다.
 *
 * 유형을 하나 늘리는 일 = CONDITION_SPECS 에 한 줄 + impactAt 에 분기 하나 +
 * 조건 패널 부품 하나. 화면(DigitalTwinPage)과 3D 씬(lib/flood-scene.ts)은 손대지 않는다.
 *
 * ★ 등재되지 않은 유형은 비워 둔다. 04 에 조건표·영향표가 없는 유형에 슬라이더를 세우면
 *   숫자가 근거 없이 움직인다 — 화면은 "아직 등재되지 않음"으로 정직하게 선다.
 * ───────────────────────────────────────────── */

import { EVENTS, HAZARD_ORDER, type HazardType } from "./events";
import { floodImpactAt } from "./flood-impact";
import { HERO_SCENARIO, type ScenarioTerm, type TideScenario } from "./forecast";
import { WATER_THRESHOLDS, type WaterThreshold } from "./levels";

/* ── 진입 모드 ───────────────────────────────────────── */

/**
 * 트윈은 사건에 종속된 화면이 아니다 (02 §2 · 03 §5).
 *
 *   event  사건 연계 분석 — SCR-02 에서 사건을 들고 들어온다. 기준 조건은 실시간 계측이고,
 *          결과는 그 사건에 붙어 SCR-02 의 대응 판단·SOP 대상을 구체화한다.
 *   drill  사전 모의분석 — 메뉴로 직접 들어오거나 진행 중 사건이 없는 지구를 연다. 기준
 *          조건은 사용자가 세우고, 결과는 모의분석안으로만 남는다.
 *
 * ★ drill 의 결과는 사건 판단·대응 등급·타임라인·전파 원장 어디에도 닿지 않는다. 훈련으로
 *   만든 숫자가 실제 사건 이력에 섞이면 SCR-04 집계와 사후 분석이 통째로 오염된다.
 */
export type AnalysisMode = "event" | "drill";

/**
 * 이 지구에서 다룰 수 있는 재난유형 — 원장(04 §4)에 그 지구 사건으로 등재된 유형이다.
 *
 * 지구 성격(해일·내수·하천)에서 역산하지 않는다. 역산은 그럴듯한 목록을 만들지만 근거가
 * 없고, 원장은 "이 지구에서 실제로 난 일"이라 목록의 출처가 분명하다.
 */
export function hazardTypesOf(districtId: string): HazardType[] {
  const found = new Set(
    EVENTS.filter((event) => event.districtId === districtId).map((event) => event.hazardType),
  );
  return HAZARD_ORDER.filter((type) => found.has(type));
}

/* ── 조건 ────────────────────────────────────────────── */

/**
 * 재난유형별 조절 변수 한 벌.
 *
 * 지금 등재된 것은 수위 계열(폭풍해일·하천범람·내수침수) 하나뿐이다. 셋이 한 벌을 쓰는
 * 것은 조절 대상이 같은 물리량(EL.m 수면 표고)이고 3D 씬의 수면 하나가 함께 움직이기
 * 때문이지, 셋을 같은 재난으로 보기 때문이 아니다.
 */
export interface ConditionSpec {
  /** 조건 패널 부품 선택 키 — 유형이 늘면 여기에 값이 하나 는다 */
  kind: "water-level";
  /** 패널 제목 — "침수 예상 수위" */
  title: string;
  /** 값 단위 — "EL.m" */
  unit: string;
  min: number;
  max: number;
  step: number;
  /** 지구별 발령 기준 — 슬라이더 아래 "지금 어느 구간인가" */
  threshold: WaterThreshold;
}

/**
 * 수위 계열 조건 (04 §9) — 상한 6 EL.m, step 0.01.
 *
 * step 이 0.01 인 것은 정본 수치(3.41 · 4.24)를 손으로도 맞출 수 있어야
 * "시나리오 값은 조건 축 위의 한 점"이라는 말이 성립하기 때문이다(03 §5 · 차수 K).
 */
const WATER_LEVEL_HAZARDS: HazardType[] = ["폭풍해일", "하천범람", "내수침수"];
const WATER_LEVEL_MAX = 6;

/**
 * 이 지구·이 재난유형의 조건 한 벌. 등재되지 않은 유형은 null —
 * 조건 패널이 "아직 등재되지 않음"으로 선다.
 */
export function conditionSpecOf(districtId: string, hazardType: HazardType): ConditionSpec | null {
  if (!WATER_LEVEL_HAZARDS.includes(hazardType)) return null;
  const threshold = WATER_THRESHOLDS[districtId];
  if (!threshold) return null;
  return {
    kind: "water-level",
    title: "침수 예상 수위",
    unit: "EL.m",
    min: 0,
    max: WATER_LEVEL_MAX,
    step: 0.01,
    threshold,
  };
}

/**
 * 발령 기준 프리셋 (04 §3) — 사전 모의분석의 조건 축 위 세 점.
 *
 * 사건 연계는 "지금 3.41 / 만조 4.24"라는 실제 값을 프리셋으로 쓰지만, 모의분석에는
 * 관측이 없다. 대신 이 지구가 발령을 내는 세 지점이 계획·훈련이 물어보는 조건이다 —
 * "대피 기준까지 가면 몇 동, 몇 명인가".
 */
export function thresholdPresetsOf(threshold: WaterThreshold): { label: string; value: number }[] {
  return [
    { label: `주의보 ${threshold.advisory}`, value: threshold.advisory },
    { label: `경보 ${threshold.warning}`, value: threshold.warning },
    { label: `대피 ${threshold.evacuate}`, value: threshold.evacuate },
  ];
}

/* ── 영향 ────────────────────────────────────────────── */

/**
 * 공통 영향 결과 — 재난유형이 달라도 이 구조는 같다.
 *
 * 화학 누출이면 areaHa 는 확산 범위, roadM 은 통제 도로가 된다. 이름이 침수를 가리키지
 * 않는 것은 그래서다("침수 면적"이 아니라 "영향 범위").
 */
export interface ImpactResult {
  /** 영향 범위 (ha) */
  areaHa: number;
  /** 영향 건물 (동) */
  buildings: number;
  /** 통제 도로 (m) */
  roadM: number;
  /** 대피 대상 (명) */
  evacuees: number;
  /** 숫자만으로 안 되는 단서 — "물양장 진입로 전 구간" 같은 것 */
  notes: string[];
}

/**
 * 조건값에 따른 영향 규모. 등재되지 않은 지구·유형은 null.
 *
 * 지금은 04 §12(서항지구 침수 영향표) 하나를 감싼다. 유형이 늘면 여기서 갈라진다 —
 * 호출부(화면)는 어느 표를 읽었는지 알 필요가 없다.
 */
export function impactAt(
  districtId: string,
  hazardType: HazardType,
  value: number,
): ImpactResult | null {
  if (!WATER_LEVEL_HAZARDS.includes(hazardType)) return null;

  const row = floodImpactAt(districtId, value);
  if (!row) return null;

  return {
    areaHa: row.areaHa,
    buildings: row.buildings,
    roadM: row.roadM,
    evacuees: row.evacuees,
    /* 통제 구간의 이름은 지구가 정한다 — 내륙 배수구역에 "물양장" 이 서면 안 된다 */
    notes: row.wharfRoad
      ? [districtId === "bongam" ? "수로변 도로 전 구간 통제" : "물양장 진입로 전 구간 통제"]
      : [],
  };
}

/* ── 근거와 가정 ─────────────────────────────────────── */

/**
 * 이 분석이 무엇을 보고 무엇을 전제했는가.
 *
 * 화면에 "시연용 고정값 · 04 §12"를 내면 안 된다 — 그건 우리끼리 쓰는 말이고, 쓰는
 * 사람이 알아야 하는 것은 "무슨 자료를 봤고 무엇이 유지된다고 쳤나"다(03 §5).
 */
export interface AnalysisBasis {
  /** 분석 시각 — 시나리오 시계의 지금 */
  at: Date;
  /** 전망 시각 — 조건 시나리오가 있을 때만. 없으면 현재 조건만 본 것이다 */
  projectedAt: Date | null;
  /**
   * 산정 조건 — 그 전망값을 만든 항들 (04 §10-3 · §15-7).
   *
   * ★ 만조가 사는 곳이 여기다. 화면 제목도 버튼명도 아니고 "19:10 전망을 이렇게 산출했다"
   *   의 한 줄이다(03 §5). 조석이 제목에 서면 화면 전체가 해안 전용으로 읽히고, 같은
   *   문법을 내수침수에 얹을 수 없다.
   */
  terms: ScenarioTerm[];
  /** 사용 데이터 */
  sources: string[];
  /** 유지한다고 가정한 조건 */
  assumptions: string[];
}

/**
 * 조건 시나리오(04 §10)를 사용자 언어로 되쓴다. 값은 시나리오 산출 세 항 그대로다 —
 * 여기서 새 숫자를 만들지 않는다.
 */
export function analysisBasisOf(
  scenario: TideScenario,
  now: Date,
  observed: number | null,
  unit: string,
): AnalysisBasis {
  return {
    at: now,
    projectedAt: new Date(scenario.peakAt),
    /* 산정 세 항을 그대로 세운다 — 출처(조위표·수위계)는 각 항의 note 가 들고 있어서,
       여기서 "기상청 조위표" 를 따로 적으면 내륙 트랙에 해안 어법이 선다 */
    terms: scenario.terms,
    sources: [
      observed != null ? `계측 관측 ${observed} ${unit}` : "계측 관측",
      "지구별 수위-영향 산출표",
      "행정안전부 생활안전지도 위험지구 자료",
    ],
    /* 이 화면이 "예측"이 아니라 "현재 조건 유지 시 전망"인 이유가 이 한 줄이다 */
    assumptions: [`위 산정 조건이 ${scenario.peakLabel} 시각까지 유지`],
  };
}

/**
 * 조건 시나리오가 없는 사건의 근거와 가정.
 *
 * 만조 조건 시나리오(04 §10)는 주인공 사건 하나에만 있다. 나머지 진행 중 사건도 트윈에서
 * 조건을 밀어 볼 수 있어야 하고, 그때 근거는 관측값과 그 지구의 발령 기준이다.
 */
export function observedBasisOf(
  threshold: WaterThreshold,
  unit: string,
  now: Date,
  observed: number | null,
): AnalysisBasis {
  return {
    at: now,
    /* 전망할 근거가 없는 사건이다 — 시간축도 현재까지만 서고 이 칸은 빈다 */
    projectedAt: null,
    terms: [],
    sources: [
      observed != null ? `계측 관측 ${observed} ${unit}` : "계측 관측",
      `지구 발령 기준 주의보 ${threshold.advisory} · 경보 ${threshold.warning} · 대피 ${threshold.evacuate} ${unit}`,
      "행정안전부 생활안전지도 위험지구 자료",
    ],
    assumptions: ["현재 계측 조건이 분석 시점까지 유지"],
  };
}

/**
 * 사전 모의분석의 근거와 가정 — 실시간 계측이 없는 자리다.
 *
 * ★ 무엇을 **안 썼는지**를 적는 것이 이 카드의 일이다. 사건 연계 분석과 같은 모양의
 *   숫자가 나오는데 출처가 관측이 아니라 사용자 설정이면, 그 사실이 화면에 없을 때
 *   두 결과가 같은 무게로 읽힌다.
 */
export function drillBasisOf(
  threshold: WaterThreshold,
  unit: string,
  now: Date,
): AnalysisBasis {
  return {
    at: now,
    /* 모의분석에는 전망 시각이 없다 — 예보가 아니라 사용자가 세운 조건이라 "언제"가 없다.
       시간축이 사건 연계에만 서는 이유도 같다 */
    projectedAt: null,
    terms: [],
    sources: [
      `지구 발령 기준 주의보 ${threshold.advisory} · 경보 ${threshold.warning} · 대피 ${threshold.evacuate} ${unit}`,
      "지구별 수위-영향 산출표",
      "행정안전부 생활안전지도 위험지구 자료",
    ],
    assumptions: [
      "설정한 조건이 그대로 성립한다고 가정",
      "실시간 계측·기상 자료를 쓰지 않은 가상 조건",
    ],
  };
}

/* ── 사건에 반영할 분석 결과 ─────────────────────────── */

/**
 * SCR-05 가 SCR-02 로 넘기는 한 벌 (02 §2).
 *
 * "이 판단으로 대응하기"는 디지털트윈이 판단을 확정하는 것처럼 읽힌다. 트윈이 하는 일은
 * 판단이 아니라 **검토 결과를 사건에 붙이는 것**이고, 권고 대응과 SOP 대상을 구체화하는
 * 것은 SCR-02 의 몫이다. 그래서 넘기는 것도 결론이 아니라 조건·영향·근거다.
 */
export interface AnalysisSnapshot {
  districtId: string;
  eventId: string;
  hazardType: HazardType;
  /** 조건값과 표기 — "4.24 EL.m" */
  conditionValue: number;
  conditionLabel: string;
  /** 현재 조건의 영향 (비교 기준) */
  baseline: ImpactResult | null;
  /** 선택 조건의 영향 */
  impact: ImpactResult;
  basis: AnalysisBasis;
}

/**
 * 사전 모의분석 결과 한 벌.
 *
 * AnalysisSnapshot 과 모양이 닮았지만 **eventId 가 없다**. 그 한 칸의 부재가 이 결과가
 * 어떤 사건에도 붙지 않는다는 뜻이고, 저장 경로가 갈리는 지점이다(state/analysis-results.ts).
 */
export interface DrillSnapshot {
  districtId: string;
  districtName: string;
  hazardType: HazardType;
  conditionValue: number;
  conditionLabel: string;
  /** 비교 기준 — 모의분석은 경보 기준을 붙박이로 둔다 */
  baseline: ImpactResult | null;
  baselineLabel: string;
  impact: ImpactResult;
  basis: AnalysisBasis;
  /** 저장 시각 — 시나리오 시계의 지금 */
  savedAt: Date;
}

/** 주인공 사건의 만조 조건 — 프리셋 라벨이 이 값을 쓴다 (04 §10-2) */
export const HERO_PEAK = HERO_SCENARIO.peak;
