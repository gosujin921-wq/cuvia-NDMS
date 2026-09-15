/* ─────────────────────────────────────────────
 * E 대기·면 노출 — 창원 도심 생활권 폭염 격자 장면 (03 §10 · §22 E)
 *
 * 무언가가 이동하는 그림이 아니다. 격자마다 열 노출 강도가 누적되고, 쉼터가 문을 닫는 시각에 서비스 공백이 드러난다.
 * 채널을 가른다 — 면 색 = 그 시각의 열위험 강도, 해칭 = 취약대상 밀집, 붉은 외곽선 = 서비스 공백(쉼터 접근권 밖).
 * 축은 시각형(D1 15:00 · 18:00 · 22:00 · D2 14:00)이고 첫 줄 지표는 위험 지속시간이다. 대안은 폭염 강도를 줄이지 않는다.
 * 쉼터 연장은 공백 격자가 줄고, 순회 자원은 공백 일부가 지원 범위로 바뀐다.
 *
 * 값은 전부 시나리오 편집값이다. 격자 강도·취약 밀집·쉼터 운영시간은 여기서 정한 수치이고 실측·집계가 아니다.
 * 공백 판정(개방 쉼터의 접근권 안인가 + 강도 0.45 이상인가)은 fixture 를 만들 때 한 번 적용하는 편집 규칙이며 화면은 계산하지 않는다.
 * 실개발 교체 대상: 기온·습도·특보(기상청) · 쉼터(공공데이터) · 인구·취약대상(권한 있는 집계).
 * ───────────────────────────────────────────── */

import type { Forecast, ForecastBasis, ForecastMark, ImpactTarget } from "../../model/forecast";
import type { TrainingConditionSet } from "../../model/training";
import type { LngLat, SceneGridCell, SceneLayer, ScenePoint } from "../../model/scene";

const INCIDENT_ID = "";
const t = (hhmm: string, day = "21") => `2024-09-${day}T${hhmm}:00+09:00`;
const BASE = t("14:00");
const AT = { h1: t("15:00"), h4: t("18:00"), h8: t("22:00"), h24: t("14:00", "22") };
const VALID_UNTIL = t("18:00", "22");

/* ── 격자 — 도심 생활권 7 × 5 칸. 원점 남서 모서리, 한 칸 약 730 m × 720 m ── */
const ORIGIN: LngLat = [128.636, 35.185];
const DX = 0.008, DY = 0.0065;
const COLS = 7, ROWS = 5;
const cellRing = (c: number, r: number): LngLat[] => {
  const x0 = ORIGIN[0] + c * DX, y0 = ORIGIN[1] + r * DY;
  return [[x0, y0], [x0 + DX, y0], [x0 + DX, y0 + DY], [x0, y0 + DY]];
};
const cellCenter = (c: number, r: number): LngLat => [ORIGIN[0] + (c + 0.5) * DX, ORIGIN[1] + (r + 0.5) * DY];

export const HEAT_GEOMETRIES: Record<string, [number, number][]> = {
  "GEO-E-SCOPE": [ORIGIN, [ORIGIN[0] + COLS * DX, ORIGIN[1]], [ORIGIN[0] + COLS * DX, ORIGIN[1] + ROWS * DY], [ORIGIN[0], ORIGIN[1] + ROWS * DY]],
};

/** 기본 강도 — 남쪽(r0)에서 북쪽(r4). 도심 저층 밀집부(중앙)가 높다 */
const BASE_INTENSITY: number[][] = [
  [0.35, 0.45, 0.55, 0.5, 0.42, 0.34, 0.3],
  [0.45, 0.62, 0.76, 0.7, 0.56, 0.42, 0.36],
  [0.5, 0.7, 0.86, 0.8, 0.66, 0.48, 0.4],
  [0.4, 0.6, 0.76, 0.7, 0.56, 0.42, 0.36],
  [0.3, 0.45, 0.55, 0.5, 0.42, 0.34, 0.3],
];
/** 취약대상 밀집 칸 — 65세 이상 독거·저층 노후 주거 (데모 집계) */
const VULNERABLE = new Set(["1,1", "2,1", "1,2", "2,2", "3,2", "3,3", "2,4", "0,4"]);
const key = (c: number, r: number) => `${c},${r}`;

