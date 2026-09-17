/* ─────────────────────────────────────────────
 * 레일 패널 간격 한 벌 (scr-00 · 2026-09-17)
 *
 * 절 = 머리 한 줄 + 상자 하나(+ 아래 스위치 한 줄). 좌우 여백은 platform_web 우측 패널과 같은 16px(px-4).
 * 상자 안 줄은 py-1.5, 상자끼리는 gap-2. 절 사이는 구분선 하나. 같은 값이 좌·우 레일에 두 벌 되지 않게 여기 한 곳이 든다
 * (2026-09-17 사용자 "간격이나 그룹핑이 잘 안 돼 보여").
 * ───────────────────────────────────────────── */

export const PANEL = {
  /** 세로로 쌓이는 절 묶음 */
  rail: "flex min-h-0 flex-1 flex-col divide-y divide-border overflow-y-auto overflow-x-hidden rounded-[inherit]",
  section: "flex shrink-0 flex-col gap-2 px-4 py-3",
  header: "flex items-baseline justify-between gap-2",
  title: "text-body font-semibold text-foreground",
  meta: "shrink-0 text-caption text-foreground-subtle",
  /** 값 상자 — 표 · 정의 목록 · 줄 목록이 다 이 상자 안이다 */
  box: "rounded-md border border-border bg-card px-3 py-1.5 text-caption",
  /** 상자 안 정의 목록 줄 */
  dl: "grid grid-cols-[auto_1fr] gap-x-3 py-0.5",
  /** 상자 안 목록 — 줄 사이 선 */
  list: "flex flex-col divide-y divide-border",
  row: "flex items-start justify-between gap-2 py-1.5",
  /** 상자 아래 스위치 한 줄 */
  switchRow: "flex cursor-pointer items-center justify-between gap-2 px-1 text-caption text-foreground-muted",
} as const;
