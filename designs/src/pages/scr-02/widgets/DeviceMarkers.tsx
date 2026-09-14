/* ─────────────────────────────────────────────
 * 주체 핀 — 사건 작업공간 지도 (IA §7). Phase 1 장비 마커의 문법 그대로
 *
 * 핀 모양은 두 갈래다. 평소 주체는 장치 핀, 변화율·기준 진입 판정이 선 주체는 이벤트 핀. 판단과 모양 규칙은
 * components/MapPins.tsx 가 갖고, 여기는 어느 좌표에 무엇을 세울지만 정한다. 사건 주체는 여덟 안팎이라
 * 클러스터는 두지 않는다. 자리 잡기는 MapLibre Marker 에, 내용은 React 에.
 * ───────────────────────────────────────────── */

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import type { Device } from "../../../demo/devices";
import type { AlertLevel } from "../../../demo/levels";
import type { EventType } from "../../../demo/events";
import { DevicePin, EventPin } from "../../../components/MapPins";

export interface SubjectPin {
  device: Device;
  /** 파생 판정이 서 있으면 이벤트 핀 — 종류·단계 색은 호출부가 정한다 */
  flag?: { type: EventType; level: AlertLevel; label: string };
}

interface DeviceMarkersProps {
  map: RefObject<maplibregl.Map | null>;
  ready: boolean;
  pins: SubjectPin[];
  selectedId: string | null;
  onSelect: (device: Device) => void;
}

export function DeviceMarkers({ map, ready, pins, selectedId, onSelect }: DeviceMarkersProps) {
  if (!ready) return null;
  return (
    <>
      {pins.map((pin) => (
        <DeviceMarkerItem key={pin.device.id} map={map} pin={pin} selected={pin.device.id === selectedId} onSelect={onSelect} />
      ))}
    </>
  );
}

function DeviceMarkerItem({ map, pin, selected, onSelect }: { map: RefObject<maplibregl.Map | null>; pin: SubjectPin; selected: boolean; onSelect: (device: Device) => void }) {
  const [host] = useState(() => {
    const el = document.createElement("div");
    el.style.pointerEvents = "none";
    return el;
  });

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const marker = new maplibregl.Marker({ element: host, anchor: "center" }).setLngLat(pin.device.center).addTo(instance);
    return () => {
      marker.remove();
    };
  }, [map, host, pin.device]);

  /* 쌓임 순서 — 장치(0) < 시설(1) < 이벤트(2) < 팝업(.dsms-popup z 3) */
  useEffect(() => {
    host.style.zIndex = pin.flag ? "2" : "";
  }, [host, pin.flag]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(pin.device);
  };

  return createPortal(
    pin.flag ? <EventPin type={pin.flag.type} level={pin.flag.level} label={pin.flag.label} selected={selected} onClick={handleClick} /> : <DevicePin device={pin.device} selected={selected} onClick={handleClick} />,
    host,
  );
}
