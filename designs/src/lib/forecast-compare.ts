/* ─────────────────────────────────────────────
 * 비교 결과 한 벌 — 현재 조건 대 선택한 대응 (IA §8 "영향 결과" · 03 §22)
 *
 * 같은 표를 세 곳이 쓴다 — 트윈 우측의 달라지는 것 카드, 저장된 분석 정보 창, 분석 보고서.
 * 값이 세 벌이 되면 한 곳을 고칠 때 나머지가 남으므로 행 만들기를 여기 하나로 올린다(CLAUDE.md "두 벌이 된 것은 위로 올린다").
 * 화면은 `tone` 만 자기 색으로 바꿔 찍고, 문서·저장은 `text` 를 그대로 쓴다.
 *
 * ★ 값은 예측판 결과 객체 그대로다. 차이를 계산해 새 숫자를 만들지 않는다 — 변화량 한 줄은 lib/forecast-delta 가 따로 맡는다.
 * ───────────────────────────────────────────── */

import type { Forecast, ForecastMark, ImpactTarget } from "../model/forecast";
import { formatClock } from "./datetime";
import { formatMarkMetric, markMetricLabel, minutesBetween } from "./forecast-twin";
import { previewExposure } from "./twin-preview";
import { marginText } from "./training-verdict";

/** 칸의 성격 — 화면이 색을 고르는 근거. 문서는 무시한다 */
export type CompareTone = "none" | "muted" | "safe" | "warn" | "danger";

export interface CompareCell {
  text: string;
  tone: CompareTone;
  /** 숫자 칸 — 화면이 고정폭으로 찍는다 */
  mono: boolean;
  /** 기준과 달라진 칸 */
  changed: boolean;
}

export interface CompareRow {
  id: string;
  label: string;
  base: CompareCell;
  /** 가운데 칸 — 상황과 대응을 함께 바꾼 비교의 상황 칸(기준 대비 changed). 두 칸 비교면 없다 */
  mid?: CompareCell | null;
  /** 현재 조건만 보고 있으면 null. 세 칸 비교면 changed 는 가운데 칸 대비다 */
  alt: CompareCell | null;
  /** 지표·시각 묶음인가(위), 영향 대상 묶음인가(아래) */
  group: "metric" | "target";
}

const EXPOSURE_TONE: Record<ImpactTarget["exposure"], CompareTone> = {
  "영향 없음": "muted",
  통제됨: "safe",
  "대피 권고": "safe",
  노출: "warn",
  "부분 중단": "danger",
  중단: "danger",
};

/** 예측 범위 안에 도달이 없으면 arrivalAt 은 자리값(유효 종료)이라 "없음"으로 말한다 */
const arrivalText = (f: Forecast): string => (f.targets.some((t) => t.arrivalAt) ? formatClock(f.arrivalAt) : "없음");
/** 도달 시각 — 없으면 null. 판정 세 줄(lib/training-verdict)도 같은 규칙을 써야 해서 내보낸다 */
export const arrivalAtOf = (f: Forecast): string | null => (f.targets.some((t) => t.arrivalAt) ? f.arrivalAt : null);

/**
 * 달라진 칸의 색 — **좋아지면 초록, 나빠지면 주황**이다(2026-09-16 사용자 지적).
 * 바뀌었다는 이유만으로 경고색을 칠하면 진입 통제·수위 감소 같은 개선이 위험처럼 읽힌다.
 */
const dirTone = (better: boolean): CompareTone => (better ? "safe" : "warn");

/**
 * 조치가 도달보다 얼마나 앞섰나 — 노출 대응(통제·대피)의 결과는 이것 하나다(README §2.3 기준 ③).
 * "17:46 · 도달 6분 전". 도달이 없으면 시각만 적는다.
 */
