/* ─────────────────────────────────────────────
 * 지구 이름표 마커 — 03 화면정의서 §1
 *
 * 시 전체 배율에서는 장비 마커를 올리지 않는다(12개 지구에 50대가 겹쳐 읽히지 않는다).
 * 대신 지구 이름표를 지도 위에 띄우고, 진행 중인 이벤트가 있는 지구만 단계 색으로 세운다.
 *
 * 자리 잡기는 MapLibre Marker 에 맡기고 React 는 내용만 그린다. 지도 move 마다 좌표를
 * 상태로 올리면 드래그 내내 리렌더가 돌아 이름표가 한 프레임씩 밀린다.
 * ───────────────────────────────────────────── */

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import { cn } from "@ds";
import { DISTRICTS, type District } from "../../../demo/districts";
import { activeEventOfAt, eventViewAt } from "../../../demo/events";
import { useScenario } from "../../../state/ScenarioProvider";
import { levelSpec } from "../../../demo/levels";

interface DistrictMarkersProps {
  map: RefObject<maplibregl.Map | null>;
  ready: boolean;
  /** 레이어에서 켜 둔 지구만 — 기본은 전체 */
  districts?: District[];
  onOpen: (district: District) => void;
}

export function DistrictMarkers({
  map,
  ready,
  districts = DISTRICTS,
  onOpen,
}: DistrictMarkersProps) {
  if (!ready) return null;

  return (
    <>
      {districts.map((district) => (
        <DistrictMarker key={district.id} map={map} district={district} onOpen={onOpen} />
      ))}
    </>
  );
}

function DistrictMarker({
  map,
  district,
  onOpen,
}: {
  map: RefObject<maplibregl.Map | null>;
  district: District;
  onOpen: (district: District) => void;
}) {
  const [host] = useState(() => {
    const el = document.createElement("div");
    /* 컨테이너는 클릭을 받지 않는다. 이름표만 스스로 켠다 */
    el.style.pointerEvents = "none";
    return el;
  });

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const marker = new maplibregl.Marker({ element: host, anchor: "bottom" })
      .setLngLat(district.center)
      .addTo(instance);
    return () => {
      marker.remove();
    };
  }, [map, host, district]);

  const { now } = useScenario();
  const event = activeEventOfAt(district.id, now);
  const spec = event ? levelSpec(eventViewAt(event, now).level) : null;

  /* 시 전체 배율에서 이름표끼리 겹친다. 가리키는 지구를 z 1 로 올려 뒤에 깔린 이름표가
     읽히게 한다(호버 확대 105% 도 잘리지 않는다). 손을 떼면 원래 층으로 돌아가고,
     팝업 z 2 는 넘지 않는다 (03 §0-5 층서) */
  const raise = () => {
    host.style.zIndex = "1";
  };
  const drop = () => {
    host.style.zIndex = "";
  };

  return createPortal(
    <button
      type="button"
      onClick={() => onOpen(district)}
      onMouseEnter={raise}
      onMouseLeave={drop}
      onFocus={raise}
      onBlur={drop}
      aria-label={`${district.name} ${district.kind}${spec ? ` · ${spec.label} 발생 중` : ""}`}
      className={cn(
        "glass-light pointer-events-auto flex cursor-pointer items-center gap-1.5 whitespace-nowrap",
        "rounded-full py-1 pl-2 pr-2.5 text-caption font-medium transition-transform hover:scale-105",
        /* 진행 중인 지구는 단계 색 스트로크를 두껍게 — 12개가 흩어진 배율에서 어느 곳이
           경보 중인지 이름을 읽기 전에 테두리로 먼저 갈린다. 평상시는 얇은 유리 테두리 */
        spec ? "border-2" : "border",
      )}
      style={{
        /* 면·blur·글자색은 .glass-light 가 맡는다(index.css) */
        borderColor: spec ? spec.color : "rgba(255, 255, 255, 0.7)",
        /* 단계 색을 한 겹 더 밖으로 흘려 스트로크가 지도 위에서 묻히지 않게 한다 */
        ...(spec && { boxShadow: `0 0 0 3px ${spec.color}33, 0 4px 16px rgba(0, 0, 0, 0.22)` }),
      }}
    >
      <span
        className={cn("size-2 shrink-0 rounded-full", spec && "animate-pulse")}
        style={{ backgroundColor: spec ? spec.color : "var(--color-foreground-subtle)" }}
        aria-hidden
      />
      {district.name}
      <span className="glass-light-muted">{district.kind}</span>
    </button>,
    host,
  );
}
