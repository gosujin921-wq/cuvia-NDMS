/* ─────────────────────────────────────────────
 * 첫 줄 맞춤 — 아이콘·칩을 글의 첫 줄 가운데에 세운다 (scr-00 · 2026-09-17)
 *
 * 줄이 접히는 글 옆의 아이콘을 `self-center` 로 두면 두 줄 사이 허공에 뜬다. 부모를 `items-start` 로 두고
 * 아이콘을 한 줄 높이(`1lh`) 상자에 가운데 놓으면 글이 몇 줄이든 첫 줄에 맞는다(2026-09-17 사용자 "아이콘은 첫줄 기준으로 중심").
 * 모든 영역의 규칙이다 — 조치 이력 · 관련 SOP · 영향 객체 · 시나리오 칩.
 * ───────────────────────────────────────────── */

import type { ReactNode } from "react";
import { cn } from "@ds";

export function FirstLine({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("flex h-[1lh] shrink-0 items-center", className)}>{children}</span>;
}
