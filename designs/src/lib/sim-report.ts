/* ─────────────────────────────────────────────
 * 시뮬레이션 보고서 — /scr-00 에서 본 것을 문서 한 장으로 (2026-09-17)
 *
 * 화면은 조건을 바꾸고 결과를 견주는 자리다. 그 자리를 떠나면 아무것도 안 남는다 —
 * "무슨 조건에서 무엇이 달라졌나"를 들고 나갈 물건이 보고서다(2026-09-17 사용자 "보고서를 만들어주는 게 좋지 않겠어").
 *
 * 절 순서는 화면을 읽는 순서와 같다.
 *   1 대상과 조건 · 2 결과 비교 · 3 시간 전개 · 4 지도 · 5 영향 객체 · 6 해당 규정 · 7 근거
 * ★ 사건 보고서(demo/report.ts)와 같은 `Report` 모양이다 — 문서 렌더러 한 벌이 셋을 다 찍는다.
 * ★ 여기서 숫자를 만들지 않는다. 화면이 이미 계산한 값을 절로 옮길 뿐이다.
 * ───────────────────────────────────────────── */

import type { Report, ReportSection } from "../demo/report";
import type { ReportDocumentProps } from "../components/ReportDocument";
import type { ReportChart, ReportStat, ChartPoint } from "../model/report-chart";
import type { ImpactObject, ScenarioSummary, SimAction, SimScenario, SimSop } from "../model/sim/flood";
import { formatClock, formatStamp as stamp } from "./datetime";

/** 화면이 넘기는 한 벌 — 전부 우측 패널이 이미 들고 있는 값이다 */
export interface SimReportInput {
  siteLabel: string;
  dateLabel: string;
  /** 시뮬레이션의 시작·끝 · 지금 보고 있는 시각 */
  origin: string;
  end: string;
  at: string;
  base: SimScenario;
  selected: SimScenario;
  /** 고른 시나리오(조건만) — "기준 · 그날 그대로" · "A · 강우 +20%". 규정은 따로 적는다 */
  scenarioLabel: string;
  summaries: Record<string, ScenarioSummary | null>;
  /** 노출 규정의 결과 — 도달 전 여유 */
  leadRows: { label: string; base: { text: string }; sel: { text: string } }[];
  observed: { label: string; value: string }[];
  impacts: ImpactObject[];
  marks: { areaHa: number; floodedAt: string | null } | null;
  sop: SimSop[];
  /** 켜진 규정 id → 사람이 읽는 시각 표기("20:29 · 1시간 전") */
  sopOn: Record<string, string>;
  actions: SimAction[];
  /** 시간별 도로 수심(m) 두 계열 — 기준과 고른 시나리오 */
  depthSeries: { base: ChartPoint[]; selected: ChartPoint[] };
  /** 저장 시점의 지도 한 장 */
  mapImage?: string;
  /** 근거 절에 그대로 옮길 줄 */
  basisRows: { label: string; value: string }[];
  basisLines: string[];
}

/**
 * 저장된 시뮬레이션 보고서 — 이력의 보고서 목록에 사건 보고서와 나란히 선다(2026-09-17 사용자 "보고서를 사건 · 시뮬레이션으로 나누면").
 * 저장 시점의 화면 값(`input`)을 통째로 든다 — 판을 고쳐도 과거 보고서가 소급해서 바뀌지 않는다
 */
export interface SimReportRecord {
  reportId: string;
  savedAt: string;
  title: string;
  input: SimReportInput;
}

const dash = "-";


/** 시뮬레이션 보고서 문서 한 벌 — 머리 항목표 · 바닥 문구 · 유의사항까지 */
export function simDocOf(input: SimReportInput, docNo: string): ReportDocumentProps {
  const report = simReportOf(input);
  return {
    report,
    meta: [
      { label: "구분", value: "모의훈련 보고서" },
      { label: "번호", value: docNo },
      { label: "생성일시", value: stamp(report.issuedAt) },
    ],
    footLabel: `CUVIA 모의훈련 보고서 · ${docNo}`,
    /* 읽는 사람에게 필요한 것 하나 — 바꾼 조건의 결과는 일어난 일이 아니라 전망이다 */
    notice: ["바꾼 조건과 규정 적용의 결과는 실제로 일어난 일이 아니라 같은 방식으로 계산한 예측입니다."],
  };
}

