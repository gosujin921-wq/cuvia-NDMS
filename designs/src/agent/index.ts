/* ─────────────────────────────────────────────
 * AI 에이전트 패널 — 정본: docs/정본/03_화면정의서.md §6
 *
 * 제품 `cuvia_platform_web/features/ai-agent` 에서 옮겨 온 부품이다. 각 파일 머리에
 * 원본 경로와 고친 곳을 적어 두었다.
 *
 * ★ 이 폴더는 데모를 모른다. 안의 어느 파일도 `demo/` 를 import 하지 않는다.
 *   답변은 밖에서 `messages` 로 넣는다 — 폴더째 복사해 다른 앱에 두고 그 앱의
 *   대화 소스를 물리면 그대로 돈다.
 *
 * 붙이는 쪽이 할 일은 둘.
 *   1. 셸(스크롤되지 않는 `relative` 컨테이너)에 `<AgentOverlay ... />` 를 한 번 매단다
 *   2. 알약 입력창을 원하는 화면이 `<div id={PILL_SLOT_ID} />` 를 둔다
 *
 * 답변 한 건(`AgentMessage`)의 모양은 제품 서버가 SSE 로 내려주는 규격 그대로다.
 * 백엔드가 붙는 날 데이터 출처만 갈아끼우면 이 폴더는 한 줄도 고치지 않는다.
 * ───────────────────────────────────────────── */

export { AgentOverlay, PILL_SLOT_ID } from "./components/agent-overlay";
export { AgentChatPanel } from "./components/agent-chat-panel";
export { AgentMessageList } from "./components/agent-message-list";
export { AgentDataTable } from "./components/agent-data-table";
export { AgentChart } from "./components/agent-chart";
export { ChatInputForm } from "./components/chat-input-form";
export { PillChatInput } from "./components/pill-chat-input";
export { AgentFab } from "./components/agent-fab";
export { AgentSymbol } from "./components/agent-symbol";
export { useComposableInput } from "./hooks/use-composable-input";

export type {
  AgentMessage,
  AgentAction,
  AgentChartData,
  AgentChartDataset,
  AgentTableData,
  AgentTableExtension,
  UiControlPayload,
} from "./types";
