/* ─────────────────────────────────────────────
 * 기상 — 정본: docs/정본/04_데모_데이터.md §5
 *
 * 폭염·가뭄은 별도 센서를 두지 않는다. 폭염은 기상특보에서, 가뭄은 저수지 저수율에서
 * 끌어온다(01 개요 §정한 것).
 * ───────────────────────────────────────────── */

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

/** 폭염 — 기상특보에서 끌어온다. 열돔은 정보성 표기까지만이다(04 §5) —
 *  판정할 데이터(상층 고도·지속일수)가 없으므로 시스템이 계산하는 것처럼 만들지 않는다 */
export const HEAT = {
  level: "경보",
  note: "체감 35℃ 이상 지속",
  hint: "열돔 영향 가능",
} as const;

/** 가뭄 — 관심·주의·경계·심각 4단계. 주남저수지 저수율에서 끌어온다 */
export const DROUGHT = {
  level: "주의",
  note: "주남저수지 저수율 48%",
  reservoirRate: 48,
} as const;
