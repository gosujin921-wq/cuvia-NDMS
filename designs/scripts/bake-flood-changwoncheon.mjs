/* ─────────────────────────────────────────────
 * 창원천 하류 범람면 굽기 — 고해상 지형(terrain-fine.json · changwoncheon)에서 수위 단계별 범람 형상을 뜬다 (03 §7 · §22 B)
 *
 * 도시침수(서항)와 다른 점은 하나다. 서항은 저지대 그릇 바닥에서 물을 채웠고 해발 0 이하(바다)는 건너지 않았다.
 * 하천은 **물길 자체가 물이 오르는 통로**라, 하구 물길(해발 0 근처)에서 시작해 물길을 따라 번지고 둑 너머 낮은 땅으로 넘친다.
 * 그래서 채우기가 물 칸(≤ WATER_M)을 건너간다. 결과는 둔치 → 천변도로 → 합류부 저지대 순으로 넓어진다.
 *
 * 수위 단계는 시나리오 편집값이다 — 수리·수문 모형 결과가 아니다. 수위는 하구·합류부의 수면 EL.m 이고
 * 종단도의 하류 관측소 수위와 같은 값이다(fixtures/conditions/changwoncheon.ts).
 *
 * 입력: public/weather/terrain-fine.json (fetch-terrain-fine.mjs) · scripts/changwoncheon-trace.json (베이스맵 채록)
 * 실행: designs/ 에서 `node scripts/bake-flood-changwoncheon.mjs`
 * 산출: src/fixtures/changwoncheon/geometry.generated.ts
 * ───────────────────────────────────────────── */

import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const grid = JSON.parse(await readFile(path.join(ROOT, "public", "weather", "terrain-fine.json"), "utf8"));
const trace = JSON.parse(await readFile(path.join(ROOT, "scripts", "changwoncheon-trace.json"), "utf8"));
const patch = grid.patches.changwoncheon;
const { nx, ny, west: W, south: S, lngStep: LX, latStep: LY, elev } = patch;

/** 물 칸 — terrain-rgb 가 수면을 0 근처로 본다. 이 아래는 물길이다 */
const WATER_M = 0.3;
/** 채우기 상자 — 하류 산단 구간부터 하구까지. 서쪽 끝은 하구, 이 밖(마산만·산자락)은 채우지 않는다 */
const BOX = [128.6045, 35.2055, 128.64, 35.233];
/** 시드 — 하구 물길 가운데 */
const SEED = [128.623, 35.2143];
/**
 * 단계별 수위(EL.m · 하구·합류부 수면). 둑이 낮은 둔치부터 잠기고 2.5 m 에서 하구 천변도로가, 3.5 m 에서 합류부 북안 저지대가 잠긴다.
 *   L10 둔치 가장자리 · L15 둔치 물참 · L20 둔치 전면 · L25 천변도로 침수 시작 · L28 천변도로 통행 불가 · L35 합류부 저지대 범람
 */
const STAGES = {
  "GEO-CW-L10": 1.0,
  "GEO-CW-L15": 1.5,
  "GEO-CW-L20": 2.0,
  "GEO-CW-L25": 2.5,
  "GEO-CW-L28": 2.8,
  /* 실제 대응(늦은 방류) 뒤 최고 수위 — 종료 사건 재분석의 기준 */
  "GEO-CW-L32": 3.2,
  "GEO-CW-L35": 3.5,
};
/**
 * 종단도 관측소 — 상류 → 하류. 좌표는 채록한 창원천 선 위, 하상고는 terrain-fine 한 칸 패치(cw-st-*)에서 읽는다.
 * 기준 수위는 관측소마다 다르다(하상에서 둑 높이만큼) — 상·중류는 하상 + 2.5 m, 하류·합류부는 천변도로가 잠기는 2.5 m.
 * 이름은 위치 설명이다. 실제 관측소 명칭이 아니다(시나리오 주체).
 */