function actionText(at: string, arrival: string | null): { text: string; margin: number | null } {
  /* 말은 lib/training-verdict 의 marginText 하나를 쓴다. 규정 결론 줄과 표가 같은 여유를 다르게 적으면 안 된다 */
  const word = arrival ? marginText(at, arrival) : null;
  if (!word || !arrival) return { text: formatClock(at), margin: null };
  return { text: `${formatClock(at)} · ${word}`, margin: minutesBetween(new Date(at), new Date(arrival)) };
}

const cell = (text: string, tone: CompareTone, mono: boolean, changed: boolean): CompareCell => ({ text, tone, mono, changed });

/**
 * 영향 대상 한 칸 — 상태만 적는다. 대상의 수(차량·인원·건물 동)는 세지 않는다.
 * 일찍 할수록 비례로 주는 산수라 트윈 결과가 아니다(README §2.3 기준 ③ · 2026-09-16).
 */
function targetCell(t: ImpactTarget | null, changed: boolean, alt: boolean): CompareCell {
  if (!t) return cell("-", "none", false, false);
  /* 대안 열의 "통제됨"은 아직 가정이라 "통제 시" 문구로 (lib/twin-preview) */
  return cell(alt ? previewExposure(t) : t.exposure, EXPOSURE_TONE[t.exposure], false, changed);
}

/**
 * 비교 결과 행 전부. `same` 이면 대안 칸을 만들지 않는다 —
 * "그대로 / 그대로" 두 열은 "그래서 뭐가 다른데"가 된다(2026-09-15 사용자).
 * `baseActionAt` — 기준에서도 같은 대응을 했으면 그 시각(종료 사건의 실제 방류 · 실제 통제). 그대로 두면 안 한 것이라 없다
 */
export function compareRowsOf(baseline: Forecast, baselineMark: ForecastMark, selected: Forecast, selectedMark: ForecastMark | null, same: boolean, baseActionAt: string | null = null): CompareRow[] {
  const rows: CompareRow[] = [];
  const two = (id: string, label: string, baseText: string, altText: string | null, group: CompareRow["group"], mono: boolean, better?: boolean) => {
    const changed = altText !== null && altText !== baseText;
    rows.push({
      id, label, group,
      base: cell(baseText, "none", mono, false),
      alt: same || altText === null ? null : cell(altText, changed ? dirTone(better ?? false) : "none", mono, changed),
    });
  };

  /* ① 유형 핵심 지표 — 값이 줄면 좋아진 것이다(침수심 · 수위 · 화선 거리 · 중단 권역) */
  const baseValue = baselineMark.metric?.value ?? baselineMark.maxDepthM;
  const altValue = selectedMark ? selectedMark.metric?.value ?? selectedMark.maxDepthM : null;
  two("metric", `${markMetricLabel(baselineMark)} · ${formatClock(baselineMark.validAt)}`, formatMarkMetric(baselineMark), selectedMark ? formatMarkMetric(selectedMark) : "-", "metric", true,
    altValue !== null && altValue < baseValue);
  /* ② 도달 시각 — 늦어지거나 없어지면 좋아진 것이다 */
  const baseArrival = arrivalAtOf(baseline), altArrival = arrivalAtOf(selected);
  two("arrival", "도달 시각", arrivalText(baseline), arrivalText(selected), "metric", true,
    altArrival === null || (baseArrival !== null && altArrival > baseArrival));
  /* ③ 대응이 언제 들어가는가 — 대안에만 있다. 도달보다 얼마나 앞섰는지를 함께 적는다 */
  if (!same && selected.actionAt) {
    const alt = actionText(selected.actionAt.at, altArrival);
    const base = baseActionAt ? actionText(baseActionAt, baseArrival) : null;
    rows.push({
      id: "action", label: selected.actionAt.label, group: "metric",
      /* 시각과 여유를 한 칸에 두면 좁은 칸을 넘는다 — 고정폭을 끄고 두 줄로 흐르게 둔다 */
      base: cell(base?.text ?? "-", "none", false, false),
      /* 여유가 늘면 좋아진 것이다. 기준에 대응이 없으면 새로 하는 것이라 좋아진 쪽으로 읽는다 */
      alt: cell(alt.text, dirTone(base?.margin == null || alt.margin === null || alt.margin > base.margin), false, true),
    });
  }

  /* ④ 영향 대상 — 같은 대상인데 수가 다르면 행 이름은 대상, 수는 칸에 */
  const ids = [...new Set([...baseline.targets, ...selected.targets].map((t) => t.id))];
  for (const id of ids) {
    const b = baseline.targets.find((t) => t.id === id) ?? null;
    const a = selected.targets.find((t) => t.id === id) ?? null;
    const raw = b?.label ?? a?.label ?? id;
    /* 노출 상태가 바뀌었으면(노출 → 통제됨 · 부분 중단 → 중단) 달라진 칸이다 */
    const changed = a?.exposure !== b?.exposure;
    rows.push({
      id, label: raw.replace(/\s*\d+\S*$/, ""), group: "target",
      base: targetCell(b, false, false),
      alt: same ? null : targetCell(a, changed, true),
    });
  }
  return rows;
}

