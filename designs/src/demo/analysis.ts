/* ─────────────────────────────────────────────
 * 분석 조건과 영향 결과 — 배경: docs/레거시/정본/04_데모_데이터.md §10 · §12
 *
 * SCR-05 는 "물을 올려보는 화면"이 아니라 "사건 조건을 바꿔 공간 영향과 대응 대상을
 * 비교하는 화면"이다. 그래서 축을 둘로 가른다.
 *
 *   시간 (Timeline)       두 모드의 주 조작축이다. 사건 연계는 시각(demo/scenario-timeline.ts),
 *                         모의분석은 경과(demo/progression.ts). 미는 것은 언제나 시간이고
 *                         수위는 그 시간에 따라 나오는 결과다.
 *   영향 (ImpactResult)   재난유형이 달라도 같다. 범위·인구·건물·도로·대피 대상은
 *                         무엇이 덮치든 대응이 물어보는 것이 같기 때문이다.
 *
 * 유형을 하나 늘리는 일 = 진행 스펙 한 벌 + impactAt 에 분기 하나. 화면(DigitalTwinPage)과
 * 3D 씬(lib/flood-scene.ts)은 손대지 않는다.
 *
 * ★ 등재되지 않은 유형은 비워 둔다. 04 에 진행 조건·영향표가 없는 유형에 축을 세우면
 *   숫자가 근거 없이 움직인다 — 화면은 "아직 등재되지 않음"으로 정직하게 선다.
 * ───────────────────────────────────────────── */

import { DISTRICTS, type District } from "./districts";
import { EVENTS, HAZARD_ORDER, activeEventOfAt, type HazardType } from "./events";
import { floodImpactAt, hasFloodImpact } from "./flood-impact";
import { HERO_SCENARIO, type ScenarioTerm, type TideScenario } from "./forecast";
import { WATER_THRESHOLDS, type WaterThreshold } from "./levels";
import { progressionSpecOf, type ProgressionCondition, type ProgressionSpec } from "./progression";

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

/**
 * 메뉴로 들어온 트윈이 열 지구 (02 §2 · 03 §5).
 *
 * 메뉴 진입은 사건을 들고 오지 않는다 — 사전 모의분석의 자리다. 그래서 **그 시각에 진행
 * 중 사건이 없는** 지구를 연다. 사건이 도는 지구를 열면 메뉴로 들어왔는데 사건 연계
 * 분석이 서고, 트윈이 사건에 종속된 화면으로 보인다. 사건을 들고 들어오는 길은
 * SCR-02 의 [디지털트윈] 하나여야 한다.
 *
 * 고르는 범위는 **진행 스펙과 영향표가 등재된 지구**다. 표가 없는 지구를 열면 축을 밀어도
 * 영향 결과 카드가 서지 않아 화면이 반쯤 빈 채로 열린다(04 §12 · §15-8).
 *
 * 트랙 이름을 보지 않는다 — 원장을 현재 시계로 자르면 답이 저절로 갈린다. 서항
 * 트랙(8/12 저녁)에서는 봉암(8/13 사건은 아직 미래)이, 봉암 트랙(8/13 오전)에서는
 * 서항(8/12 21:48 해제)이 열린다.
 */
export function drillDistrictAt(now: Date): District {
  const analyzable = DISTRICTS.filter(
    (district) =>
      hasFloodImpact(district.id) &&
      hazardTypesOf(district.id).some((type) => progressionSpecOf(district.id, type)),
  );
  /* 전부 사건 중이면(트랙이 늘면 있을 수 있다) 첫 지구로 물러난다 — 사건 연계로 열리지만
     화면이 서지 않는 것보다는 낫다 */
  return analyzable.find((d) => !activeEventOfAt(d.id, now)) ?? analyzable[0] ?? DISTRICTS[0];
}

/* ── 결과 수위의 표기 ────────────────────────────────── */

/**
 * 시간축이 낸 수위를 화면이 어떻게 읽는가.
 *
 * ★ 이것은 **조건이 아니라 결과의 규격**이다. 한때 이 자리에 조건 슬라이더의 min·max·step
 *   이 있었다 — 사람이 "침수 예상 수위"를 직접 밀던 시절의 잔재다. 예상은 시스템의 몫이라
 *   미는 것은 시간이 됐고(demo/progression.ts), 여기 남은 것은 그 결과를 부르는 이름과
 *   단위뿐이다.
 *
 * 지금 등재된 것은 수위 계열(폭풍해일·하천범람·내수침수) 하나뿐이다. 셋이 한 벌을 쓰는
 * 것은 결과의 물리량이 같고(EL.m 수면 표고) 3D 씬의 수면 하나가 함께 움직이기 때문이지,
 * 셋을 같은 재난으로 보기 때문이 아니다 — **조건은 셋이 다 다르다**(progression.ts).
 */
export interface ConditionSpec {
  /** 결과 행 선택 키 — 유형 계열이 늘면 여기에 값이 하나 는다 */
  kind: "water-level";
  /** 결과 행 이름 — "예상 수위" */
  title: string;
  /** 값 단위 — "EL.m" */
  unit: string;
}

