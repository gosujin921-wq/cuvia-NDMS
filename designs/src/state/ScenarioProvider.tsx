/* ─────────────────────────────────────────────
 * 데모 상태 엔진 — 배경: docs/레거시/정본/04_데모_데이터.md §0 · 03 §0-7 · CLAUDE.md
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
 * 격상도 무대 도착에 얹혀 일어난다(서항 S2 팝업 3초 뒤 · 봉암 B1 재난관제 지도 2초 뒤).
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
import { alarmToast, dismissAllAlarms, type AlarmToast } from "../lib/alarm-toast";
import type { AlertLevel } from "../demo/levels";
import type { GateOverride } from "../demo/facilities";
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
    /** 대본이 도는 지구 (04 §15-3). 스텝 트리거가 "여기 왔나"를 묻는 대상이다 */
    heroDistrictId: "seohang",
    stepClock: STEP_CLOCK,
    escalationStep: 2 as ScenarioStep,
    escalationClock: "17:22",
    /** 격상 전 시계 상한 — 스텝이 앞서 가도 격상 전에는 이 시각을 넘지 않는다 */
    preEscalationClock: "17:20",
    /* 격상의 무대 — 이 스텝에 도착하면 3초 뒤 엔진이 올린다 (04 §0-2 · 05 S2).
       S2 는 주인공 수위계 팝업이다. 팝업이 아니라 엔진이 타이머를 드는 이유:
       팝업이 들면 팝업을 닫는 순간 격상이 취소된다. 03 §2 는 "팝업을 닫아도
       격상은 일어난다". 3초는 발표자가 "이 장비를 눌러 보겠습니다" 한 마디를
       마치는 길이고, 격상이 말하는 도중에 들어온 것처럼 보이는 자리다.
       팝업을 여는 조작 자체가 화면이 이미 앉았다는 뜻이라 무대를 기다리지 않는다 */
    escalationTrigger: { step: 2 as ScenarioStep, delayMs: 3_000, waitForStage: false },
    escalationToast: {
      title: "서항지구 수위계 1호기 · 경보 격상",
      description: "수위 3.41 EL.m — 경보 기준 3.35 EL.m 초과 (17:22)",
      level: "warning" as AlertLevel,
      districtId: "seohang",
    },
  },
  bongam: {
    datePrefix: "2026-08-13T",
    heroDistrictId: "bongam",
    stepClock: {
      /* B0 는 두 사건이 아직 **주의보**인 자리다 (04 §15-1) — 집중호우 경보(08:31) 앞에
         세워야 뒤따르는 격상이 "주의보 → 경보" 로 보인다.
         B1 은 격상(08:52) **앞**이다. 재난관제에 들어선 자리가 곧 격상의 무대라
         (escalationTrigger), 도착 시각이 격상보다 뒤면 방금 본 08:52 격상이 이미 지난
         일이 된다. 2분 간격은 화면이 앉고 2초를 기다리는 그 호흡이다.
         B2 부터는 격상 뒤라 그 뒤 시각을 쓴다 */
      0: "08:30",
      1: "08:50",
      2: "08:58",
      3: "09:01",
      4: "09:05",
      5: "09:10",
      6: "09:13",
      7: "09:16",
      8: "13:20",
      9: "13:24",
    } as Record<ScenarioStep, string>,
    escalationStep: 1 as ScenarioStep,
    escalationClock: "08:52",
    preEscalationClock: "08:50",
    /* 봉암의 무대는 팝업이 아니라 **재난관제 진입**이다(B1). 서항의 문법을 그대로 쓰되
       무대가 화면 자체라, 지도가 앉기 전에 재기 시작하면 타일이 들어오는 사이에 격상이
       지나간다 — waitForStage 로 화면이 "무대가 섰다"(markStageReady)고 알린 뒤부터
       2초를 센다. 발사 타이머로 올리던 자리다: 그때는 발표자가 종합상황에 서 있든
       말든 터져서, 정작 격상을 목격해야 할 재난관제에 들어서면 이미 끝나 있었다 */
    escalationTrigger: { step: 1 as ScenarioStep, delayMs: 2_000, waitForStage: true },
    escalationToast: {
      title: "봉암지구 수위계 2호기 · 내수침수 경보 격상",
      description: "내수위 4.02 EL.m — 경보 기준 3.83 EL.m 초과 (08:52)",
      level: "warning" as AlertLevel,
      districtId: "bongam",
    },
  },
} as const;

