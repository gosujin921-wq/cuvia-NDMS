/* ─────────────────────────────────────────────
 * D·F·G 정적 개념 장면 — 사건 없이 "이 유형이면 지도에 이렇게 보인다" (03 §16 "정적 개념 예시")
 *
 * 조건 축은 하나(장면)이고 조합도 하나다. 기준 장면과 대안 장면 한 벌씩이며 값은 전부 시나리오 편집값이다.
 * 계산이 아니다 — 03 §9·§11·§12 의 표현 방식(전선·풍하측 영향권 / 사면·변위·출입통제 / 시설 노드·중단 권역)을
 * 폴리곤과 눈금으로 옮겼을 뿐이다. 실제 모델·연계가 확보되면 같은 계약의 ModelRun 결과로 교체한다.
 *
 * 지표는 유형이 정한다(ForecastMark.metric). D 화선 확산 거리 km · F 누적 변위 mm · G 서비스 중단 권역 곳.
 * ───────────────────────────────────────────── */

import type { Forecast, ForecastBasis, ForecastMark, ImpactTarget, MarkMetric } from "../../model/forecast";
import type { TrainingConditionSet } from "../../model/training";
import type { LngLat, NodeState, SceneLayer, ScenePoint, SceneSystem, SystemEdge as SceneSystemEdge } from "../../model/scene";

const t = (hhmm: string) => `2024-09-21T${hhmm}:00+09:00`;
const BASE = t("17:00");

const basis = (modelName: string, assumptions: string[], sensitiveTo: string[], replacementNote: string, overrides: Partial<ForecastBasis> = {}): ForecastBasis => ({
  modelName, modelVersion: "0.1", baseTime: BASE, generatedAt: BASE, inputEventIds: [], assumptions,
  uncertainty: { grade: "높음", sensitiveTo, unusableRanges: ["개념 장면 · 판단에 쓰지 않음"] },
  inputQuality: "보정", calculationActor: "해당 없음", replacementNote, ...overrides,
});

const mark = (validAt: string, metric: MarkMetric, extentGeometryId: string, impactSummary: string, scene?: SceneLayer[]): ForecastMark => ({ validAt, maxDepthM: 0, metric, extentGeometryId, impactSummary, ...(scene ? { scene } : {}) });

/* ═══ D 이동 전선·확산 — 무학산 산불 개념 장면 ═══ */

export const CONCEPT_GEOMETRIES: Record<string, [number, number][]> = {
  /* D 산불 — 발화점 서쪽 사면에서 남서풍을 타고 북동쪽(풍하측)으로 번지는 화선 (마산합포구 무학산 자락). 풍향은 불어오는 방향이다 */
  "GEO-D-SCOPE": [[128.535, 35.222], [128.56, 35.224], [128.562, 35.204], [128.537, 35.202]],
  "GEO-D-FIRE-1": [[128.541, 35.211], [128.545, 35.2125], [128.546, 35.2095], [128.542, 35.2085]],
  "GEO-D-FIRE-2": [[128.54, 35.2115], [128.549, 35.215], [128.551, 35.209], [128.542, 35.207]],
  "GEO-D-FIRE-3": [[128.539, 35.212], [128.553, 35.2185], [128.556, 35.2085], [128.542, 35.205]],
  "GEO-D-FIRE-4": [[128.538, 35.2125], [128.557, 35.222], [128.561, 35.208], [128.542, 35.203]],
  "GEO-D-FIRE-3C": [[128.539, 35.212], [128.55, 35.2165], [128.552, 35.2088], [128.542, 35.206]],
  "GEO-D-FIRE-4C": [[128.538, 35.2125], [128.551, 35.217], [128.553, 35.2085], [128.542, 35.204]],
  /* F 급경사지 — 사면 하부 도로·주택 위 옹벽 구간 (마산합포구 교방동, 무학산 동사면 자락) */
  "GEO-F-SCOPE": [[128.5605, 35.2175], [128.5685, 35.218], [128.569, 35.212], [128.561, 35.2115]],
  "GEO-F-SLOPE-1": [[128.5635, 35.216], [128.566, 35.2163], [128.5662, 35.2145], [128.5637, 35.2143]],
  "GEO-F-SLOPE-2": [[128.563, 35.2163], [128.567, 35.2167], [128.5673, 35.2137], [128.5633, 35.2133]],
  "GEO-F-SLOPE-3": [[128.5623, 35.2167], [128.5677, 35.2173], [128.5681, 35.2129], [128.5627, 35.2125]],
  "GEO-F-SLOPE-2C": [[128.563, 35.2163], [128.567, 35.2167], [128.5673, 35.2141], [128.5633, 35.2137]],
  /* G 정전 파급 — 서항 펌프장 계통에서 통신·저지대 세대로 번지는 중단 권역 */
  "GEO-G-SCOPE": [[128.5625, 35.1995], [128.57, 35.1998], [128.5712, 35.195], [128.564, 35.194]],
  "GEO-G-OUT-1": [[128.5648, 35.1975], [128.5665, 35.1977], [128.5666, 35.1963], [128.5649, 35.1961]],
  "GEO-G-OUT-2": [[128.564, 35.1985], [128.568, 35.1988], [128.5682, 35.1958], [128.5642, 35.1955]],
  "GEO-G-OUT-3": [[128.5632, 35.1993], [128.5698, 35.1996], [128.5705, 35.1948], [128.5638, 35.1945]],
  "GEO-G-OUT-2R": [[128.5645, 35.198], [128.567, 35.1982], [128.5672, 35.196], [128.5647, 35.1958]],
};

