/* ─────────────────────────────────────────────
 * 만조 조건 시나리오 — 정본: docs/정본/04_데모_데이터.md §10
 *
 * "예측"이 아니다. 기상청 조위표의 천문조(확정된 천문 계산)에 지금 관측 중인
 * 해일 편차·강우 유입을 더한 조건 시나리오다. 편차가 19:10 까지 유지된다는 가정이
 * 들어 있으므로 화면 어디에서도 "AI 예측 · 자동 예측"으로 부르지 않는다(04 §10 · 참고자료 §6-5).
 *
 * 곡선·값은 17:22(격상) 시점에 고정 생성한 것으로 친다 — 시계가 흘러도 다시 계산하지
 * 않는다. 시연 중 값이 흔들리면 S5 의 권고 근거가 화면마다 달라진다(04 §10-3).
 * ───────────────────────────────────────────── */

export interface ScenarioTerm {
  label: string;
  /** 표기값 (예: "2.71 EL.m" · "+1.15 m") */
  value: string;
  note: string;
}

export interface TideScenario {
  districtId: string;
  eventId: string;
  /** 시나리오를 세운 시각 — 격상과 같은 17:22. 이전에는 화면에 없다 */
  createdAt: string;
  /** 도달 예상 수위 (EL.m) */
  peak: number;
  /** 도달 예상 시각 — 만조 */
  peakAt: string;
  /** 산출 세 항 (04 §10-3) — 판정 카드 근거·AI 답변이 같은 값을 쓴다 */
  terms: ScenarioTerm[];
  /** 근거 한 줄 — 판정 카드 맨 아래 */
  basis: string;
}

/** 주인공 사건의 만조 조건 시나리오 (04 §10-2 · §10-3) */
export const HERO_SCENARIO: TideScenario = {
  districtId: "seohang",
  eventId: "EVT-260812-006",
  createdAt: "2026-08-12T17:22:00",
  peak: 4.24,
  peakAt: "2026-08-12T19:10:00",
  terms: [
    { label: "천문조 만조", value: "2.71 EL.m", note: "19:10 만조 · 대조기 · 기상청 조위표" },
    { label: "폭풍해일 편차", value: "+1.15 m", note: "폭풍해일주의보 발효 중 · 현재 관측치" },
    { label: "유역 강우 유입", value: "+0.38 m", note: "시간당 18 mm 지속 · 현재 관측치" },
  ],
  basis: "폭풍해일주의보 · 천문조 2.71 + 해일 편차 1.15 + 강우 유입 0.38",
};

/**
 * 지구의 조건 시나리오 — 격상(17:22) 이후에만 있다.
 * 시나리오가 있는 사건은 주인공 하나뿐이다. 다른 지구는 항상 null.
 */
export function scenarioOfDistrictAt(districtId: string, now: Date): TideScenario | null {
  if (districtId !== HERO_SCENARIO.districtId) return null;
  if (now < new Date(HERO_SCENARIO.createdAt)) return null;
  return HERO_SCENARIO;
}
