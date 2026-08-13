/* ─────────────────────────────────────────────
 * 라우터 — SCR-01~06
 *
 * URL · 페이지 폴더 · 사이드바 nav.ts · 화면정의서가 전부 SCR 번호로 1:1 정렬된다.
 * 화면을 추가하려면 docs/정본/02_IA_화면구조.md 부터 고친다.
 * ───────────────────────────────────────────── */

import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "./layout/AppLayout";
import { HUB_ROUTE } from "./layout/nav";
import { OverviewDashboardPage } from "./pages/scr-01/OverviewDashboardPage";
import { EarlyWarningPage } from "./pages/scr-02/EarlyWarningPage";
import { EventDispatchPage } from "./pages/scr-03/EventDispatchPage";
import { StatisticsPage } from "./pages/scr-04/StatisticsPage";
import { DigitalTwinPage } from "./pages/scr-05/DigitalTwinPage";
import { AiSearchPage } from "./pages/scr-06/AiSearchPage";

export const router = createBrowserRouter([
  // 별도 진입 화면을 두지 않는다. 들어오면 곧바로 허브(대시보드)로 보낸다.
  { path: "/", element: <Navigate to={HUB_ROUTE} replace /> },
  {
    element: <AppLayout />,
    children: [
      { path: "/scr-01", element: <OverviewDashboardPage /> },
      { path: "/scr-02", element: <EarlyWarningPage /> },
      // 대시보드에서 지구를 고르면 그 지구로 열린다 (02 문서 §2)
      { path: "/scr-02/:districtId", element: <EarlyWarningPage /> },
      { path: "/scr-03", element: <EventDispatchPage /> },
      { path: "/scr-04", element: <StatisticsPage /> },
      { path: "/scr-05", element: <DigitalTwinPage /> },
      // 조기경보에서 [Twin 모드 실행]으로 들어오면 그 지구가 열린다 (02 문서 §2)
      { path: "/scr-05/:districtId", element: <DigitalTwinPage /> },
      // 대시보드 질의 바에서 `?q={질의 ID}` 로 들어온다. 못 알아들은 문장만 `?ask=` (03 §6)
      { path: "/scr-06", element: <AiSearchPage /> },
    ],
  },
]);
