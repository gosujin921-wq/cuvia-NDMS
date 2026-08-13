/* ─────────────────────────────────────────────
 * 강수 색면 레이어 — 격자를 캔버스에 칠해 지도에 눕힌다 (SCR-05)
 *
 * 배관은 기온 색면(temperature-layer.ts)과 같다. 격자(51×41)를 픽셀 그대로 캔버스에
 * 찍고 canvas 소스로 얹는다. 확대 보간은 지도 래스터 리샘플링이 맡는다.
 *
 * ★ 색이 어려운 자리다. 비는 물이지만 **파랑을 쓸 수 없다** — 이 앱에서 파랑 계열은
 *   침수면(#2f6fd0)과 침수선(#7cc4ff)의 몫이고, 트윈은 그 둘이 이미 화면에 깔린 채로
 *   강수를 얹는 화면이다. 같은 계열로 칠하면 "차오른 물"과 "내리는 비"가 한 덩어리로
 *   읽혀, 어느 쪽이 이번 조건의 결과인지 흐려진다.
 *
 *   그래서 보라 한 색 램프를 쓴다. 기온의 주황(TEMP_RAMP)과 같은 방식이다 — 시퀀셜은
 *   한 색상·명도 단조, 다크 화면이므로 약한 비가 바닥으로 가라앉고 센 비가 밝게 뜬다.
 *   장비 색(파랑·보라 계열 토큰)과는 채도·명도대가 갈리고, 무엇보다 장비는 점이고
 *   이것은 면이라 지도에서 섞이지 않는다. MapLibre paint 는 CSS 변수를 못 받아
 *   리터럴로 둔다.
 *
 * ★ 0 mm/h 는 **투명**이다. 비가 안 오는 칸까지 색을 칠하면 지도 전체가 덮여, "어디에
 *   비가 오는가"가 아니라 "격자가 어디까지 있는가"를 보여주는 그림이 된다.
 * ───────────────────────────────────────────── */

import type maplibregl from "maplibre-gl";
import type { PrecipitationField } from "./precipitation-field";

export const RAIN_SOURCE = "dsms-precipitation";
export const RAIN_LAYER = "dsms-precipitation-raster";

/** 보라 시퀀셜 램프 — 약한 비(어두움)→센 비(밝음). 색상각 고정 · 명도 단조 */
export const RAIN_RAMP = [
  "#2a1a5e",
  "#3d2782",
  "#5236a6",
  "#6a4cc4",
  "#8668db",
  "#a488ec",
  "#c3adf7",
];

/**
 * 램프 상한 (mm/h) — 이 값 이상은 같은 색으로 뭉친다.
 *
 * 자료 최대(86.9)에 맞추면 대부분의 칸이 램프 바닥에 깔려 아무것도 안 보인다.
 * 호우주의보 기준(30)을 상한으로 두면 04 §3 의 발령 기준과 같은 눈금으로 읽힌다.
 */
const RAMP_MAX = 30;
/** 이 아래는 안 그린다 (mm/h) — 흩뿌리는 비까지 칠하면 지도가 통째로 덮인다 */
const RAMP_FLOOR = 0.5;

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** 0~1 → 램프 색. 이웃 스텝 사이는 직선 보간 */
export function rainColor(t: number): [number, number, number] {
  const clamped = Math.min(1, Math.max(0, t));
  const scaled = clamped * (RAIN_RAMP.length - 1);
  const i = Math.min(Math.floor(scaled), RAIN_RAMP.length - 2);
  const frac = scaled - i;
  const from = hexToRgb(RAIN_RAMP[i]);
  const to = hexToRgb(RAIN_RAMP[i + 1]);
  return [
    Math.round(from[0] + (to[0] - from[0]) * frac),
    Math.round(from[1] + (to[1] - from[1]) * frac),
    Math.round(from[2] + (to[2] - from[2]) * frac),
  ];
}

/** 격자 한 시각을 캔버스에 찍는다 — 캔버스 위 = 북쪽이라 행을 뒤집는다 */
function paint(canvas: HTMLCanvasElement, field: PrecipitationField, hourIndex: number) {
  const { nx, ny } = field;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(nx, ny);
  for (let iy = 0; iy < ny; iy += 1) {
    for (let ix = 0; ix < nx; ix += 1) {
      const value = field.rain[hourIndex][iy * nx + ix];
      const px = ((ny - 1 - iy) * nx + ix) * 4;
      if (value < RAMP_FLOOR) {
        image.data[px + 3] = 0;
        continue;
      }
      const [r, g, b] = rainColor((value - RAMP_FLOOR) / (RAMP_MAX - RAMP_FLOOR));
      image.data[px] = r;
      image.data[px + 1] = g;
      image.data[px + 2] = b;
      image.data[px + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

/** 강수 색면을 한 번 붙인다. 기본은 숨김 — 토글이 켠다 */
export function ensurePrecipitationLayer(map: maplibregl.Map, field: PrecipitationField) {
  if (map.getSource(RAIN_SOURCE)) return;

  const canvas = document.createElement("canvas");
  canvas.width = field.nx;
  canvas.height = field.ny;
  paint(canvas, field, Math.max(0, field.hours.indexOf(field.defaultHour)));

  /* 격자점은 칸 중심이므로 이미지 모서리는 반 칸 밖이다 */
  const [west, south, east, north] = field.bbox;
  const half = field.step / 2;
  map.addSource(RAIN_SOURCE, {
    type: "canvas",
    canvas,
    animate: false,
    coordinates: [
      [west - half, north + half],
      [east + half, north + half],
      [east + half, south - half],
      [west - half, south - half],
    ],
  });

  const firstSymbol = map.getStyle().layers?.find((layer) => layer.type === "symbol")?.id;
  map.addLayer(
    {
      id: RAIN_LAYER,
      type: "raster",
      source: RAIN_SOURCE,
      layout: { visibility: "none" },
      /* 색면 아래 지형·건물이 남아야 어느 유역에 비가 쏟아지는지 짚힌다 */
      paint: { "raster-opacity": 0.5 },
    },
    firstSymbol,
  );
}

export function setPrecipitationVisible(map: maplibregl.Map, visible: boolean) {
  if (!map.getLayer(RAIN_LAYER)) return;
  map.setLayoutProperty(RAIN_LAYER, "visibility", visible ? "visible" : "none");
}

/**
 * 그 시각의 비로 다시 칠한다 — 시간축이 부른다.
 *
 * canvas 소스는 animate:false 라 처음 한 번만 읽는다. 계속 켜 두면 3D 씬이 매 프레임
 * 다시 그려져 비싸므로, 다시 칠한 뒤 한 프레임만 재생하고 곧바로 멈춘다.
 *
 * 격자에 없는 시각(봉암 트랙의 오전)은 가장 가까운 시각으로 붙인다. 기상 격자는 다른
 * 날짜에서 구운 배경 결이라 시연 시계와 시각까지 맞물릴 수 없다 — 값은 04 가 든다.
 */
export function setPrecipitationHour(
  map: maplibregl.Map,
  field: PrecipitationField,
  hour: number,
) {
  const source = map.getSource(RAIN_SOURCE) as maplibregl.CanvasSource | undefined;
  if (!source?.getCanvas) return;

  let best = 0;
  for (let i = 1; i < field.hours.length; i += 1) {
    if (Math.abs(field.hours[i] - hour) < Math.abs(field.hours[best] - hour)) best = i;
  }

  paint(source.getCanvas() as HTMLCanvasElement, field, best);
  source.play();
  requestAnimationFrame(() => source.pause());
}
