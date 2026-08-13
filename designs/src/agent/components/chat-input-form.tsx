import { useEffect, useRef, type ChangeEvent } from "react";
import { Icon } from "@iconify/react";
import { AgentSymbol } from "./agent-symbol";
import { useComposableInput } from "../hooks/use-composable-input";

const LINE_HEIGHT = 24;
const MAX_ROWS = 3;

export interface ChatInputFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string) => void;
  /** 응답 중이면 전송 버튼이 취소 버튼으로 바뀐다. */
  isResponding?: boolean;
  onCancel?: () => void;
  placeholder?: string;
  /** 하단 고지 문구의 주체 이름. */
  agentName?: string;
  disclaimer?: string;
}

/** 패널 하단 입력폼. */
export function ChatInputForm({
  value,
  onChange,
  onSubmit,
  isResponding = false,
  onCancel,
  placeholder = "검색 조건을 자연어로 입력해 주세요.",
  agentName = "CUVIA Agent",
  disclaimer = "는 실수를 할 수 있습니다. 중요한 정보는 재차 확인하세요.",
}: ChatInputFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composable = useComposableInput(onSubmit);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, LINE_HEIGHT * MAX_ROWS)}px`;
  }, [value]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);
    composable.flushPendingEnter(next);
  };

  const handleSubmitClick = () => {
    const text = (textareaRef.current?.value ?? value).trim();
    if (text) onSubmit(text);
  };

  return (
    <div className="shrink-0 border-t border-border p-4">
      <div className="flex items-center gap-3 rounded-xl border border-border-light bg-surface-raised px-4 py-3 transition-colors focus-within:border-primary">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onCompositionStart={composable.handleCompositionStart}
          onCompositionEnd={composable.handleCompositionEnd}
          onKeyDown={composable.handleKeyDown}
          placeholder={placeholder}
          rows={1}
          aria-label={placeholder}
          className="text-body placeholder:text-foreground-subtle min-w-0 flex-1 resize-none overflow-y-auto border-none bg-transparent text-foreground focus:outline-none"
          style={{ minHeight: LINE_HEIGHT, lineHeight: `${LINE_HEIGHT}px` }}
        />
        {isResponding ? (
          <button
            type="button"
            onClick={onCancel}
            aria-label="답변 취소"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-all hover:scale-105 active:scale-95"
            style={{ background: "var(--gradient-brand)" }}
          >
            <Icon icon="mdi:close" className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmitClick}
            disabled={!value.trim()}
            aria-label="전송"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "var(--gradient-brand)" }}
          >
            <AgentSymbol className="h-5 w-5" />
          </button>
        )}
      </div>
      <p className="mt-2 text-center text-badge text-foreground-subtle">
        <span className="font-semibold text-foreground-muted">{agentName}</span>
        {disclaimer}
      </p>
    </div>
  );
}
