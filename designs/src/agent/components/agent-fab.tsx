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
        transition:
          "bottom var(--duration-slow) var(--ease-in-out), right var(--duration-slow) var(--ease-in-out), opacity var(--duration-base) var(--ease-out)",
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
