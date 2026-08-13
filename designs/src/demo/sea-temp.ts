/* ─────────────────────────────────────────────
 * 표층수온 — 열돔 고수온 편의 출발점
 * 정본 후보: docs/작업/열돔-고수온-시나리오.md · 열돔-고수온-AI답변.md
 *
 * 자료는 `public/weather/sea-temperature.json` 하나다(Open-Meteo Marine · CC BY 4.0).
 * 굽는 쪽은 `scripts/fetch-sea-temperature.mjs`.
 *
 * ── 이 편이 세는 것은 값이 아니라 날수다
 *
 * 앞의 편들은 "수위가 3.41 을 넘었나" 를 물었다. 한 점이 선을 넘는 순간이 사건이었다.
 * 고수온은 다르다. 하루 30℃ 는 아무 일도 아니고, **28℃ 를 넘긴 채 보름을 가면** 어가가
 * 죽는다. 그래서 이 파일이 내놓는 값의 중심은 `hotDays` 와 `runs` 다.
 *
 * ── 집계 상수를 두지 않는다 (CLAUDE.md · 04 §4-3)
 *
 * "28℃ 위에 며칠", "최고 몇 도" 를 리터럴로 적으면 자료를 다시 굽는 날 화면과 자료가
 * 조용히 갈라진다. 전부 곡선에서 센다.
 *
 * ── 오늘 이후를 쓰지 않는다
 *
 * 곡선에는 8/31 까지 들어 있지만 시연은 8/17 아침이다. 뒤를 보고 답하면 반칙이라,
 * 읽는 창구(`readSeaTemp`)가 시계에서 잘라 놓고 그 뒤로는 아무도 원본을 못 본다.
 *
 * ── 해는 갈아 끼운다
 *
 * 자료는 2025년 실측이고 시연 무대는 2026년이다. 월·일은 그대로 두고 해만 옮긴다 —
 * 날짜를 지어내는 것이 아니라 같은 계절의 실측을 그 자리에 놓는 것이다.
 * ───────────────────────────────────────────── */

const SEA_TEMP_URL = "/weather/sea-temperature.json";

/** 자료의 해 → 시연의 해. 월·일은 건드리지 않는다 */
const DATA_YEAR = "2025";
export const DEMO_YEAR = "2026";

/**
 * 곡선을 어디서 자를지는 **시연 시계가 정한다.**
 *
 * 화면의 다른 값이 전부 `now` 로 잘리는데 수온만 자료 끝까지 그리면, 같은 화면에서
 * 한 곡선만 미래를 안다. 그래서 자르는 날짜를 밖에서 받는다.
 */
