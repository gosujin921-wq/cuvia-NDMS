/* ─────────────────────────────────────────────
 * 보고서 → 문서 한 벌 (양식 정본: KISA 월간 운영 보고서 v0.5)
 *
 * 문서가 필요한 것은 `Report` 말고도 머리 항목표·바닥 문구·그림·유의사항이다. 그 묶음을 여기서 만든다 —
 * 모달과 전체 화면이 같은 묶음을 쓰므로 자리마다 다시 적지 않는다.
 * ───────────────────────────────────────────── */

import type { ReportDocumentProps } from "../components/ReportDocument";
import type { Report } from "../demo/report";
import type { AnalysisResult } from "../model/whatif";
import type { ReportRecord } from "../model/records";
import { findEvent } from "../model/selectors";
import { analysisReportOf } from "./analysis-report";

/** 표 안의 시각 — HH:MM */
const clock = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

const stamp = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** 모의훈련 분석 보고서 — 저장된 분석 결과 한 건에서 (03 §26.10) */
export function analysisDocOf(a: AnalysisResult): ReportDocumentProps {
  const report = analysisReportOf(a);
  return {
    report,
    meta: [
      { label: "구분", value: "모의훈련 분석 보고서" },
      { label: "번호", value: a.analysisId },
      { label: "생성일시", value: stamp(report.issuedAt) },
    ],
    footLabel: `CUVIA 모의훈련 분석 보고서 · ${a.analysisId}`,
    /* 읽는 사람에게 필요한 것만 — 대안이 가정이라는 사실. 제작 구분(사전 작성 예측판 · 모델 교체 예정)과
       "SOP 로 확정되지 않습니다" 같은 면책은 올리지 않는다(CLAUDE.md · 2026-09-16 사용자 "빼줘").
       대안 예측판이 사전 작성본이라는 사실은 사건별 whatif fixture 의 머리 주석이 든다 */
    notice: [
      "대안은 실제로 일어난 일이 아니라 대응의 시점·수준·범위를 바꿨을 때의 전망입니다.",
    ],
  };
}

/** 사건 보고서 — 원장에서 만든 Report 에 문서 틀만 씌운다 */
export function incidentDocOf(report: Report, docNo: string, subtitle: string): ReportDocumentProps {
  /* 대응 경과는 절로 세운다 — 양식에 시간축 부품이 따로 없고, 시각·내용 두 칸 표면 충분하다 */
  const timeline: Report = report.timeline.length === 0 ? report : {
    ...report,
    sections: [
      ...report.sections,
      {
        id: "timeline",
        title: "대응 경과",
        rows: [],
        table: {
          head: ["시각", "내용"],
          rows: report.timeline.map((e) => [clock(e.at), e.detail ? `${e.label} · ${e.detail}` : e.label]),
        },
      },
    ],
  };
  return {
    report: timeline,
    meta: [
      { label: "구분", value: "재난상황 보고서" },
      { label: "번호", value: docNo },
      { label: "생성일시", value: stamp(report.issuedAt) },
    ],
    footLabel: `CUVIA 재난상황 보고서 · ${docNo}`,
    notice: [
      `${subtitle} 기록에서 자동으로 엮은 초안입니다. 담당자 확인 뒤 확정합니다.`,
      "관측·판단·대응 값은 사건 원장 그대로이며 이 문서에서 다시 계산하지 않습니다.",
    ],
  };
}

/**
 * 이력의 사건 보고서 — 사건 원장의 REPORT_GENERATED 한 건에 문서 틀을 씌운다(IA §10.1 · 2026-09-16).
 *
 * 절 본문은 원장이 " · " 로 이어 적은 항목이라 한 줄씩 표로 편다. 절마다 근거 이벤트를 각주로 단다 —
 * 보고서의 값이 어느 기록에서 왔는지 문서 안에서 짚을 수 있어야 한다(IA §10 "근거 링크").
 */
export function ledgerReportDocOf(rec: ReportRecord): ReportDocumentProps {
  const { report: r, incident } = rec;
  const occurred = new Date(incident.occurredAt);
  const closed = incident.closedAt ? new Date(incident.closedAt) : null;
  const report: Report = {
    title: rec.title,
    head: [
      { label: "사건", value: incident.title },
      { label: "범위", value: incident.scopeLabel },
      { label: "재난유형", value: incident.hazardKind },
      { label: "기간", value: `${stamp(occurred)} ~ ${closed ? clock(closed) : "진행 중"}` },
      { label: "상태", value: `${r.status} · ${r.version}판` },
    ],
    sections: r.sections.map((s, i) => {
      const evidence = s.evidenceEventIds
        .map(findEvent)
        .filter((e): e is NonNullable<ReturnType<typeof findEvent>> => Boolean(e))
        .map((e) => `${clock(new Date(e.observedAt))} ${e.summary}`);
      return {
        id: `s${i + 1}`,
        title: s.title,
        rows: [],
        table: { head: ["내용"], rows: s.body.split(" · ").map((line) => [line]) },
        footnote: evidence.length ? `근거 · ${evidence.join(" · ")}` : undefined,
      };
    }),
    timeline: [],
    issuedAt: new Date(r.generatedAt),
  };
  return {
    report,
    meta: [
      { label: "구분", value: "재난상황 보고서" },
      { label: "번호", value: r.reportId },
      { label: "생성일시", value: stamp(report.issuedAt) },
    ],
    footLabel: `CUVIA 재난상황 보고서 · ${r.reportId}`,
    notice: r.status === "초안" ? ["사건 기록에서 자동으로 엮은 초안입니다. 담당자 확인 뒤 확정합니다."] : undefined,
  };
}
