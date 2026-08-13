/* ─────────────────────────────────────────────
 * 데모 상태 엔진 — 정본: docs/정본/04_데모_데이터.md §0 · 03 §0-7 · CLAUDE.md
 *
 * 시연 중 변하는 모든 값(스텝 · 시계 · 격상 · 승인 대응등급 · 도시 대응단계 ·
 * 전파 기록 · SOP 실행 결과)의 단일 source of truth. 화면은 이 컨텍스트를 읽고
 * 계산할 뿐 값을 소유하지 않는다. 전파 기록을 화면 로컬 state 에 두면 화면을 떠나는
 * 순간 시연 중 쌓은 기록이 사라지고 SCR-04 집계와도 어긋난다(04 §7-5).
 * 상태가 바뀌면 구독하는 화면 요소 전부가 같은 프레임에 다시 그려진다 —
 * "모든 화면 요소가 함께 바뀐다"(03 §0-7)가 노력이 아니라 공짜가 된다.
 *
 * 스텝 전환은 전부 시연자의 화면 조작에 물린다(04 §0). 조작판(0 키)에는 이벤트
 * 발사 목록이 없고 트랙 발사만 있다 — 진행하는 길이 둘이면 두 길이 갈라진다.
 * 격상도 무대 도착에 얹혀 일어난다(서항 S2 팝업 3초 뒤 · 봉암은 발사 타이머).
 * 전이는 여기가 소유하고, 화면 요소는 escalated 를 구독할 뿐이다.
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
import { DISPATCH_HISTORY, type DispatchRecord } from "../demo/dispatch";

/** S0~S9 (04 §0). S2 는 진입(17:20)과 격상(17:22) 두 국면을 가진다 */
export type ScenarioStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** 시연 트랙 (04 §0 · §15). 날짜가 달라 공존하지 않는다 — 전환은 전체 리셋이다 */
export type ScenarioTrack = "seohang" | "bongam";

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

/** 트랙별 시계 (04 §0 · §15-2). 격상 국면의 시각·스텝도 트랙마다 다르다 */
const TRACK = {
  seohang: {
    datePrefix: "2026-08-12T",
    stepClock: STEP_CLOCK,
    escalationStep: 2 as ScenarioStep,
    escalationClock: "17:22",
    /** 격상 전 시계 상한 — 스텝이 앞서 가도 격상 전에는 이 시각을 넘지 않는다 */
    preEscalationClock: "17:20",
    /* 격상의 무대 — 이 스텝에 도착하면 3초 뒤 엔진이 올린다 (04 §0-2 · 05 S2).
       S2 는 주인공 수위계 팝업이다. 팝업이 아니라 엔진이 타이머를 드는 이유:
       팝업이 들면 팝업을 닫는 순간 격상이 취소된다. 03 §2 는 "팝업을 닫아도
       격상은 일어난다". 3초는 발표자가 "이 장비를 눌러 보겠습니다" 한 마디를
       마치는 길이고, 격상이 말하는 도중에 들어온 것처럼 보이는 자리다 */
    escalationTrigger: { step: 2 as ScenarioStep, delayMs: 3_000 },
    escalationToast: {
      title: "서항지구 수위계 1호기 · 경보 격상",
      description: "수위 3.41 EL.m — 경보 기준 3.35 EL.m 초과 (17:22)",
    },
  },
  bongam: {
    datePrefix: "2026-08-13T",
    stepClock: {
      /* B0 는 두 사건이 아직 **주의보**인 자리다 (04 §15-1). 집중호우 경보(08:31)
         앞에 세워야 발사 3초 뒤의 격상이 "주의보 → 경보" 로 보인다.
         B1 부터는 격상(08:52) 뒤라 그 뒤 시각을 쓴다 */
      0: "08:30",
      1: "08:55",
      2: "08:58",
      3: "09:01",
      4: "09:05",
      5: "09:10",
      6: "09:13",
      7: "09:16",
      8: "13:20",
      9: "13:24",
    } as Record<ScenarioStep, string>,
    /* 봉암은 격상이 스텝이 아니라 발사 타이머에 물린다. 9 를 둬서 스텝 전진이
       격상을 앞당기지 않게 한다 — 지구를 여는 조작(B1)이 3초를 건너뛰면 안 된다 */
    escalationStep: 9 as ScenarioStep,
    escalationClock: "08:52",
    preEscalationClock: "08:30",
    /* 봉암의 격상은 스텝이 아니라 **발사**에 물린다(§0-3) — 트랙 시작 자체가 사건의
       발생이라 무대에 도착하기 전에 이미 경보다 */
    escalationTrigger: null,
    escalationToast: {
      title: "봉암지구 수위계 2호기 · 내수침수 경보 격상",
      description: "내수위 4.02 EL.m — 경보 기준 3.83 EL.m 초과 (08:52)",
    },
  },
} as const;

