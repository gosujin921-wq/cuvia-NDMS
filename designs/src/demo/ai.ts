/* ─────────────────────────────────────────────
 * AI 질의·답변 — 배경: docs/레거시/정본/04_데모_데이터.md §14
 *
 * 준비된 질의는 3종뿐이다. 즉석 질의를 받아 답을 만들지 않는다.
 * 문안은 SCR-01 질의 칩과 SCR-06 질의 칩이 이 파일 하나를 같이 본다 — 화면 두 곳이
 * 다른 문장을 보이면 "방금 뭘 물었나"가 어긋난다.
 *
 * 답변에 쓰는 값은 전부 04 문서의 다른 절에서 확정한 것이다. 이 화면을 위해 새로 만든
 * 수치는 없고, 근거마다 어느 절에서 왔는지를 `source` 에 적어 둔다. 앞 절 값을 고치면
 * 여기도 같이 고쳐야 한다.
 *
 * 지구별 집계(`district-risk`)만 상수가 아니라 이벤트 원장에서 계산한다 — 04 §4-3 이
 * 집계 상수를 두지 말라고 정한다. 상수와 원장이 갈라지면 같은 30일을 두 화면이 다르게 센다.
 * ───────────────────────────────────────────── */

import { EVENTS } from "./events";
import { findDistrict } from "./districts";
import { HERO_SCENARIO } from "./forecast";
import { levelSpec, type AlertLevel } from "./levels";

/* ── 질의 3종 (04 §14-1) ──────────────────────────────────────── */

/** 답변 카드 모양을 가르는 축 — 원인 · 이력 · 영향 */
export type QueryKind = "cause" | "risk" | "impact";

export interface CannedQuery {
  id: string;
  kind: QueryKind;
  /** 화면에 그대로 찍히는 질의 문안 */
  text: string;
  /** 답이 걸린 지구 (04 §14-5 — 데모 답변은 서항지구 것뿐이다) */
  districtId: string;
  /** 답변 카드에서 나가는 화면 */
  route: string;
  routeLabel: string;
  /** 못 알아들은 문장을 이 질의로 붙이는 말 (04 §14-5) */
  keywords: string[];
}

export const CANNED_QUERIES: CannedQuery[] = [
  {
    id: "seohang-cause",
    kind: "cause",
    text: "서항지구 수위가 왜 오르고 있어?",
    districtId: "seohang",
    route: "/scr-02/seohang",
    routeLabel: "서항지구 조기경보",
    keywords: ["왜", "원인", "이유", "예측", "만조", "해일"],
  },
  {
    id: "district-risk",
    kind: "risk",
    text: "최근 한 달 가장 위험했던 지구는?",
    districtId: "seohang",
    route: "/scr-04",
    routeLabel: "통계·분석",
    keywords: ["위험", "최근", "한 달", "한달", "통계", "이력", "되풀이"],
  },
  {
    id: "flood-impact",
    kind: "impact",
    text: "서항 수위가 예측대로 오르면 피해가 얼마야?",
    districtId: "seohang",
    route: "/scr-05/seohang",
    routeLabel: "서항지구 디지털트윈",
    keywords: ["침수", "피해", "잠기", "대피", "몇 동", "영향"],
  },
];

/** 메뉴로 직접 들어왔을 때 여는 질의 — 빈 화면으로 열지 않는다 (03 §6) */
export const DEFAULT_QUERY = CANNED_QUERIES[0];

/**
 * 딥링크 `?q=` 로 넘어온 질의 ID 를 해석한다 — `/scr-06?q=seohang-cause`.
 *
 * URL 에 질의 **문장**을 싣지 않는 이유는 문안이 바뀌면 링크가 조용히 죽기 때문이다.
 * ID 는 이 파일이 정본이라 문안을 고쳐도 링크가 따라온다.
 */
export function queryById(id: string | null): CannedQuery | null {
  if (!id) return null;
  return CANNED_QUERIES.find((query) => query.id === id) ?? null;
}

