/* ─────────────────────────────────────────────
 * D 이동 전선·확산 — 무학산 산불 · 종료 사건의 대응 What-if (03 §9 · §22 D · 부록 B · §26)
 *
 * 산불의 질문은 "불과 연기가 어느 방향으로 얼마나 가는가"다. 17:05 서쪽 사면에서 난 불이 남서풍 8 m/s 를 타고
 * 북동쪽(풍하측)으로 번지고, 연기는 화선보다 앞·넓게 산자락 요양시설과 주택 쪽으로 간다.
 *
 * 종료 사건이라 기준은 **실제로 한 대응**이다 — 17:40 등산로·임도 통제 · 18:10 요양시설 이송 · 18:20 임도 기준 방화선 착수.
 * 방화선이 늦어 화선이 19:40 산자락 주택에 닿았고, 이송은 연기가 시설에 닿은 뒤에 끝났다.
 *   차단선·진압   대응 · 현상 감소 — 화선 확산 거리와 영향권이 줄고 주택 도달이 늦어지거나 사라진다
 *   대피 개시     대응 · 노출 감소 — 불과 연기는 그대로이고 연기에 노출된 입소자·주민이 준다. 선택지는 연기 도달(18:00) 앞뒤로 걸친다
 *   강풍          상황 — 남서풍이 12 m/s 였다면 같은 대응으로 버텼나. 분석 기준(판단 시점)마다 사전 계산한 판이 있다
 *
 * 화선·플룸 폴리곤과 풍향 벡터는 03 §22 D 의 표현(발화점 · 위성 관측점 · 풍향 화살표 · 플룸 · 방화선 · 대피경로)을 옮긴 시나리오 편집값이다.
 * 산불 확산 모델 결과가 아니고 정확도를 주장하지 않는다.
 * ───────────────────────────────────────────── */

import type { Forecast, ForecastBasis, ForecastInput, ForecastMark, ImpactTarget, MarkImpact, MarkMetric } from "../../model/forecast";
import type { LngLat, SceneLayer, ScenePoint } from "../../model/scene";
import type { WhatIfCase, WhatIfCombo, WhatIfResponse, WhatIfSituation } from "../../model/whatif";
import { exposedMinutes } from "../exposure";

export const MH_INCIDENT_ID = "INC-2024-0402-MH01";
const t = (hhmm: string) => `2024-04-02T${hhmm}:00+09:00`;
/** 재현·대안 판의 기준시각 — 관측 입력이 끝난 사건 종료 시각. 판은 모두 사건이 끝난 뒤 계산했다 */
const BASE = t("22:40");
const VALID_UNTIL = t("21:00");
const AT = [t("17:30"), t("18:00"), t("19:00"), t("20:00")] as const;

/* 화선 — 발화점 서쪽 사면에서 남서풍을 타고 북동쪽(풍하측)으로 번진다. 풍향은 불어오는 방향이다 */
type Ring = [number, number][];
const FIRE_3: Ring = [[128.539, 35.212], [128.553, 35.2185], [128.556, 35.2085], [128.542, 35.205]];
const FIRE_3C: Ring = [[128.539, 35.212], [128.55, 35.2165], [128.552, 35.2088], [128.542, 35.206]];
const FIRE_4: Ring = [[128.538, 35.2125], [128.557, 35.222], [128.561, 35.208], [128.542, 35.203]];
const FIRE_4C: Ring = [[128.538, 35.2125], [128.551, 35.217], [128.553, 35.2085], [128.542, 35.204]];
/** 두 화선 사이 — 꼭짓점끼리 가운데. 방화선이 늦게 선 만큼 덜 막힌 화선을 편집할 때 쓴다 */
const between = (a: Ring, b: Ring, w = 0.5): Ring => a.map(([x, y], i) => [Number((x + (b[i][0] - x) * w).toFixed(5)), Number((y + (b[i][1] - y) * w).toFixed(5))]);
export const MUHAK_GEOMETRIES: Record<string, [number, number][]> = {
  "GEO-D-SCOPE": [[128.535, 35.222], [128.56, 35.224], [128.562, 35.204], [128.537, 35.202]],
  "GEO-D-FIRE-1": [[128.541, 35.211], [128.545, 35.2125], [128.546, 35.2095], [128.542, 35.2085]],
  "GEO-D-FIRE-2": [[128.54, 35.2115], [128.549, 35.215], [128.551, 35.209], [128.542, 35.207]],
  "GEO-D-FIRE-3C": FIRE_3C,
  "GEO-D-FIRE-3M": between(FIRE_3C, FIRE_3),
  "GEO-D-FIRE-4C": FIRE_4C,
  "GEO-D-FIRE-4N": between(FIRE_4C, FIRE_4, 0.3),
  "GEO-D-FIRE-4M": between(FIRE_4C, FIRE_4, 0.6),
  /* 방화선에 막히지 않은 화선 — 강풍(상황 조건)에서 쓴다 */
  "GEO-D-FIRE-3": FIRE_3,
  "GEO-D-FIRE-4": FIRE_4,
};

