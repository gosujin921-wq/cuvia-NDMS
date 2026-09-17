/* ─────────────────────────────────────────────
 * 서항 강우 → 도로 수위 규칙 보정 — 2024-09-21 실제 사건으로 (2026-09-17 · /scr-00)
 *
 * 규칙: 수위(EL.m) = 바닥 + k · max(0, 누적 강우 − 한계강우량)
 *   누적 강우   배수권역 위 기상청 국지예보모델 재분석 격자(public/weather/precipitation-field.json · Open-Meteo) 시간 합
 *   한계강우량  24년 도시침수 완료보고 p.41 "침수심 대 한계강우량" 표(40 · 50 · 70 mm). 서항 지점 대응이 표에 없어 중앙값 50 을 쓴다
 *   바닥        지형 굽기의 시드 바닥 높이(scripts/bake-flood-seohang.mjs 와 같은 칸)
 *   k           **보정값**. 첨두 수위에서 지형 채우기 면적이 생활안전지도 침수흔적도(IF_0092)의 배수권역 안 표식 면적과 같아지도록 잡는다
 *
 * 무엇이 실자료이고 무엇이 가정인지:
 *   실자료   강우 격자(모델 재분석) · 침수흔적도 면적 · 10 m 지형
 *   공식값   한계강우량 표(p.41)
 *   가정     한계강우량의 지점 대응(중앙값) · 침수흔적이 이 사건의 것이라는 것(흔적도는 사건 연도를 안 준다 · GetFeatureInfo 400)
 *   미확보   하천·노면 수위 시계열(홍수통제소) · 펌프 제원·가동 로그 · 조위 영향 → 규칙에 없다. 오면 같은 자리에서 재보정
 *
 * 실행: designs/ 에서 `node scripts/calibrate-rain-rule-seohang.mjs` (침수흔적도는 WMS 를 실제로 받는다)
 * 산출: src/fixtures/seohang-flood/rain-rule.generated.ts
 * ───────────────────────────────────────────── */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { inflateSync } from "node:zlib";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const P_LIM = 50; // mm · p.41 중앙값
const SAFEMAP_KEY = "HVS1OPHY-HVS1-HVS1-HVS1-HVS1OPHYU3";

/* ── 지형 · 채우기 (bake-flood-seohang 과 같은 규칙) ── */
const grid = JSON.parse(await readFile(path.join(ROOT, "public", "weather", "terrain-fine.json"), "utf8"));
const patch = grid.patches.seohang;
const { nx, ny, west: W, south: S, lngStep: LX, latStep: LY, elev } = patch;
const BBOX = [128.568, 35.1935, 128.576, 35.2035];
const BOWL = [128.569, 35.198, 128.5735, 35.2017];
const lngOf = (ix) => W + ix * LX, latOf = (iy) => S + iy * LY;
const inBox = (ix, iy) => lngOf(ix) >= BBOX[0] && lngOf(ix) <= BBOX[2] && latOf(iy) >= BBOX[1] && latOf(iy) <= BBOX[3];
const cell = (ix, iy) => elev[iy * nx + ix];
let seedIx = -1, seedIy = -1, seedZ = Infinity;
for (let iy = 1; iy < ny - 1; iy += 1) for (let ix = 1; ix < nx - 1; ix += 1) {
  const lng = lngOf(ix), lat = latOf(iy);
  if (lng < BOWL[0] || lng > BOWL[2] || lat < BOWL[1] || lat > BOWL[3]) continue;
  let land = true;
  for (let dy = -1; dy <= 1 && land; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (cell(ix + dx, iy + dy) <= 1.0) { land = false; break; }
  if (land && cell(ix, iy) < seedZ) { seedZ = cell(ix, iy); seedIx = ix; seedIy = iy; }
}
function fillCells(level) {
  const mask = new Uint8Array(nx * ny); const q = [[seedIx, seedIy]]; mask[seedIy * nx + seedIx] = 1; let n = 1;
  while (q.length) {
    const [ix, iy] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const jx = ix + dx, jy = iy + dy;
      if (jx < 0 || jy < 0 || jx >= nx || jy >= ny) continue;
      const i = jy * nx + jx;
      if (mask[i] || !inBox(jx, jy)) continue;
      const z = cell(jx, jy);
      if (z <= 0 || z >= level) continue;
      mask[i] = 1; n += 1; q.push([jx, jy]);
    }
  }
  return n;
}
const haOf = (level) => Number(((fillCells(level) * 100) / 10000).toFixed(2)); // 10 m 칸 = 100 m²
const AREA_TABLE = [];
for (let L = Math.round(seedZ * 20) / 20; L <= 6.0 + 1e-9; L += 0.05) AREA_TABLE.push([Number(L.toFixed(2)), haOf(L)]);
console.log(`바닥 ${seedZ} m · 면적표 ${AREA_TABLE.length}칸 (${AREA_TABLE[0][0]}~${AREA_TABLE[AREA_TABLE.length - 1][0]} m)`);

