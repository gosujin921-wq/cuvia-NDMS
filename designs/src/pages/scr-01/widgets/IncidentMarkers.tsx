/* ─────────────────────────────────────────────
 * 사건·감시구역 이름표 마커 — IA-01 공간 개요 (IA §6). CSMS SiteMarkers 문법을 그대로 잇는다
 *
 * 시 전체 배율에서는 장비 마커를 올리지 않는다. 지구 이름표를 띄우고 진행 사건이 있는 지구만 점 색으로 가른다.
 * 원색 테두리·후광·숨쉬는 배경은 없다 — 위험 현황·상단 스트립·피드가 이미 같은 신호를 준다.
 *
 * ★ 정상 지구는 점만 남긴다 (CSMS 2026-08-28 · "지도가 배경이 아니라 정보 덩어리처럼 보인다").
 *   이름을 쓰는 것은 ① 사건이 선 곳(active) ② 고른 곳(selected) ③ 메인 사건 ④ 가리킨 곳(hovered)뿐이다.
 *   위험 쪽을 더 세게 켜는 게 아니라 정상 쪽을 물리는 방식이다. 감시 우선구역도 정상이면 점만 남는다 — 평시에
 *   서항·봉암이 열려 있어 기본 화면이 거기에 포커스된 것처럼 읽혔다(사용자 지시, 2026-09-14). 감시 표기는
 *   이름이 설 때 보조 표기(kind)로만 붙고, 목록 둘째 줄과 피드가 감시를 든다.
 *
 * ★ 핀 한 개의 색은 지구 상태 하나다 — 점·잔물결·선택 테두리 전부 (사용자 지적, 2026-09-14). CSMS 는 점을 사업장
 *   상태, 잔물결을 사건 위험도로 갈랐지만 두 축의 색이 우연히 같아 안 보였을 뿐이다. NDMS 는 지구 상태가 3단
 *   (위험 lv5 · 주의 lv3)이고 등급은 4단(경계 lv4 포함)이라 경계 사건 지구에서 노랑 점 · 주황 잔물결 · 노랑
 *   테두리가 한 핀에 섞였다. 등급은 목록 둘째 줄과 피드가 든다. 메인 사건 지구만 숨쉰다.
 * ★ 고른 지구는 테두리로 안다. 정상이면 선택 파랑, 주의·위험이면 그 상태 색 — 점은 빨간데 테두리만 파랗게 서면
 *   두 색이 싸운다 (CSMS 2026-08-27).
 * ★ 목록 줄 호버도 같은 상태다 (lib/district-hover) — 정상 지구가 점만 남은 뒤로 목록에서 가리키는 곳을 지도에서
 *   찾을 길이 이것뿐이다.
 * 자리 잡기는 MapLibre Marker 에, 내용은 React 에.
 * ───────────────────────────────────────────── */

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import { cn } from "@ds";
import { PulseDot } from "../../../components/PulseDot";
import { DISTRICT_STATUS_TONE, type DistrictStatus } from "../../../lib/status-tone";
import { useDistrictHover } from "../../../lib/district-hover";
import { useScenario } from "../../../state/ScenarioProvider";

export interface MapLabel {
  id: string;
  name: string;
  /** 보조 표기 — 재난유형 또는 "유형 · 감시" */
  kind: string;
  center: [number, number];
  /** 지구 상태 — 점·잔물결·선택 테두리 색 */
  status: DistrictStatus;
  /** 메인 사건 지구만 점이 숨쉰다 */
  pulse: boolean;
  ariaLabel: string;
}

interface IncidentMarkersProps {
  map: RefObject<maplibregl.Map | null>;
  ready: boolean;
  labels: MapLabel[];
  onOpen: (label: MapLabel) => void;
}

/* 잔물결 기준 지름 — 이름표 밖으로 크게 퍼지는 크기(최대 112px). 사건 핀(DS MapMarker event)과 같은 급 */
const RIPPLE_SIZE = 56;

export function IncidentMarkers({ map, ready, labels, onOpen }: IncidentMarkersProps) {
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
    /* 컨테이너는 클릭을 받지 않는다. 이름표만 스스로 켠다 */
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

  const { selectedDistrictId, selectDistrict } = useScenario();
  const tone = DISTRICT_STATUS_TONE[label.status];
  /* 정상은 회색 점이다 · 색은 톤 표가 든다(status-tone). 목록 점과 같은 값 */
  const active = label.status !== "정상";
  const selected = selectedDistrictId === label.id;

  const [selfHovered, setHovered] = useState(false);
  const { hoveredDistrictId } = useDistrictHover();
  const listHovered = hoveredDistrictId === label.id;
  const hovered = selfHovered || listHovered;

  const labeled = active || selected || label.pulse || hovered;

  /* 층서 · 무엇을 위로 올릴지가 곧 "먼저 읽어야 할 것"의 순서다
       0(auto) 점만 남은 정상 지구 / 1 이름이 선 곳과 숨쉬는 곳 / 2 가리키는 것 / 3 팝업(index.css .dsms-popup)
     이름표는 점보다 늘 위다 — 이름이 서는 조건과 층을 올리는 조건을 같은 값(labeled)으로 묶는다 */
  useEffect(() => {
    host.style.zIndex = hovered ? "2" : labeled || label.pulse ? "1" : "";
  }, [host, hovered, labeled, label.pulse]);

  return createPortal(
    <button
      type="button"
      onClick={() => {
        selectDistrict(label.id);
        onOpen(label);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-label={label.ariaLabel}
      className={cn(
        "glass-light pointer-events-auto relative flex cursor-pointer items-center gap-1.5 whitespace-nowrap border",
        /* transition-all · hover 확대(transform)뿐 아니라 상태 전환 시 borderColor(인라인 style)도 같이 보간한다 */
        "rounded-full text-caption font-medium transition-all duration-300 hover:scale-105",
        labeled ? "py-1 pl-2 pr-2.5" : "p-1.5",
        /* 목록에서 가리킨 곳 · 마우스가 지도 위에 없으니 hover: 는 안 걸린다. 같은 확대에 선택 파랑 후광을 한 겹 두른다 */
        listHovered && "scale-105 ring-2 ring-primary-text/50",
      )}
      style={{
        borderColor: selected ? (active ? tone.color : "var(--color-primary-text)") : "rgba(255, 255, 255, 0.7)",
      }}
    >
      <span className="relative flex items-center gap-1.5">
        <PulseDot dotClass={tone.dot} ripple={label.pulse} rippleSize={RIPPLE_SIZE} />
        {/* 글자는 잔물결 위 · 잔물결이 글자 밑으로 지나가게 z-[1] 로 한 층 올린다 */}
        {labeled && (
          <>
            <span className="relative z-[1]">{label.name}</span>
            <span className="glass-light-muted relative z-[1]">{label.kind}</span>
          </>
        )}
      </span>
    </button>,
    host,
  );
}
