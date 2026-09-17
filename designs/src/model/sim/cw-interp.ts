/* ─────────────────────────────────────────────
 * 창원천 편집 판 보간 — /scr-00 침수 창원천 대상의 연속 축 (2026-09-17)
 *
 * 창원천 2024-08-28 은 픽스처 머리말대로 **편집 사례**다(관측소 이름은 위치 설명, 수위·시각은 편집값). 실측 수위 시계열이
 * 없고 침수흔적도의 표식은 시가지 내수침수 지점이라 하천 범람면과 겹치지 않아, 서항처럼 규칙을 보정할 수 없다(2026-09-17 확인).
 * 그래도 "비가 늘면 범람이 커진다"를 슬라이더로 보이려고, **이미 있는 판 세 벌(당시 · +20% · +50%) 사이를 직선으로 잇는다.**
 * 새 숫자를 짓지 않는다 — 배율 1.2 는 +20% 판 그대로, 1.35 는 두 판의 중간. 1.5 밖은 판이 없어 열지 않는다.
 *
 * 화면엔 "편집 판 보간 · 실측 보정 없음"이라 적는다. 홍수통제소 수위 시계열이 오면 이 자리가 서항식 보정 규칙(rain-rule)으로 바뀐다.
 * ───────────────────────────────────────────── */

import type { Forecast, ForecastMark } from "../forecast";
import type { WhatIfCase } from "../whatif";
import { CW_FLOOD_LEVELS } from "../../fixtures/changwoncheon/geometry.generated";
import { CW_AREA_TABLE } from "../../fixtures/changwoncheon/area-table.generated";
import { trainingResultOf, whatIfStateRowsAt } from "../selectors";

/** 배율 눈금 = 판 세 벌. 조건 단계 id 와 짝이다(fixtures/changwoncheon/whatif.ts training.conditions) */
export const CW_FACTORS: { factor: number; stepId: string; label: string }[] = [
  { factor: 1, stepId: "now", label: "당시" },
  { factor: 1.2, stepId: "rain-plus20", label: "+20%" },
  { factor: 1.5, stepId: "rain-plus50", label: "+50%" },
];
/** 하구 천변도로가 잠기는 합류부 수위(EL.m) · 합류부 저지대 범람 수위 — bake-flood-changwoncheon 머리말의 단계 뜻 */
export const CW_ROAD_LEVEL = CW_FLOOD_LEVELS["GEO-CW-L25"];
export const CW_LOWLAND_LEVEL = CW_FLOOD_LEVELS["GEO-CW-L35"];

const ms = (iso: string) => new Date(iso).getTime();
const metricOf = (m: ForecastMark) => m.metric?.value ?? m.maxDepthM;

/** 한 판의 합류부 수위를 시각으로 — 첫 눈금 전은 그 시각 관측 줄(편집), 눈금 사이는 직선 */
function boardLevelAt(f: Forecast, wcase: WhatIfCase, atIso: string): number {
  const marks = [...f.marks].sort((a, b) => ms(a.validAt) - ms(b.validAt));
  const at = ms(atIso);
  if (marks.length === 0) return 0;
  if (at <= ms(marks[0].validAt)) {
    const raw = whatIfStateRowsAt(wcase, atIso).rows.find((r) => r.label === "합류부 수위")?.value;
    const v = Number.parseFloat(raw ?? "");
    const first = metricOf(marks[0]);
    if (!Number.isFinite(v)) return first;
    /* 관측(편집)에서 첫 눈금 값으로 직선 — 관측 시각과 눈금 사이가 정지 화면이 되지 않게 */
    const obsAt = ms(whatIfStateRowsAt(wcase, atIso).at);
    const span = Math.max(1, ms(marks[0].validAt) - obsAt);
    return v + (first - v) * Math.min(1, Math.max(0, (at - obsAt) / span));
  }
  for (let i = 1; i < marks.length; i += 1) {
    const a = marks[i - 1], b = marks[i];
    if (at <= ms(b.validAt)) {
      const p = (at - ms(a.validAt)) / Math.max(1, ms(b.validAt) - ms(a.validAt));
      return metricOf(a) + (metricOf(b) - metricOf(a)) * p;
    }
  }
  return metricOf(marks[marks.length - 1]);
}

