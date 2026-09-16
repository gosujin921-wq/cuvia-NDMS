/* ─────────────────────────────────────────────
 * 서항 배수권역 침수면 굽기 — 고해상 지형(terrain-fine.json)에서 수위 단계별 침수 형상을 뜬다
 *
 * 침수면이 "물이 저지대·골목을 따라 차오른다"로 읽히려면 형상이 지형에서 와야 한다. 손으로 찍은 사각형은 상자로 읽힌다.
 * 방식은 욕조 채우기다. 저지대 바닥(seed)에서 시작해 수위(EL.m)보다 낮고 이어진 칸을 채우고, 그 덩어리의 외곽선을
 * 링으로 뜬다. 단계별 수위는 시나리오 편집값이다 — 03 §22 A 의 "저지대 → 도로 → 지하차도 → 건물" 단계를 면적으로 옮긴 것이지
 * 수리·수문 모형 결과가 아니다. 눈금의 최대 침수심(maxDepthM)은 fixture 가 따로 든다.
 *
 * ⚠ terrain-rgb 가 매립지를 실제보다 높게 본다(terrain-grid.ts 머리말). 여기 수위는 그 지형 기준의 상대값이라 실제 해발과 다르다.
 *
 * 실행: designs/ 에서 `node scripts/bake-flood-seohang.mjs` (지형 패치는 fetch-terrain-fine.mjs 가 먼저)
 * 산출: src/fixtures/seohang-flood/geometry.generated.ts — 링(GEOMETRIES 형식) · 단계별 수위 · 시드
 * ───────────────────────────────────────────── */

import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const grid = JSON.parse(await readFile(path.join(ROOT, "public", "weather", "terrain-fine.json"), "utf8"));
const patch = grid.patches.seohang;
const { nx, ny, west: W, south: S, lngStep: LX, latStep: LY, elev } = patch;

/** 배수권역 후보 상자 — 마산항 서안 매립지 저지대. 이 밖은 산자락이라 채우지 않는다 */
const BBOX = [128.568, 35.1935, 128.576, 35.2035];
/** 저지대 그릇 상자 — 5 m 문턱 아래 약 8 ha. 시드는 이 안에서 사방이 뭍(>1 m)인 가장 낮은 칸 */
const BOWL = [128.569, 35.198, 128.5735, 35.2017];
/**
 * 단계별 수위(EL.m · 지형 기준 상대값). 5.0 m 가 그릇의 문턱이라 그 아래는 도로 물고임이고 넘으면 저지대 전체로 퍼진다.
 *   T10 물고임 시작 · T30 차로 침수 · T50 통행 불가 · T80 문턱을 넘어 건물 12동
 *   DRAIN 은 배수 대안 — 두 단계 낮게 머문다. BASIN 은 사건 범위(배수권역 가칭)
 *   ACT 는 사건 종료 뒤 확정한 실측 범위다 — 예측 검증(IA-05)이 예측 범위와 겹쳐 본다
 */
const STAGES = {
  /* 해안대로 가장 낮은 꼭짓점이 3.7 m — T10 부터 도로가 물에 닿아야 "물고임"이 지도와 맞는다 */
  "GEO-FLOOD-T10": 3.75,
  "GEO-FLOOD-T30": 4.1,
  "GEO-FLOOD-T50": 4.5,
  "GEO-FLOOD-T80": 5.15,
  "GEO-FLOOD-DRAIN-T50": 3.9,
  "GEO-FLOOD-DRAIN-T80": 4.2,
  /* 실측 — 사건 종료 뒤 확정한 실제 침수 범위(예측 검증용). 도로수위 최대 27 cm 에 맞춘 시나리오 수위 */
  "GEO-FLOOD-ACT": 4.35,
  "GEO-BASIN-SH-01": 6.4,
};

/**
 * 해안도로 저지대 구간 — 베이스맵(MapTiler planet v4 · road 층) 해안대로 북행 차로 형상 채록(2026-09-15).
 * 남쪽 끝 5.7 m 에서 그릇 안(3.7 m)으로 내려가는 구간이라 물고임 → 통행 불가 단계가 이 선 위에서 보인다.
 */
const COAST_ROAD = [[128.57019, 35.19651], [128.57027, 35.1966], [128.57029, 35.19668], [128.57031, 35.19679], [128.57034, 35.19692], [128.57037, 35.19701], [128.5704, 35.19708], [128.57043, 35.19714], [128.57047, 35.19719], [128.57054, 35.19725], [128.57066, 35.19732], [128.57091, 35.19747], [128.57128, 35.19772], [128.5716, 35.19792], [128.57204, 35.19821], [128.57236, 35.19843], [128.57294, 35.1988], [128.57317, 35.19896]];
/** 선 좌우로 폭을 준 회랑 폴리곤 (m) — 사건 주체 표의 affectedGeometryId 가 문다 */
const ROAD_HALF_WIDTH_M = 14;
const UNDERPASS = [128.570738, 35.199426];
const UNDERPASS_HALF_M = 30;

