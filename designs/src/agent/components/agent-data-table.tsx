/* ─────────────────────────────────────────────
 * 이식본 — 원본: cuvia_platform_web/features/ai-agent/components/agent-data-table.tsx
 *
 * 원본과 다른 곳은 둘.
 *   · 행 클릭 → 지도 이동 을 뺐다. 답변에서 지도를 띄우지 않으므로 좌표를 다루지 않는다
 *   · 넓은 표에 가로 스크롤을 줬다. 패널이 480px 라 열이 많으면 넘치는데,
 *     **열을 빼지 않는다** — 값을 덜어내면 04 문서와 어긋난다 (03 §6)
 * ───────────────────────────────────────────── */

import { useMemo } from "react";
import type { AgentTableData } from "../types";

/** 버블 안에서는 표를 접어 보여준다 — 넘치는 행 수만 알린다. */
const ROW_LIMIT = 5;

export interface AgentDataTableProps {
  table: AgentTableData;
}

/** 셀 값이 HTML 조각으로 올 수 있어 태그를 벗겨 텍스트만 쓴다. */
const stripTags = (html: string): string => html.replace(/<[^>]*>/g, "");

/** 답변에 딸린 표. */
export function AgentDataTable({ table }: AgentDataTableProps) {
  const view = useMemo(() => {
    const total = table.total_count ?? table.data?.length ?? 0;
    const rows = table.data?.slice(0, ROW_LIMIT) ?? [];
    return { rows, hiddenCount: Math.max(0, total - rows.length) };
  }, [table]);

  return (
    <>
      {table.title && (
        <h3 className="mb-2 text-caption font-semibold text-foreground-muted">{table.title}</h3>
      )}
      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-caption">
          <thead>
            <tr className="bg-card">
              {table.columns?.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="px-3 py-2.5 text-left font-semibold whitespace-nowrap text-foreground"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={rowIdx % 2 === 0 ? "bg-transparent" : "bg-row-zebra"}
              >
                {row.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className="px-3 py-2 font-medium whitespace-nowrap text-foreground-muted"
                  >
                    {stripTags(String(cell))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {view.hiddenCount > 0 && (
        <p className="py-2 text-caption text-foreground-muted">
          ... {view.hiddenCount}건 더 있음
        </p>
      )}
    </>
  );
}
