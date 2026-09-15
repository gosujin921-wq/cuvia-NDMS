/* ─────────────────────────────────────────────
 * C 해안 경계·월류 — 구항 방파제 조건 세트 (03 §8 · §16 비교 기준안)
 *
 * 축은 03 §8 기준·대안 조건에서 뽑았다. 조위 편차(예보대로·+30 cm·+60 cm) × 파고(1 m 이하·2 m 이상) 여섯
 * 조합, 넷에 예측판이 있다. 대안은 수문·방호(03 "수문·방호시설 조건")와 해안 통제(03 "해안도로 통제와 대피
 * 시점"). 시간축은 만조(18:24) 전후 — 눈금 17:50·18:10·18:30·18:50. 배수권역이 아니라 해안선·월류 구간이
 * 공간 단위다. 값은 시나리오 편집값이고 폭풍해일 전용 모델 성능을 주장하지 않는다.
 * ───────────────────────────────────────────── */

import type { Forecast, ForecastBasis, ForecastMark, ImpactTarget } from "../../model/forecast";
import type { TrainingConditionSet } from "../../model/training";
import type { LngLat, SceneLayer, ScenePoint } from "../../model/scene";

const INCIDENT_ID = "INC-2024-0921-GH01";
const t = (hhmm: string) => `2024-09-21T${hhmm}:00+09:00`;
const BASE = t("17:00");
const VALID_UNTIL = t("19:30");
const AT = { a: t("17:50"), b: t("18:10"), c: t("18:30"), d: t("18:50") };

/** 해안선·월류 구간·저지대 침수면 — 시나리오 편집 폴리곤 */
export const GUHANG_GEOMETRIES: Record<string, [number, number][]> = {
  "GEO-GH-COAST": [[128.5745, 35.2032], [128.5775, 35.2034], [128.5778, 35.2008], [128.5748, 35.2006]],
  "GEO-GH-OVER-1": [[128.5752, 35.2026], [128.5766, 35.2028], [128.5767, 35.2019], [128.5753, 35.2017]],
  "GEO-GH-OVER-2": [[128.5748, 35.2028], [128.5772, 35.2031], [128.5774, 35.2013], [128.575, 35.201]],
  "GEO-GH-OVER-3": [[128.5742, 35.2031], [128.5778, 35.2035], [128.5782, 35.2006], [128.5744, 35.2002]],
};

/* ── 장면 층 (03 §22 C) — 방호시설 선이 먼저 읽히고, 물은 월류 지점에서 육지로 든다 ── */
const BREAKWATER: LngLat[] = [[128.5742, 35.2036], [128.5758, 35.2038], [128.5772, 35.2036], [128.5781, 35.2028]];
const SEAWALL: LngLat[] = [[128.5745, 35.2032], [128.5762, 35.2032], [128.5776, 35.2030]];
const WHARF_AT: LngLat = [128.5760, 35.2029];
const ROAD_AT: LngLat = [128.5768, 35.2024];
const BOATS_AT: LngLat = [128.5766, 35.2036];
const C_STATIC: SceneLayer[] = [
  { kind: "line", id: "c-breakwater", role: "방호시설", coords: BREAKWATER, state: "on", label: "방파제" },
  { kind: "line", id: "c-seawall", role: "방호시설", coords: SEAWALL, state: "on", label: "물양장 호안 · 수문" },
  { kind: "point", id: "c-tide", at: [128.5768, 35.2012], icon: "mdi:waves", label: "구항 조위계", state: "실측", tone: "primary", small: true },
];
/** 월류 지점 — 그 시각에 넘치는 곳만 켠다 */
const over = (id: string, at: LngLat, label: string, active: boolean): ScenePoint => ({ kind: "point", id, at, icon: "mdi:arrow-down-bold", label, state: active ? "월류 중" : "월류 전", tone: active ? "danger" : "neutral" });
const boatPoint = (state: "정박" | "노출" | "이동 계류"): ScenePoint => ({ kind: "point", id: "c-boats", at: BOATS_AT, icon: "mdi:ferry", label: "계류 선박", state, tone: state === "노출" ? "warning" : state === "이동 계류" ? "success" : "neutral" });
const sceneAt = (wharfOver: boolean, roadOver: boolean, boatState: "정박" | "노출" | "이동 계류"): SceneLayer[] => [
  over("c-over-wharf", WHARF_AT, "물양장", wharfOver),
  over("c-over-road", ROAD_AT, "해안도로", roadOver),
  boatPoint(boatState),
];

