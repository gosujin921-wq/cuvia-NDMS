/* ─────────────────────────────────────────────
 * 이력 › 보고서 — 확정·제출할 문서를 찾는 게시판 (IA §10.1 · 2026-09-16)
 *
 * 보고서는 사건 기록에서 생성되는 결과물이다. 이 게시판은 그 결과물을 사건을 가로질러 찾는 자리다.
 * 목록에서 알고 싶은 것은 순서대로 셋이다 — 무슨 문서인가(보고서명·번호) · 확정됐나(초안·확정본, 판) · 언제 만들었나.
 * 어느 사건의 문서인지는 보고서명이 말하고, 사건이 아직 진행 중인지는 사건 상태 칸이 말한다(진행 중 사건의 보고서는 그때까지의 문서다).
 * 줄을 누르면 목록 위에 보고서 창이 뜬다. 틀은 BoardFrame 이다.
 *
 * 디지털트윈 저장된 분석의 보고서는 여기 세우지 않는다(IA §10 · 디지털트윈 소유).
 * ───────────────────────────────────────────── */

import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { Badge, Button, ChipFilter, DataTable, StatusBadge, type DataTableColumn } from "@ds";
import { BoardFrame } from "../../components/BoardFrame";
import { formatStamp } from "../../lib/datetime";
import { RECORD_STATUS_TONE } from "../../lib/status-tone";
import type { ReportRecord } from "../../model/records";

const ALL = "전체";
const REPORT_STATUSES = [ALL, "초안", "확정본"];

export function ReportRecordBoard({ items, onOpen, focusId }: {
  items: ReportRecord[];
  onOpen: (reportId: string) => void;
  focusId?: string | null;
}) {
  const [status, setStatus] = useState(ALL);
  const [q, setQ] = useState("");
  const hasActiveFilter = status !== ALL || q.trim() !== "";
  const resetFilters = () => { setStatus(ALL); setQ(""); };

  const rows = useMemo(() => {
    const needle = q.trim();
    return items
      .filter((r) => status === ALL || r.report.status === status)
      .filter((r) => !needle || r.title.includes(needle) || r.report.reportId.includes(needle));
  }, [items, status, q]);

  const columns = useMemo<DataTableColumn<ReportRecord>[]>(
    () => [
      {
        key: "title", label: "보고서", sortable: true, getValue: (r) => r.title,
        render: (r) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-foreground">{r.title}</span>
            <span className="truncate font-mono text-foreground-subtle">{r.report.reportId}</span>
          </span>
        ),
      },
      {
        key: "status", label: "상태", width: "96px", sortable: true, getValue: (r) => r.report.status,
        render: (r) => <Badge variant={r.report.status === "확정본" ? "green" : "outline"} className="w-fit">{r.report.status}</Badge>,
      },
      {
        key: "version", label: "판", width: "64px", align: "right", sortable: true, getValue: (r) => r.report.version,
        cellClassName: "tabular-nums text-foreground-muted", render: (r) => `${r.report.version}판`,
      },
      {
        key: "incident", label: "사건 상태", width: "104px", sortable: true, getValue: (r) => r.incident.status,
        render: (r) => <StatusBadge status={RECORD_STATUS_TONE[r.incident.status].badge} label={r.incident.status} className="w-fit" />,
      },
      {
        key: "generatedAt", label: "생성", width: "112px", align: "right", sortable: true, getValue: (r) => new Date(r.report.generatedAt),
        cellClassName: "tabular-nums whitespace-nowrap text-foreground-muted", render: (r) => formatStamp(r.report.generatedAt),
      },
    ],
    [],
  );

  return (
    <BoardFrame
      filters={<ChipFilter label="상태" options={REPORT_STATUSES} value={status} onChange={setStatus} noDot />}
      onReset={resetFilters}
      resetDisabled={!hasActiveFilter}
      search={{ value: q, onChange: setQ, placeholder: "보고서명·번호 검색", label: "보고서 검색" }}
    >
      <DataTable
        data={rows}
        columns={columns}
        rowKey={(r) => r.report.reportId}
        onRowClick={(r) => onOpen(r.report.reportId)}
        highlightedKey={focusId ?? null}
        fillEmptyRows
        showTotalCount
        unitLabel="건"
        emptyIcon={hasActiveFilter ? "mdi:filter-off-outline" : "mdi:file-document-outline"}
        emptyMessage={hasActiveFilter ? "조건에 해당하는 보고서가 없습니다" : "생성된 보고서가 없습니다"}
        emptyDescription={hasActiveFilter ? "필터 조건을 바꿔 다시 찾아보세요." : "사건 기록에서 보고서가 생성되면 여기에 쌓입니다."}
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
