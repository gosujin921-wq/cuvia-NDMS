/* ─────────────────────────────────────────────
 * 화면 스크린샷 — 대조용
 *
 * 구현 화면을 화면정의서와 나란히 놓고 보려면 같은 조건에서 찍은 그림이 필요하다.
 * 기준 뷰포트는 1600 × 1000.
 *
 * 준비: dev 서버(`corepack pnpm dev`)를 띄우고, 브라우저 구동 패키지를 받는다.
 *   corepack pnpm add -D playwright-core
 *   corepack pnpm exec playwright install chromium
 *
 * 사용:
 *   node scripts/shoot.mjs                 # SCR-01~05 전부
 *   node scripts/shoot.mjs scr-03 scr-05   # 지정 화면만
 *   OUT=../shots WIDTH=1920 HEIGHT=1080 node scripts/shoot.mjs
 * ───────────────────────────────────────────── */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:5400";
const OUT = process.env.OUT ?? "shots";
const WIDTH = Number(process.env.WIDTH ?? 1600);
const HEIGHT = Number(process.env.HEIGHT ?? 1000);
/** 맵·3D·그래프가 자리를 잡는 데 걸리는 시간 */
const SETTLE = Number(process.env.SETTLE ?? 4000);

const ALL = Array.from({ length: 5 }, (_, i) => `scr-0${i + 1}`);
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

/** 설치된 chromium 을 캐시에서 찾는다. 버전 폴더명이 갱신돼도 따라간다 */
function findChromium() {
  const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
  const dirs = fs
    .readdirSync(cache)
    .filter((d) => d.startsWith("chromium-"))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const dir of dirs) {
    const exec = path.join(
      cache,
      dir,
      "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    );
    if (fs.existsSync(exec)) return exec;
  }
  throw new Error("chromium 을 찾지 못했다. corepack pnpm exec playwright install chromium");
}

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()} ${m.text()}`));
page.on("pageerror", (e) => errors.push(`${page.url()} ${String(e)}`));

for (const route of targets) {
  await page.goto(`${BASE}/${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(SETTLE);
  const file = path.join(OUT, `${route}.png`);
  await page.screenshot({ path: file });
  /* 세로 스크롤이 생기는지도 함께 본다. 밀도 판정의 근거가 된다 */
  const overflow = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  console.log(`${route}  →  ${file}  (넘침 ${overflow}px)`);
}

console.log(errors.length ? `콘솔 에러 ${errors.length}건\n${errors.join("\n")}` : "콘솔 에러 없음");
await browser.close();
