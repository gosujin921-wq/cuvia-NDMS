/* ─────────────────────────────────────────────
 * 데모 상태 엔진 — 정본: docs/정본/04_데모_데이터.md §0 · 03 §0-7 · CLAUDE.md
 *
 * 시연 중 변하는 모든 값(스텝 · 시계 · 격상 · 승인 대응등급 · 도시 대응단계)의
 * 단일 source of truth. 화면은 이 컨텍스트를 읽고 계산할 뿐 값을 소유하지 않는다.
 * 상태가 바뀌면 구독하는 화면 요소 전부가 같은 프레임에 다시 그려진다 —
 * "모든 화면 요소가 함께 바뀐다"(03 §0-7)가 노력이 아니라 공짜가 된다.
 *
 * 스텝 전환은 시연자의 조작에 물린다(04 §0). 유일한 시간 트리거는 S2 격상 —
 * 센서 팝업이 열리고 8초 뒤 엔진이 올린다. 타이머를 팝업이 아니라 여기가 드는 이유:
 * 팝업이 들면 팝업을 닫는 순간 격상이 취소된다. 03 §2 는 "팝업을 닫아도 격상은 일어난다".
 *
 * 새로고침 = S0(17:16) 리셋. 별도 리셋 수단을 두지 않는다(04 §0).
 * ───────────────────────────────────────────── */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "@ds";
import type { AlertLevel } from "../demo/levels";

/** S0~S9 (04 §0). S2 는 진입(17:20)과 격상(17:22) 두 국면을 가진다 */
export type ScenarioStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** 스텝별 화면 시각 (04 §0). S2 는 격상 전 17:20 · 격상 후 17:22 */
const STEP_CLOCK: Record<ScenarioStep, string> = {
  0: "17:16",
  1: "17:19",
  2: "17:20",
  3: "17:25",
  4: "17:29",
  5: "17:34",
  6: "17:37",
  7: "17:39",
  8: "22:10",
  9: "22:12",
};

const DEMO_DATE_PREFIX = "2026-08-12T";
const ESCALATION_CLOCK = "17:22";
const ESCALATION_DELAY_MS = 8_000;

/* S8(통계 22:10) · S9(에필로그 22:12)는 선행 스텝을 지켜야만 오른다.
   시연 초반에 통계·AI 화면을 열어도 시계가 22시로 뛰지 않는다 (04 §0) */
const STEP_GUARDS: Partial<Record<ScenarioStep, ScenarioStep>> = { 8: 7, 9: 8 };

export type CityStage = "상시대비" | "초기대응(보강)";

