/* ─────────────────────────────────────────────
 * 침수 시뮬레이션 대상(site) — /scr-00 디지털트윈 시뮬레이션의 데이터 층 (2026-09-17)
 *
 * 화면 논리: 현실 데이터 → 현재 상태 → 시뮬레이션 → 영향 분석 → 관련 SOP → 대응.
 * 이 파일은 그중 "현재 상태"와 "시뮬레이션"을 든다. 화면은 여기서 받은 판(Forecast)을 시간축으로 읽을 뿐 값을 만들지 않는다.
 *
 * ★ 조건은 **판이 있는 값에만** 멈춘다. "80 mm/h" 같은 자유 입력은 두지 않는다 — 강우 → 수위 곡선은 모델이 없어
 *   사전 작성 판이고(모델 연결 시 교체), 수위 → 범위·수심만 지형 계산이다. 화면의 근거 절이 이 둘을 가른다.
 * ★ 축은 둘로 가른다. `조건`(강우 · 환경)과 `조치`(펌프 · 방류 · 환경을 실제로 바꾸는 것). 조치 축을 바꾸면
 *   같은 조건의 기준 판(`baselineOf`)과 견줘 "재시뮬레이션 비교"가 선다. 재난문자·통제처럼 환경을 못 바꾸는 SOP 업무는
 *   시뮬레이션에 넣지 않고 관련 SOP 목록에서 수행 상태만 본다.
 * ★ 대상 둘. 서항(진행 중 · 데모 시계가 현재)과 창원천(2024-08-28 재현 · 14:35 가 현재). 창원천은 종단도(profile)를 든다.
 * ───────────────────────────────────────────── */

import type { Forecast, ForecastMark } from "../forecast";
import type { LngLat, SceneLayer, ScenePoint } from "../scene";
import type { TwinFamily } from "../incident";
import type { WhatIfCase } from "../whatif";
import { INCIDENT_ID as SH_INCIDENT_ID } from "../../fixtures/seohang-flood/incident";
import { CW_INCIDENT_ID } from "../../fixtures/changwoncheon/whatif";
import { GEOMETRIES } from "../../fixtures";
import { findWhatIfCase, trainingResultOf, whatIfStateRowsAt } from "../selectors";
import { deviceKindSpec, devicesOf } from "../../demo/devices";
import { sopItemsFor } from "../../demo/sop";
import { floodSurfaceOf } from "../../lib/flood-surfaces";
import { formatMarkMetric, markMetricLabel } from "../../lib/forecast-twin";
import { HEAVY_RAIN_ADVISORY_3H, HEAVY_RAIN_WARNING_3H, OBS_AREA_HA, RULE_DATE, RULE_MAX_3H, RULE_START, RULE_TOTAL_MM, areaOfLevel, cumulativeAt, depthOfLevel, factorForWarning, levelAtMinutes, ruleForecast, type RuleChoice } from "./rain-rule";

export interface SimOption { id: string; label: string; detail?: string; /** 당시 관측값에 곱하는 배율(조건의 정의가 "당시 × 1.2"일 때) */ factor?: number }
export interface SimCondition {
  id: string;
  label: string;
  /** `조건` 은 환경(강우), `조치` 는 환경을 실제로 바꾸는 대응(펌프 · 방류). 조치 축만 재시뮬레이션 비교가 선다 */
  kind: "조건" | "조치";
  /** 이 조건이 바꾸는 관측 줄 이름 — 배율로 환산해 보인다(관측을 지어내는 것이 아니라 조건의 정의다) */
  stateLabel?: string;
  options: SimOption[];
}
export interface StateRow { label: string; value: string; note?: string }
/**
 * 관련 SOP 한 줄 — 기존 SOP 를 **매칭**한다(발동이 아니다).
 * `from` 은 이 줄이 해당되기 시작하는 상황 단계(`stageAt`)다. 사건이 든 규정(`WhatIfCase.sop`)은 대응 종류로 단계를 읽는다:
 * 현상 대응(방류 · 펌프)은 물이 예측되는 순간부터(advisory), 노출 대응(통제 · 대피)은 도로 도달부터(warning).
 * ★ 문구는 기관 SOP 가 오면 교체한다. 여기서 새 항목을 짓지 않는다.
 */
export interface SimSop {
  id: string; label: string; detail: string; from: "advisory" | "warning" | "evacuate"; mode?: "auto" | "approval";
  /** 이 규정이 움직이는 지도 위 시설(장면 점 id · 장치 id). 줄 ↔ 마커가 서로 가리킨다. 자리가 원본에 없는 시설은 안 잇는다 */
  facilityIds?: string[];
}

