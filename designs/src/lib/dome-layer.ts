/* ─────────────────────────────────────────────
 * 열돔 색면 — 두 기압면을 하나로 합쳐 칠한다
 *
 * 기온·강수 색면(weather-field-layer.ts)은 자료 한 종류를 값에 따라 칠한다. 돔은 다르다 —
 * **두 자료가 동시에 조건을 넘는 자리**만 칠한다. 그래서 그 기계를 그대로 못 쓰고 여기
 * 한 장을 따로 굽는다. 격자를 캔버스에 찍어 MapLibre image 소스로 넘기는 배관은 같다.
 *
 * ── 왜 두 층을 합치나
 *
 * 500hPa 은 지면부터 5.5km 까지의 공기 기둥이 얼마나 부풀었는지, 200hPa 은 지면부터
 * 12km 까지가 얼마나 부풀었는지를 잰다. **둘 다 바닥에서부터 재는 눈금**이지 뚜껑의
 * 아래판·윗판이 아니다.
 *
 *  · 500 만 높다  → 부풀음이 5.5km 까지. 얕은 더위라 비교적 빨리 깨진다
 *  · 200 까지 높다 → 12km 통째로 부풀었다. 제트기류가 밀려나 더위를 흩을 것이 안 온다
 *
 * 그래서 칠한 면이 뜻하는 것은 "뚜껑 사이" 가 아니라 **부풀음이 12km 까지 깊은 곳** 이다.
 * 화면 문안도 그렇게 적는다 — 잘못 읽히면 더위가 상공에 갇혀 있다는 말이 된다.
 * ───────────────────────────────────────────── */

import type { WeatherField } from "./weather-field";

export const DOME_SOURCE_ID = "heat-dome";
export const DOME_LAYER_ID = "heat-dome";

/**
 * 색면 진하기.
 *
 * 램프가 이미 자리마다 알파를 갖고 있으므로(DEPTH_STOPS) 여기는 전체를 한 번 더 낮추는
 * 손잡이다. 덮지는 않는다 — 해안선이 비쳐야 돔이 한반도의 **어디를** 덮는지 짚을 수 있다.
 */
const OPACITY = 0.62;

/**
 * 가장자리 페이드 (격자 칸). 1칸이 2°(약 220km)다.
 *
 * 3칸(6°)으로는 격자 끝에서 색이 뚝 끊겨, 자료가 거기까지라서가 아니라 **돔이 거기서
 * 잘린 것처럼** 보였다. 6칸(12°)에 걸쳐 눕히면 물들다 사라지는 것으로 읽힌다.
 *
 * 화면 쪽에서도 같은 문제를 막는다 — 카메라를 묶어 격자 끝이 화면에 안 들어오게 한다
 * (HeatDomePreview 의 ZOOM.min · PAN_BOUNDS).
 */
const FADE_CELLS = 6;

type Rgb = [number, number, number];

/** 위험도 토큰을 실제 RGB 로 — 캔버스에 한 점 찍어 되읽는다(weather-field-layer 와 같은 수) */
function readColors(tokens: string[]): Rgb[] {
  const style = getComputedStyle(document.documentElement);
  const probe = document.createElement("canvas");
  probe.width = 1;
  probe.height = 1;
  const ctx = probe.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("캔버스를 만들지 못했다");
  return tokens.map((t) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = style.getPropertyValue(t).trim();
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b] as Rgb;
  });
}

/**
 * 돔 깊이 → 색·진하기.
 *
 * 깊이 0 이 두 경계선(5,880 / 12,500)이 지나는 자리다. 양수면 두 층 모두 안쪽이고 클수록
 * 깊다. 음수는 아직 못 미친 곳 — **여기를 완전히 지우지 않는 것이 요점이다.** 이분법으로
 * 자르면 돔이 허공에 뜬 붉은 판 하나가 되어, 주변이 이미 달아올라 있고 그 한가운데가
 * 특히 깊다는 사실이 사라진다. 밖으로도 옅게 번지다 사라지게 둔다.
 */