/* ── 침수흔적도 면적 (배수권역 안) ── */
const geomSrc = await readFile(path.join(ROOT, "src", "fixtures", "seohang-flood", "geometry.generated.ts"), "utf8");
const ring = JSON.parse(geomSrc.match(/"GEO-BASIN-SH-01": (\[\[[^\]]*\](?:,\[[^\]]*\])*\])/)[1]);
const inRing = (lon, lat) => { let ins = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) ins = !ins; } return ins; };
const lons = ring.map((p) => p[0]), lats = ring.map((p) => p[1]);
const pad = 0.0015, bW = Math.min(...lons) - pad, bE = Math.max(...lons) + pad, bS = Math.min(...lats) - pad, bN = Math.max(...lats) + pad;
const R = 6378137, toX = (lon) => (R * lon * Math.PI) / 180, toY = (lat) => R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const fromX = (x) => ((x / R) * 180) / Math.PI, fromY = (y) => ((2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180) / Math.PI;
const mb = [toX(bW), toY(bS), toX(bE), toY(bN)], PX = 1024;
const url = `https://www.safemap.go.kr/openapi2/IF_0092_WMS?serviceKey=${SAFEMAP_KEY}&layers=A2SM_FLUDMARKS&styles=&format=image/png&srs=EPSG:3857&width=${PX}&height=${PX}&transparent=TRUE&bbox=${mb.join(",")}`;
const res = await fetch(url);
if (!res.ok) throw new Error(`침수흔적도 WMS ${res.status}`);
const png = Buffer.from(await res.arrayBuffer());
if (png.readUInt32BE(0) !== 0x89504e47) throw new Error("침수흔적도 응답이 PNG 가 아니다");
let p = 8, w = 0, h = 0, ct = 0; const idat = []; let plte = null, trns = null;
while (p < png.length) { const len = png.readUInt32BE(p); const type = png.toString("ascii", p + 4, p + 8); const data = png.subarray(p + 8, p + 8 + len); if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; } else if (type === "IDAT") idat.push(data); else if (type === "PLTE") plte = data; else if (type === "tRNS") trns = data; p += 12 + len; if (type === "IEND") break; }
const bpp = ct === 6 ? 4 : ct === 2 ? 3 : ct === 4 ? 2 : 1; const raw = inflateSync(Buffer.concat(idat)); const stride = w * bpp; const img = Buffer.alloc(h * stride);
let q = 0; for (let y = 0; y < h; y += 1) { const f = raw[q++]; const row = img.subarray(y * stride, (y + 1) * stride); const prev = y ? img.subarray((y - 1) * stride, y * stride) : null; for (let x = 0; x < stride; x += 1) { const a = x >= bpp ? row[x - bpp] : 0, b = prev ? prev[x] : 0, c = prev && x >= bpp ? prev[x - bpp] : 0; let v = raw[q++]; if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; } row[x] = v & 255; } }
let flood = 0;
for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) { const lon = fromX(mb[0] + ((x + 0.5) / w) * (mb[2] - mb[0])), lat = fromY(mb[3] - ((y + 0.5) / h) * (mb[3] - mb[1])); if (!inRing(lon, lat)) continue; const i = y * stride + x * bpp; const alpha = ct === 6 ? img[i + 3] : ct === 3 ? (trns && img[i] < trns.length ? trns[img[i]] : 255) : 255; if (alpha > 0) flood += 1; }
const mPerPx = ((mb[2] - mb[0]) / w) * Math.cos((((bS + bN) / 2) * Math.PI) / 180);
const OBS_HA = Number(((flood * mPerPx * mPerPx) / 10000).toFixed(2));
console.log(`침수흔적도 · 배수권역 안 ${OBS_HA} ha (${flood} px · ${mPerPx.toFixed(2)} m/px)`);

