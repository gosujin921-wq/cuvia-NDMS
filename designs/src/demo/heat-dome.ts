/* ─────────────────────────────────────────────
 * 열돔 — 창원 상공 두 층의 지위고도
 *
 * 폭염이 왜 났는지를 대는 배경이다. 값은 열돔 화면(/preview/heat-dome)이 쓰는 것과
 * **같은 자료·같은 지점**이다 — Open-Meteo 기압면 격자에서 창원 격자점을 그대로 뽑았다.
 * 지도 격자 전체(약 900KB)는 여기 필요 없다. 통계 화면이 그리는 것은 곡선 하나라
 * 창원 한 점의 시계열만 옮겼다.
 *
 * ── 무엇을 재는 값인가
 *
 * 지위고도(geopotential height)는 **어떤 기압이 되는 높이**를 미터로 적은 것이다. 높을수록
 * 그 아래 공기 기둥이 두껍고 뜨겁다. 두 층을 보는 이유는 겹침이 곧 깊이이기 때문이다.
 *
 *   500hPa (약 5.5km)  북태평양고기압. 여름 한반도를 아래에서 덮는다. **5,880gpm 선**이
 *                      그 세력권 가장자리로 통용된다
 *   200hPa (약 12km)   티베트고기압. 그 위를 한 겹 더 덮는다. 둘이 겹친 것이 '이중 열돔'
 *
 * **두 숫자 모두 지면에서부터 잰다.** 뚜껑 "사이" 가 아니다 — 더위는 상공이 아니라
 * 지면에 있다. 그렇게 읽히는 문안을 쓰면 안 된다.
 *
 * ── 판정하지 않는다 (04 §5)
 *
 * 몇 gpm 이상 며칠이면 열돔이라는 표준 기준이 없고, 기상청도 열돔을 특보로 발표하지
 * 않는다(폭염특보로 발표한다). 그래서 이 파일은 **선을 넘었는지만** 말하고 단계를 매기지
 * 않는다. 발령되는 것은 폭염이고, 열돔은 그 배경이다.
 *
 * ── 날짜
 *
 * 자료는 2025년 실측 한 사이클(돔이 오고·머물고·깨지는 22일)이고, 무대는 2026년 폭염
 * 기간이다. 월·일을 옮겨 **폭염특보가 난 자리에 돔을 얹었다** — 날짜를 지어낸 것이 아니라
 * 같은 사이클의 실측을 그 자리에 놓은 것이다. 그래서 아래 두 줄이 눈으로 맞는다.
 *
 *     7/20 돔이 가장 깊다 (5,939)      ← 같은 날 폭염주의보 발효
 *     8/02 하루 만에 223gpm 급락       ← 돔이 깨진다
 * ───────────────────────────────────────────── */

/** 층 하나의 규격 — 기준선과 화면 문안이 여기서 나온다 */
export interface DomeLayerSpec {
  /** 기압면 (hPa) */
  hPa: number;
  /** 지면에서 여기까지 — 화면 문안에 그대로 쓴다 */
  reach: string;
  /** 세력권 가장자리로 통용되는 선 (gpm) */
  contour: number;
  label: string;
}

/** 아래층이 먼저다 — 화면의 위아래 순서와 같다 */
export const DOME_LOWER: DomeLayerSpec = {
  hPa: 500,
  reach: "5.5km 까지",
  contour: 5880,
  label: "500hPa · 북태평양고기압",
};

export const DOME_UPPER: DomeLayerSpec = {
  hPa: 200,
  reach: "12km 까지",
  contour: 12500,
  label: "200hPa · 티베트고기압",
};

export interface DomeSample {
  /** `YYYY-MM-DD` — 하루 한 점(15시 기준) */
  date: string;
  /** 500hPa 지위고도 (gpm) */
  lower: number;
  /** 200hPa 지위고도 (gpm) */
  upper: number;
}

/**
 * 창원 상공 22일 — 돔이 오고, 머물고, 깨진다.
 *
 * 값은 손대지 않았다. 옮긴 것은 날짜뿐이다(머리말 참조).
 */
