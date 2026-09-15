/* ─────────────────────────────────────────────
 * B 하천 흐름·범람 — 주남저수지 제방 조건 세트 (03 §7)
 *
 * 축은 예측강우(보통·강함·매우 강함) 하나다. 방류는 축이 아니라 **대안**이다(03 §7 대안 조건 "방류 시나리오, 통제·대피 개시 시점" ·
 * 03 §22 B). 강함·매우 강함에 예측판이 있고 보통은 없다. 첫 줄 지표는 침수심이 아니라 "여수로 월류까지 남은 시간"(03 §26).
 * 상류에서 하류로 가는 시간이 핵심이라 눈금은 +30·+60·+120·+180 분으로 A 보다 성기다. 값은 시나리오 편집값이고 정확도를 주장하지 않는다.
 * ───────────────────────────────────────────── */

import type { Forecast, ForecastBasis, ForecastMark, ImpactTarget } from "../../model/forecast";
import type { TrainingConditionSet } from "../../model/training";
import type { LngLat, SceneLayer, SceneProfile } from "../../model/scene";

const INCIDENT_ID = "INC-2024-0921-JN01";
const t = (hhmm: string) => `2024-09-21T${hhmm}:00+09:00`;
const BASE = t("17:00");
const VALID_UNTIL = t("20:30");
const AT = { m30: t("17:30"), m60: t("18:00"), m120: t("19:00"), m180: t("20:00") };

/** 좌·우안 범람면 — 제방 하류 저지대. 시나리오 편집 폴리곤 */
export const JUNAM_GEOMETRIES: Record<string, [number, number][]> = {
  "GEO-JN-BANK": [[128.6855, 35.3175], [128.6885, 35.3178], [128.6888, 35.3158], [128.6858, 35.3155]],
  "GEO-JN-FLOOD-1": [[128.6862, 35.3158], [128.6884, 35.316], [128.6886, 35.3148], [128.6864, 35.3146]],
  "GEO-JN-FLOOD-2": [[128.6852, 35.316], [128.6892, 35.3163], [128.6896, 35.3138], [128.6854, 35.3134]],
  "GEO-JN-FLOOD-3": [[128.684, 35.3163], [128.69, 35.3168], [128.6908, 35.3126], [128.6842, 35.312]],
};

/* ── 장면 층 (03 §22 B) — 하천 방향과 관측소 순서가 먼저 읽힌다. 종단도는 보조뷰 ── */
const RIVER: LngLat[] = [[128.6868, 35.3182], [128.6874, 35.3166], [128.6878, 35.3152], [128.6884, 35.3138], [128.6892, 35.3124]];
const B_STATIC: SceneLayer[] = [
  { kind: "line", id: "b-river", role: "하천", coords: RIVER, state: "on", label: "여수로 → 하류" },
  { kind: "point", id: "b-st-a", at: [128.6866, 35.3176], icon: "mdi:waves", label: "제방 수위계 (상류)", state: "실측", tone: "primary", small: true },
  { kind: "point", id: "b-st-b", at: [128.6879, 35.315], icon: "mdi:waves", label: "여수로 하류 (중류)", state: "시나리오", tone: "primary", small: true },
  { kind: "point", id: "b-st-c", at: [128.6891, 35.3126], icon: "mdi:waves", label: "마을 앞 (하류)", state: "시나리오", tone: "primary", small: true },
];
const ISOLATION: LngLat[] = [[128.6852, 35.3152], [128.6874, 35.3154], [128.6876, 35.3134], [128.6854, 35.3132]];
const bScene = (isolated: boolean, village: "정상" | "대피 필요" | "대피 완료" | "고립"): SceneLayer[] => [
  ...(isolated ? [{ kind: "area" as const, id: "b-isolation", role: "고립 구역" as const, ring: ISOLATION, label: "진입로 차단 · 고립" }] : []),
  { kind: "point", id: "b-village", at: [128.6864, 35.3143], icon: "mdi:home-group", label: "하류 마을", state: village, tone: village === "정상" || village === "대피 완료" ? "success" : village === "고립" ? "danger" : "warning" },
];
/** 종단도 — 관측소 3곳 EL.m. 기준 수위 = 여수로 월류 EL.5.9 */
const STATIONS = [{ id: "a", label: "제방(상류)", km: 0, bed: 4.2 }, { id: "b", label: "여수로 하류", km: 0.6, bed: 3.4 }, { id: "c", label: "마을 앞(하류)", km: 1.4, bed: 2.6 }];
const profile = (levels: [number[], number[], number[], number[]]): SceneProfile => ({ stations: STATIONS, threshold: 5.9, levelsByMark: { [AT.m30]: levels[0], [AT.m60]: levels[1], [AT.m120]: levels[2], [AT.m180]: levels[3] } });

