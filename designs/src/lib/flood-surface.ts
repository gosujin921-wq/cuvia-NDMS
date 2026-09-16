/* ─────────────────────────────────────────────
 * 침수 수면 — 예측판 눈금의 수위로 고해상 지형을 채운다 (03 §22 A "저지대 → 도로 → 지하차도 → 건물")
 *
 * 침수면은 손으로 찍은 폴리곤이 아니라 지형에서 온다. 저지대 그릇 바닥(seed)에서 수위(EL.m)보다 낮고 이어진 칸을
 * 채우고(욕조 채우기), 칸마다 물기둥 높이 = 수위 − 지면고를 줘서 수면 윗면이 한 높이에 눕는다. 깊은 곳이 더 높이
 * 올라오므로 "얼마나 깊게"가 3D 로 보인다. 외곽선은 굽기 스크립트가 같은 규칙으로 뜬 링(geometry.generated.ts)이다.
 *
 * 수위는 눈금마다 사전 작성한 시나리오 편집값이다(FLOOD_LEVELS). 화면은 형상을 그릴 뿐 침수심을 계산하지 않는다.
 * Phase 1 의 flood-scene(슬라이더 수위 · 90m 격자 · 연결 무시)과 다른 점은 셋 — 10m 격자, 시드 연결, 바다 제외.
 * 하천(창원천)은 물길이 통로라 바다 제외 대신 물 칸을 건넌다(throughWaterM). 어느 지형·수위인지는 lib/flood-surfaces 가 찾는다.
 * 색은 영향 면(extentPaint)·범례와 같은 토큰이다. MapLibre 는 CSS 변수를 못 읽어 cssColor 로 푼다.
 * ───────────────────────────────────────────── */

import type maplibregl from "maplibre-gl";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import type { TerrainPatch } from "./terrain-grid";
import { cssColor, type Ring } from "./map-polygon";

export const FLOOD_SURFACE_SOURCE = "flood-surface";
export const FLOOD_SURFACE_LAYER = "flood-surface-fill";
/** 지형 렌더 과장(flood-scene setTerrain 의 1.2)과 맞춰야 수면이 지면 위에 눕는다 */
const TERRAIN_EXAGGERATION = 1.2;
/** 물가 얇은 물막 (m) — 0 이면 경계 칸이 비어 보인다 */
const MIN_DEPTH = 0.1;
/** 물기둥 상한 (m) — 지형 격자의 매립지 오차로 한 칸이 푹 꺼진 자리가 기둥처럼 솟지 않게 */
const MAX_DEPTH = 3.2;

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

export interface FloodSurfaceSpec {
  level: number;
  seed: [number, number];
  box: [number, number, number, number];
  /**
   * 물 칸을 건넌다 — 이 값(m) 아래 칸도 채운다. 하천처럼 물길이 물이 오르는 통로일 때 준다(창원천).
   * 안 주면 해발 0 이하(바다)는 건너지 않는다(서항 저지대 그릇).
   */
  throughWaterM?: number;
}

/** 욕조 채우기 — 시드에서 4방향으로, 수위 아래·바다 아님·상자 안. 굽기 스크립트와 같은 규칙 */
function fillCells(patch: TerrainPatch, spec: FloodSurfaceSpec): FeatureCollection {
  const { nx, ny, west, south, lngStep, latStep, elev } = patch;
  const inBox = (ix: number, iy: number) => {
    const lng = west + ix * lngStep, lat = south + iy * latStep;
    return lng >= spec.box[0] && lng <= spec.box[2] && lat >= spec.box[1] && lat <= spec.box[3];
  };
  const sx = Math.round((spec.seed[0] - west) / lngStep), sy = Math.round((spec.seed[1] - south) / latStep);
  if (sx < 0 || sy < 0 || sx >= nx || sy >= ny) return EMPTY;
  const mask = new Uint8Array(nx * ny);
  const stack: number[] = [sy * nx + sx];
  mask[sy * nx + sx] = 1;
  const features: Feature<Polygon>[] = [];
  while (stack.length) {
    const i = stack.pop()!;
    const ix = i % nx, iy = (i - ix) / nx;
    const z = elev[i];
    const h = Math.min(MAX_DEPTH, Math.max(MIN_DEPTH, (spec.level - z) * TERRAIN_EXAGGERATION));
    const w = west + ix * lngStep, s = south + iy * latStep;
    features.push({ type: "Feature", properties: { h, depth: Number((spec.level - z).toFixed(2)) }, geometry: { type: "Polygon", coordinates: [[[w, s], [w + lngStep, s], [w + lngStep, s + latStep], [w, s + latStep], [w, s]]] } });
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const jx = ix + dx, jy = iy + dy;
      if (jx < 0 || jy < 0 || jx >= nx || jy >= ny) continue;
      const j = jy * nx + jx;
      if (mask[j] || !inBox(jx, jy)) continue;
      const zj = elev[j];
      if (zj >= spec.level) continue;
      if (spec.throughWaterM === undefined && zj <= 0) continue;
      mask[j] = 1;
      stack.push(j);
    }
  }
  return { type: "FeatureCollection", features };
}

/** 층을 한 번 붙인다 — 데이터는 setFloodSurface 가 채운다. 건물 위에 그려 저층부가 물에 잠긴 것으로 읽힌다 */
export function ensureFloodSurface(map: maplibregl.Map) {
  if (map.getSource(FLOOD_SURFACE_SOURCE)) return;
  map.addSource(FLOOD_SURFACE_SOURCE, { type: "geojson", data: EMPTY });
  map.addLayer({
    id: FLOOD_SURFACE_LAYER,
    type: "fill-extrusion",
    source: FLOOD_SURFACE_SOURCE,
    paint: {
      "fill-extrusion-color": cssColor("--color-primary-text", "#60a5fa"),
      /* 깊을수록 조금 더 진하게 — 범례(DepthLegend)와 같은 방향 */
      "fill-extrusion-opacity": 0.5,
      "fill-extrusion-base": 0,
      "fill-extrusion-height": ["get", "h"],
      "fill-extrusion-vertical-gradient": false,
    },
  });
}

/** 수면 갱신 — spec 이 없으면 비운다 */
export function setFloodSurface(map: maplibregl.Map, patch: TerrainPatch | null, spec: FloodSurfaceSpec | null, visible: boolean) {
  const src = map.getSource(FLOOD_SURFACE_SOURCE) as maplibregl.GeoJSONSource | undefined;
  if (!src) return;
  src.setData(patch && spec && visible ? fillCells(patch, spec) : EMPTY);
  if (map.getLayer(FLOOD_SURFACE_LAYER)) map.setLayoutProperty(FLOOD_SURFACE_LAYER, "visibility", visible ? "visible" : "none");
}

/** 외곽선만 남길 때의 면 페인트 — 수면이 면을 대신하므로 폴리곤 층은 점선만 그린다 */
export function outlineOnly(line: string): { fill: string; line: string; opacity: number } {
  return { fill: line, line, opacity: 0 };
}

export type { Ring };
