/* ─────────────────────────────────────────────
 * AppLayout — 공통 골격 (03 화면정의서 §0)
 *
 *   ┌──────────┬───────────────────────────────┐
 *   │          │ 상단바: 화면명                  │
 *   │ 사이드바  ├───────────────────────────────┤
 *   │  (4메뉴)  │           본문 영역             │
 *   └──────────┴───────────────────────────────┘
 *
 * 다크 테마 고정 — 24×365 상황실 환경 기준.
 *
 * 전면 화면(nav.ts 의 fullBleed)은 상단바 없이 본문이 화면 전체를 쓴다. 지도가 배경인
 * 대시보드·조기경보와 3D 가 배경인 디지털트윈이 여기 해당하고, 화면 요소는 그 페이지가
 * 오버레이로 얹는다.
 *
 * ▸ 제품 정본: cuvia_platform_web packages/ui/src/app-shell.tsx (@cuvia/ui AppShell)
 *   이 앱은 그 워크스페이스 밖이라 패키지로 물지 못해 같은 골격을 로컬에 다시 세웠다.
 *   제품으로 옮길 때 이 파일은 버리고 정본을 쓴다. 구조를 바꿀 일이 생기면 정본을 먼저 본다.
 * ───────────────────────────────────────────── */

import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@ds";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";
import { findNav, HUB_ROUTE } from "./nav";
import { AGENT_PILL_WIDTH, FAB_SLOT, FAB_SLOT_CLOCK, FAB_SLOT_DOCK, FAB_SLOT_RAIL } from "../lib/layout";
import { FabSlotProvider, type FabSlotKind } from "./fab-slot";
import { AgentOverlay } from "../agent";
import { useScenario } from "../state/ScenarioProvider";
import { CANNED_QUERIES, matchQuery } from "../demo/ai";

/** 서비스명 — 화면명을 못 찾았을 때의 상단바 제목 */
const SERVICE_NAME = "CUVIA 재난안전관제시스템";

/** 질의 버튼 자리 — 화면이 알린 모양(fab-slot.tsx)마다 하나씩. 자리 값은 lib/layout.ts 가 든다 */
const FAB_SLOTS: Record<FabSlotKind, { right: number; bottom: number }> = {
  screen: FAB_SLOT,
  rail: FAB_SLOT_RAIL,
  dock: FAB_SLOT_DOCK,
  clock: FAB_SLOT_CLOCK,
};

/** 알약 입력창 위 추천 질문 · 빈 대화의 고를 수 있는 질문 — 질의 문안 그대로 (04 §14-1) */
const PILL_PRESETS = CANNED_QUERIES.map((query) => query.text);

/**
 * 통계·분석에서 패널을 열었을 때의 첫 줄.
 *
 * 짧게 둔다 — 담당자는 인사를 읽으러 연 것이 아니다. 무엇을 물을 수 있는지는 아래 버튼이
 * 말하므로, 여기서는 이 자리가 무엇을 하는 자리인지 한 줄이면 된다.
 *
 * ★ 이 화면에서만 세운다. 다른 화면은 저마다 진입 맥락이 달라(지도에서 지구를 보다가,
 *   사건을 보다가) 같은 인사·같은 질문을 세우면 맞지 않는다. 화면이 정해지면 그 화면의
 *   것을 여기 한 줄씩 늘린다.
 */
const STATS_GREETING = "통계에서 무엇이 궁금하신가요?\n아래에서 고르거나 직접 물어보세요.";
const STATS_ROUTE = "/scr-04";