/* ── 장면 층 (03 §22 D · 부록 B) — 남서풍 8 m/s → 이동 방향 북동(45°). 플룸은 화선보다 앞·넓게 ── */
const IGNITION: LngLat = [128.5435, 35.2105];
const WIND_BEARING = 45;
const windOf = (speed: number): SceneLayer[] => ([[128.537, 35.205], [128.545, 35.207], [128.553, 35.209], [128.539, 35.213], [128.547, 35.215], [128.555, 35.217], [128.543, 35.221], [128.551, 35.223]] as LngLat[])
  .map((at, i) => ({ kind: "vector" as const, id: `d-wind-${i}`, role: "풍향" as const, at, bearing: WIND_BEARING, magnitude: speed, unit: "m/s", ...(i === 0 ? { label: `남서풍 ${speed} m/s` } : {}) }));
const staticOf = (speed: number): SceneLayer[] => [
  { kind: "point", id: "d-ignition", at: IGNITION, icon: "mdi:fire", label: "발화점", state: "17:05 발화", tone: "danger" },
  ...([[128.5418, 35.2088], [128.5452, 35.2092], [128.5458, 35.2118], [128.5424, 35.2124]] as LngLat[]).map<ScenePoint>((at, i) => ({ kind: "point", id: `d-hotspot-${i}`, at, icon: "mdi:circle", label: "위성 관측점", tone: "warning", small: true })),
  { kind: "line", id: "d-trail", role: "하천", coords: [[128.539, 35.2075], [128.547, 35.2125], [128.553, 35.2168], [128.557, 35.2205]], state: "on", label: "임도" },
  ...windOf(speed),
];
const D_STATIC = staticOf(8);
const CARE_AT: LngLat = [128.5545, 35.2178];
const HOMES_AT: LngLat = [128.5585, 35.2208];
type FacState = "정상" | "영향 예상" | "영향 임박" | "영향권" | "대피 완료" | "통제됨";
const facility = (id: string, at: LngLat, icon: string, label: string, state: FacState): ScenePoint => ({
  kind: "point", id, at, icon, label, state,
  tone: state === "정상" ? "success" : state === "영향 예상" ? "neutral" : state === "영향 임박" ? "warning" : state === "영향권" ? "danger" : "success",
});
const PLUME: LngLat[][] = [
  [[128.5425, 35.2098], [128.548, 35.2135], [128.552, 35.2115], [128.545, 35.2088]],
  [[128.5425, 35.2098], [128.553, 35.2185], [128.559, 35.2145], [128.547, 35.2082]],
  [[128.5425, 35.2098], [128.558, 35.2235], [128.566, 35.217], [128.549, 35.2078]],
];
const FIREBREAK: LngLat[] = [[128.5495, 35.2135], [128.5535, 35.2165], [128.5565, 35.2195]];
const EVAC_ROUTE: LngLat[] = [[128.5545, 35.2178], [128.556, 35.213], [128.5595, 35.2095], [128.563, 35.207]];

/** 한 눈금의 장면 — 플룸 · 방화선(착수 전 예정) · 대피경로 · 요양시설 · 산자락 주택 */
const sceneAt = (i: number, s: { plume: number; breakFrom: string; evacFrom: string; care: FacState; homes: FacState }): SceneLayer[] => [
  { kind: "area", id: "d-plume", role: "플룸", ring: PLUME[s.plume] },
  { kind: "line", id: "d-firebreak", role: "방화선", coords: FIREBREAK, state: AT[i] >= s.breakFrom ? "on" : "planned", label: AT[i] >= s.breakFrom ? "방화선" : "방화선 (예정)" },
  { kind: "line", id: "d-evac-route", role: "대피경로", coords: EVAC_ROUTE, state: AT[i] >= s.evacFrom ? "on" : "planned", label: "대피경로 (남동)" },
  facility("d-care", CARE_AT, "mdi:hospital-building", "산자락 요양시설", s.care),
  facility("d-homes", HOMES_AT, "mdi:home-group", "산자락 주택", s.homes),
];

/* 재현 입력 — 사건 동안의 관측·운영 기록. 예보는 쓰지 않는다(이미 일어난 일이다) */
const INPUTS: ForecastInput[] = [
  { label: "위성 활성화재 관측", at: t("22:40"), kind: "관측" },
  { label: "산불 감시 CCTV", at: t("22:40"), kind: "관측" },
  { label: "풍향·풍속·습도 관측", at: t("22:40"), kind: "관측" },
  { label: "진화 자원 투입 기록", at: t("22:40"), kind: "시설" },
];
/** 재현은 관측이 입력이라 불확실성이 보통, 대안은 일어나지 않은 진행이라 높다. 둘 다 사건이 끝난 뒤(23:10) 계산했다 */
const basis = (assumptions: string[], modelName = "대안 계산 (재현과 같은 방식 · 대응만 변경)", grade: ForecastBasis["uncertainty"]["grade"] = "높음"): ForecastBasis => ({
  modelName, modelVersion: "0.1", baseTime: BASE, generatedAt: t("23:10"),
  observedFrom: t("17:05"), inputs: INPUTS, inputEventIds: [], assumptions,
  uncertainty: { grade, sensitiveTo: ["풍향 변화", "능선 넘는 비화"], unusableRanges: ["21:00 이후"] },
  inputQuality: "보정", calculationActor: "해당 없음",
  replacementNote: "산불 확산 모델(산림청 등) 연계 시 같은 계약의 ModelRun 결과로 교체",
});