const D_ID = "CONCEPT-D-WILDFIRE";

/* ── D 장면 층 (03 §22 D · 부록 B) ──
   남서풍 8 m/s → 이동 방향 북동(45°). 발화점은 시나리오(🔥), 관측점은 위성 활성화재(●). 플룸은 화선보다 앞·넓게. */
const D_IGNITION: LngLat = [128.5435, 35.2105];
const D_WIND_BEARING = 45;
const D_WIND: SceneLayer[] = ([[128.537, 35.205], [128.545, 35.207], [128.553, 35.209], [128.539, 35.213], [128.547, 35.215], [128.555, 35.217], [128.543, 35.221], [128.551, 35.223]] as LngLat[])
  .map((at, i) => ({ kind: "vector" as const, id: `d-wind-${i}`, role: "풍향" as const, at, bearing: D_WIND_BEARING, magnitude: 8, unit: "m/s", ...(i === 0 ? { label: "남서풍 8 m/s" } : {}) }));
const D_STATIC: SceneLayer[] = [
  { kind: "point", id: "d-ignition", at: D_IGNITION, icon: "mdi:fire", label: "발화점", state: "시나리오", tone: "danger" },
  ...([[128.5418, 35.2088], [128.5452, 35.2092], [128.5458, 35.2118], [128.5424, 35.2124]] as LngLat[]).map<ScenePoint>((at, i) => ({ kind: "point", id: `d-hotspot-${i}`, at, icon: "mdi:circle", label: "위성 관측점", tone: "warning", small: true })),
  { kind: "line", id: "d-trail", role: "하천", coords: [[128.539, 35.2075], [128.547, 35.2125], [128.553, 35.2168], [128.557, 35.2205]], state: "on", label: "임도" },
  ...D_WIND,
];
/* 시설 상태 4단계 — 정상 → 영향 예상 → 영향 임박 → 영향권 (부록 B) */
const D_CARE_AT: LngLat = [128.5545, 35.2178];
const D_HOMES_AT: LngLat = [128.5585, 35.2208];
const dFacility = (id: string, at: LngLat, icon: string, label: string, state: "정상" | "영향 예상" | "영향 임박" | "영향권" | "대피 완료" | "통제됨"): ScenePoint => ({
  kind: "point", id, at, icon, label, state,
  tone: state === "정상" ? "success" : state === "영향 예상" ? "neutral" : state === "영향 임박" ? "warning" : state === "영향권" ? "danger" : "success",
});
const dPlume = (id: string, ring: LngLat[]): SceneLayer => ({ kind: "area", id, role: "플룸", ring });
const D_PLUME_1: LngLat[] = [[128.5425, 35.2098], [128.548, 35.2135], [128.552, 35.2115], [128.545, 35.2088]];
const D_PLUME_2: LngLat[] = [[128.5425, 35.2098], [128.553, 35.2185], [128.559, 35.2145], [128.547, 35.2082]];
const D_PLUME_3: LngLat[] = [[128.5425, 35.2098], [128.558, 35.2235], [128.566, 35.217], [128.549, 35.2078]];
const D_PLUME_4: LngLat[] = [[128.5425, 35.2098], [128.562, 35.228], [128.572, 35.219], [128.551, 35.2072]];
const D_FIREBREAK: LngLat[] = [[128.5495, 35.2135], [128.5535, 35.2165], [128.5565, 35.2195]];
const D_EVAC_ROUTE: LngLat[] = [[128.5545, 35.2178], [128.556, 35.213], [128.5595, 35.2095], [128.563, 35.207]];
const km = (v: number): MarkMetric => ({ label: "화선 확산 거리", value: v, unit: "km", digits: 1 });
const dRoad = (e: ImpactTarget["exposure"], at?: string): ImpactTarget => ({ kind: "도로", id: "RD-D-TRAIL", label: "무학산 임도·등산로", arrivalAt: at, exposure: e });
const dCare = (e: ImpactTarget["exposure"], at?: string): ImpactTarget => ({ kind: "중요시설", id: "FAC-D-CARE", label: "산자락 요양시설", arrivalAt: at, exposure: e });
const dHomes = (e: ImpactTarget["exposure"], at?: string): ImpactTarget => ({ kind: "건물", id: "BLD-D-EDGE", label: "산자락 주택 20동", arrivalAt: at, exposure: e });
const dPeople = (e: ImpactTarget["exposure"], at?: string): ImpactTarget => ({ kind: "대상자", id: "POP-D-HIKER", label: "등산객·풍하측 주민", arrivalAt: at, exposure: e });

