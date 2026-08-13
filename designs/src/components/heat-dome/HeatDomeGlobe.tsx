/* ─────────────────────────────────────────────
 * 열돔 지구본 — 지도 하나를 통째로 소유하는 부품
 *
 * ★ 이 부품은 **자기 지도를 스스로 만든다.** 남의 지도에 얹지 않는다.
 *
 * 얹으면 안 되는 이유가 셋이다. 상층 격자가 2°(약 182km)라 도시 배율(줌 14)에서는 화면
 * 전체가 격자 한 칸 안에 들어가 색면이 균일한 한 색이 되고 등고선은 화면 밖이다. 지구본
 * 배색(globe-skin)은 저배율 레이어를 덮는 옷이라 도시 배색을 망가뜨린다. 그리고 이 화면은
 * 카메라를 창원에 못 박는데 디지털트윈은 기울이고 돌리는 3D 씬이다.
 *
 * 그래서 **곁에 따로 띄운다.** 지도가 둘이 되지만 서로 독립이라 배색도 카메라도 안 부딪힌다.
 * 스타일은 loadPatchedStyle() 이 부를 때마다 새로 받으므로 같은 객체를 공유하지 않는다.
 *
 * 두 자리에서 같은 부품을 쓴다:
 *  · 디지털트윈 우측 레일 — `variant="panel"` (조작 없음 · 작게)
 *  · /preview/heat-dome   — `variant="full"`  (휠 확대 · 크게)
 * ───────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CITY_CENTER } from "../../lib/map-config";
import { loadPatchedStyle } from "../../lib/map-style";
import { GLOBE_COLORS, GLOBE_SKY, applyGlobeSkin } from "../../lib/globe-skin";
import { valuesOf, type WeatherField } from "../../lib/weather-field";
import { buildContour, contourId, contourLayerSpec } from "../../lib/upper-contour";
import {
  DOME_LAYER_ID,
  DOME_SOURCE_ID,
  buildDomeImage,
  domeImageCorners,
  domeLayerSpec,
} from "../../lib/dome-layer";
import { DomeGrid } from "./DomeGrid";
import { LOWER, UPPER } from "./useHeatDomeData";

/**
 * 화면에 담을 **경도 폭(°)** — 배율 숫자가 아니라 이것을 못 박는다.
 *
 * 한때 배율(줌 4.2~5.2)을 박아 두었다. 그러면 **창 크기에 따라 보이는 범위가 달라진다** —
 * 같은 줌 4.2 가 1200px 창에서는 45.9°, 1930px 창에서는 73.8° 다. 좁은 창에 맞춰 놓은 값이
 * 넓은 창에서는 지구 곡면 끝과 자료 서쪽 끝을 드러내고, 넓은 창에 맞추면 좁은 창에서 돔이
 * 화면을 꽉 채워 "어디에 있는 돔인지" 가 사라진다.
 *
 * fitBounds 도 써 봤지만 지구본에서는 위도까지 맞추려다 필요 이상으로 축소한다. 그래서
 * **폭에서 배율을 직접 계산한다** — 아래 zoomFor(). 어떤 창에서도 같은 경도 폭이 보인다.
 *
 * 폭을 56° 로 둔 것은 두 가지를 동시에 지키기 위해서다.
 *  · 동쪽 끝이 창원+28° = 156.7°E 라, 색면이 온전한 동쪽 끝(166.7°E — 자료 끝 178.7°E 에서
 *    페이드 12° 안쪽)을 안 넘는다. 넘으면 옅어진 자락이 화면에 들어와 돔이 잘려 보인다
 *  · 돔(대략 20° 폭)이 화면의 3분의 1을 차지해, 서쪽 대륙과 동쪽 바다라는 문맥이 남는다
 */
const VIEW_LON_SPAN = {
  /** 곁 패널 — 좁아서 돔과 그 언저리만 담는다 */
  panel: 34,
  /** 전용 화면 — 서쪽 대륙과 동쪽 바다까지 */
  full: 56,
} as const;

/** 확대 여유 — 맞춘 배율에서 이만큼만 더 당길 수 있다 */
const ZOOM_HEADROOM = 0.9;