/**
 * 조치 — 시간이 그 시각을 지나면 지도·시간축·조치 이력이 함께 "일어났다"고 말한다(2026-09-17 사용자 "색만 바뀌어 뭘 말하는지 모르겠다").
 *   환경  물을 바꾸는 조치(방류 · 펌프). 결과(수면 · 종단도)가 달라진다
 *   노출  사람을 빼는 조치(통제 · 대피). 마커·선만 바뀌고 물은 그대로다
 */
export interface SimAction { id: string; at: string; label: string; kind: "환경" | "노출"; facilityIds: string[] }
/** 시각 비교는 늘 밀리초로 — "+09:00" 표기와 "Z" 표기가 섞이면 문자열 비교가 틀린다(2026-09-17 조치가 전부 "예정"으로 섰다) */
export const isPast = (eventIso: string, atIso: string) => new Date(eventIso).getTime() <= new Date(atIso).getTime();

/** 대상의 공통 뼈대 — 침수·폭염이 같은 좌측 레일(대상 · 시나리오 · 고른 조건)을 쓴다 */
export interface SimSiteBase {
  id: string;
  label: string;
  status: "진행 중" | "재현";
  /** 시뮬레이션의 "현재" — 진행 중 사건은 데모 시계, 재현은 그날의 판단 시각 */
  now: string;
  /** 재현 대상은 날짜를 화면에 명시한다 */
  dateLabel: string;
  conditions: SimCondition[];
  defaults: Record<string, string>;
  /** 기준 시나리오의 이름 — 안 주면 재현은 "실제 사건 · 그날 조건 · 그날 조치", 진행 중은 "기준 전망" */
  baselineTag?: string;
  baselineLabel?: string;
}

export interface FloodSite extends SimSiteBase {
  incidentId: string;
  family: TwinFamily;
  anchor: LngLat;
  scopeGeometryId?: string;
  boardOf(choice: Record<string, string>): Forecast | null;
  /** 같은 조건에서 조치 축을 기본(실제)으로 둔 판 — 재시뮬레이션 비교의 기준 */
  baselineOf(choice: Record<string, string>): Forecast | null;
  /** 현재 상태 — 관측·운영값. 시뮬레이션 결과가 아니다 */
  currentRows(now: Date): StateRow[];
  /** 시나리오·시각에 따른 상태 줄 — 규칙 대상은 이것으로(누적 강우 · 도로 수위). 있으면 `currentRows` 대신 쓴다 */
  stateRowsOf?(choice: Record<string, string>, atIso: string): (StateRow & { computed?: boolean; scaled?: boolean })[];
  /** 실측 — 사건 원장·흔적. 편집 사례는 비운다(실측이라 부르지 않는다) */
  observed: { label: string; value: string }[];
  /** 규칙 대상 — 수위·면적·수심이 연속값이다. 없으면 사전 작성 판의 눈금을 보간한다 */
  rule?: {
    levelAt(choice: Record<string, string>, atIso: string): number;
    areaOfLevel(level: number): number;
    depthOfLevel(level: number): number;
    /** 지형 채우기 패치를 찾는 링 id — 규칙은 링이 아니라 수위로 채우므로 하나면 된다 */
    surfaceGeometryId: string;
  };
  /** 이 대상에 매칭되는 기존 SOP */
  sop: SimSop[];
  /** 장면 점 밖의 시설 — SOP 가 가리키는 장치(CCTV · 마을방송). 장면 점과 같은 모양으로 선다 */
  extraFacilities: ScenePoint[];
  /** 그 시나리오·판에서 일어나는 조치 */
  actionsOf(choice: Record<string, string>, f: Forecast | null): SimAction[];
  wcase: WhatIfCase | null;
}

/** 사건이 든 규정 → 관련 SOP 줄. 대응 종류(현상 · 노출)로 해당 단계를 읽는다 */
export const sopOfCase = (wcase: WhatIfCase | null, facilityIdsOf: Record<string, string[]> = {}): SimSop[] =>
  (wcase?.sop ?? []).map((s) => {
    const kind = wcase?.responses.find((r) => r.responseId === s.responseId)?.kind;
    return { id: s.id, label: s.label, detail: s.trigger, from: kind === "현상" ? "advisory" : "warning", mode: "approval", ...(facilityIdsOf[s.id] ? { facilityIds: facilityIdsOf[s.id] } : {}) };
  });

