/* ─────────────────────────────────────────────
 * 주변 주체 핀 — 지하차도 · 대피소 · 마을방송 · 조위관측소 (fixtures sitePointsOf)
 *
 * 사건 상관 키 밖이라 이벤트 핀으로 갈아타지 않고 상태도 싣지 않는다. 모양은 장치·시설 핀과 같은 DS MapMarker 다.
 * 디지털트윈은 같은 목록을 scr-00 FacilityMarkers 로 그린다.
 * ───────────────────────────────────────────── */

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import type { SitePoint } from "../../../fixtures";
import { SitePin } from "../../../components/MapPins";

export function SiteMarkers({ map, ready, points }: { map: RefObject<maplibregl.Map | null>; ready: boolean; points: SitePoint[] }) {
  if (!ready) return null;
  return (
    <>
      {points.map((p) => (
        <SiteMarkerItem key={p.id} map={map} point={p} />
      ))}
    </>
  );
}

function SiteMarkerItem({ map, point }: { map: RefObject<maplibregl.Map | null>; point: SitePoint }) {
  const [host] = useState(() => {
    const el = document.createElement("div");
    el.style.pointerEvents = "none";
    return el;
  });

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const marker = new maplibregl.Marker({ element: host, anchor: "center" }).setLngLat(point.at).addTo(instance);
    return () => {
      marker.remove();
    };
  }, [map, host, point.at]);

  return createPortal(<SitePin point={point} onClick={(e) => e.stopPropagation()} />, host);
}
