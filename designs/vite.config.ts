import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  /* ⚠ 프로덕션 CSS 의 LightningCSS 가공(Tailwind 플러그인 optimize + vite cssMinify)이
     `backdrop-filter` 와 `-webkit-backdrop-filter` 를 같은 속성으로 병합해 뒤에 쓴
     -webkit- 쪽만 남긴다. 크롬은 -webkit- 별칭을 안 받아 글래스 블러가 프로덕션
     빌드에서만 전부 죽는다 (dev 는 비가공이라 정상). CSMS 2026-09-01 과 같은 건.
     타깃 지정(cssTarget · css.lightningcss.targets)으로는 안 잡혀 두 단계를 모두 끈다 */
  plugins: [react(), tailwindcss({ optimize: false })],
  build: {
    cssMinify: false,
  },
  resolve: {
    // ds:link 시 @cuvia/* 가 클론(../../_ref/CUVIA_PLATFORM_DESIGN)에서 심링크로 들어오므로
    // react 가 두 번 로드되지 않도록 단일 인스턴스로 강제한다(Hooks 에러 방지).
    dedupe: ["react", "react-dom"],
    alias: {
      // DS 단일 진입점(src/ds.ts). 제품의 `@cuvia/ui/components` 자리에 해당한다.
      // @types/node 를 안 물고 있어 fileURLToPath 대신 URL.pathname 으로 절대경로를 만든다.
      "@ds": new URL("./src/ds.ts", import.meta.url).pathname,
    },
  },
  server: {
    // 재난안전관제 앱 전용 고정 포트. KISA 5200, IDC 5300 이 이미 잡혀 있어 5400 으로
    // 못박고, strictPort 로 조용히 밀리지 않게 한다.
    port: 5400,
    strictPort: true,
    fs: {
      // ds:link 시 @cuvia/* 소스가 앱 루트 밖(Projects/_ref/CUVIA_PLATFORM_DESIGN)에 있어 접근 허용 필요.
      allow: ["../.."],
    },
  },
});