/* 발생 연출 (04 §0-3 · §15-1) — 유입은 **시계가 걷는다**. 원장을 현재 시계로 자르는
   파생이 이미 서 있으므로, 시계가 아래 시각을 밟으면 핀·카드·집계·목록이 순서대로
   태어난다. 별도의 연출 코드가 없다 — 엔진이 시계를 옮기면 화면 전부가 따라온다.
   유입 토스트만 엔진이 낸다.

   두 트랙 모두 **평시에서 시작해 사건이 태어나는 것**을 보여준다. 시연을 이미 벌어진
   일을 훑는 것으로 시작하지 않기 위해서다. 발사가 데려다 놓는 데까지는 **주의보**고,
   격상은 두 트랙 모두 무대에 도착한 뒤 오른다(escalationTrigger) — 서항은 수위계 팝업,
   봉암은 재난관제 진입이 그 무대다. 발사가 격상까지 밀고 가면 발표자가 어디에 서 있든
   터져서, 정작 격상을 보여줄 화면에 들어서면 이미 지난 일이 된다. */
interface OnsetSpec {
  /** 유입이 밟는 시각. 첫 칸은 평시(사건 0건)다 */
  clocks: readonly string[];
  /** 각 칸에서 낼 알람. null 이면 조용히 지나간다 */
  toasts: readonly (AlarmToast | null)[];
}

const ONSET: Record<ScenarioTrack, OnsetSpec> = {
  seohang: {
    clocks: ["16:40", "16:50", "17:06"],
    toasts: [
      null,
      {
        title: "구항지구 수위계 1호기 · 폭풍해일 주의보",
        description: "수위 2.84 EL.m — 주의보 기준 2.8 초과 (16:48)",
        level: "advisory",
        districtId: "guhang",
      },
      {
        title: "서항지구 수위계 1호기 · 폭풍해일 주의보",
        description: "수위 3.02 EL.m — 주의보 기준 2.9 초과 (17:05) · 명동항 동시 발생",
        level: "advisory",
        districtId: "seohang",
      },
    ],
  },
  bongam: {
    clocks: ["08:12", "08:15", "08:27"],
    toasts: [
      null,
      {
        title: "봉암지구 강우량계 1호기 · 집중호우 주의보",
        description: "32 mm/h — 주의보 기준 30 초과 (08:14)",
        level: "advisory",
        districtId: "bongam",
      },
      {
        title: "봉암지구 수위계 2호기 · 내수침수 주의보",
        description: "내수위 3.47 EL.m — 주의보 기준 3.45 초과 (08:26)",
        level: "advisory",
        districtId: "bongam",
      },
    ],
  },
};

const ONSET_STEP_MS = 1_600;

/**
 * 격상 알람이 서고 → 화면이 갈아 끼기까지 (ms).
 *
 * 알람이 미끄러져 들어오는 시간(sonner 약 0.4초)에 눈이 그쪽으로 갔다가 지도로 돌아올
 * 틈을 더한 값이다. 0 이면 알람이 도착하기도 전에 핀이 이미 빨갛다.
 */
const ESCALATION_PAINT_DELAY_MS = 1_200;

/* S8(통계 22:10) · S9(에필로그 22:12)는 선행 스텝을 지켜야만 오른다.
   시연 초반에 통계·AI 화면을 열어도 시계가 22시로 뛰지 않는다 (04 §0) */
const STEP_GUARDS: Partial<Record<ScenarioStep, ScenarioStep>> = { 8: 7, 9: 8 };

export type CityStage = "상시대비" | "초기대응(보강)";