type Four<T> = [T, T, T, T];
const km = (v: number): MarkMetric => ({ label: "화선 확산 거리", value: v, unit: "km", digits: 1 });
const FAC_TONE: Record<FacState, MarkImpact["tone"]> = { 정상: "muted", "영향 예상": "muted", "영향 임박": "warning", 영향권: "danger", "대피 완료": "safe", 통제됨: "safe" };
/** 그 시각의 핵심 영향 — 요양시설 상태와 산자락 주택(화선이 닿은 동 수) */
const impactsOf = (care: FacState, homes: FacState, homeCount: number): MarkImpact[] => [
  { label: "산자락 요양시설", value: care, tone: FAC_TONE[care] },
  { label: "산자락 주택", value: homeCount > 0 ? "화선 도달" : homes, tone: homeCount > 0 ? "danger" : FAC_TONE[homes] },
];
const marksOf = (d: Four<number>, g: Four<string>, n: Four<string>, s: Omit<Parameters<typeof sceneAt>[1], "plume" | "care" | "homes"> & { plume: Four<number>; care: Four<FacState>; homes: Four<FacState>; homeCounts: Four<number> }): ForecastMark[] =>
  AT.map((validAt, i) => ({
    validAt, maxDepthM: 0, metric: km(d[i]), extentGeometryId: g[i], impactSummary: n[i],
    scene: sceneAt(i, { plume: s.plume[i], breakFrom: s.breakFrom, evacFrom: s.evacFrom, care: s.care[i], homes: s.homes[i] }),
    impacts: impactsOf(s.care[i], s.homes[i], s.homeCounts[i]),
  }));

/* ── 노출 규칙 — 연기가 요양시설에 닿은 뒤(18:00) 이송이 끝나기까지 걸린 시간. 이송은 입소자 60명 · 차량 3대로 40분 걸린다 ──
   몇 명이 연기를 마셨는지는 쓰지 않는다 — 인과가 약한 후행 피해다. 노출된 시간은 같은 기록에 이송 시각만 바꿔 규칙으로 나온다 */
const SMOKE_AT_CARE = t("18:00");
const EVAC_MINUTES = 40;
const MH_EXPOSURE_RULE = `연기 노출 = 이송 완료(시작 + ${EVAC_MINUTES}분) − 연기 요양시설 도달(18:00)`;
const plus = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();

/* 영향 대상 — 산자락 주택이 첫째다(도달 = 화선이 주택에 닿는 시각). 도달이 없으면 시각을 비운다.
   동 수는 적지 않는다(README §2.3 기준 ③). 연기 노출은 시간 차라 그대로 둔다 — 곱해서 만든 수가 아니다 */
const targets = (homes: number, homesAt: string | null, evacAt: string, smokeAt = SMOKE_AT_CARE): ImpactTarget[] => {
  const smoke = exposedMinutes(smokeAt, plus(evacAt, EVAC_MINUTES));
  return [
    { kind: "건물", id: "BLD-MH-EDGE", label: "산자락 주택", ...(homesAt ? { arrivalAt: homesAt } : {}), exposure: homes > 0 ? "노출" : "영향 없음" },
    { kind: "중요시설", id: "FAC-MH-CARE", label: `요양시설 연기 노출 ${smoke}분`, exposure: smoke > 0 ? "노출" : "통제됨" },
    { kind: "도로", id: "RD-MH-TRAIL", label: "무학산 임도·등산로", exposure: "통제됨" },
  ];
};
const conditions = (breakAt: string, evacAt: string, wind = "남서풍 8 m/s"): Forecast["conditions"] => [
  { label: "풍향·풍속", value: wind, tone: "warning" },
  { label: "습도", value: "21 % · 건조경보" },
  { label: "방화선", value: `임도 기준 · ${breakAt.slice(11, 16)} 착수` },
  { label: "대피", value: `요양시설 이송 ${evacAt.slice(11, 16)}` },
];
const common = { incidentId: MH_INCIDENT_ID, availability: "가용" as const, validUntil: VALID_UNTIL, scene: D_STATIC };

/* 실제 대응 시각 — 이송 18:10 · 방화선 18:20 */
const ACTUAL_EVAC = t("18:10");
const ACTUAL_BREAK = t("18:20");