const basis = (assumptions: string[], overrides: Partial<ForecastBasis> = {}): ForecastBasis => ({
  modelName: "시나리오 해안 월류 결과 세트", modelVersion: "0.1", baseTime: BASE, generatedAt: BASE,
  inputEventIds: [], assumptions,
  uncertainty: { grade: "높음", sensitiveTo: ["만조 시각 전후 기압·바람", "방파제 마루고·수문 제원"], unusableRanges: ["18:50 이후 (다음 조위 갱신 필요)"] },
  inputQuality: "보정", calculationActor: "해당 없음",
  replacementNote: "폭풍해일 전용 모델·조위 실연계 확보 시 ModelRun 결과로 교체",
  ...overrides,
});

/** 첫 줄 지표 — 월류 시작 시각·구간(03 §26). 값은 침수심이라 지도 진하기에 쓰고, 문장이 첫 줄에 선다 */
const marks = (d: [number, number, number, number], g: [string, string, string, string], n: [string, string, string, string], overText: [string, string, string, string], scenes?: [SceneLayer[], SceneLayer[], SceneLayer[], SceneLayer[]]): ForecastMark[] =>
  ([AT.a, AT.b, AT.c, AT.d] as const).map((validAt, i) => ({
    validAt, maxDepthM: d[i], extentGeometryId: g[i], impactSummary: n[i],
    metric: { label: "월류", value: d[i], unit: "m", digits: 2, text: overText[i] },
    ...(scenes ? { scene: scenes[i] } : {}),
  }));

const road = (exposure: ImpactTarget["exposure"], arrivalAt?: string): ImpactTarget => ({ kind: "도로", id: "RD-GH-COAST", label: "해안도로 구항 구간", arrivalAt, exposure });
const wharf = (exposure: ImpactTarget["exposure"], arrivalAt?: string): ImpactTarget => ({ kind: "중요시설", id: "FAC-GH-WHARF", label: "물양장·방파제 등대", arrivalAt, exposure });
const shops = (label: string, exposure: ImpactTarget["exposure"], arrivalAt?: string): ImpactTarget => ({ kind: "건물", id: "BLD-GH-LOW", label, arrivalAt, exposure });
const boats = (exposure: ImpactTarget["exposure"], arrivalAt?: string): ImpactTarget => ({ kind: "대상자", id: "POP-GH-WHARF", label: "물양장 이용자·계류 선박", arrivalAt, exposure });