/** 사건이 든 규정 → 조치 목록. 내가 정한 시각(`acts`)이 있으면 그것, 없으면 그날 실제 시각 */
const actionsOfCase = (wcase: WhatIfCase | null, acts: Record<string, string>, facilityIdsOf: Record<string, string[]>): SimAction[] =>
  (wcase?.sop ?? []).flatMap((s) => {
    const at = acts[s.id] ?? s.actedAt;
    if (!at) return [];
    const kind = wcase?.responses.find((r) => r.responseId === s.responseId)?.kind;
    return [{ id: s.id, at, label: s.label, kind: kind === "현상" ? "환경" : "노출", facilityIds: facilityIdsOf[s.id] ?? [] }];
  });

const ms = (iso: string) => new Date(iso).getTime();

/* ── 서항 — 2024-09-21 실제 사건 재현. 강우 실자료 + 침수흔적으로 보정한 규칙(model/sim/rain-rule.ts)이 판을 만든다 ──
   축은 강우(실제 · 호우경보 기준) × 한계강우량(p.41 · 50 · 40 mm). 펌프 축은 제원·가동 로그가 없어 규칙에 없다(오면 같은 자리에 선다) */
const LIM_OPTIONS: SimOption[] = [
  { id: "50", label: "50 mm · p.41 중앙값", detail: "24년 도시침수 완료보고 p.41 한계강우량 표의 중앙값" },
  { id: "40", label: "40 mm · p.41 최소", detail: "표에서 가장 취약한 지점의 값 · 더 빨리 잠기는 경우" },
];
const seohangSite = (): FloodSite => {
  const wcase = findWhatIfCase(SH_INCIDENT_ID) ?? null;
  const fWarn = factorForWarning(HEAVY_RAIN_WARNING_3H);
  const rainOptions: SimOption[] = [
    { id: "fc", label: "실제", detail: `누적 ${RULE_TOTAL_MM} mm · 3시간 최대 ${RULE_MAX_3H} mm`, factor: 1 },
    fWarn > 1
      ? { id: "warn", label: "호우경보 기준", detail: `3시간 ${HEAVY_RAIN_WARNING_3H} mm 에 닿는 세기 · 실제 × ${fWarn}`, factor: fWarn }
      /* 실제가 이미 경보 기준을 넘었으면 앵커가 없다 — 배율을 숨기지 않고 그대로 적는다 */
      : { id: "x15", label: "실제 × 1.5", detail: `실제가 이미 호우경보 3시간 기준(${HEAVY_RAIN_WARNING_3H} mm)을 넘었다 · 배율로만 올린다`, factor: 1.5 },
  ];
  const conditions: SimCondition[] = [
    { id: "rain", label: "강우", kind: "조건", options: rainOptions },
    { id: "lim", label: "한계강우량", kind: "조건", options: LIM_OPTIONS },
  ];
  const defaults = { rain: "fc", lim: "50" };
  const ruleChoice = (c: Record<string, string>): RuleChoice => {
    const r = rainOptions.find((o) => o.id === (c.rain ?? defaults.rain)) ?? rainOptions[0];
    const lim = Number(c.lim ?? defaults.lim);
    return { factor: r.factor ?? 1, pLim: lim, label: [r.factor !== 1 ? `강우 ${r.label}` : null, lim !== 50 ? `한계강우량 ${lim} mm` : null].filter(Boolean).join(" · ") };
  };
  const minutesOf = (atIso: string) => (new Date(atIso).getTime() - new Date(RULE_START).getTime()) / 60_000;
  return {
    id: "seohang",
    label: "서항 배수권역",
    incidentId: SH_INCIDENT_ID,
    family: wcase?.twinFamily ?? "A",
    status: "재현",
    anchor: wcase?.scope.displayAnchor ?? [128.567, 35.197],
    scopeGeometryId: wcase?.scope.affectedGeometryId,
    now: RULE_START,
    dateLabel: `${RULE_DATE.replace(/-/g, ".")} 재현 · 강우 실자료 · 규칙 계산`,
    baselineTag: "실제 사건",
    baselineLabel: "그날 강우 · 한계강우량 50 mm",
    conditions,
    defaults,
    boardOf: (c) => { const rc = ruleChoice(c); return ruleForecast(rc, `FC-SH-RULE-${c.rain ?? defaults.rain}-${c.lim ?? defaults.lim}`, rc.label === ""); },
    baselineOf: () => ruleForecast(ruleChoice(defaults), "FC-SH-RULE-fc-50", true),
    currentRows: () => [],
    stateRowsOf: (c, atIso) => {
      const rc = ruleChoice(c);
      const m = minutesOf(atIso);
      const cum = cumulativeAt(m, rc.factor);
      const last3 = cum - cumulativeAt(m - 180, rc.factor);
      const level = levelAtMinutes(m, rc.factor, rc.pLim);
      return [
        { label: "누적 강우", value: `${Math.round(cum)} mm`, note: rc.factor === 1 ? "실자료" : `실제 × ${rc.factor}`, scaled: rc.factor !== 1 },
        { label: "3시간 강우", value: `${Math.round(last3)} mm`, note: last3 >= HEAVY_RAIN_WARNING_3H ? "경보 기준" : last3 >= HEAVY_RAIN_ADVISORY_3H ? "주의보 기준" : undefined },
        { label: "한계강우량", value: `${rc.pLim} mm`, note: cum >= rc.pLim ? "초과" : `${Math.round(rc.pLim - cum)} mm 남음` },
        { label: "도로 수위", value: `${level.toFixed(2)} EL.m`, note: "규칙 계산", computed: true },
      ];
    },
    observed: [{ label: "침수흔적도 · 권역 안 면적", value: `${OBS_AREA_HA} ha` }],
    rule: {
      levelAt: (c, atIso) => { const rc = ruleChoice(c); return levelAtMinutes(minutesOf(atIso), rc.factor, rc.pLim); },
      areaOfLevel,
      depthOfLevel,
      surfaceGeometryId: "GEO-FLOOD-T10",
    },
    /* 서항의 SOP 표본은 해일 절차(SOP_ITEMS · 서항지구 대상값)다. 시설 연결: CCTV 감시 → CCTV 장치, 마을방송 → 방송 장치, 해안도로 차단 → 차단 지점 */
    sop: [
      ...sopOfCase(wcase),
      ...sopItemsFor("evacuate").map((s) => ({
        id: `sh-${s.id}`, label: s.label, detail: s.target === "—" ? "" : s.target, from: s.minLevel, mode: s.mode,
        ...(SH_SOP_FACILITIES[s.id] ? { facilityIds: SH_SOP_FACILITIES[s.id] } : {}),
      })),
    ],
    extraFacilities: SH_DEVICE_POINTS,
    /* 조치 축이 없다 — 펌프 제원·가동 로그가 오면 규칙에 넣고 여기 선다 */
    actionsOf: () => [],
    wcase,
  };
};