const basis = (assumptions: string[], overrides: Partial<ForecastBasis> = {}): ForecastBasis => ({
  modelName: "시나리오 하천 범람 결과 세트", modelVersion: "0.1", baseTime: BASE, generatedAt: BASE,
  inputEventIds: [], assumptions,
  uncertainty: { grade: "높음", sensitiveTo: ["상류 강우 실측과 예측의 차이", "제방 단면·여수로 제원"], unusableRanges: ["+180분 이후"] },
  inputQuality: "보정", calculationActor: "해당 없음",
  replacementNote: "홍수예측 제공 주체 확정 시 같은 조건의 ModelRun 결과로 교체",
  ...overrides,
});

/** 첫 줄 지표 — 여수로 월류(기준 수위)까지 남은 시간. 값은 범람심이라 지도 진하기에 쓰고, 문장이 첫 줄에 선다 */
const marks = (d: [number, number, number, number], g: [string, string, string, string], n: [string, string, string, string], lead: [string, string, string, string], scenes?: [SceneLayer[], SceneLayer[], SceneLayer[], SceneLayer[]]): ForecastMark[] =>
  ([AT.m30, AT.m60, AT.m120, AT.m180] as const).map((validAt, i) => ({
    validAt, maxDepthM: d[i], extentGeometryId: g[i], impactSummary: n[i],
    metric: { label: "여수로 월류까지", value: d[i], unit: "m", digits: 2, text: lead[i] },
    ...(scenes ? { scene: scenes[i] } : {}),
  }));

const road = (exposure: ImpactTarget["exposure"], arrivalAt?: string): ImpactTarget => ({ kind: "도로", id: "RD-JN-BANK", label: "제방 순환도로", arrivalAt, exposure });
const spillway = (exposure: ImpactTarget["exposure"], arrivalAt?: string): ImpactTarget => ({ kind: "중요시설", id: "FAC-JN-SPILL", label: "여수로·양수장", arrivalAt, exposure });
const houses = (label: string, exposure: ImpactTarget["exposure"], arrivalAt?: string): ImpactTarget => ({ kind: "건물", id: "BLD-JN-DOWN", label, arrivalAt, exposure });
const visitors = (exposure: ImpactTarget["exposure"], arrivalAt?: string): ImpactTarget => ({ kind: "대상자", id: "POP-JN-PARK", label: "친수공간 이용자·하류 마을", arrivalAt, exposure });

/* ── 강함 · 현행 방류 ── */
const R2D0_BASE: Forecast = {
  forecastId: "FC-COND-JN-R2D0-BASE", incidentId: INCIDENT_ID, alternativeId: "baseline", changedConditions: [],
  marks: marks([0.0, 0.1, 0.35, 0.5], ["GEO-JN-BANK", "GEO-JN-FLOOD-1", "GEO-JN-FLOOD-1", "GEO-JN-FLOOD-2"], ["제방 여유고 0.4 m · 월류 없음", "여수로 만수 · 하류 저지대 물고임", "여수로 월류 시작 · 하류 도로 침수", "우안 저지대 범람 · 마을 진입로 차단"], ["70분 뒤", "40분 뒤", "월류 중", "범람 확대"], [bScene(false, "정상"), bScene(false, "정상"), bScene(false, "대피 필요"), bScene(true, "고립")]),
  arrivalAt: t("18:40"),
  targets: [road("노출", t("18:40")), spillway("부분 중단", t("18:00")), houses("하류 주택 6동", "노출", t("19:30")), visitors("노출", t("18:40"))],
  basis: basis(["예측강우 20 mm/h 3시간 지속", "현행 방류량 유지", "제방 여유고 0.4 m 기준"]),
  availability: "가용", validUntil: VALID_UNTIL,
  scene: B_STATIC,
  profile: profile([[5.3, 4.4, 3.2], [5.6, 4.7, 3.4], [5.95, 5.1, 3.8], [6.1, 5.4, 4.2]]),
  conditions: [{ label: "예측강우", value: "시나리오 조건" }, { label: "방류", value: "현행 유지" }, { label: "제방 여유고", value: "0.4 m (17:00)" }],
};
const R2D0_EVAC: Forecast = {
  forecastId: "FC-COND-JN-R2D0-EVAC", incidentId: INCIDENT_ID, alternativeId: "evacuation", changedConditions: ["하류 마을 대피 개시 18:00", "제방 순환도로 접근통제 17:40"],
  deltaSummary: "범람면 동일 · 이용자·마을 노출 제거 · 진입로 차단 전 대피 완료",
  marks: R2D0_BASE.marks.map((m, i) => ({ ...m, scene: (m.scene ?? []).map((l) => (l.kind === "point" && l.id === "b-village" ? { ...l, state: i === 0 ? "대피 필요" : "대피 완료", tone: i === 0 ? "warning" as const : "success" as const } : l)) })), arrivalAt: t("18:40"),
  targets: [road("통제됨", t("17:40")), spillway("부분 중단", t("18:00")), houses("하류 주택 6동", "통제됨", t("18:00")), visitors("통제됨", t("17:40"))],
  basis: basis(["예측강우 20 mm/h 3시간 지속", "현행 방류량 유지", "대피 완료 18:40 가정"]),
  availability: "가용", validUntil: VALID_UNTIL,
  scene: B_STATIC,
  profile: profile([[5.3, 4.4, 3.2], [5.6, 4.7, 3.4], [5.95, 5.1, 3.8], [6.1, 5.4, 4.2]]),
  conditions: [{ label: "예측강우", value: "시나리오 조건" }, { label: "방류", value: "현행 유지" }, { label: "제방 여유고", value: "0.4 m (17:00)" }],
};

