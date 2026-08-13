/* ─────────────────────────────────────────────
 * 이식본 — 원본: cuvia_platform_web/features/ai-agent/components/agent-overlay.tsx
 *
 * 원본과 다른 곳은 한 군데다. 원본은 `useAgentChat()`(SSE 스트림 + 전역 스토어)을
 * 안에서 부르지만, 여기서는 **대화 상태를 전부 props 로 받는다.**
 *
 * 이 폴더는 데모를 모른다 — 답변을 누가 어떻게 만드는지 여기서는 알 필요가 없다.
 * 폴더째 복사해 다른 앱에 두고 그 앱의 대화 소스를 물리면 그대로 돈다.
 * ───────────────────────────────────────────── */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { AgentChatPanel } from "./agent-chat-panel";
import { AgentFab } from "./agent-fab";
import { PillChatInput } from "./pill-chat-input";
import type { AgentMessage } from "../types";

/**
 * 알약형 입력창이 들어갈 자리의 DOM id — 호스트 화면과의 유일한 접점.
 *
 * 화면마다 하단 요소(범례·미리보기 패널)의 위치가 달라 전역 오버레이에서 px 로
 * 맞추면 계속 어긋난다. 그래서 자리를 원하는 화면이 이 id 를 가진 빈 div 를 두고,
 * 여기서 포털로 그려 넣는다 — 양쪽이 서로를 import 하지 않으므로 결합도 없고
 * 어느 쪽을 꺼도 나머지가 멀쩡히 동작한다.
 */
export const PILL_SLOT_ID = "agent-pill-slot";

/** FAB 이 화면 우하단 모서리에서 떨어지는 거리(px). */
const FAB_INSET = { bottom: 40, right: 40 };

export interface AgentOverlayProps {
  /** 패널이 열려 있나. */
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  messages: AgentMessage[];
  /** 답이 오는 중 — 전송 버튼이 취소 버튼이 된다. */
  isResponding?: boolean;
  onCancel?: () => void;
  /** 질의 전송. 칩·알약·패널 입력창이 모두 이 하나로 들어온다. */
  onSubmit: (text: string) => void;
  /** 답변의 바로가기 — 근거가 있는 화면으로 보낸다. */
  onNavigate?: (to: string) => void;
  agentName?: string;
  tooltip?: string;
  /**
   * 대화가 비었을 때 패널 첫 줄에 세우는 인사. 문안은 밖에서 넣는다.
   */
  greeting?: string;
  /**
   * 대화가 비었을 때 고를 수 있는 질문. 비우면 인사만 서고, 인사도 없으면 빈 채로 연다.
   *
   * 알약 칩(`pillPresets`)과 따로 받는다 — 화면마다 무엇을 물을 수 있는지가 다르기 때문이다.
   */
  suggestions?: string[];
  /** 알약 입력창 위에 뜨는 프리셋 프롬프트. */
  pillPresets?: string[];
  pillPlaceholder?: string;
  /** 알약 입력창 폭(px). 자리를 내준 화면의 폭보다 좁게 잡는다. */
  pillWidth?: number;
}

/**
 * 전역 에이전트 오버레이 — 어느 화면에서든 우하단 FAB, 누르면 우측 패널.
 * 호스트 화면이 `#agent-pill-slot` 을 두면 그 자리에 알약형 입력창도 띄운다.
 */
export function AgentOverlay({
  open,
  onOpen,
  onClose,
  messages,
  isResponding = false,
  onCancel,
  onSubmit,
  onNavigate,
  agentName = "CUVIA Agent",
  tooltip = "CUVIA Agent 열기",
  greeting,
  suggestions,
  pillPresets,
  pillPlaceholder,
  pillWidth = 680,
}: AgentOverlayProps) {
  const [input, setInput] = useState("");
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const { pathname } = useLocation();

  // 화면이 바뀌면 자리가 생기거나 사라진다 → 라우트 전환 후 다시 찾는다.
  // (effect 는 새 화면이 DOM 에 반영된 뒤 실행되므로 이 시점엔 자리가 있다.)
  useEffect(() => {
    setSlot(document.getElementById(PILL_SLOT_ID));
  }, [pathname]);

  // 패널이 열리면 대화는 패널 입력창으로 넘어간다 → 알약은 숨긴다.
  const showPill = Boolean(slot) && !open;

  const handleSubmit = (text: string) => {
    onSubmit(text);
    setInput("");
  };

  /** 알약에서 보내면 그대로 패널이 열리며 대화가 이어진다. */
  const handlePillSubmit = (text: string) => {
    handleSubmit(text);
    onOpen();
  };

  const handleClose = () => {
    setInput("");
    onClose();
  };

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="pointer-events-auto contents">
        {showPill &&
          slot &&
          createPortal(
            <div style={{ width: pillWidth, maxWidth: "100%" }}>
              <PillChatInput
                value={input}
                onChange={setInput}
                onSubmit={handlePillSubmit}
                presets={pillPresets}
                placeholder={pillPlaceholder}
                disabled={isResponding}
              />
            </div>,
            slot,
          )}

        <AgentChatPanel
          open={open}
          onClose={handleClose}
          messages={messages}
          inputValue={input}
          onInputChange={setInput}
          onSubmit={handleSubmit}
          isResponding={isResponding}
          onCancel={onCancel}
          onActionSelect={handleSubmit}
          onNavigate={onNavigate}
          agentName={agentName}
          greeting={greeting}
          suggestions={suggestions}
        />

        {/* 알약이 떠 있는 화면에서는 FAB 을 숨긴다 — 같은 일을 하는 진입점이
            둘이면 화면만 어지럽다. */}
        <AgentFab
          onClick={onOpen}
          hidden={open || showPill}
          tooltip={tooltip}
          bottom={FAB_INSET.bottom}
          right={FAB_INSET.right}
        />
      </div>
    </div>
  );
}