const D_BASE: Forecast = {
  forecastId: "FC-CONCEPT-D-BASE", incidentId: D_ID, alternativeId: "baseline", changedConditions: [],
  marks: [
    mark(t("17:30"), km(0.4), "GEO-D-FIRE-1", "발화점 서쪽 사면 · 화선 0.4 km · 남서풍 8 m/s", [dPlume("d-plume", D_PLUME_1), dFacility("d-care", D_CARE_AT, "mdi:hospital-building", "산자락 요양시설", "정상"), dFacility("d-homes", D_HOMES_AT, "mdi:home-group", "산자락 주택 20동", "정상")]),
    mark(t("18:00"), km(0.9), "GEO-D-FIRE-2", "풍하측(북동) 확산 · 임도 차단 · 연기 능선 넘음", [dPlume("d-plume", D_PLUME_2), dFacility("d-care", D_CARE_AT, "mdi:hospital-building", "산자락 요양시설", "영향 예상"), dFacility("d-homes", D_HOMES_AT, "mdi:home-group", "산자락 주택 20동", "정상")]),
    mark(t("19:00"), km(1.8), "GEO-D-FIRE-3", "화선 요양시설 500 m 접근 · 산자락 주택 연기 노출", [dPlume("d-plume", D_PLUME_3), dFacility("d-care", D_CARE_AT, "mdi:hospital-building", "산자락 요양시설", "영향 임박"), dFacility("d-homes", D_HOMES_AT, "mdi:home-group", "산자락 주택 20동", "영향 예상")]),
    mark(t("20:00"), km(2.6), "GEO-D-FIRE-4", "산자락 주택 도달 · 주민 대피 필요 구역 확대", [dPlume("d-plume", D_PLUME_4), dFacility("d-care", D_CARE_AT, "mdi:hospital-building", "산자락 요양시설", "영향권"), dFacility("d-homes", D_HOMES_AT, "mdi:home-group", "산자락 주택 20동", "영향권")]),
  ],
  arrivalAt: t("18:40"),
  targets: [dRoad("노출", t("17:30")), dCare("노출", t("19:00")), dHomes("노출", t("20:00")), dPeople("노출", t("17:30"))],
  basis: basis("산불 확산 개념 장면", ["남서풍 8 m/s 유지 · 북동쪽으로 확산", "연료 건조 · 임도 외 차단선 없음", "진압자원 도착 전"], ["풍향 변화", "발화점 위치 확인"], "산불 확산 모델(산림청 등) 연계 시 같은 계약으로 교체"),
  availability: "가용", validUntil: t("21:00"),
  scene: D_STATIC,
  conditions: [{ label: "풍향·풍속", value: "남서풍 8 m/s" }, { label: "연료", value: "건조 · 낙엽층" }, { label: "발화", value: "17:05 서쪽 사면" }],
};
const D_CONTAIN: Forecast = {
  forecastId: "FC-CONCEPT-D-CONTAIN", incidentId: D_ID, alternativeId: "containment", changedConditions: ["18:00 임도 기준 방화선 구축", "진압 헬기·지상 인력 투입"],
  deltaSummary: "확산 거리 2.6 → 1.6 km · 요양시설 접근 차단 · 주택 도달 없음",
  marks: [
    mark(t("17:30"), km(0.4), "GEO-D-FIRE-1", "발화점 서쪽 사면 · 화선 0.4 km", [dPlume("d-plume", D_PLUME_1), { kind: "line", id: "d-firebreak", role: "방화선", coords: D_FIREBREAK, state: "planned", label: "방화선 (예정)" }, dFacility("d-care", D_CARE_AT, "mdi:hospital-building", "산자락 요양시설", "정상"), dFacility("d-homes", D_HOMES_AT, "mdi:home-group", "산자락 주택 20동", "정상")]),
    mark(t("18:00"), km(0.9), "GEO-D-FIRE-2", "풍하측 확산 · 임도 방화선 구축 시작", [dPlume("d-plume", D_PLUME_2), { kind: "line", id: "d-firebreak", role: "방화선", coords: D_FIREBREAK, state: "on", label: "방화선" }, dFacility("d-care", D_CARE_AT, "mdi:hospital-building", "산자락 요양시설", "통제됨"), dFacility("d-homes", D_HOMES_AT, "mdi:home-group", "산자락 주택 20동", "정상")]),
    mark(t("19:00"), km(1.3), "GEO-D-FIRE-3C", "방화선에서 확산 둔화 · 요양시설 접근 차단", [dPlume("d-plume", D_PLUME_2), { kind: "line", id: "d-firebreak", role: "방화선", coords: D_FIREBREAK, state: "on", label: "방화선" }, dFacility("d-care", D_CARE_AT, "mdi:hospital-building", "산자락 요양시설", "통제됨"), dFacility("d-homes", D_HOMES_AT, "mdi:home-group", "산자락 주택 20동", "통제됨")]),
    mark(t("20:00"), km(1.6), "GEO-D-FIRE-4C", "능선 구간 진압 · 주택 도달 없음", [dPlume("d-plume", D_PLUME_2), { kind: "line", id: "d-firebreak", role: "방화선", coords: D_FIREBREAK, state: "on", label: "방화선" }, dFacility("d-care", D_CARE_AT, "mdi:hospital-building", "산자락 요양시설", "통제됨"), dFacility("d-homes", D_HOMES_AT, "mdi:home-group", "산자락 주택 20동", "통제됨")]),
  ],
  arrivalAt: t("18:40"),
  targets: [dRoad("통제됨", t("17:30")), dCare("통제됨", t("18:00")), dHomes("통제됨", t("18:30")), dPeople("통제됨", t("17:40"))],
  basis: basis("산불 확산 개념 장면", ["남서풍 8 m/s 유지 · 북동쪽으로 확산", "18:00 방화선 완성 가정", "진압자원 18:20 도착 가정"], ["풍향 변화", "방화선 완성 시각"], "산불 확산 모델 연계 시 같은 계약으로 교체"),
  availability: "가용", validUntil: t("21:00"),
  scene: D_STATIC,
  conditions: [{ label: "풍향·풍속", value: "남서풍 8 m/s" }, { label: "차단선", value: "임도 기준 방화선 18:00" }, { label: "진압자원", value: "헬기 1 · 지상 2개조 18:20" }],
};

