/* ─────────────────────────────────────────────
 * 이벤트 지도 마커 — 03 화면정의서 §3 중앙
 *
 * 선택한 이벤트의 지구를 연다. 이벤트를 낸 장비 자리에는 이벤트 핀, 나머지 장비는
 * 장치 핀이다(§0-5). 해제된 이벤트는 자리만 보이고 펄스를 두르지 않는다.
 * ───────────────────────────────────────────── */

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import type { AlertEvent } from "../../../demo/events";
import type { Device } from "../../../demo/devices";
import { DevicePin, EventPin } from "../../../components/MapPins";

interface EventMarkersProps {
  map: RefObject<maplibregl.Map | null>;
  ready: boolean;
  devices: Device[];
  event: AlertEvent;
}

export function EventMarkers({ map, ready, devices, event }: EventMarkersProps) {
  if (!ready) return null;

  return (
    <>
      {devices.map((device) => (
        <MarkerItem
          key={device.id}
          map={map}
          device={device}
          event={device.id === event.deviceId ? event : null}
        />
      ))}
    </>
  );
}

function MarkerItem({
  map,
  device,
  event,
}: {
  map: RefObject<maplibregl.Map | null>;
  device: Device;
  event: AlertEvent | null;
}) {
  const [host] = useState(() => {
    const el = document.createElement("div");
    el.style.pointerEvents = "none";
    return el;
  });

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const marker = new maplibregl.Marker({ element: host, anchor: "center" })
      .setLngLat(device.center)
      .addTo(instance);
    return () => {
      marker.remove();
    };
  }, [map, host, device]);

  return createPortal(
    event ? (
      <EventPin
        type={event.type}
        level={event.level}
        label={device.name}
        pulse={event.clearedAt === null}
      />
    ) : (
      <DevicePin device={device} />
    ),
    host,
  );
}
