/* ─────────────────────────────────────────────
 * 이식본 — 원본: cuvia_platform_web/features/ai-agent/types.ts
 *
 * 에이전트 대화 UI 계약. **남긴 필드 이름과 모양은 제품 규격 그대로다** — 제품에서는
 * 이 모양이 서버 SSE 응답이라, 백엔드가 붙는 날 데이터 출처만 갈아끼우면 패널은
 * 한 줄도 고치지 않는다.
 *
 * 원본에서 덜어낸 것 (데모 범위 밖):
 *   · `AgentMapData` — 지도 시각화. 답변에서 지도를 띄우지 않고 SCR-05 로 보낸다
 *   · 슬롯(`AgentSlots` 등) — 조건 칩·선택 모달. 데모 질의는 3종 고정이라 좁힐 조건이 없다
 *   · `rationale` · `htmlContent` — 서버가 내려주던 HTML. 답변 문안을 직접 쓰므로 쓸 일이 없고,
 *     살균기 없이 HTML 을 렌더하는 길을 아예 막아 둔다 (agent-message-list 주석)
 * ───────────────────────────────────────────── */

/** 차트 한 계열. */
export interface AgentChartDataset {
  label: string;
  data: number[];
}

/** 응답에 포함된 차트 하나. */
export interface AgentChartData {
  /** "bar" | "line" | "pie" | "doughnut" — 미지정/미지값은 bar 로 폴백. */
  type: string;
  title: string;
  labels: string[];
  datasets: AgentChartDataset[];
}

/** 표 행에 딸린 부가 정보. */
export interface AgentTableExtension {
  type?: string;
  clickable?: boolean;
  [key: string]: string | number | boolean | undefined;
}

/** 응답에 포함된 표. */
export interface AgentTableData {
  columns: string[];
  data: (string | number)[][];
  /** data 와 행 인덱스가 대응하는 부가 정보. */
  extension?: AgentTableExtension[];
  title?: string;
  total_count?: number;
}

/** 화면제어(ui_control) 명령 payload. 데모는 `navigate` 만 쓴다. */
export interface UiControlPayload {
  phase?: "execute" | "confirm" | "cancel";
  effect?: "navigate" | "read" | "download" | "mutate";
  command?: string;
  /** navigate 대상 라우트 경로(예: "/scr-02/seohang"). */
  target?: string;
  args?: Record<string, unknown>;
}

/** 답변 하단 버튼. 데모가 쓰는 것은 `send_query`(다시 묻기)와 `ui_control`(화면 이동) 둘. */
export interface AgentAction {
  label: string;
  action: "send_query" | "show_modal" | "open_url" | "ui_control";
  /** send_query 계열에서만 필수. ui_control 은 payload 로 동작한다. */
  query?: string;
  payload?: { title?: string; url?: string } & UiControlPayload;
}

/**
 * 대화 메시지 한 건.
 *
 * 렌더 순서(assistant): analyzing → streaming-step → 본문 → 표 → 차트 → 버튼 → 고지.
 */
export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** 진행 상태 버블(analyzing = 진행률 바, streaming-step = 스피너). */
  type?: "normal" | "analyzing" | "streaming-step";
  /** analyzing 전용 — 0~1. */
  progress?: number;
  currentStep?: number;
  totalSteps?: number;
  /** streaming-step 전용 문구. */
  stepMessage?: string;
  title?: string;
  chartData?: AgentChartData[] | null;
  tableData?: AgentTableData | null;
  disclaimer?: string | null;
  actions?: AgentAction[];
  /** 타이핑 중이면 displayedContent 를 커서와 함께 보여준다. */
  isTyping?: boolean;
  displayedContent?: string;
}
