/* ─────────────────────────────────────────────
 * 위험요소 레이어 렌더러 — 04 §1-1 의 도형을 MapLibre 에 세운다
 *
 * 파도휩쓸림(해안 띠)·침수취약도로(선)·해안 저지대(면)는 GeoJSON 레이어로,
 * 해일 대피소(점)는 DOM 마커로 그린다 — 라벨이 붙는 표식은 DOM 이 글꼴·테마를 지킨다.
 *
 * 도형은 장치 핀 아래 층이다. 위험요소는 "이 자리가 원래 위험하다"는 바탕 정보고,
 * 핀은 "지금 무엇이 있다/났다"는 전경 정보다.
 * ───────────────────────────────────────────── */

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import { Icon } from "@iconify/react";
import type { HazardLayerSpec } from "../demo/hazard-layers";

interface HazardLayersProps {
  map: RefObject<maplibregl.Map | null>;
  ready: boolean;
  layers: HazardLayerSpec[];
  /** 레이어별 표시 여부 — 없으면 전부 표시 */
  visible?: Record<string, boolean>;
}

const SOURCE_PREFIX = "hazard-";

function geojsonOf(spec: HazardLayerSpec): GeoJSON.Feature {
  const g = spec.geometry;
  if (g.type === "band")
    return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: g.center } };
  if (g.type === "lines")
    return { type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: g.lines } };
  if (g.type === "polygon")
    return {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [[...g.ring, g.ring[0]]] },
    };
  return { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: g.at } };
}

export function HazardLayers({ map, ready, layers, visible }: HazardLayersProps) {
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;

    const added: string[] = [];
    for (const spec of layers) {
      if (spec.geometry.type === "point") continue; // 점은 DOM 마커가 맡는다
      const sourceId = `${SOURCE_PREFIX}${spec.id}`;
      if (!instance.getSource(sourceId)) {
        instance.addSource(sourceId, { type: "geojson", data: geojsonOf(spec) });
      }

      if (spec.geometry.type === "band" && !instance.getLayer(sourceId)) {
        /* 해안 띠 — 넓은 반투명 선. 폭이 곧 위험 범위다 */
        instance.addLayer({
          id: sourceId,
          type: "line",
          source: sourceId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": spec.color,
            "line-width": spec.geometry.widthPx,
            "line-opacity": 0.35,
            "line-blur": 2,
          },
        });
        added.push(sourceId);
      }
      if (spec.geometry.type === "lines" && !instance.getLayer(sourceId)) {
        instance.addLayer({
          id: sourceId,
          type: "line",
          source: sourceId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": spec.color,
            "line-width": 3.5,
            "line-opacity": 0.85,
            "line-dasharray": [2, 1.4],
          },
        });
        added.push(sourceId);
      }
      if (spec.geometry.type === "polygon") {
        if (!instance.getLayer(sourceId)) {
          instance.addLayer({
            id: sourceId,
            type: "fill",
            source: sourceId,
            paint: { "fill-color": spec.color, "fill-opacity": 0.12 },
          });
          added.push(sourceId);
        }
        const outlineId = `${sourceId}-outline`;
        if (!instance.getLayer(outlineId)) {
          instance.addLayer({
            id: outlineId,
            type: "line",
            source: sourceId,
            paint: {
              "line-color": spec.color,
              "line-width": 1.4,
              "line-opacity": 0.55,
              "line-dasharray": [3, 2],
            },
          });
          added.push(outlineId);
        }
      }
    }

    return () => {
      if (!instance.style) return;
      for (const spec of layers) {
        const sourceId = `${SOURCE_PREFIX}${spec.id}`;
        for (const layerId of [sourceId, `${sourceId}-outline`]) {
          if (instance.getLayer(layerId)) instance.removeLayer(layerId);
        }
        if (instance.getSource(sourceId)) instance.removeSource(sourceId);
      }
    };
  }, [map, ready, layers]);

  /* 표시 토글 — 레이어를 지우지 않고 visibility 만 바꾼다 */
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    for (const spec of layers) {
      const on = visible?.[spec.id] ?? true;
      const value = on ? "visible" : "none";
      const sourceId = `${SOURCE_PREFIX}${spec.id}`;
      for (const layerId of [sourceId, `${sourceId}-outline`]) {
        if (instance.getLayer(layerId)) instance.setLayoutProperty(layerId, "visibility", value);
      }
    }
  }, [map, ready, layers, visible]);

  return (
    <>
      {layers
        .filter((spec) => spec.geometry.type === "point" && (visible?.[spec.id] ?? true))
        .map((spec) => (
          <HazardPointMarker key={spec.id} map={map} ready={ready} spec={spec} />
        ))}
    </>
  );
}

/** 점 표식 (해일 대피소) — 색 바탕 글리프 + 라벨. 장치 핀과 다른 모양(사각 라벨형) */
function HazardPointMarker({
  map,
  ready,
  spec,
}: {
  map: RefObject<maplibregl.Map | null>;
  ready: boolean;
  spec: HazardLayerSpec;
}) {
  const [host] = useState(() => {
    const el = document.createElement("div");
    el.style.pointerEvents = "none";
    return el;
  });

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || spec.geometry.type !== "point") return;
    const marker = new maplibregl.Marker({ element: host, anchor: "bottom" })
      .setLngLat(spec.geometry.at)
      .addTo(instance);
    return () => {
      marker.remove();
    };
  }, [map, ready, host, spec]);

  return createPortal(
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="glass-light flex items-center gap-1 rounded px-1.5 py-0.5 text-caption font-medium"
        style={{ border: `1.5px solid ${spec.color}` }}
      >
        <Icon icon={spec.icon} className="size-3.5" style={{ color: spec.color }} aria-hidden />
        {spec.label}
        {spec.note && <span className="glass-light-muted">{spec.note}</span>}
      </span>
      <span
        className="size-2 rounded-full border-2 border-white"
        style={{ backgroundColor: spec.color }}
        aria-hidden
      />
    </div>,
    host,
  );
}