/**
 * 기울임(°) — 돔이 **구 위에 얹힌 덩어리**로 읽히게 한다.
 *
 * 평면으로 내려다보면 색면이 지도 위 얼룩으로만 보인다. 눕히면 지구 곡면이 드러나면서
 * 돔이 그 위에 부풀어 앉은 것으로 읽힌다.
 *
 * 지구본 투영의 기울임 상한은 60° 다(그 위는 MapLibre 가 잘라낸다). 45° 로 둔 것은
 * 55~60° 까지 눕히면 먼 쪽이 지평선에 붙어 돔 북쪽 절반이 납작해지기 때문이다.
 *
 * 눕히면 화면 가운데가 중심보다 **뒤쪽(북쪽)** 을 비추므로, 창원이 화면 아래로 처진다.
 * 위쪽에 여백을 줘 다시 가운데로 올린다(PITCH_PADDING).
 */
const PITCH = { panel: 45, full: 55 } as const;

/**
 * 눕힌 만큼 **아래쪽**에 두는 여백 비율 — 화면 높이의 이만큼.
 *
 * 위쪽에 줬다가 반대로 갔다. 여백을 준 쪽은 비워지고 중심은 **남은 쪽 한가운데**로 가므로,
 * 위를 비우면 중심이 아래로 처져 돔 아랫부분이 화면 밖으로 잘린다. 아래를 비워야 중심이
 * 올라오고, 덤으로 화면 아래 조작 막대에 돔이 가리지 않는다.
 *
 * 다만 0.24 는 너무 올렸다 — 창원이 화면 위쪽으로 치우쳐 아래가 허전했다. 0.1 로 낮춰
 * 창원을 가운데 가까이 내린다.
 */
const PITCH_PADDING = 0.1;

/**
 * 눕힌 만큼 배율을 빼는 양.
 *
 * 기울이면 앞쪽(남쪽)이 화면을 더 많이 차지해, 같은 배율이라도 담기는 폭이 준다.
 * 이만큼 빼야 평면으로 볼 때와 비슷한 넓이가 남는다.
 */
const PITCH_ZOOM_TRIM = 0.35;

/**
 * 투영 — **평면**이다. 지구본이 아니다.
 *
 * 처음에는 지구본으로 만들었는데, 눕히자 두 가지가 한꺼번에 깨졌다. 지구본은 기울임 상한이
 * 60° 라 여유가 없고, 45° 만 줘도 화면 위쪽이 극지방으로 채워지면서 돔이 아래로 밀려 잘린다.
 * 곡면 끝(림)도 다시 드러난다.
 *
 * 평면은 상한이 85° 라 여유가 크고, 폭에서 배율을 계산하는 방식(zoomFor)이 그대로 맞는다.
 * "지구처럼 보이는 것" 은 이 화면의 목적이 아니다 — 목적은 돔이 **면 위에 얹힌 덩어리**로
 * 읽히는 것이고, 그건 기울임만으로 난다.
 */
const PROJECTION = "mercator" as const;

/**
 * 화면 폭(px)에 경도 폭(°)을 담는 배율.
 *
 * MapLibre 는 배율 z 에서 세계 한 바퀴(360°)를 512·2^z 픽셀로 그린다. 그 관계를 뒤집은 것이다.
 */
function zoomFor(widthPx: number, lonSpanDeg: number): number {
  return Math.log2((360 * widthPx) / (512 * lonSpanDeg));
}

/**
 * 격자 색 — 경계선과 같은 흰색이되 **투명도로** 두 톤 낮춘다.
 *
 * 경계선이 0.7 이므로 격자는 0.2 다. 격자는 정보가 아니라 부풀음을 읽는 **눈금**이라
 * 색을 달리해 또 하나의 정보처럼 보이게 하지 않는다. 같은 색으로 두고 밝기만 낮춰 뒤로 물린다.
 */
const GRID_COLOR = "rgba(255, 255, 255, 0.2)";

/** 창원 표지 색 — 돔의 붉은색·경계의 회색 어느 쪽과도 안 겹치는 따뜻한 노랑 */
const CHANGWON = { fill: "#FFD37A", line: "#FFE9B8" };

const CHANGWON_SOURCE_ID = "changwon-area";
const CHANGWON_FILL_ID = "changwon-area-fill";
const CHANGWON_LINE_ID = "changwon-area-line";

