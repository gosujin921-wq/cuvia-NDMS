/* ─────────────────────────────────────────────
 * 게시판 틀 — 안쪽 카드 · 툴바 · 표 자리 (platform_web `features/sms-history/` 문법)
 *
 * 게시판은 모양이 한 벌이다. 화면은 칩 필터·검색어·표 칸만 넘기고 틀은 여기서 받는다.
 *     안쪽 카드   rounded-md border border-border bg-card overflow-hidden 로 툴바와 표를 한 덩어리로 감싼다
 *     툴바        칩 필터 → 세로 구분선 → [초기화] → ml-auto 검색 → 동작 버튼
 *     구분선      h-5 w-px bg-border mx-1 opacity-60
 *     검색        오른쪽 끝 고정폭 + 돋보기 아이콘을 안쪽에 절대배치, 입력은 pl-9 text-caption
 *     표          DS DataTable 은 화면이 children 으로 넣는다. 외형은 DataTable 기본값 그대로 둔다
 *
 * 툴바만 따로 쓰는 자리도 있다 — 통계(scr-04)는 표 대신 지표·그래프가 서지만 조회 조건은 이력 게시판과 같은
 * 칩 한 줄이라 BoardToolbar 를 카드에 얹어 쓴다.
 *
 * 저장된 분석(scr-05 SavedAnalysisBoard)과 디지털트윈 사건(scr-05 IncidentBoard)이 아직 이 틀을 손으로 적는다.
 * 그 둘도 이 틀로 옮길 대상이다.
 *
 * TODO(ds): platform_web features/sms-history 의 목록 틀과 같은 부품. DS 승격 대상
 * ───────────────────────────────────────────── */

import type { ReactNode } from "react";
import { Icon } from "@iconify/react";
import { Button, Input, cn } from "@ds";

export interface BoardToolbarProps {
  /** 칩 필터 묶음 — ChipFilter 들 */
  filters?: ReactNode;
  /** 있으면 구분선과 [초기화]를 세운다 */
  onReset?: () => void;
  resetDisabled?: boolean;
  search?: { value: string; onChange: (next: string) => void; placeholder: string; label: string };
  /** 검색 오른쪽 — [새 분석] 같은 것. 검색이 없으면 ml-auto 는 넘기는 쪽이 준다 */
  actions?: ReactNode;
}

export function BoardToolbar({ filters, onReset, resetDisabled, search, actions, className }: BoardToolbarProps & { className?: string }) {
  return (
    <div className={cn("flex shrink-0 flex-wrap items-center gap-2 px-4 pb-2 pt-3", className)}>
      {filters}
      {onReset && (
        <>
          <div className="mx-1 h-5 w-px bg-border opacity-60" aria-hidden />
          <Button
            type="button" variant="ghost" size="sm" onClick={onReset} disabled={resetDisabled}
            aria-label="필터 초기화" className="text-caption text-foreground-muted hover:text-foreground"
          >
            <Icon icon="mdi:refresh" className="size-4 shrink-0" aria-hidden />
            <span>초기화</span>
          </Button>
        </>
      )}
      {search && (
        <div className="relative ml-auto w-[260px]">
          <Icon icon="mdi:magnify" className="pointer-events-none absolute left-3 top-1/2 size-4 shrink-0 -translate-y-1/2 text-foreground-subtle" aria-hidden />
          <Input
            value={search.value} onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder} className="pl-9 text-caption" aria-label={search.label}
          />
        </div>
      )}
      {actions}
    </div>
  );
}

export function BoardFrame({ children, ...toolbar }: BoardToolbarProps & {
  /** 본문 — 보통 DS DataTable */
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border bg-card">
        <BoardToolbar {...toolbar} />

        {/* 표 — 페이지 번호 묶음은 가운데(2026-09-15 사용자). DataTable 이 안쪽 PaginationBar 에 정렬을 넘기지 않아
            감싸는 쪽에서 번호 묶음(바의 마지막 자식)만 가운데로 옮긴다. 개수 셀렉트·총 건수는 왼쪽에 남는다.
            TODO(ds): DataTable → PaginationBar 로 `paginationAlign` 을 넘기는 옵션. DS 승격 대상 */}
        <div
          className={[
            "min-h-0 flex-1 px-4 pb-3 pt-0",
            "[&_[data-slot=pagination-bar]]:relative",
            "[&_[data-slot=pagination-bar]>div:last-child]:absolute",
            "[&_[data-slot=pagination-bar]>div:last-child]:left-1/2",
            "[&_[data-slot=pagination-bar]>div:last-child]:-translate-x-1/2",
          ].join(" ")}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