export const DOME_SERIES: DomeSample[] = [
  { date: "2026-07-14", lower: 5812, upper: 12428 },
  { date: "2026-07-15", lower: 5855, upper: 12521 },
  { date: "2026-07-16", lower: 5877, upper: 12519 },
  { date: "2026-07-17", lower: 5875, upper: 12495 },
  { date: "2026-07-18", lower: 5890, upper: 12498 },
  { date: "2026-07-19", lower: 5915, upper: 12491 },
  /* 여기부터 두 층 모두 안쪽 — 깊은 돔. 같은 날 폭염주의보가 발효된다 */
  { date: "2026-07-20", lower: 5939, upper: 12521 },
  { date: "2026-07-21", lower: 5933, upper: 12533 },
  { date: "2026-07-22", lower: 5908, upper: 12556 },
  { date: "2026-07-23", lower: 5896, upper: 12563 },
  { date: "2026-07-24", lower: 5895, upper: 12570 },
  { date: "2026-07-25", lower: 5895, upper: 12572 },
  { date: "2026-07-26", lower: 5895, upper: 12565 },
  { date: "2026-07-27", lower: 5896, upper: 12567 },
  { date: "2026-07-28", lower: 5887, upper: 12544 },
  { date: "2026-07-29", lower: 5888, upper: 12514 },
  { date: "2026-07-30", lower: 5904, upper: 12507 },
  { date: "2026-07-31", lower: 5892, upper: 12540 },
  /* 무너진다 — 하루 만에 223gpm */
  { date: "2026-08-01", lower: 5814, upper: 12460 },
  { date: "2026-08-02", lower: 5669, upper: 12237 },
  { date: "2026-08-03", lower: 5715, upper: 12314 },
  { date: "2026-08-04", lower: 5824, upper: 12486 },
];

export const DOME_SOURCE = "Open-Meteo Historical Forecast API · CC BY 4.0";

/** 두 층 모두 선 안쪽인가 — 깊은 돔 */
export function isDeepDome(sample: DomeSample): boolean {
  return sample.lower >= DOME_LOWER.contour && sample.upper >= DOME_UPPER.contour;
}

/**
 * 시연 시계까지 자른 곡선.
 *
 * 화면의 다른 값이 전부 `now` 로 잘리는데 이 곡선만 자료 끝까지 그리면, 같은 화면에서
 * 한 줄만 미래를 안다.
 */
export function domeSeriesUntil(now: Date): DomeSample[] {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return DOME_SERIES.filter((sample) => sample.date <= today);
}

export interface DomeSummary {
  /** 잘린 곡선 */
  samples: DomeSample[];
  /** 가장 깊었던 날 */
  peak: DomeSample | null;
  /** 두 층 모두 안쪽이었던 날수 */
  deepDays: number;
  /** 깊은 돔이 이어진 첫날·마지막날 */
  deepFrom: string | null;
  deepTo: string | null;
  /** 오늘(곡선의 끝)이 깊은 돔인가 */
  deepNow: boolean;
}

/** 곡선이 말하는 것을 센다 — 집계 상수를 두지 않는다 */
export function domeSummaryAt(now: Date): DomeSummary {
  const samples = domeSeriesUntil(now);
  if (!samples.length) {
    return { samples, peak: null, deepDays: 0, deepFrom: null, deepTo: null, deepNow: false };
  }

  const deep = samples.filter(isDeepDome);
  /* 가장 깊은 날 = 아래층이 가장 높이 부푼 날. 두 층을 더해 견주면 눈금이 다른 두 값을
     섞는 꼴이 된다(5,900 대와 12,500 대) */
  const peak = samples.reduce((best, s) => (s.lower > best.lower ? s : best), samples[0]);

  return {
    samples,
    peak,
    deepDays: deep.length,
    deepFrom: deep[0]?.date ?? null,
    deepTo: deep[deep.length - 1]?.date ?? null,
    deepNow: isDeepDome(samples[samples.length - 1]),
  };
}