/** 서항 SOP 표본 → 시설. 장치 id 는 `devicesOf("seohang")` 의 것이다 */
const SH_DEVICES = devicesOf("seohang");
const SH_CCTV = SH_DEVICES.filter((d) => d.kind === "CV").slice(0, 2);
const SH_BC = SH_DEVICES.filter((d) => d.kind === "BC");
const SH_SOP_FACILITIES: Record<string, string[]> = {
  cctv: SH_CCTV.map((d) => d.id),
  broadcast: SH_BC.map((d) => d.id),
  road: ["a-block-s", "a-block-n"],
};
const SH_DEVICE_POINTS: ScenePoint[] = [...SH_CCTV, ...SH_BC].map((d) => ({
  kind: "point", id: d.id, at: d.center, icon: deviceKindSpec(d.kind).icon, label: d.name, state: d.status, tone: d.status === "정상" ? "neutral" : "warning", small: true,
}));

/* ── 창원천 — 2024-08-28 재현. 판은 훈련 조합(강우 당시 · +20% · +50% × 방류 실제 15:05 · 14:35 조기) ── */
const changwoncheonSite = (): FloodSite | null => {
  const wcase = findWhatIfCase(CW_INCIDENT_ID) ?? null;
  const t = wcase?.training ?? null;
  if (!wcase || !t) return null;
  const now = t.stops[0]?.at ?? wcase.occurredAt;
  const rainSteps = t.conditions[0]?.steps ?? [];
  const actsOf = (discharge: string): Record<string, string> => (discharge === "early" ? { S2: now } : {});
  return {
    id: "changwoncheon",
    label: wcase.title,
    incidentId: CW_INCIDENT_ID,
    family: wcase.twinFamily,
    status: "재현",
    anchor: wcase.scope.displayAnchor,
    scopeGeometryId: wcase.scope.affectedGeometryId,
    now,
    /* 이 사건의 수치는 원장이 아니라 시나리오 편집값이다(fixtures/changwoncheon/whatif.ts 머리말). "실제 사건 · 실측"이라 부르지 않는다 */
    dateLabel: `${now.slice(0, 10).replace(/-/g, ".")} 사례(편집) · ${now.slice(11, 16)} 기준`,
    baselineTag: "사례 시나리오",
    baselineLabel: "편집 사례 · 그날 조건 · 그날 조치",
    conditions: [
      { id: "rain", label: "강우", kind: "조건", stateLabel: t.conditions[0]?.stateLabel, options: rainSteps.map((s) => ({ id: s.id, label: s.label, detail: s.detail, factor: s.factor })) },
      {
        id: "discharge", label: "상류 저류지 방류", kind: "조치",
        options: [
          { id: "actual", label: "실제 · 15:05", detail: "그날 한 대로" },
          { id: "early", label: `${now.slice(11, 16)} 조기 방류`, detail: "예측 발생 즉시" },
        ],
      },
    ],
    defaults: { rain: rainSteps[0]?.id ?? "now", discharge: "actual" },
    boardOf: (c) => trainingResultOf(wcase, c.rain ?? "now", actsOf(c.discharge ?? "actual")).mine,
    baselineOf: (c) => trainingResultOf(wcase, c.rain ?? "now", {}).mine,
    currentRows: (at) => whatIfStateRowsAt(wcase, at.toISOString()).rows.map((r) => ({ label: r.label, value: r.value })),
    observed: [],
    /* 창원천은 사건이 든 규정(S1 둔치 통제 · S2 상류 저류지 방류 · S3 천변도로 통제)만. 봉암 표본을 끌어오지 않는다(지명이 틀린다) */
    sop: sopOfCase(wcase, CW_SOP_FACILITIES),
    extraFacilities: [],
    actionsOf: (c) => actionsOfCase(wcase, actsOf(c.discharge ?? "actual"), CW_SOP_FACILITIES),
    wcase,
  };
};

