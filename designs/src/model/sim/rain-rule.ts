/* ─────────────────────────────────────────────
 * 서항 강우 → 도로 수위 규칙 — /scr-00 침수 서항 대상의 계산 층 (2026-09-17)
 *
 *   수위(EL.m) = L_BASE + K · max(0, 누적 강우 × 배율 − 한계강우량)
 *
 * 값의 출처(scripts/calibrate-rain-rule-seohang.mjs 머리말과 같다):
 *   실자료   2024-09-21 강우 격자(기상청 국지예보모델 재분석 · Open-Meteo) · 생활안전지도 침수흔적도 면적 · 10 m 지형
 *   공식값   한계강우량(24년 도시침수 완료보고 p.41 표 · 40/50/70 mm)
 *   보정값   K — 첨두 수위의 지형 채우기 면적이 침수흔적도 면적과 같도록
 *   가정     한계강우량의 지점 대응(중앙값 50) · 흔적이 이 사건의 것이라는 것
 *   미반영   하천·노면 수위 시계열 · 펌프 제원과 가동 · 조위. 자료가 오면 같은 자리에서 재보정하고, SWMM 같은 수리 모델이 오면 교체
 *
 * ★ 이 규칙은 정밀 모델이 아니다. 사전 작성 판을 **실자료로 보정한 한 줄 규칙**으로 바꾼 것이고, 화면에 그렇게 적는다.
 *   그 대신 강우 축이 연속으로 열린다(배율 슬라이더). 눈금(앵커)은 근거 있는 값만: 실제 · 호우주의보/경보 기준(기상청 3시간 강우).
 * ───────────────────────────────────────────── */

import type { Forecast, ForecastMark, ImpactTarget } from "../forecast";
import { AREA_TABLE, K, L_BASE, OBS_AREA_HA, P_LIM, RAIN_SERIES } from "../../fixtures/seohang-flood/rain-rule.generated";
export { OBS_AREA_HA, P_LIM, K, L_BASE };
import { FLOOD_LEVELS } from "../../fixtures/seohang-flood/geometry.generated";
import { FORECAST_BASE } from "../../fixtures/seohang-flood/forecasts";
import { INCIDENT_ID, SCENARIO_DATE } from "../../fixtures/seohang-flood/incident";
import { SUBJECTS } from "../../fixtures/seohang-flood/subjects";
import { floodScene, type RoadState, type UnderpassState } from "../../fixtures/seohang-flood/scene";
import { RISK_DISTRICT_DAMAGE_MM_PER_H, RISK_DISTRICT_HOURLY } from "../../fixtures/risk-districts.generated";

export const RULE_DATE = SCENARIO_DATE;
/** 해안도로 저지대 가장 낮은 꼭짓점(EL.m) — 도로 침수심은 수위에서 이것을 뺀 값이다(bake-flood-seohang 머리말) */
export const ROAD_LOW = 3.7;
/** 기상청 호우특보 기준(3시간 누적 · mm) */
export const HEAVY_RAIN_ADVISORY_3H = 60;
export const HEAVY_RAIN_WARNING_3H = 90;

export const hourIso = (h: number) => `${RULE_DATE}T${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}:00+09:00`;
export const RULE_START = hourIso(RAIN_SERIES[0][0]);
export const RULE_END = hourIso(RAIN_SERIES[RAIN_SERIES.length - 1][0] + 1);
export const RULE_TOTAL_MM = Number(RAIN_SERIES.reduce((a, [, v]) => a + v, 0).toFixed(1));
/** 3시간 연속 최대 합(mm) — 특보 기준과 견준다 */
/** 시간 최대(mm/h) — 재해위험지구 피해 강우(시간)와 견준다 */
export const RULE_MAX_HOURLY = Math.max(...RAIN_SERIES.map(([, v]) => v));
export const RULE_MAX_3H = Number(Math.max(...RAIN_SERIES.map((_, i) => RAIN_SERIES.slice(Math.max(0, i - 2), i + 1).reduce((a, [, v]) => a + v, 0))).toFixed(1));

/** 특보 기준에 닿는 배율 — 실제가 이미 넘었으면 1 아래로 내려온다(그때는 앵커로 안 쓴다) */
export const factorForWarning = (mm3h: number) => Number((mm3h / RULE_MAX_3H).toFixed(2));