/* ── +30 cm · 1 m 이하 ── */
const T1W0_BASE: Forecast = {
  forecastId: "FC-COND-GH-T1W0-BASE", incidentId: INCIDENT_ID, alternativeId: "baseline", changedConditions: [],
  marks: marks([0.0, 0.05, 0.12, 0.06], ["GEO-GH-COAST", "GEO-GH-OVER-1", "GEO-GH-OVER-1", "GEO-GH-OVER-1"], ["방파제 마루 아래 · 월류 없음", "만조 접근 · 물양장 저지대 물고임", "만조 정점 · 물양장 월류 · 해안도로 갓길 침수", "조위 하강 · 물 빠짐"], ["월류 전", "월류 전", "물양장 월류", "물 빠짐"], [sceneAt(false, false, "정박"), sceneAt(false, false, "정박"), sceneAt(true, false, "노출"), sceneAt(false, false, "정박")]),
  arrivalAt: t("18:05"),
  targets: [road("노출", t("18:25")), wharf("노출", t("18:05")), shops("저지대 상가 3동", "통제됨"), boats("노출", t("18:05"))],
  basis: basis(["예측조위 +30 cm 편차", "유의파고 1 m 이하", "수문 폐쇄 · 방파제 현 제원"]),
  availability: "가용", validUntil: VALID_UNTIL,
  scene: C_STATIC,
  conditions: [{ label: "만조", value: "18:24 · 176 cm 예보" }, { label: "조위 편차", value: "시나리오 조건" }, { label: "파고", value: "시나리오 조건" }],
};
const T1W0_CTRL: Forecast = {
  forecastId: "FC-COND-GH-T1W0-CTRL", incidentId: INCIDENT_ID, alternativeId: "coast-control", changedConditions: ["물양장·해안도로 접근통제 17:50"],
  deltaSummary: "월류 범위 동일 · 이용자·선박 노출 제거",
  marks: T1W0_BASE.marks.map((m) => ({ ...m, scene: (m.scene ?? []).map((l) => (l.id === "c-boats" ? boatPoint("이동 계류") : l)) })), arrivalAt: t("18:05"),
  targets: [road("통제됨", t("17:50")), wharf("통제됨", t("17:50")), shops("저지대 상가 3동", "통제됨"), boats("통제됨", t("17:50"))],
  basis: basis(["예측조위 +30 cm 편차", "유의파고 1 m 이하", "통제 완료 17:50 가정"]),
  availability: "가용", validUntil: VALID_UNTIL,
  scene: C_STATIC,
  conditions: [{ label: "만조", value: "18:24 · 176 cm 예보" }, { label: "조위 편차", value: "시나리오 조건" }, { label: "파고", value: "시나리오 조건" }],
};

/* ── +30 cm · 2 m 이상 ── */
const T1W1_BASE: Forecast = {
  forecastId: "FC-COND-GH-T1W1-BASE", incidentId: INCIDENT_ID, alternativeId: "baseline", changedConditions: [],
  marks: marks([0.05, 0.18, 0.32, 0.2], ["GEO-GH-OVER-1", "GEO-GH-OVER-1", "GEO-GH-OVER-2", "GEO-GH-OVER-2"], ["처오름 월파 시작 · 물양장 물고임", "월파 지속 · 해안도로 갓길 침수", "만조 정점 · 방파제 월류 · 해안도로 통행 불가 · 상가 침수", "조위 하강 · 배수 지연"], ["월파 시작", "월파 지속", "방파제 월류", "배수 지연"], [sceneAt(true, false, "노출"), sceneAt(true, false, "노출"), sceneAt(true, true, "노출"), sceneAt(false, false, "노출")]),
  arrivalAt: t("17:45"),
  targets: [road("노출", t("18:00")), wharf("부분 중단", t("17:45")), shops("저지대 상가 6동", "노출", t("18:25")), boats("노출", t("17:45"))],
  basis: basis(["예측조위 +30 cm 편차", "유의파고 2 m 이상 · 월파 반영", "수문 폐쇄 · 방파제 현 제원"]),
  availability: "가용", validUntil: VALID_UNTIL,
  scene: C_STATIC,
  conditions: [{ label: "만조", value: "18:24 · 176 cm 예보" }, { label: "조위 편차", value: "시나리오 조건" }, { label: "파고", value: "시나리오 조건" }],
};
const T1W1_GATE: Forecast = {
  forecastId: "FC-COND-GH-T1W1-GATE", incidentId: INCIDENT_ID, alternativeId: "gate", changedConditions: ["배수구 역류방지 수문 사전 폐쇄 17:30", "물양장 차수판 설치"],
  deltaSummary: "최대 침수심 0.32 → 0.18 m · 상가 침수 없음",
  marks: marks([0.05, 0.12, 0.18, 0.1], ["GEO-GH-OVER-1", "GEO-GH-OVER-1", "GEO-GH-OVER-1", "GEO-GH-OVER-1"], ["처오름 월파 시작", "월파 지속 · 물양장 물고임", "만조 정점 · 물양장 월류 · 역류 없음", "조위 하강 · 물 빠짐"], ["월파 시작", "월파 지속", "물양장 월류", "물 빠짐"], [sceneAt(true, false, "노출"), sceneAt(true, false, "노출"), sceneAt(true, false, "노출"), sceneAt(false, false, "정박")]),
  arrivalAt: t("17:45"),
  targets: [road("노출", t("18:15")), wharf("부분 중단", t("17:45")), shops("저지대 상가 6동", "통제됨"), boats("노출", t("17:45"))],
  basis: basis(["예측조위 +30 cm 편차", "유의파고 2 m 이상", "수문 사전 폐쇄 · 차수판 설치 17:30"]),
  availability: "가용", validUntil: VALID_UNTIL,
  scene: C_STATIC,
  conditions: [{ label: "만조", value: "18:24 · 176 cm 예보" }, { label: "조위 편차", value: "시나리오 조건" }, { label: "파고", value: "시나리오 조건" }],
};
const T1W1_CTRL: Forecast = {
  forecastId: "FC-COND-GH-T1W1-CTRL", incidentId: INCIDENT_ID, alternativeId: "coast-control", changedConditions: ["해안도로·물양장 통제 17:30", "저지대 상가 대피 안내 17:40"],
  deltaSummary: "월류 범위 동일 · 이용자·선박·상가 노출 제거",
  marks: T1W1_BASE.marks.map((m) => ({ ...m, scene: (m.scene ?? []).map((l) => (l.id === "c-boats" ? boatPoint("이동 계류") : l)) })), arrivalAt: t("17:45"),
  targets: [road("통제됨", t("17:30")), wharf("통제됨", t("17:30")), shops("저지대 상가 6동", "통제됨", t("17:40")), boats("통제됨", t("17:30"))],
  basis: basis(["예측조위 +30 cm 편차", "유의파고 2 m 이상", "통제·대피 완료 17:45 가정"]),
  availability: "가용", validUntil: VALID_UNTIL,
  scene: C_STATIC,
  conditions: [{ label: "만조", value: "18:24 · 176 cm 예보" }, { label: "조위 편차", value: "시나리오 조건" }, { label: "파고", value: "시나리오 조건" }],
};

