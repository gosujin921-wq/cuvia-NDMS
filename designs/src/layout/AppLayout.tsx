/* ─────────────────────────────────────────────
 * AppLayout — 공통 골격 (03 화면정의서 §0)
 *
 *   ┌──────────┬───────────────────────────────┐
 *   │          │ 상단바: 화면명                  │
 *   │ 사이드바  ├───────────────────────────────┤
 *   │  (5메뉴)  │           본문 영역             │
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

import { Outlet, useLocation } from "react-router-dom";
import { cn } from "@ds";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";
import { AgentFab } from "../components/AgentFab";
import { findNav, HUB_ROUTE } from "./nav";

/** 서비스명 — 화면명을 못 찾았을 때의 상단바 제목 */
const SERVICE_NAME = "CUVIA 안전재난관제시스템";

export function AppLayout() {
  const { pathname } = useLocation();
  const item = findNav(pathname);
  const fullBleed = item?.fullBleed ?? false;
  /* 종합상황은 질의 바가 하단 중앙에 펼쳐져 있다 — 같은 길을 두 벌 세우지 않는다(03 §1) */
  const showAgentFab = !pathname.startsWith(HUB_ROUTE);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
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

      {/* 질의 진입 — 종합상황 밖 모든 화면의 우측 하단 (03 §1).
          레일이 선 화면(재난관제·디지털트윈)에서는 우측 레일 왼쪽으로 비켜 서고,
          하단 도크가 있으면(재난관제) 도크 위로 한 칸 더 올라간다 */}
      {showAgentFab && <AgentFab rails={fullBleed} overDock={item?.bottomDock ?? false} />}
    </div>
  );
}
