import { AgentSymbol } from "./agent-symbol";

export interface AgentFabProps {
  onClick: () => void;
  /** 왼쪽 hover 툴팁 문구 = 접근성 라벨. */
  tooltip?: string;
  /** 패널이 열려 있을 때처럼 잠시 숨길 때. */
  hidden?: boolean;
  bottom?: number;
  right?: number;
}

/**
 * 우하단 원형 실행 버튼.
 *
 * `absolute` 라 부모가 `position: relative` 여야 하고, 스크롤 컨테이너 안에 두면
 * 본문과 같이 밀린다 — 셸 레벨에 두거나 페이지 루트를 relative 로 잡을 것.
 */
export function AgentFab({
  onClick,
  tooltip = "CUVIA Agent 열기",
  hidden = false,
  bottom = 24,
  right = 24,
}: AgentFabProps) {
  return (
    <div
      className="group absolute"
      style={{
        bottom,
        right,
        zIndex: "var(--z-overlay)",
        opacity: hidden ? 0 : 1,
        visibility: hidden ? "hidden" : "visible",
        /* 자리(bottom·right)는 전환하지 않는다. 이 버튼은 셸에 한 번만 붙어 화면을 옮겨도 살아남고,
           자리는 화면 성격(레일·도크)에 따라 호스트가 바꿔 준다(lib/layout.ts FAB_SLOT_*). 여기에
           transition 을 걸면 라우트가 바뀔 때마다 이전 자리에서 새 자리로 미끄러져 가 화면을 따라다니는
           것처럼 보인다 — 새 화면에서는 처음부터 제자리에 서 있어야 한다. 페이드만 남긴다 (2026-09-15) */
        transition: "opacity var(--duration-base) var(--ease-out)",
      }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={tooltip}
        className="flex h-14 w-14 items-center justify-center rounded-full text-white transition-transform duration-300 hover:scale-105"
        style={{
          background: "var(--gradient-brand)",
          boxShadow: "var(--shadow-md), var(--glow-primary)",
        }}
      >
        <AgentSymbol className="h-6 w-6" />
      </button>

      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-full mr-3 -translate-y-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-caption whitespace-nowrap text-foreground opacity-0 transition-opacity group-hover:opacity-100"
      >
        {tooltip}
        <div className="absolute top-1/2 left-full -translate-y-1/2 border-4 border-transparent border-l-[var(--color-surface)]" />
      </div>
    </div>
  );
}
