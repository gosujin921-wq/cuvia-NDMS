/* ─────────────────────────────────────────────
 * 장면 층 렌더러 — model/scene.ts 의 층을 MapLibre 에 올린다 (03 §24 표현 부품)
 *
 * 한 부품이 전망 탭과 디지털트윈 메뉴에 같이 선다. 층 종류별로 소스 하나씩 두고 데이터만 갈아 끼운다.
 *   line    선 층      역할별 색·굵기, 상태별 실선/점선
 *   area    보조 면    역할별 색, 플룸은 옅게
 *   grid    격자 면    강도 → 면 색, 취약 → 해칭 패턴, 공백 → 외곽선
 *   vector  화살표     DOM 마커. 아이콘을 이동 방향으로 돌리고 길이를 값으로 (지도 글리프에 화살표 문자가 없다)
 *   node·point         DOM 마커. 상태 색 원 + 아이콘 + 라벨. 복구 순번 배지
 *
 * MapLibre paint 는 CSS 변수를 못 읽으므로 토큰을 cssColor 로 풀어 쓴다. 리터럴 색은 여기 없다.
 * ───────────────────────────────────────────── */

import { useEffect, useMemo, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import { Icon } from "@iconify/react";
import { cn } from "@ds";
import { cssColor } from "../../lib/map-polygon";
import type { LngLat, NodeState, PointTone, SceneLayer, SceneLineRole, SceneAreaRole } from "../../model/scene";

const SRC = { lines: "scene-lines", areas: "scene-areas", grid: "scene-grid" } as const;
const HATCH = "scene-hatch";

interface SceneLayersProps {
  map: RefObject<maplibregl.Map | null>;
  ready: boolean;
  layers: SceneLayer[];
}

const TONE_COLOR: Record<PointTone, () => string> = {
  danger: () => cssColor("--color-danger", "#ef4444"),
  warning: () => cssColor("--color-warning", "#f59e0b"),
  success: () => cssColor("--color-success", "#22c55e"),
  neutral: () => cssColor("--color-foreground-muted", "#9ca3af"),
  primary: () => cssColor("--color-primary-text", "#60a5fa"),
};

function lineColor(role: SceneLineRole, tone?: PointTone): string {
  if (tone) return TONE_COLOR[tone]();
  switch (role) {
    case "방호시설": return cssColor("--color-foreground", "#e5e7eb");
    case "방화선": return cssColor("--color-danger", "#ef4444");
    case "대피경로": return cssColor("--color-success", "#22c55e");
    case "통제 경계": return cssColor("--color-warning", "#f59e0b");
    case "하천": return cssColor("--color-primary-text", "#60a5fa");
    case "연결": return cssColor("--color-foreground-muted", "#9ca3af");
    case "우회": return cssColor("--color-success", "#22c55e");
    case "도로": return cssColor("--color-foreground-muted", "#9ca3af");
  }
}

function areaColor(role: SceneAreaRole): { color: string; opacity: number } {
  switch (role) {
    case "플룸": return { color: cssColor("--color-foreground-muted", "#9ca3af"), opacity: 0.22 };
    case "위험지도": return { color: cssColor("--color-warning", "#f59e0b"), opacity: 0.12 };
    case "통제 구역": return { color: cssColor("--color-warning", "#f59e0b"), opacity: 0.16 };
    case "고립 구역": return { color: cssColor("--color-danger", "#ef4444"), opacity: 0.2 };
    case "접근권": return { color: cssColor("--color-success", "#22c55e"), opacity: 0.12 };
  }
}

/** 해칭 패턴 — 취약대상 밀집. 캔버스로 한 번 만들어 스타일 이미지에 넣는다 */
function ensureHatch(map: maplibregl.Map) {
  if (map.hasImage(HATCH)) return;
  const size = 12;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const g = c.getContext("2d");
  if (!g) return;
  g.strokeStyle = cssColor("--color-foreground", "#e5e7eb");
  g.globalAlpha = 0.55;
  g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(0, size); g.lineTo(size, 0); g.stroke();
  g.beginPath(); g.moveTo(-size / 2, size / 2); g.lineTo(size / 2, -size / 2); g.stroke();
  g.beginPath(); g.moveTo(size / 2, size * 1.5); g.lineTo(size * 1.5, size / 2); g.stroke();
  const data = g.getImageData(0, 0, size, size);
  map.addImage(HATCH, { width: size, height: size, data: new Uint8Array(data.data.buffer) }, { pixelRatio: 1 });
}

/** 층마다 따로 지킨다 — 스타일이 다시 실리면 일부만 남을 수 있어 묶음 가드는 두 번째 addLayer 에서 터진다 */
function addOnce(map: maplibregl.Map, spec: maplibregl.LayerSpecification) {
  if (!map.getLayer(spec.id)) map.addLayer(spec);
}

function ensureSources(map: maplibregl.Map) {
  const empty = { type: "FeatureCollection" as const, features: [] };
  for (const id of Object.values(SRC)) if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: empty });
  ensureHatch(map);

  addOnce(map, { id: "scene-areas-fill", type: "fill", source: SRC.areas, paint: { "fill-color": ["get", "color"], "fill-opacity": ["get", "opacity"] } });
  addOnce(map, { id: "scene-areas-line", type: "line", source: SRC.areas, filter: ["==", ["get", "outlined"], true], paint: { "line-color": ["get", "color"], "line-width": 1.5, "line-dasharray": [3, 2] } });
  /* primary-bg 는 color-mix() 라 MapLibre 가 못 읽는다. primary 에 낮은 불투명도로 대신한다 */
  const lo = cssColor("--color-primary", "#3b82f6");
  const mid = cssColor("--color-warning", "#f59e0b");
  const hi = cssColor("--color-danger", "#ef4444");
  addOnce(map, { id: "scene-grid-fill", type: "fill", source: SRC.grid, paint: { "fill-color": ["interpolate", ["linear"], ["get", "intensity"], 0, lo, 0.5, mid, 1, hi], "fill-opacity": ["interpolate", ["linear"], ["get", "intensity"], 0, 0.12, 1, 0.55] } });
  addOnce(map, { id: "scene-grid-hatch", type: "fill", source: SRC.grid, filter: ["==", ["get", "vulnerable"], true], paint: { "fill-pattern": HATCH, "fill-opacity": 0.9 } });
  addOnce(map, { id: "scene-grid-cell", type: "line", source: SRC.grid, paint: { "line-color": cssColor("--color-border", "#374151"), "line-width": 0.6, "line-opacity": 0.6 } });
  addOnce(map, { id: "scene-grid-gap", type: "line", source: SRC.grid, filter: ["==", ["get", "gap"], true], paint: { "line-color": cssColor("--color-danger", "#ef4444"), "line-width": 2.2 } });
  addOnce(map, { id: "scene-lines-solid", type: "line", source: SRC.lines, filter: ["==", ["get", "state"], "on"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": ["get", "width"] } });
  addOnce(map, { id: "scene-lines-dashed", type: "line", source: SRC.lines, filter: ["!=", ["get", "state"], "on"], layout: { "line-cap": "round" }, paint: { "line-color": ["get", "color"], "line-width": ["get", "width"], "line-dasharray": [2, 2], "line-opacity": ["case", ["==", ["get", "state"], "off"], 0.45, 0.9] } });
  addOnce(map, { id: "scene-lines-label", type: "symbol", source: SRC.lines, filter: ["has", "label"], layout: { "symbol-placement": "line-center", "text-field": ["get", "label"], "text-size": 13, "text-offset": [0, -1] }, paint: { "text-color": ["get", "color"], "text-halo-color": cssColor("--color-surface", "#0b1220"), "text-halo-width": 1.2 } });
  raiseSceneLayers(map);
}

/** 장면 층은 영향 면·범위 면·수면 위에 선다. 면 층을 나중에 붙이는 쪽(범위·수면 effect)이 붙인 뒤 한 번 더 부른다 */
export function raiseSceneLayers(map: maplibregl.Map) {
  for (const id of ["scene-areas-fill", "scene-areas-line", "scene-grid-fill", "scene-grid-hatch", "scene-grid-cell", "scene-grid-gap", "scene-lines-solid", "scene-lines-dashed", "scene-lines-label"]) {
    if (map.getLayer(id)) map.moveLayer(id);
  }
}

function ring(coords: LngLat[]) {
  return { type: "Polygon" as const, coordinates: [[...coords, coords[0]]] };
}

export function SceneLayers({ map, ready, layers }: SceneLayersProps) {
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    ensureSources(instance);

    const lines = layers.filter((l): l is Extract<SceneLayer, { kind: "line" }> => l.kind === "line");
    const areas = layers.filter((l): l is Extract<SceneLayer, { kind: "area" }> => l.kind === "area");
    const grids = layers.filter((l): l is Extract<SceneLayer, { kind: "grid" }> => l.kind === "grid");

    const width = (role: SceneLineRole) => (role === "방호시설" || role === "방화선" || role === "하천" ? 3 : role === "도로" ? 4 : role === "연결" ? 2 : 2.5);
    (instance.getSource(SRC.lines) as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: lines.map((l) => ({ type: "Feature", geometry: { type: "LineString", coordinates: l.coords }, properties: { role: l.role, state: l.state ?? "on", color: lineColor(l.role, l.tone), width: width(l.role), ...(l.label ? { label: l.label } : {}) } })),
    });
    (instance.getSource(SRC.areas) as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: areas.map((a) => { const c = areaColor(a.role); return { type: "Feature", geometry: ring(a.ring), properties: { role: a.role, color: c.color, opacity: a.opacity ?? c.opacity, outlined: a.role === "통제 구역" || a.role === "고립 구역" } }; }),
    });
    (instance.getSource(SRC.grid) as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: grids.flatMap((g) => g.cells.map((c, i) => ({ type: "Feature" as const, geometry: ring(c.ring), properties: { id: `${g.id}-${i}`, intensity: c.intensity, vulnerable: Boolean(c.vulnerable), gap: Boolean(c.gap) } }))),
    });
    /* 장면 층은 늘 맨 위 — 나중에 붙는 수면(flood-surface)·영향 면이 도로 상태 선을 덮지 않게 갱신마다 다시 올린다 */
    raiseSceneLayers(instance);
  }, [map, ready, layers]);

  const markers = useMemo(() => layers.filter((l): l is Extract<SceneLayer, { kind: "node" | "point" }> => l.kind === "node" || l.kind === "point"), [layers]);
  const vectors = useMemo(() => layers.filter((l): l is Extract<SceneLayer, { kind: "vector" }> => l.kind === "vector"), [layers]);
  if (!ready) return null;
  return (
    <>
      {vectors.map((v) => (
        <VectorMarker key={v.id} map={map} layer={v} />
      ))}
      {markers.map((m) => (
        <SceneMarker key={m.id} map={map} layer={m} />
      ))}
    </>
  );
}

