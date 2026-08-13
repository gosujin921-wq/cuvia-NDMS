/* ─────────────────────────────────────────────
 * 장비 마커 — 03 화면정의서 §0-5 · §2
 *
 * 핀 모양은 두 갈래다. 평소 장비는 장치 핀, 이벤트를 낸 장비 자리에는 이벤트 핀.
 * 판단과 모양 규칙은 components/MapPins.tsx 가 갖고, 여기는 어느 좌표에 무엇을 세울지만 정한다.
 *
 * 자리 잡기는 MapLibre Marker 에 맡기고 React 는 내용만 그린다. 지도 move 마다 좌표를
 * 상태로 올리면 드래그 내내 리렌더가 돌아 마커가 한 프레임씩 밀린다.
 * ───────────────────────────────────────────── */

import { useEffect, useMemo, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import { activeEventOfAt, activeEventOfDeviceAt, eventViewAt } from "../../../demo/events";
import { useScenario } from "../../../state/ScenarioProvider";
import type { Device } from "../../../demo/devices";
import { DevicePin, EventPin } from "../../../components/MapPins";
import { ClusterMarkers, clusterDevices, useMapZoom } from "../../../components/MapClusters";
import { DISTRICT_ZOOM } from "../../../lib/map-config";

interface DeviceMarkersProps {
  map: RefObject<maplibregl.Map | null>;
  ready: boolean;
  devices: Device[];
  selectedId: string | null;
  onSelect: (device: Device) => void;
}

export function DeviceMarkers({ map, ready, devices, selectedId, onSelect }: DeviceMarkersProps) {
  const { now } = useScenario();
  const zoom = useMapZoom(map, ready);

  /* 겹치면 묶는다(03 §0-5). 이벤트를 낸 장비와 선택(팝업 열린) 장비는 묶지 않는다 —
     사건과 지금 보는 장비는 항상 낱개로 선다 */
  const { singles, clusters } = useMemo(() => {
    const exclude = new Set<string>();
    for (const device of devices) {
      if (device.id === selectedId || activeEventOfDeviceAt(device.id, now)) {
        exclude.add(device.id);
      }
    }
    return clusterDevices(devices, zoom ?? DISTRICT_ZOOM, exclude);
  }, [devices, zoom, selectedId, now]);

  if (!ready) return null;

  return (
    <>
      {singles.map((device) => (
        <DeviceMarkerItem
          key={device.id}
          map={map}
          device={device}
          selected={device.id === selectedId}
          onSelect={onSelect}
        />
      ))}
      <ClusterMarkers map={map} clusters={clusters} />
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
  /* 이벤트 핀은 **지구당 대표 사건 하나**만 세운다 (04 §15-3 대표 사건 규칙).
     한 지구에 사건이 둘인 트랙(봉암 · 집중호우 + 내수침수)에서 핀을 둘 다 세우면
     "지금 무엇을 보는 화면인가"가 지도에서 갈리고, 격상 순간 대표가 갈아타도 앞
     사건의 핀이 남아 아무것도 바뀌지 않은 것처럼 보인다. 대표에서 밀린 사건은
     장치 핀으로 돌아가고, 그 사건은 상단 사건 바의 진행 사건 전환이 맡는다 */
  const lead = activeEventOfAt(device.districtId, now);
  const own = activeEventOfDeviceAt(device.id, now);
  const event = own && lead && own.id === lead.id ? own : undefined;
  const view = event ? eventViewAt(event, now) : null;

  /* 이벤트 핀은 장치·클러스터 핀 위에 선다(03 §0-5). 팝업(z 2)은 그 위 */
  useEffect(() => {
    host.style.zIndex = event ? "1" : "";
  }, [host, event]);

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