/** 배율 → 이웃한 두 판과 섞는 비율 */
function bracket(factor: number): { lo: (typeof CW_FACTORS)[number]; hi: (typeof CW_FACTORS)[number]; p: number } {
  const f = Math.min(1.5, Math.max(1, factor));
  for (let i = 1; i < CW_FACTORS.length; i += 1) {
    const lo = CW_FACTORS[i - 1], hi = CW_FACTORS[i];
    if (f <= hi.factor) return { lo, hi, p: (f - lo.factor) / (hi.factor - lo.factor) };
  }
  const last = CW_FACTORS[CW_FACTORS.length - 1];
  return { lo: last, hi: last, p: 0 };
}

export interface CwInterp {
  levelAt(atIso: string): number;
  /** 배율이 눈금 위면 그 판, 사이면 보간한 판 */
  forecast: Forecast | null;
  /** 이웃 판 — 장면·근거는 가까운 쪽을 빌린다 */
  nearest: Forecast | null;
}

export function cwInterp(wcase: WhatIfCase, factor: number, acts: Record<string, string>): CwInterp {
  const { lo, hi, p } = bracket(factor);
  const fLo = trainingResultOf(wcase, lo.stepId, acts).mine;
  const fHi = trainingResultOf(wcase, hi.stepId, acts).mine;
  const nearest = p < 0.5 ? fLo : fHi;
  const levelAt = (atIso: string) => {
    if (!fLo || !fHi) return fLo || fHi ? boardLevelAt((fLo ?? fHi) as Forecast, wcase, atIso) : 0;
    return boardLevelAt(fLo, wcase, atIso) + (boardLevelAt(fHi, wcase, atIso) - boardLevelAt(fLo, wcase, atIso)) * p;
  };
  if (!fLo || !fHi) return { levelAt, forecast: fLo ?? fHi ?? null, nearest: fLo ?? fHi ?? null };
  if (p === 0) return { levelAt, forecast: fLo, nearest: fLo };
  if (p === 1) return { levelAt, forecast: fHi, nearest: fHi };

  /* 보간 판 — 눈금은 가까운 판의 것, 값만 섞는다. 대상의 도달은 섞인 수위가 문턱을 넘는 시각으로 다시 낸다 */
  const base = nearest as Forecast;
  const marks: ForecastMark[] = base.marks.map((m) => {
    const level = levelAt(m.validAt);
    return {
      ...m,
      maxDepthM: Number(Math.max(0, level - CW_ROAD_LEVEL).toFixed(2)),
      extentGeometryId: stageOf(level),
      metric: m.metric ? { ...m.metric, value: Number(level.toFixed(1)) } : m.metric,
      impactSummary: `합류부 ${level.toFixed(1)} m · 편집 판 보간`,
    };
  });
  const firstReach = (th: number): string | null => {
    const start = ms(marks[0]?.validAt ?? base.basis.baseTime) - 60 * 60_000, end = ms(marks[marks.length - 1].validAt);
    for (let t = start; t <= end; t += 60_000) if (levelAt(new Date(t).toISOString()) >= th) return new Date(t).toISOString();
    return null;
  };
  const roadAt = firstReach(CW_ROAD_LEVEL), lowAt = firstReach(CW_LOWLAND_LEVEL);
  const targets = base.targets.map((t) => {
    if (t.kind === "도로" && /천변도로/.test(t.label)) return roadAt ? { ...t, arrivalAt: roadAt, exposure: "노출" as const } : { ...t, arrivalAt: undefined, exposure: "영향 없음" as const };
    if (t.kind === "건물") return lowAt ? { ...t, arrivalAt: lowAt, exposure: "노출" as const } : { ...t, arrivalAt: undefined, exposure: "영향 없음" as const };
    return t;
  });
  const profile = fLo.profile && fHi.profile
    ? { ...fLo.profile, levelsByMark: Object.fromEntries(Object.keys(fLo.profile.levelsByMark).map((k) => [k, fLo.profile!.levelsByMark[k].map((v, i) => v + ((fHi.profile!.levelsByMark[k]?.[i] ?? v) - v) * p)])) }
    : base.profile;
  const forecast: Forecast = {
    ...base,
    forecastId: `${fLo.forecastId}~${fHi.forecastId}@${factor}`,
    changedConditions: [`상류 강우 당시 × ${factor} (편집 판 ${lo.label} · ${hi.label} 사이 보간)`],
    marks,
    arrivalAt: roadAt ?? base.validUntil,
    targets,
    ...(profile ? { profile } : {}),
    basis: {
      ...base.basis,
      modelName: "편집 판 보간",
      assumptions: [...base.basis.assumptions, `강우 배율 ${factor} · 판 ${lo.label}(${lo.factor})과 ${hi.label}(${hi.factor}) 사이를 직선으로 섞음 · 실측 보정 없음`],
      uncertainty: { grade: "높음", sensitiveTo: ["편집 판 자체의 정확도", "판 사이 직선 가정"], unusableRanges: ["배율 1.5 초과(판 없음)"] },
    },
  };
  return { levelAt, forecast, nearest };
}

