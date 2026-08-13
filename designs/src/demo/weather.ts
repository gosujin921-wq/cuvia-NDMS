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
} as const;

/** 폭염 — 기상특보에서 끌어온다 */
export const HEAT = {
  level: "경보",
  note: "체감 35℃ 이상 지속",
} as const;

/** 가뭄 — 관심·주의·경계·심각 4단계. 주남저수지 저수율에서 끌어온다 */
export const DROUGHT = {
  level: "주의",
  note: "주남저수지 저수율 48%",
  reservoirRate: 48,
} as const;
