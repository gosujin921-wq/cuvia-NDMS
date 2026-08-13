import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // ds:link 시 @cuvia/* 가 클론(../../cuvia_platform_design)에서 심링크로 들어오므로
    // react 가 두 번 로드되지 않도록 단일 인스턴스로 강제한다(Hooks 에러 방지).
    dedupe: ["react", "react-dom"],
    alias: {
      // DS 단일 진입점(src/ds.ts). 제품의 `@cuvia/ui/components` 자리에 해당한다.
      // @types/node 를 안 물고 있어 fileURLToPath 대신 URL.pathname 으로 절대경로를 만든다.
      "@ds": new URL("./src/ds.ts", import.meta.url).pathname,
    },
  },
  server: {
    // 안전재난관제 앱 전용 고정 포트. KISA 5200, IDC 5300 이 이미 잡혀 있어 5400 으로
    // 못박고, strictPort 로 조용히 밀리지 않게 한다.
    port: 5400,
    strictPort: true,
    fs: {
      // ds:link 시 @cuvia/* 소스가 앱 루트 밖(Projects/cuvia_platform_design)에 있어 접근 허용 필요.
      allow: ["../.."],
    },
  },
});
