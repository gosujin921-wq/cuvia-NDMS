/* ─────────────────────────────────────────────
 * 대응 실행 집중 팝업 — 1280×720 수용 기준 확인 (03 §2 · 차수 N)
 *
 * 최초 진입 상태에서 판정 요약 · SOP 7항목 · [승인·실행]이 본문 스크롤 없이 함께
 * 보이는지 잰다. 페이지 스크롤 금지 · 본문 내부 스크롤 허용은 나머지 상태(문안
 * 편집·실행 중·완료)의 기준이고, 최초 진입만 무스크롤이 조건이다.
 *
 * 사용: dev 서버 띄우고  OUT=<dir> BASE_URL=http://localhost:5400 node scripts/popup-check.mjs
 * ───────────────────────────────────────────── */

import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:5400";
const OUT = process.env.OUT ?? "shots";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

// 사건 지정 진입(S5 점프) — 격상·시나리오가 선 상태에서 승인 전 팝업을 연다
await page.goto(`${BASE}/scr-02/seohang?event=EVT-260812-006`, { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
await page.getByRole("button", { name: "대응 실행" }).click();
await page.waitForTimeout(900);

const metrics = await page.evaluate(() => {
  const content = document.querySelector('[data-slot="modal-content"]');
  if (!content) return { error: "팝업이 열리지 않았다" };
  const body = content.querySelector(".overflow-y-auto");
  const run = [...content.querySelectorAll("button")].find((b) =>
    b.textContent?.replace(/\s/g, "").includes("승인·실행"),
  );
  const rect = run?.getBoundingClientRect();
  return {
    body: body
      ? { scrollHeight: body.scrollHeight, clientHeight: body.clientHeight }
      : null,
    noScroll: body ? body.scrollHeight <= body.clientHeight + 1 : false,
    runButtonVisible: rect ? rect.top >= 0 && rect.bottom <= window.innerHeight : false,
    sopRows: content.querySelectorAll('[aria-label="대응 절차"] li').length,
  };
});

console.log(JSON.stringify(metrics, null, 2));
await page.screenshot({ path: `${OUT}/popup-1280x720.png` });
await browser.close();

if (metrics.error || !metrics.noScroll || !metrics.runButtonVisible || metrics.sopRows !== 7) {
  console.error("수용 기준 미달 — 위 metrics 확인");
  process.exit(1);
}
console.log("popup-check ok");