/**
 * 세 칸 비교 — 기준 → 상황 → 상황+대응 (2026-09-16 "상황과 대응을 같이 선택").
 * 칸마다 한 가지씩만 달라진다. 가운데 칸은 기준 대비, 오른쪽 칸은 가운데 칸 대비로 달라짐을 표시한다 —
 * 오른쪽 칸의 차이가 곧 "그 상황에서 대응을 바꾼 효과"다. 두 판 비교(compareRowsOf) 둘을 이어 붙일 뿐 새 숫자를 만들지 않는다.
 */
export function compareChainOf(base: Forecast, baseMark: ForecastMark, mid: Forecast, midMark: ForecastMark, alt: Forecast, altMark: ForecastMark | null, baseActionAt: string | null = null): CompareRow[] {
  const a = compareRowsOf(base, baseMark, mid, midMark, false, baseActionAt);
  const b = compareRowsOf(mid, midMark, alt, altMark, false, baseActionAt);
  /* 세 칸은 칸이 좁다 — 대응 시점 줄은 시각만 남기고 여유는 두 칸 비교에서만 적는다 */
  const clip = (rows: CompareRow[]) => rows.map((r) => (r.id !== "action" ? r : {
    ...r,
    base: { ...r.base, text: r.base.text.split(" · ")[0], mono: true },
    alt: r.alt ? { ...r.alt, text: r.alt.text.split(" · ")[0], mono: true } : r.alt,
  }));
  return chain(clip(a), clip(b));
}

function chain(a: CompareRow[], b: CompareRow[]): CompareRow[] {
  const ids = [...new Set([...b.map((r) => r.id), ...a.map((r) => r.id)])];
  return ids.map((id) => {
    const ra = a.find((r) => r.id === id);
    const rb = b.find((r) => r.id === id);
    const head = rb ?? ra!;
    return {
      id, label: head.label, group: head.group,
      base: ra?.base ?? rb!.base,
      /* 대응 시점 줄은 상황 판에 없다 — 상황 칸의 대응은 기준과 같은 시각이다 */
      mid: ra?.alt ?? { ...rb!.base, changed: false },
      alt: rb?.alt ?? null,
    };
  });
}

/** 저장·문서가 쓰는 평문 — 두 칸이면 mid 가 없다 */
export function compareTextRowsOf(rows: CompareRow[]): { label: string; base: string; mid?: string; alt: string }[] {
  return rows.map((r) => ({ label: r.label, base: r.base.text, ...(r.mid ? { mid: r.mid.text } : {}), alt: r.alt?.text ?? "-" }));
}

/** 달라진 줄 — 세 칸이면 가운데나 오른쪽 중 하나라도 달라진 줄 */
export const isChangedRow = (r: CompareRow): boolean => Boolean(r.alt?.changed || r.mid?.changed);

/** 기준 전망만 — 저장된 분석 상세·보고서의 `기준 전망` 블록 */
export function baselineRowsOf(rows: CompareRow[]): { label: string; value: string }[] {
  return rows.map((r) => ({ label: r.label, value: r.base.text }));
}
