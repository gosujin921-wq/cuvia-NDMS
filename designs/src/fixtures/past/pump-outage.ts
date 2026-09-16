/* ─────────────────────────────────────────────
 * G 기반시설·네트워크 장애 — 서항 펌프장 정전 파급 · 종료 사건의 대응 What-if (03 §12 · §22 G · §26)
 *
 * 기반시설 장애의 질문은 "무엇이 고장나서 어떤 서비스까지 멈췄는가"다. 17:15 변전 계통 장애로 제2배수펌프장이 멈추고,
 * 인근 통신 기지국이 비상전원 15분을 다 쓰자 마을방송이 끊겼으며, 18:00 에는 저지대 320세대가 정전됐다.
 * 노드가 차례로 꺼지는 것이 파급이다. 계통도(보조 분석뷰)가 같은 눈금으로 선다.
 *
 * 종료 사건이라 기준은 **실제로 한 대응**이다 — 17:40 펌프장 비상발전기 · 기지국 이동발전 투입 · 18:10 취약가구 순회 확인 · 18:30 복구반 도착.
 * 비상전원이 기지국 비상전원 소진(17:30)보다 늦었고, 순회는 엘리베이터 갇힘 신고가 들어온 뒤였다.
 *   비상전원 투입   대응 · 현상 감소 — 기지국 비상전원 소진(17:30) 전에 붙으면 파급이 거기서 멈춘다. 계통 파급 계산이 답을 내는 대안이다
 *   복구 지연       상황 — 한전 복구반이 1시간 늦었다면 같은 대응으로 버텼나. 사람이 조작하지 못한 외부 복구 조건이다
 * 취약가구 순회는 대안에서 뺐다(2026-09-16) — "일찍 할수록 그만큼 더 확인한다"는 산수라 트윈이 계산할 것이 없다.
 *
 * 노드·연결·중단 권역·시각·세대 수는 시나리오 편집값이다. 한전·통신사 실연계가 아니다.
 * ───────────────────────────────────────────── */

import type { Forecast, ForecastBasis, ForecastInput, ForecastMark, ImpactTarget, MarkImpact, MarkMetric } from "../../model/forecast";
import type { LngLat, NodeState, SceneLayer, SceneSystem, SystemEdge } from "../../model/scene";
import type { WhatIfCase, WhatIfCombo, WhatIfResponse, WhatIfSituation } from "../../model/whatif";
import { exposedMinutes } from "../exposure";

export const SP_INCIDENT_ID = "INC-2024-0724-SP01";
const t = (hhmm: string) => `2024-07-24T${hhmm}:00+09:00`;
/** 재현·대안 판의 기준시각 — 운전·전원 기록이 끝난 복전 시각. 판은 모두 사건이 끝난 뒤 계산했다 */
const BASE = t("19:40");
const VALID_UNTIL = t("21:00");
const AT = [t("17:15"), t("17:30"), t("18:00"), t("19:00")] as const;

/* 중단 권역 — 서항 펌프장 계통에서 통신·저지대 세대로 번진다 */
export const PUMP_OUTAGE_GEOMETRIES: Record<string, [number, number][]> = {
  "GEO-G-SCOPE": [[128.5625, 35.1995], [128.57, 35.1998], [128.5712, 35.195], [128.564, 35.194]],
  "GEO-G-OUT-1": [[128.5648, 35.1975], [128.5665, 35.1977], [128.5666, 35.1963], [128.5649, 35.1961]],
  "GEO-G-OUT-2": [[128.564, 35.1985], [128.568, 35.1988], [128.5682, 35.1958], [128.5642, 35.1955]],
  "GEO-G-OUT-3": [[128.5632, 35.1993], [128.5698, 35.1996], [128.5705, 35.1948], [128.5638, 35.1945]],
  "GEO-G-OUT-2R": [[128.5645, 35.198], [128.567, 35.1982], [128.5672, 35.196], [128.5647, 35.1958]],
};