/* ── 실제 — 방화선이 늦어 19:00 화선 1.6 km · 19:40 산자락 주택 도달 ── */
const ACTUAL_D: Four<number> = [0.4, 0.9, 1.6, 2.1];
const ACTUAL_G: Four<string> = ["GEO-D-FIRE-1", "GEO-D-FIRE-2", "GEO-D-FIRE-3M", "GEO-D-FIRE-4M"];
const ACTUAL_N: Four<string> = ["발화점 서쪽 사면 · 화선 0.4 km · 남서풍 8 m/s", "풍하측(북동) 확산 · 임도 차단 · 연기 능선 넘음", "방화선 앞까지 확산 · 요양시설 연기 노출", "방화선 끝 돌아 산자락 주택 도달"];
const ACTUAL_S = { plume: [0, 1, 2, 2] as Four<number>, care: ["정상", "영향 예상", "대피 완료", "대피 완료"] as Four<FacState>, homes: ["정상", "정상", "영향 임박", "영향권"] as Four<FacState>, homeCounts: [0, 0, 0, 6] as Four<number> };
export const MH_ACTUAL: Forecast = {
  ...common, forecastId: "FC-MH-ACTUAL", alternativeId: "baseline", changedConditions: [],
  marks: marksOf(ACTUAL_D, ACTUAL_G, ACTUAL_N, { ...ACTUAL_S, breakFrom: ACTUAL_BREAK, evacFrom: ACTUAL_EVAC }),
  arrivalAt: t("19:40"),
  targets: targets(6, t("19:40"), ACTUAL_EVAC),
  basis: basis(["관측 풍향·위성 화재점을 넣어 다시 계산", "실제 대응: 이송 18:10 · 방화선 착수 18:20 · 헬기 18:30", MH_EXPOSURE_RULE], "재현 계산 (관측 풍향·위성 화재점 입력)", "보통"),
  conditions: conditions(ACTUAL_BREAK, ACTUAL_EVAC),
};

/* ── 방화선을 일찍 — 화선이 방화선에서 멈추는 만큼 확산 거리와 주택 도달이 준다 ── */
interface BreakSpec { at: string; early: string; key: string; presetId: string; d: Four<number>; g: Four<string>; n: Four<string>; homes: Four<FacState>; homeCount: number; homesAt: string | null }
const BREAKS: BreakSpec[] = [
  {
    at: t("18:10"), early: "10분 일찍", key: "BREAK-10", presetId: "early10", d: [0.4, 0.9, 1.4, 1.8], g: ["GEO-D-FIRE-1", "GEO-D-FIRE-2", "GEO-D-FIRE-3C", "GEO-D-FIRE-4N"],
    n: ["발화점 서쪽 사면 · 화선 0.4 km", "풍하측 확산 · 임도 방화선 착수", "방화선에서 확산 둔화 · 요양시설 연기 노출", "방화선 끝 일부 넘음 · 산자락 주택 3동 영향"],
    homes: ["정상", "정상", "영향 예상", "영향권"], homeCount: 3, homesAt: t("19:55"),
  },
  {
    at: t("18:00"), early: "20분 일찍", key: "BREAK-20", presetId: "early20", d: [0.4, 0.9, 1.3, 1.6], g: ["GEO-D-FIRE-1", "GEO-D-FIRE-2", "GEO-D-FIRE-3C", "GEO-D-FIRE-4C"],
    n: ["발화점 서쪽 사면 · 화선 0.4 km", "풍하측 확산 · 임도 방화선 완성", "방화선에서 확산 둔화 · 요양시설 접근 차단", "능선 구간 진압 · 주택 도달 없음"],
    homes: ["정상", "정상", "영향 예상", "영향 예상"], homeCount: 0, homesAt: null,
  },
];
const breakBoard = (b: BreakSpec): Forecast => ({
  ...common, forecastId: `FC-MH-${b.key}`, alternativeId: "containment",
  changedConditions: [`임도 기준 방화선 착수 · ${b.at.slice(11, 16)} (실제보다 ${b.early})`],
  hypothesis: `방화선을 실제보다 ${b.early}(${b.at.slice(11, 16)}) 착수한 경우`,
  marks: marksOf(b.d, b.g, b.n, { plume: [0, 1, 2, 1], care: ACTUAL_S.care, homes: b.homes, homeCounts: [0, 0, 0, b.homeCount], breakFrom: b.at, evacFrom: ACTUAL_EVAC }),
  arrivalAt: b.homesAt ?? VALID_UNTIL,
  targets: targets(b.homeCount, b.homesAt, ACTUAL_EVAC),
  basis: basis(["관측 풍향·풍속 입력 (기준 재현과 같음)", `방화선 착수 ${b.at.slice(11, 16)} 가정 · 이송은 실제(18:10) 그대로`]),
  conditions: conditions(b.at, ACTUAL_EVAC),
  actionAt: { label: "방화선 착수", at: b.at },
});
export const MH_BREAK_10 = breakBoard(BREAKS[0]);
export const MH_BREAK_20 = breakBoard(BREAKS[1]);

