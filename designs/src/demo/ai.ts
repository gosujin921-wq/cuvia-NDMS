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
import { devicesOf } from "./devices";
import { HERO_SCENARIO } from "./forecast";
import { levelSpec, type AlertLevel } from "./levels";
import { domeSummaryAt } from "./heat-dome";
import { holdOutlook, seaDateOf, seaTempAt, type SeaTempReading } from "./sea-temp";
import { sensorSeries } from "./measurements";
import { formatClock } from "../lib/datetime";
import type { AgentAction, AgentChartData, AgentMessage, AgentTableData } from "../agent";

/* ── 질의 3종 (04 §14-1) ──────────────────────────────────────── */

/** 답변 카드 모양을 가르는 축 — 원인 · 이력 · 영향 */
export type QueryKind = "cause" | "risk" | "impact" | "dome";

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
  /**
   * 답이 뜨면서 **뒤 화면이 이 자리로 바뀐다** — 배경 전환.
   *
   * 바로가기(`actions`)와 다르다. 바로가기는 패널을 닫으며 보내고, 배경 전환은 패널을
   * 연 채 뒤만 갈아 끼운다. 물음과 답과 그림이 한 화면에 같이 서야 "왜 뜨거운가" 의
   * 답이 말과 그림 양쪽으로 온다.
   */
  backdrop?: string;
  /**
   * AI 패널에서만 답하는 질의.
   *
   * 옛 SCR-06 화면은 답변 한 벌을 손으로 짜 두어(원인·이력·영향 세 짜임), 새 질의가
   * 끼면 본문이 빈 채로 열린다. 패널은 답변을 데이터로 받으므로 그런 자리가 없다.
   * 화면이 정리되면 이 플래그도 같이 없앤다.
   */
  panelOnly?: boolean;
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
  {
    /* 통계 `열돔` 유형에서 열돔 곡선을 보고 묻는 자리. 지구가 없는 재난이라
       districtId 를 서항으로 두되 답변은 지구를 말하지 않는다 */
    id: "heat-dome-cause",
    kind: "dome",
    text: "수온이 왜 이렇게 높아?",
    districtId: "seohang",
    route: "/scr-04",
    routeLabel: "통계·분석",
    keywords: ["수온", "폭염", "열돔", "더워", "더운", "뜨거", "기온"],
    /* 답이 흐르는 동안 왼쪽이 디지털트윈 열돔으로 바뀐다 */
    backdrop: "/scr-05?hazard=열돔",
    panelOnly: true,
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
  /* 건수를 문장에 박지 않는다 — 원장에 사건을 더하면(폭염 12건처럼) 이 줄만 낡는다.
     세는 것은 화면이 하고 여기는 자리만 만든다 (04 §4-3 · CLAUDE.md) */
  limitOf: (total: number) =>
    `최근 30일(2026-07-14~08-12) 원장 ${total}건 기준. 그 이전 이력은 데모에 없다.`,
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

/* ── 패널이 읽는 모양으로 담기 (04 §14-6) ─────────────────────
 *
 * 위 값들을 AI 패널의 답변 한 건(`AgentMessage`)으로 옮긴다. 본문 · 표 · 차트 ·
 * 고지 · 바로가기 다섯 조각이고, **여기서 새로 만드는 수치는 없다** — 앞의 상수와
 * 원장에서 끌어다 배치할 뿐이다.
 *
 * 방향은 한쪽이다. 이 파일은 `agent/` 를 알지만 `agent/` 는 이 파일을 모른다 —
 * 패널 폴더는 통째로 복사해 다른 앱에 옮길 수 있어야 한다(agent/index.ts).
 *
 * 근거 표에는 `source`(사용자 언어)를 싣고 `ref`(절 번호)는 안 싣는다 — 절 번호가
 * 화면에 서면 제품이 아니라 문서 목업으로 읽힌다.
 * ───────────────────────────────────────────── */

/** 근거가 있는 화면으로 보내는 버튼 — 제품의 `ui_control` 규격 그대로 */
function gotoAction(query: CannedQuery): AgentAction {
  return {
    label: query.routeLabel,
    action: "ui_control",
    payload: { effect: "navigate", target: query.route },
  };
}

/** 남은 질의 둘을 "이어서 물어볼 것" 으로 — 같은 사건을 다른 각도에서 묻는다 */
function followUpActions(active: CannedQuery): AgentAction[] {
  return CANNED_QUERIES.filter((query) => query.id !== active.id).map((query) => ({
    label: query.text,
    action: "send_query",
    query: query.text,
  }));
}

/** 근거 표 — 어느 답변이든 같은 세 열이다 */
function evidenceTable(title: string, rows: Evidence[]): AgentTableData {
  return {
    title,
    columns: ["항목", "값", "출처"],
    data: rows.map((row) => [row.label, row.value, row.source]),
  };
}

/**
 * 서항지구 수위 시계열 — **시연 시계까지만** 그린다.
 *
 * 꺾은선이 시계를 따라 자라는 것이 이 답변의 성격이다. 17:16 에 열면 짧고 22:12 에
 * 열면 길다. 뒤를 미리 그리면 아직 안 일어난 일을 답이 아는 꼴이 된다.
 */
function waterLevelChart(now: Date): AgentChartData | null {
  const gauge = devicesOf("seohang").find((device) => device.kind === "WL");
  if (!gauge) return null;

  const samples = sensorSeries(gauge, now, { hours: 6, stepMin: 30 });
  if (!samples.length) return null;

  return {
    type: "line",
    title: "서항지구 수위 추이 (EL.m)",
    labels: samples.map((sample) => formatClock(sample.at)),
    datasets: [{ label: "수위", data: samples.map((sample) => sample.value) }],
  };
}

function causeMessage(id: string, now: Date): AgentMessage {
  const query = queryById("seohang-cause")!;
  const chart = waterLevelChart(now);
  return {
    id,
    role: "assistant",
    content: `${CAUSE_ANSWER.headline}\n${CAUSE_ANSWER.detail}`,
    tableData: evidenceTable("도달 예상 수위의 근거", [...CAUSE_ANSWER.evidence]),
    chartData: chart ? [chart] : null,
    disclaimer: CAUSE_ANSWER.limit,
    actions: [gotoAction(query), ...followUpActions(query)],
  };
}

function riskMessage(id: string): AgentMessage {
  /* 집계는 원장에서 계산한다. 상수를 두지 않는다 (04 §4-3) */
  const ranking = districtRanking();
  const top5 = ranking.slice(0, 5);
  const query = queryById("district-risk")!;

  return {
    id,
    role: "assistant",
    content: `${RISK_ANSWER.headlineOf(ranking[0])}\n${RISK_ANSWER.detail}`,
    tableData: evidenceTable("근거", riskEvidence(ranking)),
    chartData: [
      {
        type: "bar",
        title: "지구별 발생 건수 (최근 30일)",
        labels: top5.map((row) => row.name),
        datasets: [{ label: "발생", data: top5.map((row) => row.total) }],
      },
    ],
    disclaimer: RISK_ANSWER.limitOf(ranking.reduce((sum, row) => sum + row.total, 0)),
    actions: [gotoAction(query), ...followUpActions(query)],
  };
}

function impactMessage(id: string): AgentMessage {
  const query = queryById("flood-impact")!;
  return {
    id,
    role: "assistant",
    content: `${IMPACT_ANSWER.headline}\n${IMPACT_ANSWER.detail}`,
    tableData: {
      title: "수위별 침수 영향",
      columns: ["수위", "면적", "건물", "도로", "대피 대상"],
      data: IMPACT_ANSWER.rows.map((row) => [
        `${row.level.toFixed(2)} EL.m`,
        row.area,
        `${row.buildings}동`,
        row.road,
        row.evacuees === null ? "—" : `${row.evacuees}명`,
      ]),
    },
    chartData: [
      {
        type: "bar",
        title: "수위별 영향 건물 (동)",
        labels: IMPACT_ANSWER.rows.map((row) => `${row.level.toFixed(2)} EL.m`),
        datasets: [{ label: "영향 건물", data: IMPACT_ANSWER.rows.map((row) => row.buildings) }],
      },
    ],
    disclaimer: IMPACT_ANSWER.limit,
    actions: [gotoAction(query), ...followUpActions(query)],
  };
}

/**
 * 고수온 — 수온이 왜 이렇게 높은가.
 * 정본 후보: docs/작업/열돔-고수온-AI답변.md
 *
 * 답이 네 덩이여야 한다. **이유만 답하면 담당자가 화면을 닫는다** — 대처까지 답해야
 * 다음 화면으로 이어진다.
 *
 *   ① 이유        열돔이다
 *   ② 현 상황     28℃ 위에 며칠이었나
 *   ③ 조건이 유지되면  하한을 말한다 (이어지는 구간이 있을 때만 선다)
 *   ④ 대처방법     지금 승인할 것
 *
 * ★ 낯선 말을 쓰지 않는다 (문서 §9).
 *   패널을 읽는 사람은 **사무실의 담당자**지 수산·기상 전문가가 아니다.
 *     어가 → 양식장 · 냉수대 → 찬 물덩어리 · 차광막 → 햇빛 가림막 · 사료 → 먹이
 *     지위고도·gpm → "공기 기둥이 두꺼울수록" · m
 *   `예비특보 · 주의보 · 경보` 는 법정 용어라 그대로 쓴다 — 바꾸면 오히려 흐려진다.
 *
 * ★ 값을 지어내지 않는다. 전부 곡선(sea-temperature.json)에서 센다.
 */
function seaTempCauseMessage(id: string, now: Date): AgentMessage {
  const query = queryById("heat-dome-cause")!;
  const sea = seaTempAt(seaDateOf(now));
  const dome = domeSummaryAt(now);

  if (!sea) {
    return {
      id,
      role: "assistant",
      content:
        "수온 자료를 아직 못 읽었습니다.\npublic/weather/sea-temperature.json 이 없으면 node scripts/fetch-sea-temperature.mjs 로 먼저 구워야 합니다.",
    };
  }

  const outlook = holdOutlook(sea);
  const watch = sea.threshold.watch;
  const day = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;

  /* ① 이유 — 뚜껑. 숫자보다 그림이 먼저다 */
  const why = [
    "① 이유 — 열돔입니다",
    "바다 위에 뜨거운 공기 뚜껑이 덮여 있습니다. 뚜껑이 있으면 낮에 받은 열이 위로 못 빠집니다. 육지는 밤마다 식지만 바다는 못 식습니다.",
    dome.peak
      ? `공기 기둥이 두꺼울수록 뚜껑이 깊습니다. 창원 상공은 5.5km 와 12km 두 층이 모두 세력권 선 안쪽이었고, 그런 날이 ${dome.deepDays}일이었습니다.`
      : "창원 상공이 그 뚜껑 아래에 들어 있습니다.",
  ];

  /* ② 현 상황 — 곡선이 센 값 그대로 */
  const gap = coolGap(sea);
  const now2 = [
    `② 현 상황 — ${watch}℃ 위에 ${sea.hotDays}일입니다`,
    `${day(sea.stageDates.advisory)}에 ${sea.threshold.advisory}℃, ${day(sea.stageDates.watch)}에 ${watch}℃를 넘었고, 그 뒤로 여름 들어 ${sea.hotDays}일을 ${watch}℃ 위에서 보냈습니다. 가장 높았던 날은 ${day(sea.peakDate)} ${sea.peak}℃입니다.`,
    sea.ongoing
      ? `오늘 ${sea.current}℃로 ${sea.ongoing.days}일 연속입니다. ${sea.threshold.warningDays}일 연속이면 경보라 기준을 채웠습니다.`
      : gap
        ? `찬 물덩어리가 들어와 ${gap.days}일째 ${watch}℃ 아래입니다. 오늘은 ${sea.current}℃입니다 — 다만 앞선 구간이 ${gap.days}일 만에 돌아온 적이 있습니다.`
        : `오늘은 ${sea.current}℃로 ${watch}℃ 아래입니다.`,
  ];

  /* ③ 조건이 유지되면 — 하한을 말한다. 예측이 아니라 조건이다 */
  const ahead = outlook
    ? [
        `③ 조건이 유지되면 — 최소 ${day(outlook.floorDate)}까지입니다`,
        `적어도 ${outlook.floorDays}일 더 갑니다. ${day(outlook.floorDate)}까지는 대비를 풀 수 없습니다.`,
        `짧게 가면 ${outlook.floorDays}일, 길게 가면 ${outlook.ceilDays}일이 남습니다. ${day(outlook.floorDate)}은 짧은 쪽입니다 — 그보다 일찍 끝날 근거가 지금 없습니다.`,
        "끝나는 시점은 열돔이 정합니다. 뚜껑이 물러나면 바다도 식기 시작하고, 그전에는 안 내려옵니다.",
      ]
    : [
        "③ 조건이 유지되면",
        "지금은 이어지는 구간이 없어 남은 날을 셀 수 없습니다. 다시 넘어서면 그때부터 셉니다.",
        "끝나는 시점은 열돔이 정합니다. 뚜껑이 물러나면 바다도 식기 시작하고, 그전에는 안 내려옵니다.",
      ];

  /*
   * ④ 대처 — **이 화면 앞에 앉은 사람이 할 수 있는 일**을 적는다.
   *
   * 한때 산소공급기 가동 · 햇빛 가림막 · 먹이 중단 · 조기 출하를 적었다. 그것은 양식장이
   * 하는 일이지 관제 담당자가 하는 일이 아니다. 담당자는 물고기 옆에 있지 않다 — 공문을
   * 내고, 기관에 협조를 구하고, 주민에게 알리는 자리에 있다. 화면이 못 하는 일을 적으면
   * 읽고 나서 아무것도 못 누른다.
   *
   * 되돌릴 수 없는 것을 끝에 둔다 — 재난문자는 한 번 나가면 거둘 수 없다.
   */
  const act = [
    "④ 대처방법 — 지금 승인할 것이 넷입니다",
    "관내 양식장에 고수온 대응 요령 공문 발송, 관계기관 협조 요청(국립수산과학원 · 경상남도 해양수산과 · 수협), 해안 마을방송 · 전광판 송출, 그리고 취약지역 어업인에게 안내 재난문자 발송입니다.",
    "마지막 하나는 한 번 나가면 거둘 수 없어 승인 없이 나가지 않습니다.",
    "특보 기록 · 담당 부서 알림 · 경상남도 재난안전상황실 보고 셋은 이미 자동으로 처리됐습니다.",
  ];

  return {
    id,
    role: "assistant",
    content: [...why, "", ...now2, "", ...ahead, "", ...act].join("\n"),
    tableData: {
      title: "근거",
      columns: ["항목", "관측", "그래서"],
      data: seaEvidenceRows(sea, dome, outlook),
    },
    chartData: [seaTempChart(sea)],
    disclaimer: [
      outlook
        ? `${day(outlook.floorDate)}은 앞선 구간이 얼마나 갔는지에서 나온 값입니다. 열돔이 물러나면 그날 달라집니다.`
        : null,
      "수온 자료의 격자가 약 5km 라 진해만·마산만을 따로 가르지 못합니다 — 창원 앞바다를 하나로 봅니다.",
    ]
      .filter(Boolean)
      .join("\n"),
    actions: [gotoAction(query), ...followUpActions(query)],
  };
}

/**
 * 근거 표 — 세 줄이 전부 관측이다. 모형도 확률도 없다.
 *
 * **셈을 읽는 사람에게 시키지 않는다** — `평균 7.5일` 만 적고 "그래서 며칠 남는지" 를
 * 안 적으면 표가 근거 노릇을 못 한다.
 *
 * 셋의 격이 다르다는 것도 숨기지 않는다. 첫 줄과 셋째 줄은 이미 일어난 일이고, 둘째 줄은
 * **지금 상태가 유지된다**는 가정이다.
 */
function seaEvidenceRows(
  sea: SeaTempReading,
  dome: ReturnType<typeof domeSummaryAt>,
  outlook: ReturnType<typeof holdOutlook>,
): string[][] {
  const watch = sea.threshold.watch;
  const finished = sea.runs.filter((run) => !run.ongoing);
  const short = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
  const rows: string[][] = [];

  if (finished.length && sea.meanRunDays !== null) {
    rows.push([
      `올여름 ${watch}℃ 구간`,
      finished.map((run) => `${short(run.from)} ${run.days}일`).join(" · "),
      outlook
        ? `평균 ${sea.meanRunDays.toFixed(1)}일 → ${outlook.floorDays}일 남는다`
        : `평균 ${sea.meanRunDays.toFixed(1)}일`,
    ]);
  }

  rows.push([
    "열돔이 안 물러남",
    dome.peak ? `두 층 모두 선 안쪽 ${dome.deepDays}일` : "두 층 모두 선 안쪽",
    "식을 조건이 아직 안 왔다",
  ]);

  const gap = coolGap(sea);
  if (gap) {
    rows.push([
      "내려갔다 돌아온 속도",
      `${short(gap.from)}~${short(gap.to)} ${gap.days}일 ${watch}℃ 아래`,
      `한 번 내려가도 ${gap.days}일이면 돌아온다`,
    ]);
  }

  return rows;
}

/** 마지막 구간 뒤의 "식었던 틈" — 여기서 안심한 곳이 생긴다 */
function coolGap(sea: SeaTempReading) {
  const last = sea.runs[sea.runs.length - 1];
  if (!last || last.ongoing) return null;
  const from = sea.points.findIndex((point) => point.date === last.to) + 1;
  if (from <= 0 || from > sea.points.length - 1) return null;
  const to = sea.points.length - 1;
  return { from: sea.points[from].date, to: sea.points[to].date, days: to - from + 1 };
}

/**
 * 수온 곡선 — 문서 §4 대로 `line` 한 계열.
 *
 * 조건 구간(점선)은 계열을 나누지 않는다. 패널 차트 부품은 빠진 칸을 0 으로 떨어뜨려
 * 선이 바닥까지 곤두박질친다(문서 §10 의 판단과 같다). 조건 구간은 본문과 표가 말한다.
 */
function seaTempChart(sea: SeaTempReading): AgentChartData {
  const short = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
  return {
    type: "line",
    title: `창원 앞바다 표층수온 · ${short(sea.points[0].date)}~${short(sea.today)}`,
    labels: sea.points.map((point) => short(point.date)),
    datasets: [{ label: "표층수온 (℃)", data: sea.points.map((point) => point.value) }],
  };
}

/**
 * 질의 하나의 답변 메시지.
 *
 * 시계(`now`)를 받는 이유는 꺾은선이 **시연 시계를 따라 자라기** 때문이다 (04 §14-6).
 */
export function answerMessage(query: CannedQuery, id: string, now: Date): AgentMessage {
  if (query.kind === "cause") return causeMessage(id, now);
  if (query.kind === "risk") return riskMessage(id);
  if (query.kind === "dome") return seaTempCauseMessage(id, now);
  return impactMessage(id);
}

/**
 * 못 알아들은 문장의 답 (04 §14-5).
 *
 * **답을 지어내지 않는다.** 물은 문장을 그대로 보이고 질의 3종을 내놓는다.
 */
export function unknownMessage(asked: string, id: string): AgentMessage {
  return {
    id,
    role: "assistant",
    content: `“${asked}” — 이 질문에는 답할 수 없습니다.\n데모가 답하는 질의는 아래 3종뿐입니다. 없는 답을 지어내지 않습니다.`,
    actions: CANNED_QUERIES.map((query) => ({
      label: query.text,
      action: "send_query" as const,
      query: query.text,
    })),
  };
}
