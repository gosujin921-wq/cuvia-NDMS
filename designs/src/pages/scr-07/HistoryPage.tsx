/* ─────────────────────────────────────────────
 * SCR-07 이력 (IA-05) — 사건을 되짚고 예측을 검증하고 보고서를 찾는 자리 (IA §10.1 · 2026-09-16)
 *
 * 보고서 메뉴를 이력으로 바꿨다. 상단 탭 둘은 보는 목적이 다르다.
 *   [사건]    일어난 일 — 사건 게시판 → 사건 기록 창(요약 · 발생 근거 · 위험 판단 · 대응 · 예측 검증 · 경과)
 *   [보고서]  만들어진 문서 — 보고서 게시판 → 보고서 창 → [보고서 화면] 전체 화면
 * 디지털트윈의 [사건] · [저장된 분석]과 같은 문법이고 탭 줄도 같은 부품(components/SubNav)이다.
 *
 * ▸ 상태는 query 가 든다. 신규 라우트를 만들지 않는다(IA §5.2).
 *     /scr-07                          사건 게시판
 *     /scr-07?incident=INC-…           목록 위에 그 사건의 기록 창 (&view=case 면 ⑤ 예측 검증 절로 연다) — D8 종료가 여기로 온다
 *     /scr-07?tab=report               보고서 게시판
 *     /scr-07?tab=report&report=RP-…   목록 위에 그 보고서 창
 *     /scr-07?doc=RP-…                 보고서 전체 화면 (인쇄·상급기관 보고)
 *     /scr-07?tab=report&sim=SIM-…     목록 위에 그 시뮬레이션 보고서 창 — 디지털트윈 [이력에 저장]이 여기로 온다
 *     /scr-07?simdoc=SIM-…             시뮬레이션 보고서 전체 화면
 *     /scr-07?analysis=A-…             디지털트윈 저장된 분석의 보고서 전체 화면 — 이력 게시판에는 세우지 않는다(03 §26)
 * ▸ 시계는 원장 끝까지 간다(recordClockOf · 2026-09-17). 시연이 D0 에 있어도 서항 사건은 종료·예측 검증·보고서까지 선다.
 * ▸ 없는 사건·보고서는 다른 것으로 바꾸지 않는다. 찾을 수 없다고 말하고 게시판으로 돌아가는 길을 준다(IA §5.2 라우트 예외).
 * ▸ 이력은 읽는 자리다. 판단·승인·조작은 사건 작업공간(IA-02·04)이 한다.
 * ───────────────────────────────────────────── */

import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { Button, EmptyState } from "@ds";
import { useScenario } from "../../state/ScenarioProvider";
import { FullWidthLayout } from "../../layout/FullWidthLayout";
import { SubNav, type SubNavTab } from "../../components/SubNav";
import { FormDialog } from "../../components/FormDialog";
import { ReportDocument } from "../../components/ReportDocument";
import { ReportModal } from "../../components/ReportModal";
import { analysisDocOf, ledgerReportDocOf } from "../../lib/report-doc";
import { incidentRecordsAt, recordClockOf, reportRecordsAt, type ReportRecord } from "../../model/records";
import type { AnalysisResult } from "../../model/whatif";
import { IncidentRecordBoard } from "./IncidentRecordBoard";
import { IncidentRecordModal } from "./IncidentRecordModal";
import { ReportRecordBoard, reportRowOf, simReportRowOf, type ReportRow } from "./ReportRecordBoard";
import { simDocOf, type SimReportRecord } from "../../lib/sim-report";

type HistoryTab = "cases" | "report";