export function seaDateOf(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/* ── 자료 원본 모양 ──────────────────────────────────────────── */

interface SeaTempMeta {
  source: string;
  license: string;
  timezone: string;
  /** 발령 기준 — 예비특보 25℃ · 주의보 28℃ · 경보는 28℃ 사흘 연속 */
  threshold: { advisory: number; watch: number; warningDays: number };
  /** 단계별 발효일 (자료 날짜) */
  stages: { advisory: string; watch: string; warning: string };
  note: string;
}

interface SeaTempStation {
  id: string;
  district: string;
  label: string;
  lat: number;
  lon: number;
  max: number[];
  mean: number[];
}

export interface SeaTempRaw {
  meta: SeaTempMeta;
  /** `YYYY-MM-DD` (자료 해) */
  days: string[];
  /** 창원 앞바다 대표값 — 격자가 약 5km 라 만(灣)을 못 가른다(meta.note) */
  representative: number[];
  series: SeaTempStation[];
}

/* ── 읽어낸 모양 ────────────────────────────────────────────── */

/** 국립수산과학원 고수온 특보 3단계 */
export type SeaStage = "none" | "advisory" | "watch" | "warning";

export const SEA_STAGE_LABEL: Record<SeaStage, string> = {
  none: "해제",
  advisory: "예비특보",
  watch: "주의보",
  warning: "경보",
};

/** 28℃ 이상이 이어진 한 구간 */
export interface HotRun {
  from: string;
  to: string;
  days: number;
  peak: number;
  /** 오늘까지 이어지는 중인가 — 끝난 구간과 셈이 다르다 */
  ongoing: boolean;
}

export interface SeaTempPoint {
  date: string;
  value: number;
}

export interface SeaTempReading {
  meta: SeaTempMeta;
  /** 오늘까지 잘린 곡선 */
  points: SeaTempPoint[];
  current: number;
  today: string;
  peak: number;
  peakDate: string;
  /** 28℃ 이상이었던 날수 — 이어졌는지와 무관하게 센다 */
  hotDays: number;
  /** 28℃ 이상 구간들 — 오래된 것부터 */
  runs: HotRun[];
  /** 지금 이어지는 중인 구간 */
  ongoing: HotRun | null;
  /** 끝난 구간들의 평균 날수 */
  meanRunDays: number | null;
  /** 끝난 구간 중 가장 길었던 날수 */
  maxRunDays: number | null;
  stage: SeaStage;
  /** 단계별 발효일 (시연 날짜) */
  stageDates: { advisory: string; watch: string; warning: string };
  threshold: SeaTempMeta["threshold"];
}

/* ── 날짜 ──────────────────────────────────────────────────── */

export function toDemoDate(dataDate: string): string {
  return dataDate.startsWith(DATA_YEAR) ? `${DEMO_YEAR}${dataDate.slice(4)}` : dataDate;
}

export function toDataDate(demoDate: string): string {
  return demoDate.startsWith(DEMO_YEAR) ? `${DATA_YEAR}${demoDate.slice(4)}` : demoDate;
}

/** `8월 17일` — 답변 문안이 쓰는 꼴 */
export function formatKoreanDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

/** `8/17` — 표·축이 쓰는 짧은 꼴 */
export function formatShortDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

/** 날짜에 날수를 더한다 (UTC 로 셈해 시간대 경계에서 하루가 어긋나지 않게) */
export function addDays(date: string, days: number): string {
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/* ── 읽기 ──────────────────────────────────────────────────── */

/**
 * 자료를 받아 온다.
 *
 * 시연 중 망이 끊겨도 도는 것이 원칙이라 자료는 이미 구워 `public/` 에 있다 —
 * 여기서 부르는 것은 외부가 아니라 우리 정적 파일이다.
 */
/* 한 번만 받아 두고 모두가 나눠 쓴다. 답변 만드는 쪽은 동기라서 받아 둔 값을 바로 읽는다 */
let cache: Promise<SeaTempRaw | null> | null = null;
let resolved: SeaTempRaw | null = null;

export function seaTempOnce(): Promise<SeaTempRaw | null> {
  cache ??= loadSeaTemp().then((raw) => (resolved = raw));
  return cache;
}

/** 이미 받아 둔 곡선을 그 날짜로 잘라 준다. 아직 못 받았으면 null */
export function seaTempAt(today: string): SeaTempReading | null {
  return resolved ? readSeaTemp(resolved, today) : null;
}

export async function loadSeaTemp(): Promise<SeaTempRaw | null> {
  try {
    const response = await fetch(SEA_TEMP_URL);
    if (!response.ok) return null;
    return (await response.json()) as SeaTempRaw;
  } catch {
    return null;
  }
}

/**
 * 오늘까지 자르고, 곡선이 말하는 것을 센다.
 *
 * `today` 가 자료에 없는 날이면 마지막 날로 맞춘다 — 자료를 다시 구워 범위가 달라져도
 * 화면이 빈 채로 뜨지 않는다.
 */
export function readSeaTemp(raw: SeaTempRaw, today: string): SeaTempReading {
  const watch = raw.meta.threshold.watch;

  const found = raw.days.indexOf(toDataDate(today));
  const cutIndex = found >= 0 ? found : raw.days.length - 1;

  const points: SeaTempPoint[] = raw.days
    .slice(0, cutIndex + 1)
    .map((day, i) => ({ date: toDemoDate(day), value: raw.representative[i] }));

  const values = points.map((point) => point.value);
  const peak = Math.max(...values);

  /* 28℃ 이상이 이어진 자리를 잘라 낸다. 마지막 구간이 오늘에 닿아 있으면 진행 중이다 */
  const runs: HotRun[] = [];
  let start: number | null = null;
  points.forEach((point, i) => {
    if (point.value >= watch) {
      if (start === null) start = i;
      return;
    }
    if (start !== null) {
      runs.push(makeRun(points, start, i - 1, false));
      start = null;
    }
  });
  if (start !== null) runs.push(makeRun(points, start, points.length - 1, true));

  const finished = runs.filter((run) => !run.ongoing);

  return {
    meta: raw.meta,
    points,
    current: values[values.length - 1],
    today: points[points.length - 1].date,
    peak,
    peakDate: points[values.indexOf(peak)].date,
    hotDays: values.filter((value) => value >= watch).length,
    runs,
    ongoing: runs.find((run) => run.ongoing) ?? null,
    meanRunDays: finished.length
      ? finished.reduce((sum, run) => sum + run.days, 0) / finished.length
      : null,
    maxRunDays: finished.length ? Math.max(...finished.map((run) => run.days)) : null,
    stage: stageAt(raw, today),
    stageDates: {
      advisory: toDemoDate(raw.meta.stages.advisory),
      watch: toDemoDate(raw.meta.stages.watch),
      warning: toDemoDate(raw.meta.stages.warning),
    },
    threshold: raw.meta.threshold,
  };
}

function makeRun(points: SeaTempPoint[], from: number, to: number, ongoing: boolean): HotRun {
  const slice = points.slice(from, to + 1);
  return {
    from: points[from].date,
    to: points[to].date,
    days: to - from + 1,
    peak: Math.max(...slice.map((point) => point.value)),
    ongoing,
  };
}

/**
 * 오늘 시점의 특보 단계.
 *
 * 단계는 한 번 오르면 스스로 안 내려간다 — 수온이 잠깐 내려가도 해제는 기관이 낸다.
 * 그래서 발효일과 오늘을 견줄 뿐, 오늘 수온으로 되짚지 않는다.
 */
function stageAt(raw: SeaTempRaw, today: string): SeaStage {
  const at = toDataDate(today);
  if (at >= raw.meta.stages.warning) return "warning";
  if (at >= raw.meta.stages.watch) return "watch";
  if (at >= raw.meta.stages.advisory) return "advisory";
  return "none";
}

/* ── 조건이 유지되면 언제까지인가 ──────────────────────────── */

export interface HoldOutlook {
  /** 하한 — 화면이 쓰는 값 */
  floorDate: string;
  floorDays: number;
  /** 상한 — 근거에만 적는다. 폭을 숨기지 않는다 */
  ceilDate: string;
  ceilDays: number;
}

/**
 * **하한을 쓴다.**
 *
 * 끝난 구간들이 평균 며칠 갔는지에 오늘까지의 날수를 견줘 남은 날을 잡는다. 방재 판단은
 * "적어도 여기까지" 로 잡는 것이 맞고, 우리가 아는 것도 딱 그만큼이다.
 *
 * 내림한다 — 하한을 말하는 값이라 반올림으로 하루를 얹으면 그만큼 덜 보수적이 된다.
 * 예측이 아니라 **조건**이다. 열돔이 물러나면 그날 달라진다.
 */
export function holdOutlook(reading: SeaTempReading): HoldOutlook | null {
  if (!reading.ongoing || reading.meanRunDays === null || reading.maxRunDays === null) return null;

  const elapsed = reading.ongoing.days;
  /* 이미 평균을 넘겼으면 남은 날이 0 이하가 된다. 그때는 하루로 바닥을 깐다 —
     "오늘로 끝난다" 고 말할 근거가 없기 때문이다 */
  const floorDays = Math.max(1, Math.floor(reading.meanRunDays - elapsed));
  const ceilDays = Math.max(floorDays, reading.maxRunDays - elapsed);

  return {
    floorDays,
    floorDate: addDays(reading.today, floorDays),
    ceilDays,
    ceilDate: addDays(reading.today, ceilDays),
  };
}