/* 발생 연출 (04 §0-3 · §15-1) — 유입은 **시계가 걷는다**. 원장을 현재 시계로 자르는
   파생이 이미 서 있으므로, 시계가 아래 시각을 밟으면 핀·카드·집계·목록이 순서대로
   태어난다. 별도의 연출 코드가 없다 — 엔진이 시계를 옮기면 화면 전부가 따라온다.
   유입 토스트만 엔진이 낸다.

   두 트랙 모두 **평시에서 시작해 사건이 태어나는 것**을 보여준다. 시연을 이미 벌어진
   일을 훑는 것으로 시작하지 않기 위해서다. 격상까지 이어 갈지는 트랙이 정한다:
   봉암은 발사가 곧 사건의 시작이라 3초 뒤 경보까지 한 호흡에 가고, 서항은 격상이
   S2 의 무대(그래프 설명 뒤)라 발사는 주의보까지만 하고 격상은 시연자가 쏜다. */
interface OnsetToast {
  title: string;
  description: string;
}
interface OnsetSpec {
  /** 유입이 밟는 시각. 첫 칸은 평시(사건 0건)다 */
  clocks: readonly string[];
  /** 각 칸에서 낼 토스트. null 이면 조용히 지나간다 */
  toasts: readonly (OnsetToast | null)[];
  /** 안착 뒤 자동 격상까지 (ms). null 이면 격상은 스텝 무대(escalationTrigger)가 든다 */
  autoEscalateMs: number | null;
}

const ONSET: Record<ScenarioTrack, OnsetSpec> = {
  seohang: {
    clocks: ["16:40", "16:50", "17:06"],
    toasts: [
      null,
      { title: "구항지구 수위계 1호기 · 폭풍해일 주의보", description: "수위 2.84 EL.m — 주의보 기준 2.8 초과 (16:48)" },
      { title: "서항지구 수위계 1호기 · 폭풍해일 주의보", description: "수위 3.02 EL.m — 주의보 기준 2.9 초과 (17:05) · 명동항 동시 발생" },
    ],
    /* 발사는 주의보까지만. 격상은 무대(S2 수위계 팝업)에 도착한 뒤 오른다 —
       escalationTrigger 가 든다(04 §0) */
    autoEscalateMs: null,
  },
  bongam: {
    clocks: ["08:12", "08:15", "08:27"],
    toasts: [
      null,
      { title: "봉암지구 강우량계 1호기 · 집중호우 주의보", description: "32 mm/h — 주의보 기준 30 초과 (08:14)" },
      { title: "봉암지구 수위계 2호기 · 내수침수 주의보", description: "내수위 3.47 EL.m — 주의보 기준 3.45 초과 (08:26)" },
    ],
    autoEscalateMs: 3_000,
  },
};

const ONSET_STEP_MS = 1_600;

/* S8(통계 22:10) · S9(에필로그 22:12)는 선행 스텝을 지켜야만 오른다.
   시연 초반에 통계·AI 화면을 열어도 시계가 22시로 뛰지 않는다 (04 §0) */
const STEP_GUARDS: Partial<Record<ScenarioStep, ScenarioStep>> = { 8: 7, 9: 8 };

export type CityStage = "상시대비" | "초기대응(보강)";

