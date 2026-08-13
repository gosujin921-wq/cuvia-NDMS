/* ─────────────────────────────────────────────
 * 등치선 뽑기 — 격자에서 "이 값이 지나는 자리"를 선으로
 *
 * 색면(weather-field-layer.ts)만으로 충분했던 자료들과 달리, 열돔은 **선 안이냐 밖이냐**가
 * 이야기의 전부다. 5880gpm 선이 한반도를 감싸 닫히는 그림이 곧 뚜껑이다. 색면은 그것을
 * 번지게만 보여주고 경계를 짚어 주지 못하므로, 격자에서 등치선을 직접 뽑아 얹는다.
 *
 * ── 어떻게
 *
 * marching squares 다. 격자 칸 하나를 볼 때마다 네 모서리가 기준값보다 위인지 아래인지만
 * 본다. 네 모서리 각각이 위/아래 두 가지이므로 경우의 수는 열여섯이고, 그중 열넷에서
 * 선분이 하나나 둘 나온다. 선분 끝점은 모서리 값 사이를 선형으로 갈라 잡는다 — 그래야
 * 90km 격자에서도 선이 각지지 않는다.
 *
 * 선분을 이어 붙여 하나의 긴 선으로 만들지 않는다. 이웃한 칸이 내놓는 끝점은 좌표가
 * 정확히 같아서, 따로 그려도 화면에서는 끊김 없이 한 줄로 보인다. 이어 붙이는 코드는
 * 길고 틀리기 쉬운데 얻는 것이 없다.
 * ───────────────────────────────────────────── */

import type { FeatureCollection, LineString } from "geojson";
import type { WeatherField } from "./weather-field";

/** 각 경우에 어느 변과 어느 변을 잇는지 — t(위) r(오른) b(아래) l(왼) */
const CASES: Record<number, Array<[string, string]>> = {
  1: [["l", "b"]],
  2: [["b", "r"]],
  3: [["l", "r"]],
  4: [["t", "r"]],
  /* 5·10 은 대각선으로 갈리는 안장점이다. 어느 쪽으로 잇는지 정답이 하나가 아니어서
     둘 다 그린다 — 격자가 성겨 실제로 거의 안 나오고, 나와도 선이 X 로 보일 뿐 틀리지 않다 */
  5: [
    ["t", "l"],
    ["b", "r"],
  ],
  6: [["t", "b"]],
  7: [["t", "l"]],
  8: [["t", "l"]],
  9: [["t", "b"]],
  10: [
    ["t", "r"],
    ["l", "b"],
  ],
  11: [["t", "r"]],
  12: [["l", "r"]],
  13: [["b", "r"]],
  14: [["l", "b"]],
};

/**
 * 기준값 등치선을 GeoJSON 으로.
 *
 * 격자는 **북쪽 줄이 먼저**다(weather-field.ts 의 같은 약속). 그래서 행이 하나 늘면 위도가
 * 내려간다 — 부호를 뒤집어 쓰면 선이 위아래로 뒤집힌 채 그려진다.
 */
export function buildContour(
  field: WeatherField,
  values: number[],
  threshold: number,
): FeatureCollection<LineString> {
  const { cols, rows, step } = field;
  const [west, , , north] = field.bbox;

  const lonAt = (c: number) => west + c * step;
  const latAt = (r: number) => north - r * step;

  /** 두 값 사이에서 기준값이 걸리는 지점의 비율. 나눗셈이 0 이 되는 자리를 막는다 */
  const cross = (v1: number, v2: number) => (v1 === v2 ? 0.5 : (threshold - v1) / (v2 - v1));

  const features: FeatureCollection<LineString>["features"] = [];

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const i = r * cols + c;
      /* 시계 방향으로 좌상 → 우상 → 우하 → 좌하 */
      const tl = values[i];
      const tr = values[i + 1];
      const br = values[i + cols + 1];
      const bl = values[i + cols];

      const code =
        (tl >= threshold ? 8 : 0) |
        (tr >= threshold ? 4 : 0) |
        (br >= threshold ? 2 : 0) |
        (bl >= threshold ? 1 : 0);

      const segments = CASES[code];
      if (!segments) continue; // 0 과 15 — 칸 전체가 선 한쪽에 있다

      const edge = (which: string): [number, number] => {
        switch (which) {
          case "t":
            return [lonAt(c + cross(tl, tr)), latAt(r)];
          case "b":
            return [lonAt(c + cross(bl, br)), latAt(r + 1)];
          case "l":
            return [lonAt(c), latAt(r + cross(tl, bl))];
          default:
            return [lonAt(c + 1), latAt(r + cross(tr, br))];
        }
      };

      for (const [from, to] of segments) {
        features.push({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [edge(from), edge(to)] },
        });
      }
    }
  }

  return { type: "FeatureCollection", features };
}

