/* ─────────────────────────────────────────────
 * 이식본 — 원본: cuvia_platform_web/features/ai-agent/components/agent-message-list.tsx
 *
 * 원본과 다른 곳은 셋뿐이다.
 *   · 지도 카드(AgentMapCard)를 뺐다 — 답변에서 지도를 띄우지 않고 SCR-05 로 보낸다
 *   · 조건 칩·선택 모달(CtaActionButtons)을 뺐다 — 데모 질의는 3종 고정이라 좁힐 조건이 없다.
 *     바로가기 버튼 한 줄로 대신한다
 *   · **서버 HTML 을 렌더하지 않는다** — 본문을 평문으로 그린다. 원본은 서버가 내려주는
 *     HTML 을 살균해 뿌리지만, 여기서는 답변 문안을 우리가 직접 쓰므로 살균할 대상이 없다.
 *     `dangerouslySetInnerHTML` 을 아예 두지 않아, 나중에 누가 살균기 없이 HTML 을
 *     끼워 넣는 길을 막는다
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { AgentChart } from "./agent-chart";
import { AgentDataTable } from "./agent-data-table";
import type { AgentAction, AgentMessage } from "../types";

export interface AgentMessageListProps {
  messages: AgentMessage[];
  /** 답변 생성 중 — 리스트 맨 아래 타이핑 인디케이터를 띄운다. */
  isResponding?: boolean;
  agentName?: string;
  /** `send_query` 액션 — 그 문장을 다시 묻는다. */
  onActionSelect?: (query: string) => void;
  /** `ui_control` + effect `navigate` 액션 — 근거가 있는 화면으로 보낸다. */
  onNavigate?: (to: string) => void;
}

/** 어시스턴트 버블 공통 껍데기. */
function AssistantBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border-light bg-surface-raised p-4 text-foreground">
      {children}
    </div>
  );
}

function TypingCursor() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-foreground-muted align-middle"
    />
  );
}

