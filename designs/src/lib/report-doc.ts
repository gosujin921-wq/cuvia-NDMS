/* ─────────────────────────────────────────────
 * 보고서 → 문서 한 벌 (양식 정본: KISA 월간 운영 보고서 v0.5)
 *
 * 문서가 필요한 것은 `Report` 말고도 머리 항목표·바닥 문구·그림·유의사항이다. 그 묶음을 여기서 만든다 —
 * 모달과 전체 화면이 같은 묶음을 쓰므로 자리마다 다시 적지 않는다.
 * ───────────────────────────────────────────── */

import type { ReportDocumentProps } from "../components/ReportDocument";
import type { Report } from "../demo/report";
import type { AnalysisResult, TrainingRun } from "../model/whatif";
import type { ReportRecord } from "../model/records";
import { analysisReportOf } from "./analysis-report";
import { formatStamp as stamp } from "./datetime";
import { incidentReportOf } from "./incident-report";
import { trainingReportOf } from "./training-report";

/** 표 안의 시각 — HH:MM */
const clock = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
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
      "대안은 실제로 일어난 일이 아니라 대응의 시점·수준·범위를 바꿨을 때의 예측입니다.",
    ],
  };
}

/** 모의훈련 보고서 — 저장된 훈련 한 회에서 (03 §26.9) */
export function trainingDocOf(run: TrainingRun): ReportDocumentProps {
  const report = trainingReportOf(run);
  return {
    report,
    meta: [
      { label: "구분", value: "모의훈련 보고서" },
      { label: "번호", value: run.runId },
      { label: "생성일시", value: stamp(report.issuedAt) },
    ],
    footLabel: `CUVIA 모의훈련 보고서 · ${run.runId}`,
    /* 읽는 사람이 오해하지 않으려면 이 둘이 필요하다 — 훈련은 일어난 일이 아니고,
       표의 값은 저장 시점의 것이다. 제작 구분·면책 문구는 올리지 않는다(CLAUDE.md) */
    notice: [
      "훈련은 실제로 일어난 일이 아니라 지난 사건의 조건과 대응을 바꿔 돌려 본 결과입니다.",
      "표의 값은 훈련을 마친 시점에 기록한 것으로, 이후 시나리오가 바뀌어도 이 문서는 달라지지 않습니다.",
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
 * 절·차트·요약 지표는 lib/incident-report 가 원장에서 엮는다. `now` 는 이력이 넘긴 시계다.
 */
export function ledgerReportDocOf(rec: ReportRecord, now: Date): ReportDocumentProps {
  const { report: r } = rec;
  const report = incidentReportOf(rec, now);
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