/* ── 매우 강함 · 현행 방류 ── */
const R3D0_BASE: Forecast = {
  forecastId: "FC-COND-JN-R3D0-BASE", incidentId: INCIDENT_ID, alternativeId: "baseline", changedConditions: [],
  marks: marks([0.05, 0.3, 0.7, 0.95], ["GEO-JN-FLOOD-1", "GEO-JN-FLOOD-1", "GEO-JN-FLOOD-2", "GEO-JN-FLOOD-3"], ["여수로 만수 · 하류 물고임", "여수로 월류 · 순환도로 침수", "우안 범람 · 마을 진입로 차단 · 고립 위험", "좌·우안 범람 확대 · 하류 12동 침수"], ["20분 뒤", "월류 중", "범람 · 고립", "범람 확대"], [bScene(false, "정상"), bScene(false, "대피 필요"), bScene(true, "고립"), bScene(true, "고립")]),
  arrivalAt: t("17:50"),
  targets: [road("노출", t("17:50")), spillway("중단", t("18:00")), houses("하류 주택 12동", "노출", t("19:00")), visitors("노출", t("17:50"))],
  basis: basis(["예측강우 35 mm/h 3시간 지속", "현행 방류량 유지", "제방 월류 시작 수위 5.9 m 가정"]),
  availability: "가용", validUntil: VALID_UNTIL,
  scene: B_STATIC,
  profile: profile([[5.6, 4.6, 3.3], [5.95, 5.1, 3.8], [6.3, 5.7, 4.5], [6.5, 6.0, 4.9]]),
  conditions: [{ label: "예측강우", value: "시나리오 조건" }, { label: "방류", value: "현행 유지" }, { label: "제방 여유고", value: "0.4 m (17:00)" }],
};
const R3D0_EVAC: Forecast = {
  forecastId: "FC-COND-JN-R3D0-EVAC", incidentId: INCIDENT_ID, alternativeId: "evacuation", changedConditions: ["하류 마을 대피 개시 17:30", "순환도로·친수공간 접근통제 17:20"],
  deltaSummary: "범람면 동일 · 고립 구역 발생 전 대피 완료 · 12동 노출 제거",
  marks: R3D0_BASE.marks.map((m, i) => ({ ...m, scene: (m.scene ?? []).map((l) => (l.kind === "point" && l.id === "b-village" ? { ...l, state: i === 0 ? "대피 필요" : "대피 완료", tone: i === 0 ? "warning" as const : "success" as const } : l)) })), arrivalAt: t("17:50"),
  targets: [road("통제됨", t("17:20")), spillway("중단", t("18:00")), houses("하류 주택 12동", "통제됨", t("17:30")), visitors("통제됨", t("17:20"))],
  basis: basis(["예측강우 35 mm/h 3시간 지속", "현행 방류량 유지", "대피 완료 18:30 가정"]),
  availability: "가용", validUntil: VALID_UNTIL,
  scene: B_STATIC,
  profile: profile([[5.6, 4.6, 3.3], [5.95, 5.1, 3.8], [6.3, 5.7, 4.5], [6.5, 6.0, 4.9]]),
  conditions: [{ label: "예측강우", value: "시나리오 조건" }, { label: "방류", value: "현행 유지" }, { label: "제방 여유고", value: "0.4 m (17:00)" }],
};

