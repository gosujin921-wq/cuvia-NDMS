/* J-2 — 침수면이 지형 고도와 겨루는지(감사 D-1). 서항 트윈에서 침수를 켜고 3.0까지
   올린 화면을 찍는다. 균일한 두께로 덮이면 "낮은 자리부터 잠깁니다"가 거짓말이 된다 */
import { chromium } from "playwright-core";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto("http://localhost:5401/scr-05/seohang", { waitUntil: "networkidle" });
await page.waitForTimeout(6000);
// 레이어 패널에서 "범람시 침수 예상범위 보기" 스위치 켜기
await page.getByLabel("범람시 침수 예상범위 보기").click();
await page.waitForTimeout(500);
// 슬라이더 — range 는 fill 이 안 먹는다. 네이티브 setter + input 이벤트로 React 를 깨운다
const setLevel = (value) =>
  page.getByLabel("침수 예상 수위").evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
await setLevel("3.0");
await page.waitForTimeout(2500);
await page.screenshot({ path: process.env.OUT + "/flood-3.0.png" });
await setLevel("4.24");
await page.waitForTimeout(2500);
await page.screenshot({ path: process.env.OUT + "/flood-4.24.png" });
await browser.close();
console.log("done");
