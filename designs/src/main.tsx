import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "@ds";
import { router } from "./router";
import { ScenarioProvider } from "./state/ScenarioProvider";
import { DemoControls } from "./components/DemoControls";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* 데모 상태 엔진 — 시연 중 변하는 모든 값의 단일 source of truth (CLAUDE.md) */}
    <ScenarioProvider>
      <RouterProvider router={router} />
      {/* 데모 컨트롤: 숫자 0 키로 여닫는 발표자 조작판 (04 §0-2). 라우터 밖이라
          어느 화면에서든 뜬다 */}
      <DemoControls />
      {/* sonner 토스트 — DS Toaster. 화면에서 toast.success(...) 로 호출.
          상단 중앙(03 §2 단계 격상) — 지도 화면 4개 모두 우측 레일이 우상단을 차지해
          top-right 는 격상 순간 실시간 센서 패널을 가린다. 레일 사이 상단이 유일한
          빈 자리다. top 64 는 SCR-01 상태 스트립(top-3 + 한 줄) 아래로 내린 값 */}
      <Toaster position="top-center" offset={{ top: 64 }} />
    </ScenarioProvider>
  </StrictMode>,
);
