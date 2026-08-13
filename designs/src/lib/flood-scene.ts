/* ─────────────────────────────────────────────
 * 침수 씬 — 3D 지형 위에 수면을 얹는다 (03 화면정의서 §5)
 *
 * 실사 3D 모델은 확보 대상이 아니다. 지도 스타일의 지형·건물을 세우고 그 위에 반투명
 * 수면을 올려, 슬라이더로 높이를 키우는 방식으로 만든다.
 *
 * 수면은 지형 격자(lib/terrain-grid)가 있으면 **지형을 따라 차오른다** — 고도가
 * 슬라이더 수위(EL.m)보다 낮은 칸에만 물을 채우고, 칸별 물기둥 높이를 `수위 − 지면고`
 * 로 줘서 수면 윗면이 같은 해발에 눕는다(fill-extrusion 은 지형 위에 서므로).
 * 침수선은 같은 격자에서 수위 등고선(marching squares)을 떠서 그린다 — "여기까지
 * 잠긴다"의 경계가 지형 굴곡을 따라간다.
 *
 * 격자가 없는 지구(굽기 전·새 지구)는 예전 방식 — 중심 둘레 원형 수면 — 으로 물러난다.
 *
 * ⚠ 90m 격자 모형의 한계는 terrain-grid.ts 머리말 참고. 공식 "어디까지"는 행안부
 *   해안침수예상도(safemap) 토글이 답한다.
 * ───────────────────────────────────────────── */

import type maplibregl from "maplibre-gl";
import type { Feature, FeatureCollection, MultiLineString, Polygon } from "geojson";
import { elevationAt, type TerrainPatch } from "./terrain-grid";

export const FLOOD_SOURCE = "dsms-flood";
export const FLOOD_LINE_SOURCE = "dsms-flood-line";
export const FLOOD_FILL_LAYER = "dsms-flood-fill";
export const FLOOD_LINE_LAYER = "dsms-flood-line";
export const HILLSHADE_LAYER = "dsms-hillshade";
export const TERRAIN_SOURCE = "terrain-rgb-v2";
/** 베이스맵 3D 건물 레이어 (MapTiler 스타일) */
export const BUILDING_3D_LAYER = "Building 3D";

/* 수면·침수선 색 — DS 미보유(수해 팔레트가 아직 토큰에 없다).
   MapLibre paint 는 CSS 변수를 해석하지 못해 리터럴이어야 하므로, 앱 안에서 리터럴 색이
   허용되는 유일한 자리다. 값을 이 두 상수 밖으로 흘리지 않는다.
   DS 에 수해 램프가 생기면 여기만 바꾼다. */
const FLOOD_SURFACE = "#2f6fd0";
const FLOOD_EDGE = "#7cc4ff";

/** 침수 범위 반경 (m) — 마을 하나가 들어오는 크기 */
const FLOOD_RADIUS_M = 900;
/** 격자 모드의 그리기 반경 (m) — 패치(±1.3km) 안에서 마을이 넉넉히 든다 */
const GRID_RADIUS_M = 1200;
/** 격자 칸을 이만큼 쪼개 그린다 — 90m 계단이 45m 로 줄어 물가가 덜 각진다 */
const SUBDIVIDE = 2;
/** 물가 얇은 물막 (m) — 0 이면 경계 칸이 비어 보인다 */
const MIN_DEPTH = 0.05;
const M_PER_DEG_LAT = 111_320;

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

