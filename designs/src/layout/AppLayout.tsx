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

import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@ds";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";
import { findNav } from "./nav";
import { AgentOverlay } from "../agent";
import { useScenario } from "../state/ScenarioProvider";
import { CANNED_QUERIES } from "../demo/ai";

/** 서비스명 — 화면명을 못 찾았을 때의 상단바 제목 */
const SERVICE_NAME = "CUVIA 안전재난관제시스템";

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
  const onStats = pathname.startsWith(STATS_ROUTE);

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

  return (
    /* relative — AI 패널·질의 버튼이 absolute 로 이 골격에 얹힌다. 스크롤되지 않는
       컨테이너라야 본문과 같이 밀려 올라가지 않는다 (03 §6) */
    <div className="relative flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* 정본 AppTopbar 는 title 이 필수다. 경로를 못 찾는 화면(있어선 안 되지만)에서는
            서비스명을 세운다 — 제목 자리를 비워 두지 않는다 */}
        {!fullBleed && <AppTopbar title={item?.label ?? SERVICE_NAME} scr={item?.scr} />}
        <main
          className={cn("min-h-0 flex-1", fullBleed ? "overflow-hidden" : "overflow-auto")}
          role="main"
        >
          <Outlet />
        </main>
      </div>

      {/* AI 에이전트 패널 — 골격에 한 번만 매단다. 화면을 옮겨도 같은 자리에 같은 것이
          열려야 "어느 칸에 서 있든 묻는 자리"가 성립한다 (02 §3).

          한때 질의가 별도 화면(SCR-06)이었고 우하단 버튼이 그리로 보냈다. 그러면 물어보려고
          화면을 옮기게 되고, 옮기는 순간 보고 있던 지도가 사라진다. 패널은 지도를 왼쪽에
          남긴 채 오른쪽으로 밀려 나온다 — 물음과 답이 같은 화면에 선다 (03 §6).

          우하단 진입 버튼은 패널이 자기 것으로 들고 있다(AgentOverlay). 종합상황처럼 하단에
          질의 바가 펼쳐진 화면에서는 그 자리(PILL_SLOT_ID)로 옮겨 붙는다 */}
      <AgentOverlay
        open={agentOpen}
        onOpen={openAgent}
        onClose={closeAgent}
        messages={agentMessages}
        isResponding={agentResponding}
        onCancel={cancelAgent}
        onSubmit={askAgent}
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
