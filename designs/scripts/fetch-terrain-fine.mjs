/* ─────────────────────────────────────────────
 * 서항 배수권역 고해상 지형 패치 굽기 — MapTiler terrain-rgb-v2 z14 · 약 10m 간격
 *
 * 90m 격자(terrain-grid.json)는 배수권역(폭 800m)을 아홉 칸으로 보여 침수면이 상자로 보인다.
 * 침수 씬이 "물이 저지대·골목을 따라 차오른다"로 읽히려면 칸이 도로 폭 수준이어야 한다.
 * 같은 타일(terrain-rgb-v2)을 z14(최대 줌)로 받아 서항 중심 ±800m 를 10m 간격으로 뜬다.
 * 방식은 fetch-terrain-grid.mjs 와 같다(크로미엄 canvas 로 WebP 픽셀 읽기 · dev 서버가 출처).
 *
 * 준비: dev 서버(:5400)  실행: designs/ 에서 `node scripts/fetch-terrain-fine.mjs`
 * 산출: public/weather/terrain-fine.json — patches.seohang (TerrainPatch 와 같은 모양)
 * ───────────────────────────────────────────── */

import path from "node:path";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:5400";
const KEY = "WPWmpNf4y5nzKDA7mQXe";
const ZOOM = 14; // terrain-rgb-v2 최대 줌. 512px 타일 ≈ 7.8m/px
const RADIUS_M = 800;
const STEP_M = 10;
const PATCHES = [{ id: "seohang", lng: 128.567, lat: 35.197 }];

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "weather", "terrain-fine.json");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });

const result = await page.evaluate(async ({ patches, key, zoom, radiusM, stepM }) => {
  const M_PER_DEG_LAT = 111320;
  const tiles = new Map();
  async function tileAt(tx, ty) {
    const k = `${tx}/${ty}`;
    if (!tiles.has(k)) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = `https://api.maptiler.com/tiles/terrain-rgb-v2/${zoom}/${tx}/${ty}.webp?key=${key}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      tiles.set(k, { size: img.naturalWidth, data: g.getImageData(0, 0, c.width, c.height).data });
    }
    return tiles.get(k);
  }
  async function elevationAt(lng, lat) {
    const n = 2 ** zoom;
    const xw = ((lng + 180) / 360) * n;
    const r = (lat * Math.PI) / 180;
    const yw = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
    const tx = Math.floor(xw), ty = Math.floor(yw);
    const t = await tileAt(tx, ty);
    const px = Math.min(t.size - 1, Math.floor((xw - tx) * t.size));
    const py = Math.min(t.size - 1, Math.floor((yw - ty) * t.size));
    const i = (py * t.size + px) * 4;
    return -10000 + (t.data[i] * 65536 + t.data[i + 1] * 256 + t.data[i + 2]) * 0.1;
  }
  const out = {};
  for (const p of patches) {
    const latStep = stepM / M_PER_DEG_LAT;
    const lngStep = stepM / (M_PER_DEG_LAT * Math.cos((p.lat * Math.PI) / 180));
    const half = Math.ceil(radiusM / stepM);
    const n = half * 2 + 1;
    const west = p.lng - half * lngStep, south = p.lat - half * latStep;
    const elev = new Array(n * n);
    for (let iy = 0; iy < n; iy += 1) for (let ix = 0; ix < n; ix += 1) elev[iy * n + ix] = Number((await elevationAt(west + ix * lngStep, south + iy * latStep)).toFixed(1));
    out[p.id] = { center: [p.lng, p.lat], west: Number(west.toFixed(6)), south: Number(south.toFixed(6)), lngStep: Number(lngStep.toFixed(8)), latStep: Number(latStep.toFixed(8)), nx: n, ny: n, elev };
  }
  return { patches: out, tileCount: tiles.size };
}, { patches: PATCHES, key: KEY, zoom: ZOOM, radiusM: RADIUS_M, stepM: STEP_M });
await browser.close();

const out = { source: "MapTiler terrain-rgb-v2 (지도 스타일과 같은 타일)", zoom: ZOOM, stepM: STEP_M, patches: result.patches };
await writeFile(OUT, JSON.stringify(out));
for (const [id, p] of Object.entries(result.patches)) console.log(`${id} ${p.nx}×${p.ny} · ${Math.min(...p.elev)}~${Math.max(...p.elev)}m`);
console.log(`완료 → public/weather/terrain-fine.json (${Math.round(JSON.stringify(out).length / 1024)} KB · 타일 ${result.tileCount}장)`);