/* ── 쉼터 — 개방 시각별로 접근권이 생긴다. 접근권은 도로 접근시간이 아니라 인접 칸 기준 편집값 ── */
interface Shelter { id: string; label: string; icon: string; cell: [number, number]; hours: string; night: boolean }
const SHELTERS: Shelter[] = [
  { id: "e-s1", label: "중앙 경로당", icon: "mdi:home-heart", cell: [2, 2], hours: "09~18시", night: false },
  { id: "e-s2", label: "주민센터 야간 쉼터", icon: "mdi:office-building", cell: [3, 1], hours: "24시간", night: true },
  { id: "e-s3", label: "종합복지관", icon: "mdi:hand-heart", cell: [0, 3], hours: "09~18시", night: false },
  { id: "e-s4", label: "시립도서관", icon: "mdi:library", cell: [4, 3], hours: "09~21시", night: false },
  { id: "e-s5", label: "은행 냉방쉼터", icon: "mdi:bank", cell: [1, 0], hours: "09~16시", night: false },
  { id: "e-s6", label: "동부 주민센터", icon: "mdi:office-building", cell: [6, 2], hours: "09~18시", night: false },
];
const accessRing = ([c, r]: [number, number]): LngLat[] => {
  const [x, y] = cellCenter(c, r);
  const rx = DX * 1.45, ry = DY * 1.45;
  return Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return [x + Math.cos(a) * rx, y + Math.sin(a) * ry] as LngLat; });
};
const covered = (c: number, r: number, open: Shelter[], extra: [number, number][] = []) =>
  [...open.map((s) => s.cell), ...extra].some(([sc, sr]) => Math.abs(sc - c) <= 1 && Math.abs(sr - r) <= 1);

type ShelterState = "운영 중" | "운영 종료" | "연장 운영";
const shelterPoint = (s: Shelter, state: ShelterState): ScenePoint => ({
  kind: "point", id: s.id, at: cellCenter(...s.cell), icon: s.icon, label: s.label, state: `${state} · ${s.hours}`,
  tone: state === "운영 종료" ? "neutral" : state === "연장 운영" ? "primary" : "success",
});

const GAP_MIN = 0.45;
/** 한 눈금의 장면 — 격자(강도·취약·공백) + 쉼터 상태 + 개방 쉼터 접근권 + 순회 자원 */
function scene(mult: number, hold: number, openIds: string[], extendIds: string[] = [], patrol: [number, number][] = []): SceneLayer[] {
  const open = SHELTERS.filter((s) => openIds.includes(s.id) || extendIds.includes(s.id));
  const cells: SceneGridCell[] = [];
  for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
    const vulnerable = VULNERABLE.has(key(c, r));
    const intensity = Math.min(1, BASE_INTENSITY[r][c] * mult + (vulnerable ? hold : 0));
    cells.push({ ring: cellRing(c, r), intensity: Number(intensity.toFixed(2)), vulnerable, gap: intensity >= GAP_MIN && !covered(c, r, open, patrol) });
  }
  return [
    { kind: "grid", id: "e-grid", cells },
    ...open.map((s) => ({ kind: "area" as const, id: `e-access-${s.id}`, role: "접근권" as const, ring: accessRing(s.cell), opacity: 0.1 })),
    ...SHELTERS.map((s) => shelterPoint(s, extendIds.includes(s.id) ? "연장 운영" : openIds.includes(s.id) ? "운영 중" : "운영 종료")),
    ...patrol.map(([c, r], i) => ({ kind: "point" as const, id: `e-patrol-${i}`, at: cellCenter(c, r), icon: "mdi:car-emergency", label: "순회 지원차", state: "순회 중", tone: "primary" as const })),
  ];
}
const gapCount = (layers: SceneLayer[]) => layers.filter((l): l is Extract<SceneLayer, { kind: "grid" }> => l.kind === "grid").flatMap((g) => g.cells).filter((c) => c.gap).length;

const DAY_OPEN = SHELTERS.map((s) => s.id);
const AFTERNOON_OPEN = SHELTERS.filter((s) => s.id !== "e-s5").map((s) => s.id);
const NIGHT_OPEN = SHELTERS.filter((s) => s.night).map((s) => s.id);

const basis = (assumptions: string[], overrides: Partial<ForecastBasis> = {}): ForecastBasis => ({
  modelName: "시나리오 폭염 노출 결과 세트", modelVersion: "0.1", baseTime: BASE, generatedAt: BASE,
  inputEventIds: [], assumptions,
  uncertainty: { grade: "높음", sensitiveTo: ["예보 기온·습도의 편차", "취약대상 집계 단위와 권한"], unusableRanges: ["D2 18:00 이후"] },
  inputQuality: "보정", calculationActor: "해당 없음",
  replacementNote: "기온·습도·특보 실연계와 쉼터·인구 집계 확보 시 같은 계약으로 교체",
  ...overrides,
});