/**
 * 창원천 규정 → 시설. 상류 저류지는 원본에 좌표가 없어 자리를 세우지 않는다 — 방류 표식은 상류 수위계에 건다(방류가 보이는 곳).
 * 둔치 산책로는 객체가 없어 잇지 않는다. 천변도로 통제는 차단 지점(통제되면 장면에 선다)
 */
const CW_SOP_FACILITIES: Record<string, string[]> = { S2: ["cw-st-a"], S3: ["cw-block-w", "cw-block-e"] };

/**
 * 대상 목록 — **실제 사건이 먼저다.** 서항 2024-09-21 은 강우 실자료와 침수흔적으로 보정한 규칙이 있어 기준(Baseline)을 설명할 수 있다
 * (2026-09-17 방향: 과거 사건으로 모델 신뢰를 확보하고 그 모델로 "그때 조건이 달랐다면"을 본다). 창원천은 편집 사례라 둘째다.
 */
export function floodSites(): FloodSite[] {
  return [seohangSite(), changwoncheonSite()].filter((s): s is FloodSite => s !== null);
}

/* ═══ 시나리오 — 실제 사건(기준) · A 조건 변경 · B 조치 변경 · A+B. 조건 축의 선택지에서 만든다 ═══ */

export interface SimScenario {
  id: string;
  /** "실제 사건" · "A" · "B" · "A+B" */
  tag: string;
  label: string;
  choice: Record<string, string>;
  /** 기준인가 — 과거 사건이면 실측 결과가 붙는다 */
  baseline: boolean;
}

export function scenariosOf(site: SimSiteBase): SimScenario[] {
  /* A 는 첫 축, B 는 둘째 축 — 침수는 조건 · 조치, 폭염은 조건 · 조건(기온 · 습도)이다. 축의 종류가 아니라 순서가 열을 정한다 */
  const cond = site.conditions[0];
  const act = site.conditions[1];
  const altCond = cond?.options.find((o) => o.id !== site.defaults[cond.id]) ?? null;
  const altAct = act?.options.find((o) => o.id !== site.defaults[act.id]) ?? null;
  const out: SimScenario[] = [{
    id: "base",
    tag: site.baselineTag ?? (site.status === "재현" ? "실제 사건" : "기준 전망"),
    label: site.baselineLabel ?? (site.status === "재현" ? "그날 조건 · 그날 조치" : "예보대로 · 지금 상태"),
    choice: { ...site.defaults }, baseline: true,
  }];
  /* 조건 축은 축 이름을 앞에 붙인다("강우 +20%" · "습도 +10 %p"). 조치 축은 선택지가 이미 문장이다("14:35 조기 방류") */
  const nameOf = (c: SimCondition, o: SimOption) => (c.kind === "조건" ? `${c.label} ${o.label}` : o.label);
  if (cond && altCond) out.push({ id: "A", tag: "A", label: nameOf(cond, altCond), choice: { ...site.defaults, [cond.id]: altCond.id }, baseline: false });
  if (act && altAct) out.push({ id: "B", tag: "B", label: nameOf(act, altAct), choice: { ...site.defaults, [act.id]: altAct.id }, baseline: false });
  if (cond && altCond && act && altAct) out.push({ id: "AB", tag: "A+B", label: `${nameOf(cond, altCond)} · ${nameOf(act, altAct)}`, choice: { ...site.defaults, [cond.id]: altCond.id, [act.id]: altAct.id }, baseline: false });
  return out;
}