interface ScenarioContextValue {
  /** 활성 시연 트랙 (04 §15). 기본 서항. 전환은 전체 리셋이다 */
  track: ScenarioTrack;
  /** 트랙 발사 — 데모 컨트롤의 시나리오 행이 부른다. 리셋 후 발생 연출을 시작한다 */
  launchTrack: (track: ScenarioTrack) => void;
  /** 이 트랙의 대본이 도는 지구 (04 §15-3). 스텝 트리거가 지구 id 를 하드로 물면
   *  트랙 B 에서 같은 무대가 스텝을 못 올린다 — 트랙이 정하게 둔다 */
  heroDistrictId: string;
  /** 발생 연출 중인가 (04 §0-3). 첫 칸은 사건 0건이라 화면이 평시로 보이는데,
   *  기상특보는 트랙 배경이라 그때도 서 있어야 한다 */
  onsetting: boolean;
  /** 지금까지 도달한 최고 스텝 — 단조 증가, 되돌아가지 않는다 */
  step: ScenarioStep;
  /** 격상 여부. 두 트랙 모두 무대 도착이 올린다 — 서항은 S2 수위계 팝업 3초 뒤,
   *  봉암은 재난관제(B1) 지도가 앉고 2초 뒤 (04 §0 · §15-1) */
  escalated: boolean;
  /** 격상 발사 (이미 격상됐으면 아무 일 없다) */
  escalate: () => void;
  /** 격상의 무대가 화면에 앉았다 — 지도를 기다리는 트리거(봉암 B1)가 여기서부터 2초를
   *  센다. 스텝 도착에서 바로 재면 타일이 들어오는 사이에 격상이 지나간다.
   *  무대를 기다리지 않는 트랙(서항)에는 아무 일도 일어나지 않는다 */
  markStageReady: () => void;
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
  /** 배수문 수동 개폐 — 시설 id 별 상황실 명령. 없으면 운영 로그(08:47 폐쇄)를 따른다.
   *  화면 로컬에 두면 지도를 떠났다 오는 순간 방금 내린 명령이 사라진다 */
  gateOverrides: Record<string, GateOverride>;
  /** 배수문 수동 개폐 실행. 기록 시각은 호출부가 이 컨텍스트에서 읽은 `now` 를 그대로
   *  넘긴다 — 시계의 주인은 여전히 엔진 하나다 */
  setGateClosed: (facilityId: string, closed: boolean, at: Date) => void;
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
  const [gateOverrides, setGateOverrides] = useState<Record<string, GateOverride>>({});

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
     escalated 를 구독해 스스로 다시 그려지고, 토스트만 "사건"이라 여기서 낸다.

     ★ **알람이 먼저 서고 화면이 뒤따른다.** 둘을 같은 프레임에 놓으면 핀이 이미 빨간
     뒤에 알람이 도착해, 알람이 소식이 아니라 방금 본 것의 사후 통지로 읽힌다. 알람이
     들어오는 것을 보고 눈이 지도로 돌아왔을 때 주의보가 경보로 갈리는 순서여야 격상이
     한 장면이 된다(03 §0-7 은 화면 요소가 **서로** 어긋나지 말라는 것이지, 알람과
     화면이 같은 프레임이어야 한다는 것이 아니다).
     escalatedRef 는 즉시 세운다 — 이 사이에 트리거가 또 들어와도 두 번 쏘지 않는다 */
  const escalate = useCallback(() => {
    if (escalatedRef.current) return;
    escalatedRef.current = true;
    alarmToast(TRACK[trackRef.current].escalationToast);
    onsetTimers.current.push(
      window.setTimeout(() => setEscalated(true), ESCALATION_PAINT_DELAY_MS),
    );
  }, []);
  /* 타이머가 부를 격상 — 발사·무대 배선이 escalate 에 의존하지 않게 ref 로 잇는다 */
  const escalateRef = useRef(escalate);
  escalateRef.current = escalate;

  /* 격상 무대의 두 조건 — 스텝에 도착했나(advanceTo), 화면이 앉았나(markStageReady).
     둘 다 갖춰진 순간 딱 한 번 타이머를 건다. 어느 쪽이 먼저 와도 되게 양쪽에서
     같은 함수를 부르고, armed 로 두 번 걸리지 않게 막는다 */
  const stageReadyRef = useRef(false);
  const escalationArmedRef = useRef(false);
  const onsettingRef = useRef(false);
  const armEscalation = useCallback(() => {
    if (escalatedRef.current || escalationArmedRef.current) return;
    /* 유입이 도는 중이면 기다린다 — 서두른 발표자가 발사 직후 무대로 뛰어들면 아직 태어나지
       않은 주의보를 격상이 앞질러, 격상 알람 뒤에 주의보 알람이 뜬다 */
    if (onsettingRef.current) return;
    const trigger = TRACK[trackRef.current].escalationTrigger;
    if (!trigger || stepRef.current !== trigger.step) return;
    if (trigger.waitForStage && !stageReadyRef.current) return;
    escalationArmedRef.current = true;
    onsetTimers.current.push(window.setTimeout(() => escalateRef.current(), trigger.delayMs));
  }, []);

  /* 무대가 화면에 앉았다고 화면이 알린다(SCR-02 지도 ready). 스텝이 아직 무대에 닿지
     않았으면 아무 일도 없고, 나중에 advanceTo 가 도착할 때 이 신호가 이미 서 있다 */
  const markStageReady = useCallback(() => {
    stageReadyRef.current = true;
    armEscalation();
  }, [armEscalation]);

