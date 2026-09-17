import { useEffect } from "react";
/* ─────────────────────────────────────────────
 * 라우터 — Phase 2 는 신규 라우트를 만들지 않고 /scr-* 를 유지한다 (IA §5.2)
 *
 * 사건 중심 재편은 URL 교체가 아니라 기존 화면 안의 정보 구조와 패널 역할을 바꾸는 것이다.
 *   /scr-01              IA-01 종합상황 (재편됨)
 *   /scr-02/:districtId  IA-02 사건 작업공간 + IA-04 우측 대응 패널 (재편됨). 대응·전망은 query `panel`
 *   /scr-04              IA-06 통계 — 사건 원장 집계 (2026-09-16)
 *   /scr-07              IA-05 이력 — [사건] 사건 기록 · [보고서]. 창·탭은 query (2026-09-16 보고서 메뉴를 바꿈)
 *   /scr-05              디지털트윈 · 조건 기반 예측 시뮬레이션. 유형·조건·대안·시각은 query
 *   /scr-05/:districtId  같은 화면, 그 지구 원 사건의 시나리오로 좁힘 (Phase 1 진입점 호환)
 *   /scr-06              IA-G01 AI 보조
 * D0~D8 단계와 시계는 URL 이 아니라 엔진(ScenarioProvider)이 든다.
 * ───────────────────────────────────────────── */

import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "./layout/AppLayout";
import { HUB_ROUTE } from "./layout/nav";
import { SimulationPage } from "./pages/scr-00/SimulationPage";
import { OverviewDashboardPage } from "./pages/scr-01/OverviewDashboardPage";
import { EarlyWarningPage } from "./pages/scr-02/EarlyWarningPage";
import { StatisticsPage } from "./pages/scr-04/StatisticsPage";
import { DigitalTwinPage } from "./pages/scr-05/DigitalTwinPage";
import { AiSearchPage } from "./pages/scr-06/AiSearchPage";
import { HistoryPage } from "./pages/scr-07/HistoryPage";
import { incidentsAt, isActiveStatus } from "./model/selectors";
import { toast } from "@ds";
import { useScenario } from "./state/ScenarioProvider";

/* 재난관제 메뉴(/scr-02) → 진행 중인 사건 (2026-09-15 결정)
 *   진행 중인 사건이 있으면 그 사건 작업공간. 여럿이면 종합상황 우선순위의 첫 사건(incidentsAt 정렬).
 *   없으면 종합상황으로 돌려보내고 한 줄 알린다. 알림 화면으로는 보내지 않는다 — 메뉴는 누를 때마다 같은 곳이 열려야
 *   하고, 알림은 담당자가 종합상황의 감지 카드를 눌러 고를 때만 연다("가장 볼 만한 곳"은 메뉴가 할 일이 아니다, 사용자 지적).
 * 정본 IA §4 에서 사건 작업공간은 상시 메뉴가 아니다. 메뉴는 다섯 화면 재편이 끝날 때까지 두기로 한 자리다 */
function HeroDistrictRedirect() {
  const { demoNow } = useScenario();
  const active = incidentsAt(demoNow).find((v) => isActiveStatus(v.workflowStatus) && v.incident.legacyDistrictId);
  useEffect(() => {
    if (!active) toast("진행 중인 사건이 없습니다. 감시 우선구역과 알림은 종합상황에서 봅니다.");
  }, [active]);
  if (active) return <Navigate to={`/scr-02/${active.incident.legacyDistrictId}`} replace />;
  return <Navigate to="/scr-01" replace />;
}

export const router = createBrowserRouter([
  // 별도 진입 화면을 두지 않는다. 들어오면 곧바로 허브(대시보드)로 보낸다.
  { path: "/", element: <Navigate to={HUB_ROUTE} replace /> },
  {
    element: <AppLayout />,
    children: [
      { path: "/scr-01", element: <OverviewDashboardPage /> },
      // 디지털트윈 시뮬레이션 — 실제 사건 재현(기준) → 조건 변경 → 결과 비교 → 관련 SOP (2026-09-17 새 방향). 유형·대상·시나리오는 query
      { path: "/scr-00", element: <SimulationPage /> },
      { path: "/scr-02", element: <HeroDistrictRedirect /> },
      // 지구의 진행 사건 작업공간. 우측 패널 모드는 query `panel=twin|response` (신규 라우트 없음 · IA §5.2)
      { path: "/scr-02/:districtId", element: <EarlyWarningPage /> },
      // 구 상황대응 — /scr-02 의 대응 패널로 통합 (IA §5.2)
      { path: "/scr-03", element: <HeroDistrictRedirect /> },
      { path: "/scr-04", element: <StatisticsPage /> },
      // 디지털트윈 — 사건 기반 대응 What-if. 메뉴로 들어오면 사건 목록, `?incident=` 로 그 사건의 트윈(03 §26)
      { path: "/scr-05", element: <DigitalTwinPage /> },
      // Phase 1 진입점 호환 — 그 지구의 사건 트윈으로 넘긴다. 없으면 사건 목록 (IA §5.2)
      { path: "/scr-05/:districtId", element: <DigitalTwinPage /> },
      // 대시보드 질의 바에서 `?q={질의 ID}` 로 들어온다. 못 알아들은 문장만 `?ask=` (03 §6)
      { path: "/scr-06", element: <AiSearchPage /> },
      // 이력 — 사건 게시판이 기본. `?incident=` 는 그 사건의 기록 창(D8 종료가 `&view=case` 로 온다), `?tab=report` 는 보고서
      { path: "/scr-07", element: <HistoryPage /> },
    ],
  },
]);
