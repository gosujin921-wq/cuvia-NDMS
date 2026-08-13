/* ─────────────────────────────────────────────
 * 배수 제약 — 배경: docs/레거시/정본/04_데모_데이터.md §15-6 (트랙 B)
 *
 * 내수침수가 해일과 갈리는 자리다. 해일은 바깥 물이 넘어 들어오지만, 내수침수는
 * **안쪽 물이 못 나간다.** 그 "못 나감"을 만드는 것이 아래 넷이고, 판정 카드의
 * `배수 제약` 항과 교차검증 여덟 줄이 전부 여기서 나온다.
 *
 *   외수위 > 내수위  →  배수문 폐쇄(역류 방지)  →  자연배수 차단  →  펌프만 남음
 *   그리고 만조까지는 외수위가 더 오르므로 문을 다시 열 수 없다
 *
 * 배수문 폐쇄와 펌프 가동은 **센서 이벤트가 아니라 운영 로그**다. "시스템이 수위
 * 센서로 폐쇄를 감지했다"고 말하면 거짓이다(봉암 대본 S3 주의).
 * ───────────────────────────────────────────── */

export interface DrainageState {
  districtId: string;
  /** 외수위 (하천 쪽 · EL.m) */
  outerLevel: number;
  /** 배수문 폐쇄 시각 — 운영 로그 */
  gateClosedAt: string;
  /** 가동 중인 펌프 */
  pumpsRunning: number;
  pumpsTotal: number;
  /** 펌프 가동 시작 — 강우 주의보(08:14)보다 앞선 것이 요지다 */
  pumpsFrom: string;
  /** 하구 조위 실측 (EL.m) */
  tideMeasured: number;
  /** 하구 천문조 (EL.m) */
  tideAstro: number;
  /** 만조 시각 — 이 트랙의 미래 시각 앵커. 여기까지는 문을 열 수 없다 */
  highTideAt: string;
  /** 기압 (hPa) */
  pressure: number;
  pressureTrend: string;
  /** 누적 강우 (mm) */
  rainAccumMm: number;
}

export const DRAINAGE: Record<string, DrainageState> = {
  bongam: {
    districtId: "bongam",
    outerLevel: 4.36,
    gateClosedAt: "2026-08-13T08:47:00",
    pumpsRunning: 3,
    pumpsTotal: 3,
    pumpsFrom: "2026-08-13T07:52:00",
    tideMeasured: 2.98,
    tideAstro: 2.62,
    highTideAt: "2026-08-13T09:12:00",
    pressure: 987,
    pressureTrend: "하강 중",
    rainAccumMm: 148,
  },
};

export function drainageOf(districtId: string): DrainageState | null {
  return DRAINAGE[districtId] ?? null;
}

/** 하구 조위의 해일 편차 — 실측에서 천문조를 뺀 값 */
export function tideSurgeOf(state: DrainageState): number {
  return Number((state.tideMeasured - state.tideAstro).toFixed(2));
}