const STATIONS = [
  { id: "a", label: "상류", at: [128.666, 35.2458], patch: "cw-st-a", rise: 2.5 },
  { id: "b", label: "중류", at: [128.6493, 35.239], patch: "cw-st-b", rise: 2.5 },
  { id: "c", label: "하류", at: [128.6362, 35.2236], patch: "cw-st-c", threshold: 2.5 },
  { id: "d", label: "합류부", at: [128.6279, 35.2165], bed: 0, threshold: 2.5 },
];

const lngOf = (ix) => W + ix * LX;
const latOf = (iy) => S + iy * LY;
const inBox = (ix, iy) => lngOf(ix) >= BOX[0] && lngOf(ix) <= BOX[2] && latOf(iy) >= BOX[1] && latOf(iy) <= BOX[3];
const cellAt = (lng, lat) => { const ix = Math.round((lng - W) / LX), iy = Math.round((lat - S) / LY); return ix >= 0 && iy >= 0 && ix < nx && iy < ny ? iy * nx + ix : -1; };
const seedI = cellAt(SEED[0], SEED[1]);

/** 채우기 — 시드에서 4방향으로, 수위 아래·상자 안. 물 칸은 건넌다(물길이 통로다) */
function fill(level) {
  const mask = new Uint8Array(nx * ny);
  const q = [seedI];
  mask[seedI] = 1;
  while (q.length) {
    const i = q.pop();
    const ix = i % nx, iy = (i - ix) / nx;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const jx = ix + dx, jy = iy + dy;
      if (jx < 0 || jy < 0 || jx >= nx || jy >= ny) continue;
      const j = jy * nx + jx;
      if (mask[j] || !inBox(jx, jy) || elev[j] >= level) continue;
      mask[j] = 1; q.push(j);
    }
  }
  return mask;
}

/** 마스크 외곽선 — 가장 긴 고리 하나(물길이 좌·우안을 이어 한 덩어리가 된다) */
function outline(mask) {
  const edges = new Map();
  const key = (x, y) => `${x},${y}`;
  const add = (ax, ay, bx, by) => edges.set(`${key(ax, ay)}|${key(bx, by)}`, [ax, ay, bx, by]);
  const on = (x, y) => x >= 0 && y >= 0 && x < nx && y < ny && mask[y * nx + x];
  for (let iy = 0; iy < ny; iy += 1) for (let ix = 0; ix < nx; ix += 1) {
    if (!mask[iy * nx + ix]) continue;
    if (!on(ix, iy - 1)) add(ix, iy, ix + 1, iy);
    if (!on(ix + 1, iy)) add(ix + 1, iy, ix + 1, iy + 1);
    if (!on(ix, iy + 1)) add(ix + 1, iy + 1, ix, iy + 1);
    if (!on(ix - 1, iy)) add(ix, iy + 1, ix, iy);
  }
  const byStart = new Map();
  for (const e of edges.values()) { const k = key(e[0], e[1]); (byStart.get(k) ?? byStart.set(k, []).get(k)).push(e); }
  const used = new Set(), loops = [];
  for (const e0 of edges.values()) {
    if (used.has(e0.join(","))) continue;
    const loop = [[e0[0], e0[1]]];
    let cur = e0;
    for (;;) {
      used.add(cur.join(","));
      const next = (byStart.get(key(cur[2], cur[3])) ?? []).find((e) => !used.has(e.join(",")));
      if (!next) break;
      loop.push([next[0], next[1]]);
      cur = next;
      if (next[2] === e0[0] && next[3] === e0[1]) { used.add(next.join(",")); break; }
    }
    loops.push(loop);
  }
  loops.sort((a, b) => b.length - a.length);
  return loops[0] ?? [];
}