export function simReportOf(x: SimReportInput): Report {
  const same = x.base.id === x.selected.id;
  const bs = x.summaries[x.base.id] ?? null;
  const ss = x.summaries[x.selected.id] ?? null;
  const onIds = Object.keys(x.sopOn);
  const appliedText = onIds.length === 0
    ? "없음 · 그날 그대로"
    : onIds.map((id) => `${x.sop.find((s) => s.id === id)?.label ?? id} ${x.sopOn[id]}`).join(" · ");

  /* 요약 타일 — 고른 시나리오의 값, 아래 한마디로 기준 대비 */
  const cmp = (sel: number | null | undefined, base: number | null | undefined, unit: string, digits: number) => {
    if (sel == null || base == null || same) return undefined;
    const d = sel - base;
    if (Math.abs(d) < 10 ** -digits / 2) return "기준과 같음";
    return `기준 ${base.toFixed(digits)} ${unit} 대비 ${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(digits)}`;
  };
  const stats: ReportStat[] = ss
    ? [
        { label: "도로 잠김", value: ss.startAt ? formatClock(ss.startAt) : "없음", note: same ? undefined : bs?.startAt ? `기준 ${formatClock(bs.startAt)}` : "기준 없음" },
        { label: "최대 수심", value: ss.maxDepthM.toFixed(2), unit: "m", note: cmp(ss.maxDepthM, bs?.maxDepthM, "m", 2) },
        { label: "침수 면적", value: ss.maxAreaHa.toFixed(1), unit: "ha", note: cmp(ss.maxAreaHa, bs?.maxAreaHa, "ha", 1) },
        { label: "영향 시설", value: String(ss.hitTargets), unit: "곳", note: cmp(ss.hitTargets, bs?.hitTargets, "곳", 0) },
      ]
    : [];

  /* 결과 비교 — 두 열. 같은 시나리오면 한 열 */
  /* 기준 열의 태그가 이미 "기준"이면 괄호를 붙이지 않는다("기준 (기준)") */
  const baseHead = x.base.tag === "기준" ? "기준" : `${x.base.tag} (기준)`;
  const head = same ? ["항목", x.base.tag] : ["항목", baseHead, x.selected.tag];
  const row2 = (label: string, a: string, b: string) => (same ? [label, a] : [label, a, b]);
  const compareRows: string[][] = [
    row2("도로 잠김", bs?.startAt ? formatClock(bs.startAt) : "없음", ss?.startAt ? formatClock(ss.startAt) : "없음"),
    row2(bs ? (bs.metricLabel.startsWith("최대") ? bs.metricLabel : `최대 ${bs.metricLabel}`) : "최대 수심", bs ? `${bs.maxDepthM.toFixed(2)} m` : dash, ss ? `${ss.maxDepthM.toFixed(2)} m` : dash),
    row2("침수 면적", bs ? `${bs.maxAreaHa.toFixed(1)} ha` : dash, ss ? `${ss.maxAreaHa.toFixed(1)} ha` : dash),
    row2("영향 시설", bs ? `${bs.hitTargets}곳` : dash, ss ? `${ss.hitTargets}곳` : dash),
    ...x.leadRows.map((r) => row2(r.label, r.base.text, r.sel.text)),
  ];

  /* 두 계열 한 축 — 같은 단위(m)라 이중축이 아니다 */
  const depthChart: ReportChart = {
    kind: "compare", unit: "m", digits: 2,
    series: [
      { label: `${x.base.tag} 도로 수심`, points: x.depthSeries.base, tone: "series-1" },
      ...(same ? [] : [{ label: `${x.selected.tag} 도로 수심`, points: x.depthSeries.selected, tone: "series-2" as const }]),
    ],
  };
  const milestones: ReportChart = {
    kind: "milestones",
    items: [
      ...x.actions.map((a) => ({ label: a.label, at: a.at })),
      ...x.impacts.filter((i) => i.at).map((i) => ({ label: `${i.label} 도달`, at: i.at as string })),
    ].sort((a, b) => a.at.localeCompare(b.at)),
  };

  const sections: ReportSection[] = [
    {
      id: "target", title: "대상과 조건",
      rows: [
        { label: "대상", value: x.siteLabel },
        { label: "기준", value: x.dateLabel },
        { label: "시나리오", value: x.scenarioLabel },
        { label: "적용한 규정", value: appliedText },
        { label: "보는 시각", value: `${formatClock(x.at)} · 계산 범위 ${formatClock(x.origin)}~${formatClock(x.end)}` },
      ],
    },
    {
      id: "compare", title: "결과 비교",
      note: same ? "기준 시나리오" : `${x.base.tag} 대비`,
      charts: [depthChart],
      rows: [],
      table: { head, rows: compareRows, widths: same ? [undefined, "180px"] : [undefined, "150px", "150px"] },
      footnote: x.observed.length > 0 ? x.observed.map((o) => `실측 ${o.label} ${o.value}`).join(" · ") : undefined,
    },
    ...(milestones.kind === "milestones" && milestones.items.length > 0
      ? [{ id: "flow", title: "시간 전개", note: "조치와 도달 시각", rows: [], charts: [milestones] } as ReportSection]
      : []),
    ...(x.mapImage
      ? [{ id: "map", title: "지도 결과", rows: [], figure: { src: x.mapImage, alt: `${x.siteLabel} 모의훈련 지도`, caption: `${x.selected.tag} · ${formatClock(x.at)} 화면` } } as ReportSection]
      : []),
    {
      id: "impact", title: "영향 객체",
      rows: [],
      table: {
        head: ["구분", "대상", "상태"],
        rows: [
          ...(x.marks ? [["과거 지점", `과거 침수 지점 · ${x.marks.areaHa.toFixed(1)} ha`, x.marks.floodedAt ? `${formatClock(x.marks.floodedAt)} 잠김` : "한계 미달"]] : []),
          ...x.impacts.map((i) => [i.kind, i.label, i.status === "예상" && i.at ? `${formatClock(i.at)} 예상` : i.exposure ?? i.status]),
        ],
        widths: ["90px", undefined, "160px"],
      },
    },
    {
      id: "sop", title: "해당 규정",
      note: "이 조건이면 해당되는 기존 SOP",
      rows: [],
      table: {
        head: ["규정", "적용", "시각"],
        rows: x.sop.map((s) => {
          const ev = x.actions.find((a) => a.id === s.id || a.id === `sop-${s.id}`);
          return [s.label, x.sopOn[s.id] ? `적용 ${x.sopOn[s.id]}` : "그날 그대로", ev ? formatClock(ev.at) : dash];
        }),
        widths: [undefined, "140px", "90px"],
      },
    },
    {
      id: "basis", title: "근거",
      rows: x.basisRows,
      footnote: x.basisLines.join(" "),
    },
  ];

  return {
    title: `${x.siteLabel} 모의훈련 보고서`,
    head: [
      { label: "대상", value: x.siteLabel },
      { label: "시나리오", value: x.scenarioLabel },
      { label: "적용 규정", value: appliedText },
    ],
    stats,
    sections,
    /* 경과는 조치 목록 그대로 — 문서 렌더러가 마지막 절로 세운다 */
    timeline: x.actions.map((a) => ({
      at: new Date(a.at),
      kind: "scenario" as const,
      label: a.label,
      detail: a.kind === "환경" ? "물이 달라진다" : a.kind === "규정" ? "규정 해당" : "노출만",
    })),
    issuedAt: new Date(),
  };
}
