/* 매뉴얼 라벨용 요소 목록 뽑기 — 경로로 바로 들어가 조작 요소를 훑는다 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:5400";
const OUT = path.resolve("../manual-capture");

function findChromium() {
  const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
  const dir = fs
    .readdirSync(cache)
    .filter((d) => d.startsWith("chromium-"))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]))[0];
  return path.join(
    cache,
    dir,
    "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  );
}

const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

for (const route of process.argv.slice(2)) {
  await page.goto(`${BASE}/${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(6000);
  const inv = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll(
      'button, [role="button"], [role="tab"], [role="row"], [role="combobox"], input, section, [aria-label]',
    )) {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.display === "none") continue;
      out.push({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute("role") ?? "",
        aria: el.getAttribute("aria-label") ?? "",
        text: (el.textContent ?? "").trim().slice(0, 60),
        box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      });
    }
    return out;
  });
  const name = route.replace(/\//g, "_");
  fs.writeFileSync(path.join(OUT, `probe-${name}.json`), JSON.stringify(inv, null, 2));
  await page.screenshot({ path: path.join(OUT, `probe-${name}.png`) });
  console.log(`${route} → ${inv.length}건`);
}

await browser.close();