/* ── 이송을 일찍 — 불과 연기는 그 판 그대로, 연기에 노출된 사람만 준다 ──
   선택지는 트윈이 계산한 연기 도달(18:00) 앞뒤로 걸친다 — 이송은 40분 걸리므로 50분 일찍(확산 예측 직후 17:20)이어야 연기 전에 끝난다.
   요양시설 상태는 같은 규칙으로 읽는다: 이송이 끝났으면 대피 완료, 연기가 닿았는데 아직이면 영향권 */
const EVACS = [
  { at: t("17:40"), early: "30분 일찍", key: "EVAC-30", presetId: "early30" },
  { at: t("17:20"), early: "50분 일찍", key: "EVAC-50", presetId: "early50" },
] as const;
/* 시각 비교는 밀리초로 — plus() 는 UTC 표기라 문자열로 견주면 틀린다 */
const careOf = (base: Four<FacState>, evacAt: string, smokeAt: string): Four<FacState> =>
  AT.map((at, i) => {
    const now = new Date(at).getTime();
    return now >= new Date(plus(evacAt, EVAC_MINUTES)).getTime() ? "대피 완료" : now >= new Date(smokeAt).getTime() ? "영향권" : base[i];
  }) as Four<FacState>;
interface FireSpec { d: Four<number>; g: Four<string>; n: Four<string>; s: { plume: Four<number>; care: Four<FacState>; homes: Four<FacState>; homeCounts: Four<number> }; homesAt: string | null; smokeAt: string; scene?: SceneLayer[]; wind?: string }
const ACTUAL_FIRE: FireSpec = { d: ACTUAL_D, g: ACTUAL_G, n: ACTUAL_N, s: ACTUAL_S, homesAt: t("19:40"), smokeAt: SMOKE_AT_CARE };
const evacOn = (id: string, e: (typeof EVACS)[number], f: FireSpec, lines: string[], extraChanged: string[] = []): Forecast => ({
  ...common, ...(f.scene ? { scene: f.scene } : {}), forecastId: id, alternativeId: "evacuation",
  changedConditions: [...extraChanged, `요양시설 이송 · 풍하측 주민 대피 안내 · ${e.at.slice(11, 16)} (실제보다 ${e.early})`],
  hypothesis: `요양시설 이송을 실제보다 ${e.early}(${e.at.slice(11, 16)}) 시작한 경우`,
  marks: marksOf(f.d, f.g, f.n, { ...f.s, care: careOf(f.s.care, e.at, f.smokeAt), breakFrom: ACTUAL_BREAK, evacFrom: e.at }),
  arrivalAt: f.homesAt ?? VALID_UNTIL,
  targets: targets(Math.max(...f.s.homeCounts), f.homesAt, e.at, f.smokeAt),
  basis: basis([...lines, `이송 ${e.at.slice(11, 16)} 시작 가정 · 플룸 밖 남동 방향 경로`, MH_EXPOSURE_RULE], "규칙 계산 (같은 기록에 이송 시각만 변경)"),
  conditions: conditions(ACTUAL_BREAK, e.at, f.wind),
  actionAt: { label: "이송 시작", at: e.at },
});
export const MH_EVAC_30 = evacOn("FC-MH-EVAC-30", EVACS[0], ACTUAL_FIRE, ["화선·플룸은 기준 재현과 동일"]);
export const MH_EVAC_50 = evacOn("FC-MH-EVAC-50", EVACS[1], ACTUAL_FIRE, ["화선·플룸은 기준 재현과 동일"]);

/* ── 상황 조건 · 강풍 — 남서풍이 8 이 아니라 12 m/s 였다면. 대응은 실제(이송 18:10 · 방화선 18:20) 그대로 ──
   분석 기준(▲)까지는 실제와 같고 거기서부터 풍속만 바꾼다. 늦게 바뀔수록 확산이 덜 붙는다.
   연기가 요양시설에 닿는 시각도 풍속이 정한다 — 연기 노출은 같은 규칙(이송 완료 − 연기 도달)이다 */