export function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const item = findNav(pathname);
  const fullBleed = item?.fullBleed ?? false;
  /* 상단바를 세우지 않는 화면 — 전면 화면과 탭 줄이 머리인 화면(nav.ts subNav). 스크롤은 페이지가 맡는다 */
  const headless = fullBleed || (item?.subNav ?? false);
  /* 질의 버튼 자리 — 화면이 알려 주면 그것, 아니면 경로 기본값(fab-slot.tsx) */
  const [fabOverride, setFabOverride] = useState<FabSlotKind | null>(null);
  const routeFab: FabSlotKind = item?.bottomDock ? "dock" : item?.fullBleed ? "rail" : "screen";
  const fabKind = fabOverride ?? routeFab;
  const onStats = pathname.startsWith(STATS_ROUTE);
  /* 허브(종합상황)의 질의 바만 전용 화면으로 보낸다 — 아래 onSubmit 주석 참고 */
  const onHub = pathname === HUB_ROUTE;
  const onSearch = pathname.startsWith("/scr-06");

  const {
    agentOpen,
    agentMessages,
    agentResponding,
    openAgent,
    closeAgent,
    cancelAgent,
    askAgent,
    agentBackdrop,
    clearAgentBackdrop,
  } = useScenario();

  /*
   * 배경 전환 — 답이 뜨면서 뒤 화면만 바뀌고 **패널은 열린 채 남는다.**
   *
   * 엔진이 라우터 밖이라 갈 곳만 적어 두고, 옮기는 것은 여기가 한다. 옮긴 뒤 비워야
   * 사용자가 손으로 다른 화면에 가도 도로 끌려오지 않는다.
   */
  useEffect(() => {
    if (!agentBackdrop) return;
    navigate(agentBackdrop);
    clearAgentBackdrop();
  }, [agentBackdrop, navigate, clearAgentBackdrop]);

  /* SCR-06 에 닿으면 패널을 닫는다.
     알약이 보낼 때 패널을 여는 것은 이식본의 기본 동작이라(agent-overlay handlePillSubmit),
     허브에서 보내면 패널이 열린 채로 SCR-06 에 도착한다. 그 화면 자체가 물음과 답의
     자리이므로 패널이 겹치면 같은 것이 두 벌 선다. 이식본을 고치는 대신 여기서 닫는다 */
  useEffect(() => {
    if (onSearch && agentOpen) closeAgent();
  }, [onSearch, agentOpen, closeAgent]);

  return (
    /* relative — AI 패널·질의 버튼이 absolute 로 이 골격에 얹힌다. 스크롤되지 않는
       컨테이너라야 본문과 같이 밀려 올라가지 않는다 (03 §6) */
    <div className="relative flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* 정본 AppTopbar 는 title 이 필수다. 경로를 못 찾는 화면(있어선 안 되지만)에서는
            서비스명을 세운다 — 제목 자리를 비워 두지 않는다 */}
        {!headless && <AppTopbar title={item?.label ?? SERVICE_NAME} scr={item?.scr} />}
        <main
          className={cn("min-h-0 flex-1", headless ? "overflow-hidden" : "overflow-auto")}
          role="main"
        >
          <FabSlotProvider value={setFabOverride}>
            <Outlet />
          </FabSlotProvider>
        </main>
      </div>

      {/* AI 에이전트 패널 — 골격에 한 번만 매단다. 화면을 옮겨도 같은 자리에 같은 것이
          열려야 "어느 칸에 서 있든 묻는 자리"가 성립한다 (02 §3).

          한때 질의가 별도 화면(SCR-06)이었고 우하단 버튼이 그리로 보냈다. 그러면 물어보려고
          화면을 옮기게 되고, 옮기는 순간 보고 있던 지도가 사라진다. 패널은 지도를 왼쪽에
          남긴 채 오른쪽으로 밀려 나온다 — 물음과 답이 같은 화면에 선다 (03 §6).

          우하단 진입 버튼은 패널이 자기 것으로 들고 있다(AgentOverlay). 종합상황처럼 하단에
          질의 바가 펼쳐진 화면에서는 그 자리(PILL_SLOT_ID)로 옮겨 붙는다 */}
      {/* SCR-06 에서는 패널을 닫는다 — 그 화면 자체가 물음과 답의 자리라 패널이 겹치면
          같은 것이 두 벌 선다. 알약이 보낼 때 패널을 여는 것은 이식본의 기본 동작이고
          (agent-overlay handlePillSubmit), 그 기본은 건드리지 않는다 */}
      <AgentOverlay
        /* 질의 버튼 자리 — 하단 중앙에 선 것(도크·훈련 시계)이 있으면 그 위로, 레일만 있는 전면 화면은
           가운데 영역 우하단, 나머지는 화면 우하단 (lib/layout.ts). 우측 레일 바닥의 액션 바를 가리지 않는다 */
        fabInset={FAB_SLOTS[fabKind]}
        pillWidth={AGENT_PILL_WIDTH}
        open={agentOpen}
        onOpen={openAgent}
        onClose={closeAgent}
        messages={agentMessages}
        isResponding={agentResponding}
        onCancel={cancelAgent}
        /* ★ 물음이 두 자리에서 산다 (2026-09-09 확정).
             오버레이   사건 **진행 중** 묻는다. 지도를 왼쪽에 남겨야 하므로 화면을 안 옮긴다
             SCR-06    S9 **사후 복기**. 사건이 해제된 뒤라 남길 지도가 없고, 근거 표와
                       실측 대조가 전용 화면에서 크게 서야 에필로그가 선다
           그래서 허브(종합상황) 질의 바에서 물으면 SCR-06 으로 보내고, 그 밖 화면의
           질의 버튼은 오버레이 그대로다. 03 §6 의 "물음과 답이 같은 화면에 선다"는
           진행 중 물음의 규칙이고, 복기는 그 규칙이 지킬 것이 없는 자리다 */
        onSubmit={(text) => {
          const matched = matchQuery(text);
          /* ★ panelOnly 질의는 오버레이에 남는다 (demo/ai.ts).
               열돔이 그 예다 — 답이 흐르는 동안 뒤가 종합상황(시 전체 + 열돔 인셋)으로 바뀌는 형태라
               전용 화면에 옮기면 그 연출이 설 자리가 없고, SCR-06 은 그 종류를 그리지 않는다.
               데이터가 "이 질의는 패널에서만 산다"고 이미 말하고 있으므로 그것을 따른다 */
          if (!onHub || matched?.panelOnly) {
            askAgent(text);
            return;
          }
          navigate(matched ? `/scr-06?q=${matched.id}` : `/scr-06?ask=${encodeURIComponent(text)}`);
        }}
        /* 바로가기는 패널을 닫으며 보낸다 — 도착한 화면을 자기가 가리면 보러 간 뜻이 없다 */
        onNavigate={(to) => {
          closeAgent();
          navigate(to);
        }}
        /* 통계·분석에서 열었을 때만 인사와 고를 수 있는 질문이 선다 */
        greeting={onStats ? STATS_GREETING : undefined}
        suggestions={onStats ? PILL_PRESETS : undefined}
        pillPresets={PILL_PRESETS}
        pillPlaceholder="상황을 물어보세요"
      />
    </div>
  );
}