/* ═══ F 지반·구조 영향 — 급경사지 변위 개념 장면 ═══ */

const F_ID = "CONCEPT-F-SLOPE";
/* 장면 층 (03 §22 F) — 위험지도(원래 위험한 곳)와 변위 벡터(지금 움직이는 것)는 다른 정보다 */
const F_RISKMAP: LngLat[] = [[128.5618, 35.2172], [128.5678, 35.2176], [128.5682, 35.2138], [128.5622, 35.2132]];
const F_SLOPE_DIR = 155; /* 사면 아래 방향(남남동) */
const F_VEC_AT: LngLat[] = [[128.564, 35.2158], [128.5652, 35.216], [128.5664, 35.2157]];
const F_WALL_AT: LngLat = [128.5652, 35.2148];
const F_ROAD_AT: LngLat = [128.5648, 35.2141];
const F_HOMES_AT: LngLat = [128.5662, 35.2136];
const F_CONTROL_LINE: LngLat[] = [[128.5628, 35.2152], [128.5686, 35.2156]];
const F_STATIC: SceneLayer[] = [
  { kind: "area", id: "f-riskmap", role: "위험지도", ring: F_RISKMAP, label: "산사태 위험지도 1등급" },
  { kind: "point", id: "f-sensor", at: [128.5646, 35.2163], icon: "mdi:axis-arrow", label: "변위계", state: "시나리오", tone: "primary", small: true },
];
const fVectors = (mm: number): SceneLayer[] => F_VEC_AT.map((at, i) => ({ kind: "vector" as const, id: `f-vec-${i}`, role: "변위" as const, at, bearing: F_SLOPE_DIR, magnitude: mm, unit: "mm", ...(i === 1 ? { label: `${mm.toFixed(1)} mm` } : {}) }));
type FTone = "success" | "warning" | "danger" | "neutral" | "primary";
const fTone = (st: string): FTone => (st === "사용 가능" || st === "통제됨" || st === "대피 완료" ? "success" : st === "점검 필요" ? "warning" : st === "위험" ? "danger" : st === "점검 중" ? "primary" : "neutral");
const fState = (wall: string, road: string, homes: string): ScenePoint[] => [
  { kind: "point", id: "f-wall", at: F_WALL_AT, icon: "mdi:wall", label: "옹벽·배수로", state: wall, tone: fTone(wall) },
  { kind: "point", id: "f-road", at: F_ROAD_AT, icon: "mdi:road-variant", label: "사면 하부 도로", state: road, tone: fTone(road) },
  { kind: "point", id: "f-homes", at: F_HOMES_AT, icon: "mdi:home-group", label: "하부 주택 8동", state: homes, tone: fTone(homes) },
];
const fScene = (mm: number, wall: string, road: string, homes: string, control?: "planned" | "on"): SceneLayer[] => [
  ...fVectors(mm),
  ...fState(wall, road, homes),
  ...(control ? [{ kind: "line" as const, id: "f-control", role: "통제 경계" as const, coords: F_CONTROL_LINE, state: control, label: control === "on" ? "출입통제 경계" : "통제 예정" }] : []),
];
const mm = (v: number): MarkMetric => ({ label: "누적 변위", value: v, unit: "mm", digits: 1 });
const fRoad = (e: ImpactTarget["exposure"], at?: string): ImpactTarget => ({ kind: "도로", id: "RD-F-BELOW", label: "사면 하부 도로", arrivalAt: at, exposure: e });
const fWall = (e: ImpactTarget["exposure"], at?: string): ImpactTarget => ({ kind: "중요시설", id: "FAC-F-WALL", label: "옹벽·배수로", arrivalAt: at, exposure: e });
const fHomes = (e: ImpactTarget["exposure"], at?: string): ImpactTarget => ({ kind: "건물", id: "BLD-F-BELOW", label: "사면 하부 주택 8동", arrivalAt: at, exposure: e });
const fPeople = (e: ImpactTarget["exposure"], at?: string): ImpactTarget => ({ kind: "대상자", id: "POP-F-BELOW", label: "하부 주택 주민", arrivalAt: at, exposure: e });