const HOURS: [number, number, number, number] = [5, 8, 12, 28];
const marks = (scenes: [SceneLayer[], SceneLayer[], SceneLayer[], SceneLayer[]], n: [string, string, string, string]): ForecastMark[] =>
  ([AT.h1, AT.h4, AT.h8, AT.h24] as const).map((validAt, i) => ({
    validAt, maxDepthM: 0, extentGeometryId: "GEO-E-SCOPE",
    impactSummary: `${n[i]} · 공백 ${gapCount(scenes[i])}격자`,
    metric: { label: "위험 지속시간", value: HOURS[i], unit: "시간", digits: 0, text: `경보 ${HOURS[i]}시간째` },
    scene: scenes[i],
  }));

const elderly = (exposure: ImpactTarget["exposure"], arrivalAt?: string): ImpactTarget => ({ kind: "대상자", id: "POP-E-ELDER", label: "65세 이상 독거 1,240명", arrivalAt, exposure });
const workers = (exposure: ImpactTarget["exposure"], arrivalAt?: string): ImpactTarget => ({ kind: "대상자", id: "POP-E-WORK", label: "야외 작업자·배달", arrivalAt, exposure });
const shelters = (label: string, exposure: ImpactTarget["exposure"], arrivalAt?: string): ImpactTarget => ({ kind: "중요시설", id: "FAC-E-SHELTER", label, arrivalAt, exposure });
const gapPeople = (label: string, exposure: ImpactTarget["exposure"], arrivalAt?: string): ImpactTarget => ({ kind: "대상자", id: "POP-E-GAP", label, arrivalAt, exposure });

const CONDITIONS = [
  { label: "기온", value: "35.2°C · 폭염경보 2일째", tone: "danger" as const },
  { label: "습도", value: "58 % · 체감 37°C" },
  { label: "쉼터", value: "6곳 · 야간 개방 1곳" },
];

/* ── 기준 · 현행 쉼터 운영 ── */
const E_BASE: Forecast = {
  forecastId: "FC-COND-E-HEAT-BASE", incidentId: INCIDENT_ID, alternativeId: "baseline", changedConditions: [],
  marks: marks(
    [scene(0.95, 0, DAY_OPEN), scene(1.05, 0, AFTERNOON_OPEN), scene(0.62, 0.14, NIGHT_OPEN), scene(1.12, 0, DAY_OPEN)],
    ["도심 격자 강도 상승 · 쉼터 6곳 운영 중", "일 최고 노출 · 쉼터 운영 종료 앞둠", "야간 열 잔류 · 쉼터 5곳 종료 · 취약 격자 노출", "이틀째 누적 · 노출 인구 확대"],
  ),
  arrivalAt: AT.h8,
  targets: [elderly("노출", AT.h1), workers("노출", AT.h4), shelters("무더위쉼터 6곳", "부분 중단", AT.h8), gapPeople("공백 격자 취약대상 380명", "노출", AT.h8)],
  basis: basis(["최고기온 35°C 이틀 지속 예보", "쉼터 운영시간 현행 유지", "취약대상 집계 데모값"]),
  availability: "가용", validUntil: VALID_UNTIL,
  conditions: CONDITIONS,
};

/* ── 대안: 쉼터 운영시간 연장 (강도는 그대로, 공백 격자가 준다) ── */
const E_EXTEND: Forecast = {
  forecastId: "FC-COND-E-HEAT-EXTEND", incidentId: INCIDENT_ID, alternativeId: "shelter-extend", changedConditions: ["경로당·복지관·도서관 22:00 → 익일 06:00 연장 운영"],
  deltaSummary: "폭염 강도 동일 · 야간 공백 격자 감소 · 취약 격자 접근권 안",
  marks: marks(
    [scene(0.95, 0, DAY_OPEN), scene(1.05, 0, AFTERNOON_OPEN), scene(0.62, 0.14, NIGHT_OPEN, ["e-s1", "e-s3", "e-s4"]), scene(1.12, 0, DAY_OPEN)],
    ["도심 격자 강도 상승 · 쉼터 6곳 운영 중", "일 최고 노출 · 연장 운영 준비", "야간 열 잔류 · 연장 쉼터 3곳 개방", "이틀째 누적 · 노출 인구 확대"],
  ),
  arrivalAt: AT.h8,
  targets: [elderly("노출", AT.h1), workers("노출", AT.h4), shelters("무더위쉼터 6곳 (연장 3곳)", "노출", AT.h8), gapPeople("공백 격자 취약대상 90명", "노출", AT.h8)],
  basis: basis(["최고기온 35°C 이틀 지속 예보", "쉼터 3곳 야간 연장 운영", "취약대상 집계 데모값"]),
  availability: "가용", validUntil: VALID_UNTIL,
  conditions: [CONDITIONS[0], CONDITIONS[1], { label: "쉼터", value: "6곳 · 야간 연장 3곳", tone: "primary" }],
};

