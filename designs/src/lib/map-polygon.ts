/* ─────────────────────────────────────────────
 * 지도 폴리곤 층 — 사건 범위 · 예측 침수 범위 (IA §8 · 01 §8.3 SpatialRef)
 *
 * fixture 의 geometry 표(GEOMETRIES)가 든 링 하나를 fill + dashed line 두 층으로 세운다.
 * 사건 작업공간(scr-02)과 디지털트윈(scr-05)이 같은 자리에 같은 문법으로 그린다.
 *
 * MapLibre paint 는 CSS 변수를 못 읽는다. 리터럴을 박지 않고 토큰을 풀어 쓴다(cssColor).
 * ───────────────────────────────────────────── */

import type maplibregl from "maplibre-gl";

export type Ring = [number, number][];

export interface PolygonPaint {
  fill: string;
  line: string;
  opacity: number;
}

/** 토큰 → 실제 색. 문서가 없는 환경(테스트)에서는 fallback */
export function cssColor(token: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback;
}

/** 사건 범위 — 붉은 점선 테두리에 반투명 붉은 면. 파란 침수면과 색이 겹치지 않게(2026-09-15 사용자) */
export function scopePaint(): PolygonPaint {
  const c = cssColor("--color-danger", "#ef4444");
  return { fill: c, line: c, opacity: 0.12 };
}

/** 영향 면의 톤 — 유형이 정한다(03 §24 "시각 강도는 유형별 표현 방식에 맞춘다"). 물 · 불 · 지반 · 장애 */
export type ExtentTone = "water" | "fire" | "ground" | "outage";

/**
 * 영향 전망 범위 — 등급 색이 아니라 유형의 색 하나. 강도로 진하기만 달라진다 (2026-09-15, "등급 구역처럼 읽힌다").
 * `level` 은 0~1 강도. 물 유형은 침수심(m)을 0.5 m 기준으로 정규화해 넘긴다.
 */
export function extentPaint(level = 0.4, tone: ExtentTone = "water"): PolygonPaint {
  const c =
    tone === "fire" ? cssColor("--color-risk-lv4", "#f97316")
    : tone === "ground" ? cssColor("--color-warning", "#f59e0b")
    : tone === "outage" ? cssColor("--color-foreground-muted", "#9ca3af")
    : cssColor("--color-primary-text", "#60a5fa");
  const t = Math.min(Math.max(level, 0), 1);
  return { fill: c, line: c, opacity: 0.18 + t * 0.3 };
}

/** 침수심(m) → 강도. 0.5 m 에서 가장 진하다 */
export function depthLevel(depthM = 0.2): number {
  return Math.min(Math.max(depthM, 0), 0.5) / 0.5;
}

const EMPTY = { type: "FeatureCollection" as const, features: [] };

/**
 * 링을 폴리곤 층으로 올린다. 처음이면 source + fill + line 을 만들고, 이후엔 데이터만 바꾼다.
 * `ring` 이 null 이면 비운다(층은 남긴다 — 다시 켤 때 순서가 안 흔들린다).
 */
export function upsertPolygonLayer(map: maplibregl.Map, id: string, ring: Ring | null | undefined, paint: PolygonPaint) {
  const data = ring && ring.length > 0
    ? { type: "Feature" as const, geometry: { type: "Polygon" as const, coordinates: [[...ring, ring[0]]] }, properties: {} }
    : null;
  const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
  if (!src) {
    map.addSource(id, { type: "geojson", data: data ?? EMPTY });
    map.addLayer({ id: `${id}-fill`, type: "fill", source: id, paint: { "fill-color": paint.fill, "fill-opacity": paint.opacity } });
    map.addLayer({ id: `${id}-line`, type: "line", source: id, paint: { "line-color": paint.line, "line-width": 1.5, "line-dasharray": [2, 2] } });
  } else {
    src.setData(data ?? EMPTY);
    /* 페인트도 갱신한다 — 눈금이 바뀌면 진하기(침수심)가 바뀌고, 수면이 대신 서면 면을 0 으로 내린다 */
    map.setPaintProperty(`${id}-fill`, "fill-color", paint.fill);
    map.setPaintProperty(`${id}-fill`, "fill-opacity", paint.opacity);
    map.setPaintProperty(`${id}-line`, "line-color", paint.line);
  }
}

/** 층 표시 토글 — 만들기 전이면 아무 일도 없다 */
export function setPolygonLayerVisible(map: maplibregl.Map, id: string, visible: boolean) {
  for (const layer of [`${id}-fill`, `${id}-line`]) {
    if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", visible ? "visible" : "none");
  }
}