/** 합류부 수위 → 범람면 단계(구운 링 중 가장 가까운 것) */
export function stageOf(level: number): string {
  return Object.entries(CW_FLOOD_LEVELS).reduce((best, [id, lv]) => (Math.abs(lv - level) < Math.abs(CW_FLOOD_LEVELS[best] - level) ? id : best), "GEO-CW-L10");
}

/** 수위 → 범람면 면적(ha · 물길 포함) — 지형 채우기 표 */
export function cwAreaOfLevel(level: number): number {
  if (level <= CW_AREA_TABLE[0][0]) return 0;
  for (let i = 1; i < CW_AREA_TABLE.length; i += 1) {
    const [l0, a0] = CW_AREA_TABLE[i - 1], [l1, a1] = CW_AREA_TABLE[i];
    if (level <= l1) return a0 + ((level - l0) / (l1 - l0)) * (a1 - a0);
  }
  return CW_AREA_TABLE[CW_AREA_TABLE.length - 1][1];
}

/**
 * 시가지 과거 침수 지점(침수흔적도)이 잠기기 시작하는 시각 — 누적 강우가 한계강우량(p.41)을 넘을 때.
 * 강우는 이 사례의 상류 강우계 줄(편집값)을 시각 사이 직선으로 적분한 것 × 배율. 실자료가 아니라는 것을 화면이 적는다.
 */
export function cwMarksFloodedAt(wcase: WhatIfCase, factor: number, pLim: number, fromIso: string, toIso: string): string | null {
  const rows = (wcase.stateByTime ?? []).map((s) => ({ at: ms(s.at), rate: Number.parseFloat(s.rows.find((r) => r.label === "상류 강우계")?.value ?? "") })).filter((r) => Number.isFinite(r.rate)).sort((a, b) => a.at - b.at);
  if (rows.length === 0) return null;
  const rateAt = (t: number) => {
    if (t <= rows[0].at) return rows[0].rate;
    for (let i = 1; i < rows.length; i += 1) if (t <= rows[i].at) { const a = rows[i - 1], b = rows[i]; return a.rate + (b.rate - a.rate) * ((t - a.at) / Math.max(1, b.at - a.at)); }
    return rows[rows.length - 1].rate;
  };
  let cum = 0;
  for (let t = ms(fromIso); t <= ms(toIso); t += 60_000) {
    cum += (rateAt(t) / 60) * factor;
    if (cum >= pLim) return new Date(t).toISOString();
  }
  return null;
}
