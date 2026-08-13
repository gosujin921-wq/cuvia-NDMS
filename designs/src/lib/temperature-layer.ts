/* ─────────────────────────────────────────────
 * 기온 색면 레이어 — 격자를 캔버스에 칠해 지도에 눕힌다 (SCR-01)
 *
 * 격자(51×41)를 픽셀 그대로 캔버스에 찍고 canvas 소스로 얹는다. 확대 보간은
 * 지도 래스터 리샘플링(기본 linear)이 맡아 픽셀 격자가 부드러운 색면으로 퍼진다.
 *
 * 색은 주황 한 색 램프다(시퀀셜 = 한 색상·명도 단조). 파랑 계열은 이 앱에서 물·침수
 * 몫이라 기온에 쓸 수 없다. 다크 화면이므로 저온이 바닥으로 가라앉고 고온이 밝게 뜬다 —
 * 램프는 OKLCH 색상각 고정·명도 단조로 계산해 검증기(dataviz)를 거친 값이다.
 * MapLibre paint 는 CSS 변수를 못 받아 리터럴로 둔다.
 * ───────────────────────────────────────────── */

import type maplibregl from "maplibre-gl";
import { temperatureRange, type TemperatureField } from "./temperature-field";

export const TEMP_SOURCE = "dsms-temperature";
export const TEMP_LAYER = "dsms-temperature-raster";

/** 주황 시퀀셜 램프 — 저온(어두움)→고온(밝음). #eb6834 색상각 고정 · 명도 단조 */
export const TEMP_RAMP = [
  "#702808",
  "#92370f",
  "#b3491d",
  "#d15f33",
  "#ea7b51",
  "#fe9974",
  "#ffb999",
];

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** 0~1 → 램프 색. 이웃 스텝 사이는 직선 보간 */
export function rampColor(t: number): [number, number, number] {
  const clamped = Math.min(1, Math.max(0, t));
  const scaled = clamped * (TEMP_RAMP.length - 1);
  const i = Math.min(Math.floor(scaled), TEMP_RAMP.length - 2);
  const frac = scaled - i;
  const from = hexToRgb(TEMP_RAMP[i]);
  const to = hexToRgb(TEMP_RAMP[i + 1]);
  return [
    Math.round(from[0] + (to[0] - from[0]) * frac),
    Math.round(from[1] + (to[1] - from[1]) * frac),
    Math.round(from[2] + (to[2] - from[2]) * frac),
  ];
}

/** 격자 한 시각을 캔버스에 찍는다 — 캔버스 위 = 북쪽이라 행을 뒤집는다 */
function paint(canvas: HTMLCanvasElement, field: TemperatureField, hourIndex: number) {
  const { nx, ny } = field;
  const { min, max } = temperatureRange(field, hourIndex);
  const span = Math.max(max - min, 0.1);
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(nx, ny);
  for (let iy = 0; iy < ny; iy += 1) {
    for (let ix = 0; ix < nx; ix += 1) {
      const value = field.temp[hourIndex][iy * nx + ix];
      const [r, g, b] = rampColor((value - min) / span);
      const px = ((ny - 1 - iy) * nx + ix) * 4;
      image.data[px] = r;
      image.data[px + 1] = g;
      image.data[px + 2] = b;
      image.data[px + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

/** 기온 색면을 한 번 붙인다. 기본은 숨김 — 토글이 켠다 */
export function ensureTemperatureLayer(map: maplibregl.Map, field: TemperatureField) {
  if (map.getSource(TEMP_SOURCE)) return;

  const canvas = document.createElement("canvas");
  canvas.width = field.nx;
  canvas.height = field.ny;
  paint(canvas, field, Math.max(0, field.hours.indexOf(field.defaultHour)));

  /* 격자점은 칸 중심이므로 이미지 모서리는 반 칸 밖이다 */
  const [west, south, east, north] = field.bbox;
  const half = field.step / 2;
  map.addSource(TEMP_SOURCE, {
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
      id: TEMP_LAYER,
      type: "raster",
      source: TEMP_SOURCE,
      layout: { visibility: "none" },
      /* 색면 아래 도로·해안선이 남아야 어느 동네가 뜨거운지 짚힌다 */
      paint: { "raster-opacity": 0.55 },
    },
    firstSymbol,
  );
}

export function setTemperatureVisible(map: maplibregl.Map, visible: boolean) {
  if (!map.getLayer(TEMP_LAYER)) return;
  map.setLayoutProperty(TEMP_LAYER, "visibility", visible ? "visible" : "none");
}
