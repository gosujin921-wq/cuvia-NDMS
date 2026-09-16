/* ─────────────────────────────────────────────
 * ※ 트윈 사건 목록에서 뺐다(2026-09-16 · fixtures/past/index.ts 머리말). 유형 표현(격자 · 쉼터 접근권) 참고로만 남긴다.
 *
 * E 대기·면 노출 — 창원 도심 폭염 · 종료 사건의 대응 What-if (03 §10 · §22 E · §26)
 *
 * 무언가가 이동하는 그림이 아니다. 격자마다 열 노출 강도가 누적되고, 쉼터가 문을 닫는 시각에 서비스 공백이 드러난다.
 * 채널을 가른다 — 면 색 = 그 시각의 열위험 강도, 해칭 = 취약대상 밀집, 붉은 외곽선 = 서비스 공백(쉼터 접근권 밖).
 * 축은 시각형(1일째 15:00 · 18:00 · 22:00 · 2일째 14:00)이고 첫 줄 지표는 위험 지속시간이다.
 *
 * 종료 사건이라 기준은 **실제로 한 대응**이다 — 23:00 경로당·복지관·도서관 야간 연장 운영 · 23:30 순회 지원차 2대.
 * 주간 쉼터가 18:00 에 닫고 야간 연장은 22:00 이 지나서야 열려, 22:00 전후 취약 격자가 비었다.
 * 폭염은 대응으로 줄지 않는다. 두 대응 모두 노출 감소다 — 강도는 그대로이고 공백 격자와 그 안의 취약대상이 준다.
 * 느린 재난이라 시작 시점 선택지는 1시간 · 2시간 일찍이다.
 * 상황 조건은 열대야 심화 — 야간 최저가 27 이 아니라 29°C 였다면 같은 대응으로 공백이 얼마나 커지나(야간 강도만 바꾼다).
 *
 * 값은 전부 시나리오 편집값이다. 격자 강도·취약 밀집·쉼터 운영시간·인원·신고 수는 여기서 정한 수치이고 실측·집계가 아니다.
 * 공백 판정(개방 쉼터의 접근권 안인가 + 강도 0.45 이상인가)은 fixture 를 만들 때 한 번 적용하는 편집 규칙이며 화면은 계산하지 않는다.
 * 실개발 교체 대상: 기온·습도·특보(기상청) · 쉼터(공공데이터) · 인구·취약대상(권한 있는 집계).
 * ───────────────────────────────────────────── */

import type { Forecast, ForecastBasis, ForecastInput, ForecastMark, ImpactTarget } from "../../model/forecast";
import type { LngLat, SceneGridCell, SceneLayer, ScenePoint } from "../../model/scene";
import type { WhatIfCase, WhatIfResponse, WhatIfSituation } from "../../model/whatif";

export const HW_INCIDENT_ID = "INC-2024-0806-HW01";
const t = (hhmm: string, day = "06") => `2024-08-${day}T${hhmm}:00+09:00`;
/** 재현·대안 판의 기준시각 — 관측 입력이 끝난 사건 종료 시각. 판은 모두 사건이 끝난 뒤 계산했다 */
const BASE = t("19:00", "07");
const AT = [t("15:00"), t("18:00"), t("22:00"), t("14:00", "07")] as const;
const VALID_UNTIL = t("18:00", "07");

/* ── 격자 — 도심 생활권 7 × 5 칸. 원점 남서 모서리, 한 칸 약 730 m × 720 m ── */
const ORIGIN: LngLat = [128.636, 35.185];
const DX = 0.008, DY = 0.0065;
const COLS = 7, ROWS = 5;
const cellRing = (c: number, r: number): LngLat[] => {
  const x0 = ORIGIN[0] + c * DX, y0 = ORIGIN[1] + r * DY;
  return [[x0, y0], [x0 + DX, y0], [x0 + DX, y0 + DY], [x0, y0 + DY]];
};
const cellCenter = (c: number, r: number): LngLat => [ORIGIN[0] + (c + 0.5) * DX, ORIGIN[1] + (r + 0.5) * DY];

