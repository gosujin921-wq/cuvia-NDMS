/* ─────────────────────────────────────────────
 * 시연 대본 자동 주행 — 05 시나리오 S0~S9 를 순서대로 밟으며 화면을 찍는다.
 *
 * SPA 클라이언트 내비게이션으로만 이동한다(페이지 새로고침 = S0 리셋이라서).
 * 스텝은 전부 화면 조작으로 밟는다 — 조작판에는 이벤트 발사 목록이 없다(04 §0-2).
 * 격상은 S2 팝업 3초 뒤 엔진이 올린다. 산출물로 "정본대로 구현됐는가"를 눈으로 검증한다.
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

// S2 — 수위계 선택 → 센서 팝업(주의보) → 3초 뒤 엔진이 격상 (04 §0)
// 사건 캡슐의 [수위계 1호기 탐지] = 센서 선택(03 §2). 캡슐이 주기적으로 다시 그려져
// 클릭 안정 대기에 걸리므로 dispatchEvent 로 누른다
await page.getByRole("button", { name: /수위계 1호기 탐지/ }).first().dispatchEvent("click");
await page.waitForTimeout(1000);
await shot("s2a-팝업-주의보");
// 격상 타이머(3초) + 다시 그려지는 시간
await page.waitForTimeout(3500);
await shot("s2b-격상-경보");

// S4 — [디지털트윈 분석] (S3 CCTV 는 정적 확인이라 생략)
await page.getByRole("button", { name: "디지털트윈 분석" }).click();
await page.waitForTimeout(6000);
await shot("s4-트윈");

// S5 — [이 판단으로 대응하기] → 재난관제 복귀. 판단 국면 — 레일 사건 블록(판정 카드) 강조
await page.getByRole("button", { name: "이 판단으로 대응하기" }).click();
await page.waitForTimeout(3500);
await shot("s5a-재난관제-판단국면");

// S5b — [대응 실행] → 대응 실행 집중 팝업 (제안 상태 · 03 §2 · 차수 N)
await page.getByRole("button", { name: "대응 실행" }).click();
await page.waitForTimeout(900);
await shot("s5b-집중팝업-제안");

// S6 — 팝업 안: 등급 승인 → 전체 선택 → 실행 (항목이 0.45초 간격으로 결과로 진화한다)
await page.getByRole("button", { name: /대응등급 대피로 상향/ }).click();
await page.waitForTimeout(800);
await shot("s6a-승인-직후");
await page.getByRole("button", { name: "전체 선택" }).click();
await page.getByRole("button", { name: "승인 · 실행" }).click();
await page.waitForTimeout(2800);
await shot("s7-실행결과-실패");

// S7 — [유선 보고 기록] → [관제 화면으로 돌아가기] → 레일이 결과 요약을 이어 보인다
await page.getByRole("button", { name: /유선 보고 기록/ }).click();
await page.waitForTimeout(600);
await shot("s7b-유선보고");
await page.getByRole("button", { name: "관제 화면으로 돌아가기" }).click();
await page.waitForTimeout(900);
await shot("s7c-레일-결과요약");

// S8 — 좌측 메뉴 [통계·분석] (22:10) → 시 전체 → 서항 드릴다운 → [사건 이력] 탭
await page.getByTitle(/SCR-04/).click();
await page.waitForTimeout(3000);
await shot("s8-통계-상단");
await page.getByRole("row", { name: /서항지구/ }).click();
await page.mouse.wheel(0, 1200);
await page.waitForTimeout(800);
await shot("s8b-통계-하단");
await page.getByRole("tab", { name: "사건 이력" }).click();
await page.waitForTimeout(1200);
await shot("s8c-사건이력");

// S9 — 종합상황 복귀 → 질의 바 포커스(칩은 포커스 시에만 열린다 · 03 §1) → 질의 칩 → AI 검색
await page.getByLabel("종합상황으로 이동").click();
await page.waitForTimeout(2500);
await page.getByLabel("자연어 질의").click();
await page.getByText("서항지구 수위가 왜 오르고 있어?").first().click();
await page.waitForTimeout(2000);
await shot("s9-AI검색");

await browser.close();
console.log("walkthrough done");
