/* ─────────────────────────────────────────────
 * 기상 — 정본: docs/정본/04_데모_데이터.md §5
 *
 * 폭염·가뭄은 별도 센서를 두지 않는다. 폭염은 기상특보에서, 가뭄은 저수지 저수율에서
 * 끌어온다(01 개요 §정한 것).
 * ───────────────────────────────────────────── */

import type { HazardType } from "./events";

export interface WeatherAdvisory {
  label: string;
  /** 심각도 톤 — 카드에서 색으로 구분한다 */
  level: "advisory" | "warning";
}

export const WEATHER = {
  /** 발효 중인 기상특보 */
  advisories: [
    { label: "폭염경보", level: "warning" },
    { label: "폭풍해일주의보", level: "advisory" },
  ] as WeatherAdvisory[],
  temperature: 32.4,
  feelsLike: 35.1,
  condition: "맑음",
  conditionIcon: "mdi:weather-sunny",
  humidity: 68,
  windDirection: "남동",
  windSpeed: 7.2,
  /* 기압·조위 — 폭풍해일 판단의 배경 정보(04 §5). 해일 지구의 기상 패널과
     판정 카드 근거에 함께 선다. 만조·천문조는 §10-3 과 같은 값이다 */
  pressure: 998,
  pressureTrend: "하강 중",
  tide: { highAt: "19:10", astro: 2.71, note: "대조기" },
} as const;

/**
 * 봉암 트랙 기상 (04 §15-4).
 *
 * 서항(맑음 32.4℃ · 폭염경보)과 정반대다 — 호우경보 아래 비가 오고 기온이 8도 낮다.
 * 트랙을 갈면 하늘부터 바뀌어야 "다른 날의 다른 재난"으로 읽힌다. 만조는 봉암천
 * 하구 기준(09:12)이고, 배수문을 언제까지 못 여는지의 출처다(§15-6).
 */
export const BONGAM_WEATHER = {
  advisories: [{ label: "호우경보", level: "warning" }] as WeatherAdvisory[],
  temperature: 24.8,
  feelsLike: 26.2,
  condition: "비",
  conditionIcon: "mdi:weather-pouring",
  humidity: 96,
  windDirection: "남서",
  windSpeed: 4.6,
  pressure: 987,
  pressureTrend: "하강 중",
  tide: { highAt: "09:12", astro: 2.62, note: "봉암천 하구" },
} as const;

export type TrackWeather = typeof WEATHER | typeof BONGAM_WEATHER;

/** 트랙의 기상 한 벌 — 화면은 이 함수로만 집는다 */
export function weatherOf(track: "seohang" | "bongam"): TrackWeather {
  return track === "bongam" ? BONGAM_WEATHER : WEATHER;
}

/** 재난유형 ↔ 같은 현상의 발효 특보 (04 §4-7). 주요 재난 카드의 특보 줄.
 *  등재된 유형만 잇는다. 관련 특보가 없으면 빈 배열이고 카드는 줄을 접는다 */
const ADVISORY_KEYWORD: Partial<Record<HazardType, string>> = {
  폭풍해일: "해일",
  집중호우: "호우",
};

export function relatedAdvisories(
  type: HazardType,
  track: "seohang" | "bongam" = "seohang",
): WeatherAdvisory[] {
  const keyword = ADVISORY_KEYWORD[type];
  return keyword ? weatherOf(track).advisories.filter((a) => a.label.includes(keyword)) : [];
}

/* ── 조위 곡선 — 서항지구 조위계 1호기 (04 §8) ──────────────
 * 실측 조위 = 천문조(저조→만조 코사인 보간) + 해일 편차(앵커 선형 보간 후 유지).
 * 편차 17:22 +1.15 가 판정 카드의 "현재 관측치"(04 §10-3)이고, 19:10 +1.24 가
 * 실측 4.31 을 만든 편차다. 조위계는 발령 기준에 물리지 않는다(04 §3). */

export const TIDE_CURVE = {
  low: { at: "13:05", level: 0.95 },
  high: { at: WEATHER.tide.highAt, level: WEATHER.tide.astro },
  /** 폭풍해일 편차 (m) — 시각 앵커 사이는 선형 보간, 앞뒤는 끝값 유지 */
  surge: [
    { at: "13:00", rise: 0.85 },
    { at: "17:05", rise: 1.1 },
    { at: "17:22", rise: 1.15 },
    { at: "19:10", rise: 1.24 },
  ],
} as const;

/** 조위계 그래프의 기준선 — 발령 기준 대신 천문조 만조 한 줄만 얹는다(04 §3·§8) */
export const TIDE_REFERENCE = {
  value: WEATHER.tide.astro,
  color: "var(--color-foreground-subtle)",
  label: "천문조 만조",
} as const;

/* ── 도시 배경 위험 (04 §5) ────────────────────────────────
 * SCR-01 기상 카드 아래층. 반원 게이지 둘로 선다(03 §1).
 *
 * 게이지 값은 **수치가 아니라 등급**에서 나온다(04 §5 환산표). 기온과 저수율은 축이
 * 서로 달라 한 게이지에 섞이지 않고, 이 카드가 말하는 것은 "몇 도인가"가 아니라
 * "어느 단계인가"다. 수치는 게이지 아래 캡션이 그대로 든다.
 * ───────────────────────────────────────────────────────── */

export type GaugeTone = "normal" | "warning" | "danger";

export interface BackgroundRisk {
  /** 축 이름 — 폭염 · 가뭄 */
  axis: string;
  /** 현재 등급 */
  level: string;
  /** 등급 환산 게이지 값 (0~100 · 04 §5) */
  gauge: number;
  tone: GaugeTone;
  /** 근거 수치 캡션 */
  note: string;
}

/** 폭염 — 기상특보에서 끌어온다. 열돔은 정보성 표기까지만이다(04 §5) —
 *  판정할 데이터(상층 고도·지속일수)가 없으므로 시스템이 계산하는 것처럼 만들지 않는다.
 *  단계 없음 17 · 주의보 50 · 경보 83 */
export const HEAT = {
  axis: "폭염",
  level: "경보",
  gauge: 83,
  tone: "danger",
  note: "체감 35℃ 이상 지속",
  hint: "열돔 영향 가능",
} as const satisfies BackgroundRisk & { hint: string };

/** 가뭄 — 관심·주의·경계·심각 4단계. 주남저수지 저수율에서 끌어온다.
 *  관심 12 · 주의 37 · 경계 62 · 심각 87 */
export const DROUGHT = {
  axis: "가뭄",
  level: "주의",
  gauge: 37,
  tone: "warning",
  note: "주남저수지 저수율 48%",
  reservoirRate: 48,
} as const satisfies BackgroundRisk & { reservoirRate: number };

/** 봉암 트랙의 배경 위험 (04 §15-4) — 비가 오는 날이라 폭염은 해제고, 가뭄은 하루
 *  비로 풀리지 않아 주의가 남는다. 배경 위험은 사건보다 느리게 움직인다 */
export const BONGAM_HEAT = {
  axis: "폭염",
  level: "해제",
  gauge: 17,
  tone: "normal",
  note: "강우로 기온 하강",
  hint: "",
} as const satisfies BackgroundRisk & { hint: string };

export function heatOf(track: "seohang" | "bongam"): BackgroundRisk & { hint: string } {
  return track === "bongam" ? BONGAM_HEAT : HEAT;
}
