/* ─────────────────────────────────────────────
 * 지도 스타일 가공 — 원본 style.json 을 지도에 넘기기 전에 고친다
 *
 * ★ 왜 지도를 띄운 뒤가 아니라 띄우기 전인가
 *
 * 처음에는 원본 스타일로 지도를 띄운 뒤 map.on("load") 에서 setPaintProperty 로 레이어
 * 색을 하나씩 덮었다. 그러면 타일별로 색이 갈린다 — 덮어쓰기 전에 이미 그려진 타일은
 * 원본 색을 유지하고, 그 뒤에 도착한 타일만 새 색으로 그려져서, 화면에 사각형 경계가
 * 그대로 드러난다(밝은 회색 시가지 옆에 어두운 시가지가 붙는 식).
 *
 * 스타일 JSON 을 먼저 받아 고친 뒤 그 결과를 Map 에 넘기면, 지도는 처음부터 고쳐진
 * 스타일 하나만 알게 된다. 원본 색으로 그려지는 타일이 아예 생기지 않는다.
 *
 * 여기의 함수는 전부 순수 함수다 — 스타일 객체를 받아 같은 객체를 고쳐서 돌려준다.
 * ───────────────────────────────────────────── */

import type {
  LayerSpecification,
  StyleSpecification,
} from "maplibre-gl";
import {
  HIDDEN_LABEL_IDS,
  MAP_STYLE_URL,
  MAP_SURFACE_PAINT,
  ROAD_DIM,
  ROAD_SOURCE_LAYERS,
} from "./map-config";

/** 스타일을 받아 이 앱에 맞게 고친 뒤 돌려준다 */
export async function loadPatchedStyle(): Promise<StyleSpecification> {
  const res = await fetch(MAP_STYLE_URL);
  if (!res.ok) throw new Error(`지도 스타일을 받지 못했다 (HTTP ${res.status})`);
  const style: StyleSpecification = await res.json();

  for (const layer of style.layers ?? []) {
    hideCommercialLabel(layer);
    paintSurface(layer);
    dimRoad(layer);
  }
  return style;
}

/** 관제와 무관한 상업 POI 라벨만 끈다. 지명·도로명은 남긴다 */
function hideCommercialLabel(layer: LayerSpecification) {
  if (layer.type !== "symbol") return;
  if (!HIDDEN_LABEL_IDS.has(layer.id)) return;
  layer.layout = { ...layer.layout, visibility: "none" };
}

/**
 * 바탕색 덮어쓰기 — 값과 근거는 MAP_SURFACE_PAINT 주석 참고.
 *
 * 일부 레이어의 원본 fill-color 는 ["case", class=park …] 형태지만 두 갈래가 같은 색이라,
 * 단색으로 바꿔도 잃는 구분이 없다. opacity 는 지정한 레이어만 덮는다 — Farmland 처럼
 * 원본 줌 램프를 남겨야 하는 레이어가 있다.
 */
function paintSurface(layer: LayerSpecification) {
  const paint = MAP_SURFACE_PAINT[layer.id];
  if (!paint) return;

  /* paint 속성명은 레이어 타입마다 다르다 — fill-color / background-color / … */
  const prefix =
    layer.type === "background"
      ? "background"
      : layer.type === "fill-extrusion"
        ? "fill-extrusion"
        : "fill";

  const next: Record<string, unknown> = { ...layer.paint };
  next[`${prefix}-color`] = paint.color;
  if (paint.opacity !== undefined) next[`${prefix}-opacity`] = paint.opacity;
  /* paint 의 타입은 레이어 종류별 유니온이라 그대로는 대입이 안 된다. 키는 위에서
     레이어 타입에 맞춰 만들었으므로 여기서만 좁혀준다 */
  (layer as { paint?: unknown }).paint = next;
}

/**
 * 도로 밝기 낮춤 — 값과 근거는 ROAD_DIM 주석 참고.
 *
 * 레이어마다 색을 박지 않고 원본 값의 명도에 계수를 곱한다. 도로 계열 42개 중 17개가
 * 줌·도로등급별 표현식이라, 단색으로 갈아끼우면 줌 동작이 통째로 죽는다.
 */
function dimRoad(layer: LayerSpecification) {
  if (layer.type !== "line" && layer.type !== "fill") return;
  /* background 등 소스가 없는 레이어에는 source-layer 자체가 없다 */
  if (!("source-layer" in layer)) return;
  if (!ROAD_SOURCE_LAYERS.has(layer["source-layer"] ?? "")) return;

  const key = layer.type === "line" ? "line-color" : "fill-color";
  const paint = layer.paint as Record<string, unknown> | undefined;
  if (!paint || paint[key] === undefined) return;

  (layer as { paint?: unknown }).paint = {
    ...paint,
    [key]: dimPaintValue(paint[key], ROAD_DIM),
  };
}

/**
 * paint 값을 재귀로 훑어 색 문자열만 낮춘다.
 *
 * 값은 단색 문자열이거나 ["interpolate", …] 같은 표현식 배열이다. 배열 안에는 "match" /
 * "zoom" / "motorway" 처럼 색이 아닌 문자열과 숫자가 섞여 있는데, dimHsl 이 hsl 형태만
 * 골라내므로 나머지는 그대로 통과한다. 즉 표현식 구조는 건드리지 않는다.
 */
function dimPaintValue(value: unknown, factor: number): unknown {
  if (typeof value === "string") return dimHsl(value, factor);
  if (Array.isArray(value)) return value.map((v) => dimPaintValue(v, factor));
  return value;
}

/**
 * hsl()/hsla() 문자열의 명도에 계수를 곱한다. 형태가 안 맞으면 원본을 그대로 돌려준다
 * (스타일에 rgb·hex·색이름이 섞여 들어와도 깨지지 않아야 한다).
 */
function dimHsl(value: string, factor: number): string {
  const m = /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(
    value.trim(),
  );
  if (!m) return value;
  const [, h, s, l, a] = m;
  const dimmed = Math.round(Number(l) * factor);
  return a === undefined ? `hsl(${h}, ${s}%, ${dimmed}%)` : `hsla(${h}, ${s}%, ${dimmed}%, ${a})`;
}