/* ── 매우 강함 · 대안: 사전 방류 (현상을 줄이는 대안 — 종단도 수위가 낮아지고 범람면이 준다) ── */
const R3_DISCHARGE: Forecast = {
  forecastId: "FC-COND-JN-R3-DISCHARGE", incidentId: INCIDENT_ID, alternativeId: "discharge", changedConditions: ["강우 전 16:00 사전 방류로 저류 여유 0.5 m 확보"],
  deltaSummary: "저류 여유로 첨두수위 감소 · 여수로 월류 1시간 10분 지연 · 최대 범람심 0.95 → 0.45 m · 고립 없음",
  marks: marks([0.0, 0.05, 0.3, 0.45], ["GEO-JN-BANK", "GEO-JN-FLOOD-1", "GEO-JN-FLOOD-1", "GEO-JN-FLOOD-2"], ["사전 방류로 여유고 0.9 m", "여수로 부분 유하 · 하류 물고임", "하류 도로 침수 · 월류 없음", "우안 저지대 일부 범람"], ["80분 뒤", "50분 뒤", "월류 직전", "월류 중"], [bScene(false, "정상"), bScene(false, "정상"), bScene(false, "정상"), bScene(false, "대피 필요")]),
  arrivalAt: t("18:50"),
  targets: [road("노출", t("18:50")), spillway("부분 중단", t("19:00")), houses("하류 주택 4동", "노출", t("19:40")), visitors("노출", t("18:50"))],
  basis: basis(["예측강우 35 mm/h 3시간 지속", "16:00 사전 방류로 저수위 0.5 m 낮춤", "방류로 인한 하류 수위 상승 반영"]),
  availability: "가용", validUntil: VALID_UNTIL,
  scene: B_STATIC,
  profile: profile([[5.1, 4.5, 3.2], [5.4, 4.7, 3.4], [5.8, 5.0, 3.7], [6.0, 5.2, 4.0]]),
  conditions: [{ label: "예측강우", value: "시나리오 조건" }, { label: "방류", value: "사전 방류 16:00" }, { label: "제방 여유고", value: "0.4 m (17:00)" }],
};

export const JUNAM_CONDITION_FORECASTS: Forecast[] = [R2D0_BASE, R2D0_EVAC, R3D0_BASE, R3D0_EVAC, R3_DISCHARGE];

const RAIN = {
  R1: { key: "rain", label: "예측강우", value: "보통", note: "10 mm/h" },
  R2: { key: "rain", label: "예측강우", value: "강함", note: "20 mm/h" },
  R3: { key: "rain", label: "예측강우", value: "매우 강함", note: "35 mm/h" },
} as const;
const OBJECTIVES = ["상류 강우에서 하류 도달까지의 시간 확인", "방류 조건에 따른 범람 범위 차이 비교", "고립 구역 발생 전 대피 개시 시점 결정"];
const CHANGEABLE = ["방류 시나리오", "접근통제·대피 개시 시점"];

const set = (setId: string, rain: typeof RAIN[keyof typeof RAIN], base: string | null, alts: string[], unavailableReason?: string): TrainingConditionSet => ({
  setId, twinFamily: "B", regionId: "junam", label: `예측강우 ${rain.value}`, incidentId: INCIDENT_ID,
  params: [rain], baselineForecastId: base, alternativeForecastIds: alts,
  objectives: OBJECTIVES, goal: "고립 전 대피 개시 시점을 결정하세요", changeableConditions: CHANGEABLE, unavailableReason,
});

export const JUNAM_CONDITION_SETS: TrainingConditionSet[] = [
  set("JN-R2", RAIN.R2, R2D0_BASE.forecastId, [R2D0_EVAC.forecastId]),
  set("JN-R3", RAIN.R3, R3D0_BASE.forecastId, [R3_DISCHARGE.forecastId, R3D0_EVAC.forecastId]),
  set("JN-R1", RAIN.R1, null, [], "보통 강우에서는 여수로 유하 범위라 범람 예측판을 두지 않았다 · 홍수예측 연계 시 계산 요청"),
];