export const HEATWAVE_GEOMETRIES: Record<string, [number, number][]> = {
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
const EXTEND_IDS = ["e-s1", "e-s3", "e-s4"];
const PATROL_CELLS: [number, number][] = [[1, 2], [3, 3]];

/* 재현 입력 — 사건 동안의 관측·운영 기록. 예보는 쓰지 않는다(이미 일어난 일이다) */
const INPUTS: ForecastInput[] = [
  { label: "기온·습도 관측 (도심 AWS)", at: t("19:00", "07"), kind: "관측" },
  { label: "폭염특보 발표·해제 (기상청)", at: t("19:00", "07"), kind: "관측" },
  { label: "무더위쉼터 운영 기록", at: t("19:00", "07"), kind: "시설" },
];
/** 규칙 계산이라 재현도 대안도 같은 기록에서 나온다. 재현은 관측 강도라 불확실성 보통, 대안은 높다. 사건이 끝난 뒤(2일째 19:30) 계산했다 */
const basis = (assumptions: string[], modelName = "규칙 계산 (같은 기록에 쉼터·순회 시각만 변경)", grade: ForecastBasis["uncertainty"]["grade"] = "높음"): ForecastBasis => ({
  modelName, modelVersion: "0.1", baseTime: BASE, generatedAt: t("19:30", "07"),
  observedFrom: t("09:00"), inputs: INPUTS, inputEventIds: [], assumptions,
  uncertainty: { grade, sensitiveTo: ["야간 기온의 격자 대표성", "취약대상 집계 단위와 권한"], unusableRanges: ["2일째 18:00 이후"] },
  inputQuality: "보정", calculationActor: "해당 없음",
  replacementNote: "기온·습도·특보 실연계와 쉼터·인구 집계 확보 시 같은 계약으로 교체",
});

type Four<T> = [T, T, T, T];
const HOURS: Four<number> = [5, 8, 12, 28];
const marksOf = (scenes: Four<SceneLayer[]>, n: Four<string>): ForecastMark[] =>
  AT.map((validAt, i) => ({
    validAt, maxDepthM: 0, extentGeometryId: "GEO-E-SCOPE",
    impactSummary: `${n[i]} · 공백 ${gapCount(scenes[i])}격자`,
    metric: { label: "위험 지속시간", value: HOURS[i], unit: "시간", digits: 0, text: `경보 ${HOURS[i]}시간째` },
    scene: scenes[i],
    /* 그 시각의 핵심 영향 — 쉼터 접근권 밖 고강도 격자와 그 안의 취약대상(아래 규칙) */
    impacts: [
      { label: "서비스 공백 격자", value: gapCount(scenes[i]) > 0 ? `${gapCount(scenes[i])}칸` : "없음", tone: gapCount(scenes[i]) > 0 ? "danger" : "muted" },
      { label: "공백 격자 취약대상", value: `${gapPeopleOf(scenes[i])}명`, tone: gapPeopleOf(scenes[i]) > 0 ? "warning" : "muted" },
    ],
  }));

/* 야간 강도 — 열대야가 심해지면(상황 조건) 분석 기준 이후 야간 격자 강도가 오른다. 강도 외에는 아무것도 바꾸지 않는다 */
interface Night { mult: number; hold: number; day2: number; from: string | null }
const NIGHT_ACTUAL: Night = { mult: 0.62, hold: 0.14, day2: 1.12, from: null };
const nightAt = (night: Night, at: number): { mult: number; hold: number } =>
  night.from === null || at < new Date(night.from).getTime() ? { mult: NIGHT_ACTUAL.mult, hold: NIGHT_ACTUAL.hold } : { mult: night.mult, hold: night.hold };

/** 22:00 눈금만 대응에 따라 달라진다 — 연장 쉼터는 연 시각이 22:00 이전일 때, 순회차는 배치가 22:00 이전일 때 선다 */
const scenesOf = (extendAt: string, patrolAt: string, night: Night = NIGHT_ACTUAL): Four<SceneLayer[]> => {
  const n22 = nightAt(night, new Date(AT[2]).getTime());
  return [
    scene(0.95, 0, DAY_OPEN),
    scene(1.05, 0, AFTERNOON_OPEN),
    scene(n22.mult, n22.hold, NIGHT_OPEN, extendAt <= AT[2] ? EXTEND_IDS : [], patrolAt <= AT[2] ? PATROL_CELLS : []),
    scene(night.from === null ? NIGHT_ACTUAL.day2 : night.day2, 0, DAY_OPEN),
  ];
};
const NOTES: Four<string> = ["도심 격자 강도 상승 · 쉼터 6곳 운영 중", "일 최고 노출 · 주간 쉼터 운영 종료", "야간 열 잔류 · 취약 격자 노출", "이틀째 누적 · 노출 인구 확대"];

/* ── 노출 규칙 — 쉼터 접근권 밖에 남은 취약대상과 그 시간 (03 §26 · 2026-09-16 "폭염에서 신고를 줄였다는 건 억지") ──
 * 쉼터와 순회가 바꾸는 것은 발병이 아니라 "누가 보호 범위 안에 있나"다. 온열질환 신고 같은 후행 피해는 결과로 쓰지 않는다(실제 기록에만).
 *   공백 취약대상 = 공백 격자(강도 0.45 이상 · 접근권 밖)의 취약대상 집계(밀집 칸 60명 · 그 외 12명)
 *   보호 공백 인·시간 = 18:00~익일 06:00 을 30분씩 끊어 공백 취약대상 × 0.5시간을 더한 것
 * 강도는 모든 대안에서 같다(야간 열 잔류 0.62 · 취약 가산 0.14). 바뀌는 것은 열린 쉼터와 순회 칸뿐이다 */
const PER_CELL = { vulnerable: 60, other: 12 } as const;
export const HW_EXPOSURE_RULE = `공백 취약대상 = 접근권 밖 고강도 격자의 취약대상(밀집 ${PER_CELL.vulnerable}명 · 그 외 ${PER_CELL.other}명/칸) · 보호 공백 인·시간 = 18시~06시 30분 단위 합`;
const gapPeopleOf = (layers: SceneLayer[]): number =>
  layers.filter((l): l is Extract<SceneLayer, { kind: "grid" }> => l.kind === "grid").flatMap((g) => g.cells).filter((c) => c.gap)
    .reduce((sum, c) => sum + (c.vulnerable ? PER_CELL.vulnerable : PER_CELL.other), 0);
/** 그 시각의 야간 장면 — 도서관은 21시까지, 주민센터 야간 쉼터는 24시간. 연장·순회는 시작 뒤부터 */
const nightScene = (at: number, extendAt: string, patrolAt: string, night: Night = NIGHT_ACTUAL): SceneLayer[] => {
  const open = [...NIGHT_OPEN, ...(at < new Date(t("21:00")).getTime() ? ["e-s4"] : [])];
  const k = nightAt(night, at);
  return scene(k.mult, k.hold, open, at >= new Date(extendAt).getTime() ? EXTEND_IDS : [], at >= new Date(patrolAt).getTime() ? PATROL_CELLS : []);
};
const personHoursOf = (extendAt: string, patrolAt: string, night: Night = NIGHT_ACTUAL): number => {
  let sum = 0;
  for (let at = new Date(t("18:00")).getTime(); at < new Date(t("06:00", "07")).getTime(); at += 30 * 60_000) sum += gapPeopleOf(nightScene(at, extendAt, patrolAt, night)) * 0.5;
  return Math.round(sum);
};

/* 영향 대상 — 공백 취약대상이 첫째다(도달 = 18:00 주간 쉼터가 닫혀 공백이 생기는 시각). 수는 모두 위 규칙에서 나온다 */
const targets = (extendAt: string, patrolAt: string, night: Night = NIGHT_ACTUAL): ImpactTarget[] => {
  const at22 = gapPeopleOf(nightScene(new Date(AT[2]).getTime(), extendAt, patrolAt, night));
  const hours = personHoursOf(extendAt, patrolAt, night);
  return [
    { kind: "대상자", id: "POP-HW-GAP", label: `22시 공백 격자 취약대상 ${at22}명`, arrivalAt: t("18:00"), exposure: at22 > 0 ? "노출" : "통제됨" },
    { kind: "대상자", id: "POP-HW-HOURS", label: `보호 공백 ${hours}인·시간`, exposure: hours > 0 ? "노출" : "통제됨" },
    { kind: "대상자", id: "POP-HW-ELDER", label: "65세 이상 독거 노인", exposure: "노출" },
    { kind: "대상자", id: "POP-HW-WORK", label: "야외 작업자·배달", exposure: "노출" },
  ];
};
const conditions = (extendAt: string, patrolAt: string, nightLow = "27°C"): Forecast["conditions"] => [
  { label: "기온", value: `35.2°C · 야간 최저 ${nightLow}`, tone: "danger" },
  { label: "습도", value: "58 % · 체감 37°C" },
  { label: "야간 쉼터", value: `연장 3곳 · ${extendAt.slice(11, 16)} 개방`, tone: "primary" },
  { label: "순회", value: `지원차 2대 · ${patrolAt.slice(11, 16)} 배치` },
];
const common = { incidentId: HW_INCIDENT_ID, availability: "가용" as const, validUntil: VALID_UNTIL };

/* 실제 대응 시각 — 야간 연장 23:00 · 순회 23:30 */
const ACTUAL_EXTEND = t("23:00");
const ACTUAL_PATROL = t("23:30");

/* ── 실제 — 22:00 에 야간 쉼터 한 곳만 열려 있었다 ── */
export const HW_ACTUAL: Forecast = {
  ...common, forecastId: "FC-HW-ACTUAL", alternativeId: "baseline", changedConditions: [],
  marks: marksOf(scenesOf(ACTUAL_EXTEND, ACTUAL_PATROL), NOTES),
  arrivalAt: t("18:00"),
  targets: targets(ACTUAL_EXTEND, ACTUAL_PATROL),
  basis: basis(["관측 기온·습도 · 쉼터 운영 기록으로 다시 계산", "실제 대응: 야간 연장 23:00 · 순회 지원차 23:30", HW_EXPOSURE_RULE], "재현 계산 (관측 기온·쉼터 운영 기록)", "보통"),
  conditions: conditions(ACTUAL_EXTEND, ACTUAL_PATROL),
};

/* ── 야간 연장을 일찍 — 공백 격자가 22:00 부터 준다 ── */
const extendEarly = (id: string, at: string, early: string): Forecast => ({
  ...common, forecastId: id, alternativeId: "shelter-extend",
  changedConditions: [`경로당·복지관·도서관 야간 연장 · ${at.slice(11, 16)} 개방 (실제보다 ${early})`],
  hypothesis: `야간 연장 운영을 실제보다 ${early}(${at.slice(11, 16)}) 연 경우`,
  marks: marksOf(scenesOf(at, ACTUAL_PATROL), ["도심 격자 강도 상승 · 쉼터 6곳 운영 중", "일 최고 노출 · 주간 쉼터 운영 종료", "야간 열 잔류 · 연장 쉼터 3곳 개방", NOTES[3]]),
  arrivalAt: t("18:00"),
  targets: targets(at, ACTUAL_PATROL),
  basis: basis(["강도는 기준 재현과 동일", `야간 연장 ${at.slice(11, 16)} 가정 · 순회는 실제(23:30) 그대로`, HW_EXPOSURE_RULE]),
  conditions: conditions(at, ACTUAL_PATROL),
  actionAt: { label: "연장 개방", at },
});
export const HW_EXTEND_1H = extendEarly("FC-HW-EXTEND-1H", t("22:00"), "1시간 일찍");
export const HW_EXTEND_2H = extendEarly("FC-HW-EXTEND-2H", t("21:00"), "2시간 일찍");

/* ── 순회를 일찍 — 공백 일부가 지원 범위로 바뀐다. 22:30 배치는 22:00 눈금에는 아직 없다 ── */
const patrolEarly = (id: string, at: string, early: string): Forecast => ({
  ...common, forecastId: id, alternativeId: "patrol",
  changedConditions: [`순회 지원차 2대 · ${at.slice(11, 16)} 배치 (실제보다 ${early})`],
  hypothesis: `순회 지원차를 실제보다 ${early}(${at.slice(11, 16)}) 배치한 경우`,
  marks: marksOf(scenesOf(ACTUAL_EXTEND, at), ["도심 격자 강도 상승 · 쉼터 6곳 운영 중", "일 최고 노출 · 주간 쉼터 운영 종료", at <= AT[2] ? "야간 열 잔류 · 순회 지원차 2대 운행" : NOTES[2], NOTES[3]]),
  arrivalAt: t("18:00"),
  targets: targets(ACTUAL_EXTEND, at),
  basis: basis(["강도는 기준 재현과 동일", `순회 ${at.slice(11, 16)} 가정 · 야간 연장은 실제(23:00) 그대로`, HW_EXPOSURE_RULE]),
  conditions: conditions(ACTUAL_EXTEND, at),
  actionAt: { label: "순회 배치", at },
});
export const HW_PATROL_1H = patrolEarly("FC-HW-PATROL-1H", t("22:30"), "1시간 일찍");
export const HW_PATROL_2H = patrolEarly("FC-HW-PATROL-2H", t("21:30"), "2시간 일찍");

/* ── 상황 조건 · 열대야 심화 — 야간 최저가 27 이 아니라 29°C 였다면. 대응은 실제(연장 23:00 · 순회 23:30) 그대로 ──
   분석 기준(▲) 이후 야간 격자 강도만 올린다(0.62 → 0.80 · 취약 가산 0.14 → 0.24 — 열대야는 냉방이 없는 취약 주거에서 더 오래 남는다 ·
   이틀째 1.12 → 1.20). 공백 판정은 같은 규칙이다. 14:00 · 18:00 은 둘 다 야간 전이라 같은 판이다.
   23:00 부터면 22:00 눈금은 실제와 같고, 그 뒤 새로 넘는 격자는 이미 연 연장 쉼터 접근권 안이라 차이가 거의 없다 — 그것도 결과다 */
const DECISIONS = [t("14:00"), t("18:00"), t("23:00")] as const;
const hotNight = (from: string): Night => ({ mult: 0.8, hold: 0.24, day2: 1.2, from });
const nightFrom = (id: string, from: string): Forecast => {
  const night = hotNight(from);
  return {
    ...common, forecastId: id, alternativeId: "situation",
    changedConditions: [`야간 최저 29°C · ${from.slice(11, 16)} 이후 (실제 27°C)`],
    hypothesis: `${from.slice(11, 16)} 이후 열대야가 실제보다 2°C 심했던 경우`,
    marks: marksOf(scenesOf(ACTUAL_EXTEND, ACTUAL_PATROL, night), NOTES),
    arrivalAt: t("18:00"),
    targets: targets(ACTUAL_EXTEND, ACTUAL_PATROL, night),
    basis: basis([`야간 최저 27 → 29°C (${from.slice(11, 16)} 이후) · 야간 격자 강도 0.62 → 0.80 · 취약 가산 0.14 → 0.24`, "실제 대응 그대로: 야간 연장 23:00 · 순회 23:30", HW_EXPOSURE_RULE], "규칙 계산 (같은 기록에 야간 강도만 변경)"),
    conditions: conditions(ACTUAL_EXTEND, ACTUAL_PATROL, "29°C (+2)"),
  };
};
export const HW_NIGHT_EARLY = nightFrom("FC-HW-NIGHT-EARLY", DECISIONS[0]);
export const HW_NIGHT_2300 = nightFrom("FC-HW-NIGHT-2300", DECISIONS[2]);

export const HEATWAVE_FORECASTS: Forecast[] = [HW_ACTUAL, HW_EXTEND_1H, HW_EXTEND_2H, HW_PATROL_1H, HW_PATROL_2H, HW_NIGHT_EARLY, HW_NIGHT_2300];

const SITUATIONS: WhatIfSituation[] = [
  {
    situationId: "hot-night", label: "열대야 심화", detail: "야간 최저 27 → 29°C",
    byBasis: [
      { at: DECISIONS[0], forecastId: HW_NIGHT_EARLY.forecastId },
      { at: DECISIONS[1], forecastId: HW_NIGHT_EARLY.forecastId },
      { at: DECISIONS[2], forecastId: HW_NIGHT_2300.forecastId },
    ],
    method: `규칙 · 같은 공백 판정에 야간 격자 강도만 변경 · ${HW_EXPOSURE_RULE}`,
  },
];

const RESPONSES: WhatIfResponse[] = [
  {
    responseId: "shelter-extend", kind: "노출", target: "중앙 경로당 · 종합복지관 · 시립도서관", level: "익일 06:00 까지 야간 운영", adjust: "when", method: `규칙 · ${HW_EXPOSURE_RULE}`,
    anchor: { label: "실제 야간 연장", at: ACTUAL_EXTEND },
    presets: [
      { id: "actual", label: "실제", at: ACTUAL_EXTEND, forecastId: null },
      { id: "early1h", label: "1시간 일찍", at: t("22:00"), forecastId: HW_EXTEND_1H.forecastId },
      { id: "early2h", label: "2시간 일찍", at: t("21:00"), forecastId: HW_EXTEND_2H.forecastId },
    ],
  },
  {
    responseId: "patrol", kind: "노출", target: "취약 밀집 격자 2곳", level: "순회 지원차 2대 · 안부 확인·냉방용품", adjust: "when", method: `규칙 · ${HW_EXPOSURE_RULE}`,
    anchor: { label: "실제 순회 배치", at: ACTUAL_PATROL },
    presets: [
      { id: "actual", label: "실제", at: ACTUAL_PATROL, forecastId: null },
      { id: "early1h", label: "1시간 일찍", at: t("22:30"), forecastId: HW_PATROL_1H.forecastId },
      { id: "early2h", label: "2시간 일찍", at: t("21:30"), forecastId: HW_PATROL_2H.forecastId },
    ],
  },
];

export const HEATWAVE_WHATIF: WhatIfCase = {
  incidentId: HW_INCIDENT_ID,
  title: "창원 도심 폭염",
  hazardKind: "폭염",
  twinFamily: "E",
  scope: { kind: "구역", displayAnchor: cellCenter(3, 2), affectedGeometryId: "GEO-E-SCOPE", label: "창원 도심 생활권 격자" },
  occurredAt: t("11:00"),
  closedAt: t("19:00", "07"),
  record: [
    { at: t("11:00"), label: "폭염경보 2일째 · 쉼터 운영 안내", kind: "관측" },
    { at: t("14:00"), label: "노출 전망 · 야간 공백 격자 예상", kind: "예측", decision: true },
    { at: t("16:00"), label: "은행 냉방쉼터 운영 종료", kind: "관측" },
    { at: t("18:00"), label: "주간 쉼터 운영 종료 · 공백 발생", kind: "영향", decision: true },
    { at: t("21:00"), label: "시립도서관 운영 종료", kind: "관측" },
    { at: t("23:00"), label: "경로당·복지관·도서관 야간 연장", kind: "대응", decision: true },
    { at: t("23:30"), label: "순회 지원차 2대 배치", kind: "대응" },
    { at: t("14:00", "07"), label: "이틀째 최고 노출", kind: "영향" },
    { at: t("19:00", "07"), label: "폭염경보 해제 · 사건 종료", kind: "관측" },
  ],
  reconstructionForecastId: HW_ACTUAL.forecastId,
  stateByTime: [
    { at: t("14:00"), rows: [{ label: "기온", value: "35.2°C" }, { label: "체감온도", value: "37°C" }, { label: "운영 쉼터", value: "6곳" }, { label: "야간 개방 쉼터", value: "1곳" }] },
    { at: t("18:00"), rows: [{ label: "기온", value: "34.1°C" }, { label: "체감온도", value: "36°C" }, { label: "운영 쉼터", value: "2곳" }, { label: "야간 개방 쉼터", value: "1곳" }] },
    { at: t("23:00"), rows: [{ label: "기온", value: "29.8°C" }, { label: "체감온도", value: "31°C" }, { label: "운영 쉼터", value: "4곳" }, { label: "야간 개방 쉼터", value: "4곳 (연장 3)" }] },
    { at: t("14:00", "07"), rows: [{ label: "기온", value: "35.9°C" }, { label: "체감온도", value: "38°C" }, { label: "운영 쉼터", value: "6곳" }, { label: "야간 개방 쉼터", value: "4곳" }] },
  ],
  observed: [
    { label: "온열질환자 (보건소 집계)", value: "7명" },
    { label: "야간 쉼터 이용 (연장 3곳)", value: "86명" },
  ],
  responses: RESPONSES,
  situations: SITUATIONS,
};
