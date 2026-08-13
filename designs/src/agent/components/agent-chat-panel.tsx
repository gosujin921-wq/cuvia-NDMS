/* ─────────────────────────────────────────────
 * 이식본 — 원본: cuvia_platform_web/features/ai-agent/components/agent-chat-panel.tsx
 *
 * 원본과 다른 곳은 지도·살균 props 를 뺀 것뿐이다 (agent-message-list 주석).
 * ───────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { AgentMessageList } from "./agent-message-list";
import { AgentSymbol } from "./agent-symbol";
import { ChatInputForm } from "./chat-input-form";
import type { AgentMessage } from "../types";

/** 바닥에 붙어 있다고 볼 여유(px) — 이 안이면 새 글을 따라간다 */
const STICK_SLACK = 64;

export interface AgentChatPanelProps {
  open: boolean;
  onClose: () => void;
  messages: AgentMessage[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: (text: string) => void;
  isResponding?: boolean;
  onCancel?: () => void;
  agentName?: string;
  placeholder?: string;
  onActionSelect?: (query: string) => void;
  /** 답변의 바로가기 — 근거가 있는 화면으로 보낸다. */
  onNavigate?: (to: string) => void;
  /**
   * 대화가 비었을 때 첫 줄에 세우는 인사.
   *
   * 문안은 **밖에서 넣는다** — 이 폴더는 어느 앱에 붙는지 모른다(agent/index.ts).
   */
  greeting?: string;
  /** 대화가 비었을 때 고를 수 있는 질문. 누르면 그대로 보낸다. */
  suggestions?: string[];
  /** 화면 가장자리 여백(px). */
  inset?: number;
}

/**
 * 우측에서 슬라이드로 들어오는 대화 패널.
 *
 * 배치 주의: `backdrop-filter`(glass-surface)를 쓰므로 조상에 transform/filter 가
 * 걸려 있으면 블러가 깨진다. 또 부모가 `position: relative` 여야 하고, 스크롤되는
 * 컨테이너 안에 두면 같이 밀려 올라간다.
 */
/**
 * 빈 대화 — 인사 한 줄과 고를 수 있는 질문.
 *
 * 패널을 열었는데 아무것도 없으면 무엇을 물어야 할지 모른 채 커서만 깜빡인다. 답이 준비된
 * 질문을 **눌러서 고를 수 있게** 세워, 첫 질문의 문턱을 없앤다.
 *
 * 화면 하단 알약 입력창 위에 뜨던 칩과 같은 목록이다 — 같은 것을 두 벌 관리하지 않는다.
 */
function AgentGreeting({
  agentName,
  greeting,
  suggestions,
  onPick,
}: {
  agentName: string;
  greeting?: string;
  suggestions: string[];
  onPick: (text: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--gradient-brand)" }}
          aria-hidden
        >
          <AgentSymbol className="size-4 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold text-foreground">{agentName}</p>
          {greeting && (
            <p className="mt-1 whitespace-pre-line text-body text-foreground-muted">{greeting}</p>
          )}
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {suggestions.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => onPick(text)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-border-light bg-card px-3 py-2.5 text-left text-caption text-foreground transition-colors hover:border-foreground-subtle"
            >
              <Icon
                icon="mdi:star-four-points-outline"
                className="size-4 shrink-0 text-foreground-subtle"
                aria-hidden
              />
              <span className="min-w-0 flex-1">{text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AgentChatPanel({
  open,
  onClose,
  messages,
  inputValue,
  onInputChange,
  onSubmit,
  isResponding = false,
  onCancel,
  agentName = "CUVIA Agent",
  placeholder,
  onActionSelect,
  onNavigate,
  greeting,
  suggestions = [],
  inset = 20,
}: AgentChatPanelProps) {
  // 마운트 직후 한 프레임 뒤에 켜야 트랜지션이 발동한다(초기값에서 바로 최종값이면 안 움직임).
  const [entered, setEntered] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  // 새 메시지가 붙으면 바닥으로.
  /*
   * 새 글이 오면 맨 아래로 따라간다 — **다만 사용자가 위를 보고 있으면 가만둔다.**
   *
   * 답은 한 글자씩 흐르고, 글자마다 `messages` 가 바뀐다. 조건 없이 맨 아래로 끌어내리면
   * 답이 흐르는 몇 초 동안 위로 올릴 수가 없다 — 올리는 족족 도로 끌려 내려간다.
   * 그래서 **이미 바닥 근처에 있을 때만** 따라간다.
   */
  const stickToBottom = useRef(true);
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_SLACK;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, isResponding]);

  /* 새 물음을 보내면 어디를 보고 있었든 맨 아래로 데려간다 */
  useEffect(() => {
    if (messages[messages.length - 1]?.role === "user") stickToBottom.current = true;
  }, [messages]);

  if (!open) return null;

  return (
    <div
      className="absolute flex"
      style={{
        top: inset,
        right: inset,
        bottom: inset,
        zIndex: "var(--z-overlay)",
        transform: entered ? "translateX(0)" : "translateX(100%)",
        opacity: entered ? 1 : 0,
        transition:
          "transform var(--duration-slow) var(--ease-out), opacity var(--duration-slow) var(--ease-out)",
      }}
      onClick={(e) => e.stopPropagation()}
      role="complementary"
      aria-label={`${agentName} 대화`}
    >
      <div className="glass-surface glass-edge-lt flex w-[480px] shrink-0 flex-col overflow-hidden rounded-xl">
        {/* 스크롤된 메시지가 닫기 버튼 뒤로 자연스럽게 사라지게 하는 페이드. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-12 rounded-t-xl backdrop-blur-[4px]"
          style={{
            background:
              "linear-gradient(to bottom, var(--color-background) 0%, transparent 100%)",
            opacity: 0.25,
            maskImage:
              "linear-gradient(to bottom, black 0%, black 40%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 0%, black 40%, transparent 100%)",
          }}
        />

        <div className="absolute top-3 right-3 z-10">
          <button
            type="button"
            onClick={onClose}
            aria-label="대화 닫기"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground focus:outline-none"
          >
            <Icon icon="mdi:close" className="h-5 w-5" />
          </button>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="min-h-0 min-w-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto p-4 pt-12"
        >
          {messages.length === 0 && (greeting || suggestions.length > 0) ? (
            <AgentGreeting
              agentName={agentName}
              greeting={greeting}
              suggestions={suggestions}
              onPick={onSubmit}
            />
          ) : (
            <AgentMessageList
              messages={messages}
              isResponding={isResponding}
              agentName={agentName}
              onActionSelect={onActionSelect}
              onNavigate={onNavigate}
            />
          )}
          <div className="h-2" />
        </div>

        <ChatInputForm
          value={inputValue}
          onChange={onInputChange}
          onSubmit={onSubmit}
          isResponding={isResponding}
          onCancel={onCancel}
          placeholder={placeholder}
          agentName={agentName}
        />
      </div>
    </div>
  );
}