/* ── 장면 층 (03 §22 G) — 노드가 차례로 꺼지는 것이 파급이다 ── */
const NODES: { id: string; label: string; icon: string; at: LngLat }[] = [
  { id: "sub", label: "변전 계통", icon: "mdi:transmission-tower", at: [128.5632, 35.1992] },
  { id: "pump", label: "제2배수펌프장", icon: "mdi:water-pump", at: [128.5658, 35.1978] },
  { id: "cell", label: "통신 기지국", icon: "mdi:radio-tower", at: [128.5688, 35.1985] },
  { id: "pa", label: "마을방송", icon: "mdi:bullhorn-outline", at: [128.5675, 35.1962] },
  { id: "homes", label: "저지대 320세대", icon: "mdi:home-city-outline", at: [128.5652, 35.1955] },
];
const EDGES: SystemEdge[] = [{ from: "sub", to: "pump" }, { from: "sub", to: "cell" }, { from: "sub", to: "homes" }, { from: "cell", to: "pa" }];
type State = Record<string, NodeState>;
const sceneOf = (st: State): SceneLayer[] => [
  ...EDGES.map<SceneLayer>((e) => ({ kind: "line", id: `g-edge-${e.from}-${e.to}`, role: "연결", coords: [NODES.find((n) => n.id === e.from)!.at, NODES.find((n) => n.id === e.to)!.at], state: st[e.from] === "중단" || st[e.to] === "중단" ? "off" : "on" })),
  ...NODES.map<SceneLayer>((n) => ({ kind: "node", id: `g-node-${n.id}`, at: n.at, label: n.label, icon: n.icon, state: st[n.id] ?? "정상" })),
];
const systemOf = (states: [State, State, State, State]): SceneSystem => ({
  nodes: NODES.map(({ id, label, icon }) => ({ id, label, icon })),
  edges: EDGES,
  stateByMark: Object.fromEntries(AT.map((at, i) => [at, states[i]])),
});

/* 노드 상태 — 17:15 장애 → 17:30 기지국 비상전원 소진 → 18:00 세대 정전 → 19:00 복전 중 */
const S1: State = { sub: "중단", pump: "중단", cell: "경고", pa: "정상", homes: "정상" };
const S2: State = { sub: "중단", pump: "중단", cell: "중단", pa: "중단", homes: "경고" };

/* 재현 입력 — 사건 동안의 운전·전원·복구 기록 */
const INPUTS: ForecastInput[] = [
  { label: "펌프장 운전 기록", at: t("19:40"), kind: "시설" },
  { label: "기지국 전원 기록 (통신사)", at: t("19:40"), kind: "시설" },
  { label: "배전 계통 장애·복전 기록 (한전)", at: t("19:40"), kind: "관측" },
];
/** 재현은 기록이 입력이라 불확실성이 낮고, 대안은 일어나지 않은 진행이라 보통이다. 둘 다 사건이 끝난 뒤(20:10) 계산했다 */
const basis = (assumptions: string[], modelName = "규칙 계산 (같은 기록에 투입·순회 시각만 변경)", grade: ForecastBasis["uncertainty"]["grade"] = "보통"): ForecastBasis => ({
  modelName, modelVersion: "0.1", baseTime: BASE, generatedAt: t("20:10"),
  observedFrom: t("17:00"), inputs: INPUTS, inputEventIds: [], assumptions,
  uncertainty: { grade, sensitiveTo: ["복구 예상시간", "의존관계 최신성"], unusableRanges: ["21:00 이후"] },
  inputQuality: "보정", calculationActor: "해당 없음",
  replacementNote: "시설 상태·의존관계 실연계 확보 시 같은 계약으로 교체",
});