export interface HeatDomeGlobeProps {
  lower: WeatherField | null;
  upper: WeatherField | null;
  /** 보고 있는 프레임 번호 */
  index: number;
  /** 곁 패널인가 전용 화면인가 */
  variant?: "panel" | "full";
  /** 색면·경계선 보이기 */
  showWash?: boolean;
  showLines?: boolean;
  /** 부풀음을 읽는 경위도 격자 */
  showGrid?: boolean;
  className?: string;
  /** 곁 패널이 높이를 준다 — 지도는 부모가 정한 자리를 꽉 채운다 */
  style?: React.CSSProperties;
}

export function HeatDomeGlobe({
  lower,
  upper,
  index,
  variant = "panel",
  showWash = true,
  showLines = true,
  showGrid = true,
  className,
  style,
}: HeatDomeGlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  /** 휠 처리기 해제 — 화면을 떠날 때 지운다 */
  const wheelOff = useRef<(() => void) | null>(null);
  /** 창원 이름표 — 지도와 함께 지운다 */
  const labelRef = useRef<maplibregl.Marker | null>(null);
  const [ready, setReady] = useState(false);
  /* 격자가 같은 지도 위에 그려져야 해서 인스턴스를 상태로도 들고 있는다 —
     ref 는 바뀌어도 다시 그리지 않는다 */
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);

  /*
   * 구운 색면을 프레임마다 담아 둔다.
   *
   * 색면 한 장을 굽는 데 600×290 캔버스를 채우고 PNG 로 인코딩하느라 100ms 쯤 걸린다.
   * 돌려보기에서 이걸 매번 다시 하면 실측 2.9장/초까지 떨어졌다 — 간격을 240ms 로 줘도
   * 굽는 시간이 얹혀 341ms 가 됐다. 한 번 구운 장은 그대로 다시 쓴다.
   *
   * 44장이면 1~2MB 다. 자료가 바뀌면(다른 날을 구워 넣으면) 통째로 비운다.
   */
  const washCache = useRef(new Map<number, string>());
  /** 등고선도 같이 담는다 — marching squares 자체는 싸지만 setData 가 매번 다시 쪼갠다 */
  const contourCache = useRef(new Map<number, { lo: unknown; up: unknown }>());

  /* ── 지도 한 번 만들기 ─────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    const lonSpan = VIEW_LON_SPAN[variant];
    /** 맞춘 뒤 확정되는 배율 구간 — 창 크기에 따라 달라지므로 여기서 채운다 */
    const range = { min: 0, max: 0 };

    void (async () => {
      let style;
      try {
        /* 도시 배율용 스타일 위에 지구본 옷을 덧입힌다 — **이 지도에만** 적용된다.
           트윈 본 지도는 같은 함수를 부르되 이 한 줄이 없어 원래 색 그대로다 */
        style = applyGlobeSkin(await loadPatchedStyle());
      } catch (e) {
        console.error("[heat-dome] 스타일 로드 실패", e);
        return;
      }
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: CITY_CENTER,
        /* 아래 fit() 이 곧 덮어쓴다. 여기 값은 첫 프레임용이다 */
        zoom: 3,
        pitch: PITCH[variant],
        /* 지구를 옆으로 반복해 그리지 않는다 — 반복본 위에는 색면이 없어 같은 바다가
           두 번 나오면서 한쪽만 물들어 보인다 */
        renderWorldCopies: false,
        attributionControl: false,
      });
      mapRef.current = map;
      setMapInstance(map);

      /* 개발용 통로 — 자동 검사에서 배율·중심을 값으로 읽으려고 둔다.
         눈으로 보는 것만으로는 "확대가 되나 / 축소가 막혔나" 를 확인할 수 없었다.
         빌드에서는 빠진다(import.meta.env.DEV) */
      if (import.meta.env.DEV) {
        (window as unknown as { __heatDomeMap?: maplibregl.Map }).__heatDomeMap = map;
      }

      /*
       * 카메라를 창원에 못 박는다 — 끌어서 옮길 수 없고 배율만 바뀐다.
       *
       * maxBounds 로 범위만 묶으려 했다가 실패했다 — **지구본 투영에서는 안 먹는다.**
       * 끌면 그대로 태평양까지 밀려나고 색면 없는 바다만 남는다.
       */
      map.dragPan.disable();
      map.dragRotate.disable();
      map.keyboard.disable();
      map.doubleClickZoom.disable();
      map.touchZoomRotate.disableRotation();
      map.scrollZoom.disable();

      if (variant === "full") {
        /*
         * 휠 확대는 직접 받는다.
         *
         * MapLibre 기본 휠은 **커서 자리를 붙잡고** 당긴다. 끌기를 막아도 확대만 몇 번
         * 하면 창원이 화면 밖으로 나간다(784px → 171px 로 밀렸다). scrollZoom 에
         * `around: "center"` 를 줘도 이 판에서는 안 먹었다.
         */
        const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          /*
           * 배율도 **직접 자른다.**
           *
           * minZoom/maxZoom 을 지도에 줘도 지구본 투영에서는 안 지켜진다 — maxBounds 와
           * 같은 계열이다. 실제로 min 4.2 를 준 상태에서 휠을 굴리면 3.91 까지 내려갔고,
           * 그만큼 격자 끝이 화면에 들어와 돔이 잘려 보였다.
           */
          const next = Math.min(range.max, Math.max(range.min, map.getZoom() - e.deltaY * 0.004));
          map.easeTo({ zoom: next, center: CITY_CENTER, pitch: PITCH[variant], duration: 140 });
        };
        map.getCanvas().addEventListener("wheel", onWheel, { passive: false });
        wheelOff.current = () => map.getCanvas().removeEventListener("wheel", onWheel);
      }

      map.on("styleimagemissing", (e) => {
        if (map.hasImage(e.id)) return;
        map.addImage(e.id, { width: 1, height: 1, data: new Uint8ClampedArray([0, 0, 0, 0]) });
      });

      /** 정해 둔 경도 폭을 창에 맞춘다 — 창이 바뀌면 다시 맞춘다 */
      const fit = () => {
        const w = map.getContainer().clientWidth || 1;
        range.min = zoomFor(w, lonSpan) - PITCH_ZOOM_TRIM;
        range.max = range.min + ZOOM_HEADROOM;
        /* 이미 확대해 둔 상태라면 그 배율을 지키되 새 하한 아래로는 안 내려가게 */
        /* 눕히면 화면 가운데가 중심보다 뒤를 비춘다 — 위쪽 여백으로 되돌린다 */
        const h = map.getContainer().clientHeight || 1;
        map.setPadding({ top: 0, bottom: Math.round(h * PITCH_PADDING), left: 0, right: 0 });
        map.jumpTo({
          center: CITY_CENTER,
          zoom: Math.min(range.max, Math.max(range.min, map.getZoom())),
          pitch: PITCH[variant],
        });
      };

      map.on("load", () => {
        /* 투영은 **스타일이 선 뒤에** 바꾼다. 그 전에 부르면 MapLibre 가 거절한다 */
        map.setProjection({ type: PROJECTION });
        /* 맞추기는 투영을 바꾼 **뒤**다 — 지구본과 평면은 같은 범위를 담는 배율이 다르다 */
        fit();
        map.on("resize", fit);
        map.setSky({ ...GLOBE_SKY });

        /* 창원시 행정경계 — 돔 색면보다 위에 온다. 점이 아니라 면이라야 돔이 시의 어디까지
           덮는지 짚을 수 있다 */
        void fetch("/changwon-boundary.geojson")
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
          .then((data) => {
            if (!mapRef.current || map.getSource(CHANGWON_SOURCE_ID)) return;
            map.addSource(CHANGWON_SOURCE_ID, { type: "geojson", data });
            map.addLayer({
              id: CHANGWON_FILL_ID,
              type: "fill",
              source: CHANGWON_SOURCE_ID,
              paint: { "fill-color": CHANGWON.fill, "fill-opacity": 0.42 },
            });
            map.addLayer({
              id: CHANGWON_LINE_ID,
              type: "line",
              source: CHANGWON_SOURCE_ID,
              layout: { "line-cap": "round", "line-join": "round" },
              paint: {
                "line-color": CHANGWON.line,
                /* 멀수록 굵게 — 곁 패널에서는 시가 몇 픽셀이라 가늘면 사라진다 */
                "line-width": ["interpolate", ["linear"], ["zoom"], 2, 3, 5, 2.2, 8, 1.8],
                "line-opacity": 1,
              },
            });
          })
          .catch((e) => console.warn("[heat-dome] 창원 경계를 읽지 못했다", e));

        /*
         * 창원 이름표 — 자리 표시는 위에서 칠한 **시 경계 면**이 맡는다.
         *
         * 점을 같이 찍으면 면과 점이 같은 것을 두 번 말하고, 지구본 배율에서는 점이 면을
         * 통째로 덮어 관할 범위가 안 보인다.
         */
        const el = document.createElement("div");
        el.style.cssText = [
          `font-size:${variant === "panel" ? 10 : 12}px`,
          "font-weight:700",
          "white-space:nowrap",
          `color:${CHANGWON.line}`,
          "text-shadow:0 0 4px rgba(4,16,30,.95), 0 1px 2px rgba(4,16,30,.95)",
          `transform:translateY(${variant === "panel" ? -11 : -14}px)`,
          "pointer-events:none",
        ].join(";");
        el.textContent = "창원시";
        labelRef.current = new maplibregl.Marker({ element: el })
          .setLngLat(CITY_CENTER)
          .addTo(map);

        setReady(true);
      });
    })();

    return () => {
      cancelled = true;
      wheelOff.current?.();
      wheelOff.current = null;
      labelRef.current?.remove();
      labelRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapInstance(null);
      setReady(false);
    };
    // 변형은 마운트 시점에 정해진다 — 도중에 바뀌면 지도를 새로 만들어야 하는데 그럴 일이 없다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * 자료가 바뀌면 담아 둔 색면을 비우고, 한가한 틈에 미리 구워 둔다.
   *
   * 미리 굽지 않으면 첫 바퀴가 여전히 느리다 — 두 바퀴째부터 부드러워지는 것은
   * 시연에서 쓸 수 없다. 한 번에 두 장씩만 굽고 화면에 양보한다.
   */
  useEffect(() => {
    washCache.current.clear();
    contourCache.current.clear();
    if (!lower || !upper) return;

    const total = Math.min(lower.frames.length, upper.frames.length);
    let stopped = false;
    let at = 0;

    const idle: (cb: () => void) => number =
      typeof requestIdleCallback === "function"
        ? (cb) => requestIdleCallback(() => cb())
        : (cb) => window.setTimeout(cb, 32);

    const step = () => {
      if (stopped) return;
      for (let n = 0; n < 2 && at < total; n++, at++) {
        if (washCache.current.has(at)) continue;
        try {
          washCache.current.set(
            at,
            buildDomeImage(
              { field: lower, values: valuesOf(lower.frames[at], LOWER), threshold: LOWER.contour },
              { field: upper, values: valuesOf(upper.frames[at], UPPER), threshold: UPPER.contour },
            ),
          );
        } catch {
          /* 한 장 못 구워도 돌려보기는 그 장만 그때 굽는다 */
        }
      }
      if (at < total) idle(step);
    };
    idle(step);

    return () => {
      stopped = true;
    };
  }, [lower, upper]);

  /* ── 돔 색면 + 등고선 두 줄 ─────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !lower || !upper) return;

    const fLo = lower.frames[Math.min(index, lower.frames.length - 1)];
    const fUp = upper.frames[Math.min(index, upper.frames.length - 1)];
    if (!fLo || !fUp) return;
    const vLo = valuesOf(fLo, LOWER);
    const vUp = valuesOf(fUp, UPPER);

    let url = washCache.current.get(index);
    if (!url) {
      try {
        url = buildDomeImage(
          { field: lower, values: vLo, threshold: LOWER.contour },
          { field: upper, values: vUp, threshold: UPPER.contour },
        );
      } catch (e) {
        console.warn("[heat-dome] 돔 색면을 굽지 못했다", e);
        return;
      }
      washCache.current.set(index, url);
    }
    const corners = domeImageCorners(lower);
    const under = map.getLayer(CHANGWON_FILL_ID) ? CHANGWON_FILL_ID : undefined;

    const image = map.getSource(DOME_SOURCE_ID) as maplibregl.ImageSource | undefined;
    if (image) {
      image.updateImage({ url, coordinates: corners });
    } else {
      map.addSource(DOME_SOURCE_ID, { type: "image", url, coordinates: corners });
      map.addLayer(domeLayerSpec(showWash), under);
    }

    /* 두 경계선. 아래층이 실선, 위층이 점선이다 — 색만으로 가르지 않는다 */
    let cached = contourCache.current.get(index);
    if (!cached) {
      cached = {
        lo: buildContour(lower, vLo, LOWER.contour),
        up: buildContour(upper, vUp, UPPER.contour),
      };
      contourCache.current.set(index, cached);
    }

    for (const [spec, data, dashed] of [
      [LOWER, cached.lo, false],
      [UPPER, cached.up, true],
    ] as const) {
      const id = contourId(spec.id);
      const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData(data as GeoJSON.FeatureCollection);
      } else {
        map.addSource(id, { type: "geojson", data: data as GeoJSON.FeatureCollection });
        map.addLayer(
          contourLayerSpec(id, showLines, { dashed, opacity: dashed ? 0.45 : 0.7 }),
          under,
        );
      }
    }

    /* 경계를 항상 맨 위로.
       경계는 fetch 로 늦게 붙으므로 먼저 붙는 날이 있고 나중에 붙는 날이 있다. addLayer 의
       `under` 만 믿으면 순서가 뒤집혀 관할 구역이 돔 아래로 깔린다 — 실제로 그렇게 묻혔다 */
    for (const id of [CHANGWON_FILL_ID, CHANGWON_LINE_ID]) {
      if (map.getLayer(id)) map.moveLayer(id);
    }
    // 보이기는 아래 토글 효과가 맡는다. 여기 의존값에 넣으면 켤 때마다 색면을 다시 굽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, lower, upper, index]);

  /* ── 켜고 끄기 ─────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer(DOME_LAYER_ID)) return;
    map.setLayoutProperty(DOME_LAYER_ID, "visibility", showWash ? "visible" : "none");
  }, [showWash, ready, lower, upper, index]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const spec of [LOWER, UPPER]) {
      const id = contourId(spec.id);
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", showLines ? "visible" : "none");
      }
    }
  }, [showLines, ready, lower, upper, index]);

  return (
    /*
     * 두 겹인 이유 — 바깥이 자리를 잡고 안쪽 지도 컨테이너가 그 자리를 꽉 채운다.
     *
     * ★ 바깥에 `relative` 를 박지 않는다. 호출부가 `absolute inset-0` 을 넘기면 두 유틸리티가
     *   부딪히고 Tailwind 에서는 `relative` 가 이겨, 자리를 못 잡아 **높이가 0 으로 접힌다**
     *   — 지도가 통째로 안 보인다. 실제로 한 번 그렇게 비었다. 자리잡기는 전적으로 호출부
     *   몫이다(`absolute inset-0` 이든 높이를 준 style 이든).
     *
     * ★ 안쪽 컨테이너에도 `absolute inset-0` 을 주면 안 된다 — MapLibre 가 붙이는
     *   `.maplibregl-map { position: relative }` 이 Tailwind 유틸리티를 이겨서
     *   (v4 유틸리티는 레이어 안이라 레이어 밖 CSS 에 진다) inset 이 죽고 역시 접힌다.
     *   그래서 `h-full w-full` 이다.
     */
    <div
      className={`overflow-hidden ${className ?? ""}`}
      style={{
        background:
          `radial-gradient(120% 90% at 50% 45%, ${GLOBE_COLORS.spaceInner} 0%, ` +
          `${GLOBE_COLORS.spaceMid} 45%, ${GLOBE_COLORS.spaceOuter} 100%)`,
        ...style,
      }}
    >
      <div ref={containerRef} className="h-full w-full" />
      {/* 격자는 지도 캔버스 **위에** 따로 그린다 — 지도 레이어로는 높이를 못 준다 */}
      <DomeGrid
        map={mapInstance}
        ready={ready}
        lower={lower}
        upper={upper}
        index={index}
        visible={showGrid}
        color={GRID_COLOR}
      />
    </div>
  );
}
