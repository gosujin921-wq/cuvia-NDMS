/* ─────────────────────────────────────────────
 * 점 층 — GeoJSON 점 무리를 MapLibre circle 층 하나로 (2026-09-17)
 *
 * 수백~수천 점(무더위쉼터 967곳)을 DOM 마커로 세우면 지도가 무거워진다. 시설·SOP 처럼 "누르고 가리키는" 점은
 * DS `MapMarker`(FacilityMarkers) 로, 그냥 "어디에 얼마나 있나"를 보는 점 무리는 이 층으로 그린다.
 * 색·굵기는 페인트 식(expression)으로 받는다 — 속성값으로 가르는 건 부르는 쪽이 정한다.
 * ───────────────────────────────────────────── */

import type maplibregl from "maplibre-gl";

export interface CirclePaint {
  color: maplibregl.ExpressionSpecification | string;
  radius: maplibregl.ExpressionSpecification | number;
  opacity: maplibregl.ExpressionSpecification | number;
  stroke: string;
}

export function upsertCircleLayer(map: maplibregl.Map, id: string, data: GeoJSON.FeatureCollection, paint: CirclePaint) {
  const source = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
  if (source) {
    source.setData(data);
    map.setPaintProperty(id, "circle-color", paint.color);
    map.setPaintProperty(id, "circle-radius", paint.radius);
    map.setPaintProperty(id, "circle-opacity", paint.opacity);
    return;
  }
  map.addSource(id, { type: "geojson", data });
  map.addLayer({
    id, type: "circle", source: id,
    paint: { "circle-color": paint.color, "circle-radius": paint.radius, "circle-opacity": paint.opacity, "circle-stroke-width": 1, "circle-stroke-color": paint.stroke },
  });
}

export function setCircleLayerVisible(map: maplibregl.Map, id: string, visible: boolean) {
  if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
}
