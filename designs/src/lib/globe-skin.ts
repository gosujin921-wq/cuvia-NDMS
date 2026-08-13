/* ─────────────────────────────────────────────
 * 지구본 살갗 — 저배율에서만 쓰는 어두운 파랑 옷
 *
 * ★ 종합상황 지도(SCR-01·05)는 손대지 않는다. map-style.ts 의 loadPatchedStyle() 이
 *   돌려주는 스타일 **객체를 받아 여기서 한 번 더 덮어쓰는** 방식이라, 이 함수를 부르는
 *   화면에만 적용된다. 스타일은 화면마다 새로 받으므로 서로 섞이지 않는다.
 *
 * ── 왜 필요한가
 *
 * 원본 스타일은 도시 배율을 겨냥해 깔려 있다. 지구본 배율로 빼면 저배율 육지를 통째로
 * 덮는 `Vegetation` 레이어가 명도 92% 라, 화면이 크림색 판이 된다. 그 위에 얹은 열돔
 * 색면이 묻히고, 앱의 다른 화면(명도 13~18% 바탕)과 톤도 어긋난다.
 *
 * 여기서는 반대로 세운다 — **바다가 제일 어둡고, 육지가 그보다 밝은 파랑, 격자와 표지가
 * 그 위에서 빛나는** 순서다. 붉은 열돔이 유일한 따뜻한 색이라 저절로 앞으로 나온다.
 *
 * ── 색을 토큰에서 안 읽는 이유
 *
 * 이 값들은 지도 스타일 JSON 에 들어가야 하고, 스타일은 지도를 만들기 **전에** 넘긴다.
 * 그 시점에 CSS 커스텀 속성을 읽으면 아직 안 풀린 값이 올 수 있다. 그래서 여기만 리터럴을
 * 쓴다 — 대신 한 자리에 모아 둔다. (DS 토큰을 쓰는 화면 부품과는 층이 다르다)
 * ───────────────────────────────────────────── */

import type maplibregl from "maplibre-gl";
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

/** 지구본 배색 — 어두운 바다 위에 파란 육지, 그 위에 빛나는 격자 */
export const GLOBE_COLORS = {
  /** 바다이자 지구의 바탕 — 제일 어둡다. 도시 배율 다크맵과 같은 계열의 중성 회색이다 */
  ocean: "#12151A",
  /** 육지 — 바다보다 한 단 밝은 회색. 대륙 모양이 읽힐 만큼만 든다 */
  land: "#2E343C",
  /** 만년설·고지대 — 육지 중 제일 밝은 자리 */
  landHigh: "#464E58",
  /** 나라 경계 — 회색 바탕 위에서 또렷하게 읽힌다 */
  border: "#C3CAD3",
  /** 행정구역 경계 — 나라 경계보다 한 단 아래. 밝기로 갈라 둔다 */
  subBorder: "#6B747E",
  /** 지명 */
  label: "#98A1AB",
  /* 지구 **바깥** 바탕 — 지도 스타일이 아니라 화면 배경에 쓴다. 검정으로 두면 구가
     공간에 떠 있는 것이 아니라 빈 판에 붙은 것으로 보인다 */
  spaceInner: "#242A31",
  spaceMid: "#161A1F",
  spaceOuter: "#0B0E12",
} as const;

/**
 * 어느 레이어를 무슨 색으로 — 원본 레이어 이름 기준이다.
 *
 * 저배율에서 실제로 그려지는 것만 적는다(줌 4 이하 49개 중 면·선). 도로는 이 배율에
 * 자료가 거의 없어 두지 않았고, 혹시 그려져도 아래에서 통째로 끈다.
 */
const FILL_COLORS: Record<string, string> = {
  Background: GLOBE_COLORS.ocean,
  Water: GLOBE_COLORS.ocean,
  "Swimming pool": GLOBE_COLORS.ocean,
  /* 저배율 육지를 덮는 것들 — 원본이 크림색이라 여기가 핵심이다 */
  Vegetation: GLOBE_COLORS.land,
  Farmland: GLOBE_COLORS.land,
  Wood: GLOBE_COLORS.land,
  Forest: GLOBE_COLORS.land,
  Residential: GLOBE_COLORS.land,
  Commercial: GLOBE_COLORS.land,
  Quarry: GLOBE_COLORS.land,
  Zoo: GLOBE_COLORS.land,
  Ice: GLOBE_COLORS.landHigh,
  Dam: GLOBE_COLORS.land,
  Bridge: GLOBE_COLORS.land,
};