const F_BASE: Forecast = {
  forecastId: "FC-CONCEPT-F-BASE", incidentId: F_ID, alternativeId: "baseline", changedConditions: [],
  marks: [
    mark(t("19:00"), mm(4.1), "GEO-F-SLOPE-1", "강우 누적 80 mm · 변위 4.1 mm · 주의 기준(5 mm) 이하", fScene(4.1, "사용 가능", "사용 가능", "사용 가능")),
    mark(t("23:00"), mm(7.8), "GEO-F-SLOPE-2", "함수율 상승 · 변위 가속 · 옹벽 배수로 월류", fScene(7.8, "점검 필요", "사용 가능", "사용 가능")),
    mark("2024-09-22T05:00:00+09:00", mm(12.5), "GEO-F-SLOPE-2", "경계 기준(10 mm) 초과 · 하부 도로 낙석", fScene(12.5, "점검 필요", "위험", "사용 가능")),
    mark("2024-09-22T17:00:00+09:00", mm(18.0), "GEO-F-SLOPE-3", "심각 기준(15 mm) 초과 · 붕괴 위험 구간 확대", fScene(18.0, "위험", "위험", "위험")),
  ],
  arrivalAt: "2024-09-22T05:00:00+09:00",
  targets: [fRoad("노출", "2024-09-22T05:00:00+09:00"), fWall("부분 중단", t("23:00")), fHomes("노출", "2024-09-22T17:00:00+09:00"), fPeople("노출", "2024-09-22T05:00:00+09:00")],
  basis: basis("급경사지 변위 개념 장면", ["강우 지속 · 함수율 상승", "변위계 기준선 유지", "출입통제 없음"], ["강우 지속 시간", "센서 기준선·결측"], "급경사지 계측 연계·붕괴 평가 모델 확보 시 같은 계약으로 교체"),
  availability: "가용", validUntil: "2024-09-22T21:00:00+09:00",
  scene: F_STATIC,
  conditions: [{ label: "누적 강우", value: "80 mm · 지속" }, { label: "함수율", value: "상승 중" }, { label: "변위 기준", value: "주의 5 · 경계 10 · 심각 15 mm" }],
};
const F_CONTROL: Forecast = {
  forecastId: "FC-CONCEPT-F-CONTROL", incidentId: F_ID, alternativeId: "road-control", changedConditions: ["23:00 하부 도로 출입통제", "하부 주택 8동 사전 대피", "긴급 점검·배수로 정비"],
  deltaSummary: "변위 동일 · 낙석·붕괴 노출 대상 제거 · 점검 우선순위 확정",
  marks: [
    mark(t("19:00"), mm(4.1), "GEO-F-SLOPE-1", "변위 4.1 mm · 감시 강화", fScene(4.1, "사용 가능", "사용 가능", "사용 가능", "planned")),
    mark(t("23:00"), mm(7.8), "GEO-F-SLOPE-2C", "출입통제 개시 · 배수로 긴급 정비", fScene(7.8, "점검 필요", "통제됨", "대피 완료", "on")),
    mark("2024-09-22T05:00:00+09:00", mm(12.5), "GEO-F-SLOPE-2C", "경계 초과 · 통제 구간 안 낙석 · 인명 노출 없음", fScene(12.5, "점검 필요", "통제됨", "대피 완료", "on")),
    mark("2024-09-22T17:00:00+09:00", mm(18.0), "GEO-F-SLOPE-3", "심각 초과 · 대피 완료 상태 유지", fScene(18.0, "위험", "통제됨", "대피 완료", "on")),
  ],
  arrivalAt: "2024-09-22T05:00:00+09:00",
  targets: [fRoad("통제됨", t("23:00")), fWall("부분 중단", t("23:00")), fHomes("통제됨", t("23:00")), fPeople("통제됨", t("23:00"))],
  basis: basis("급경사지 변위 개념 장면", ["강우 지속", "23:00 통제·대피 완료 가정"], ["강우 지속 시간"], "급경사지 계측 연계·붕괴 평가 모델 확보 시 같은 계약으로 교체"),
  availability: "가용", validUntil: "2024-09-22T21:00:00+09:00",
  scene: F_STATIC,
  conditions: [{ label: "누적 강우", value: "80 mm · 지속" }, { label: "함수율", value: "상승 중" }, { label: "변위 기준", value: "주의 5 · 경계 10 · 심각 15 mm" }],
};

/* ═══ G 기반시설·네트워크 장애 — 정전 파급 개념 장면 ═══ */