function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const d2 = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
    const px = a[0] + t * dx - p[0], py = a[1] + t * dy - p[1];
    return px * px + py * py;
  };
  const rec = (i, j) => {
    let best = -1, bi = -1;
    for (let k = i + 1; k < j; k += 1) { const d = d2(pts[k], pts[i], pts[j]); if (d > best) { best = d; bi = k; } }
    return best > tol * tol ? [...rec(i, bi), ...rec(bi, j).slice(1)] : [pts[i], pts[j]];
  };
  return rec(0, pts.length - 1);
}

const M_LAT = 111320, M_LNG = 111320 * Math.cos((35.22 * Math.PI) / 180);
const dist = (a, b) => Math.hypot((b[0] - a[0]) * M_LNG, (b[1] - a[1]) * M_LAT);
/** 선을 step(m) 간격으로 촘촘히 */
function densify(line, step = 10) {
  const out = [];
  for (let i = 0; i < line.length - 1; i += 1) {
    const a = line[i], b = line[i + 1], n = Math.max(1, Math.round(dist(a, b) / step));
    for (let k = 0; k < n; k += 1) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  out.push(line[line.length - 1]);
  return out;
}
/** 도로 중 잠긴 구간 — 마른 땅 사이의 젖은 토막들. 다리(물 칸 위)는 잠긴 것으로 보지 않는다 */
function wetRuns(line, mask) {
  const pts = densify(line), runs = [];
  let cur = null;
  for (const p of pts) {
    const i = cellAt(p[0], p[1]);
    const wet = i >= 0 && elev[i] > WATER_M && mask[i] === 1;
    if (wet) (cur ??= []).push(p.map((v) => Number(v.toFixed(6))));
    else if (cur) { if (cur.length > 2) runs.push(cur); cur = null; }
  }
  if (cur && cur.length > 2) runs.push(cur);
  return runs;
}

const rings = {}, levels = {}, roadWet = {};
for (const [id, level] of Object.entries(STAGES)) {
  const mask = fill(level);
  let land = 0, water = 0;
  for (let i = 0; i < mask.length; i += 1) if (mask[i]) (elev[i] > WATER_M ? land++ : water++);
  const loop = simplify(outline(mask), 1.2);
  rings[id] = loop.map(([x, y]) => [Number(lngOf(x).toFixed(6)), Number(latOf(y).toFixed(6))]);
  levels[id] = level;
  roadWet[id] = { coast: wetRuns(trace.coastRoad, mask), trunk: wetRuns(trace.trunkRoad, mask) };
  const wetM = (runs) => Math.round(runs.reduce((a, r) => a + r.length * 10, 0));
  console.log(id.padEnd(12), `수위 ${level} · 둑 너머 ${(land / 100).toFixed(1)} ha · 꼭짓점 ${rings[id].length} · 천변도로 ${wetM(roadWet[id].coast)} m · 간선도로 ${wetM(roadWet[id].trunk)} m`);
}

/* 종단도 관측소 — 선 위 거리(km)와 하상고 */
const river = trace.river;
const cum = [0];
for (let i = 1; i < river.length; i += 1) cum.push(cum[i - 1] + dist(river[i - 1], river[i]));
const kmAt = (p) => {
  let best = 0, bi = 0;
  river.forEach((q, i) => { const d = dist(p, q); if (i === 0 || d < best) { best = d; bi = i; } });
  return { km: Number((cum[bi] / 1000).toFixed(2)), index: bi };
};
const stations = STATIONS.map((s) => {
  const bed = s.bed ?? Math.max(0, grid.patches[s.patch].elev[0]);
  const { km, index } = kmAt(s.at);
  return { id: s.id, label: s.label, at: s.at, km, index, bed: Number(bed.toFixed(1)), threshold: Number((s.threshold ?? bed + s.rise).toFixed(1)) };
});
for (const s of stations) console.log(`관측소 ${s.label} · ${s.km} km · 하상 ${s.bed} m · 기준 ${s.threshold} m`);

/* 분석 구간 — 하천을 따라 양쪽 SCOPE_HALF_M 띠. 상류 관측소부터 하구까지 한 화면에 담는 기준이자 지도의 분석 범위 */
const SCOPE_HALF_M = 280;
function corridor(line, halfM) {
  const left = [], right = [];
  for (let i = 0; i < line.length; i += 1) {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
    const dx = (b[0] - a[0]) * M_LNG, dy = (b[1] - a[1]) * M_LAT, len = Math.hypot(dx, dy) || 1;
    const ox = (-dy / len) * halfM / M_LNG, oy = (dx / len) * halfM / M_LAT;
    left.push([Number((line[i][0] + ox).toFixed(6)), Number((line[i][1] + oy).toFixed(6))]);
    right.push([Number((line[i][0] - ox).toFixed(6)), Number((line[i][1] - oy).toFixed(6))]);
  }
  return [...left, ...right.reverse()];
}
rings["GEO-CW-SCOPE"] = corridor(simplify(river.map((p) => [(p[0] - W) / LX, (p[1] - S) / LY]), 3).map(([x, y]) => [lngOf(x), latOf(y)]), SCOPE_HALF_M);

const ts = `/* 자동 생성 — scripts/bake-flood-changwoncheon.mjs (${new Date().toISOString().slice(0, 10)}). 손으로 고치지 않는다.
 * 고해상 지형(public/weather/terrain-fine.json · changwoncheon)에서 수위 단계별로 뜬 창원천 하류 범람면.
 * 수위는 시나리오 편집값(하구·합류부 수면 EL.m)이다. 하천·도로 선은 베이스맵 채록(scripts/changwoncheon-trace.json). */

/** 지형 패치 이름 — 런타임 수면이 이 패치를 채운다 */
export const CW_PATCH_ID = "changwoncheon";

/** 단계별 수위(EL.m) */
export const CW_FLOOD_LEVELS: Record<string, number> = ${JSON.stringify(levels, null, 2)};

/** 채우기 시작점 — 하구 물길 가운데. 물길을 건너 번진다 */
export const CW_FLOOD_SEED: [number, number] = ${JSON.stringify(SEED)};

/** 채우기 상자 — 하류 산단 구간 → 하구 */
export const CW_FLOOD_BOX: [number, number, number, number] = ${JSON.stringify(BOX)};

/** 물 칸 기준(m) — 이 아래는 물길이라 채우기가 건넌다 */
export const CW_WATER_M = ${WATER_M};

/** 단계별 범람 외곽선(물길 포함 한 덩어리) */
export const CW_GEOMETRIES: Record<string, [number, number][]> = ${JSON.stringify(rings)};

/** 창원천 — 명곡동 부근 → 남천 합류 → 마산만 하구. 베이스맵 수로 채록 */
export const CW_RIVER: [number, number][] = ${JSON.stringify(river)};

/** 종단도 관측소 — 선 위 거리(km) · 선 꼭짓점 번호 · 하상고 · 기준 수위 */
export const CW_STATIONS: { id: string; label: string; at: [number, number]; km: number; index: number; bed: number; threshold: number }[] = ${JSON.stringify(stations)};

/** 하구 천변도로 · 합류부 간선도로 — 베이스맵 도로 채록 */
export const CW_COAST_ROAD: [number, number][] = ${JSON.stringify(trace.coastRoad)};
export const CW_TRUNK_ROAD: [number, number][] = ${JSON.stringify(trace.trunkRoad)};

/** 단계별로 잠기는 도로 토막 — 도로 상태 선이 범람면과 같은 자리에 선다 */
export const CW_ROAD_WET: Record<string, { coast: [number, number][][]; trunk: [number, number][][] }> = ${JSON.stringify(roadWet)};
`;
await writeFile(path.join(ROOT, "src", "fixtures", "changwoncheon", "geometry.generated.ts"), ts);
console.log("완료 → src/fixtures/changwoncheon/geometry.generated.ts");