/* ── +60 cm · 1 m 이하 ── */
const T2W0_BASE: Forecast = {
  forecastId: "FC-COND-GH-T2W0-BASE", incidentId: INCIDENT_ID, alternativeId: "baseline", changedConditions: [],
  marks: marks([0.02, 0.15, 0.28, 0.16], ["GEO-GH-OVER-1", "GEO-GH-OVER-1", "GEO-GH-OVER-2", "GEO-GH-OVER-1"], ["물양장 물고임", "물양장 월류 · 배수구 역류", "만조 정점 · 해안도로 침수 · 상가 유입", "조위 하강 · 배수 재개"], ["월류 전", "물양장 월류", "해안도로 월류", "배수 재개"], [sceneAt(false, false, "정박"), sceneAt(true, false, "노출"), sceneAt(true, true, "노출"), sceneAt(false, false, "정박")]),
  arrivalAt: t("17:55"),
  targets: [road("노출", t("18:10")), wharf("부분 중단", t("17:55")), shops("저지대 상가 6동", "노출", t("18:25")), boats("노출", t("17:55"))],
  basis: basis(["예측조위 +60 cm 편차 (이상조위)", "유의파고 1 m 이하", "수문 폐쇄 · 방파제 현 제원"]),
  availability: "가용", validUntil: VALID_UNTIL,
  scene: C_STATIC,
  conditions: [{ label: "만조", value: "18:24 · 176 cm 예보" }, { label: "조위 편차", value: "시나리오 조건" }, { label: "파고", value: "시나리오 조건" }],
};
const T2W0_CTRL: Forecast = {
  forecastId: "FC-COND-GH-T2W0-CTRL", incidentId: INCIDENT_ID, alternativeId: "coast-control", changedConditions: ["해안도로·물양장 통제 17:40", "상가 대피 안내 17:50"],
  deltaSummary: "월류 범위 동일 · 노출 대상 제거",
  marks: T2W0_BASE.marks.map((m) => ({ ...m, scene: (m.scene ?? []).map((l) => (l.id === "c-boats" ? boatPoint("이동 계류") : l)) })), arrivalAt: t("17:55"),
  targets: [road("통제됨", t("17:40")), wharf("통제됨", t("17:40")), shops("저지대 상가 6동", "통제됨", t("17:50")), boats("통제됨", t("17:40"))],
  basis: basis(["예측조위 +60 cm 편차", "유의파고 1 m 이하", "통제·대피 완료 17:55 가정"]),
  availability: "가용", validUntil: VALID_UNTIL,
  scene: C_STATIC,
  conditions: [{ label: "만조", value: "18:24 · 176 cm 예보" }, { label: "조위 편차", value: "시나리오 조건" }, { label: "파고", value: "시나리오 조건" }],
};