type Four<T> = [T, T, T, T];
/** 첫 줄 — 중단 권역 수(03 §27). 복구 예상 같은 긴 말은 눈금 요약(impactSummary)이 든다 — 비교표 칸에는 짧게 */
const zones = (v: number, _text: string): MarkMetric => ({ label: "서비스 중단", value: v, unit: "곳", digits: 0, text: v > 0 ? `${v}곳` : "정상화" });
/* 노드 상태의 말 — 같은 "복구"라도 펌프장은 비상발전, 기지국은 이동발전, 세대는 순차 복전이다 */
const NODE_WORD: Record<"pump" | "cell" | "homes", Record<NodeState, string>> = {
  pump: { 정상: "정상", 경고: "경고", 중단: "정지", 복구: "비상발전 가동" },
  cell: { 정상: "정상", 경고: "비상전원", 중단: "불통", 복구: "이동발전 연결" },
  homes: { 정상: "정상", 경고: "전압 불안", 중단: "정전", 복구: "복전 중" },
};
const NODE_TONE: Record<NodeState, MarkImpact["tone"]> = { 정상: "muted", 경고: "warning", 중단: "danger", 복구: "safe" };
/** 그 시각의 핵심 영향 — 펌프장 · 통신 · 저지대 세대 노드 상태(계통도와 같은 값) */
const impactsOf = (st: State): MarkImpact[] => (["pump", "cell", "homes"] as const).map((id) => {
  const s = st[id] ?? "정상";
  return { label: NODES.find((n) => n.id === id)!.label, value: NODE_WORD[id][s], tone: NODE_TONE[s] };
});
const marksOf = (z: Four<[number, string]>, g: Four<string>, n: Four<string>, states: Four<State>): ForecastMark[] =>
  AT.map((validAt, i) => ({ validAt, maxDepthM: 0, metric: zones(z[i][0], z[i][1]), extentGeometryId: g[i], impactSummary: n[i], scene: sceneOf(states[i]), impacts: impactsOf(states[i]) }));

/* ── 규칙 — 정전 파급의 시간은 투입·연결 시각에서 바로 나온다(모델이 필요 없다). 원단위는 시나리오 편집값 ──
 *   펌프 정지 = (비상발전기 투입 + 기동 5분) − 장애 17:15
 *   통신 불통 = (이동발전 투입 + 연결 10분) − 기지국 비상전원 소진 17:30
 *   취약가구 순회는 수를 세지 않는다 — 순회 시작이 세대 정전(18:00)보다 이른가만 본다(README §2.3 기준 ③ · 2026-09-16) */
const FAULT = t("17:15");
const CELL_DOWN = t("17:30");
const plus = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
/** 세대 정전 = 복전 − 세대 정전 시작 18:00. 복전 시각은 한전 복구가 정한다(상황 조건 · 복구 지연에서만 달라진다) */
const HOMES_OUT = t("18:00");
const RESTORED = t("19:10");
export const SP_RULE = "펌프 정지 = 투입 + 기동 5분 − 장애 17:15 · 통신 불통 = 투입 + 연결 10분 − 비상전원 소진 17:30 · 세대 정전 = 복전 − 18:00";

