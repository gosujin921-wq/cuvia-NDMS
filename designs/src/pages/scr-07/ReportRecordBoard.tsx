/* ─────────────────────────────────────────────
 * 이력 › 보고서 — 확정·제출할 문서를 찾는 게시판 (IA §10.1 · 2026-09-16)
 *
 * 보고서는 사건 기록에서 생성되는 결과물이다. 이 게시판은 그 결과물을 사건을 가로질러 찾는 자리다.
 * 목록에서 알고 싶은 것은 순서대로 셋이다 — 무슨 문서인가(보고서명·번호) · 확정됐나(초안·확정본, 판) · 언제 만들었나.
 * 어느 사건의 문서인지는 보고서명이 말하고, 사건이 아직 진행 중인지는 사건 상태 칸이 말한다(진행 중 사건의 보고서는 그때까지의 문서다).
 * 줄을 누르면 목록 위에 보고서 창이 뜬다. 틀은 BoardFrame 이다.
 *
 * 보고서는 **구분**으로 나뉜다(2026-09-17 사용자) — 이벤트(사건 원장에서 생성)와 모의훈련(디지털트윈에서 저장).
 * 두 문서는 모양이 달라 공통 행(`ReportRow`)으로 접어 한 표에 세운다. 사건 칸은 사건 보고서만, 대상 칸은 시뮬레이션만 채운다.
 * 모의훈련 분석 보고서는 여기 세우지 않는다(IA §10 · 모의훈련 소유).
 * ───────────────────────────────────────────── */

import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { Badge, Button, ChipFilter, DataTable, StatusBadge, type DataTableColumn } from "@ds";
import { BoardFrame } from "../../components/BoardFrame";
import { formatStamp } from "../../lib/datetime";
import { RECORD_STATUS_TONE } from "../../lib/status-tone";
import type { IncidentRecord, ReportRecord } from "../../model/records";
import type { SimReportRecord } from "../../lib/sim-report";

const ALL = "전체";
export type ReportKind = "이벤트" | "모의훈련";
const REPORT_KINDS = [ALL, "이벤트", "모의훈련"];
const REPORT_STATUSES = [ALL, "초안", "확정본", "저장"];

/** 게시판 한 줄 — 사건 보고서와 시뮬레이션 보고서를 같은 칸으로 접는다 */
export interface ReportRow {
  id: string;
  kind: ReportKind;
  title: string;
  status: string;
  version: number | null;
  /** 사건 보고서만 */
  incidentStatus: IncidentRecord["status"] | null;
  /** 모의훈련 보고서만 — 대상 · 시나리오 */
  subject: string | null;
  generatedAt: string;
}

export const reportRowOf = (r: ReportRecord): ReportRow => ({
  id: r.report.reportId, kind: "이벤트", title: r.title, status: r.report.status, version: r.report.version,
  incidentStatus: r.incident.status, subject: null, generatedAt: r.report.generatedAt,
});
export const simReportRowOf = (r: SimReportRecord): ReportRow => ({
  id: r.reportId, kind: "모의훈련", title: r.title, status: "저장", version: null,
  incidentStatus: null, subject: r.input.scenarioLabel, generatedAt: r.savedAt,
});

export function ReportRecordBoard({ items, onOpen, focusId }: {
  items: ReportRow[];
  onOpen: (row: ReportRow) => void;
  focusId?: string | null;
}) {
  const [kind, setKind] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [q, setQ] = useState("");
  const hasActiveFilter = kind !== ALL || status !== ALL || q.trim() !== "";
  const resetFilters = () => { setKind(ALL); setStatus(ALL); setQ(""); };

  const rows = useMemo(() => {
    const needle = q.trim();
    return items
      .filter((r) => kind === ALL || r.kind === kind)
      .filter((r) => status === ALL || r.status === status)
      .filter((r) => !needle || r.title.includes(needle) || r.id.includes(needle) || (r.subject ?? "").includes(needle));
  }, [items, kind, status, q]);

  const columns = useMemo<DataTableColumn<ReportRow>[]>(
    () => [
      {
        key: "title", label: "보고서", sortable: true, getValue: (r) => r.title,
        render: (r) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-foreground">{r.title}</span>
            <span className="truncate font-mono text-foreground-subtle">{r.id}</span>
          </span>
        ),
      },
      {
        key: "kind", label: "구분", width: "104px", sortable: true, getValue: (r) => r.kind,
        render: (r) => <Badge variant={r.kind === "이벤트" ? "orange" : "blue"} className="w-fit">{r.kind}</Badge>,
      },
      {
        key: "status", label: "상태", width: "88px", sortable: true, getValue: (r) => r.status,
        render: (r) => <Badge variant={r.status === "확정본" ? "green" : "outline"} className="w-fit">{r.status}</Badge>,
      },
      {
        key: "version", label: "판", width: "56px", align: "right", sortable: true, getValue: (r) => r.version ?? 0,
        cellClassName: "tabular-nums text-foreground-muted", render: (r) => (r.version === null ? "-" : `${r.version}판`),
      },
      {
        /* 사건 보고서는 그 사건의 상태, 시뮬레이션은 본 시나리오 */
        key: "subject", label: "사건 · 시나리오", width: "200px", sortable: true, getValue: (r) => r.incidentStatus ?? r.subject ?? "",
        render: (r) => r.incidentStatus
          ? <StatusBadge status={RECORD_STATUS_TONE[r.incidentStatus].badge} label={r.incidentStatus} className="w-fit" />
          : <span className="truncate text-foreground-muted">{r.subject}</span>,
      },
      {
        key: "generatedAt", label: "생성", width: "112px", align: "right", sortable: true, getValue: (r) => new Date(r.generatedAt),
        cellClassName: "tabular-nums whitespace-nowrap text-foreground-muted", render: (r) => formatStamp(r.generatedAt),
      },
    ],
    [],
  );

  return (
    <BoardFrame
      filters={
        <>
          <ChipFilter label="구분" options={REPORT_KINDS} value={kind} onChange={setKind} noDot />
          <ChipFilter label="상태" options={REPORT_STATUSES} value={status} onChange={setStatus} noDot />
        </>
      }
      onReset={resetFilters}
      resetDisabled={!hasActiveFilter}
      search={{ value: q, onChange: setQ, placeholder: "보고서명·번호·시나리오 검색", label: "보고서 검색" }}
    >
      <DataTable
        data={rows}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => onOpen(r)}
        highlightedKey={focusId ?? null}
        fillEmptyRows
        showTotalCount
        unitLabel="건"
        emptyIcon={hasActiveFilter ? "mdi:filter-off-outline" : "mdi:file-document-outline"}
        emptyMessage={hasActiveFilter ? "조건에 해당하는 보고서가 없습니다" : "생성된 보고서가 없습니다"}
        emptyDescription={hasActiveFilter ? "필터 조건을 바꿔 다시 찾아보세요." : "사건 기록에서 보고서가 생성되거나 모의훈련 보고서를 저장하면 여기에 쌓입니다."}
        emptyAction={
          hasActiveFilter ? (
            <Button variant="outline" size="sm" onClick={resetFilters}>
              <Icon icon="mdi:refresh" className="mr-1.5 size-3.5" aria-hidden />
              필터 초기화
            </Button>
          ) : undefined
        }
      />
    </BoardFrame>
  );
}
