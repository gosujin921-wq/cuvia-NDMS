/* ─────────────────────────────────────────────
 * 자연어 질의 바 — 배경: docs/레거시/정본/03_화면정의서.md §1 · 04 §14
 *
 * 담당자가 화면을 뒤지는 대신 말로 묻는 자리. 지도 하단 중앙에 선다.
 * 입력 바 본체(자동 확장 textarea · IME 처리 · 캡슐 크롬 · 칩·버튼 인터랙션)는
 * IDC SCR-01 AgentBar 원본을 그대로 따른다.
 *
 * IDC 와 의도적으로 다른 것 둘뿐이다:
 *   · 칩·질의는 검색 상태가 아니라 `/scr-06?q={질의 ID}` URL 로 넘긴다 (04 §14)
 *   · 질의 칩은 포커스가 있을 때만 위로 열린다 — 이 화면의 조연이라서다 (03 §1)
 *
 * 브랜드 글로우(`agent-glow`)는 IDC 와 같이 얹는다. CUVIA 질의 바의 정체성이라
 * 화면마다 켜고 끄지 않는다 (03 §1).
 *
 * URL 에는 질의 문장이 아니라 ID 를 싣는다 (`?q=seohang-cause`). 문안이 바뀌어도 링크가
 * 따라오게 하려는 것이다. 못 알아들은 문장만 `?ask=` 로 원문을 넘긴다 — 답변 화면이
 * "이렇게 물으셨는데 답할 수 없다"고 말하려면 물은 문장이 필요하다.
 *
 * 한글 입력: IME 조합 중 Enter 는 조합 확정용이라 그대로 전송하면 마지막 글자가 잘린다.
 * 조합 중이면 전송을 보류했다가 조합이 끝난 뒤 보낸다.
 * ───────────────────────────────────────────── */

import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { cn } from "@ds";
import { CANNED_QUERIES, matchQuery } from "../../../demo/ai";

/* 입력 줄 높이·최대 줄 수 — IDC 원본 값. Shift+Enter 줄바꿈으로 4줄까지 늘어난다 */
const LINE_HEIGHT = 22;
const MAX_LINES = 4;

export function AgentBar() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposing = useRef(false);
  const pendingEnter = useRef(false);

  /* 입력 줄 수에 맞춰 높이를 늘린다. 4줄까지 (IDC 원본) */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, LINE_HEIGHT * MAX_LINES)}px`;
  }, [value]);

  /** 준비된 질의에 붙으면 그 질의로, 안 붙으면 물은 문장을 그대로 들려 보낸다 (04 §14-5) */
  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setValue("");
    const matched = matchQuery(trimmed);
    navigate(matched ? `/scr-06?q=${matched.id}` : `/scr-06?ask=${encodeURIComponent(trimmed)}`);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    if (isComposing.current) {
      pendingEnter.current = true;
      return;
    }
    send(e.currentTarget.value);
  };

  /* 포커스가 칩으로 옮겨가는 것은 이탈이 아니다. 컨테이너 밖으로 나갈 때만 접는다 */
  const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  };

  return (
    <div
      className="relative flex w-full flex-col items-center"
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
    >
      {/* 질의 칩은 포커스 시에만 입력 바 위로 열린다(03 §1). 누르면 타이핑 없이 그 질의의
          답으로 간다. pointerdown 으로 여는 이유: click 은 blur 뒤라 칩이 먼저 접힌다.
          바에서 한 칸 띄워 얹는다 — 글로우 테두리에 붙으면 칩이 바의 일부로 읽힌다.

          칩은 지도 위에 뜬 UI 다 — 지구 이름표(03 §0-5)와 같은 유리 알약 모양이라
          맞붙으면 지도의 일부로 읽힌다. 그림자로 지도에서 떼고 z 를 명시해 지도 레이어
          (마커 · 바람 격자 캔버스)보다 확실히 위에 세운다 */}
      {focused && (
        <ul className="absolute bottom-full left-0 right-0 z-40 mb-4 flex flex-wrap justify-center gap-1.5">
          {CANNED_QUERIES.map((query) => (
            <li key={query.id}>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  navigate(`/scr-06?q=${query.id}`);
                }}
                className={cn(
                  "cursor-pointer rounded-full border border-border bg-card px-3 py-1 text-caption",
                  "text-foreground-muted shadow-lg backdrop-blur-sm transition-all",
                  "hover:scale-[1.03] hover:text-foreground active:scale-95",
                )}
              >
                {query.text}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        className={cn(
          "agent-glow flex w-full items-center gap-2 rounded-full px-4 py-2",
          "border border-border bg-card/85 shadow-lg backdrop-blur-md",
        )}
      >
        <Icon
          icon="mdi:creation-outline"
          className="size-4 shrink-0 text-foreground-muted"
          aria-hidden
        />
        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          onChange={(e) => {
            const next = e.target.value;
            setValue(next);
            /* 조합이 끝나며 들어온 변경이면, 보류해 둔 Enter 를 여기서 흘려 보낸다 */
            if (pendingEnter.current && !isComposing.current) {
              pendingEnter.current = false;
              send(next);
            }
          }}
          onCompositionStart={() => {
            isComposing.current = true;
          }}
          onCompositionEnd={(e) => {
            isComposing.current = false;
            const next = e.currentTarget.value;
            setValue(next);
            if (pendingEnter.current) {
              pendingEnter.current = false;
              send(next);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="상황을 물어보세요"
          aria-label="자연어 질의"
          className={cn(
            "min-w-0 flex-1 resize-none border-none bg-transparent text-body text-foreground outline-none",
            "placeholder:text-foreground-subtle",
          )}
          style={{
            minHeight: LINE_HEIGHT,
            maxHeight: LINE_HEIGHT * MAX_LINES,
            lineHeight: `${LINE_HEIGHT}px`,
          }}
        />
        <button
          type="button"
          onClick={() => send(value)}
          disabled={!value.trim()}
          aria-label="질의 전송"
          className={cn(
            "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none",
            "transition-all hover:scale-105 active:scale-95",
            "disabled:cursor-not-allowed disabled:opacity-30",
          )}
          style={{ background: "var(--gradient-brand)" }}
        >
          <Icon icon="mdi:arrow-up" className="size-4 text-white" aria-hidden />
        </button>
      </div>
    </div>
  );
}