/* 영향 대상 — 펌프장이 첫째다(도달 = 장애 시작). 중단 시간은 시각 차이고, 가구 수는 세지 않는다 */
const targets = (backupAt: string, patrolAt: string, restoredAt = RESTORED): ImpactTarget[] => {
  const pumpMin = exposedMinutes(FAULT, plus(backupAt, 5));
  const cellMin = exposedMinutes(CELL_DOWN, plus(backupAt, 10));
  const outMin = exposedMinutes(HOMES_OUT, restoredAt);
  /* 순회가 세대 정전보다 먼저 시작됐는가. 몇 가구를 돌았는지는 세지 않는다 */
  const patrolAhead = patrolAt <= HOMES_OUT;
  return [
    /* 장애가 난 시각(17:15)은 계통이 정한다 — 비상전원으로 바뀌지 않으므로 도달로 세우지 않는다.
       세우면 강평에 `17:15 → 17:15` 이 서서 "달라진 게 없다"로 읽힌다(2026-09-17 · 구항과 같은 이유) */
    { kind: "중요시설", id: "FAC-SP-PUMP", label: `제2배수펌프장 정지 ${pumpMin}분`, exposure: "부분 중단" },
    { kind: "중요시설", id: "FAC-SP-CELL", label: `통신 기지국·마을방송 불통 ${cellMin}분`, exposure: cellMin > 0 ? "부분 중단" : "영향 없음" },
    { kind: "건물", id: "BLD-SP-OUT", label: `저지대 320세대 정전 ${outMin}분`, exposure: "노출" },
    { kind: "대상자", id: "POP-SP-UNCHECKED", label: "취약가구 순회 확인", exposure: patrolAhead ? "통제됨" : "노출" },
  ];
};
const conditions = (backupAt: string, patrolAt: string, restore = "18:30 도착 · 19:10 복전"): Forecast["conditions"] => [
  { label: "장애 원인", value: "변전 계통 장애 17:15", tone: "danger" },
  { label: "비상전원", value: `펌프장 발전기 · 기지국 이동발전 ${backupAt.slice(11, 16)}` },
  { label: "순회", value: `취약가구 확인 2개조 ${patrolAt.slice(11, 16)}` },
  { label: "복구반", value: restore },
];
const common = { incidentId: SP_INCIDENT_ID, availability: "가용" as const, validUntil: VALID_UNTIL };

/* 실제 대응 시각 — 비상전원 17:40 · 순회 18:10 */
const ACTUAL_BACKUP = t("17:40");
const ACTUAL_PATROL = t("18:10");

/* ── 실제 — 기지국이 17:30 에 꺼진 뒤에야 비상전원이 들어가, 18:00 중단 권역이 셋까지 번졌다 ── */
const ACTUAL_STATES: Four<State> = [S1, S2, { sub: "중단", pump: "복구", cell: "복구", pa: "중단", homes: "중단" }, { sub: "복구", pump: "정상", cell: "정상", pa: "복구", homes: "복구" }];
const ACTUAL_Z: Four<[number, string]> = [[1, "19:10 복구 예상"], [2, "19:10 복구 예상"], [3, "펌프 가동 · 세대 19:10"], [1, "세대 복전 중"]];
const ACTUAL_G: Four<string> = ["GEO-G-OUT-1", "GEO-G-OUT-2", "GEO-G-OUT-3", "GEO-G-OUT-2R"];
const ACTUAL_N: Four<string> = ["변전 계통 장애 · 펌프 2/3 정지 · 배수 능력 저하", "기지국 비상전원 소진 · 마을방송 불가", "비상발전 가동 · 저지대 320세대 정전 · 엘리베이터 갇힘 신고", "복구반 도착 · 세대 순차 복전"];
export const SP_ACTUAL: Forecast = {
  ...common, forecastId: "FC-SP-ACTUAL", alternativeId: "baseline", changedConditions: [],
  marks: marksOf(ACTUAL_Z, ACTUAL_G, ACTUAL_N, ACTUAL_STATES),
  arrivalAt: t("17:15"),
  targets: targets(ACTUAL_BACKUP, ACTUAL_PATROL),
  basis: basis(["운전·전원 기록으로 다시 그린 파급", "실제 대응: 비상전원 17:40 · 순회 18:10 · 복구반 18:30", SP_RULE], "재현 (시설 운전·전원 기록)", "낮음"),
  system: systemOf(ACTUAL_STATES),
  conditions: conditions(ACTUAL_BACKUP, ACTUAL_PATROL),
};