const DEPTH_STOPS: { depth: number; token: string; alpha: number }[] = [
  { depth: -0.75, token: "--color-risk-lv2", alpha: 0 },
  { depth: -0.25, token: "--color-risk-lv3", alpha: 0.3 },
  { depth: 0, token: "--color-risk-lv4", alpha: 0.55 },
  { depth: 0.45, token: "--color-risk-lv5", alpha: 0.85 },
  { depth: 1, token: "--color-risk-lv5", alpha: 1 },
];

/** 구간 사이는 선형으로 섞고, 양 끝은 끝 값으로 눕힌다 */
function rampAt(depth: number, colors: Rgb[]): { rgb: Rgb; alpha: number } {
  if (depth <= DEPTH_STOPS[0].depth) return { rgb: colors[0], alpha: DEPTH_STOPS[0].alpha };
  const last = DEPTH_STOPS.length - 1;
  if (depth >= DEPTH_STOPS[last].depth) return { rgb: colors[last], alpha: DEPTH_STOPS[last].alpha };
  for (let i = 0; i < last; i++) {
    const a = DEPTH_STOPS[i];
    const b = DEPTH_STOPS[i + 1];
    if (depth > b.depth) continue;
    const t = (depth - a.depth) / (b.depth - a.depth);
    const ca = colors[i];
    const cb = colors[i + 1];
    return {
      rgb: [
        Math.round(ca[0] + (cb[0] - ca[0]) * t),
        Math.round(ca[1] + (cb[1] - ca[1]) * t),
        Math.round(ca[2] + (cb[2] - ca[2]) * t),
      ],
      alpha: a.alpha + (b.alpha - a.alpha) * t,
    };
  }
  return { rgb: colors[last], alpha: DEPTH_STOPS[last].alpha };
}

/* ─────────────────────────────────────────────
 * 메르카토르 세로 좌표
 *
 * ★ 이 그림을 위도에 선형으로 그리면 안 된다.
 *
 * MapLibre 는 image 소스를 네 모서리로 받아 **메르카토르 좌표에 선형으로** 붙인다.
 * 메르카토르는 위도에 선형이 아니므로(고위도로 갈수록 늘어난다), 그림을 위도 간격대로
 * 만들어 넘기면 통째로 남북으로 밀린다.
 *
 * 이 격자(20.201~52.201°N)에서 얼마나 밀리냐면 —
 *   · 그림 세로 한가운데가 앉아야 할 자리 : 36.20°N (위도 중간)
 *   · MapLibre 가 실제로 앉히는 자리      : 37.66°N (메르카토르 중간)
 * 약 1.5°, 160km 다. 같은 자료로 그린 등고선은 벡터라 제자리에 있으니, 색면만 북으로
 * 밀려 선 밖으로 삐져나온다.
 *
 * 그래서 그림의 **행마다 메르카토르 위치를 먼저 잡고 그 자리의 위도를 되찾아** 값을 뜬다.
 * 가로(경도)는 메르카토르가 선형이라 손댈 것이 없다.
 * ───────────────────────────────────────────── */

const RAD = Math.PI / 180;
/** 위도(도) → 메르카토르 세로 좌표 */
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
/** 되돌리기 */
const mercLat = (y: number) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RAD;

/** 격자 사이 임의 지점의 값 — 칠한 면 가장자리를 등고선과 맞춘다 */
function bilinear(v: number[], cols: number, rows: number, c: number, r: number): number {
  const c0 = Math.max(0, Math.min(cols - 2, Math.floor(c)));
  const r0 = Math.max(0, Math.min(rows - 2, Math.floor(r)));
  const tx = c - c0;
  const ty = r - r0;
  const i = r0 * cols + c0;
  const top = v[i] + (v[i + 1] - v[i]) * tx;
  const bot = v[i + cols] + (v[i + cols + 1] - v[i + cols]) * tx;
  return top + (bot - top) * ty;
}