/** 저배율에서 지워야 화면이 조용해지는 것들 — 도로·하천·POI */
const HIDDEN_PREFIXES = ["Road", "Highway", "Major road", "No access", "River", "Stream", "Aerialway"];

/**
 * 지역 구분선 — 경위도 격자 대신 이걸 세운다.
 *
 * 한때 15° 경위도 격자를 그물처럼 깔았다. 참조 그림의 인상은 났지만 **아무것도 구분하지
 * 않는 선**이었다 — 경도 120° 선 양쪽이 다를 것이 없다. 지금은 나라와 행정구역 경계를
 * 세운다. 같은 그물 인상을 내면서 선 하나하나가 뜻을 갖는다.
 *
 * 나라 경계가 제일 밝고, 그 아래 행정구역이 은은하게 깔린다 — 서열이 있어야 화면이
 * 어지럽지 않다.
 */
const BORDER_STYLES: Record<string, { color: string; opacity: number; width: number }> = {
  "Country border": { color: GLOBE_COLORS.border, opacity: 0.85, width: 1.3 },
  "Disputed border": { color: GLOBE_COLORS.border, opacity: 0.5, width: 1 },
  "Sub border": { color: GLOBE_COLORS.subBorder, opacity: 0.6, width: 0.85 },
};

/** 남길 지명 — 나머지 글자는 다 끈다. 대륙·나라만 있으면 위치를 짚을 수 있다 */
const KEPT_LABELS = new Set(["Country labels", "Continent labels", "Ocean labels"]);

/**
 * 스타일에 지구본 옷을 입힌다 — 받은 객체를 고쳐서 돌려준다(map-style.ts 와 같은 약속).
 *
 * 지도를 띄운 뒤 setPaintProperty 로 덮으면 타일별로 색이 갈린다(map-style.ts 머리말).
 * 그래서 여기서도 **띄우기 전에** 고친다.
 */
export function applyGlobeSkin(style: StyleSpecification): StyleSpecification {
  for (const layer of style.layers ?? []) {
    const id = String(layer.id);

    if (HIDDEN_PREFIXES.some((p) => id.startsWith(p))) {
      hide(layer);
      continue;
    }
    if (layer.type === "symbol") {
      if (!KEPT_LABELS.has(id)) {
        hide(layer);
        continue;
      }
      layer.paint = {
        ...layer.paint,
        "text-color": GLOBE_COLORS.label,
        "text-halo-color": GLOBE_COLORS.ocean,
        "text-halo-width": 1.2,
      };
      continue;
    }

    const color = FILL_COLORS[id];
    if (color) {
      const prefix = layer.type === "background" ? "background" : "fill";
      layer.paint = { ...layer.paint, [`${prefix}-color`]: color };
      /* 원본이 반투명인 레이어가 있다 — 그대로 두면 아래 바다색이 비쳐 육지가 탁해진다 */
      if (layer.type === "fill") layer.paint = { ...layer.paint, "fill-opacity": 1 };
      continue;
    }

    const border = BORDER_STYLES[id];
    if (border) {
      layer.layout = { ...layer.layout, visibility: "visible" };
      layer.paint = {
        ...layer.paint,
        "line-color": border.color,
        "line-opacity": border.opacity,
        "line-width": border.width,
        "line-blur": 0.3,
      };
    }
  }
  return style;
}

function hide(layer: LayerSpecification) {
  layer.layout = { ...layer.layout, visibility: "none" };
}

/**
 * 대기광 — 지구 가장자리에서 파랗게 번지는 빛.
 *
 * 멀리서는 켜고 당기면 걷는다. 지상 배율까지 뿌옇게 덮으면 해안선이 안 보여 돔이
 * 한반도의 어디를 덮는지 짚을 수 없다.
 */
/* `as const` 를 붙이지 않는다 — 붙이면 안쪽 배열이 readonly 가 되어 MapLibre 의
   SkySpecification 이 안 받는다 */
export const GLOBE_SKY: maplibregl.SkySpecification = {
  "sky-color": "#2A313A",
  "horizon-color": "#59636F",
  "fog-color": "#12151A",
  "sky-horizon-blend": 0.6,
  "horizon-fog-blend": 0.5,
  "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 1.5, 1, 5, 0.55, 7, 0],
};