/* ── 비상전원을 일찍 — 기지국이 꺼지기 전에 이동발전이 붙으면 파급이 거기서 멈춘다 ── */
interface BackupSpec { at: string; early: string; key: string; presetId: string; z: Four<[number, string]>; g: Four<string>; n: Four<string>; states: Four<State> }
const BACKUPS: BackupSpec[] = [
  {
    at: t("17:30"), early: "10분 일찍", key: "BACKUP-10", presetId: "early10",
    z: [[1, "19:10 복구 예상"], [2, "펌프 가동 · 기지국 이동발전"], [2, "통신 정상 · 세대 19:10"], [1, "세대 복전 중"]],
    g: ["GEO-G-OUT-1", "GEO-G-OUT-2", "GEO-G-OUT-2R", "GEO-G-OUT-1"],
    n: ["변전 계통 장애 · 펌프 2/3 정지", "비상발전 가동 · 기지국 이동발전 연결 중 · 방송 잠시 불가", "통신·방송 정상 · 저지대 세대 정전", "복구반 도착 · 세대 순차 복전"],
    states: [S1, { sub: "중단", pump: "복구", cell: "중단", pa: "중단", homes: "경고" }, { sub: "중단", pump: "정상", cell: "복구", pa: "복구", homes: "중단" }, { sub: "복구", pump: "정상", cell: "정상", pa: "정상", homes: "복구" }],
  },
  {
    at: t("17:20"), early: "20분 일찍", key: "BACKUP-20", presetId: "early20",
    z: [[1, "19:10 복구 예상"], [1, "펌프 가동"], [1, "세대 19:10"], [0, "정상화"]],
    g: ["GEO-G-OUT-1", "GEO-G-OUT-2R", "GEO-G-OUT-2R", "GEO-G-OUT-1"],
    n: ["변전 계통 장애 · 펌프 2/3 정지", "비상발전 가동 · 펌프 3/3 · 기지국 이동발전 배치", "세대 정전 지속 · 통신·방송 정상", "복전 완료 · 정상화"],
    states: [S1, { sub: "중단", pump: "복구", cell: "복구", pa: "정상", homes: "경고" }, { sub: "중단", pump: "복구", cell: "복구", pa: "정상", homes: "중단" }, { sub: "복구", pump: "정상", cell: "정상", pa: "정상", homes: "복구" }],
  },
];
const backupBoard = (b: BackupSpec): Forecast => ({
  ...common, forecastId: `FC-SP-${b.key}`, alternativeId: "backup-power",
  changedConditions: [`펌프장 비상발전기 · 기지국 이동발전 · ${b.at.slice(11, 16)} 투입 (실제보다 ${b.early})`],
  hypothesis: `비상전원을 실제보다 ${b.early}(${b.at.slice(11, 16)}) 투입한 경우`,
  marks: marksOf(b.z, b.g, b.n, b.states),
  arrivalAt: t("17:15"),
  targets: targets(b.at, ACTUAL_PATROL),
  basis: basis(["변전 계통 장애 지속", `비상전원 ${b.at.slice(11, 16)} 가정`, SP_RULE]),
  system: systemOf(b.states),
  conditions: conditions(b.at, ACTUAL_PATROL),
  actionAt: { label: "비상전원 투입", at: b.at },
});
export const SP_BACKUP_10 = backupBoard(BACKUPS[0]);
export const SP_BACKUP_20 = backupBoard(BACKUPS[1]);

/* ── 상황 조건 · 복구 지연 — 한전 복구반이 1시간 늦어 복전이 20:10 이었다면. 대응은 실제(비상전원 17:40 · 순회 18:10) 그대로 ──
   18:30 전까지는 실제와 같다. 판단 시점 둘(장애 17:15 · 기지국 소진 17:30)이 모두 그 앞이라 같은 판이다.
   19:00 에 세대 정전이 이어지고 변전 계통이 아직 중단이다 — 세대 정전 시간이 같은 규칙(복전 − 18:00)으로 는다 */