/** 화살표 — 이동 방향으로 돌리고 길이를 값으로. 풍향은 primary, 변위는 danger */
function VectorMarker({ map, layer }: { map: RefObject<maplibregl.Map | null>; layer: Extract<SceneLayer, { kind: "vector" }> }) {
  const [host] = useState(() => {
    const el = document.createElement("div");
    el.style.pointerEvents = "none";
    return el;
  });
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const marker = new maplibregl.Marker({ element: host, anchor: "center", rotationAlignment: "map", pitchAlignment: "map" }).setLngLat(layer.at).addTo(instance);
    return () => { marker.remove(); };
  }, [map, host, layer.at]);
  const wind = layer.role === "풍향";
  const length = wind ? 26 + Math.min(layer.magnitude, 20) * 1.6 : 20 + Math.min(layer.magnitude, 20) * 2.2;
  return createPortal(
    <div className="flex flex-col items-center" style={{ transform: `rotate(${layer.bearing}deg)` }}>
      <div className={cn("flex flex-col items-center", wind ? "text-primary-text" : "text-danger")} style={{ height: length }}>
        <Icon icon="mdi:triangle" className="size-3.5 shrink-0 drop-shadow" aria-hidden />
        <div className="w-[3px] flex-1 rounded-full bg-current opacity-90" />
      </div>
      {layer.label && (
        <span className="mt-0.5 whitespace-nowrap rounded bg-surface/85 px-1.5 py-0.5 text-caption text-foreground backdrop-blur-sm" style={{ transform: `rotate(${-layer.bearing}deg)` }}>{layer.label}</span>
      )}
    </div>,
    host,
  );
}

