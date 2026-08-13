/* ─────────────────────────────────────────────
 * 상층 지위고도 자료 정의 — 열돔을 보여주는 두 층
 *
 * weather-fields.ts 와 같은 일을 한다(무엇을 어떤 색으로 보이나). 갈라 둔 것은 성격이
 * 다르기 때문이다 — 기온·강수는 창원시 위에 깔리는 **관제 자료**로 종합상황 지도에서
 * 켜고 끄지만, 상층장은 동아시아를 덮는 **배경 설명**이고 지금은 미리보기 화면
 * (/preview/heat-dome)에서만 쓴다. 그래서 weather-fields.ts 의 WASH_FIELDS 에 넣지
 * 않는다. 넣으면 종합상황 토글에 바로 서 버린다.
 *
 * 기계는 공용을 그대로 쓴다 — 읽기는 weather-field.ts, 색면은 weather-field-layer.ts.
 * 굽는 파일 모양도 기온·강수와 같게 맞춰 두었다(scripts/fetch-upper-field.mjs).
 * 여기서 더하는 것은 **등고선 기준값** 하나뿐이다.
 *
 * ★ 열돔은 판정하지 않는다. 몇 gpm 이상 며칠이면 열돔이라는 표준 기준이 없고, 기상청도
 *   열돔을 특보로 발표하지 않는다(폭염특보로 발표한다). 아래 값은 판정선이 아니라
 *   **일기도에서 관례로 긋는 선**이다 (01 §정한 것 · 04 §5).
 * ───────────────────────────────────────────── */

import type { WeatherFieldSpec } from "./weather-field";

/** 창원시 중심 — map-config.ts 의 CITY_CENTER 와 같은 값. 굽는 격자 눈금이 여기 맞춰져
 *  있어 보간이 아니라 격자점 값이 그대로 나온다 (scripts/fetch-upper-field.mjs) */
const CHANGWON: [number, number] = [128.667, 35.201];

/** 공용 정의에 상층에만 필요한 둘을 더한다 */
export interface UpperFieldSpec extends WeatherFieldSpec {
  /** 굵게 긋는 등고선 한 줄 */
  contour: number;
  /**
   * 그 선이 무엇인지 — 화면이 그대로 읽는다.
   *
   * 층마다 격이 다르다. 500hPa 의 5880 은 일기도에서 통용되는 선이지만 200hPa 에는 그런
   * 선이 없다. 둘을 같은 말투로 적으면 없는 기준을 있는 것처럼 만든다.
   */
  contourNote: string;
  /** 대략 몇 km 상공인지 — 화면이 층을 설명할 때 쓴다 */
  altitude: string;
}

/**
 * 500hPa — 북태평양고기압. 열돔의 아래 뚜껑.
 *
 * 5880gpm 이 세력권 가장자리로 통용되는 선이다. 눈금을 그 앞뒤로 좁게 세운 것은, 열돔이
 * 있고 없고가 갈리는 폭이 실제로 좁기 때문이다 — 열돔 날 창원이 5900 언저리, 8월 중순이
 * 5800대로 100gpm 안쪽에서 갈린다. 폭을 넓게 잡으면 두 날이 같은 색으로 보인다.
 *
 * 이 날 창원은 15시 5895gpm 으로 선 안쪽이고, 격자 안 최고는 5901gpm(130.7°E · 36.2°N)
 * 으로 **한반도 바로 동쪽**이다. 창원이 중심은 아니고 중심 바로 옆이다.
 */
