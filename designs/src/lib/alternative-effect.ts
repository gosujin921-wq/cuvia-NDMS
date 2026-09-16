/* ─────────────────────────────────────────────
 * 대안의 성격 — 침수를 줄이는가, 노출을 줄이는가 (03 §22 · 2026-09-16 사용자 "배수 대응이랑 도로 통제를 잘 구분해서")
 *
 *   현상 감소   배수 대응 · 방류 조정 · 차수벽 — 물 자체가 줄어든다. 범위·깊이·도달이 바뀐다
 *   노출 감소   도로 통제 · 대피 · 쉼터 — 물은 그대로이고 사람·차량이 물에 닿지 않는다. 대상 상태만 바뀐다
 *
 * 두 성격은 화면에서 하는 일이 다르다. 현상 감소는 지도에서 "어디가 줄었나"를 겹쳐 봐야 하고(차이 보기),
 * 노출 감소는 침수면이 기준과 똑같아서 겹쳐 봐야 아무것도 안 달라진다 — 대신 차단 지점·우회로가 지도에 선다.
 *
 * ★ 대안 이름(alternativeId)으로 가르지 않는다. 두 예측판이 든 값을 견줘 판단한다 — 새 유형의 대안이 붙어도 규칙이 그대로 선다
 *   (CLAUDE.md "갈래가 필요하면 데이터가 답을 내게 한다").
 * ───────────────────────────────────────────── */

import type { Forecast, ForecastMark } from "../model/forecast";

export type AlternativeEffect = "현상 감소" | "노출 감소" | "변화 없음";

/** 눈금의 현상 값 — 유형 지표가 있으면 그것, 없으면 최대 침수심 */
const phenomenonOf = (m: ForecastMark) => m.metric?.value ?? m.maxDepthM;

/** 같은 시각 눈금끼리 현상(범위·지표)이 다른가 */
export function phenomenonDiffersAt(a: ForecastMark | null | undefined, b: ForecastMark | null | undefined): boolean {
  if (!a || !b) return false;
  return a.extentGeometryId !== b.extentGeometryId || phenomenonOf(a) !== phenomenonOf(b);
}

/** 같은 시각 눈금끼리 **지도에 그려지는 범위**가 다른가 — 차이 보기가 뜻이 있는가 */
export function extentDiffersAt(a: ForecastMark | null | undefined, b: ForecastMark | null | undefined): boolean {
  return Boolean(a && b && a.extentGeometryId !== b.extentGeometryId);
}

/**
 * 대안 전체의 성격. 어느 한 눈금에서라도 현상이 다르면 현상 감소, 현상은 같은데 대상 상태가 다르면 노출 감소.
 * 같은 예측판(현재 조건)이면 변화 없음.
 */
export function alternativeEffectOf(baseline: Forecast, selected: Forecast): AlternativeEffect {
  if (baseline.forecastId === selected.forecastId) return "변화 없음";
  const phenomenon = selected.marks.some((m) => phenomenonDiffersAt(baseline.marks.find((b) => b.validAt === m.validAt), m));
  if (phenomenon) return "현상 감소";
  const exposure = selected.targets.some((t) => {
    const b = baseline.targets.find((x) => x.id === t.id);
    return b && (b.exposure !== t.exposure || b.label !== t.label);
  });
  return exposure ? "노출 감소" : "변화 없음";
}

/** 받침이 있으면 "은", 없으면 "는" — "침수는" · "범람은" */
const topic = (word: string): string => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? "은" : "는";
};

/** 성격 한 줄 — 대응 비교가 대안 이름 밑에 붙인다. `phenomenon` 은 유형의 현상 이름(TWIN_FAMILY_PHENOMENON) */
export function effectText(effect: AlternativeEffect, phenomenon: string): string {
  if (effect === "현상 감소") return `${phenomenon} 자체를 줄이는 대응 · 범위와 도달이 바뀝니다`;
  if (effect === "노출 감소") return `${phenomenon}${topic(phenomenon)} 그대로 · 사람과 시설이 닿지 않게 하는 대응`;
  return "현재 조건과 결과가 같습니다";
}
