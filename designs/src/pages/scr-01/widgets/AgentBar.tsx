/* ─────────────────────────────────────────────
 * 자연어 질의 바 — 정본: docs/정본/03_화면정의서.md §1 · 04 §14
 *
 * 담당자가 화면을 뒤지는 대신 말로 묻는 자리. 지도 하단 중앙에 선다.
 *
 * 질의 칩을 입력 바 위에 상시 노출한다. 시연 중 타이핑 없이 답변 화면으로 넘어가려는
 * 것이고, 이 데모가 무엇을 물어볼 수 있는 시스템인지 묻기 전에 보이려는 것이다.
 *
 * URL 에는 질의 문장이 아니라 ID 를 싣는다 (`?q=seohang-cause`). 문안이 바뀌어도 링크가
 * 따라오게 하려는 것이다. 못 알아들은 문장만 `?ask=` 로 원문을 넘긴다 — 답변 화면이
 * "이렇게 물으셨는데 답할 수 없다"고 말하려면 물은 문장이 필요하다.
 *
 * 한글 입력: IME 조합 중 Enter 는 조합 확정용이라 그대로 전송하면 마지막 글자가 잘린다.
 * 조합 중이면 전송을 보류했다가 조합이 끝난 뒤 보낸다.
 * ───────────────────────────────────────────── */

import { useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { cn } from "@ds";
import { CANNED_QUERIES, matchQuery } from "../../../demo/ai";

export function AgentBar() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const isComposing = useRef(false);
  const pendingEnter = useRef(false);

  /** 준비된 질의에 붙으면 그 질의로, 안 붙으면 물은 문장을 그대로 들려 보낸다 (04 §14-5) */
  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setValue("");
    const matched = matchQuery(trimmed);
    navigate(matched ? `/scr-06?q=${matched.id}` : `/scr-06?ask=${encodeURIComponent(trimmed)}`);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (isComposing.current) {
      pendingEnter.current = true;
      return;
    }
    send(e.currentTarget.value);
  };

  return (
    <div className="flex w-full flex-col items-center gap-2">
      {/* 질의 칩 — 누르면 타이핑 없이 그 질의의 답으로 간다 */}
      <ul className="flex flex-wrap justify-center gap-1.5">
        {CANNED_QUERIES.map((query) => (
          <li key={query.id}>
            <button
              type="button"
              onClick={() => navigate(`/scr-06?q=${query.id}`)}
              className={cn(
                "cursor-pointer rounded-full border border-border bg-card px-3 py-1 text-caption",
                "text-foreground-muted backdrop-blur-sm transition-colors",
                "hover:border-foreground-subtle hover:text-foreground",
              )}
            >
              {query.text}
            </button>
          </li>
        ))}
      </ul>

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
        <input
          value={value}
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
            "min-w-0 flex-1 border-none bg-transparent text-body text-foreground outline-none",
            "placeholder:text-foreground-subtle",
          )}
        />
        <button
          type="button"
          onClick={() => send(value)}
          disabled={!value.trim()}
          aria-label="질의 전송"
          className={cn(
            "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-none",
            "transition-opacity hover:opacity-85",
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
