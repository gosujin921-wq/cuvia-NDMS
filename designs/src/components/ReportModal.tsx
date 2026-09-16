/* ─────────────────────────────────────────────
 * 보고서 모달 — 문서를 자리에서 띄운다 (2026-09-15 사용자)
 *
 * 창 틀은 정보 창과 같은 FormDialog 다(KISA design.md §22 — 큰 창은 FormDialog). 너비만 종이 폭(794px)에 여백을 더해 넓힌다.
 * 문서 자체는 화면과 무관한 인쇄 양식이라 `ReportDocument` 한 벌을 그대로 쓴다.
 * 바닥은 왼쪽 [보고서 화면](전체 화면으로 열기) · 오른쪽 [인쇄]. [닫기]는 없다(X 가 있다).
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { FormDialog } from "./FormDialog";
import { ReportDocument, type ReportDocumentProps } from "./ReportDocument";

export function ReportModal({ open, onOpenChange, doc, kindLabel = "보고서", onOpenFull }: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  doc: ReportDocumentProps | null;
  /** 머리 칩 — "모의훈련 분석 보고서" */
  kindLabel?: string;
  /** 전체 화면 보고서로 — 없으면 버튼을 세우지 않는다 */
  onOpenFull?: () => void;
}) {
  if (!doc) return null;
  return (
    <FormDialog
      open={open}
      onClose={() => onOpenChange(false)}
      icon="mdi:file-document-outline"
      title={doc.report.title}
      description={
        <span className="inline-flex items-center rounded border border-border bg-surface-raised px-1.5 py-0.5 text-caption font-medium text-foreground-muted">
          {kindLabel}
        </span>
      }
      /* 종이 너비(794) + 좌우 여백. 문서를 줄여 보여 주면 양식이 깨진다 — sm:max-w 를 덮어야 한다 */
      contentClassName="w-[860px] max-w-[calc(100vw-2rem)] sm:max-w-[860px] max-h-[92vh]"
      bodyClassName="px-4 py-4"
      footer={
        <>
          {onOpenFull && (
            <FormDialog.CancelButton onClick={onOpenFull}>
              <Icon icon="mdi:open-in-new" className="size-4 shrink-0" aria-hidden />
              보고서 화면
            </FormDialog.CancelButton>
          )}
          <div className="flex-1" aria-hidden />
          <FormDialog.PrimaryButton onClick={() => window.print()}>
            <Icon icon="mdi:printer-outline" className="size-4 shrink-0" aria-hidden />
            인쇄
          </FormDialog.PrimaryButton>
        </>
      }
    >
      <ReportDocument {...doc} />
    </FormDialog>
  );
}