/** 가장자리 페이드 — 바깥 FADE_CELLS 칸에 걸쳐 0 까지 부드럽게 */
function edgeAlpha(c: number, r: number, cols: number, rows: number): number {
  const d = Math.min(c, r, cols - 1 - c, rows - 1 - r);
  if (d >= FADE_CELLS) return 1;
  const t = Math.max(0, d) / FADE_CELLS;
  return t * t * (3 - 2 * t);
}

export interface DomeInput {
  field: WeatherField;
  /** 그 시각의 값 배열 */
  values: number[];
  /** 이 값 이상이면 그 층은 "높다" */
  threshold: number;
}

/**
 * 두 층이 함께 높은 자리만 칠한 그림 한 장.
 *
 * 격자 칸을 통째로 칠하면 1°(약 90km) 짜리 계단이 생겨, 함께 그리는 등고선과 가장자리가
 * 어긋난다 — 선은 칸 사이를 갈라 지나가는데 색면은 칸 단위로 끊기기 때문이다. 그래서
 * 칸을 SUB 배로 잘게 쪼개 사이값을 재고 칠한다. 선과 면이 같은 자리에서 끝난다.
 */
/**
 * 돔 깊이를 색으로 칠한 그림 한 장.
 *
 * 두 층 각각 "기준선에서 얼마나 위인가" 를 그 층의 여유폭으로 나눠 0~1 로 만들고, **둘 중
 * 작은 쪽**을 깊이로 삼는다. 두 층이 다 높아야 깊은 돔이므로 못 미치는 쪽이 값을 정한다.
 *
 * 여유폭은 자료에서 뽑는다(그 시각 최대값 − 기준값). 고정 숫자를 박으면 날짜를 바꿀 때마다
 * 색이 다른 뜻이 된다 — 어떤 날은 전부 새빨갛고 어떤 날은 전부 옅어진다.
 */
