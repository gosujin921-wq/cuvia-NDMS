/* ─────────────────────────────────────────────
 * 장비 마커 — 03 화면정의서 §0-5 · §2
 *
 * 핀 모양은 두 갈래다. 평소 장비는 장치 핀, 이벤트를 낸 장비 자리에는 이벤트 핀.
 * 판단과 모양 규칙은 components/MapPins.tsx 가 갖고, 여기는 어느 좌표에 무엇을 세울지만 정한다.
 *
 * 자리 잡기는 MapLibre Marker 에 맡기고 React 는 내용만 그린다. 지도 move 마다 좌표를
 * 상태로 올리면 드래그 내내 리렌더가 돌아 마커가 한 프레임씩 밀린다.
 * ───────────────────────────────────────────── */

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import { activeEventOfDeviceAt, eventViewAt } from "../../../demo/events";
import { useScenario } from "../../../state/ScenarioProvider";
import type { Device } from "../../../demo/devices";
import { DevicePin, EventPin } from "../../../components/MapPins";

interface DeviceMarkersProps {
  map: RefObject<maplibregl.Map | null>;
  ready: boolean;
  devices: Device[];
  selectedId: string | null;
  onSelect: (device: Device) => void;
}

export function DeviceMarkers({ map, ready, devices, selectedId, onSelect }: DeviceMarkersProps) {
  if (!ready) return null;

  return (
    <>
      {devices.map((device) => (
        <DeviceMarkerItem
          key={device.id}
          map={map}
          device={device}
          selected={device.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function DeviceMarkerItem({
  map,
  device,
  selected,
  onSelect,
}: {
  map: RefObject<maplibregl.Map | null>;
  device: Device;
  selected: boolean;
  onSelect: (device: Device) => void;
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

  const { now } = useScenario();
  const event = activeEventOfDeviceAt(device.id, now);
  const view = event ? eventViewAt(event, now) : null;

  /* 지도 클릭으로 전파되면 팝업이 열리자마자 닫힌다 */
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(device);
  };

  return createPortal(
    event && view ? (
      <EventPin
        type={event.type}
        level={view.level}
        label={device.name}
        selected={selected}
        onClick={handleClick}
      />
    ) : (
      <DevicePin device={device} selected={selected} onClick={handleClick} />
    ),
    host,
  );
}
