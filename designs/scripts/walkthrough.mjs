/* ─────────────────────────────────────────────
 * 시연 대본 자동 주행 — 05 시나리오 S0~S9 를 순서대로 밟으며 화면을 찍는다.
 *
 * SPA 클라이언트 내비게이션으로만 이동한다(페이지 새로고침 = S0 리셋이라서).
 * 격상 8초 대기까지 대본 그대로다. 산출물로 "정본대로 구현됐는가"를 눈으로 검증한다.
 *
 * 사용: dev 서버 띄우고  OUT=<dir> BASE_URL=http://localhost:5401 node scripts/walkthrough.mjs
 * ───────────────────────────────────────────── */

import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:5401";
const OUT = process.env.OUT ?? "shots";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });

// S0 — 종합상황 (17:16 · 상시대비 · 서항 확인중)
await page.goto(`${BASE}/scr-01`, { waitUntil: "networkidle" });
await page.waitForTimeout(5000);
await shot("s0-종합상황");

// S1 — 서항지구 클릭 → 재난관제
await page.getByRole("button", { name: /^서항지구 해일/ }).first().click();
await page.waitForTimeout(4000);
await shot("s1-재난관제");

// S2 — 수위계 팝업 → 8초 뒤 격상 목격
await page.getByRole("button", { name: /수위계 1호기/ }).first().click();
await page.waitForTimeout(1000);
await shot("s2a-팝업-주의보");
await page.waitForTimeout(8500);
await shot("s2b-격상-경보");

// S4 — [디지털트윈 분석] (S3 CCTV 는 정적 확인이라 생략)
await page.getByRole("button", { name: "디지털트윈 분석" }).click();
await page.waitForTimeout(6000);
await shot("s4-트윈");

// S5 — [이 판단으로 대응하기] → 상황대응 (판정 카드 · SOP 제안 상태)
await page.getByRole("button", { name: "이 판단으로 대응하기" }).click();
await page.waitForTimeout(3500);
await shot("s5-상황대응-권고");

// S6 — 등급 승인 → 전체 승인 → 실행
await page.getByRole("button", { name: /대응등급 대피로 상향/ }).click();
await page.waitForTimeout(800);
await shot("s6a-승인-직후");
await page.getByRole("button", { name: "전체 승인" }).click();
await page.getByRole("button", { name: "승인 · 실행" }).click();
await page.waitForTimeout(2500);
await shot("s7-실행결과-실패");

// S7 — [유선 보고 기록]
await page.getByRole("button", { name: /유선 보고 기록/ }).click();
await page.waitForTimeout(600);
await shot("s7b-유선보고");

// S8 — [상세 기록 보기] → 통계·분석 (22:10)
await page.getByRole("button", { name: /상세 기록 보기/ }).click();
await page.waitForTimeout(3000);
await shot("s8-통계-상단");
await page.mouse.wheel(0, 1200);
await page.waitForTimeout(800);
await shot("s8b-통계-하단");

// S9 — 종합상황 복귀 → 질의 칩 → AI 검색
await page.getByLabel("종합상황으로 이동").click();
await page.waitForTimeout(2500);
await page.getByText("서항지구 수위가 왜 오르고 있어?").first().click();
await page.waitForTimeout(2000);
await shot("s9-AI검색");

await browser.close();
console.log("walkthrough done");