/* ── +60 cm · 2 m 이상 ── */
const T2W1_BASE: Forecast = {
  forecastId: "FC-COND-GH-T2W1-BASE", incidentId: INCIDENT_ID, alternativeId: "baseline", changedConditions: [],
  marks: marks([0.1, 0.32, 0.55, 0.38], ["GEO-GH-OVER-1", "GEO-GH-OVER-2", "GEO-GH-OVER-3", "GEO-GH-OVER-3"], ["월파 · 물양장 침수 시작", "방파제 월류 · 해안도로 통행 불가", "만조 정점 · 저지대 전면 침수 · 배수구 역류로 내수침수 연결", "조위 하강 · 역류 지속 · 배수 제약"], ["월파 시작", "방파제 월류", "전면 월류·역류", "역류 지속"], [sceneAt(true, false, "노출"), sceneAt(true, true, "노출"), sceneAt(true, true, "노출"), sceneAt(true, true, "노출")]),
  arrivalAt: t("17:35"),
  targets: [road("노출", t("17:50")), wharf("중단", t("17:35")), shops("저지대 상가 14동", "노출", t("18:05")), boats("노출", t("17:35"))],
  basis: basis(["예측조위 +60 cm 편차 (폭풍해일급)", "유의파고 2 m 이상 · 월파 반영", "수문 폐쇄 · 방파제 현 제원", "배수구 역류 → 내수침수 사건 연결 조건"]),
  availability: "가용", validUntil: VALID_UNTIL,
  scene: C_STATIC,
  conditions: [{ label: "만조", value: "18:24 · 176 cm 예보" }, { label: "조위 편차", value: "시나리오 조건" }, { label: "파고", value: "시나리오 조건" }],
};
const T2W1_GATE: Forecast = {
  forecastId: "FC-COND-GH-T2W1-GATE", incidentId: INCIDENT_ID, alternativeId: "gate", changedConditions: ["역류방지 수문 사전 폐쇄 17:20", "물양장 차수판 설치"],
  deltaSummary: "최대 침수심 0.55 → 0.4 m · 역류 차단 · 내수침수 연결 없음",
  marks: marks([0.1, 0.26, 0.4, 0.22], ["GEO-GH-OVER-1", "GEO-GH-OVER-2", "GEO-GH-OVER-2", "GEO-GH-OVER-2"], ["월파 · 물양장 침수 시작", "방파제 월류 · 해안도로 침수", "만조 정점 · 저지대 침수 · 역류 없음", "조위 하강 · 물 빠짐"], ["월파 시작", "방파제 월류", "저지대 월류", "물 빠짐"], [sceneAt(true, false, "노출"), sceneAt(true, true, "노출"), sceneAt(true, false, "노출"), sceneAt(false, false, "정박")]),
  arrivalAt: t("17:35"),
  targets: [road("노출", t("17:50")), wharf("중단", t("17:35")), shops("저지대 상가 8동", "노출", t("18:15")), boats("노출", t("17:35"))],
  basis: basis(["예측조위 +60 cm 편차", "유의파고 2 m 이상", "수문 사전 폐쇄 · 차수판 설치 17:20"]),
  availability: "가용", validUntil: VALID_UNTIL,
  scene: C_STATIC,
  conditions: [{ label: "만조", value: "18:24 · 176 cm 예보" }, { label: "조위 편차", value: "시나리오 조건" }, { label: "파고", value: "시나리오 조건" }],
};
const T2W1_CTRL: Forecast = {
  forecastId: "FC-COND-GH-T2W1-CTRL", incidentId: INCIDENT_ID, alternativeId: "coast-control", changedConditions: ["해안도로·물양장 통제 17:20", "저지대 상가 대피 17:30", "선박 이동 계류"],
  deltaSummary: "월류 범위 동일 · 이용자·선박·상가 노출 제거",
  marks: T2W1_BASE.marks.map((m) => ({ ...m, scene: (m.scene ?? []).map((l) => (l.id === "c-boats" ? boatPoint("이동 계류") : l)) })), arrivalAt: t("17:35"),
  targets: [road("통제됨", t("17:20")), wharf("통제됨", t("17:20")), shops("저지대 상가 14동", "통제됨", t("17:30")), boats("통제됨", t("17:20"))],
  basis: basis(["예측조위 +60 cm 편차", "유의파고 2 m 이상", "통제·대피·선박 이동 완료 17:35 가정"]),
  availability: "가용", validUntil: VALID_UNTIL,
  scene: C_STATIC,
  conditions: [{ label: "만조", value: "18:24 · 176 cm 예보" }, { label: "조위 편차", value: "시나리오 조건" }, { label: "파고", value: "시나리오 조건" }],
};

