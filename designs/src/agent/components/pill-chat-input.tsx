import { useEffect, useRef, type ChangeEvent } from "react";
import { useComposableInput } from "../hooks/use-composable-input";

/** 입력창 높이 — 한 줄에서 시작해 최대 4줄까지 늘어난다. */
const LINE_HEIGHT = 22;
const MAX_ROWS = 4;

/** 그라데이션 테두리 두께(px). */
const BORDER_WIDTH = 3;

/** 그라데이션 테두리 불투명도 — 1이면 브랜드색이 그대로 선명하게 나온다. */
const BORDER_OPACITY = 0.7;

export interface PillChatInputProps {
  value: string;
  onChange: (value: string) => void;
  /** 전송 — 조합 중 Enter 는 확정 후에 전달된다. */
  onSubmit: (text: string) => void;
  /** 입력창 위에 뜨는 프리셋 프롬프트 칩. 비우면 렌더 안 함. */
  presets?: string[];
  placeholder?: string;
  /** 스크린리더용 라벨. */
  inputLabel?: string;
  submitLabel?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * 알약형 입력창 — 브랜드 그라데이션 테두리.
 *
 * DS 의 `glass-edge-brand` 유틸은 1px 고정이라, 더 굵은 테두리가 필요해
 * 같은 mask 기법을 두께만 키워 직접 그린다(BORDER_WIDTH 로 조정).
 * 면 전체를 그라데이션으로 칠하면 안 된다 — 반투명한 glass-surface 가 그 위에
 * 겹쳐 입력창 안쪽 배경까지 브랜드색으로 물든다.
 *
 * 원본에는 테두리가 회전하는 애니메이션이 있었지만 @keyframes 가 필요해 뺐다.
 */
export function PillChatInput({
  value,
  onChange,
  onSubmit,
  presets,
  placeholder = "에이전트에게 명령을 입력하세요...",
  inputLabel = "에이전트 메시지 입력",
  submitLabel = "메시지 전송",
  disabled = false,
  className,
}: PillChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composable = useComposableInput(onSubmit);

  // 입력 길이에 맞춰 높이 조절 — scrollHeight 를 읽기 전 초기화해야 줄어들 수 있다.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, LINE_HEIGHT * MAX_ROWS)}px`;
  }, [value]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);
    // 조합 중 눌린 Enter 가 여기서 확정된다.
    composable.flushPendingEnter(next);
  };

  const handleSubmitClick = () => {
    const text = (textareaRef.current?.value ?? value).trim();
    if (text) onSubmit(text);
  };

  const canSubmit = Boolean(value.trim()) && !disabled;

  return (
    <div className={className}>
      {presets && presets.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onSubmit(preset)}
              disabled={disabled}
              className="glass-surface rounded-full px-3 py-1 text-caption text-foreground-muted transition-all hover:scale-[1.03] hover:text-foreground active:scale-95 disabled:opacity-50"
            >
              {preset}
            </button>
          ))}
        </div>
      )}

      {/* 오른쪽 여백은 py 와 같은 8px — 전송 버튼이 위아래와 같은 간격으로 앉는다.
          왼쪽은 텍스트가 시작하는 자리라 16px 유지. */}
      <div className="glass-surface flex w-full items-center gap-2 rounded-full py-2 pl-4 pr-2">
        {/* 그라데이션 테두리 — mask 로 가운데를 뚫어 링만 남긴다.
            면 전체를 칠하면 반투명 glass-surface 가 그 위에 겹쳐 안쪽까지 물든다.
            DS 의 glass-edge-brand 와 같은 기법이고 두께만 BORDER_WIDTH 로 키운 것. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background: "var(--gradient-brand)",
            opacity: BORDER_OPACITY,
            padding: BORDER_WIDTH,
            WebkitMask:
              "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            maskComposite: "exclude",
          }}
        />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onCompositionStart={composable.handleCompositionStart}
          onCompositionEnd={composable.handleCompositionEnd}
          onKeyDown={composable.handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          aria-label={inputLabel}
          className="text-body placeholder:text-foreground-subtle flex-1 resize-none overflow-hidden border-none bg-transparent text-foreground focus:outline-none"
          style={{ minHeight: LINE_HEIGHT, lineHeight: `${LINE_HEIGHT}px` }}
        />
        <button
          type="button"
          onClick={handleSubmitClick}
          disabled={!canSubmit}
          aria-label={submitLabel}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
          style={{ background: "var(--gradient-brand)" }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none h-4 w-4"
            aria-hidden="true"
          >
            <path d="M12 19V5" />
            <path d="M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