const DECISIONS = [t("17:20"), t("17:50"), t("18:20")] as const;
interface WindSpec extends FireSpec { from: string; homesAt: string }
const WIND_COND = "남서풍 12 m/s · 강풍";
const windLine = (from: string) => `남서풍 8 → 12 m/s (${from.slice(11, 16)} 이후)`;
const windFrom = (w: WindSpec): Forecast => ({
  ...common, scene: staticOf(12), forecastId: `FC-MH-WIND-${w.from.slice(11, 13)}${w.from.slice(14, 16)}`, alternativeId: "situation",
  changedConditions: [`남서풍 12 m/s · ${w.from.slice(11, 16)} 이후 (실제 8 m/s)`],
  hypothesis: `${w.from.slice(11, 16)} 이후 남서풍이 실제보다 4 m/s 강했던 경우`,
  marks: marksOf(w.d, w.g, w.n, { ...w.s, breakFrom: ACTUAL_BREAK, evacFrom: ACTUAL_EVAC }),
  arrivalAt: w.homesAt,
  targets: targets(Math.max(...w.s.homeCounts), w.homesAt, ACTUAL_EVAC, w.smokeAt),
  basis: basis([windLine(w.from), "실제 대응 그대로: 이송 18:10 · 방화선 착수 18:20 · 헬기 18:30", MH_EXPOSURE_RULE], "대안 계산 (재현과 같은 방식 · 상황 입력만 변경)"),
  conditions: conditions(ACTUAL_BREAK, ACTUAL_EVAC, WIND_COND),
});
const WINDS: WindSpec[] = [
  /* 17:20 부터 — 연기가 17:45 에 요양시설에 닿고, 방화선을 넘은 화선이 18:45 산자락 주택에 닿아 20:00 11동 */
  {
    from: DECISIONS[0], d: [0.5, 1.2, 2.1, 2.7], g: ["GEO-D-FIRE-1", "GEO-D-FIRE-2", "GEO-D-FIRE-3", "GEO-D-FIRE-4"],
    n: ["발화점 서쪽 사면 · 화선 0.5 km · 남서풍 12 m/s", "풍하측 급확산 · 연기 요양시설 도달", "방화선 넘어 확산 · 산자락 주택 도달", "능선 너머까지 확산 · 산자락 주택 11동"],
    s: { plume: [1, 2, 2, 2], care: ["영향 예상", "영향권", "대피 완료", "대피 완료"], homes: ["정상", "영향 임박", "영향권", "영향권"], homeCounts: [0, 0, 4, 11] }, homesAt: t("18:45"), smokeAt: t("17:45"), scene: staticOf(12), wind: WIND_COND,
  },
  /* 17:50 부터 — 17:30 까지는 실제와 같다. 연기 17:52 · 주택 18:55 도달 · 9동 */
  {
    from: DECISIONS[1], d: [0.4, 1.1, 1.9, 2.5], g: ["GEO-D-FIRE-1", "GEO-D-FIRE-2", "GEO-D-FIRE-3", "GEO-D-FIRE-4"],
    n: [ACTUAL_N[0], "풍하측 급확산 · 연기 요양시설 도달", "방화선 넘어 확산 · 산자락 주택 도달", "능선 너머까지 확산 · 산자락 주택 9동"],
    s: { plume: [0, 2, 2, 2], care: ["정상", "영향권", "대피 완료", "대피 완료"], homes: ["정상", "정상", "영향권", "영향권"], homeCounts: [0, 0, 2, 9] }, homesAt: t("18:55"), smokeAt: t("17:52"), scene: staticOf(12), wind: WIND_COND,
  },
  /* 18:20 부터 — 연기 도달은 실제와 같고(18:00), 방화선 착수 뒤 바람이 세져 주택 도달이 10분 이르다(19:30 · 8동) */
  {
    from: DECISIONS[2], d: [0.4, 0.9, 1.8, 2.4], g: ["GEO-D-FIRE-1", "GEO-D-FIRE-2", "GEO-D-FIRE-3M", "GEO-D-FIRE-4"],
    n: [ACTUAL_N[0], ACTUAL_N[1], "방화선 끝 돌아 확산 · 요양시설 연기 노출", "방화선 끝 돌아 산자락 주택 8동 도달"],
    s: { plume: [0, 1, 2, 2], care: ACTUAL_S.care, homes: ["정상", "정상", "영향 임박", "영향권"], homeCounts: [0, 0, 0, 8] }, homesAt: t("19:30"), smokeAt: SMOKE_AT_CARE, scene: staticOf(12), wind: WIND_COND,
  },
];
const WIND_BOARDS = WINDS.map(windFrom);
export const [MH_WIND_1720, MH_WIND_1750, MH_WIND_1820] = WIND_BOARDS;

/* ── 상황과 대응을 함께 — 바람이 센 날 방화선·이송으로 버티나 ─────────────────────
 * 강풍 판(분석 기준마다) 위에 대응 선택지를 얹은 사전 계산 판이다. 편집 규칙 둘:
 *   방화선(현상 대응)  화선 확산 거리 = 강풍 판 + (방화선 판 − 기준 재현). 화선 면·닿은 주택 수·주택 도달은 그 거리에서 다시 읽는다
 *                     (주택 도달 = 확산 거리 1.75 km 를 넘는 시각 · 아래 거리-주택 표)
 *   이송              강풍 판 그대로에 이송 시각만 바꿔 같은 규칙 — 바람이 세면 연기가 17:45 에 닿아 예측 직후 이송도 연기 전에 못 끝낸다
 * 분석 기준보다 이른 선택지는 화면이 먼저 닫으므로 그 조합은 만들지 않는다. 실개발은 조합마다 ModelRun 으로 교체한다.
 * ─────────────────────────────────────────────────────────────────── */