const G_ID = "CONCEPT-G-OUTAGE";
/* 장면 층 (03 §22 G) — 노드가 차례로 꺼지는 것이 파급이다. 계통도(system)는 보조뷰가 그린다 */
const G_NODES: { id: string; label: string; icon: string; at: LngLat }[] = [
  { id: "sub", label: "변전 계통", icon: "mdi:transmission-tower", at: [128.5632, 35.1992] },
  { id: "pump", label: "제2배수펌프장", icon: "mdi:water-pump", at: [128.5658, 35.1978] },
  { id: "cell", label: "통신 기지국", icon: "mdi:radio-tower", at: [128.5688, 35.1985] },
  { id: "pa", label: "마을방송", icon: "mdi:bullhorn-outline", at: [128.5675, 35.1962] },
  { id: "homes", label: "저지대 320세대", icon: "mdi:home-city-outline", at: [128.5652, 35.1955] },
];
const G_EDGES: SceneSystemEdge[] = [{ from: "sub", to: "pump" }, { from: "sub", to: "cell" }, { from: "sub", to: "homes" }, { from: "cell", to: "pa" }];
type GState = Record<string, NodeState>;
const gScene = (st: GState, order?: Record<string, number>): SceneLayer[] => [
  ...G_EDGES.map<SceneLayer>((e) => ({ kind: "line", id: `g-edge-${e.from}-${e.to}`, role: "연결", coords: [G_NODES.find((n) => n.id === e.from)!.at, G_NODES.find((n) => n.id === e.to)!.at], state: st[e.from] === "중단" || st[e.to] === "중단" ? "off" : "on" })),
  ...G_NODES.map<SceneLayer>((n) => ({ kind: "node", id: `g-node-${n.id}`, at: n.at, label: n.label, icon: n.icon, state: st[n.id] ?? "정상", ...(order?.[n.id] !== undefined ? { order: order[n.id] } : {}) })),
];
const G_S1: GState = { sub: "중단", pump: "중단", cell: "경고", pa: "정상", homes: "정상" };
const G_S2: GState = { sub: "중단", pump: "중단", cell: "중단", pa: "중단", homes: "경고" };
const G_S3: GState = { sub: "중단", pump: "중단", cell: "중단", pa: "중단", homes: "중단" };
const G_S4: GState = { sub: "복구", pump: "중단", cell: "복구", pa: "복구", homes: "복구" };
const G_B2: GState = { sub: "중단", pump: "복구", cell: "복구", pa: "정상", homes: "경고" };
const G_B3: GState = { sub: "중단", pump: "복구", cell: "복구", pa: "정상", homes: "중단" };
const G_B4: GState = { sub: "복구", pump: "정상", cell: "정상", pa: "정상", homes: "복구" };
const G_O2: GState = { sub: "중단", pump: "중단", cell: "중단", pa: "중단", homes: "경고" };
const G_O3: GState = { sub: "중단", pump: "복구", cell: "경고", pa: "중단", homes: "중단" };
const G_O4: GState = { sub: "복구", pump: "정상", cell: "복구", pa: "복구", homes: "경고" };
const G_ORDER_MAP: Record<string, number> = { pump: 1, cell: 2, homes: 3 };
const gSystem = (byMark: Record<string, GState>, order?: Record<string, number>): SceneSystem => ({
  nodes: G_NODES.map(({ id, label, icon }) => ({ id, label, icon })),
  edges: G_EDGES,
  stateByMark: byMark,
  ...(order ? { orderByMark: Object.fromEntries(Object.keys(byMark).map((k) => [k, order])) } : {}),
});
/** G 첫 줄 — 중단 상태·복구 예상(03 §26). 값은 중단 권역 수, 문장이 첫 줄에 선다 */
const zones = (v: number, text: string): MarkMetric => ({ label: "중단·복구", value: v, unit: "곳", digits: 0, text: v > 0 ? `${v}곳 · ${text}` : text });
const gPump = (e: ImpactTarget["exposure"], at?: string): ImpactTarget => ({ kind: "중요시설", id: "FAC-G-PUMP", label: "제2배수펌프장", arrivalAt: at, exposure: e });
const gCell = (e: ImpactTarget["exposure"], at?: string): ImpactTarget => ({ kind: "중요시설", id: "FAC-G-CELL", label: "통신 기지국·마을방송", arrivalAt: at, exposure: e });
const gHomes = (e: ImpactTarget["exposure"], at?: string): ImpactTarget => ({ kind: "건물", id: "BLD-G-OUT", label: "정전 세대 320세대", arrivalAt: at, exposure: e });
const gPeople = (e: ImpactTarget["exposure"], at?: string): ImpactTarget => ({ kind: "대상자", id: "POP-G-VULN", label: "엘리베이터 갇힘·취약가구", arrivalAt: at, exposure: e });

const G_BASE: Forecast = {
  forecastId: "FC-CONCEPT-G-BASE", incidentId: G_ID, alternativeId: "baseline", changedConditions: [],
  marks: [
    mark(t("17:15"), zones(1, "19:00 복구"), "GEO-G-OUT-1", "펌프장 변전 계통 장애 · 펌프 2/3 정지 · 복합침수 사건 악화 조건", gScene(G_S1)),
    mark(t("17:30"), zones(2, "19:00 복구"), "GEO-G-OUT-2", "인근 통신 기지국 비상전원 소진 · 마을방송 불가", gScene(G_S2)),
    mark(t("18:00"), zones(3, "19:00 복구"), "GEO-G-OUT-3", "저지대 320세대 정전 · 엘리베이터 갇힘 신고", gScene(G_S3)),
    mark(t("19:00"), zones(2, "복구 중"), "GEO-G-OUT-2", "한전 복구반 도착 · 세대 순차 복전 · 펌프 복구 대기", gScene(G_S4)),
  ],
  arrivalAt: t("17:15"),
  targets: [gPump("중단", t("17:15")), gCell("부분 중단", t("17:30")), gHomes("노출", t("18:00")), gPeople("노출", t("18:00"))],
  basis: basis("정전 파급 개념 장면", ["변전 계통 장애 지속", "기지국 비상전원 15분", "복구반 도착 19:00"], ["복구 예상시간", "의존관계 최신성"], "시설 상태·의존관계 연계 확보 시 같은 계약으로 교체"),
  availability: "가용", validUntil: t("21:00"),
  system: gSystem({ [t("17:15")]: G_S1, [t("17:30")]: G_S2, [t("18:00")]: G_S3, [t("19:00")]: G_S4 }),
  conditions: [{ label: "장애 원인", value: "변전 계통 장애 17:15", tone: "danger" }, { label: "전력 상태", value: "없음" }, { label: "복구반", value: "19:00 도착 예상" }],
};
const G_BACKUP: Forecast = {
  forecastId: "FC-CONCEPT-G-BACKUP", incidentId: G_ID, alternativeId: "backup-power", changedConditions: ["17:20 펌프장 비상발전기 투입", "기지국 이동발전 배치 · 복구 순서 펌프장 우선"],
  deltaSummary: "중단 권역 3 → 1곳 · 펌프 가동 유지 · 복합침수 악화 조건 해소",
  marks: [
    mark(t("17:15"), zones(1, "19:00 복구"), "GEO-G-OUT-1", "펌프장 변전 계통 장애", gScene(G_S1)),
    mark(t("17:30"), zones(1, "펌프 가동"), "GEO-G-OUT-2R", "비상발전기 투입 · 펌프 3/3 가동 · 기지국 이동발전 배치", gScene(G_B2)),
    mark(t("18:00"), zones(1, "세대 19:00"), "GEO-G-OUT-2R", "세대 정전 지속 · 통신·방송 정상", gScene(G_B3)),
    mark(t("19:00"), zones(0, "정상화"), "GEO-G-OUT-1", "복전 완료 · 정상화", gScene(G_B4)),
  ],
  arrivalAt: t("17:15"),
  targets: [gPump("통제됨", t("17:20")), gCell("통제됨", t("17:30")), gHomes("노출", t("18:00")), gPeople("통제됨", t("17:40"))],
  basis: basis("정전 파급 개념 장면", ["비상발전기 17:20 투입 가정", "복구 순서 펌프장 → 기지국 → 세대"], ["비상전원 가용성"], "시설 상태·의존관계 연계 확보 시 같은 계약으로 교체"),
  availability: "가용", validUntil: t("21:00"),
  system: gSystem({ [t("17:15")]: G_S1, [t("17:30")]: G_B2, [t("18:00")]: G_B3, [t("19:00")]: G_B4 }),
  conditions: [{ label: "장애 원인", value: "변전 계통 장애 17:15", tone: "danger" }, { label: "전력 상태", value: "비상발전기 투입 17:20" }, { label: "복구반", value: "19:00 도착 예상" }],
};

