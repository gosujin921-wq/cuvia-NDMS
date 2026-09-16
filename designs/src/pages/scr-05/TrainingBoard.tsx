/* ─────────────────────────────────────────────
 * 모의훈련 › 훈련하기 — 어느 사건으로 훈련할까 (README §2.3 · 03 §26.2 · 2026-09-16 v2)
 *
 * 지도 없이 전체 폭 게시판이다. 사건을 고르기 전에는 지도 위 패널(범례·광역 인셋)이 설명할 것이 없다.
 * 사건을 지도에 핀으로 올리지 않는다 — 같은 지구에서 사건이 반복되면 겹친다(서항: 복합침수 · 펌프장 정전).
 *
 * ★ 훈련 준비가 안 된 사건도 목록에 서고 **이유를 밝힌다**. 조용히 숨기거나 다른 사건으로 대체하지 않는다(IA §5.2).
 *   이유는 둘이다 — "정지점과 발동 규정을 아직 정하지 않았다"와 "현상을 바꾸는 대응이 없어 만들 수 없다"(03 §26.3).
 * ───────────────────────────────────────────── */

import { DataTable, Tag } from "@ds";
import { useScenario } from "../../state/ScenarioProvider";
import { trainingCasesAt } from "../../model/selectors";
import { TWIN_FAMILY_HAZARD_NAME } from "../../model/twin-family";
import { ALTERNATIVE_LABEL } from "../../model/forecast";
import { formatClock } from "../../lib/datetime";
import type { WhatIfCase } from "../../model/whatif";

/** 사건 기간 — "2024.08.28 14:20 ~ 17:40" */
function spanOf(c: WhatIfCase): string {
  const a = new Date(c.occurredAt), b = c.closedAt ? new Date(c.closedAt) : null;
  const p = (n: number) => String(n).padStart(2, "0");
  const day = `${a.getFullYear()}.${p(a.getMonth() + 1)}.${p(a.getDate())}`;
  if (!b) return day;
  const sameDay = b.getDate() === a.getDate() && b.getMonth() === a.getMonth();
  return `${day} ${formatClock(a)} ~ ${sameDay ? formatClock(b) : `${p(b.getMonth() + 1)}.${p(b.getDate())} ${formatClock(b)}`}`;
}

export function TrainingBoard({ onPick }: { onPick: (incidentId: string) => void }) {
  const { demoNow } = useScenario();
  const rows = trainingCasesAt(demoNow);
  const ready = rows.filter((r) => r.ready).length;

  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-title font-semibold text-foreground">어느 사건으로 훈련할까</h1>
        <p className="text-body text-foreground-muted">
          실제 사건 원장에서 만든 시나리오로 훈련합니다 · 지난 사건 {rows.length} · 훈련 가능 {ready}
        </p>
      </header>

      <DataTable
        data={rows}
        rowKey={(r) => r.c.incidentId}
        onRowClick={(r) => onPick(r.c.incidentId)}
        /* 훈련 준비가 안 된 사건은 눌러도 열리지 않는다. 대신 비고에 이유가 적힌다 */
        isRowClickable={(r) => r.ready}
        hidePagination
        columns={[
          { key: "title", label: "사건", render: (r) => <span className="font-medium text-foreground">{r.c.title}</span> },
          { key: "kind", label: "유형", width: "110px", render: (r) => TWIN_FAMILY_HAZARD_NAME[r.c.twinFamily] },
          { key: "span", label: "발생", width: "230px", cellClassName: "whitespace-nowrap", render: (r) => <span className="font-mono text-caption">{spanOf(r.c)}</span> },
          {
            key: "core", label: "핵심 판단", width: "180px",
            /* 그 유형에서 결과를 바꾸는 대응. 훈련은 이것을 묻는다(03 §26.3) */
            render: (r) => (r.core ? ALTERNATIVE_LABEL[r.core.responseId] : <span className="text-foreground-subtle">없음</span>),
          },
          {
            key: "ready", label: "훈련", width: "110px",
            render: (r) => (r.ready ? <Tag tone="success">가능</Tag> : <Tag>시나리오 없음</Tag>),
          },
          {
            key: "note", label: "비고",
            render: (r) => (
              <span className="break-keep text-caption text-foreground-subtle">
                {r.ready
                  ? `정지점 ${r.c.training!.stops.length} · 발동 규정 ${r.c.training!.firedSopIds.length}건`
                  : r.core
                    ? "정지점과 발동 규정을 아직 정하지 않았습니다"
                    : "현상을 바꾸는 대응이 없어 훈련 시나리오를 만들 수 없습니다"}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