const DECISIONS = [t("17:15"), t("17:30")] as const;
const DELAY_RESTORED = t("20:10");
/** 복구반이 늦으면 19:00 에 변전 계통은 아직 중단이고 세대는 정전이다 — 비상전원으로 버티던 펌프·통신은 그대로 */
const delayed = (st: State): State => ({ ...st, sub: "중단", homes: "중단", pump: st.pump === "정상" ? "복구" : st.pump, pa: st.pa === "정상" ? "정상" : "복구" });
const DELAY_STATES: Four<State> = [ACTUAL_STATES[0], ACTUAL_STATES[1], ACTUAL_STATES[2], delayed(ACTUAL_STATES[3])];
export const SP_DELAY: Forecast = {
  ...common, forecastId: "FC-SP-DELAY", alternativeId: "situation",
  changedConditions: ["한전 복구반 19:30 도착 · 복전 20:10 (실제 18:30 · 19:10)"],
  hypothesis: "한전 복구반이 실제보다 1시간 늦게 도착한 경우",
  marks: marksOf([ACTUAL_Z[0], ACTUAL_Z[1], ACTUAL_Z[2], [2, "세대 정전 · 20:10 복전 예상"]], ["GEO-G-OUT-1", "GEO-G-OUT-2", "GEO-G-OUT-3", "GEO-G-OUT-2"],
    [ACTUAL_N[0], ACTUAL_N[1], ACTUAL_N[2], "복구반 지연 · 저지대 세대 정전 지속 · 20:10 복전 예상"], DELAY_STATES),
  arrivalAt: t("17:15"),
  targets: targets(ACTUAL_BACKUP, ACTUAL_PATROL, DELAY_RESTORED),
  basis: basis(["한전 복구반 도착 18:30 → 19:30 · 복전 19:10 → 20:10", "실제 대응 그대로: 비상전원 17:40 · 순회 18:10", SP_RULE], "규칙 계산 (같은 기록에 복전 시각만 변경)"),
  system: systemOf(DELAY_STATES),
  conditions: conditions(ACTUAL_BACKUP, ACTUAL_PATROL, "19:30 도착 · 20:10 복전 (1시간 지연)"),
};

/* ── 상황과 대응을 함께 — 복구가 늦는 날 비상전원을 일찍 넣으면 ──
   비상전원 판의 17:15~18:00 파급에 복구 지연의 19:00(변전 중단 · 세대 정전 지속)을 얹는다. 세대 정전 시간은 같은 규칙(복전 − 18:00)이다 */
const COMBO_FORECASTS: Forecast[] = BACKUPS.map((b) => {
  const states: Four<State> = [b.states[0], b.states[1], b.states[2], delayed(b.states[3])];
  return {
    ...common, forecastId: `FC-SP-DELAY-${b.key}`, alternativeId: "backup-power",
    changedConditions: [...SP_DELAY.changedConditions, `비상전원 ${b.at.slice(11, 16)} 투입 (실제보다 ${b.early})`],
    hypothesis: `한전 복구가 1시간 늦은 날 비상전원을 ${b.early}(${b.at.slice(11, 16)}) 투입했다면`,
    marks: marksOf([b.z[0], b.z[1], b.z[2], [b.z[3][0] + 1, "세대 정전 · 20:10 복전 예상"]], [b.g[0], b.g[1], b.g[2], "GEO-G-OUT-2R"],
      [b.n[0], b.n[1], b.n[2], "복구반 지연 · 저지대 세대 정전 지속 · 20:10 복전 예상"], states),
    arrivalAt: t("17:15"),
    targets: targets(b.at, ACTUAL_PATROL, DELAY_RESTORED),
    basis: basis(["한전 복구반 도착 18:30 → 19:30 · 복전 19:10 → 20:10", `비상전원 ${b.at.slice(11, 16)} 가정`, SP_RULE], "규칙 계산 (같은 기록에 복전 · 투입 시각 변경)"),
    system: systemOf(states),
    conditions: conditions(b.at, ACTUAL_PATROL, "19:30 도착 · 20:10 복전 (1시간 지연)"),
    actionAt: { label: "비상전원 투입", at: b.at },
  };
});
const COMBOS: WhatIfCombo[] = BACKUPS.map((b, i) => ({ situationForecastId: SP_DELAY.forecastId, responseId: "backup-power", presetId: b.presetId, forecastId: COMBO_FORECASTS[i].forecastId }));

