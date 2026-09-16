/* ─────────────────────────────────────────────
 * 대응의 변화량 — "침수심 −0.12 m · 도달 +3분 · 해안도로 노출 감소" (03 §22 · 2026-09-15 · 2026-09-16 수 걷음)
 *
 * 대응 비교의 결론 한 줄이다. 아래 비교표는 상세값이고 이 줄이 "그래서 뭐가 달라지나"에 답한다.
 * 현상을 줄이는 대응(배수)은 지표·도달이 바뀌고, 노출을 줄이는 대응(통제)은 범위가 그대로인 채 대상 상태만 바뀐다.
 * 그 차이가 문장에서 바로 갈린다.
 *
 * ★ 새 예측값을 만드는 것이 아니다. 두 예측판이 이미 든 같은 눈금의 값을 빼서 읽어 줄 뿐이다.
 * ★ 대상의 수(차량·인원·건물 동)는 말하지 않는다 — 일찍 할수록 비례로 주는 산수라 트윈 결과가 아니다(README §2.3 기준 ③ · 2026-09-16).
 * ───────────────────────────────────────────── */

import type { Forecast, ForecastMark, ImpactTarget } from "../model/forecast";
import { minutesBetween } from "./forecast-twin";

/** 시간 길이 — 60분을 넘으면 시간으로("3시간 20분"). 느린 재난(급경사지·폭염)은 도달 차이가 몇 시간이다 */
const span = (m: number): string => (m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ""}` : `${m}분`);

/** 노출 무게 — 낮을수록 안전하다. 영향 없음과 통제됨은 둘 다 "노출 아님"이라 같은 칸이다 */
const RANK: Record<ImpactTarget["exposure"], number> = { "영향 없음": 0, 통제됨: 0, 노출: 1, "부분 중단": 2, 중단: 3 };
/** 대상 이름 — 라벨 끝에 수가 남아 있으면 뗀다(지난 판본 호환) */
const nameOf = (t: ImpactTarget) => t.label.replace(/\s*\d+\S*$/, "");

export interface ForecastDelta {
  /** 결론 조각들 — 화면이 가운뎃점으로 잇는다 */
  parts: string[];
  /** 좋아졌는가 — 지표·도달·노출 중 하나라도 나아지면 참 */
  improved: boolean;
}

/**
 * 기준 대비 대응의 변화. 같은 유효시각의 눈금끼리 비교한다.
 * `selectedMark` 가 없으면(대안에 그 눈금이 없으면) 지표 비교는 건너뛰고 대상 상태만 읽는다.
 */
export function forecastDelta(baseline: Forecast, baselineMark: ForecastMark, selected: Forecast, selectedMark: ForecastMark | null): ForecastDelta {
  const parts: string[] = [];
  let improved = false;

  /* ① 유형 핵심 지표 — 침수심(m) 또는 유형이 정한 metric */
  if (selectedMark) {
    const label = baselineMark.metric?.label ?? "최대 침수심";
    const unit = baselineMark.metric?.unit ?? "m";
    const digits = baselineMark.metric?.digits ?? 2;
    const a = baselineMark.metric?.value ?? baselineMark.maxDepthM;
    const b = selectedMark.metric?.value ?? selectedMark.maxDepthM;
    const d = Number((b - a).toFixed(digits));
    if (d !== 0) {
      parts.push(`${label} ${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(digits)} ${unit}`);
      if (d < 0) improved = true;
    }
  }

  /* ② 도달 시각 — 늦춰지면 +n분. 도달 자체가 사라지면 그렇게 말한다 */
  const baseArrival = baseline.targets.find((t) => t.arrivalAt)?.arrivalAt;
  const altArrivalTarget = selected.targets.find((t) => t.arrivalAt);
  if (baseArrival && !altArrivalTarget) {
    parts.push("도달 없음");
    improved = true;
  } else if (baseArrival && altArrivalTarget?.arrivalAt) {
    const d = minutesBetween(new Date(baseArrival), new Date(altArrivalTarget.arrivalAt));
    if (d !== 0) {
      parts.push(`도달 ${d > 0 ? "+" : "−"}${span(Math.abs(d))}`);
      if (d > 0) improved = true;
    }
  }

  /* ③ 노출 상태 — 범위가 그대로인 대응(통제)이 바꾸는 것이 여기다 */
  const eased = selected.targets.filter((b) => {
    const a = baseline.targets.find((x) => x.id === b.id);
    return a && RANK[b.exposure] < RANK[a.exposure];
  });
  if (eased.length > 0) {
    const resolved = eased.every((t) => t.exposure === "영향 없음");
    /* 셋 이상이면 이름을 다 적지 않고 종류로 묶는다 — "해안도로 저지대 구간 · 신포 지하차도 · 해안도로 보행·차량 이용자"는 한 줄에 안 선다 */
    const who = eased.length <= 2 ? eased.map(nameOf).join(" · ") : [...new Set(eased.map((t) => t.kind))].join("·");
    parts.push(`${who} ${resolved ? "영향 해소" : "노출 감소"}`);
    improved = true;
  }

  /* ④ 노출 상태가 나빠진 것 — 상황 조건(비가 더 오면)이 바꾸는 것이 여기다. 대응은 대개 이쪽으로 가지 않는다 */
  const worse = selected.targets.filter((b) => {
    const a = baseline.targets.find((x) => x.id === b.id);
    return a && RANK[b.exposure] > RANK[a.exposure];
  });
  if (worse.length > 0) {
    parts.push(worse.length <= 2 ? worse.map((t) => `${nameOf(t)} ${t.exposure}`).join(" · ") : `${[...new Set(worse.map((t) => t.kind))].join("·")} 악화`);
  }

  /* ⑤ 아무것도 안 바뀌면 그렇게 말한다 — 빈 줄보다 낫다 */
  if (parts.length === 0) parts.push("영향 변화 없음");
  return { parts, improved };
}