const NODE_TONE: Record<NodeState, string> = {
  정상: "border-success bg-success/25 text-success",
  경고: "border-warning bg-warning/25 text-warning",
  중단: "border-danger bg-danger/25 text-danger",
  복구: "border-primary bg-primary/25 text-primary-text",
};
const POINT_TONE: Record<PointTone, string> = {
  danger: "border-danger bg-danger/25 text-danger",
  warning: "border-warning bg-warning/25 text-warning",
  success: "border-success bg-success/25 text-success",
  neutral: "border-border bg-surface-raised/80 text-foreground",
  primary: "border-primary bg-primary/25 text-primary-text",
};

function SceneMarker({ map, layer }: { map: RefObject<maplibregl.Map | null>; layer: Extract<SceneLayer, { kind: "node" | "point" }> }) {
  const [host] = useState(() => {
    const el = document.createElement("div");
    el.style.pointerEvents = "none";
    return el;
  });
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const marker = new maplibregl.Marker({ element: host, anchor: "center" }).setLngLat(layer.at).addTo(instance);
    return () => { marker.remove(); };
  }, [map, host, layer.at]);

  const tone = layer.kind === "node" ? NODE_TONE[layer.state] : POINT_TONE[layer.tone ?? "neutral"];
  const small = layer.kind === "point" && layer.small;
  const off = layer.kind === "node" && layer.state === "중단";
  const sub = layer.kind === "node" ? layer.state : layer.state;
  return createPortal(
    <div className="flex flex-col items-center gap-0.5">
      <div className={cn("relative flex items-center justify-center rounded-full border-2 backdrop-blur-sm", small ? "size-5" : "size-8", tone, off && "opacity-60")}>
        <Icon icon={layer.icon} className={small ? "size-3" : "size-4"} aria-hidden />
        {layer.kind === "node" && layer.order !== undefined && (
          <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary font-mono text-[10px] font-bold text-primary-foreground">{layer.order}</span>
        )}
      </div>
      {!small && (
        <span className="flex max-w-[200px] flex-col items-center rounded bg-surface/85 px-1.5 py-0.5 text-caption leading-tight text-foreground backdrop-blur-sm">
          <span className="truncate">{layer.label}</span>
          {sub && <span className={cn("font-semibold", tone.split(" ").find((c) => c.startsWith("text-")))}>{sub}</span>}
        </span>
      )}
    </div>,
    host,
  );
}