/** 비교표 한 열 — 판 전체에서 읽는다(시각과 무관). 실측은 사건 `observed` 에서 라벨로 찾는다 */
export interface ScenarioSummary {
  startAt: string | null;
  startLabel: string | null;
  /** 판의 핵심 지표 이름 — 창원천은 합류부 수위, 서항은 침수심 */
  metricLabel: string;
  maxDepthM: number;
  maxDepthAt: string | null;
  maxAreaHa: number;
  /** 도달이 적힌 대상 수 */
  hitTargets: number;
}
export function summarizeForecast(f: Forecast): ScenarioSummary {
  const sorted = marksSorted(f);
  const peak = sorted.reduce<ForecastMark | null>((a, m) => (!a || m.maxDepthM > a.maxDepthM ? m : a), null);
  const area = Math.max(0, ...sorted.map((m) => { const r = ringOf(m.extentGeometryId); return r ? ringAreaHa(r) : 0; }));
  const start = f.arrivalAt ?? null;
  return {
    startAt: start,
    startLabel: start ? f.targets.find((t) => t.arrivalAt === start)?.label ?? null : null,
    metricLabel: peak ? markMetricLabel(peak) : "침수심",
    maxDepthM: peak ? (peak.metric?.value ?? peak.maxDepthM) : 0,
    maxDepthAt: peak?.validAt ?? null,
    maxAreaHa: area,
    hitTargets: f.targets.filter((t) => t.arrivalAt && t.exposure !== "영향 없음").length,
  };
}

/* ═══ 시간축 읽기 — 판의 눈금 사이를 보간한다. 수위(해발)는 연속 값이라 보간이 뜻이 있고, 범위 링은 눈금 것을 쓴다 ═══ */

export const marksSorted = (f: Forecast): ForecastMark[] => [...f.marks].sort((a, b) => ms(a.validAt) - ms(b.validAt));

/** 그 시각 이하의 마지막 눈금 — 범위 링·장면은 이것이다. 첫 눈금 전이면 없다(물이 아직 안 왔다) */
export function floorMarkAt(f: Forecast, atIso: string): ForecastMark | null {
  const sorted = marksSorted(f);
  return [...sorted].reverse().find((m) => ms(m.validAt) <= ms(atIso)) ?? null;
}

/** 두 눈금 사이 선형 보간 — 앞 눈금 전은 0, 마지막 눈금 뒤는 마지막 값 */
function lerpMarks(f: Forecast, atIso: string, valueOf: (m: ForecastMark) => number | null): number | null {
  const sorted = marksSorted(f);
  if (sorted.length === 0) return null;
  const at = ms(atIso);
  if (at <= ms(sorted[0].validAt)) return null;
  for (let i = 1; i < sorted.length; i += 1) {
    const a = sorted[i - 1], b = sorted[i];
    if (at <= ms(b.validAt)) {
      const va = valueOf(a), vb = valueOf(b);
      if (va === null || vb === null) return vb ?? va;
      const p = (at - ms(a.validAt)) / Math.max(1, ms(b.validAt) - ms(a.validAt));
      return va + (vb - va) * p;
    }
  }
  return valueOf(sorted[sorted.length - 1]);
}

/**
 * 그 시각의 수면 높이(해발 m) — 지형 수면 채우기의 입력.
 * 첫 눈금 전에는 **관측 수위**를 쓴다(있으면). 예측판 첫 눈금을 당겨 쓰면 시작부터 잠긴 지도가 된다.
 */
export function surfaceLevelAt(f: Forecast, wcase: WhatIfCase | null, atIso: string): number | null {
  const sorted = marksSorted(f);
  const first = sorted[0];
  if (!first) return null;
  if (ms(atIso) < ms(first.validAt)) {
    if (!wcase) return null;
    const label = markMetricLabel(first);
    const raw = whatIfStateRowsAt(wcase, atIso).rows.find((r) => r.label === label)?.value;
    const v = Number.parseFloat(raw ?? "");
    return Number.isFinite(v) ? v : null;
  }
  return lerpMarks(f, atIso, (m) => floodSurfaceOf(m.extentGeometryId)?.spec.level ?? null);
}

