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
  /** 조건의 이름 — 화면이 "만조 조건 4.24" · "강우 지속 조건 4.68" 로 쓴다.
   *  리터럴로 "만조 조건" 을 박으면 내륙 트랙에 해안 어법이 선다 */
  conditionLabel: string;
  /** 시나리오를 세운 시각 — 격상과 같은 17:22. 이전에는 화면에 없다 */
  createdAt: string;
  /** 도달 예상 수위 (EL.m) */
  peak: number;
  /** 도달 예상 시각 — 만조 */
  peakAt: string;
  /**
   * 전망 시각의 이름 — 화면은 "만조"가 아니라 이 말로 부른다 (03 §5).
   *
   * 만조는 분석의 이름이 아니라 시간축 위의 사건이다. "만조 조건 분석"이라고 부르면
   * 화면 전체가 조석 전용으로 읽히고, 같은 문법을 내수침수에 얹을 수 없다. 조석은
   * 산정 근거(terms)로 내려가고 시간축에는 무슨 일이 나는 시각인지만 남는다.
   */
  peakLabel: string;
  /** 산출 세 항 (04 §10-3) — 판정 카드 근거·AI 답변이 같은 값을 쓴다 */
  terms: ScenarioTerm[];
  /** 근거 한 줄 — 판정 카드 맨 아래 */
  basis: string;
}

/** 주인공 사건의 만조 조건 시나리오 (04 §10-2 · §10-3) */
export const HERO_SCENARIO: TideScenario = {
  districtId: "seohang",
  eventId: "EVT-260812-006",
  conditionLabel: "만조 조건",
  createdAt: "2026-08-12T17:22:00",
  peak: 4.24,
  peakAt: "2026-08-12T19:10:00",
  peakLabel: "바닷물 최고",
  terms: [
    { label: "천문조 만조", value: "2.71 EL.m", note: "19:10 만조 · 대조기 · 기상청 조위표" },
    { label: "폭풍해일 편차", value: "+1.15 m", note: "폭풍해일주의보 발효 중 · 현재 관측치" },
    { label: "유역 강우 유입", value: "+0.38 m", note: "시간당 18 mm 지속 · 현재 관측치" },
  ],
  basis: "폭풍해일주의보 · 천문조 2.71 + 해일 편차 1.15 + 강우 유입 0.38",
};

/**
 * 봉암 강우 지속 조건 시나리오 (04 §15-7 · 트랙 B).
 *
 * 서항과 같은 4층 구조이되 앵커가 다르다 — 서항은 조위표 만조가 물을 밀어 올리는
 * 시각이고, 봉암은 **만조가 물을 못 빼게 막는 시각**이다(09:12). 만조까지 외수위가
 * 높아 배수문을 열 수 없고, 그동안 안쪽 물은 펌프로만 나간다. "비가 언제까지 올지"는
 * 조위표에 없지만 "언제까지 못 빼는지"는 있다 — 봉암이 미래를 말하는 방식이다.
 */
export const BONGAM_SCENARIO: TideScenario = {
  districtId: "bongam",
  eventId: "EVT-260813-002",
  conditionLabel: "강우 지속 조건",
  createdAt: "2026-08-13T08:52:00",
  peak: 4.68,
  peakAt: "2026-08-13T09:35:00",
  /* 봉암의 전망 시각은 물이 가장 높은 때가 아니라 **저지대가 잠기기 시작하는 폭이
     커지는 때**다. 04 §15-8 표에서 4.68 이 41동·470m 로 뛰는 행이다 */
  peakLabel: "저지대 영향 확대",
  terms: [
    { label: "현재 내수위", value: "4.02 EL.m", note: "08:52 계측 · 수위계 2호기" },
    { label: "강우 지속 유입", value: "+0.51 m", note: "시간당 42 mm 지속 가정 · 09:35 까지" },
    { label: "배수 제약", value: "+0.15 m", note: "만조 09:12 까지 배수문 폐쇄 · 펌프 3대 배출 한계 초과분" },
  ],
  basis: "호우경보 · 만조 09:12 까지 배수 제약 지속 · 강우 유입 0.51 + 배수 초과 0.15",
};

const SCENARIOS: TideScenario[] = [HERO_SCENARIO, BONGAM_SCENARIO];

/**
 * 지구의 조건 시나리오 — 격상 이후에만 있다(서항 17:22 · 봉암 08:52).
 * 시나리오가 있는 사건은 각 트랙의 주인공 하나뿐이다. 나머지 지구는 항상 null.
 */
export function scenarioOfDistrictAt(districtId: string, now: Date): TideScenario | null {
  const scenario = SCENARIOS.find((s) => s.districtId === districtId);
  if (!scenario) return null;
  if (now < new Date(scenario.createdAt)) return null;
  return scenario;
}