export function HistoryPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { demoNow, analyses, falsePositiveIds, simReports } = useScenario();
  /* 이력은 원장 끝까지 읽는다 — 시연 시계가 뒤에 있어도 원장 사건은 끝난 것으로 선다(model/records.recordClockOf) */
  const now = useMemo(() => recordClockOf(demoNow), [demoNow]);

  const tab: HistoryTab = params.get("tab") === "report" ? "report" : "cases";
  const incidentId = tab === "cases" ? params.get("incident") : null;
  /* D8 종료가 `&view=case` 로 온다 — 사건 기록 창을 ⑤ 예측 검증 절로 연다 */
  const view = params.get("view") === "case" ? "case" : "record";
  const reportId = tab === "report" ? params.get("report") : null;
  const docId = params.get("doc");
  const simId = tab === "report" ? params.get("sim") : null;
  const simDocId = params.get("simdoc");
  const analysisId = params.get("analysis");

  const records = useMemo(() => incidentRecordsAt(now, { falsePositiveIds }), [now, falsePositiveIds]);
  const reports = useMemo(() => reportRecordsAt(now, { falsePositiveIds }), [now, falsePositiveIds]);
  const record = incidentId ? records.find((r) => r.incidentId === incidentId) ?? null : null;
  const reportRec = reportId ? reports.find((r) => r.report.reportId === reportId) ?? null : null;
  const reportDoc = useMemo(() => (reportRec ? ledgerReportDocOf(reportRec, now) : null), [reportRec, now]);
  /* 게시판은 두 구분을 한 표에 — 생성 최신순 */
  const reportRows = useMemo<ReportRow[]>(
    () => [...reports.map(reportRowOf), ...simReports.map(simReportRowOf)].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)),
    [reports, simReports],
  );
  const simRec = simId ? simReports.find((r) => r.reportId === simId) ?? null : null;
  const simDoc = useMemo(() => (simRec ? simDocOf(simRec.input, simRec.reportId) : null), [simRec]);

  /* 연 줄은 창을 닫아도 강조로 남는다. query 만 바뀌면 이 화면은 다시 서지 않아 상태가 이어진다 */
  const [focus, setFocus] = useState<string | null>(null);

  const goTab = (next: HistoryTab) => setParams(next === "report" ? { tab: "report" } : {});
  const openIncident = (id: string) => { setFocus(id); setParams({ incident: id }); };
  const openReport = (id: string) => { setFocus(id); setParams({ tab: "report", report: id }); };
  const openRow = (row: ReportRow) => {
    setFocus(row.id);
    setParams(row.kind === "이벤트" ? { tab: "report", report: row.id } : { tab: "report", sim: row.id });
  };

  /* 전체 화면 둘 — 게시판 대신 문서가 선다 */
  if (analysisId) {
    const analysis = analyses.find((a) => a.analysisId === analysisId) ?? null;
    return analysis ? <AnalysisReport analysis={analysis} /> : <DocNotFound what={`저장된 분석 결과 ${analysisId}`} onBack={() => navigate("/scr-05?tab=saved")} />;
  }
  if (simDocId) {
    const rec = simReports.find((r) => r.reportId === simDocId) ?? null;
    return rec ? <SimReportPage rec={rec} onBack={() => setParams({ tab: "report", sim: simDocId })} /> : <DocNotFound what={`보고서 ${simDocId}`} onBack={() => goTab("report")} />;
  }
  if (docId) {
    const rec = reports.find((r) => r.report.reportId === docId) ?? null;
    return rec ? <LedgerReportPage rec={rec} now={now} onBack={() => openReport(docId)} /> : <DocNotFound what={`보고서 ${docId}`} onBack={() => goTab("report")} />;
  }

  const tabs: SubNavTab<HistoryTab>[] = [
    { id: "cases", label: "사건", icon: "mdi:alert-circle-outline", count: records.length },
    { id: "report", label: "보고서", icon: "mdi:file-document-outline", count: reportRows.length },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SubNav tabs={tabs} value={tab} onChange={goTab} label="이력" />

      <FullWidthLayout className="min-h-0 flex-1">
        {tab === "cases" ? (
          <IncidentRecordBoard items={records} onOpen={(id) => openIncident(id)} focusId={focus ?? incidentId} />
        ) : (
          <ReportRecordBoard items={reportRows} onOpen={openRow} focusId={focus ?? reportId ?? simId} />
        )}
      </FullWidthLayout>

      <IncidentRecordModal
        record={record}
        now={now}
        focusCase={view === "case"}
        onClose={() => goTab("cases")}
        onOpenReport={openReport}
        onOpenWorkspace={(districtId) => navigate(`/scr-02/${districtId}`)}
      />
      {incidentId && !record && <NotFoundWindow what={`사건 ${incidentId}`} onClose={() => goTab("cases")} />}

      <ReportModal
        open={reportRec !== null}
        onOpenChange={(next) => { if (!next) goTab("report"); }}
        doc={reportDoc}
        kindLabel="재난상황 보고서"
        onOpenFull={reportRec ? () => setParams({ doc: reportRec.report.reportId }) : undefined}
      />
      {reportId && !reportRec && <NotFoundWindow what={`보고서 ${reportId}`} onClose={() => goTab("report")} />}

      <ReportModal
        open={simRec !== null}
        onOpenChange={(next) => { if (!next) goTab("report"); }}
        doc={simDoc}
        kindLabel="모의훈련 보고서"
        onOpenFull={simRec ? () => setParams({ simdoc: simRec.reportId }) : undefined}
      />
      {simId && !simRec && <NotFoundWindow what={`보고서 ${simId}`} onClose={() => goTab("report")} />}
    </div>
  );
}