/**
 * 직접 친 문장을 질의 3종 중 하나로 붙인다 (04 §14-5).
 *
 * 문안이 그대로면 그 질의, 아니면 키워드로 찾는다. 어디에도 안 붙으면 null —
 * 못 알아들은 질문에 그럴듯한 답을 지어내지 않는다.
 */
export function matchQuery(text: string): CannedQuery | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const exact = CANNED_QUERIES.find((query) => query.text === trimmed);
  if (exact) return exact;

  return (
    CANNED_QUERIES.find((query) => query.keywords.some((word) => trimmed.includes(word))) ?? null
  );
}

/* ── 답변 근거 ───────────────────────────────────────────────── */

export interface Evidence {
  label: string;
  /** 값. 화면에서 오른쪽에 붙는다 */
  value: string;
  /** 화면에 서는 출처 — 데이터 원천의 이름(사용자 언어)이다(04 §14 · 차수 K).
   *  절 번호가 화면에 그대로 서면 제품이 아니라 문서 목업으로 읽힌다 */
  source: string;
  /** 참조 절 — 유지·대조용. 화면에 표기하지 않는다 */
  ref: string;
}

/* ── `seohang-cause` — 조건 시나리오 도달 예상(4.24)의 세 항 분해 (04 §14-2)
 * "예측"으로 부르지 않는다 — 담당자 질의 문안(예측대로)은 그대로 두되, 시스템의
 * 답변은 만조 조건 시나리오라는 말만 쓴다(04 §10 · §14). ──────────────── */

/* 시나리오 세 항은 `forecast.ts` HERO_SCENARIO 가 정본이다 — 판정 카드(SCR-03)와
   AI 근거가 같은 값을 두 곳에 따로 들면 04 §10-3 을 고칠 때 한쪽이 낡는다.
   여기서는 값(2.71 / +1.15 / +0.38)을 끌어오고, 표기 맥락만 §14-2 대로 붙인다 */
const [TIDE_TERM, SURGE_TERM, RAIN_TERM] = HERO_SCENARIO.terms;

export const CAUSE_ANSWER = {
  headline: `만조 조건 시나리오 ${HERO_SCENARIO.peak} EL.m 도달 예상 · 19:10`,
  detail: "대피 기준 4.2 EL.m 를 넘는다. 계측 단계는 아직 경보지만 대응 등급은 대피다.",
  /** 조건 시나리오 도달 예상 수위 (EL.m) */
  scenario: HERO_SCENARIO.peak,
  scenarioAt: "19:10",
  /** 판정 시점의 계측값 */
  current: 3.41,
  currentAt: "17:22",
  currentLevel: "warning" as AlertLevel,
  evidence: [
    {
      label: TIDE_TERM.label,
      value: `${TIDE_TERM.value} · 19:10 대조기`,
      source: "천문조 정보",
      ref: "04 §10-3",
    },
    {
      label: SURGE_TERM.label,
      value: `${SURGE_TERM.value} · 폭풍해일주의보 발효 중`,
      source: "기상특보",
      ref: "04 §10-3 · §5",
    },
    {
      label: RAIN_TERM.label,
      value: `${RAIN_TERM.value} · 시간당 18 mm 지속`,
      source: "강우 관측",
      ref: "04 §10-3",
    },
    { label: "현재 계측", value: "3.41 EL.m · 17:22 · 경보", source: "서항 수위계", ref: "04 §4-2" },
  ] satisfies Evidence[],
  limit: "실측은 4.31 EL.m · 19:22 였다. 시나리오보다 7cm 높고 12분 늦었다.",
} as const;

/* ── `district-risk` — 30일 원장 집계 (04 §14-3) ──────────────── */

export interface DistrictRisk {
  districtId: string;
  name: string;
  /** 최근 30일 발생 건수 */
  total: number;
  /** 그중 경보 이상 */
  severe: number;
  /** 발생 순서대로의 단계 이력 (오래된 것부터) */
  history: { date: string; level: AlertLevel }[];
}

const SEVERE_LEVELS: AlertLevel[] = ["warning", "evacuate"];

/** `MM-DD` — 원장 시각에서 날짜만 뽑는다 */
function monthDay(iso: string): string {
  return iso.slice(5, 10).replace("-", "/");
}