/* ═══ 훈련 조합 (03 §26.10 · 2026-09-17) ═══════════════════════════════════
 *
 * 훈련이 묻는 것은 **비상전원을 언제 넣을까**다. 계통은 한 번 끊기면 아래로 차례차례 내려간다 —
 * 펌프가 서고, 기지국 비상전원이 17:30 에 바닥나면 마을방송이 끊기고, 18:00 에 저지대 세대가 정전된다.
 *
 * ★ **17:30 이 경계다.** 장애 발생(17:15) 때 정하면 17:20 에 붙어 기지국이 안 꺼지고,
 *   17:30 에 정하면 17:30 에 붙어 아슬아슬하게 걸리며, 안 정하면 실제 17:40 이라 통신이 끊긴 뒤다.
 *   파급이 어디서 멈추는지가 결정 시각 하나로 갈리는 것이 이 유형의 성질이다.
 * ★ **새 판을 만들지 않는다.** 복구 지연 × 비상전원 조합이 위에서 이미 생성됐다. 훈련은 그 판을 가리킬 뿐이다.
 * ★ 취약가구 순회는 대응에서 뺀 채로 둔다 — "일찍 할수록 그만큼 더 확인한다"는 산수다(파일 머리말).
 * ═══════════════════════════════════════════════════════════════════════ */
const SP_TRAINING_COMBOS: { conditionStepId: string; acts: Record<string, string>; forecastId: string }[] = [
  { conditionStepId: "now", acts: {}, forecastId: SP_ACTUAL.forecastId },
  { conditionStepId: "now", acts: { G1: AT[0] }, forecastId: SP_BACKUP_20.forecastId },
  { conditionStepId: "now", acts: { G1: AT[1] }, forecastId: SP_BACKUP_10.forecastId },
  { conditionStepId: "restore-delay", acts: {}, forecastId: SP_DELAY.forecastId },
  { conditionStepId: "restore-delay", acts: { G1: AT[0] }, forecastId: COMBO_FORECASTS[1].forecastId },
  { conditionStepId: "restore-delay", acts: { G1: AT[1] }, forecastId: COMBO_FORECASTS[0].forecastId },
];

export const PUMP_OUTAGE_FORECASTS: Forecast[] = [SP_ACTUAL, SP_BACKUP_10, SP_BACKUP_20, SP_DELAY, ...COMBO_FORECASTS];

const SITUATIONS: WhatIfSituation[] = [
  {
    situationId: "restore-delay", label: "복구 지연", detail: "한전 복구반 1시간 지연 · 복전 19:10 → 20:10",
    byBasis: DECISIONS.map((at) => ({ at, forecastId: SP_DELAY.forecastId })),
    method: `규칙 · 같은 기록에 복전 시각만 변경 · ${SP_RULE}`,
  },
];

const RESPONSES: WhatIfResponse[] = [
  {
    responseId: "backup-power", kind: "현상", target: "제2배수펌프장 · 통신 기지국", level: "비상발전기 · 이동발전차", adjust: "when", method: `규칙 · ${SP_RULE}`,
    anchor: { label: "실제 비상전원 투입", at: ACTUAL_BACKUP },
    presets: [
      { id: "actual", label: "실제", at: ACTUAL_BACKUP, forecastId: null },
      { id: "early10", label: "10분 일찍", at: t("17:30"), forecastId: SP_BACKUP_10.forecastId },
      { id: "early20", label: "20분 일찍", at: t("17:20"), forecastId: SP_BACKUP_20.forecastId },
    ],
  },
];

