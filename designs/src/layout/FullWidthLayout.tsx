/* ─────────────────────────────────────────────
 * FullWidthLayout — 목록·게시판형 화면 공통 골격
 *
 * CUVIA 관제 앱 공통 레이어. 자식은 GlassPanel 등 패널 컴포넌트를 놓는다.
 *   Root   : w-full h-full flex flex-col overflow-hidden
 *   Header : shrink-0 border-b (선택)
 *   Body   : flex-1 min-h-0. 내부 padding 은 호출 측 bodyClassName 으로
 *   Footer : shrink-0 border-t (선택)
 *
 * AppLayout 의 main 에는 padding 이 없으므로 여백은 bodyClassName 으로 준다.
 *
 * ▸ 제품 정본: cuvia_platform_web packages/ui/src/full-width-layout.tsx
 *   (@cuvia/ui FullWidthLayout) — 이 앱은 그 워크스페이스 밖이라 로컬에 다시 세웠다.
 *   props 이름(header/footer/bodyClassName)을 정본과 맞춰 두었으니 그대로 갈아끼울 수 있다.
 * ───────────────────────────────────────────── */

import type { ReactNode } from "react";
import { cn } from "@ds";

interface FullWidthLayoutProps {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function FullWidthLayout({
  header,
  footer,
  children,
  className,
  bodyClassName,
}: FullWidthLayoutProps) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden bg-background text-foreground",
        className,
      )}
    >
      {header && <header className="shrink-0 border-b border-border bg-surface">{header}</header>}
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
      {footer && <footer className="shrink-0 border-t border-border bg-surface">{footer}</footer>}
    </div>
  );
}
