/* ─────────────────────────────────────────────
 * 시뮬레이션 보고서 창 — /scr-00 에서 본 장면을 문서 한 장으로 (2026-09-17)
 *
 * 이력의 보고서 전체 화면과 같은 문서 렌더러(ReportDocument)를 쓴다. 창은 문서를 담는 틀일 뿐이다 —
 * 머리에 인쇄 · 이력으로 보내기, 몸통에 종이.
 * ───────────────────────────────────────────── */

import { useMemo } from "react";
import { Icon } from "@iconify/react";
import { FormDialog } from "../../../components/FormDialog";
import { ReportDocument } from "../../../components/ReportDocument";
import { simDocOf, type SimReportInput } from "../../../lib/sim-report";

export function SimReportDialog({ input, onClose }: { input: SimReportInput; onClose: () => void }) {
  /* 번호는 대상 · 시각 · 시나리오로 — 같은 장면은 같은 번호다 */
  const docNo = `SIM-${input.at.slice(0, 10).replace(/-/g, "")}-${input.selected.tag}`;
  const doc = useMemo(() => simDocOf(input, docNo), [input, docNo]);
  return (
    <FormDialog
      open
      onClose={onClose}
      icon="mdi:file-document-outline"
      title={doc.report.title}
      description={<span className="text-foreground-muted">화면에서 본 조건과 결과를 그대로 옮긴 문서입니다</span>}
      contentClassName="w-[900px] max-w-[calc(100vw-2rem)] sm:max-w-[900px] h-[92vh]"
      bodyClassName="flex flex-col px-0 py-0"
      footer={
        <>
          <div className="flex-1" aria-hidden />
          <FormDialog.CancelButton onClick={() => window.print()}>
            <Icon icon="mdi:printer-outline" className="size-4 shrink-0" aria-hidden />
            인쇄
          </FormDialog.CancelButton>
        </>
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ReportDocument {...doc} />
      </div>
    </FormDialog>
  );
}