export const PUMP_OUTAGE_WHATIF: WhatIfCase = {
  incidentId: SP_INCIDENT_ID,
  title: "서항 펌프장 정전 파급",
  hazardKind: "기반시설 장애",
  twinFamily: "G",
  scope: { kind: "구역", displayAnchor: [128.567, 35.197], affectedGeometryId: "GEO-G-SCOPE", label: "서항 배수권역 전력·통신 계통" },
  occurredAt: t("17:18"),
  closedAt: t("19:40"),
  record: [
    { at: t("17:15"), label: "변전 계통 장애 · 펌프 2/3 정지", kind: "관측", decision: true },
    { at: t("17:18"), label: "파급 예측 · 기지국 17:30 비상전원 소진", kind: "예측" },
    { at: t("17:30"), label: "기지국 비상전원 소진 · 마을방송 불가", kind: "영향", decision: true },
    { at: t("17:40"), label: "펌프장 비상발전기 · 기지국 이동발전", kind: "대응" },
    { at: t("18:00"), label: "저지대 320세대 정전 · 승강기 갇힘 신고", kind: "영향" },
    { at: t("18:10"), label: "취약가구 순회 확인 시작", kind: "대응" },
    { at: t("18:30"), label: "한전 복구반 도착", kind: "대응" },
    { at: t("19:10"), label: "복전 완료 · 사건 종료", kind: "관측" },
  ],
  reconstructionForecastId: SP_ACTUAL.forecastId,
  stateByTime: [
    { at: t("17:15"), rows: [{ label: "변전 계통", value: "장애" }, { label: "제2배수펌프장", value: "정지" }, { label: "통신 기지국", value: "비상전원 15분" }, { label: "정전 세대", value: "0세대" }] },
    { at: t("17:30"), rows: [{ label: "변전 계통", value: "장애" }, { label: "제2배수펌프장", value: "정지" }, { label: "통신 기지국", value: "불통" }, { label: "정전 세대", value: "120세대" }] },
    { at: t("17:40"), rows: [{ label: "변전 계통", value: "장애" }, { label: "제2배수펌프장", value: "비상발전 가동" }, { label: "통신 기지국", value: "이동발전 연결" }, { label: "정전 세대", value: "320세대" }] },
    { at: t("18:30"), rows: [{ label: "변전 계통", value: "복구 중" }, { label: "제2배수펌프장", value: "비상발전 가동" }, { label: "통신 기지국", value: "정상" }, { label: "정전 세대", value: "320세대" }] },
  ],
  observed: [
    { label: "복전 완료 (한전)", value: "19:10" },
    { label: "승강기 갇힘 신고 (119)", value: "3건 · 전원 구조" },
  ],
  responses: RESPONSES,
  /* 발동한 규정 — 17:15 변전 계통 장애가 띄웠다. 실제로는 17:40 에 투입했고 그 사이 기지국이 꺼졌다 */
  sop: [
    { id: "G1", label: "비상전원 투입", trigger: "변전 계통 장애 · 기지국 비상전원 17:30 소진 예상", firedAt: t("17:15"), actedAt: ACTUAL_BACKUP, responseId: "backup-power" },
  ],
  training: {
    incidentId: SP_INCIDENT_ID,
    stops: [
      { at: AT[0], phase: "판단", note: "변전 계통이 끊겼다 · 지금 정하면 17:20 에 붙는다" },
      { at: AT[1], phase: "판단", note: "기지국 비상전원이 바닥난다 · 지금이 마지막 · 더 늦으면 실제와 같은 17:40" },
      { at: AT[2], phase: "결과", note: "저지대 세대 정전" },
      { at: AT[3], phase: "결과", note: "복구반 도착 · 복전" },
    ],
    conditions: [
      {
        id: "restore", label: "복구", stateLabel: "복구반",
        steps: [
          { id: "now", label: "당시", detail: "18:30 도착 · 19:10 복전", situationId: null },
          { id: "restore-delay", label: "1시간 지연", detail: "19:30 도착 · 20:10 복전", situationId: "restore-delay" },
        ],
      },
    ],
    firedSopIds: ["G1"],
    resultSopIds: ["G1"],
    combos: SP_TRAINING_COMBOS,
  },
  situations: SITUATIONS,
  combos: COMBOS,
};
