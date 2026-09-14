/* ─────────────────────────────────────────────
 * 라우터 — Phase 2 는 신규 라우트를 만들지 않고 /scr-* 를 유지한다 (IA §5.2)
 *
 * 사건 중심 재편은 URL 교체가 아니라 기존 화면 안의 정보 구조와 패널 역할을 바꾸는 것이다.
 *   /scr-01              IA-01 종합상황 (재편됨)
 *   /scr-02/:districtId  IA-02 사건 작업공간 + IA-04 우측 대응 패널 (재편됨). 대응·전망은 query `panel`
 *   /scr-04 · /scr-07    IA-05 기록·검증 (재편 전)
 *   /scr-05/:districtId  IA-03 디지털트윈 · IA-T01 사전 조건분석 (재편 전)
 *   /scr-06              IA-G01 AI 보조
 * D0~D8 단계와 시계는 URL 이 아니라 엔진(ScenarioProvider)이 든다.
 * ───────────────────────────────────────────── */

import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "./layout/AppLayout";
import { HUB_ROUTE } from "./layout/nav";
import { OverviewDashboardPage } from "./pages/scr-01/OverviewDashboardPage";
import { EarlyWarningPage } from "./pages/scr-02/EarlyWarningPage";
import { StatisticsPage } from "./pages/scr-04/StatisticsPage";
import { DigitalTwinPage } from "./pages/scr-05/DigitalTwinPage";
import { AiSearchPage } from "./pages/scr-06/AiSearchPage";
import { ReportPage } from "./pages/scr-07/ReportPage";
import { incidentsAt, isActiveStatus, watchTargetsAt } from "./model/selectors";
import { useScenario } from "./state/ScenarioProvider";

/* 재난관제 메뉴(/scr-02) → 지금 봐야 할 곳 (2026-09-14 결정)
 *   1. 진행 중인 사건이 있으면 그 사건 작업공간. 여럿이면 종합상황 우선순위의 첫 사건(incidentsAt 정렬)
 *   2. 사건은 없고 감시 우선구역이 있으면(D0) 그 구역을 알림 상태로 — 감지 카드 진입과 같은 화면
 *   3. 둘 다 없으면 종합상황
 * 정본 IA §4 에서 사건 작업공간은 상시 메뉴가 아니다. 메뉴는 다섯 화면 재편이 끝날 때까지 두기로 한 자리라
 * 어느 시점에 눌러도 빈 화면이나 되돌림 없이 열리게만 한다 */
function HeroDistrictRedirect() {
  const { demoNow } = useScenario();
  const active = incidentsAt(demoNow).find((v) => isActiveStatus(v.workflowStatus) && v.incident.legacyDistrictId);
  if (active) return <Navigate to={`/scr-02/${active.incident.legacyDistrictId}`} replace />;
  const watch = watchTargetsAt(demoNow).find((w) => w.alert && w.incident.legacyDistrictId);
  if (watch?.alert) return <Navigate to={`/scr-02/${watch.incident.legacyDistrictId}?alertId=${watch.alert.alertId}`} replace />;
  return <Navigate to="/scr-01" replace />;
}

export const router = createBrowserRouter([
  // 별도 진입 화면을 두지 않는다. 들어오면 곧바로 허브(대시보드)로 보낸다.
  { path: "/", element: <Navigate to={HUB_ROUTE} replace /> },
  {
    element: <AppLayout />,
    children: [
      { path: "/scr-01", element: <OverviewDashboardPage /> },
      { path: "/scr-02", element: <HeroDistrictRedirect /> },
      // 지구의 진행 사건 작업공간. 우측 패널 모드는 query `panel=twin|response` (신규 라우트 없음 · IA §5.2)
      { path: "/scr-02/:districtId", element: <EarlyWarningPage /> },
      // 구 상황대응 — /scr-02 의 대응 패널로 통합 (IA §5.2)
      { path: "/scr-03", element: <HeroDistrictRedirect /> },
      { path: "/scr-04", element: <StatisticsPage /> },
      { path: "/scr-05", element: <DigitalTwinPage /> },
      // 조기경보에서 [Twin 모드 실행]으로 들어오면 그 지구가 열린다 (02 문서 §2)
      { path: "/scr-05/:districtId", element: <DigitalTwinPage /> },
      // 대시보드 질의 바에서 `?q={질의 ID}` 로 들어온다. 못 알아들은 문장만 `?ask=` (03 §6)
      { path: "/scr-06", element: <AiSearchPage /> },
      // SCR-04 [보고서 생성]이 `?event=` 로 사건을 들고 온다. 레일로 들어오면 최근 사건이 선다
      { path: "/scr-07", element: <ReportPage /> },
    ],
  },
]);
