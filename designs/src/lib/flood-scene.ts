/* ─────────────────────────────────────────────
 * 침수 씬 — 3D 지형 위에 수면을 얹는다 (03 화면정의서 §5)
 *
 * 실사 3D 모델은 확보 대상이 아니다. 지도 스타일의 지형·건물을 세우고 그 위에 반투명
 * 수면을 올려, 슬라이더로 높이를 키우는 방식으로 만든다.
 *
 * 수면은 지구 중심 둘레의 원형 폴리곤을 fill-extrusion 으로 세운 것이다. 높이(m)가
 * 슬라이더 값이고, 건물보다 높아지면 지붕까지 잠긴 것으로 보인다.
 * ───────────────────────────────────────────── */

import type maplibregl from "maplibre-gl";
import type { Feature, Polygon } from "geojson";

export const FLOOD_SOURCE = "dsms-flood";
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
const M_PER_DEG_LAT = 111_320;

/** 중심 둘레의 원형 폴리곤 */
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

/** 침수 레이어를 한 번 붙인다. 이미 있으면 지오메트리만 갈아 끼운다 */
export function ensureFloodLayers(map: maplibregl.Map, center: [number, number]) {
  const data = floodPolygon(center);
  const source = map.getSource(FLOOD_SOURCE) as maplibregl.GeoJSONSource | undefined;

  if (source) {
    source.setData(data);
    return;
  }

  map.addSource(FLOOD_SOURCE, { type: "geojson", data });

  map.addLayer({
    id: FLOOD_FILL_LAYER,
    type: "fill-extrusion",
    source: FLOOD_SOURCE,
    paint: {
      "fill-extrusion-color": FLOOD_SURFACE,
      "fill-extrusion-opacity": 0.55,
      "fill-extrusion-base": 0,
      "fill-extrusion-height": 0,
    },
  });

  /* 침수선 — 물이 닿는 경계. 높이를 올리면 같은 자리에 남아 "여기까지 잠긴다"를 그린다 */
  map.addLayer({
    id: FLOOD_LINE_LAYER,
    type: "line",
    source: FLOOD_SOURCE,
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

/** 수면 높이 (m). 0 이면 레이어를 숨긴다 */
export function setFloodLevel(map: maplibregl.Map, level: number, visible: boolean) {
  if (!map.getLayer(FLOOD_FILL_LAYER)) return;
  map.setPaintProperty(FLOOD_FILL_LAYER, "fill-extrusion-height", level);
  setVisible(map, FLOOD_FILL_LAYER, visible && level > 0);
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
