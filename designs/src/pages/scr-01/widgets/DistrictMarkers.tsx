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
import { fadeColor } from "../../../lib/color";

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

  /* 이름표 층서 (03 §0-5) — 시 전체 배율에서 12개가 겹친다. 무엇을 위로 올릴지가 곧
     "먼저 읽어야 할 것"의 순서다.

       0(auto)  평시 지구
       1        사건이 선 지구 — 평시 이름표에 가려지지 않는다
       2        가리키는 지구 — 읽으려고 손을 올린 것이 가장 위다
       3        팝업 (index.css .dsms-popup)

     사건 유무는 계측 단계에서 파생되고(event) 호버만 화면 로컬 상태다 */
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    host.style.zIndex = hovered ? "2" : event ? "1" : "";
  }, [host, hovered, event]);

  return createPortal(
    <button
      type="button"
      onClick={() => onOpen(district)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-label={`${district.name} ${district.kind}${spec ? ` · ${spec.label} 발생 중` : ""}`}
      className={cn(
        "glass-light pointer-events-auto relative flex cursor-pointer items-center gap-1.5 whitespace-nowrap",
        "rounded-full py-1 pl-2 pr-2.5 text-caption font-medium transition-transform hover:scale-105",
        /* 진행 중인 지구는 단계 색 스트로크를 두껍게 — 12개가 흩어진 배율에서 어느 곳이
           경보 중인지 이름을 읽기 전에 테두리로 먼저 갈린다. 평상시는 얇은 유리 테두리 */
        spec ? "border-2" : "border",
      )}
      style={{
        /* 면·blur·글자색은 .glass-light 가 맡는다(index.css) */
        borderColor: spec ? spec.color : "rgba(255, 255, 255, 0.7)",
        /* 단계 색을 한 겹 더 밖으로 흘려 스트로크가 지도 위에서 묻히지 않게 한다.
           fadeColor 를 쓰는 이유는 spec.color 가 var() 토큰이라 hex 알파를 못 붙여서다 */
        ...(spec && {
          boxShadow: `0 0 0 3px ${fadeColor(spec.color, 20)}, 0 4px 16px rgba(0, 0, 0, 0.22)`,
        }),
      }}
    >
      {/* 사건이 있는 동안 이름표 면 전체가 단계 색으로 숨쉰다. 점 하나가 깜빡이는 것보다
          시 전체 배율에서 먼저 눈에 들고, 멈추지 않으므로 "지금 진행 중"이 계속 읽힌다.
          면은 글자 밑에 깔린다 — 아래 내용 묶음이 relative 로 그 위에 선다 */}
      {spec && (
        <span
          className="pointer-events-none absolute inset-0 animate-pulse rounded-full"
          style={{ backgroundColor: fadeColor(spec.color, 32) }}
          aria-hidden
        />
      )}
      <span className="relative flex items-center gap-1.5">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: spec ? spec.color : "var(--color-foreground-subtle)" }}
          aria-hidden
        />
        {district.name}
        <span className="glass-light-muted">{district.kind}</span>
      </span>
    </button>,
    host,
  );
}