export function buildDomeImage(lower: DomeInput, upper: DomeInput): string {
  const { cols, rows } = lower.field;
  if (upper.field.cols !== cols || upper.field.rows !== rows) {
    throw new Error("두 기압면의 격자가 다르다 — 같은 스크립트로 함께 구워야 한다");
  }

  /**
   * 격자 한 칸을 몇 조각으로 쪼개 그리나.
   *
   * 1° 격자를 칸 단위로 칠하면 90km 짜리 계단이 생겨, 같은 자료로 그린 등고선과 가장자리가
   * 어긋나 보인다 — 선은 칸 사이를 갈라 지나가는데 색면은 칸에서 끊기기 때문이다.
   * 10 조각이면 한 픽셀이 0.1°(약 11km) 라 지도가 확대해도 계단이 안 보인다.
   */
  const SUB = 10;
  /** 픽셀 하나 안에서 몇 점을 재 가장자리를 매끄럽게 하나 (AA×AA) */
  const AA = 2;
  const w = (cols - 1) * SUB;
  const h = (rows - 1) * SUB;
  /* 픽셀 **가운데**가 격자 어디에 떨어지나. 이 식과 domeImageCorners() 는 한 쌍이라
     한쪽만 고치면 색면이 선에서 어긋난다 — 그 함수 주석 참고 */
  const [west, south, east, north] = lower.field.bbox;
  const step = lower.field.step;
  const yTop = mercY(north);
  const ySpan = mercY(south) - yTop;

  /* 경도는 메르카토르가 선형이라 그대로 */
  const gcAt = (x: number) => (((x + 0.5) / w) * (east - west)) / step;
  /* 위도는 아니다 — 메르카토르 자리를 먼저 잡고 그 위도를 되찾는다(위 머리말) */
  const grAt = (y: number) => (north - mercLat(yTop + ((y + 0.5) / h) * ySpan)) / step;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 만들지 못했다");

  const colors = readColors(DEPTH_STOPS.map((d) => d.token));
  const image = ctx.createImageData(w, h);

  /* 그 시각의 여유폭 — 0 으로 나누지 않게 최소값을 둔다 */
  const spread = (v: number[], t: number) => Math.max(25, Math.max(...v) - t);
  const s5 = spread(lower.values, lower.threshold);
  const s2 = spread(upper.values, upper.threshold);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gc = gcAt(x);
      const gr = grAt(y);
      const p = (y * w + x) * 4;

      /*
       * 픽셀 하나를 AA×AA 로 나눠 **깊이를 평균**낸다.
       *
       * 한때 넘었나 못 넘었나만 세서 알파를 정했다(이분법). 그때는 그게 맞았지만 지금은
       * 색이 연속이라, 평균을 내야 경계뿐 아니라 램프 전체가 매끄럽다.
       */
      let sum = 0;
      for (let sy = 0; sy < AA; sy++) {
        for (let sx = 0; sx < AA; sx++) {
          const sc = gcAt(x + (sx + 0.5) / AA - 0.5);
          const sr = grAt(y + (sy + 0.5) / AA - 0.5);
          const lo = bilinear(lower.values, cols, rows, sc, sr);
          const up = bilinear(upper.values, cols, rows, sc, sr);
          /* 두 층 중 **못 미치는 쪽**이 깊이를 정한다 */
          sum += Math.min((lo - lower.threshold) / s5, (up - upper.threshold) / s2);
        }
      }
      const { rgb, alpha } = rampAt(sum / (AA * AA), colors);
      /* 색은 늘 채워 둔다. 알파만 0 으로 내려야 지도가 보간할 때 경계에 검은 테가
         안 번진다(weather-field-layer.ts 의 같은 이유) */
      image.data[p] = rgb[0];
      image.data[p + 1] = rgb[1];
      image.data[p + 2] = rgb[2];
      image.data[p + 3] = Math.round(255 * alpha * edgeAlpha(gc, gr, cols, rows));
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * 돔 색면이 앉을 네 모서리 — **격자점에서 격자점까지, 딱 그만큼**이다.
 *
 * weather-field-layer.ts 의 imageCorners() 를 쓰면 안 된다. 그쪽은 칸 하나에 픽셀 하나인
 * 그림용이라 격자점이 **픽셀 가운데**에 오고, 그래서 사방을 반 칸씩 넓혀 앉힌다.
 * 이 색면은 칸을 SUB 배로 쪼개 격자점에서 격자점까지 꽉 채운 그림이라 넓힐 자리가 없다.
 *
 * 그걸 그대로 썼다가 색면이 사방으로 0.5°(약 55km) 늘어난 채 앉아, 같은 자료로 그린
 * 등고선과 눈에 띄게 어긋났다 — 한쪽은 선 밖으로 삐져나오고 반대쪽은 선 안으로 물러났다.
 * 색면과 선이 **같은 자료**라 어긋날 수가 없는데 어긋나 보이면, 값이 아니라 이 좌표를
 * 먼저 의심할 것.
 */
export function domeImageCorners(
  field: WeatherField,
): [[number, number], [number, number], [number, number], [number, number]] {
  const [west, south, east, north] = field.bbox;
  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
}

/**
 * 지도에 쓸 raster 레이어.
 *
 * `visible` 을 받는 것은 필수다 — MapLibre 는 레이어를 보이는 상태로 붙이므로, 붙인 뒤에
 * 감추면 그 사이 한 프레임이 번쩍인다(useTemperatureLayer 이래 같은 규약).
 */

/**
 * 장을 갈아 끼울 때 겹쳐 넘기는 시간 (ms).
 *
 * 0 이면 툭 잘려 바뀌어 **넘어간 것이 눈에 걸린다** — 한 장씩 빨리 넘길 때는 그게 오히려
 * 이어져 보였지만, 천천히 오가는 일렁임(HeatDomeCard)에서는 1초에 한 번씩 화면이 튄다.
 * 겹쳐 넘기면 가장자리가 번지듯 넘실거린다. 넘기는 간격(1100ms)보다 짧게 둔다.
 */
const FADE_MS = 900;

export function domeLayerSpec(visible: boolean) {
  return {
    id: DOME_LAYER_ID,
    type: "raster" as const,
    source: DOME_SOURCE_ID,
    layout: { visibility: visible ? ("visible" as const) : ("none" as const) },
    paint: {
      "raster-opacity": OPACITY,
      "raster-fade-duration": FADE_MS,
    },
  };
}