const ms = (iso: string) => new Date(iso).getTime();
const kst = (m: number): string => {
  const d = new Date(Math.round(m / 60_000) * 60_000 + 9 * 3600_000);
  return t(`${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`);
};
const HOME_KM = 1.75;
const HOMES_AT_19: [number, number][] = [[HOME_KM, 1], [1.9, 2], [2.1, 4]];
const HOMES_AT_20: [number, number][] = [[1.6, 0], [1.8, 3], [2.1, 6], [2.4, 8], [2.5, 9], [2.7, 11]];
const floorOf = (tbl: [number, number][], v: number) => [...tbl].reverse().find(([k]) => v >= k - 1e-9)?.[1] ?? 0;
const ringOf = (i: number, km: number) =>
  i === 0 ? "GEO-D-FIRE-1" : i === 1 ? "GEO-D-FIRE-2" : i === 2 ? (km <= 1.45 ? "GEO-D-FIRE-3C" : km <= 1.75 ? "GEO-D-FIRE-3M" : "GEO-D-FIRE-3") : km <= 1.7 ? "GEO-D-FIRE-4C" : km <= 1.95 ? "GEO-D-FIRE-4N" : km <= 2.25 ? "GEO-D-FIRE-4M" : "GEO-D-FIRE-4";
const withBreak = (w: WindSpec, b: BreakSpec): WindSpec => {
  const d = w.d.map((v, i) => Number((v + b.d[i] - ACTUAL_D[i]).toFixed(1))) as Four<number>;
  const counts: Four<number> = [0, 0, floorOf(HOMES_AT_19, d[2]), floorOf(HOMES_AT_20, d[3])];
  const pts: [number, number][] = AT.map((a, i) => [ms(a), d[i]]);
  let homesAt: string | null = null;
  for (let i = 1; i < pts.length && !homesAt; i += 1) {
    const [t0, v0] = pts[i - 1], [t1, v1] = pts[i];
    if (v0 < HOME_KM && v1 >= HOME_KM) homesAt = kst(t0 + ((HOME_KM - v0) / (v1 - v0)) * (t1 - t0));
  }
  const homes = AT.map((_, i) => (counts[i] > 0 ? "영향권" : d[i] >= 1.5 ? "영향 임박" : i >= 2 ? "영향 예상" : w.s.homes[i])) as Four<FacState>;
  const n = AT.map((_, i) => (i < 2 ? w.n[i] : counts[i] > 0 ? `방화선 끝 돌아 확산 · 산자락 주택 ${counts[i]}동` : "방화선에서 확산 둔화")) as Four<string>;
  return { ...w, d, g: d.map((v, i) => ringOf(i, v)) as Four<string>, n, s: { ...w.s, homes, homeCounts: counts }, homesAt: homesAt ?? VALID_UNTIL };
};
const COMBO_FORECASTS: Forecast[] = [];
const COMBOS: WhatIfCombo[] = [];
WINDS.forEach((w, wi) => {
  const sitF = WIND_BOARDS[wi];
  for (const b of BREAKS) {
    if (ms(b.at) < ms(w.from)) continue;
    const c = withBreak(w, b);
    const reached = Math.max(...c.s.homeCounts) > 0;
    const f: Forecast = {
      ...common, scene: staticOf(12), forecastId: `${sitF.forecastId}-${b.key}`, alternativeId: "containment",
      changedConditions: [...sitF.changedConditions, `임도 기준 방화선 착수 · ${b.at.slice(11, 16)} (실제보다 ${b.early})`],
      hypothesis: `${sitF.hypothesis}에 방화선을 ${b.early}(${b.at.slice(11, 16)}) 착수했다면`,
      marks: marksOf(c.d, c.g, c.n, { ...c.s, breakFrom: b.at, evacFrom: ACTUAL_EVAC }),
      arrivalAt: c.homesAt,
      targets: targets(Math.max(...c.s.homeCounts), reached ? c.homesAt : null, ACTUAL_EVAC, w.smokeAt),
      basis: basis([windLine(w.from), `방화선 착수 ${b.at.slice(11, 16)} 가정 · 이송은 실제(18:10) 그대로`, "조합 판 = 강풍 판 + (방화선 판 − 기준 재현)", MH_EXPOSURE_RULE], "대안 계산 (재현과 같은 방식 · 상황과 대응 변경)"),
      conditions: conditions(b.at, ACTUAL_EVAC, WIND_COND),
      actionAt: { label: "방화선 착수", at: b.at },
    };
    COMBO_FORECASTS.push(f);
    COMBOS.push({ situationForecastId: sitF.forecastId, responseId: "containment", presetId: b.presetId, forecastId: f.forecastId });
  }
  for (const e of EVACS) {
    if (ms(e.at) < ms(w.from)) continue;
    const f = evacOn(`${sitF.forecastId}-${e.key}`, e, w, [windLine(w.from), "화선·플룸은 강풍 판과 동일"], sitF.changedConditions);
    COMBO_FORECASTS.push(f);
    COMBOS.push({ situationForecastId: sitF.forecastId, responseId: "evacuation", presetId: e.presetId, forecastId: f.forecastId });
  }
});