/** 진행률 버블 — 단계 표시 + 브랜드 그라데이션 바. */
function AnalyzingBubble({ message }: { message: AgentMessage }) {
  const percent = Math.round((message.progress ?? 0) * 100);
  return (
    <AssistantBubble>
      {message.content && (
        <div className="mb-3">
          <h3 className="mb-2 text-caption font-semibold text-foreground">분석 중</h3>
          <p className="text-caption leading-relaxed text-foreground-muted">{message.content}</p>
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-fill-subtle"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${percent}%`, background: "var(--gradient-brand)" }}
        />
      </div>
      {message.totalSteps != null && (
        <div className="mt-2 text-badge text-foreground-subtle">
          {message.currentStep ?? 0}/{message.totalSteps}
        </div>
      )}
    </AssistantBubble>
  );
}

/** 답변 꼬리의 버튼 줄 — 다시 묻기(`send_query`) 와 화면 이동(`ui_control`). */
function ActionButtons({
  actions,
  onActionSelect,
  onNavigate,
}: {
  actions: AgentAction[];
  onActionSelect?: (query: string) => void;
  onNavigate?: (to: string) => void;
}) {
  const run = (action: AgentAction) => {
    if (action.action === "send_query" && action.query) {
      onActionSelect?.(action.query);
      return;
    }
    if (action.action === "ui_control" && action.payload?.target) {
      onNavigate?.(action.payload.target);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-1.5">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() => run(action)}
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-border-light bg-card px-3 py-2 text-left text-caption text-foreground transition-colors hover:border-foreground-subtle"
        >
          <span className="min-w-0 flex-1 truncate">{action.label}</span>
          <Icon
            icon={action.action === "send_query" ? "mdi:message-reply-outline" : "mdi:chevron-right"}
            className="size-4 shrink-0 text-foreground-subtle"
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}

/** 본문 — 평문 → 표 → 차트 → 버튼 → 고지 순으로 쌓인다. */
function AssistantBody({
  message,
  interactive,
  onActionSelect,
  onNavigate,
}: {
  message: AgentMessage;
  interactive: boolean;
  onActionSelect?: (query: string) => void;
  onNavigate?: (to: string) => void;
}) {
  return (
    <>
      {message.title && (
        <div className="rounded-lg bg-card px-4 py-2.5 text-center text-caption font-medium text-foreground">
          {message.title}
        </div>
      )}

      <div className="text-caption leading-relaxed whitespace-pre-wrap text-foreground-muted">
        {(message.isTyping ? message.displayedContent : message.content) ?? ""}
        {message.isTyping && <TypingCursor />}
      </div>

      {/* 본문과 붙여 두면 마지막 문장이 표 제목처럼 읽힌다. 차트(mt-4)와 같은 간격을 준다 */}
      {message.tableData && (
        <div
          className={
            interactive ? "mt-4" : "pointer-events-none mt-4 select-none"
          }
        >
          <AgentDataTable table={message.tableData} />
        </div>
      )}

      {message.chartData?.map((chart, i) => (
        <figure key={`${chart.title}-${i}`} className="mt-4">
          {chart.title && (
            <figcaption className="mb-2 text-caption font-semibold text-foreground-muted">
              {chart.title}
            </figcaption>
          )}
          <div className="h-[240px] w-full">
            <AgentChart data={chart} />
          </div>
        </figure>
      ))}

      {message.actions && message.actions.length > 0 && (
        <div className={interactive ? undefined : "pointer-events-none select-none"}>
          <ActionButtons
            actions={message.actions}
            onActionSelect={onActionSelect}
            onNavigate={onNavigate}
          />
        </div>
      )}

      {message.disclaimer && (
        <>
          <hr className="my-6 border-t border-border-light" />
          <p className="text-center text-badge text-foreground-subtle">{message.disclaimer}</p>
        </>
      )}
    </>
  );
}

/** 대화 메시지 목록. 스크롤 컨테이너는 부모(AgentChatPanel)가 갖는다. */
export function AgentMessageList({
  messages,
  isResponding = false,
  agentName = "CUVIA Agent",
  onActionSelect,
  onNavigate,
}: AgentMessageListProps) {
  // 표·차트 상호작용은 최신 답변에만 허용한다.
  const latestAssistantId = [...messages]
    .reverse()
    .find(
      (m) => m.role === "assistant" && m.type !== "analyzing" && m.type !== "streaming-step",
    )?.id;

  return (
    <>
      {messages.map((message) =>
        message.role === "user" ? (
          <div key={message.id} className="flex justify-end">
            <div className="max-w-[70%] rounded-xl bg-fill-subtle px-4 py-2 text-caption leading-relaxed whitespace-pre-wrap text-foreground">
              {message.content}
            </div>
          </div>
        ) : (
          <div key={message.id} className="min-w-0">
            <div className="mb-1 text-caption font-semibold text-foreground">{agentName}</div>
            {message.type === "analyzing" ? (
              <AnalyzingBubble message={message} />
            ) : message.type === "streaming-step" ? (
              <AssistantBubble>
                <div className="flex items-center gap-2 text-caption text-foreground-muted">
                  <Icon icon="mdi:loading" className="h-4 w-4 animate-spin text-primary-text" />
                  <span>{message.stepMessage || "처리 중..."}</span>
                </div>
              </AssistantBubble>
            ) : (
              <AssistantBubble>
                <AssistantBody
                  message={message}
                  interactive={message.id === latestAssistantId}
                  onActionSelect={onActionSelect}
                  onNavigate={onNavigate}
                />
              </AssistantBubble>
            )}
          </div>
        ),
      )}

      {isResponding && (
        <div className="flex items-center gap-1 pt-2" aria-label="응답 생성 중">
          <span className="h-2 w-2 animate-bounce rounded-full bg-foreground-muted" />
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-foreground-muted"
            style={{ animationDelay: "0.1s" }}
          />
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-foreground-muted"
            style={{ animationDelay: "0.2s" }}
          />
        </div>
      )}
    </>
  );
}
