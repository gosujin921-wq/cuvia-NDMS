import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "@ds";
import { router } from "./router";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
    {/* sonner 토스트 — DS Toaster. 화면에서 toast.success(...) 로 호출 */}
    <Toaster />
  </StrictMode>,
);