/* ── 강우 시계열 (배수권역 최근접 칸) ── */
const rf = JSON.parse(await readFile(path.join(ROOT, "public", "weather", "precipitation-field.json"), "utf8"));
const cx = lons.reduce((a, b) => a + b) / lons.length, cy = lats.reduce((a, b) => a + b) / lats.length;
const rix = Math.round((cx - rf.bbox[0]) / rf.step), riy = Math.round((cy - rf.bbox[1]) / rf.step);
const SERIES = rf.hours.map((hh, k) => [hh, Number(rf.rain[k][riy * rf.nx + rix].toFixed(1))]);
let cum = 0; const CUM = SERIES.map(([, v]) => Number((cum += v).toFixed(1)));
console.log(`강우(mm/h) ${SERIES.map(([hh, v]) => `${hh}시 ${v}`).join(" · ")} → 누적 ${CUM[CUM.length - 1]} mm`);

/* ── 보정: 첨두 수위 L* 는 면적표에서 OBS_HA 를 주는 수위, k = (L* − 바닥) / (누적 최대 − 한계) ── */
let Lstar = AREA_TABLE[AREA_TABLE.length - 1][0];
for (let i = 1; i < AREA_TABLE.length; i += 1) { const [l0, a0] = AREA_TABLE[i - 1], [l1, a1] = AREA_TABLE[i]; if (a0 <= OBS_HA && a1 >= OBS_HA) { Lstar = a1 === a0 ? l0 : l0 + ((OBS_HA - a0) / (a1 - a0)) * (l1 - l0); break; } }
const Pmax = CUM[CUM.length - 1];
if (Pmax <= P_LIM) throw new Error(`누적 강우 ${Pmax} mm 가 한계 ${P_LIM} mm 를 못 넘는다 — 보정 불가`);
const K = Number(((Lstar - seedZ) / (Pmax - P_LIM)).toFixed(5));
console.log(`첨두 수위 L* ${Lstar.toFixed(2)} m (면적 ${OBS_HA} ha) · 한계 ${P_LIM} mm · k ${K} m/mm`);

const ts = `/* 자동 생성 — scripts/calibrate-rain-rule-seohang.mjs (${new Date().toISOString().slice(0, 10)}). 손으로 고치지 않는다.
 * 서항 강우 → 도로 수위 규칙: 수위 = L_BASE + K · max(0, 누적 강우 − P_LIM). 무엇이 실자료·공식값·가정인지는 스크립트 머리말. */

/** 배수권역 시간별 강우(mm/h) · ${rf.date} · ${rf.source} · 최근접 격자 칸 (${rix}, ${riy}) */
export const RAIN_SERIES: [number, number][] = ${JSON.stringify(SERIES)};
/** 한계강우량(mm) — 24년 도시침수 완료보고 p.41 표 중앙값. 서항 지점 대응 미확정 */
export const P_LIM = ${P_LIM};
/** 그릇 바닥(EL.m) — 지형 굽기 시드 */
export const L_BASE = ${seedZ};
/** 보정 계수(m/mm) — 첨두 수위에서 지형 채우기 면적 = 침수흔적도 배수권역 안 면적(${OBS_HA} ha) */
export const K = ${K};
/** 보정 목표 — 생활안전지도 침수흔적도(IF_0092) 배수권역 안 표식 면적(ha) · 사건 연도는 자료가 안 준다 */
export const OBS_AREA_HA = ${OBS_HA};
/** 수위(EL.m) → 침수 면적(ha) 표 · 0.05 m 간격 · 10 m 지형 욕조 채우기 */
export const AREA_TABLE: [number, number][] = ${JSON.stringify(AREA_TABLE)};
`;
const outPath = path.join(ROOT, "src", "fixtures", "seohang-flood", "rain-rule.generated.ts");
await writeFile(outPath, ts);
console.log(`완료 → ${path.relative(ROOT, outPath)}`);