/** 시작부터 m 분 뒤의 누적 강우(mm) — 한 시간 안은 그 시간 강도로 직선 */
export function cumulativeAt(minutes: number, factor = 1): number {
  const h = Math.max(0, minutes) / 60;
  let cum = 0;
  for (let i = 0; i < RAIN_SERIES.length; i += 1) {
    const rate = RAIN_SERIES[i][1];
    if (h >= i + 1) cum += rate;
    else { cum += rate * Math.max(0, h - i); break; }
  }
  return cum * factor;
}

/** 그릇 가장자리(EL.m) — 사건 범위(배수권역) 링의 수위. 그 위는 물이 권역 밖으로 넘치는데 규칙에 그 길이 없다. 여기서 멈춘다 */
export const RIM = FLOOD_LEVELS["GEO-BASIN-SH-01"];
export function levelOf(cumMm: number, pLim = P_LIM): number {
  return Math.min(RIM, L_BASE + K * Math.max(0, cumMm - pLim));
}
export const levelAtMinutes = (minutes: number, factor = 1, pLim = P_LIM) => levelOf(cumulativeAt(minutes, factor), pLim);
export const depthOfLevel = (level: number) => Math.max(0, level - ROAD_LOW);

/** 수위 → 침수 면적(ha) — 보정 스크립트가 지형에서 구운 표를 직선 보간 */
export function areaOfLevel(level: number): number {
  if (level <= AREA_TABLE[0][0]) return 0;
  for (let i = 1; i < AREA_TABLE.length; i += 1) {
    const [l0, a0] = AREA_TABLE[i - 1], [l1, a1] = AREA_TABLE[i];
    if (level <= l1) return a0 + ((level - l0) / (l1 - l0)) * (a1 - a0);
  }
  return AREA_TABLE[AREA_TABLE.length - 1][1];
}

/** 수위가 문턱에 처음 닿는 시각(ISO). 안 닿으면 null. 분 단위로 훑는다 */
export function firstReach(threshold: number, factor: number, pLim: number): string | null {
  const total = (RAIN_SERIES.length) * 60;
  for (let m = 0; m <= total; m += 1) if (levelAtMinutes(m, factor, pLim) >= threshold) return new Date(new Date(RULE_START).getTime() + m * 60_000).toISOString();
  return null;
}

const roadStateOf = (level: number): RoadState =>
  level < FLOOD_LEVELS["GEO-FLOOD-T10"] ? "통행 가능" : level < FLOOD_LEVELS["GEO-FLOOD-T30"] ? "물고임" : level < FLOOD_LEVELS["GEO-FLOOD-T50"] ? "차로 침수 · 서행" : "통행 불가";
const underpassOf = (level: number): UnderpassState =>
  level < FLOOD_LEVELS["GEO-FLOOD-T50"] ? "정상" : level < FLOOD_LEVELS["GEO-FLOOD-T80"] ? "유입 시작" : "부분 중단";
/** 범위 링은 구운 단계 중 수위 아래의 가장 높은 것 — 면은 연속 수위로 지형에서 채우고, 링은 교차 판정에만 쓴다 */
const stageOf = (level: number): string =>
  level >= FLOOD_LEVELS["GEO-FLOOD-T80"] ? "GEO-FLOOD-T80" : level >= FLOOD_LEVELS["GEO-FLOOD-T50"] ? "GEO-FLOOD-T50" : level >= FLOOD_LEVELS["GEO-FLOOD-T30"] ? "GEO-FLOOD-T30" : level >= FLOOD_LEVELS["GEO-FLOOD-T10"] ? "GEO-FLOOD-T10" : "GEO-FLOOD-NONE";

export interface RuleChoice { factor: number; pLim: number; label: string }

/**
 * 규칙으로 만든 예측판 — 화면이 사전 작성 판과 같은 모양으로 읽는다(눈금 · 대상 · 장면 · 근거).
 * 눈금은 시간마다 하나. 수위·면적의 연속값은 `levelAtMinutes` · `areaOfLevel` 이 따로 준다.
 */
