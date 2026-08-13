/* ─────────────────────────────────────────────
 * 지형 고도 격자 읽기 — public/weather/terrain-grid.json (미리 구운 자료)
 *
 * 지구별 ±1.3km · 약 90m 간격 고도 패치다. 지도 스타일이 무는 것과 같은 타일
 * (terrain-rgb-v2)에서 scripts/fetch-terrain-grid.mjs 로 구웠다 — 다른 고도 자료를
 * 물리면 렌더 지형과 수면이 어긋난다(외부-API-인계 §5).
 *
 * ⚠ 90m 지형면 모형이라 항만 일대를 실제보다 6~7m 높게 본다. "어디까지 잠기나"는
 *   행안부 해안침수예상도(safemap)가 답하고, 이 격자는 "수위가 오르면 어떻게
 *   차오르나"의 모형만 맡는다.
 * ───────────────────────────────────────────── */

export interface TerrainPatch {
  center: [number, number];
  west: number;
  south: number;
  lngStep: number;
  latStep: number;
  nx: number;
  ny: number;
  /** m — [iy*nx+ix] · iy 남→북, ix 서→동 */
  elev: number[];
}

export interface TerrainGrid {
  source: string;
  zoom: number;
  stepM: number;
  patches: Record<string, TerrainPatch>;
}

let cache: Promise<TerrainGrid> | null = null;

export function loadTerrainGrid(): Promise<TerrainGrid> {
  cache ??= fetch("/weather/terrain-grid.json").then((res) => {
    if (!res.ok) throw new Error(`지형 격자를 받지 못했다 (HTTP ${res.status})`);
    return res.json() as Promise<TerrainGrid>;
  });
  return cache;
}

/** 좌표의 고도(m) — 사방 4점 쌍선형 보간. 패치 밖이면 null */
export function elevationAt(patch: TerrainPatch, lng: number, lat: number): number | null {
  const fx = (lng - patch.west) / patch.lngStep;
  const fy = (lat - patch.south) / patch.latStep;
  if (fx < 0 || fy < 0 || fx > patch.nx - 1 || fy > patch.ny - 1) return null;

  const x0 = Math.min(Math.floor(fx), patch.nx - 2);
  const y0 = Math.min(Math.floor(fy), patch.ny - 2);
  const tx = fx - x0;
  const ty = fy - y0;
  const i00 = y0 * patch.nx + x0;

  return (
    (patch.elev[i00] * (1 - tx) + patch.elev[i00 + 1] * tx) * (1 - ty) +
    (patch.elev[i00 + patch.nx] * (1 - tx) + patch.elev[i00 + patch.nx + 1] * tx) * ty
  );
}
