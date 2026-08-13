/* 레이어 표식 확인 — SCR-02 팝오버(위험요소 그룹)와 SCR-05 레이어 패널을 찍는다 */
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:5401";
const OUT = process.env.OUT ?? "shots";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

// SCR-02 서항지구 — 레이어 팝오버 열기
await page.goto(`${BASE}/scr-02/seohang`, { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
await page.getByRole("button", { name: "레이어" }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/swatch-scr02-팝오버.png` });

// SCR-05 서항지구 — 레이어 패널은 상시 노출
await page.goto(`${BASE}/scr-05/seohang`, { waitUntil: "networkidle" });
await page.waitForTimeout(5000);
await page.screenshot({ path: `${OUT}/swatch-scr05-패널.png` });

await browser.close();
console.log("swatch check done");
