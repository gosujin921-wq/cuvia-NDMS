/* ─────────────────────────────────────────────
 * 트윈 장치 핀 — 03 화면정의서 §0-5
 *
 * 레이어에서 켠 종류만 세운다. 트윈은 "무엇이 잠기는가"를 보는 자리라 팝업을 열지 않고
 * 자리만 표시한다. 계측값은 조기경보(SCR-02)가 맡는다.
 *
 * 재난관제에서 선택해 온 장비는 강조해 단다(03 §5 · 차수 K) — "같은 장소의 영향분석"이
 * 지구가 아니라 장비 단위로 이어진다. 강조는 표시일 뿐 클릭은 여전히 받지 않는다.
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
  /** 재난관제에서 이어 온 선택 장비 — 엔진의 selectedDeviceId (03 §5) */
  selectedId?: string | null;
}

export function TwinDeviceMarkers({ map, ready, devices, selectedId }: TwinDeviceMarkersProps) {
  if (!ready) return null;

  return (
    <>
      {devices.map((device) => (
        <TwinMarker
          key={device.id}
          map={map}
          device={device}
          selected={device.id === selectedId}
        />
      ))}
    </>
  );
}

function TwinMarker({
  map,
  device,
  selected,
}: {
  map: RefObject<maplibregl.Map | null>;
  device: Device;
  selected: boolean;
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

  return createPortal(<DevicePin device={device} selected={selected} />, host);
}
