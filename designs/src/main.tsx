import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "@ds";
import { router } from "./router";
import { ScenarioProvider } from "./state/ScenarioProvider";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* 데모 상태 엔진 — 시연 중 변하는 모든 값의 단일 source of truth (CLAUDE.md) */}
    <ScenarioProvider>
      <RouterProvider router={router} />
      {/* sonner 토스트 — DS Toaster. 화면에서 toast.success(...) 로 호출.
          우상단 고정 — 격상 토스트가 우상단에 뜬다(03 §2 단계 격상) */}
      <Toaster position="top-right" />
    </ScenarioProvider>
  </StrictMode>,
);