/* D 대안 둘째 — 대피방향 설정. 화선·플룸은 그대로, 노출만 바뀐다(03 §22 D) */
const D_EVAC: Forecast = {
  forecastId: "FC-CONCEPT-D-EVAC", incidentId: D_ID, alternativeId: "evacuation", changedConditions: ["풍하측 반대로 대피경로 설정", "요양시설 17:40 선제 이송 · 임도 등산객 하산 유도"],
  deltaSummary: "화선 동일 · 요양시설·주택·등산객 노출 제거 · 대피경로는 연기 반대편",
  marks: D_BASE.marks.map((m, i) => ({
    ...m,
    scene: [
      ...(m.scene ?? []).filter((l) => !l.id.startsWith("d-care") && !l.id.startsWith("d-homes")),
      { kind: "line", id: "d-evac-route", role: "대피경로", coords: D_EVAC_ROUTE, state: i === 0 ? "planned" : "on", label: "대피경로 (남동)" },
      dFacility("d-care", D_CARE_AT, "mdi:hospital-building", "산자락 요양시설", i === 0 ? "영향 예상" : "대피 완료"),
      dFacility("d-homes", D_HOMES_AT, "mdi:home-group", "산자락 주택 20동", i < 2 ? "정상" : "대피 완료"),
    ],
  })),
  arrivalAt: t("18:40"),
  targets: [dRoad("통제됨", t("17:30")), dCare("통제됨", t("17:40")), dHomes("통제됨", t("18:30")), dPeople("통제됨", t("17:40"))],
  basis: basis("산불 확산 개념 장면", ["남서풍 8 m/s 유지 · 북동쪽으로 확산", "대피경로는 플룸 밖 남동 방향 가정", "이송 완료 18:30 가정"], ["풍향 변화"], "산불 확산 모델 연계 시 같은 계약으로 교체"),
  availability: "가용", validUntil: t("21:00"),
  scene: D_STATIC,
  conditions: [{ label: "풍향·풍속", value: "남서풍 8 m/s" }, { label: "대피", value: "요양시설 17:40 선제 이송" }, { label: "경로", value: "플룸 밖 남동 방향" }],
};

/* F 대안 둘째 — 점검·보강 우선순위. 변위는 그대로, 시설에 순번이 붙는다(03 §22 F) */
const F_INSPECT: Forecast = {
  forecastId: "FC-CONCEPT-F-INSPECT", incidentId: F_ID, alternativeId: "inspection-priority", changedConditions: ["점검 순서 ① 옹벽 ② 배수로 ③ 하부 도로", "긴급 보강 자원 옹벽 우선"],
  deltaSummary: "변위 동일 · 옹벽·배수로 점검 착수 · 노출 상태는 통제 전과 같음",
  marks: F_BASE.marks.map((m, i) => ({ ...m, scene: (m.scene ?? []).map((l) => (l.kind === "point" && l.id === "f-wall" && i >= 1 ? { ...l, label: "① 옹벽·배수로", state: "점검 중", tone: "primary" as const } : l.kind === "point" && l.id === "f-road" && i >= 1 ? { ...l, label: "③ 사면 하부 도로" } : l)) })),
  arrivalAt: "2024-09-22T05:00:00+09:00",
  targets: [fRoad("노출", "2024-09-22T05:00:00+09:00"), fWall("통제됨", t("21:00")), fHomes("노출", "2024-09-22T17:00:00+09:00"), fPeople("노출", "2024-09-22T05:00:00+09:00")],
  basis: basis("급경사지 변위 개념 장면", ["강우 지속", "점검반 21:00 도착 가정"], ["강우 지속 시간"], "급경사지 계측 연계·붕괴 평가 모델 확보 시 같은 계약으로 교체"),
  availability: "가용", validUntil: "2024-09-22T21:00:00+09:00",
  scene: F_STATIC,
  conditions: [{ label: "누적 강우", value: "80 mm · 지속" }, { label: "함수율", value: "상승 중" }, { label: "변위 기준", value: "주의 5 · 경계 10 · 심각 15 mm" }],
};