/** 링크가 가리키는 사건·보고서가 없을 때 — 다른 것으로 바꾸지 않고 없다고 말한다 */
function NotFoundWindow({ what, onClose }: { what: string; onClose: () => void }) {
  return (
    <FormDialog open onClose={onClose} icon="mdi:help-circle-outline" title="찾을 수 없습니다">
      <EmptyState variant="inline" icon="mdi:file-search-outline" message={`${what} 기록이 없습니다`} description="목록에서 다시 선택하세요." />
    </FormDialog>
  );
}

function DocNotFound({ what, onBack }: { what: string; onBack: () => void }) {
  return (
    <div className="p-4">
      <EmptyState
        icon="mdi:file-document-outline"
        message={`${what}을 찾을 수 없습니다`}
        description="다른 문서로 바꾸지 않습니다. 목록에서 다시 선택하세요."
        action={
          <Button variant="outline" size="sm" onClick={onBack}>
            <Icon icon="mdi:format-list-bulleted" className="size-4" aria-hidden />
            목록
          </Button>
        }
      />
    </div>
  );
}

/** 사건 보고서 전체 화면 — 왼쪽 [목록]·제목, 오른쪽 내보내기(platform_web fast-search/report 머리와 같은 배치) */
function LedgerReportPage({ rec, now, onBack }: { rec: ReportRecord; now: Date; onBack: () => void }) {
  const doc = useMemo(() => ledgerReportDocOf(rec, now), [rec, now]);
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <Icon icon="mdi:arrow-left" className="size-4" aria-hidden />
          목록
        </Button>
        <div className="h-5 w-px bg-border opacity-60" aria-hidden />
        <span className="min-w-0 truncate text-body font-medium text-foreground">{rec.title}</span>
        <div className="ml-auto flex shrink-0 gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Icon icon="mdi:printer-outline" className="size-4" aria-hidden />
            인쇄
          </Button>
          <Button variant="secondary" size="sm">
            <Icon icon="mdi:send-outline" className="size-4" aria-hidden />
            상급기관 보고
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ReportDocument {...doc} />
      </div>
    </div>
  );
}

/** 시뮬레이션 보고서 전체 화면 — 사건 보고서 전체 화면과 같은 머리 */
function SimReportPage({ rec, onBack }: { rec: SimReportRecord; onBack: () => void }) {
  const doc = useMemo(() => simDocOf(rec.input, rec.reportId), [rec]);
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <Icon icon="mdi:arrow-left" className="size-4" aria-hidden />
          목록
        </Button>
        <span className="min-w-0 truncate text-body font-medium text-foreground">{rec.title}</span>
        <div className="ml-auto flex shrink-0 gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Icon icon="mdi:printer-outline" className="size-4" aria-hidden />
            인쇄
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ReportDocument {...doc} />
      </div>
    </div>
  );
}

/** 디지털트윈 저장된 분석의 보고서 전체 화면 — 디지털트윈 [보고서 화면]이 들어오는 자리(03 §26) */
function AnalysisReport({ analysis }: { analysis: AnalysisResult }) {
  const doc = useMemo(() => analysisDocOf(analysis), [analysis]);
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <span className="text-caption text-foreground-muted">분석 결과</span>
        <span className="text-body font-medium">{analysis.name}</span>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Icon icon="mdi:printer-outline" className="size-4" aria-hidden />
            인쇄
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ReportDocument {...doc} />
      </div>
    </div>
  );
}
