/* ─────────────────────────────────────────────
 * 지도 팝업 — 마커에 붙는 카드
 *
 * 자리 잡기는 MapLibre Popup 에 맡기고 React 는 내용만 그린다. 지도를 끌거나 확대해도
 * 카드가 마커를 따라간다.
 *
 * 기본 크롬(흰 배경·꼬리·닫기 버튼)은 끄고 글라스 패널을 쓴다. 관제 화면에서 흰 말풍선은
 * 혼자 튄다.
 *
 * ▸ 제품 정본: cuvia_platform_web kits/gis-kit MapCoordAnchor — 좌표 위에 앵커를 띄우고
 *   팝오버·툴팁을 거는 같은 역할이다. 이 앱은 그 워크스페이스 밖이라 MapLibre Popup 을
 *   직접 쓴다(크롬 제거는 index.css 의 .dsms-popup 규칙).
 * ───────────────────────────────────────────── */

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";

interface MapPopupProps {
  map: RefObject<maplibregl.Map | null>;
  lngLat: [number, number];
  onClose: () => void;
  children: ReactNode;
  /** 마커 위로 띄우는 간격 (px) */
  offset?: number;
}

export function MapPopup({ map, lngLat, onClose, children, offset = 20 }: MapPopupProps) {
  const [host] = useState(() => document.createElement("div"));

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset,
      maxWidth: "none",
      className: "dsms-popup",
      anchor: "bottom",
    })
      .setLngLat(lngLat)
      .setDOMContent(host)
      .addTo(instance);

    /* 지도 빈 곳을 누르면 닫는다. 마커 클릭은 마커 쪽에서 stopPropagation 으로 막는다 */
    const handleMapClick = () => onClose();
    instance.on("click", handleMapClick);

    return () => {
      instance.off("click", handleMapClick);
      popup.remove();
    };
  }, [map, host, lngLat, offset, onClose]);

  return createPortal(children, host);
}
