/* ─────────────────────────────────────────────
 * 이력 › 사건 — 되짚을 사건을 찾는 게시판 (IA §10.1 · 2026-09-16)
 *
 * 목록에서 알고 싶은 것은 순서대로 넷이다 — 어느 사건인가(사건명·범위) · 무슨 재난인가 · 지금 어떤가(진행 중·종료·오탐·병합)
 * · 언제였나(발생·종료). 마지막 두 칸은 이 사건에 예측 검증과 보고서가 있는지만 알린다. 내용은 창에서 본다.
 * 줄을 누르면 목록 위에 사건 기록 창이 뜬다(platform_web 게시판 문법). 틀은 BoardFrame 이다.
 *
 * 목록은 model/records 의 incidentRecordsAt 이 준다 — 통계와 같은 원장이라 조건이 같으면 건수가 같다.
 * ───────────────────────────────────────────── */

import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { Button, ChipFilter, DataTable, StatusBadge, type DataTableColumn } from "@ds";
import { BoardFrame } from "../../components/BoardFrame";
import { formatStamp } from "../../lib/datetime";
import { RECORD_STATUS_TONE } from "../../lib/status-tone";
import { RECORD_STATUSES, type IncidentRecord } from "../../model/records";

const ALL = "전체";

export function IncidentRecordBoard({ items, onOpen, focusId }: {
  items: IncidentRecord[];
  onOpen: (incidentId: string) => void;
  /** 연 줄 — 창을 닫아도 강조로 남는다 */
  focusId?: string | null;
}) {
  const [status, setStatus] = useState(ALL);
  const [kind, setKind] = useState(ALL);
  const [q, setQ] = useState("");
  const hasActiveFilter = status !== ALL || kind !== ALL || q.trim() !== "";
  const resetFilters = () => { setStatus(ALL); setKind(ALL); setQ(""); };

  /* 유형 후보는 목록에 있는 것만 — 없는 유형을 세우면 고를 수 있는데 결과가 없다 */
  const kinds = useMemo(() => [ALL, ...new Set(items.map((r) => r.hazardKind))], [items]);

  const rows = useMemo(() => {
    const needle = q.trim();
    return items
      .filter((r) => status === ALL || r.status === status)
      .filter((r) => kind === ALL || r.hazardKind === kind)
      .filter((r) => !needle || r.title.includes(needle) || r.region.includes(needle) || r.scopeLabel.includes(needle));
  }, [items, status, kind, q]);

  const columns = useMemo<DataTableColumn<IncidentRecord>[]>(
    () => [
      {
        key: "title", label: "사건", sortable: true, getValue: (r) => r.title,
        render: (r) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-foreground">{r.title}</span>
            <span className="truncate text-foreground-subtle">{r.scopeLabel}</span>
          </span>
        ),
      },
      { key: "hazardKind", label: "유형", width: "112px", sortable: true, getValue: (r) => r.hazardKind },
      {
        key: "status", label: "상태", width: "104px", sortable: true, getValue: (r) => RECORD_STATUSES.indexOf(r.status),
        render: (r) => <StatusBadge status={RECORD_STATUS_TONE[r.status].badge} label={r.status} className="w-fit" />,
      },
      {
        key: "occurredAt", label: "발생", width: "112px", sortable: true, getValue: (r) => new Date(r.occurredAt),
        cellClassName: "tabular-nums whitespace-nowrap text-foreground-muted", render: (r) => formatStamp(r.occurredAt),
      },
      {
        key: "closedAt", label: "종료", width: "112px", sortable: true, getValue: (r) => (r.closedAt ? new Date(r.closedAt) : new Date(8.64e15)),
        cellClassName: "tabular-nums whitespace-nowrap text-foreground-muted",
        render: (r) => (r.closedAt ? formatStamp(r.closedAt) : <span className="text-foreground-subtle">-</span>),
      },
      {
        key: "case", label: "예측 검증", width: "96px", sortable: true, getValue: (r) => r.caseCount,
        render: (r) => (r.caseCount > 0 ? <span className="text-foreground">있음</span> : <span className="text-foreground-subtle">-</span>),
      },
      {
        key: "report", label: "보고서", width: "96px", sortable: true, getValue: (r) => r.reports.length,
        render: (r) => {
          const latest = r.reports.at(-1);
          return latest ? <span className="text-foreground">{latest.status}</span> : <span className="text-foreground-subtle">-</span>;
        },
      },
    ],
    [],
  );

  return (
    <BoardFrame
      filters={
        <>
          <ChipFilter label="상태" options={[ALL, ...RECORD_STATUSES]} value={status} onChange={setStatus} noDot />
          <ChipFilter label="유형" options={kinds} value={kind} onChange={setKind} noDot />
        </>
      }
      onReset={resetFilters}
      resetDisabled={!hasActiveFilter}
      search={{ value: q, onChange: setQ, placeholder: "사건명·지역 검색", label: "사건 검색" }}
    >
      <DataTable
        data={rows}
        columns={columns}
        rowKey={(r) => r.incidentId}
        onRowClick={(r) => onOpen(r.incidentId)}
        highlightedKey={focusId ?? null}
        fillEmptyRows
        showTotalCount
        unitLabel="건"
        emptyIcon={hasActiveFilter ? "mdi:filter-off-outline" : "mdi:history"}
        emptyMessage={hasActiveFilter ? "조건에 해당하는 사건이 없습니다" : "기록된 사건이 없습니다"}
        emptyDescription={hasActiveFilter ? "필터 조건을 바꿔 다시 찾아보세요." : "사건이 생기면 여기에 기록이 쌓입니다."}
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