/** 그 시각의 최대 침수심(m) — 눈금 사이 보간. 첫 눈금 전은 0 */
export function depthAt(f: Forecast, atIso: string): number {
  return lerpMarks(f, atIso, (m) => m.maxDepthM) ?? 0;
}

/**
 * 그 시각 상태 줄 — 관측 기록 위에 시나리오를 얹는다.
 *   핵심 지표 줄(합류부 수위 · 침수심)   관측이 아니라 **그 시나리오 판의 값**이다. 관측을 그대로 두면 "막은 판"에 넘친 수위가 선다
 *   조건이 바꾸는 줄(상류 강우계)        조건의 배율로 환산한다(정의가 "당시 × 1.2")
 *   나머지                              당시 기록 그대로
 */
export function stateRowsAt(site: FloodSite, f: Forecast | null, choice: Record<string, string>, atIso: string): (StateRow & { computed?: boolean; scaled?: boolean })[] {
  if (site.stateRowsOf) return site.stateRowsOf(choice, atIso);
  const raw = site.currentRows(new Date(atIso));
  const mark = f ? floorMarkAt(f, atIso) : null;
  const metricLabel = mark ? markMetricLabel(mark) : null;
  const cond = site.conditions.find((c) => c.stateLabel);
  const factor = cond ? cond.options.find((o) => o.id === (choice[cond.id] ?? site.defaults[cond.id]))?.factor ?? 1 : 1;
  return raw.map((r) => {
    if (mark && metricLabel && r.label === metricLabel) return { ...r, value: formatMarkMetric(mark), note: undefined, computed: true };
    if (cond?.stateLabel && factor !== 1 && r.label === cond.stateLabel) {
      const n = Number.parseFloat(r.value);
      if (!Number.isFinite(n)) return r;
      const unit = r.value.replace(/^[\d.]+\s*/, "");
      return { ...r, value: `${Math.round(n * factor)} ${unit}`.trim(), scaled: true };
    }
    return r;
  });
}

/** 지평선 끝 — 마지막 눈금 */
export function horizonOf(f: Forecast): string {
  const s = marksSorted(f);
  return s[s.length - 1]?.validAt ?? f.validUntil ?? f.basis.baseTime;
}

/* ═══ 영향 분석 — 시뮬레이션 결과(범위 링)와 공간 객체의 교차. 수를 지어내지 않는다 ═══ */

/** 링 안에 점이 있나 — 광선 교차 */
export function pointInRing(pt: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 링 면적(ha) — 위도 보정한 평면 근사 */
export function ringAreaHa(ring: LngLat[]): number {
  if (ring.length < 3) return 0;
  const lat0 = (ring.reduce((a, p) => a + p[1], 0) / ring.length) * (Math.PI / 180);
  const kx = 111_320 * Math.cos(lat0), ky = 110_540;
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    s += ring[j][0] * kx * ring[i][1] * ky - ring[i][0] * kx * ring[j][1] * ky;
  }
  return Math.abs(s) / 2 / 10_000;
}

export const ringOf = (geometryId: string | null | undefined): LngLat[] | null => (geometryId ? GEOMETRIES[geometryId] ?? null : null);

export type ImpactStatus = "영향" | "예상" | "영향 없음" | "범위 안";
export interface ImpactObject { id: string; kind: string; label: string; status: ImpactStatus; at?: string; exposure?: string; /** 공간 교차가 덧붙이는 한마디 — "범위 안 약 320 m" */ detail?: string }

/** 두 점 사이 거리(m) — 위도 보정 평면 근사 */
const distM = (a: LngLat, b: LngLat) => {
  const lat = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  return Math.hypot((b[0] - a[0]) * 111_320 * Math.cos(lat), (b[1] - a[1]) * 110_540);
};
/** 선이 링 안에 든 길이(m) — 20 m 간격으로 잘라 안팎을 센다 */
export function lineInsideM(coords: LngLat[], ring: LngLat[]): number {
  let inside = 0;
  for (let i = 1; i < coords.length; i += 1) {
    const a = coords[i - 1], b = coords[i], len = distM(a, b);
    const n = Math.max(1, Math.ceil(len / 20));
    for (let k = 0; k < n; k += 1) {
      const t = (k + 0.5) / n;
      if (pointInRing([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], ring)) inside += len / n;
    }
  }
  return inside;
}

/**
 * 그 시각의 영향 객체 — 판의 대상 + 장면 층과 범위 링의 **공간 교차**. 수를 지어내지 않는다.
 *   판의 대상(`targets`)  도달 시각이 지났으면 `영향`, 아직이면 `예상`(시각), 도달이 없으면 `영향 없음`
 *   장면의 점             링 안이면 `범위 안`
 *   장면의 선(도로 구간)   링 안에 든 길이(m). 판의 대상과 이름이 같으면 그 줄에 "범위 안 약 N m" 로 붙고, 없으면 새 줄
 *   장면의 면             꼭짓점 하나라도 링 안이면 `범위 안`
 */