interface ScenarioContextValue {
  /** 지금까지 도달한 최고 스텝 — 단조 증가, 되돌아가지 않는다 */
  step: ScenarioStep;
  /** S2 격상 여부. 팝업이 열리고 8초 뒤 엔진이 올린다 (03 §2) */
  escalated: boolean;
  /** 시나리오 시계의 "지금". 모든 상대 시간·정렬·집계가 이 값을 기준으로 계산한다 */
  now: Date;
  /** 도시 대응단계 — S6 승인에서 초기대응(보강)으로 오른다 (04 §0-1) */
  cityStage: CityStage;
  /** 승인 대응등급 — [대응등급 대피로 상향]이 올린다 (04 §10). null = 승인 전 */
  approvedResponseLevel: AlertLevel | null;
  /** 승인 시각(17:37) — 선제 대응 리드타임(계측 도달 19:22 대비 1시간 45분)의 기준점 */
  approvedAt: Date | null;
  /** 스텝 전진. 시연자의 조작 지점(지구 클릭 · 팝업 · Twin · 진입 · 승인)에서 부른다 */
  advanceTo: (step: ScenarioStep) => void;
  /** S6 — 담당자의 등급 상향 승인. 승인 등급을 기록하고 S6 으로 전진한다 */
  approveResponseLevel: (level: AlertLevel) => void;
  /** SOP 실행이 끝났는가 — 실행 결과 블록(04 §13)이 이 값으로 열린다 */
  sopExecuted: boolean;
  /** S6→S7 — [승인·실행]의 순차 연출이 끝난 뒤 부른다 */
  completeSopExecution: () => void;
  /** 유선 보고 시각 — 실패 항목의 대체 조치(04 §13-1). null = 아직 */
  phoneReportedAt: Date | null;
  /** S7 — [유선 보고 기록] */
  logPhoneReport: () => void;
}

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<ScenarioStep>(0);
  const [escalated, setEscalated] = useState(false);
  const [approvedResponseLevel, setApprovedResponseLevel] = useState<AlertLevel | null>(null);
  const [approvedAt, setApprovedAt] = useState<Date | null>(null);
  const [sopExecuted, setSopExecuted] = useState(false);
  const [phoneReportedAt, setPhoneReportedAt] = useState<Date | null>(null);
  const escalationTimer = useRef<number | null>(null);

  /* 격상 — 토스트는 엔진이 쏜다. 격상을 그리는 화면 요소(핀·뱃지·그래프)는
     escalated 를 구독해 스스로 다시 그려지고, 토스트만 "사건"이라 여기서 낸다 */
  const escalate = useCallback(() => {
    if (escalationTimer.current !== null) {
      window.clearTimeout(escalationTimer.current);
      escalationTimer.current = null;
    }
    setEscalated((prev) => {
      if (!prev) {
        toast.warning("서항지구 수위계 1호기 · 경보 격상", {
          description: "수위 3.41 EL.m — 경보 기준 3.35 EL.m 초과 (17:22)",
        });
      }
      return true;
    });
  }, []);

  const advanceTo = useCallback(
    (target: ScenarioStep) => {
      setStep((prev) => {
        const guard = STEP_GUARDS[target];
        if (guard !== undefined && prev < guard) return prev;
        if (target <= prev) return prev;

        /* S2 진입 — 격상 타이머 시동 (한 번만) */
        if (target === 2 && escalationTimer.current === null) {
          escalationTimer.current = window.setTimeout(escalate, ESCALATION_DELAY_MS);
        }
        /* S3 이후로 넘어가면 격상은 이미 일어난 것 — 단조성 보장 */
        if (target >= 3) escalate();

        return target;
      });
    },
    [escalate],
  );

  const approveResponseLevel = useCallback(
    (level: AlertLevel) => {
      setApprovedResponseLevel(level);
      setApprovedAt(new Date(`${DEMO_DATE_PREFIX}${STEP_CLOCK[6]}:00`));
      advanceTo(6);
    },
    [advanceTo],
  );

  const completeSopExecution = useCallback(() => {
    setSopExecuted(true);
    advanceTo(7);
  }, [advanceTo]);

  const logPhoneReport = useCallback(() => {
    /* S7 시각(17:39)으로 기록한다 — completeSopExecution 이 이미 S7 로 올렸다 */
    setPhoneReportedAt(new Date(`${DEMO_DATE_PREFIX}${STEP_CLOCK[7]}:00`));
  }, []);

  useEffect(
    () => () => {
      if (escalationTimer.current !== null) window.clearTimeout(escalationTimer.current);
    },
    [],
  );

  const value = useMemo<ScenarioContextValue>(() => {
    const clock = step === 2 && escalated ? ESCALATION_CLOCK : STEP_CLOCK[step];
    return {
      step,
      escalated,
      now: new Date(`${DEMO_DATE_PREFIX}${clock}:00`),
      cityStage: step >= 6 ? "초기대응(보강)" : "상시대비",
      approvedResponseLevel,
      approvedAt,
      advanceTo,
      approveResponseLevel,
      sopExecuted,
      completeSopExecution,
      phoneReportedAt,
      logPhoneReport,
    };
  }, [
    step,
    escalated,
    approvedResponseLevel,
    approvedAt,
    advanceTo,
    approveResponseLevel,
    sopExecuted,
    completeSopExecution,
    phoneReportedAt,
    logPhoneReport,
  ]);

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario(): ScenarioContextValue {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error("useScenario 는 ScenarioProvider 안에서만 쓴다");
  return ctx;
}
