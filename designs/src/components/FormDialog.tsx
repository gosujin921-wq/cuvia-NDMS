/* ─────────────────────────────────────────────
 * FormDialog — 큰 창(조회·입력·정보)의 공통 틀
 *
 * TODO(ds): platform_web `features/sms-history/components/form-dialog.tsx` 와 같은 부품. DS 승격 대상.
 * ▸ 구조 정본: KISA `cuvia-kisa/designs/src/components/FormDialog.tsx` (design.md §22 — 큰 창은 FormDialog, 짧은 확인은 ConfirmDialog).
 *   같은 모양으로 짜고 부품만 `@ds` 로 쓴다.
 *
 *   창     유리 면 Modal · 어두운 반투명 막 + 약한 흐림 · 기본 너비 576px(sm:max-w-xl) · 화면 높이 안에서 몸통만 스크롤
 *   머리   아이콘(24px · primary-text) + 제목(h5) + 한 줄 설명(칩 등). 아래선 하나. 닫기 X 는 DS 가 우상단에 내장한다
 *   몸통   px-6 py-4 · 스크롤은 여기만
 *   바닥   윗선 하나 · 왼쪽 보조 동작 → 여백 → 오른쪽 주 동작. **바닥에 [닫기]를 두지 않는다** — X 와 같은 말이다
 *
 * 몸통 부품 셋: Section(묶음 제목) · ReadRow(읽기 전용 칸 — 라벨 위, 값 아래 회색 칸) · Group(두 칸 묶음 상자).
 * ───────────────────────────────────────────── */

import * as React from "react";
import { Icon } from "@iconify/react";
import { Button, Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle, cn } from "@ds";

interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** 너비·높이를 바꿀 때 — 예: 보고서 문서는 종이 폭 */
  contentClassName?: string;
  bodyClassName?: string;
}

function FormDialogRoot({ open, onClose, title, description, icon, children, footer, contentClassName, bodyClassName }: FormDialogProps) {
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <ModalContent
        variant="glass"
        overlayClassName="bg-black/55 backdrop-blur-xs"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn("w-full sm:max-w-xl", "max-h-[calc(100vh-3rem)]", "flex flex-col gap-0 overflow-hidden p-0", contentClassName)}
      >
        <ModalHeader className="flex shrink-0 flex-row items-start gap-3 border-b border-border px-6 pb-3 pt-5 pr-12">
          {icon && <Icon icon={icon} className="mt-0.5 size-6 shrink-0 text-primary-text" aria-hidden />}
          <div className="min-w-0 flex-1">
            <ModalTitle className="text-h5 text-foreground">{title}</ModalTitle>
            {description && <ModalDescription className="mt-1 text-caption">{description}</ModalDescription>}
          </div>
        </ModalHeader>

        <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-4", bodyClassName)}>{children}</div>

        {footer && <footer className="flex shrink-0 items-center gap-2 border-t border-border px-6 py-3">{footer}</footer>}
      </ModalContent>
    </Modal>
  );
}

type ButtonProps = React.ComponentProps<typeof Button>;

/** 주 동작 — 그라데이션 */
function PrimaryButton({ className, ...props }: ButtonProps) {
  return <Button variant="gradient" size="sm" {...props} className={cn("text-caption", className)} />;
}

/** 보조 동작 — 고스트 */
function CancelButton({ className, ...props }: ButtonProps) {
  return <Button variant="ghost" size="sm" {...props} className={cn("text-caption", className)} />;
}

/** 묶음 — 제목 한 줄 + 한 칸 또는 두 칸 */
function Section({ title, columns = "one", className, children }: { title: string; columns?: "one" | "two"; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("mb-5 last:mb-0", className)}>
      <h3 className="mb-3 text-caption font-semibold text-foreground">{title}</h3>
      <div className={cn(columns === "two" ? "grid grid-cols-2 gap-x-4 gap-y-3" : "flex flex-col gap-3")}>{children}</div>
    </section>
  );
}

/** 읽기 전용 칸 — 라벨이 위, 값은 편집칸보다 밝은 평면 회색 칸(input-readonly) */
function ReadRow({ label, value, sub, full, mono }: { label: string; value: React.ReactNode; sub?: string; full?: boolean; mono?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", full && "col-span-2")}>
      <span className="text-caption font-medium text-foreground-muted">{label}</span>
      <div className={cn("flex min-h-9 items-center rounded-md border border-border bg-input-readonly px-3 py-1.5 text-body text-foreground", mono && "font-mono tabular-nums")}>
        {value}
      </div>
      {sub && <span className="text-caption text-foreground-subtle">{sub}</span>}
    </div>
  );
}

/** 두 칸 묶음 상자 — 한 덩어리로 읽혀야 하는 값들(조건 축 등) */
function Group({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3 rounded-md border border-border bg-card p-3", className)}>{children}</div>;
}

type FormDialogComponent = typeof FormDialogRoot & {
  PrimaryButton: typeof PrimaryButton;
  CancelButton: typeof CancelButton;
  Section: typeof Section;
  ReadRow: typeof ReadRow;
  Group: typeof Group;
};

const FormDialog = FormDialogRoot as FormDialogComponent;
FormDialog.PrimaryButton = PrimaryButton;
FormDialog.CancelButton = CancelButton;
FormDialog.Section = Section;
FormDialog.ReadRow = ReadRow;
FormDialog.Group = Group;

export { FormDialog };
