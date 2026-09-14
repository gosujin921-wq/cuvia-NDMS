/* ─────────────────────────────────────────────
 * 대표 시연 단계 D0~D8 과 시연 시점(tick) — 정본: 02 §7, IA §5.2
 *
 * 단계는 URL 이 아니다. 엔진이 tick 을 들고 단계는 tick 에서 파생된다. 단계 시각 아홉 개만으로는
 * 부족하다 — D7 안에서 "실행 결과 도착"과 "통제 전환", D8 안에서 "하강 확인"과 "종료"가 다른 조작인데
 * 한 시각에 겹친다. `driver` 가 "담당자"면 화면 조작이 부르고, "세계"면 관측·결과가 도착하는 시간 경과다.
 * ───────────────────────────────────────────── */

export type DemoStage = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface DemoStageSpec {
  stage: DemoStage;
  code: string;
  title: string;
  question: string;
  screen: "IA-01" | "IA-02" | "IA-03" | "IA-04" | "IA-05";
}

export const DEMO_STAGE_SPECS: readonly DemoStageSpec[] = [
  { stage: 0, code: "D0", title: "사전 감시", question: "어디를 먼저 봐야 하는가", screen: "IA-01" },
  { stage: 1, code: "D1", title: "이상 징후", question: "무엇이 변했는가", screen: "IA-02" },
  { stage: 2, code: "D2", title: "교차확인", question: "정말 같은 사건인가", screen: "IA-02" },
  { stage: 3, code: "D3", title: "현재 판단", question: "왜 위험한가", screen: "IA-02" },
  { stage: 4, code: "D4", title: "기준 전망", question: "그대로 두면 어떻게 되는가", screen: "IA-03" },
  { stage: 5, code: "D5", title: "대안 비교", question: "무엇을 바꾸면 달라지는가", screen: "IA-03" },
  { stage: 6, code: "D6", title: "영향 기반 대응", question: "무엇을 결정할 것인가", screen: "IA-04" },
  { stage: 7, code: "D7", title: "실행 결과", question: "실제로 되었는가", screen: "IA-04" },
  { stage: 8, code: "D8", title: "종료와 검증", question: "예측과 대응은 어땠는가", screen: "IA-05" },
];

export function stageSpec(stage: DemoStage): DemoStageSpec {
  return DEMO_STAGE_SPECS[stage];
}

export interface DemoTick {
  id: string;
  stage: DemoStage;
  /** 시나리오 시각 (ISO). 편집값이다(02 §5.5) */
  at: string;
  label: string;
  driver: "담당자" | "세계";
}
