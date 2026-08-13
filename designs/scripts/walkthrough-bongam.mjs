/* ─────────────────────────────────────────────
 * 봉암 트랙 자동 주행 — 트랙 B(8/13 호우·내수침수) B0~B9 를 순서대로 밟으며 화면을 찍는다.
 *
 * 서항 대본(walkthrough.mjs)과 다른 곳만 보면 된다:
 *   · 트랙을 조작판(0 키)에서 발사한다. 앱은 서항 상태로 열리므로 봉암은 발사가 시작이다
 *   · 격상이 팝업이 아니라 **재난관제 진입**에 물린다 — 지도가 앉고 2초 (04 §15-1).
 *     그래서 B1 은 격상 전(08:50)·후(08:52) 두 장을 찍는다
 *   · 대표 사건이 격상 순간 집중호우 → 내수침수로 갈아탄다(04 §15-3). B1 두 장의 캡슐이
 *     그 증거다
 *   · B9 에서 질의 칩을 누르지 않는다. 데모 답변은 서항 것뿐이라(04 §14-5) 봉암 트랙에서
 *     칩을 누르면 어제 사건의 답이 나온다. 화면 진입(13:24)까지만 밟는다
 *
 * 사용: dev 서버 띄우고  OUT=<dir> BASE_URL=http://localhost:5401 node scripts/walkthrough-bongam.mjs
 * ───────────────────────────────────────────── */

import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:5401";
const OUT = process.env.OUT ?? "shots";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ✓ ${name}`);
};

// B0 — 종합상황에서 조작판(0 키)으로 트랙 발사. 유입 3건이 1.6초 간격으로 태어난다
await page.goto(`${BASE}/scr-01`, { waitUntil: "networkidle" });
await page.waitForTimeout(5000);
await page.keyboard.press("0");
await page.getByRole("button", { name: /봉암 호우/ }).first().click();
// 유입(1.6초 x 3) + 안착
await page.waitForTimeout(6000);
await shot("b0-종합상황"); // 08:30 · 두 사건 모두 주의보 · 알람 2건

// B1 — 봉암지구 클릭 → 재난관제. 지도가 앉고 2초 뒤 엔진이 격상한다 (04 §15-1)
await page.getByRole("button", { name: /^봉암지구 내수/ }).first().dispatchEvent("click");
await page.waitForTimeout(900);
await shot("b1a-진입-격상전"); // 08:50 · 대표는 집중호우 경보 · 내수침수는 아직 주의보
// 지도 ready + 2초 타이머 + 화면이 갈아 끼는 시간
await page.waitForTimeout(4500);
await shot("b1b-격상-경보"); // 08:52 · 대표가 내수침수 경보 4.02 로 갈아탄다

// B2 — 계측 추이에서 강우량계 1호기 선택 → 센서 팝업 (비가 먼저, 물이 나중 · 04 §15-3)
await page.getByRole("button", { name: /강우량계 1호기/ }).first().dispatchEvent("click");
await page.waitForTimeout(1500);
await shot("b2-강우량계-팝업");

// B3 — 배수문 CCTV → 현장 확인. "센서가 아니라 운영 로그가 폐쇄를 말한다"(04 §15-6)
await page.getByRole("button", { name: /배수문 CCTV/ }).first().dispatchEvent("click");
await page.waitForTimeout(1500);
await shot("b3-배수문-CCTV");

// B4 — [디지털트윈으로 상세 분석]. 내수침수는 조건 축이 강우 지속·배수 제약이다
await page.getByRole("button", { name: /디지털트윈으로 상세 분석/ }).click();
await page.waitForTimeout(6000);
await shot("b4-트윈");

// B5 — [재난관제로 돌아가기] → 사건 지정 진입(`?event=`). 판단 국면
await page.getByRole("button", { name: /재난관제로 돌아가기/ }).click();
await page.waitForTimeout(3500);
await shot("b5-재난관제-판단국면");

// B6 — [대응 실행] → 집중 팝업 → 등급 승인. 계측은 대피 기준(5.83)에 닿지 않는데도
// 저지대 영향 시작(4.30)을 근거로 대피가 권고된다 — 이 트랙의 요지다 (04 §15-9)
await page.getByRole("button", { name: "대응 실행" }).click();
await page.waitForTimeout(900);
await shot("b6a-집중팝업-제안");
await page.getByRole("button", { name: /대응등급 대피로 상향/ }).click();
await page.waitForTimeout(800);
await shot("b6b-승인-직후");

// B7 — 전체 선택 → 승인·실행 → 실패 항목의 대체 조치(유선 보고) → 관제 복귀
await page.getByRole("button", { name: "전체 선택" }).click();
await page.getByRole("button", { name: "승인 · 실행" }).click();
await page.waitForTimeout(2800);
await shot("b7a-실행결과");
await page.getByRole("button", { name: /유선 보고 기록/ }).click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: "관제 화면으로 돌아가기" }).click();
await page.waitForTimeout(900);
await shot("b7b-레일-결과요약");

// B8 — 통계·분석 (13:20) → 봉암 드릴다운 → [사건 이력]
await page.getByTitle(/SCR-04/).click();
await page.waitForTimeout(3000);
await shot("b8-통계-상단");
await page.getByRole("row", { name: /봉암지구/ }).click();
await page.mouse.wheel(0, 1200);
await page.waitForTimeout(800);
await shot("b8b-통계-하단");
await page.getByRole("tab", { name: "사건 이력" }).click();
await page.waitForTimeout(1200);
await shot("b8c-사건이력");

// B9 — AI 검색 진입 (13:24). 레일에는 없다 — 우하단 질의 버튼이 유일한 길이다.
//      질의 칩은 누르지 않는다 — 데모 답변은 서항 것뿐이다
await page.getByRole("button", { name: "AI 검색으로 이동" }).click();
await page.waitForTimeout(2000);
await shot("b9-AI검색");

await browser.close();
console.log("walkthrough(봉암) done");