export function ruleForecast(c: RuleChoice, id: string, baseline: boolean): Forecast {
  const marks: ForecastMark[] = RAIN_SERIES.map(([hh], i) => {
    const level = levelAtMinutes((i + 1) * 60, c.factor, c.pLim);
    const extent = stageOf(level);
    return {
      validAt: hourIso(hh + 1),
      maxDepthM: Number(depthOfLevel(level).toFixed(2)),
      extentGeometryId: extent,
      impactSummary: `누적 ${Math.round(cumulativeAt((i + 1) * 60, c.factor))} mm · 수위 ${level.toFixed(2)} m · 해안도로 ${roadStateOf(level)}`,
      scene: floodScene({ road: roadStateOf(level), underpass: underpassOf(level), pump: "2호기 정지 · 가용 2/3", retention: "여유 62 %", extent: extent === "GEO-FLOOD-NONE" ? "GEO-FLOOD-T10" : extent }),
    };
  });
  const roadAt = firstReach(FLOOD_LEVELS["GEO-FLOOD-T10"], c.factor, c.pLim);
  const underAt = firstReach(FLOOD_LEVELS["GEO-FLOOD-T50"], c.factor, c.pLim);
  const bldAt = firstReach(FLOOD_LEVELS["GEO-FLOOD-T80"], c.factor, c.pLim);
  const targets: ImpactTarget[] = [
    { kind: "도로", id: SUBJECTS.coastRoad, label: "해안도로 저지대 구간", ...(roadAt ? { arrivalAt: roadAt, exposure: "노출" as const } : { exposure: "영향 없음" as const }) },
    { kind: "중요시설", id: SUBJECTS.underpass, label: "신포 지하차도", ...(underAt ? { arrivalAt: underAt, exposure: "부분 중단" as const } : { exposure: "영향 없음" as const }) },
    { kind: "건물", id: "BLD-SH-LOW", label: "저지대 건물", ...(bldAt ? { arrivalAt: bldAt, exposure: "노출" as const } : { exposure: "영향 없음" as const }) },
  ];
  return {
    forecastId: id, incidentId: INCIDENT_ID, alternativeId: baseline ? "baseline" : "situation",
    changedConditions: baseline ? [] : [c.label],
    marks,
    arrivalAt: roadAt ?? RULE_END,
    targets,
    basis: {
      ...FORECAST_BASE.basis,
      modelName: "누적 강우 규칙", modelVersion: "r1 · 2024-09-21 침수흔적 보정",
      baseTime: RULE_START, generatedAt: RULE_START,
      assumptions: [
        `강우 = ${RULE_DATE} 기상청 국지예보모델 재분석 격자(배수권역 최근접 칸) × ${c.factor}`,
        `한계강우량 ${c.pLim} mm (24년 도시침수 완료보고 p.41 표)`,
        `수위 = ${L_BASE} + ${K} × (누적 − 한계) · K 는 첨두 면적을 침수흔적도 ${OBS_AREA_HA} ha 에 맞춘 보정값`,
        "하천·노면 수위 시계열 · 펌프 가동 · 조위는 미반영",
        `수위는 그릇 가장자리 ${RIM} m 에서 멈춘다 · 그 위(권역 밖 범람)는 규칙 밖`,
        `참고 눈금: 전국 지역재해위험지구 표본의 피해 당시 시간강우 중앙값 ${RISK_DISTRICT_DAMAGE_MM_PER_H} mm/h(n=${RISK_DISTRICT_HOURLY.n} · 행안부 표본, 창원 행 없음)`,
      ],
      uncertainty: { grade: "높음", sensitiveTo: ["한계강우량의 지점 대응", "침수흔적도가 이 사건의 것인지", "펌프·조위 미반영"], unusableRanges: [] },
      replacementNote: "SWMM 등 수리 모델 연결 시 같은 자리에서 교체 · 수위 시계열이 오면 재보정",
    },
    availability: "가용",
    validUntil: RULE_END,
    conditions: [
      { label: "강우", value: `${RULE_DATE} 실제${c.factor === 1 ? "" : ` × ${c.factor}`} · 누적 ${Math.round(RULE_TOTAL_MM * c.factor)} mm`, tone: c.factor > 1 ? "warning" : undefined },
      { label: "3시간 최대", value: `${(RULE_MAX_3H * c.factor).toFixed(0)} mm (주의보 ${HEAVY_RAIN_ADVISORY_3H} · 경보 ${HEAVY_RAIN_WARNING_3H})` },
      { label: "한계강우량", value: `${c.pLim} mm · p.41` },
    ],
  };
}
