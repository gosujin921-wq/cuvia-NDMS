/* ─────────────────────────────────────────────
 * 트윈 장치 핀 — 03 화면정의서 §0-5
 *
 * 레이어에서 켠 종류만 세운다. 트윈은 "무엇이 잠기는가"를 보는 자리라 팝업을 열지 않고
 * 자리만 표시한다. 계측값은 조기경보(SCR-02)가 맡는다.
 * ───────────────────────────────────────────── */

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import type { Device } from "../../../demo/devices";
import { DevicePin } from "../../../components/MapPins";

interface TwinDeviceMarkersProps {
  map: RefObject<maplibregl.Map | null>;
  ready: boolean;
  devices: Device[];
}

export function TwinDeviceMarkers({ map, ready, devices }: TwinDeviceMarkersProps) {
  if (!ready) return null;

  return (
    <>
      {devices.map((device) => (
        <TwinMarker key={device.id} map={map} device={device} />
      ))}
    </>
  );
}

function TwinMarker({
  map,
  device,
}: {
  map: RefObject<maplibregl.Map | null>;
  device: Device;
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

  return createPortal(<DevicePin device={device} />, host);
}