  /* 트랙 발사 (04 §0-3 · §15) — 날짜가 다른 두 트랙은 공존하지 않으므로 전체 리셋 후,
     발생 연출의 시계 걷기를 시작한다. 유입 중에도 화면 조작은 잠기지 않는다.
     같은 트랙을 다시 쏘면 처음부터 다시 — 리허설에서 되감는 수단이 된다 */
  const launchTrack = useCallback((next: ScenarioTrack) => {
    onsetTimers.current.forEach((id) => window.clearTimeout(id));
    onsetTimers.current = [];
    /* 앞 편의 알람은 걷는다. 알람이 스스로 닫히지 않으므로 되감지 않으면 어제 사건이
       오늘 트랙 위에 남아 쌓인다 */
    dismissAllAlarms();

    trackRef.current = next;
    setTrack(next);
    stepRef.current = 0;
    setStep(0);
    escalatedRef.current = false;
    setEscalated(false);
    /* 무대 신호도 되감는다 — 앞 편에서 켜 둔 채로 두면 새 트랙이 무대에 닿는 순간
       화면이 앉기를 기다리지 않고 2초를 세기 시작한다 */
    stageReadyRef.current = false;
    escalationArmedRef.current = false;
    setApprovedResponseLevel(null);
    setApprovedAt(null);
    setSopExecutedItemIds(null);
    setPhoneReportedAt(null);
    setDispatches(DISPATCH_HISTORY);
    setSelectedDeviceId(null);
    /* 앞 편에서 내린 수동 개폐도 되감는다 — 남겨 두면 새 트랙의 배수문이 어제 명령을
       그대로 쓴다 */
    setGateOverrides({});

    const spec = ONSET[next];
    onsettingRef.current = true;
    setOnsetIndex(0);
    spec.toasts.forEach((entry, index) => {
      if (!entry) return;
      onsetTimers.current.push(
        window.setTimeout(() => {
          setOnsetIndex(index);
          alarmToast(entry);
        }, index * ONSET_STEP_MS),
      );
    });
    /* 안착 — 사건이 다 태어난 첫 스텝(S0 · B0). 발사가 데려다 놓는 데까지는 주의보고,
       격상은 무대(escalationTrigger)에 도착한 뒤 오른다 */
    const settleAt = spec.toasts.length * ONSET_STEP_MS;
    onsetTimers.current.push(
      window.setTimeout(() => {
        setOnsetIndex(null);
        onsettingRef.current = false;
        /* 유입 중에 무대에 먼저 도착했을 수 있다 — 그 경우 여기서 2초가 시작된다 */
        armEscalation();
      }, settleAt),
    );
  }, [armEscalation]);

  const advanceTo = useCallback(
    (target: ScenarioStep) => {
      const prev = stepRef.current;
      const guard = STEP_GUARDS[target];
      if (guard !== undefined && prev < guard) return;
      if (target <= prev) return;

      const spec = TRACK[trackRef.current];
      /* 격상 스텝을 지나가면 격상은 이미 일어난 것 — 단조성 보장 */
      if (target > spec.escalationStep) escalate();

      stepRef.current = target;
      setStep(target);

      /* 격상의 무대에 도착 (04 §0-2). 타이머를 팝업·화면이 아니라 엔진이 드는 이유:
         팝업을 닫아도, 화면을 옮겨도 격상은 일어나야 한다(03 §2).
         지도를 기다리는 트랙(봉암)이면 markStageReady 가 올 때까지 안 걸린다 */
      armEscalation();
    },
    [escalate, armEscalation],
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

  /* 배수문 수동 개폐 — 운영 로그(08:47 폐쇄)를 사람이 덮어쓰는 유일한 자리다.
     시설 id 별로 마지막 명령만 남긴다 */
  const setGateClosed = useCallback((facilityId: string, closed: boolean, at: Date) => {
    setGateOverrides((prev) => ({
      ...prev,
      [facilityId]: { closed, at: at.toISOString() },
    }));
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
      heroDistrictId: spec.heroDistrictId,
      onsetting: onsetIndex !== null,
      step,
      escalated,
      escalate,
      markStageReady,
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
      gateOverrides,
      setGateClosed,
    };
  }, [
    track,
    launchTrack,
    onsetIndex,
    step,
    escalated,
    escalate,
    markStageReady,
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
    gateOverrides,
    setGateClosed,
  ]);

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario(): ScenarioContextValue {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error("useScenario 는 ScenarioProvider 안에서만 쓴다");
  return ctx;
}