export const MUHAK_FORECASTS: Forecast[] = [MH_ACTUAL, MH_BREAK_10, MH_BREAK_20, MH_EVAC_30, MH_EVAC_50, ...WIND_BOARDS, ...COMBO_FORECASTS];

const SITUATIONS: WhatIfSituation[] = [
  {
    situationId: "wind-up", label: "강풍", detail: "남서풍 8 → 12 m/s",
    byBasis: WIND_BOARDS.map((f, i) => ({ at: DECISIONS[i], forecastId: f.forecastId })),
    method: "사전 계산 · 기준 재현과 같은 방식에 풍속 입력만 변경",
  },
];

const RESPONSES: WhatIfResponse[] = [
  {
    responseId: "containment", kind: "현상", target: "임도 기준 방화선 · 진화 헬기 1 · 지상 2개조", level: "능선 구간 차단", adjust: "when", method: "사전 계산 · 기준 재현과 같은 방식에 방화선 착수 시각만 변경",
    anchor: { label: "실제 방화선 착수", at: ACTUAL_BREAK },
    presets: [
      { id: "actual", label: "실제", at: ACTUAL_BREAK, forecastId: null },
      { id: "early10", label: "10분 일찍", at: t("18:10"), forecastId: MH_BREAK_10.forecastId },
      { id: "early20", label: "20분 일찍", at: t("18:00"), forecastId: MH_BREAK_20.forecastId },
    ],
  },
  {
    responseId: "evacuation", kind: "노출", target: "산자락 요양시설 입소자 60명", level: "차량 3대 · 플룸 밖 남동 방향 이송", adjust: "when", method: `규칙 · ${MH_EXPOSURE_RULE}`,
    anchor: { label: "실제 요양시설 이송", at: ACTUAL_EVAC },
    presets: [
      { id: "actual", label: "실제", at: ACTUAL_EVAC, forecastId: null },
      { id: "early30", label: "30분 일찍", at: EVACS[0].at, forecastId: MH_EVAC_30.forecastId },
      { id: "early50", label: "50분 일찍", at: EVACS[1].at, forecastId: MH_EVAC_50.forecastId },
    ],
  },
];

export const MUHAK_WHATIF: WhatIfCase = {
  incidentId: MH_INCIDENT_ID,
  title: "무학산 산불",
  hazardKind: "산불",
  twinFamily: "D",
  scope: { kind: "구역", displayAnchor: [128.548, 35.213], affectedGeometryId: "GEO-D-SCOPE", label: "무학산 산자락 풍하측 영향권" },
  occurredAt: t("17:12"),
  closedAt: t("22:40"),
  record: [
    { at: t("17:05"), label: "서쪽 사면 발화", kind: "관측" },
    { at: t("17:12"), label: "산불 신고 · 위성 활성화재 확인", kind: "관측" },
    { at: t("17:20"), label: "확산 예측 · 북동쪽 19:40 주택 도달", kind: "예측", decision: true },
    { at: t("17:40"), label: "등산로·임도 통제", kind: "대응" },
    { at: t("17:50"), label: "대응 2단계 발령", kind: "관측", decision: true },
    { at: t("18:00"), label: "연기 요양시설 도달", kind: "영향" },
    { at: t("18:10"), label: "요양시설 이송 시작", kind: "대응" },
    { at: t("18:20"), label: "임도 기준 방화선 착수", kind: "대응", decision: true },
    { at: t("18:30"), label: "진화 헬기 투입", kind: "대응" },
    { at: t("19:40"), label: "산자락 주택 화선 도달", kind: "영향" },
    { at: t("22:40"), label: "주불 진화 · 사건 종료", kind: "관측" },
  ],
  reconstructionForecastId: MH_ACTUAL.forecastId,
  stateByTime: [
    { at: t("17:20"), rows: [{ label: "풍향·풍속", value: "남서 7 m/s" }, { label: "화선", value: "0.2 km" }, { label: "습도", value: "23 %" }, { label: "진화 헬기", value: "대기" }] },
    { at: t("17:50"), rows: [{ label: "풍향·풍속", value: "남서 8 m/s" }, { label: "화선", value: "0.7 km" }, { label: "습도", value: "21 %" }, { label: "진화 헬기", value: "출동 요청" }] },
    { at: t("18:20"), rows: [{ label: "풍향·풍속", value: "남서 8 m/s" }, { label: "화선", value: "1.1 km" }, { label: "습도", value: "20 %" }, { label: "진화 헬기", value: "18:30 도착 예정" }] },
    { at: t("19:40"), rows: [{ label: "풍향·풍속", value: "남서 6 m/s" }, { label: "화선", value: "2.0 km" }, { label: "습도", value: "24 %" }, { label: "진화 헬기", value: "2대 진화 중" }] },
  ],
  observed: [
    { label: "피해 면적 (산림청 조사)", value: "38 ha" },
    { label: "주택 피해 (현장 조사)", value: "5동" },
  ],
  responses: RESPONSES,
  situations: SITUATIONS,
  combos: COMBOS,
};