/** 중심 둘레의 원형 폴리곤 — 격자가 없을 때의 수면 */
export function floodPolygon(center: [number, number]): Feature<Polygon> {
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((center[1] * Math.PI) / 180);
  const ring: [number, number][] = [];
  for (let i = 0; i <= 64; i += 1) {
    const angle = (i / 64) * Math.PI * 2;
    ring.push([
      center[0] + ((Math.cos(angle) * FLOOD_RADIUS_M) / mPerDegLng),
      center[1] + ((Math.sin(angle) * FLOOD_RADIUS_M) / M_PER_DEG_LAT),
    ]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
}

/* ── 격자 수면 — 수위보다 낮은 칸을 물기둥으로 채운다 ── */

function gridFloodCells(
  patch: TerrainPatch,
  center: [number, number],
  level: number,
): FeatureCollection {
  const features: Feature<Polygon>[] = [];
  const lngStep = patch.lngStep / SUBDIVIDE;
  const latStep = patch.latStep / SUBDIVIDE;
  const n = (patch.nx - 1) * SUBDIVIDE;
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((center[1] * Math.PI) / 180);

  for (let iy = 0; iy < n; iy += 1) {
    for (let ix = 0; ix < n; ix += 1) {
      const lng = patch.west + (ix + 0.5) * lngStep;
      const lat = patch.south + (iy + 0.5) * latStep;
      const dx = (lng - center[0]) * mPerDegLng;
      const dy = (lat - center[1]) * M_PER_DEG_LAT;
      if (dx * dx + dy * dy > GRID_RADIUS_M * GRID_RADIUS_M) continue;

      const ground = elevationAt(patch, lng, lat);
      if (ground == null || ground >= level) continue;

      const west = patch.west + ix * lngStep;
      const south = patch.south + iy * latStep;
      features.push({
        type: "Feature",
        /* 물기둥 높이 = 수위 − 지면고. 지형 위에 선 기둥의 윗면이 해발 `수위`에 눕는다 */
        properties: { h: Math.max(level - ground, MIN_DEPTH) },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [west, south],
            [west + lngStep, south],
            [west + lngStep, south + latStep],
            [west, south + latStep],
            [west, south],
          ]],
        },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

/* ── 침수선 — 수위 등고선 (marching squares) ── */

function gridFloodContour(
  patch: TerrainPatch,
  center: [number, number],
  level: number,
): Feature<MultiLineString> {
  const lngStep = patch.lngStep / SUBDIVIDE;
  const latStep = patch.latStep / SUBDIVIDE;
  const n = (patch.nx - 1) * SUBDIVIDE + 1;
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((center[1] * Math.PI) / 180);

  /* 부분 노드의 고도를 한 번만 떠 둔다 */
  const values = new Float64Array(n * n);
  for (let iy = 0; iy < n; iy += 1)
    for (let ix = 0; ix < n; ix += 1) {
      const v = elevationAt(patch, patch.west + ix * lngStep, patch.south + iy * latStep);
      values[iy * n + ix] = v ?? level + 1000; // 패치 밖은 뭍으로 친다
    }

  const segments: [number, number][][] = [];
  const at = (ix: number, iy: number): [number, number] => [
    patch.west + ix * lngStep,
    patch.south + iy * latStep,
  ];
  /* 등고선이 변을 지나는 자리 — 양끝 고도 사이를 직선 보간 */
  const cross = (a: [number, number], b: [number, number], va: number, vb: number) => {
    const t = (level - va) / (vb - va);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as [number, number];
  };

  for (let iy = 0; iy < n - 1; iy += 1) {
    for (let ix = 0; ix < n - 1; ix += 1) {
      const v0 = values[iy * n + ix]; // 남서
      const v1 = values[iy * n + ix + 1]; // 남동
      const v2 = values[(iy + 1) * n + ix + 1]; // 북동
      const v3 = values[(iy + 1) * n + ix]; // 북서
      const caseIndex =
        (v0 < level ? 1 : 0) | (v1 < level ? 2 : 0) | (v2 < level ? 4 : 0) | (v3 < level ? 8 : 0);
      if (caseIndex === 0 || caseIndex === 15) continue;

      const sw = at(ix, iy);
      const se = at(ix + 1, iy);
      const ne = at(ix + 1, iy + 1);
      const nw = at(ix, iy + 1);
      const south = () => cross(sw, se, v0, v1);
      const east = () => cross(se, ne, v1, v2);
      const north = () => cross(nw, ne, v3, v2);
      const west = () => cross(sw, nw, v0, v3);

      /* 16가지 중 대각(5·10)은 두 토막 — 관례대로 갈라 둔다 */
      const table: Record<number, [number, number][][]> = {
        1: [[west(), south()]],
        2: [[south(), east()]],
        3: [[west(), east()]],
        4: [[east(), north()]],
        5: [[west(), north()], [south(), east()]],
        6: [[south(), north()]],
        7: [[west(), north()]],
        8: [[north(), west()]],
        9: [[north(), south()]],
        10: [[north(), east()], [west(), south()]],
        11: [[north(), east()]],
        12: [[east(), west()]],
        13: [[east(), south()]],
        14: [[south(), west()]],
      };
      for (const segment of table[caseIndex]) {
        const [mx, my] = [
          (segment[0][0] + segment[1][0]) / 2,
          (segment[0][1] + segment[1][1]) / 2,
        ];
        const dx = (mx - center[0]) * mPerDegLng;
        const dy = (my - center[1]) * M_PER_DEG_LAT;
        if (dx * dx + dy * dy <= GRID_RADIUS_M * GRID_RADIUS_M) segments.push(segment);
      }
    }
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "MultiLineString", coordinates: segments },
  };
}

/* ── 지도 배선 ── */

/** 침수 레이어를 한 번 붙인다 — 데이터는 setFloodLevel 이 채운다 */
export function ensureFloodLayers(map: maplibregl.Map, center: [number, number]) {
  if (map.getSource(FLOOD_SOURCE)) return;
  void center; // 지오메트리는 수위와 함께 setFloodLevel 이 계산한다

  map.addSource(FLOOD_SOURCE, { type: "geojson", data: EMPTY });
  map.addSource(FLOOD_LINE_SOURCE, { type: "geojson", data: EMPTY });

  map.addLayer({
    id: FLOOD_FILL_LAYER,
    type: "fill-extrusion",
    source: FLOOD_SOURCE,
    paint: {
      "fill-extrusion-color": FLOOD_SURFACE,
      "fill-extrusion-opacity": 0.55,
      "fill-extrusion-base": 0,
      /* 칸별 물기둥 — gridFloodCells 가 준 h. 원형 수면도 h 하나로 같은 문법을 쓴다 */
      "fill-extrusion-height": ["get", "h"],
    },
  });

  /* 침수선 — 물이 닿는 경계. "여기까지 잠긴다"를 그린다 */
  map.addLayer({
    id: FLOOD_LINE_LAYER,
    type: "line",
    source: FLOOD_LINE_SOURCE,
    paint: {
      "line-color": FLOOD_EDGE,
      "line-width": 2,
      "line-dasharray": [3, 2],
    },
  });
}

function setVisible(map: maplibregl.Map, layerId: string, visible: boolean) {
  if (!map.getLayer(layerId)) return;
  map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
}

/**
 * 수면 갱신 — 수위(EL.m)에 맞는 수면·침수선 지오메트리를 계산해 갈아 끼운다.
 *
 * patch 가 있으면 지형을 따라 차오르고, 없으면 중심 둘레 원형 수면으로 물러난다.
 */
export function setFloodLevel(
  map: maplibregl.Map,
  level: number,
  visible: boolean,
  center: [number, number],
  patch?: TerrainPatch | null,
) {
  const fill = map.getSource(FLOOD_SOURCE) as maplibregl.GeoJSONSource | undefined;
  const line = map.getSource(FLOOD_LINE_SOURCE) as maplibregl.GeoJSONSource | undefined;
  if (!fill || !line) return;

  const showing = visible && level > 0;
  if (!showing) {
    setVisible(map, FLOOD_FILL_LAYER, false);
    line.setData(EMPTY);
    return;
  }

  if (patch) {
    fill.setData(gridFloodCells(patch, center, level));
    line.setData(gridFloodContour(patch, center, level));
  } else {
    const circle = floodPolygon(center);
    fill.setData({
      type: "FeatureCollection",
      features: [{ ...circle, properties: { h: level } }],
    });
    line.setData({ type: "FeatureCollection", features: [circle] });
  }
  setVisible(map, FLOOD_FILL_LAYER, true);
}

export function setFloodLineVisible(map: maplibregl.Map, visible: boolean) {
  setVisible(map, FLOOD_LINE_LAYER, visible);
}

export function setBuildings3D(map: maplibregl.Map, visible: boolean) {
  setVisible(map, BUILDING_3D_LAYER, visible);
}

/** 지형 렌더링 — 스타일이 이미 terrain 을 선언하고 있어 켜고 끄기만 한다 */
export function setTerrain(map: maplibregl.Map, on: boolean) {
  map.setTerrain(on ? { source: TERRAIN_SOURCE, exaggeration: 1.2 } : null);
}

/** 지형 음영 — 등고선 데이터가 없어 DEM 음영으로 기복을 보인다 */
export function ensureHillshade(map: maplibregl.Map) {
  if (map.getLayer(HILLSHADE_LAYER)) return;
  map.addLayer(
    {
      id: HILLSHADE_LAYER,
      type: "hillshade",
      source: TERRAIN_SOURCE,
      paint: { "hillshade-exaggeration": 0.45 },
    },
    /* 지형 음영은 배경이다. 물·건물·마커보다 아래에 깔아야 한다 */
    map.getLayer("Water") ? "Water" : undefined,
  );
  setVisible(map, HILLSHADE_LAYER, false);
}

export function setHillshadeVisible(map: maplibregl.Map, visible: boolean) {
  setVisible(map, HILLSHADE_LAYER, visible);
}