export const UPPER_500_FIELD: UpperFieldSpec = {
  id: "upper-500",
  label: "500hPa",
  url: "/weather/upper-500-field.json",
  valueKey: "h",
  unit: "gpm",
  stops: [
    { value: 5820, token: "--color-risk-lv2" },
    { value: 5860, token: "--color-risk-lv3" },
    { value: 5880, token: "--color-risk-lv4", note: "북태평양고기압 가장자리" },
    { value: 5900, token: "--color-risk-lv5", note: "돔 중심부" },
  ],
  rampRange: { min: 5780, max: 5920 },
  probePoints: [{ label: "창원", lonLat: CHANGWON }],
  /* 색면이 주인공인 화면이라 기온(0.34)보다 올린다. 그래도 덮지는 않는다 — 해안선이
     비쳐야 돔이 한반도의 **어디를** 덮는지 짚을 수 있다 */
  opacity: 0.5,
  caption: "티베트·북태평양 두 고기압이 겹쳐 영남에 극심한 더위가 든 날",
  sourceLabel: "Open-Meteo",
  contour: 5880,
  contourNote: "북태평양고기압 가장자리로 통용되는 선. 이 선이 한반도를 감싸 닫히면 그것이 뚜껑이다",
  altitude: "약 5.5km 상공",
};

/**
 * 200hPa — 티베트고기압. 그 위를 한 겹 더 덮는 층.
 *
 * ★ 이 층에는 5880 같은 관례선이 **없다.** 12500gpm 을 굵은 선으로 삼은 것은 굽어 둔
 *   자료가 12000~12600 사이에서 갈려 눈으로 읽기 좋은 자리라서지, 어디서 쓰는 기준이라서가
 *   아니다. 화면에서도 "가장자리"라 부르지 않고 읽기 보조선이라고 밝힌다.
 *
 * ── 두 층이 함께 높았다. 다만 '티베트고기압 중심'이라고는 안 부른다
 *
 * 이 날 창원은 15시 12565gpm 으로 보조선 안쪽이고, 500hPa 도 5895gpm 으로 안쪽이다 —
 * **위아래 두 층이 같이 높다.** 2025년 7월 상순 폭염을 티베트·북태평양 두 고기압의 이른
 * 확장으로 설명하는 것과 어긋나지 않는다.
 *
 * 그런데 격자 안 200hPa 최고는 12584gpm(136.7°E · 39.2°N) 으로 **한반도 동북쪽**이다.
 * 티베트고기압 중심이라면 훨씬 서쪽(대륙)에 있어야 하는데 이 창(100.7~150.7°E) 안에서는
 * 그 중심이 안 잡힌다. 그러므로 화면은 **"두 층이 함께 높았다"까지만 말하고**, 어느
 * 고기압의 중심인지는 말하지 않는다. 자료가 답하지 않는 것을 화면이 답하면 안 된다.
 *
 * 한때 2026-07-27 을 썼고 그 날은 200hPa 최고가 격자 서쪽 끝(대륙 쪽)이라 창원이 선
 * 바깥이었다. 날짜를 옮긴 이유는 fetch-upper-field.mjs 머리말에 있다 — 그 날은 기온장을
 * 같은 날로 못 맞춘다.
 */
export const UPPER_200_FIELD: UpperFieldSpec = {
  id: "upper-200",
  label: "200hPa",
  url: "/weather/upper-200-field.json",
  valueKey: "h",
  unit: "gpm",
  stops: [
    { value: 12300, token: "--color-risk-lv2" },
    { value: 12420, token: "--color-risk-lv3" },
    { value: 12500, token: "--color-risk-lv4", note: "읽기 보조선" },
    { value: 12540, token: "--color-risk-lv5" },
  ],
  rampRange: { min: 12150, max: 12560 },
  probePoints: [{ label: "창원", lonLat: CHANGWON }],
  opacity: 0.5,
  caption: "아래 500hPa 와 함께 높다 — 두 층이 겹쳐 뚜껑이 두꺼웠다",
  sourceLabel: "Open-Meteo",
  contour: 12500,
  contourNote: "이 층에는 통용되는 기준선이 없다. 자료를 읽기 좋게 그은 보조선이다",
  altitude: "약 12km 상공",
};

/** 화면이 오가는 두 층. 아래에서 위 순서다 */
export const UPPER_FIELDS: UpperFieldSpec[] = [UPPER_500_FIELD, UPPER_200_FIELD];
