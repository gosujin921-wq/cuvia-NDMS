/* ─────────────────────────────────────────────
 * MapLibre 지도 초기화 훅
 *
 * 스타일 가공 → 지도 생성 → 준비 완료 통지.
 * 지도는 항상 패널 아래에 깔린다. 레이어 순서는 지도 컨테이너 쪽에서 z-0 + isolation 으로 잡는다.
 *
 * 스타일은 URL 을 그대로 넘기지 않고 loadPatchedStyle() 로 미리 고쳐서 넘긴다. 지도를 띄운
 * 뒤 setPaintProperty 로 고치면 타일별로 색이 갈린다 — 이유는 map-style.ts 머리말 참고.
 *
 * ▸ 제품 정본: cuvia_platform_web kits/gis-kit (@cuvia/gis-kit MapViewer + MapProvider/useMap
 *   + hooks/use-map-core) — 정본은 지도 인스턴스를 컨텍스트로 내려 오버레이 부품이 꺼내 쓴다.
 *   이 앱은 그 워크스페이스 밖이라 훅 하나로 줄였고, 지도 ref 를 컴포넌트에 prop 으로 넘긴다.
 *   지도 부품(MapPins·MapPopup·MapUtilStrip)이 전부 이 ref 규약에 묶여 있으므로,
 *   gis-kit 으로 옮길 때는 이 훅부터 MapProvider 로 갈아끼운 뒤 부품을 하나씩 바꾼다.
 * ───────────────────────────────────────────── */

import { useEffect, useRef, useState, type RefObject } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CITY_CENTER, KOREA_BOUNDS, MAP_VIEW_DEFAULTS } from "./map-config";
import { loadPatchedStyle } from "./map-style";

interface UseMapLibreOptions {
  center?: [number, number];
  zoom?: number;
  /** 시작 각도 — 3D 씬은 처음부터 눕혀서 연다 */
  pitch?: number;
  /** 오버레이에 가려지는 폭 (px). 중심·줌 맞춤이 남은 영역 기준으로 잡힌다 */
  padding?: { top: number; bottom: number; left: number; right: number };
}

export function useMapLibre(
  containerRef: RefObject<HTMLDivElement | null>,
  options: UseMapLibreOptions = {},
) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    /* 스타일을 받아오는 사이에 컴포넌트가 사라질 수 있다. 그때는 지도를 만들지 않는다 */
    let cancelled = false;

    void (async () => {
      let style;
      try {
        style = await loadPatchedStyle();
      } catch (e) {
        /* 스타일을 못 받으면 지도를 띄울 수 없다. 화면은 빈 채로 두고 로그만 남긴다 */
        console.error("[map] 스타일 로드 실패", e);
        return;
      }
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: options.center ?? CITY_CENTER,
        zoom: options.zoom ?? MAP_VIEW_DEFAULTS.zoom,
        minZoom: MAP_VIEW_DEFAULTS.minZoom,
        maxZoom: MAP_VIEW_DEFAULTS.maxZoom,
        maxBounds: KOREA_BOUNDS,
        pitch: options.pitch ?? MAP_VIEW_DEFAULTS.pitch,
        bearing: MAP_VIEW_DEFAULTS.bearing,
        attributionControl: false,
        interactive: true,
      });

      /* 지도는 화면 전체를 쓰지만 좌우 패널에 가려진다. padding 을 주면 중심 맞춤이
         **가려지지 않은 영역**을 기준으로 잡혀, 시 전체가 그 한가운데 선다. */
      if (options.padding) map.setPadding(options.padding);
      mapRef.current = map;

      /* 스타일에 없는 스프라이트 요청은 빈 이미지로 흘려보낸다(콘솔 경고 방지) */
      map.on("styleimagemissing", (e) => {
        if (map.hasImage(e.id)) return;
        map.addImage(e.id, { width: 1, height: 1, data: new Uint8ClampedArray([0, 0, 0, 0]) });
      });

      map.on("load", () => setReady(true));
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // 초기화는 한 번만 — center·zoom 변경은 지도 조작 API 로 처리한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { map: mapRef, ready };
}