export const GUHANG_CONDITION_FORECASTS: Forecast[] = [T1W0_BASE, T1W0_CTRL, T1W1_BASE, T1W1_GATE, T1W1_CTRL, T2W0_BASE, T2W0_CTRL, T2W1_BASE, T2W1_GATE, T2W1_CTRL];

const TIDE = {
  T0: { key: "tide", label: "조위 편차", value: "예보대로", note: "만조 18:24 · 176 cm" },
  T1: { key: "tide", label: "조위 편차", value: "+30 cm", note: "기압·바람 상승" },
  T2: { key: "tide", label: "조위 편차", value: "+60 cm", note: "폭풍해일급" },
} as const;
const WAVE = {
  W0: { key: "wave", label: "파고", value: "1 m 이하", note: "월파 없음" },
  W1: { key: "wave", label: "파고", value: "2 m 이상", note: "월파 반영" },
} as const;

const OBJECTIVES = ["만조 전후 월류 시작 시각·구간 확인", "수문·차수 조건의 효과 비교", "해안 통제·대피 시점 결정 · 내수침수 연결 판단"];
const CHANGEABLE = ["수문·방호시설 조건", "해안도로 통제·대피 시점", "선박 이동 계류"];

const set = (setId: string, tide: typeof TIDE[keyof typeof TIDE], wave: typeof WAVE[keyof typeof WAVE], base: string | null, alts: string[], unavailableReason?: string): TrainingConditionSet => ({
  setId, twinFamily: "C", regionId: "guhang", label: `조위 ${tide.value} · 파고 ${wave.value}`, incidentId: INCIDENT_ID,
  params: [tide, wave], baselineForecastId: base, alternativeForecastIds: alts,
  objectives: OBJECTIVES, goal: "해안 통제·대피 시점을 결정하세요", changeableConditions: CHANGEABLE, unavailableReason,
});

export const GUHANG_CONDITION_SETS: TrainingConditionSet[] = [
  set("GH-T1W0", TIDE.T1, WAVE.W0, T1W0_BASE.forecastId, [T1W0_CTRL.forecastId]),
  set("GH-T1W1", TIDE.T1, WAVE.W1, T1W1_BASE.forecastId, [T1W1_GATE.forecastId, T1W1_CTRL.forecastId]),
  set("GH-T2W0", TIDE.T2, WAVE.W0, T2W0_BASE.forecastId, [T2W0_CTRL.forecastId]),
  set("GH-T2W1", TIDE.T2, WAVE.W1, T2W1_BASE.forecastId, [T2W1_GATE.forecastId, T2W1_CTRL.forecastId]),
  set("GH-T0W0", TIDE.T0, WAVE.W0, null, [], "예보 조위·저파고에서는 방파제 마루고 아래라 월류 예측판을 두지 않았다"),
  set("GH-T0W1", TIDE.T0, WAVE.W1, null, [], "이 조합의 예측판은 준비되지 않았다 · 파랑 예측 연계 시 같은 조건으로 계산 요청"),
];