/**
 * 돔 경계선 색·진하기 — 화면 범례도 이 값을 읽는다.
 *
 * 위험도 토큰에서 읽지 않는다. 색면이 이미 그 램프(노랑→빨강)를 쓰고 있어서 선까지 같은
 * 계열이면 붉은 바탕에 붉은 선이 되어 안 보인다. 일기도가 등고선을 한 색으로 긋는 것과
 * 같은 이유다 — 선은 색이 아니라 **경계**를 말한다.
 *
 * 색이 두 번 바뀌었다. 처음에는 흰색이었는데 지역 구분선을 밝히자 둘이 헷갈렸고, 다음에
 * 쓴 진한 청록(#6FE3E8)은 **선이 색면보다 앞으로 나섰다** — 특히 화면을 가로지르는
 * 200hPa 점선이 제일 먼저 눈에 들어왔다. 주인공은 돔이지 그 테두리가 아니다.
 *
 * 지금은 **하늘색을 옅게** 쓴다. 어디까지가 돔인지 짚어 주되 앞으로 나서지 않는다.
 *
 * 이 화면에서 색이 맡은 자리는 넷으로 갈린다:
 *   · 붉은 계열   — 돔의 깊이 (색면)
 *   · 하늘색      — 돔의 경계 (이 선)
 *   · 회색        — 나라·행정구역 구분선
 *   · 따뜻한 노랑 — 창원 관할 구역
 * 넷이 서로 안 겹쳐야 무엇이 무엇인지 색만 보고 갈린다.
 */
export const CONTOUR_COLOR = "#FFFFFF";

/** 기본 진하기 — 아래층(실선)은 이 값, 위층(점선)은 한 단 더 옅게 */
export const CONTOUR_OPACITY = 0.7;

/**
 * 등고선 레이어 정의.
 *
 * 두 층을 한 화면에 같이 그리므로 **선 모양으로도 갈라 둔다.** 아래층은 실선, 위층은
 * 점선이다. 색만으로 가르면 색각이 다른 사람에게는 두 선이 한 종류로 보인다.
 *
 * 굵기는 화면 픽셀 단위라 배율을 바꿔도 같은 굵기로 남는다.
 */
export function contourLayerSpec(
  id: string,
  visible: boolean,
  options: { dashed?: boolean; opacity?: number } = {},
) {
  return {
    id,
    type: "line" as const,
    source: id,
    layout: {
      visibility: visible ? ("visible" as const) : ("none" as const),
      /* 점선에는 둥근 끝을 쓸 수 없다 — MapLibre 가 dasharray 와 round cap 을 같이 받지
         않는다. 점선일 때만 각진 끝으로 내린다 */
      "line-cap": (options.dashed ? "butt" : "round") as "butt" | "round",
      "line-join": "round" as const,
    },
    paint: {
      "line-width": 2.2,
      "line-color": CONTOUR_COLOR,
      "line-opacity": options.opacity ?? CONTOUR_OPACITY,
      ...(options.dashed ? { "line-dasharray": [2, 1.6] } : {}),
    },
  };
}

/** 색면 소스와 겹치지 않는 이름 — 색면은 spec.id 를 그대로 쓴다 */
export function contourId(fieldId: string): string {
  return `${fieldId}-contour`;
}
