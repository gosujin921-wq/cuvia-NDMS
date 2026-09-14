/* ─────────────────────────────────────────────
 * adapter 계약 — 실제 API 응답을 공통 이벤트 봉투로 옮기는 자리 (02 §5.4 E1 · §5.5, README §11 2번)
 *
 * fixture 는 시나리오 값이고 adapter 는 실제 값이다. 둘 다 같은 EventEnvelope 로 나오므로 selectors 와
 * 화면은 어느 쪽이 왔는지 모른다. 원본시각(originalTime)은 보존하고 시나리오 시계에 매핑한다.
 * I0 에서는 계약만 둔다. // TODO(adapter): Open-Meteo Historical Forecast 응답 → E1 봉투
 * ───────────────────────────────────────────── */

import type { EventEnvelope } from "../model/event";

export interface OpenMeteoHourlyRain {
  time: string;
  precipitationMmPerH: number;
}

export interface OpenMeteoAdapterInput {
  latitude: number;
  longitude: number;
  /** YYYY-MM-DD. 대표 데모는 2024-09-21 */
  date: string;
  /** 02 §5.4 확인 전 단정 금지 */
  model?: string;
}

export type OpenMeteoToEvent = (input: OpenMeteoAdapterInput, hourly: OpenMeteoHourlyRain[], scenarioTime: string) => EventEnvelope;
