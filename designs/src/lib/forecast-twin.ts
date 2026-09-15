/* ─────────────────────────────────────────────
 * 예측판(Forecast) → 트윈 카드 입력 — 시간축 · 근거·한계 (IA §8 구성 요소)
 *
 * Phase 2 Forecast 는 유효시각 눈금(marks)과 산정 근거(basis)를 든다. 트윈 카드 두 벌
 * (TimelinePanel · AnalysisBasisCard)은 Phase 1 의 Timeline · AnalysisBasis 모양을 받으므로
 * 여기서 한 번만 옮긴다. 사건 작업공간의 전망 레일(scr-02)과 대응 모의훈련(scr-05)이 같은
 * 함수를 쓴다 — 두 화면이 각자 옮기면 눈금 이름·근거 항이 갈린다.
 *
 * ★ 눈금 사이 값은 만들지 않는다(IA §8). 판단에 쓰는 값은 눈금값이다.
 * ───────────────────────────────────────────── */

import type { Forecast, ForecastMark } from "../model/forecast";
import { findEvent } from "../model/selectors";
import type { AnalysisBasis } from "../demo/analysis";
import type { TimeMark, Timeline } from "../demo/scenario-timeline";
import { formatClock } from "./datetime";

/** 분 단위 경과 — `to − from` */
export function minutesBetween(from: string | Date, to: string | Date): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000);
}

/** "+40분" · "+1시간 10분" · "0분" — 기준시각에서의 경과 표기 */
export function formatOffsetMinutes(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (abs === 0) return "0분";
  if (h === 0) return `${sign}${m}분`;
  return m === 0 ? `${sign}${h}시간` : `${sign}${h}시간 ${m}분`;
}

/**
 * 예측판의 시간축. 첫 눈금은 `origin`(현재 또는 훈련 기준시각), 나머지는 예측판 유효시각이다.
 * 눈금 이름은 `labelFrom`(기본 예측판 기준시각, 훈련은 훈련 기준시각)에서의 경과다.
 */
export function forecastTimelineOf(forecast: Forecast, origin: Date, originLabel = "현재", labelFrom: string | Date = forecast.basis.baseTime): Timeline {
  const marks: TimeMark[] = [
    { id: "origin", at: origin, label: originLabel, kind: "now", value: 0, level: null },
    ...forecast.marks.map<TimeMark>((m) => ({
      id: m.validAt,
      at: new Date(m.validAt),
      /* 눈금 칩은 한 덩어리 — "+80분" · "+6시간". 340px 레일에 다섯 칩이 서므로 "+1시간 20분" 은 잘린다 */
      label: formatMarkOffset(minutesBetween(labelFrom, m.validAt)),
      kind: "projection",
      value: m.metric?.value ?? m.maxDepthM,
      level: null,
    })),
  ];
  return {
    marks,
    nowIndex: 0,
    leadMinutes: Math.max(0, minutesBetween(origin, forecast.arrivalAt)),
    unit: forecast.marks[0]?.metric?.unit ?? "m",
  };
}

/** 눈금 칩 표기 — 2시간 이상이고 정각이면 시간 단위 */
export function formatMarkOffset(minutes: number): string {
  if (minutes >= 120 && minutes % 60 === 0) return `+${minutes / 60}시간`;
  return `+${minutes}분`;
}

/** 눈금의 핵심 지표 표기 — "0.32 m" · "1.8 km" · "3곳" */
export function formatMarkMetric(m: ForecastMark): string {
  if (m.metric?.text) return m.metric.text;
  if (m.metric) return `${m.metric.value.toFixed(m.metric.digits ?? 0)}${m.metric.unit.length > 1 || /[a-z]/i.test(m.metric.unit) ? " " : ""}${m.metric.unit}`;
  return `${m.maxDepthM.toFixed(2)} m`;
}

/** 눈금 지표 이름 — "최대 침수심" 이 기본 */
export function markMetricLabel(m: ForecastMark): string {
  return m.metric?.label ?? "최대 침수심";
}

/** 근거·한계 카드 입력 — 모델·버전 · 기준시각·입력 품질 · 불확실성 · 입력 이벤트 · 가정 */
export function forecastBasisOf(forecast: Forecast, mark: ForecastMark): AnalysisBasis {
  return {
    at: new Date(forecast.basis.generatedAt),
    projectedAt: new Date(mark.validAt),
    terms: [
      { label: "모델", value: `${forecast.basis.modelName} ${forecast.basis.modelVersion}`, note: forecast.basis.calculationActor },
      { label: "기준시각", value: formatClock(forecast.basis.baseTime), note: `입력 데이터 ${forecast.basis.inputQuality}` },
      { label: "불확실성", value: forecast.basis.uncertainty.grade, note: forecast.basis.uncertainty.sensitiveTo.join(" · ") },
    ],
    sources: forecast.basis.inputEventIds.map((id) => findEvent(id)?.summary ?? id),
    assumptions: forecast.basis.assumptions,
  };
}

/** 유효시각으로 눈금 찾기 — 없으면 `fallbackToFirst` 일 때 첫 눈금 */
export function markOf(forecast: Forecast, validAt: string | null | undefined, fallbackToFirst = true): ForecastMark | null {
  const hit = validAt ? forecast.marks.find((m) => m.validAt === validAt) : undefined;
  return hit ?? (fallbackToFirst ? forecast.marks[0] ?? null : null);
}
