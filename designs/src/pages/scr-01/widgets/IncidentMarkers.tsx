/* ─────────────────────────────────────────────
 * 사건·감시구역 이름표 마커 — IA-01 공간 개요 (IA §6). Phase 1 지구 이름표의 문법 그대로
 *
 * 시 전체 배율에서는 장비 마커를 올리지 않는다. 지구 이름표를 전부 띄우고, 진행 사건이 있는 지구만 점 색으로
 * 가른다. 원색 테두리·후광·숨쉬는 배경은 뺐다(CSMS SiteMarkers 결정 · 위험 현황·상단 스트립·피드가 이미 같은
 * 신호를 준다). 메인 사건의 점만 숨쉰다. 자리 잡기는 MapLibre Marker 에, 내용은 React 에.
 * ───────────────────────────────────────────── */

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import { cn } from "@ds";

export interface MapLabel {
  id: string;
  name: string;
  /** 보조 표기 — 재난유형 또는 "감시" */
  kind: string;
  center: [number, number];
  /** 지구 상태 색. 정상은 null */
  color: string | null;
  /** 메인 사건 지구만 점이 숨쉰다 */
  pulse: boolean;
  ariaLabel: string;
}

interface DistrictMarkersProps {
  map: RefObject<maplibregl.Map | null>;
  ready: boolean;
  labels: MapLabel[];
  onOpen: (label: MapLabel) => void;
}

export function IncidentMarkers({ map, ready, labels, onOpen }: DistrictMarkersProps) {
  if (!ready) return null;
  return (
    <>
      {labels.map((label) => (
        <LabelMarker key={label.id} map={map} label={label} onOpen={onOpen} />
      ))}
    </>
  );
}

function LabelMarker({ map, label, onOpen }: { map: RefObject<maplibregl.Map | null>; label: MapLabel; onOpen: (label: MapLabel) => void }) {
  const [host] = useState(() => {
    const el = document.createElement("div");
    el.style.pointerEvents = "none";
    return el;
  });

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const marker = new maplibregl.Marker({ element: host, anchor: "bottom" }).setLngLat(label.center).addTo(instance);
    return () => {
      marker.remove();
    };
  }, [map, host, label.center]);

  /* 층서: 평시 0 · 사건 1 · 가리키는 것 2 · 팝업 3 (index.css .dsms-popup) */
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    host.style.zIndex = hovered ? "2" : label.color ? "1" : "";
  }, [host, hovered, label.color]);

  return createPortal(
    <button
      type="button"
      onClick={() => onOpen(label)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-label={label.ariaLabel}
      className={cn(
        "glass-light pointer-events-auto relative flex cursor-pointer items-center gap-1.5 whitespace-nowrap border",
        "rounded-full py-1 pl-2 pr-2.5 text-caption font-medium transition-transform hover:scale-105",
      )}
      style={{ borderColor: "rgba(255, 255, 255, 0.7)" }}
    >
      <span className="relative flex items-center gap-1.5">
        <span className="relative flex size-2 shrink-0 items-center justify-center">
          {label.color && label.pulse && <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60" style={{ backgroundColor: label.color }} aria-hidden />}
          <span className="relative size-2 rounded-full" style={{ backgroundColor: label.color ?? "var(--color-success)" }} aria-hidden />
        </span>
        {label.name}
        <span className="glass-light-muted">{label.kind}</span>
      </span>
    </button>,
    host,
  );
}