export function impactsAt(f: Forecast, atIso: string, layers: SceneLayer[]): ImpactObject[] {
  const out: ImpactObject[] = f.targets.map((t) => ({
    id: t.id, kind: t.kind, label: t.label,
    status: t.arrivalAt ? (ms(t.arrivalAt) <= ms(atIso) ? "영향" : "예상") : "영향 없음",
    at: t.arrivalAt, exposure: t.exposure,
  }));
  const ring = ringOf(floorMarkAt(f, atIso)?.extentGeometryId);
  if (ring) {
    const baseName = (s: string) => s.split(" · ")[0].replace(/\s*\d+\S*$/, "").trim();
    /* 이름은 포함 관계로 맞춘다 — 장면의 "해안도로"와 판의 "해안도로 저지대 구간"은 같은 도로다 */
    const findTarget = (label: string) => { const n = baseName(label); return out.find((o) => { const b = baseName(o.label); return b === n || b.includes(n) || n.includes(b); }); };
    /* 도로는 토막(`cw-coast-wet-0/1/2`)으로 갈라져 있고 라벨은 첫 토막에만 있다 — id 의 꼬리 번호를 떼어 한 묶음으로 잰다 */
    const groups = new Map<string, { label: string | null; m: number }>();
    for (const l of layers) {
      if (l.kind === "point") {
        if (!findTarget(l.label) && pointInRing(l.at, ring)) out.push({ id: l.id, kind: "지점", label: l.label, status: "범위 안" });
      } else if (l.kind === "line" && l.role === "도로") {
        const key = l.id.replace(/-\d+$/, "");
        const g = groups.get(key) ?? { label: null, m: 0 };
        g.m += lineInsideM(l.coords, ring);
        if (l.label) g.label ??= l.label;
        groups.set(key, g);
      } else if (l.kind === "area" && l.label) {
        if (!findTarget(l.label) && l.ring.some((p) => pointInRing(p, ring))) out.push({ id: l.id, kind: "구역", label: l.label, status: "범위 안" });
      }
    }
    for (const [key, g] of groups) {
      /* 50 m 미만은 적지 않는다 — 20 m 간격 표본이라 그 아래는 잡음이다 */
      if (!g.label || g.m < 50) continue;
      const name = baseName(g.label);
      const text = `범위 안 약 ${Math.round(g.m / 10) * 10} m`;
      const t = findTarget(name);
      /* 판이 이미 판정한 대상은 판이 이긴다 — 도달했을 때만 "얼마나"를 덧붙인다. 아직·없음인 줄에 기하 겹침을 붙이면
         "영향 없음 · 범위 안 450 m" 처럼 모순으로 읽힌다(둔치 범람면이 도로 선과 겹칠 뿐 도로 침수는 아니다) */
      if (t) { if (t.status === "영향") t.detail = t.detail ? `${t.detail} · ${text}` : text; }
      else out.push({ id: `line-${key}`, kind: "도로 구간", label: name, status: "범위 안", detail: text });
    }
  }
  /* 영향 중인 것이 먼저, 예상이 그다음, 없음은 아래 */
  const rank: Record<ImpactStatus, number> = { 영향: 0, "범위 안": 1, 예상: 2, "영향 없음": 3 };
  return out.sort((a, b) => rank[a.status] - rank[b.status] || (a.at ?? "").localeCompare(b.at ?? ""));
}

/**
 * 시뮬레이션이 읽는 상황 단계 — 관련 SOP 의 `minLevel` 과 맞춘다(demo/sop.ts).
 *   물이 없다 → 없음 · 물고임 시작 → advisory · 도로 도달 → warning · 건물·중요시설 도달 → evacuate
 * ★ 이것은 화면의 강조 규칙이지 발령이 아니다. 발령·전파는 담당자 승인 경계를 따른다.
 */
export function stageAt(f: Forecast, atIso: string): "none" | "advisory" | "warning" | "evacuate" {
  const reached = f.targets.filter((t) => t.arrivalAt && ms(t.arrivalAt) <= ms(atIso));
  if (reached.some((t) => t.kind === "건물" || t.kind === "중요시설")) return "evacuate";
  if (reached.some((t) => t.kind === "도로")) return "warning";
  if (depthAt(f, atIso) > 0 || reached.length > 0) return "advisory";
  return "none";
}