/**
 * 최근 30일 원장에서 지구별 건수를 센다. 04 §4-3 의 규칙대로 **집계 상수를 두지 않는다.**
 * 건수가 같으면 경보 이상이 많은 쪽, 그것도 같으면 최근 발생이 늦은 쪽이 앞에 온다.
 */
export function districtRanking(): DistrictRisk[] {
  const byDistrict = new Map<string, DistrictRisk>();

  for (const event of [...EVENTS].reverse()) {
    const district = findDistrict(event.districtId);
    if (!district) continue;

    const entry = byDistrict.get(event.districtId) ?? {
      districtId: event.districtId,
      name: district.name,
      total: 0,
      severe: 0,
      history: [],
    };
    entry.total += 1;
    if (SEVERE_LEVELS.includes(event.level)) entry.severe += 1;
    entry.history.push({ date: monthDay(event.raisedAt), level: event.level });
    byDistrict.set(event.districtId, entry);
  }

  return [...byDistrict.values()].sort((a, b) => b.total - a.total || b.severe - a.severe);
}

export const RISK_ANSWER = {
  headlineOf: (top: DistrictRisk) =>
    `${top.name} — 최근 30일 ${top.total}건 중 경보 이상 ${top.severe}건`,
  detail:
    "되풀이가 이 지구를 위험하게 만든다. 한 번 크게 난 곳이 아니라, 같은 자리에서 계속 나는 곳이다.",
  limit: "최근 30일(2026-07-14~08-12) 원장 18건 기준. 그 이전 이력은 데모에 없다.",
} as const;

/** `district-risk` 근거 (04 §14-3) — 값은 랭킹(원장 계산)에서, 출처 라벨은 여기서.
 *  화면 컴포넌트에 절 번호를 하드코딩하지 않는다(차수 K) */
export function riskEvidence(ranking: DistrictRisk[]): Evidence[] {
  const top = ranking[0];
  const runnerUp = ranking[1];
  const district = findDistrict(top.districtId);
  return [
    {
      label: "되풀이 이력",
      value: top.history.map((row) => `${row.date} ${levelSpec(row.level).label}`).join(" → "),
      source: "이벤트 이력",
      ref: "04 §4-1",
    },
    {
      label: "2위와의 차",
      value: `${runnerUp.name} ${runnerUp.total}건 (경보 이상 ${runnerUp.severe}건)`,
      source: "이벤트 이력",
      ref: "04 §4-1",
    },
    {
      label: "지구 유형",
      value: district ? `${district.kind} · ${district.target}` : "—",
      source: "위험지구 정보",
      ref: "04 §1",
    },
  ];
}

/* ── `flood-impact` — 침수 영향 비교 (04 §14-4) ───────────────── */

export interface FloodImpactRow {
  level: number;
  caption: string;
  area: string;
  buildings: number;
  road: string;
  evacuees: number | null;
  /** 답변에서 강조하는 행 — 05 §3 S4 가 소리 내어 말하는 두 행 */
  emphasis?: boolean;
}

export const IMPACT_ANSWER = {
  headline: "지금 6동, 만조 조건이면 47동",
  detail: "대피 대상 412명. 물이 4.2 EL.m 를 넘으면 서항지구 전체가 전파 대상이 된다.",
  rows: [
    {
      level: 3.41,
      caption: "지금 · 17:22 실측",
      area: "0.4 ha",
      buildings: 6,
      road: "해안도로 120 m",
      evacuees: null,
      emphasis: true,
    },
    {
      level: 4.2,
      caption: "대피 기준",
      area: "2.9 ha",
      buildings: 44,
      road: "해안도로 620 m",
      evacuees: 412,
    },
    {
      level: 4.24,
      caption: "19:10 조건 시나리오",
      area: "3.1 ha",
      buildings: 47,
      road: "해안도로 640 m · 물양장 진입로 전 구간",
      evacuees: 412,
      emphasis: true,
    },
  ] satisfies FloodImpactRow[],
  limit: "침수 영향은 시연용 고정값이다. 실제 산정은 DEM·건물 데이터를 겨뤄야 한다.",
} as const;
