/* ─────────────────────────────────────────────
 * 시설 핀 — 배수펌프장 · 우수저류시설 (IA §7 · 02 §4 악화 조건). Phase 1 방재시설 마커의 문법 그대로
 *
 * 장치 핀과 같은 자리 잡기, 묶지 않고, 이벤트 핀으로 갈아타지 않는다 — 펌프 정지·저류 여유는 센서 이벤트가
 * 아니라 시설 상태(FACILITY_STATE_CHANGED)다. 상태는 selectors.facilityStateOf 가 최신 이벤트로 판정한다.
 * 수동 개폐 조작은 대표 데모에 없다(실제 원격제어를 가장하지 않는다 · 02 D5) — 피커에 [현장 영상]만 둔다.
 * ───────────────────────────────────────────── */

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import type { Facility } from "../../../demo/facilities";
import { FacilityPin } from "../../../components/MapPins";
import { facilityStateOf } from "../../../model/selectors";
import { useScenario } from "../../../state/ScenarioProvider";

interface FacilityMarkersProps {
  map: RefObject<maplibregl.Map | null>;
  ready: boolean;
  facilities: Facility[];
  /** 피커의 [현장 영상] — 그 시설을 비추는 CCTV 채널 id 를 넘긴다. 없으면 버튼이 서지 않는다 */
  cctvOf: (facility: Facility) => { name: string; onOpen: () => void } | undefined;
}

export function FacilityMarkers({ map, ready, facilities, cctvOf }: FacilityMarkersProps) {
  if (!ready) return null;
  return (
    <>
      {facilities.map((facility) => (
        <FacilityMarkerItem key={facility.id} map={map} facility={facility} cctv={cctvOf(facility)} />
      ))}
    </>
  );
}

function FacilityMarkerItem({ map, facility, cctv }: { map: RefObject<maplibregl.Map | null>; facility: Facility; cctv?: { name: string; onOpen: () => void } }) {
  const { demoNow: now } = useScenario();
  const [host] = useState(() => {
    const el = document.createElement("div");
    el.style.pointerEvents = "none";
    el.style.zIndex = "1";
    return el;
  });

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const marker = new maplibregl.Marker({ element: host, anchor: "center" }).setLngLat(facility.center).addTo(instance);
    return () => {
      marker.remove();
    };
  }, [map, host, facility]);

  const state = facilityStateOf(facility.id, now) ?? { label: "상태 미수신", engaged: false };

  return createPortal(
    <FacilityPin
      facility={facility}
      state={{ label: state.label, detail: state.detail, engaged: state.engaged, manual: false }}
      cctv={cctv}
      onClick={(e) => e.stopPropagation()}
    />,
    host,
  );
}