/* G 대안 둘째 — 복구 순서. 펌프장 → 기지국 → 세대 순으로 노드가 켜진다(05 §4 G) */
const G_ORDER: Forecast = {
  forecastId: "FC-CONCEPT-G-ORDER", incidentId: G_ID, alternativeId: "recovery-order", changedConditions: ["복구 순서 ① 펌프장 ② 기지국 ③ 세대", "복구반 17:45 펌프장 우선 투입"],
  deltaSummary: "펌프장 18:00 복전 · 기지국 18:30 · 세대 19:30 · 침수 악화 조건 1시간 앞당겨 해소",
  marks: [
    mark(t("17:15"), zones(1, "19:00 복구"), "GEO-G-OUT-1", "펌프장 변전 계통 장애", gScene(G_S1, G_ORDER_MAP)),
    mark(t("17:30"), zones(2, "펌프장 18:00"), "GEO-G-OUT-2", "기지국 비상전원 소진 · 복구반 펌프장으로", gScene(G_O2, G_ORDER_MAP)),
    mark(t("18:00"), zones(2, "기지국 18:30"), "GEO-G-OUT-2R", "펌프 3/3 재가동 · 세대 정전 지속", gScene(G_O3, G_ORDER_MAP)),
    mark(t("19:00"), zones(1, "세대 19:30"), "GEO-G-OUT-1", "기지국 정상 · 세대 순차 복전", gScene(G_O4, G_ORDER_MAP)),
  ],
  arrivalAt: t("17:15"),
  targets: [gPump("통제됨", t("18:00")), gCell("통제됨", t("18:30")), gHomes("노출", t("18:00")), gPeople("노출", t("18:00"))],
  basis: basis("정전 파급 개념 장면", ["복구 순서 펌프장 우선", "복구반 17:45 도착 가정"], ["복구 예상시간"], "시설 상태·의존관계 연계 확보 시 같은 계약으로 교체"),
  availability: "가용", validUntil: t("21:00"),
  system: gSystem({ [t("17:15")]: G_S1, [t("17:30")]: G_O2, [t("18:00")]: G_O3, [t("19:00")]: G_O4 }, G_ORDER_MAP),
  conditions: [{ label: "장애 원인", value: "변전 계통 장애 17:15", tone: "danger" }, { label: "전력 상태", value: "펌프장 우선 복구" }, { label: "복구반", value: "17:45 도착" }],
};

export const CONCEPT_FORECASTS: Forecast[] = [D_BASE, D_CONTAIN, D_EVAC, F_BASE, F_CONTROL, F_INSPECT, G_BASE, G_BACKUP, G_ORDER];

export const CONCEPT_SETS: TrainingConditionSet[] = [
  {
    setId: "D-WILDFIRE", twinFamily: "D", regionId: "muhak", label: "무학산 산불 · 남서풍 · 북동쪽 확산",
    source: { title: "무학산 산불 확산 (개념)", hazardKind: "산불", twinFamily: "D", scope: { kind: "구역", displayAnchor: [128.548, 35.213], affectedGeometryId: "GEO-D-SCOPE", label: "무학산 산자락 풍하측 영향권" } },
    params: [{ key: "scene", label: "장면", value: "남서풍 8 m/s · 북동쪽 확산", note: "개념 예시" }],
    baselineForecastId: D_BASE.forecastId, alternativeForecastIds: [D_CONTAIN.forecastId, D_EVAC.forecastId],
    objectives: ["풍하측 도달 시간과 영향권 확인", "방화선·진압자원 투입 효과 비교", "대피 방향과 접근 금지 구간 결정"],
    goal: "대피 방향과 접근 금지 구간을 결정하세요",
    changeableConditions: ["차단선·진압자원", "대피 방향"],
  },
  {
    setId: "F-SLOPE", twinFamily: "F", regionId: "gyobang", label: "교방동 급경사지 · 강우 누적 변위",
    source: { title: "교방동 급경사지 변위 (개념)", hazardKind: "지반", twinFamily: "F", scope: { kind: "시설", displayAnchor: [128.565, 35.2148], affectedGeometryId: "GEO-F-SCOPE", label: "교방동 급경사지 옹벽 구간" } },
    params: [{ key: "scene", label: "장면", value: "강우 지속 · 변위 가속", note: "개념 예시" }],
    baselineForecastId: F_BASE.forecastId, alternativeForecastIds: [F_CONTROL.forecastId, F_INSPECT.forecastId],
    objectives: ["변위 기준(주의·경계·심각) 도달 시점 확인", "출입통제·대피 개시 시점 결정", "점검·보강 우선순위 결정"],
    goal: "출입통제·대피 개시 시점을 결정하세요",
    changeableConditions: ["출입통제 범위", "긴급점검·보강 우선순위"],
  },
  {
    setId: "G-OUTAGE", twinFamily: "G", regionId: "seohang-pump", label: "서항 펌프장 정전 · 파급",
    source: { title: "서항 펌프장 정전 파급 (개념)", hazardKind: "기반시설 장애", twinFamily: "G", scope: { kind: "구역", displayAnchor: [128.567, 35.197], affectedGeometryId: "GEO-G-SCOPE", label: "서항 배수권역 전력·통신 계통" } },
    params: [{ key: "scene", label: "장면", value: "변전 계통 장애 → 통신·세대 파급", note: "개념 예시" }],
    baselineForecastId: G_BASE.forecastId, alternativeForecastIds: [G_BACKUP.forecastId, G_ORDER.forecastId],
    objectives: ["의존 연결을 따른 파급 순서 확인", "비상전원·복구 순서의 효과 비교", "복합침수 사건과의 악화 관계 판단"],
    goal: "복구 순서와 비상전원 투입을 결정하세요",
    changeableConditions: ["복구 순서", "비상전원·대체시설 투입"],
  },
];