interface ScenarioContextValue {
  /** 활성 시연 트랙 (04 §15). 기본 서항. 전환은 전체 리셋이다 */
  track: ScenarioTrack;
  /** 트랙 발사 — 데모 컨트롤의 시나리오 행이 부른다. 리셋 후 발생 연출을 시작한다 */
  launchTrack: (track: ScenarioTrack) => void;
  /** 발생 연출(04 §15-1) 진행. null = 연출 중 아님 */
  onset: { count: number; total: number } | null;
  /** 지금까지 도달한 최고 스텝 — 단조 증가, 되돌아가지 않는다 */
  step: ScenarioStep;
  /** 격상 여부. 서항은 S2 도착 3초 뒤, 봉암은 발사 타이머가 올린다 (04 §0 · §15-1) */
  escalated: boolean;
  /** 격상 발사 (이미 격상됐으면 아무 일 없다) */
  escalate: () => void;
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
  /** 실행된 승인 항목 id — 결과 목록·전파 수단 파생(04 §7-5·§13)의 근거. null = 실행 전 */
  sopExecutedItemIds: string[] | null;
  /** S6→S7 — [승인·실행]의 순차 연출이 끝난 뒤 실행한 항목 id 와 함께 부른다 */
  completeSopExecution: (itemIds: string[]) => void;
  /** 전파 기록 — 사전 원장 12건(04 §7-3) + 시연 중 쌓인 기록. 최신이 앞에 선다 */
  dispatches: DispatchRecord[];
  /** 전파 기록 한 줄을 맨 위에 쌓는다 (04 §7-5) */
  addDispatch: (record: DispatchRecord) => void;
  /** 유선 보고 시각 — 실패 항목의 대체 조치(04 §13-1). null = 아직 */
  phoneReportedAt: Date | null;
  /** S7 — [유선 보고 기록] */
  logPhoneReport: () => void;
  /** 선택 장비 — 재난관제에서 연 센서·CCTV. 화면을 옮겨도 유지되고 트윈이 같은 핀을
   *  강조한다(03 §5 · 차수 K). URL(`?device=`)은 새로고침·직접 진입의 보조 복구다 */
  selectedDeviceId: string | null;
  selectDevice: (deviceId: string | null) => void;
}

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const [track, setTrack] = useState<ScenarioTrack>("seohang");
  /* 발생 연출의 현재 유입 위치 (BONGAM_ONSET_CLOCK 인덱스). null = 연출 중 아님 */
  const [onsetIndex, setOnsetIndex] = useState<number | null>(null);
  const [step, setStep] = useState<ScenarioStep>(0);
  const [escalated, setEscalated] = useState(false);
  const [approvedResponseLevel, setApprovedResponseLevel] = useState<AlertLevel | null>(null);
  const [approvedAt, setApprovedAt] = useState<Date | null>(null);
  const [sopExecutedItemIds, setSopExecutedItemIds] = useState<string[] | null>(null);
  const [phoneReportedAt, setPhoneReportedAt] = useState<Date | null>(null);
  const [dispatches, setDispatches] = useState<DispatchRecord[]>(DISPATCH_HISTORY);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const selectDevice = useCallback((deviceId: string | null) => {
    setSelectedDeviceId(deviceId);
  }, []);
  /* state 의 ref 거울 — 토스트 같은 부수효과를 updater 밖에서 판단하기 위한 것.
     updater 안에서 쏘면 StrictMode 가 updater 를 두 번 돌려 토스트가 두 장 뜬다 */
  const escalatedRef = useRef(false);
  const stepRef = useRef<ScenarioStep>(0);
  const trackRef = useRef<ScenarioTrack>("seohang");
  /* 발생 연출 타이머 — 트랙 재발사·언마운트 시 정리 */
  const onsetTimers = useRef<number[]>([]);
  useEffect(
    () => () => {
      onsetTimers.current.forEach((id) => window.clearTimeout(id));
      onsetTimers.current = [];
    },
    [],
  );

  /* 격상 — 토스트는 엔진이 쏜다. 격상을 그리는 화면 요소(핀·뱃지·그래프)는
     escalated 를 구독해 스스로 다시 그려지고, 토스트만 "사건"이라 여기서 낸다 */
  const escalate = useCallback(() => {
    if (escalatedRef.current) return;
    escalatedRef.current = true;
    const { title, description } = TRACK[trackRef.current].escalationToast;
    toast.warning(title, { description });
    setEscalated(true);
  }, []);
  /* 발사 타이머가 부를 격상 — launchBongam 이 escalate 에 의존하지 않게 ref 로 잇는다 */
  const escalateRef = useRef(escalate);
  escalateRef.current = escalate;

  /* 트랙 발사 (04 §0-3 · §15) — 날짜가 다른 두 트랙은 공존하지 않으므로 전체 리셋 후,
     발생 연출의 시계 걷기를 시작한다. 유입 중에도 화면 조작은 잠기지 않는다.
     같은 트랙을 다시 쏘면 처음부터 다시 — 리허설에서 되감는 수단이 된다 */
  const launchTrack = useCallback((next: ScenarioTrack) => {
    onsetTimers.current.forEach((id) => window.clearTimeout(id));
    onsetTimers.current = [];

    trackRef.current = next;
    setTrack(next);
    stepRef.current = 0;
    setStep(0);
    escalatedRef.current = false;
    setEscalated(false);
    setApprovedResponseLevel(null);
    setApprovedAt(null);
    setSopExecutedItemIds(null);
    setPhoneReportedAt(null);
    setDispatches(DISPATCH_HISTORY);
    setSelectedDeviceId(null);

    const spec = ONSET[next];
    setOnsetIndex(0);
    spec.toasts.forEach((entry, index) => {
      if (!entry) return;
      onsetTimers.current.push(
        window.setTimeout(() => {
          setOnsetIndex(index);
          toast.warning(entry.title, { description: entry.description });
        }, index * ONSET_STEP_MS),
      );
    });
    /* 안착 — 사건이 다 태어난 첫 스텝(S0 · B0) */
    const settleAt = spec.toasts.length * ONSET_STEP_MS;
    onsetTimers.current.push(window.setTimeout(() => setOnsetIndex(null), settleAt));
    /* 봉암만 격상까지 이어 간다 — 발사가 곧 사건의 시작이라 탄생과 격상을 한 호흡에
       붙인다(04 §15-1). 서항은 여기서 멈추고 화면 조작이 격상을 일으킨다 */
    if (spec.autoEscalateMs !== null) {
      onsetTimers.current.push(
        window.setTimeout(() => escalateRef.current(), settleAt + spec.autoEscalateMs),
      );
    }
  }, []);

  const advanceTo = useCallback(
    (target: ScenarioStep) => {
      const prev = stepRef.current;
      const guard = STEP_GUARDS[target];
      if (guard !== undefined && prev < guard) return;
      if (target <= prev) return;

      const spec = TRACK[trackRef.current];
      /* 격상 스텝을 지나가면 격상은 이미 일어난 것 — 단조성 보장 */
      if (target > spec.escalationStep) escalate();

      /* 격상의 무대에 도착 — 3초 뒤 엔진이 올린다 (04 §0-2). 타이머를 팝업이 아니라
         엔진이 드는 이유: 팝업을 닫아도 격상은 일어나야 한다(03 §2) */
      const trigger = spec.escalationTrigger;
      if (trigger && target === trigger.step && !escalatedRef.current) {
        onsetTimers.current.push(
          window.setTimeout(() => escalateRef.current(), trigger.delayMs),
        );
      }

      stepRef.current = target;
      setStep(target);
    },
    [escalate],
  );

  const approveResponseLevel = useCallback(
    (level: AlertLevel) => {
      setApprovedResponseLevel(level);
      const spec = TRACK[trackRef.current];
      setApprovedAt(new Date(`${spec.datePrefix}${spec.stepClock[6]}:00`));
      advanceTo(6);
    },
    [advanceTo],
  );

  const completeSopExecution = useCallback(
    (itemIds: string[]) => {
      setSopExecutedItemIds(itemIds);
      advanceTo(7);
    },
    [advanceTo],
  );

  const addDispatch = useCallback((record: DispatchRecord) => {
    setDispatches((prev) => [record, ...prev]);
  }, []);

  const logPhoneReport = useCallback(() => {
    /* S7 시각으로 기록한다 — completeSopExecution 이 이미 S7 로 올렸다 */
    const spec = TRACK[trackRef.current];
    setPhoneReportedAt(new Date(`${spec.datePrefix}${spec.stepClock[7]}:00`));
  }, []);

  const value = useMemo<ScenarioContextValue>(() => {
    const spec = TRACK[track];
    /* 시계는 격상을 경계로 두 구간에 묶인다 (04 §0 · §15-2). 0 을 채운 HH:MM 이라
       사전순 비교가 곧 시각 비교다.
         · 발생 연출 중 — 유입 시각을 걷는다 (04 §15-1)
         · 격상 전 — 스텝이 앞서 가도 preEscalationClock 을 넘지 않는다. 지구를 여는
           조작(B1)이 시계를 격상 뒤로 밀면 목격해야 할 주의보 구간이 사라진다
         · 격상 후 — escalationClock 밑으로 내려가지 않는다. 내려가면 방금 본 경보가
           주의보로 되돌아간다 */
    const stepClock = spec.stepClock[step];
    const clock =
      onsetIndex !== null
        ? ONSET[track].clocks[onsetIndex]
        : escalated
          ? stepClock > spec.escalationClock
            ? stepClock
            : spec.escalationClock
          : stepClock < spec.preEscalationClock
            ? stepClock
            : spec.preEscalationClock;
    return {
      track,
      launchTrack,
      onset:
        onsetIndex !== null
          ? { count: onsetIndex, total: ONSET[track].clocks.length - 1 }
          : null,
      step,
      escalated,
      escalate,
      now: new Date(`${spec.datePrefix}${clock}:00`),
      cityStage: step >= 6 ? "초기대응(보강)" : "상시대비",
      approvedResponseLevel,
      approvedAt,
      advanceTo,
      approveResponseLevel,
      sopExecuted: sopExecutedItemIds !== null,
      sopExecutedItemIds,
      completeSopExecution,
      dispatches,
      addDispatch,
      phoneReportedAt,
      logPhoneReport,
      selectedDeviceId,
      selectDevice,
    };
  }, [
    track,
    launchTrack,
    onsetIndex,
    step,
    escalated,
    escalate,
    approvedResponseLevel,
    approvedAt,
    advanceTo,
    approveResponseLevel,
    sopExecutedItemIds,
    completeSopExecution,
    dispatches,
    addDispatch,
    phoneReportedAt,
    logPhoneReport,
    selectedDeviceId,
    selectDevice,
  ]);

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario(): ScenarioContextValue {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error("useScenario 는 ScenarioProvider 안에서만 쓴다");
  return ctx;
}
