/* ─────────────────────────────────────────────
 * 생활안전지도 WMS — 행안부 공식 침수 자료 2종 (실시간 타일)
 *
 * 해안침수예상도(IF_0091)와 침수흔적도(IF_0092)를 지도 위 래스터로 얹는다. 미리 구운
 * 날씨 격자와 달리 **시연 중 실제로 네트워크를 타는** 레이어다 — 지도를 움직일 때마다
 * 타일 요청이 나간다. 현장 회선이 불안하면 이 두 토글은 꺼 두고 시연한다.
 *
 * 호출 규격의 함정 넷(전부 겪은 것) — docs/작업/외부-API-인계.md §4:
 *   1. 호스트에 `www.` 가 있어야 한다. 없으면 302 로 흘러간다
 *   2. 좌표계는 EPSG:3857. 공식 예제의 4326 으로는 안 온다
 *   3. `styles` 는 비워야 한다(넣으면 400). 반대로 `layers` 는 반드시 넣는다
 *   4. 레이어명 지어내면 400 — 벌로 API(lgdInfo)가 알려주는 값만 쓴다
 *
 * ⚠ 서비스키는 개인 신청분이다. 저장소가 공개로 바뀌면 재발급 + 프록시로 숨긴다(인계 §7).
 * ───────────────────────────────────────────── */

import type maplibregl from "maplibre-gl";

/** safemap.go.kr 오픈API 서비스키 — 개인 신청분 · 인터페이스별 승인제(인계 §4) */
const SAFEMAP_KEY = "HVS1OPHY-HVS1-HVS1-HVS1-HVS1OPHYU3";

export interface SafemapLayerSpec {
  id: string;
  /** 승인받은 인터페이스 — IF_0091(해안침수예상도 2단계) · IF_0092(침수흔적도) */
  intId: string;
  /** WMS layers 파라미터 — lgdInfo API 가 알려준 값 그대로 */
  layers: string;
  label: string;
  /** 범례·레이어 목록 표식 색 */
  color: string;
  icon: string;
}

/* 새 인터페이스(예: IF_0100 하천범람지도)가 승인되면 여기 한 줄 더하면 붙는다 —
   호출 규격이 같다(인계 §4) */
export const SAFEMAP_LAYERS: SafemapLayerSpec[] = [
  {
    id: "flood-expect",
    intId: "IF_0091",
    layers: "A2SM_FLUDEXPECT_22",
    label: "해안침수예상도",
    color: "#00ffff",
    icon: "mdi:home-flood",
  },
  {
    id: "flood-marks",
    intId: "IF_0092",
    layers: "A2SM_FLUDMARKS",
    label: "침수흔적도",
    color: "#bf7fff",
    icon: "mdi:water-alert",
  },
];

/**
 * 해안침수예상도 침수심 5등급 — 안전지도 범례 그대로. 화면 범례를 세울 때 쓴다.
 * 원천 자료의 색이라 DS 토큰으로 바꾸지 않는다 — 공식 지도와 색이 갈리면 안 된다.
 */
export const FLOOD_DEPTH_LEGEND: { color: string; label: string }[] = [
  { color: "#ffff7f", label: "0.5m 미만" },
  { color: "#bfff00", label: "0.5~1m" },
  { color: "#00ffff", label: "1~2m" },
  { color: "#bf7fff", label: "2~5m" },
  { color: "#ff007f", label: "5m 이상" },
];

function wmsUrl(spec: SafemapLayerSpec): string {
  return (
    `https://www.safemap.go.kr/openapi2/${spec.intId}_WMS` +
    `?serviceKey=${SAFEMAP_KEY}` +
    `&layers=${spec.layers}&styles=&format=image/png` +
    `&srs=EPSG:3857&width=512&height=512&transparent=TRUE` +
    `&bbox={bbox-epsg-3857}`
  );
}

function sourceId(spec: SafemapLayerSpec) {
  return `safemap-${spec.id}`;
}

function layerId(spec: SafemapLayerSpec) {
  return `safemap-${spec.id}-raster`;
}

/**
 * 침수 래스터 2종을 한 번 붙인다. 기본은 전부 숨김 — 토글이 켠다.
 *
 * 라벨·마커보다는 아래, 바탕면보다는 위여야 하므로 첫 symbol 레이어 앞에 끼운다.
 *
 * 원천 타일은 네온 원색(범례 5색 그대로)이라 다크 관제 지도 위에 그대로 얹으면
 * 침수면이 지구 라벨·핀보다 먼저 눈에 들어온다. 채도·밝기 상한·불투명도를 내려
 * 배경 정보 톤으로 눕힌다. 색상(hue)은 건드리지 않으므로 5등급 구분과 범례 대응은
 * 유지된다.
 */
const RASTER_MUTE = {
  "raster-opacity": 0.5,
  "raster-saturation": -0.4,
  "raster-brightness-max": 0.8,
} as const;

export function ensureSafemapLayers(map: maplibregl.Map) {
  const firstSymbol = map.getStyle().layers?.find((layer) => layer.type === "symbol")?.id;

  for (const spec of SAFEMAP_LAYERS) {
    if (map.getSource(sourceId(spec))) continue;
    map.addSource(sourceId(spec), {
      type: "raster",
      tiles: [wmsUrl(spec)],
      tileSize: 512,
    });
    map.addLayer(
      {
        id: layerId(spec),
        type: "raster",
        source: sourceId(spec),
        layout: { visibility: "none" },
        paint: { ...RASTER_MUTE },
      },
      firstSymbol,
    );
  }
}

export function setSafemapVisible(map: maplibregl.Map, id: string, visible: boolean) {
  const spec = SAFEMAP_LAYERS.find((layer) => layer.id === id);
  if (!spec || !map.getLayer(layerId(spec))) return;
  map.setLayoutProperty(layerId(spec), "visibility", visible ? "visible" : "none");
}
