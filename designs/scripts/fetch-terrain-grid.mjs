/* ─────────────────────────────────────────────
 * 지형 고도 격자 굽기 — MapTiler terrain-rgb-v2 · 지구별 패치
 *
 * 트윈(SCR-05) 침수면이 쓸 고도 격자를 굽는다. 12개 지구 중심 둘레 ±1.3km 씩,
 * 약 90m 간격 격자를 지구별 패치로 담는다.
 *
 * ⚠ 반드시 지도 스타일이 무는 것과 **같은 타일**(terrain-rgb-v2)을 받아야 한다.
 *   다른 고도 자료를 물리면 렌더 지형과 수면이 몇 m 씩 어긋난다(외부-API-인계 §5).
 *
 * 브라우저(playwright chromium)를 띄우는 것은 MapTiler 가 확장자와 무관하게 WebP
 * (VP8L)를 주는데 노드에 WebP 디코더가 없어서다 — .png 로 요청해도 WebP 가 온다.
 * 크로미엄 canvas 로 픽셀을 읽는다. about:blank 는 출처가 없어 canvas 를 못 읽으므로
 * dev 서버를 출처로 삼는다. 크로미엄 탐색은 shoot.mjs 의 findChromium 과 같은 패턴
 * (macOS arm64 전용 경로 — 다른 OS 에서 이어받으면 이 부분을 고쳐야 한다).
 *
 * 준비: dev 서버(`corepack pnpm dev`, :5400)가 떠 있어야 한다
 * 실행: designs/ 에서 `node scripts/fetch-terrain-grid.mjs` (약 1분)
 * ───────────────────────────────────────────── */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:5400";
const KEY = "WPWmpNf4y5nzKDA7mQXe"; // CUVIA 제품군 공용 — map-config.ts 와 같은 키여야 한다
const ZOOM = 12; // 픽셀 ≈ 15m(512px 타일) — 90m 격자를 뜨기에 충분하고 타일 수가 적다
/** 패치 반경 (m) — 침수 씬(flood-scene)이 그리는 범위보다 넉넉히 */
const RADIUS_M = 1300;
/** 격자 간격 (m 근사) — 위경도 간격은 지구 위도에서 환산한다 */
const STEP_M = 90;

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "weather", "terrain-grid.json");

/* ── 지구 중심 — demo/districts.ts 의 리터럴을 그대로 읽는다 (지구가 늘면 다시 굽는다) ── */
const districtsSource = await readFile(path.join(ROOT, "src", "demo", "districts.ts"), "utf8");
const districts = [...districtsSource.matchAll(
  /id:\s*"([a-z]+)"[^\n]*?center:\s*\[([\d.]+),\s*([\d.]+)\]/g,
)].map((m) => ({ id: m[1], lng: Number(m[2]), lat: Number(m[3]) }));
if (districts.length === 0) {
  console.error("districts.ts 에서 지구 중심을 읽지 못했다 — 파일 형식이 바뀌었나");
  process.exit(1);
}
console.log(`지구 ${districts.length}곳 · 반경 ${RADIUS_M}m · 간격 ${STEP_M}m · z${ZOOM}`);

/** 설치된 chromium 을 캐시에서 찾는다 — shoot.mjs 와 같은 패턴 */
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

const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage();
try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
} catch {
  console.error(`dev 서버(${BASE})에 못 붙었다 — designs/ 에서 corepack pnpm dev 를 먼저 띄울 것`);
  await browser.close();
  process.exit(1);
}

/* 타일 로드·픽셀 샘플링은 전부 페이지 안에서 — 타일 원본을 노드로 나르지 않는다 */
const patches = await page.evaluate(
  async ({ districts, key, zoom, radiusM, stepM }) => {
    const M_PER_DEG_LAT = 111320;
    const tiles = new Map();

    async function tileAt(tx, ty) {
      const cacheKey = `${tx}/${ty}`;
      if (!tiles.has(cacheKey)) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = `https://api.maptiler.com/tiles/terrain-rgb-v2/${zoom}/${tx}/${ty}.webp?key=${key}`;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        tiles.set(cacheKey, {
          size: img.naturalWidth,
          data: ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight).data,
        });
      }
      return tiles.get(cacheKey);
    }

    /** terrain-rgb 규격 — 고도(m) = -10000 + RGB × 0.1 */
    async function elevationAt(lng, lat) {
      const n = 2 ** zoom;
      const xWorld = ((lng + 180) / 360) * n;
      const rad = (lat * Math.PI) / 180;
      const yWorld = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
      const tx = Math.floor(xWorld);
      const ty = Math.floor(yWorld);
      const tile = await tileAt(tx, ty);
      const px = Math.min(tile.size - 1, Math.floor((xWorld - tx) * tile.size));
      const py = Math.min(tile.size - 1, Math.floor((yWorld - ty) * tile.size));
      const i = (py * tile.size + px) * 4;
      return -10000 + (tile.data[i] * 65536 + tile.data[i + 1] * 256 + tile.data[i + 2]) * 0.1;
    }

    /* 지구별 패치 — 남→북 행, 서→동 열. index = iy*nx + ix */
    const result = {};
    for (const district of districts) {
      const latStep = stepM / M_PER_DEG_LAT;
      const lngStep = stepM / (M_PER_DEG_LAT * Math.cos((district.lat * Math.PI) / 180));
      const half = Math.ceil(radiusM / stepM);
      const n = half * 2 + 1;
      const west = district.lng - half * lngStep;
      const south = district.lat - half * latStep;

      const elev = new Array(n * n);
      for (let iy = 0; iy < n; iy += 1)
        for (let ix = 0; ix < n; ix += 1)
          elev[iy * n + ix] = Number(
            (await elevationAt(west + ix * lngStep, south + iy * latStep)).toFixed(1),
          );

      result[district.id] = {
        center: [district.lng, district.lat],
        west: Number(west.toFixed(6)),
        south: Number(south.toFixed(6)),
        lngStep: Number(lngStep.toFixed(8)),
        latStep: Number(latStep.toFixed(8)),
        nx: n,
        ny: n,
        elev,
      };
    }
    return { patches: result, tileCount: tiles.size };
  },
  { districts, key: KEY, zoom: ZOOM, radiusM: RADIUS_M, stepM: STEP_M },
);

await browser.close();

for (const [id, patch] of Object.entries(patches.patches)) {
  const half = (patch.nx - 1) / 2;
  const centerElev = patch.elev[half * patch.nx + half];
  console.log(
    `${id.padEnd(14)} 중심 ${centerElev}m · 범위 ${Math.min(...patch.elev)}~${Math.max(...patch.elev)}m`,
  );
}

const out = {
  source: "MapTiler terrain-rgb-v2 (지도 스타일과 같은 타일)",
  zoom: ZOOM,
  stepM: STEP_M,
  patches: patches.patches,
};
await writeFile(OUT, JSON.stringify(out));
console.log(
  `완료 → public/weather/terrain-grid.json (${Math.round(JSON.stringify(out).length / 1024)} KB · 타일 ${patches.tileCount}장)`,
);