/* ── 대안: 순회 자원 배치 (공백 일부가 지원 범위로 바뀐다) ── */
const E_PATROL: Forecast = {
  forecastId: "FC-COND-E-HEAT-PATROL", incidentId: INCIDENT_ID, alternativeId: "patrol", changedConditions: ["순회 지원차 2대 야간 배치 (취약 밀집 격자)"],
  deltaSummary: "폭염 강도 동일 · 순회 범위 격자 공백 해소 · 나머지 공백 유지",
  marks: marks(
    [scene(0.95, 0, DAY_OPEN), scene(1.05, 0, AFTERNOON_OPEN), scene(0.62, 0.14, NIGHT_OPEN, [], [[1, 2], [3, 3]]), scene(1.12, 0, DAY_OPEN)],
    ["도심 격자 강도 상승 · 쉼터 6곳 운영 중", "일 최고 노출 · 순회 배치 준비", "야간 열 잔류 · 순회 지원차 2대 운행", "이틀째 누적 · 노출 인구 확대"],
  ),
  arrivalAt: AT.h8,
  targets: [elderly("노출", AT.h1), workers("노출", AT.h4), shelters("무더위쉼터 6곳", "부분 중단", AT.h8), gapPeople("공백 격자 취약대상 210명", "노출", AT.h8)],
  basis: basis(["최고기온 35°C 이틀 지속 예보", "순회 지원차 2대 야간 배치", "취약대상 집계 데모값"]),
  availability: "가용", validUntil: VALID_UNTIL,
  conditions: [CONDITIONS[0], CONDITIONS[1], { label: "순회", value: "지원차 2대 · 22~06시", tone: "primary" }],
};

export const HEAT_CONDITION_FORECASTS: Forecast[] = [E_BASE, E_EXTEND, E_PATROL];

export const HEAT_CONDITION_SETS: TrainingConditionSet[] = [
  {
    setId: "E-HEAT-2D", twinFamily: "E", regionId: "changwon-city", label: "폭염경보 이틀째 · 도심 생활권",
    source: { title: "창원 도심 폭염 노출", hazardKind: "폭염", twinFamily: "E", scope: { kind: "구역", displayAnchor: cellCenter(3, 2), affectedGeometryId: "GEO-E-SCOPE", label: "창원 도심 생활권 격자" } },
    params: [{ key: "heat", label: "폭염", value: "경보 2일째", note: "최고 35°C" }],
    baselineForecastId: E_BASE.forecastId, alternativeForecastIds: [E_EXTEND.forecastId, E_PATROL.forecastId],
    objectives: ["취약 격자의 위험 지속시간 확인", "쉼터 운영 종료 시각의 서비스 공백 확인", "쉼터 연장·순회 자원의 공백 감소 효과 비교"],
    goal: "야간 쉼터 연장과 순회 배치를 결정하세요",
    changeableConditions: ["쉼터 운영시간", "순회·지원 자원"],
  },
  {
    setId: "E-HEAT-1D", twinFamily: "E", regionId: "changwon-city", label: "폭염주의보 첫날 · 도심 생활권",
    source: { title: "창원 도심 폭염 노출", hazardKind: "폭염", twinFamily: "E", scope: { kind: "구역", displayAnchor: cellCenter(3, 2), affectedGeometryId: "GEO-E-SCOPE", label: "창원 도심 생활권 격자" } },
    params: [{ key: "heat", label: "폭염", value: "주의보 1일째", note: "최고 33°C" }],
    baselineForecastId: null, alternativeForecastIds: [],
    objectives: ["취약 격자의 위험 지속시간 확인", "쉼터 운영 종료 시각의 서비스 공백 확인", "쉼터 연장·순회 자원의 공백 감소 효과 비교"],
    goal: "야간 쉼터 연장과 순회 배치를 결정하세요",
    changeableConditions: ["쉼터 운영시간", "순회·지원 자원"],
    unavailableReason: "주의보 첫날 장면은 두지 않았다 · 기온·특보 연계 시 같은 조건으로 계산 요청",
  },
];