const lngOf = (ix) => W + ix * LX;
const latOf = (iy) => S + iy * LY;
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
const SEED = [Number(lngOf(seedIx).toFixed(6)), Number(latOf(seedIy).toFixed(6))];
console.log(`시드 ${SEED} · 바닥 ${seedZ} m`);

/** 욕조 채우기 — 시드에서 4방향으로, 수위 아래·바다 아님·상자 안 */
function fill(level) {
  const mask = new Uint8Array(nx * ny);
  const q = [[seedIx, seedIy]];
  mask[seedIy * nx + seedIx] = 1;
  while (q.length) {
    const [ix, iy] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const jx = ix + dx, jy = iy + dy;
      if (jx < 0 || jy < 0 || jx >= nx || jy >= ny) continue;
      const i = jy * nx + jx;
      if (mask[i] || !inBox(jx, jy)) continue;
      const z = cell(jx, jy);
      if (z <= 0 || z >= level) continue;
      mask[i] = 1; q.push([jx, jy]);
    }
  }
  return mask;
}

/** 마스크 외곽선 — 칸 경계 변을 모아 고리로 잇는다. 가장 긴 고리 하나를 쓴다(구멍·조각은 버린다) */
function outline(mask) {
  const edges = new Map(); // "x,y" 시작점 → 끝점 (시계방향)
  const key = (x, y) => `${x},${y}`;
  const add = (ax, ay, bx, by) => { edges.set(key(ax, ay) + "|" + key(bx, by), [ax, ay, bx, by]); };
  for (let iy = 0; iy < ny; iy += 1) for (let ix = 0; ix < nx; ix += 1) {
    if (!mask[iy * nx + ix]) continue;
    const on = (x, y) => x >= 0 && y >= 0 && x < nx && y < ny && mask[y * nx + x];
    /* 칸 모서리 좌표는 (ix, iy)~(ix+1, iy+1). 바깥쪽 변만 남긴다. 방향은 시계 */
    if (!on(ix, iy - 1)) add(ix, iy, ix + 1, iy);         // 남
    if (!on(ix + 1, iy)) add(ix + 1, iy, ix + 1, iy + 1); // 동
    if (!on(ix, iy + 1)) add(ix + 1, iy + 1, ix, iy + 1); // 북
    if (!on(ix - 1, iy)) add(ix, iy + 1, ix, iy);         // 서
  }
  const byStart = new Map();
  for (const e of edges.values()) { const k = key(e[0], e[1]); (byStart.get(k) ?? byStart.set(k, []).get(k)).push(e); }
  const used = new Set();
  const loops = [];
  for (const e0 of edges.values()) {
    const k0 = e0.join(",");
    if (used.has(k0)) continue;
    const loop = [[e0[0], e0[1]]];
    let cur = e0;
    while (true) {
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

/** Douglas–Peucker — 칸 단위 계단을 줄인다 (tolerance 는 칸 수) */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const d2 = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
    const px = a[0] + t * dx - p[0], py = a[1] + t * dy - p[1];
    return px * px + py * py;
  };
  const rec = (i, j) => {
    let best = -1, bi = -1;
    for (let k = i + 1; k < j; k += 1) { const d = d2(pts[k], pts[i], pts[j]); if (d > best) { best = d; bi = k; } }
    if (best > tol * tol) return [...rec(i, bi), ...rec(bi, j).slice(1)];
    return [pts[i], pts[j]];
  };
  const out = rec(0, pts.length - 1);
  return out;
}

const rings = {};
const stats = {};
/** 단계별로 물에 닿는 해안대로 꼭짓점 구간 [from, to] — 통제 구간·도로 상태가 침수면과 같은 자리에 선다 */
const roadWet = {};
for (const [id, level] of Object.entries(STAGES)) {
  const mask = fill(level);
  const wet = COAST_ROAD.map(([lng, lat]) => mask[Math.round((lat - S) / LY) * nx + Math.round((lng - W) / LX)] === 1);
  const first = wet.indexOf(true), last = wet.lastIndexOf(true);
  if (first >= 0) roadWet[id] = [Math.max(0, first - 1), Math.min(COAST_ROAD.length - 1, last + 1)];
  const cells = mask.reduce((a, v) => a + v, 0);
  const loop = simplify(outline(mask), 1.2);
  rings[id] = loop.map(([x, y]) => [Number(lngOf(x).toFixed(6)), Number(latOf(y).toFixed(6))]);
  let zmin = Infinity;
  for (let i = 0; i < mask.length; i += 1) if (mask[i]) zmin = Math.min(zmin, elev[i]);
  stats[id] = { level, cells, ha: Number((cells * 100 / 10000).toFixed(1)), points: rings[id].length, zmin: Number(zmin.toFixed(1)) };
  console.log(id.padEnd(22), `수위 ${level} · ${stats[id].ha} ha · 꼭짓점 ${rings[id].length} · 바닥 ${stats[id].zmin} m · 도로 ${roadWet[id] ? roadWet[id].join("~") : "마름"}`);
}

/* 회랑 — 선의 양쪽 오프셋을 이어 닫는다 */
const M_LAT = 111320, M_LNG = 111320 * Math.cos((35.198 * Math.PI) / 180);
function corridor(line, halfM) {
  const left = [], right = [];
  for (let i = 0; i < line.length; i += 1) {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
    const dx = (b[0] - a[0]) * M_LNG, dy = (b[1] - a[1]) * M_LAT;
    const len = Math.hypot(dx, dy) || 1;
    const nx_ = -dy / len, ny_ = dx / len;
    left.push([Number((line[i][0] + (nx_ * halfM) / M_LNG).toFixed(6)), Number((line[i][1] + (ny_ * halfM) / M_LAT).toFixed(6))]);
    right.push([Number((line[i][0] - (nx_ * halfM) / M_LNG).toFixed(6)), Number((line[i][1] - (ny_ * halfM) / M_LAT).toFixed(6))]);
  }
  return [...left, ...right.reverse()];
}
rings["GEO-ROAD-COAST"] = corridor(COAST_ROAD, ROAD_HALF_WIDTH_M);
const ux = UNDERPASS_HALF_M / M_LNG, uy = UNDERPASS_HALF_M / M_LAT;
rings["GEO-UNDERPASS"] = [[UNDERPASS[0] - ux, UNDERPASS[1] - uy], [UNDERPASS[0] + ux, UNDERPASS[1] - uy], [UNDERPASS[0] + ux, UNDERPASS[1] + uy], [UNDERPASS[0] - ux, UNDERPASS[1] + uy]].map((p) => p.map((v) => Number(v.toFixed(6))));

const ts = `/* 자동 생성 — scripts/bake-flood-seohang.mjs (${new Date().toISOString().slice(0, 10)}). 손으로 고치지 않는다.
 * 고해상 지형(public/weather/terrain-fine.json)에서 수위 단계별로 뜬 침수면·배수권역 링. 수위는 시나리오 편집값(지형 기준 상대값)이다. */

/** 단계별 수위(EL.m · 지형 기준) — 침수 씬이 이 수위로 지형을 채운다 */
export const FLOOD_LEVELS: Record<string, number> = ${JSON.stringify(STAGES, null, 2)};

/** 채우기 시작점 — 저지대 그릇 바닥. 침수 씬이 여기서 지형을 채운다 */
export const FLOOD_SEED: [number, number] = ${JSON.stringify(SEED)};

/** 채우기 상자 — 이 밖은 산자락이라 채우지 않는다 */
export const FLOOD_BOX: [number, number, number, number] = ${JSON.stringify(BBOX)};

/** 해안도로 저지대 구간 중심선 — 베이스맵 해안대로 형상 채록 */
export const COAST_ROAD_LINE: [number, number][] = ${JSON.stringify(COAST_ROAD)};

/** 신포 지하차도 진입부 — 그릇 바닥(시나리오 위치) */
export const UNDERPASS_AT: [number, number] = ${JSON.stringify(UNDERPASS)};

/** 단계별 물에 닿는 해안대로 꼭짓점 구간 [from, to] — 없으면 그 단계엔 도로가 마른다 */
export const COAST_ROAD_WET: Record<string, [number, number]> = ${JSON.stringify(roadWet)};

/** 침수면·배수권역·도로 회랑·지하차도 링 [경도, 위도] */
export const FLOOD_GEOMETRIES: Record<string, [number, number][]> = {
${Object.entries(rings).map(([id, r]) => `  ${JSON.stringify(id)}: ${JSON.stringify(r)},`).join("\n")}
};
`;
await writeFile(path.join(ROOT, "src", "fixtures", "seohang-flood", "geometry.generated.ts"), ts);
console.log("완료 → src/fixtures/seohang-flood/geometry.generated.ts");