const WATER_LEVEL_HAZARDS: HazardType[] = ["폭풍해일", "하천범람", "내수침수"];

/**
 * 이 지구·이 재난유형의 결과 수위 규격. 등재되지 않은 유형은 null —
 * 영향 결과 카드에 수위 행이 서지 않는다.
 */
export function conditionSpecOf(districtId: string, hazardType: HazardType): ConditionSpec | null {
  if (!WATER_LEVEL_HAZARDS.includes(hazardType)) return null;
  if (!WATER_THRESHOLDS[districtId]) return null;
  return { kind: "water-level", title: "예상 수위", unit: "EL.m" };
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
  spec: ProgressionSpec,
  condition: ProgressionCondition,
  threshold: WaterThreshold,
  unit: string,
  now: Date,
): AnalysisBasis {
  return {
    at: now,
    /* 모의분석에는 전망 **시각**이 없다 — 예보가 아니라 사용자가 세운 조건이라 "몇 시"가
       뜻을 못 가진다. 축이 절대 시각이 아니라 경과인 이유가 이것이다(progression.ts) */
    projectedAt: null,
    /* 산정 한 항 — 사건 연계의 조건 시나리오 세 항(04 §10-3)이 서는 자리에, 모의분석은
       상승률 하나를 세운다. 축 위 눈금 시각이 전부 이 값에서 나온다 */
    terms: [
      {
        label: spec.leverLabel,
        value: `${condition.label} 지속`,
        note: `수위 상승 ${condition.riseRate} m/h · ${condition.note}`,
      },
    ],
    sources: [
      `${spec.startLabel} ${spec.startLevel} ${unit} 에서 출발`,
      `지구 발령 기준 주의보 ${threshold.advisory} · 경보 ${threshold.warning} · 대피 ${threshold.evacuate} ${unit}`,
      "지구별 수위-영향 산출표",
      "행정안전부 생활안전지도 위험지구 자료",
    ],
    assumptions: [
      `${spec.leverLabel} ${condition.label} 조건이 그대로 지속`,
      "실시간 계측·기상 자료를 쓰지 않은 가상 조건",
    ],
  };
}

/* ── 사건에 남기는 검토 기록 ─────────────────────────── */

/**
 * SCR-05 가 사건에 붙이는 한 벌 (02 §2).
 *
 * ★ 트윈은 사건의 값도 SOP 도 바꾸지 않는다. SOP 를 정하는 것은 셋이고 셋 다 트윈 밖이다:
 *   재난유형이 목록을 고르고(`sopItemsFor`), 승인 대응등급이 그 목록에서 열리는 범위를
 *   정하고(`minLevel <= level`), 대상 인원·수단·기관은 04 §11-2 에 고정돼 있다.
 *   `재난문자 412명` 은 트윈에 들어가기 전부터 경보 등급 SOP 에 서 있다.
 *
 *   그래서 여기 남는 것은 **"대표 전망을 언제 누가 검토했다"** 는 사실과 그 근거뿐이다.
 *   사건 상태를 실제로 바꾸는 행위는 SCR-02 의 [대응등급 대피로 상향] 승인 하나다.
 *
 * ★ 사용자가 상세 조건으로 밀어 본 값(3.80 같은)은 **여기 들어오지 않는다.** 그것은
 *   "이 정도면 어디까지"를 알아보는 자유 탐색이고, 사건의 공식 근거를 대체할 수 없다.
 *   기록되는 것은 언제나 사건에 이미 생성된 조건 시나리오(04 §10 · §15-7) 한 벌이다.
 */
export interface AnalysisReview {
  districtId: string;
  eventId: string;
  hazardType: HazardType;
  /** 검토 시각과 검토자 */
  reviewedAt: Date;
  reviewer: string;

  /* 검토 대상 — 사건에 이미 생성된 공식 전망. 사용자가 고른 값이 아니다 */
  /** 조건 시나리오를 세운 시각. 같은 사건의 전망을 가리키는 열쇠다 */
  scenarioCreatedAt: Date;
  /** 전망 시각과 그 이름 ("바닷물 최고" · "저지대 영향 확대") */
  scenarioAt: Date;
  scenarioLabel: string;
  /** 전망 조건값과 단위 */
  scenarioValue: number;
  unit: string;
  /** 전망 조건의 영향 */
  scenarioImpact: ImpactResult;
  /** 검토 시점 계측의 영향 — 비교 기준 */
  observedImpact: ImpactResult | null;
  observedValue: number | null;
  basis: AnalysisBasis;
}

/**
 * 사전 모의분석 결과 한 벌.
 *
 * AnalysisReview 와 달리 eventId 가 없고, 대신 **사용자가 세운 조건값을 그대로 담는다.**
 * 사건에 붙지 않는 결과라 자유롭게 세운 조건이 그대로 결론이 된다 — 붙일 사건이 없으니
 * 공식 전망과 탐색값을 가를 이유도 없다(state/analysis-results.ts).
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
