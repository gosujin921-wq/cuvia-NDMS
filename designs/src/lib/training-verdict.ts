/* ─────────────────────────────────────────────
 * 훈련이 남기는 두 줄 (README §2.3 · 03 §26.7 · 2026-09-16)
 *
 * 훈련의 목적은 "이 조건에서 우리 규정이 통하는지 확인하고, 안 통하는 지점을 고칠 거리로 남긴다"다.
 * 그 확인은 두 자리에서 끝난다.
 *   ① 규정 결론   시간표의 규정 블록 바닥    무엇을 했고 어디가 늦었나      원장(발동·조치) + 예측판(도달)
 *   ② 결과 결론   결과 표 바닥              당겼다면 무엇이 달라지나        고른 분기 + 비교 표가 만든 문장
 *
 * ★ 카드를 따로 세우지 않는다(2026-09-16 사용자). 판정 카드를 하나 더 두었더니 규정 블록과 결과 표의 값을
 *   그대로 되풀이했고, 실제 → 대안 → 다시 실제 → 다시 대안으로 읽는 순서가 왕복했다.
 * ★ 새 숫자를 만들지 않는다. 문장은 원장 값을 잇는 것뿐이고, 무엇을 고칠지는 사람이 적는다(개선 항목).
 * ★ "다 했다"를 초록으로 칠하지 않는다. 형식으로는 지켰는데 물 도착과 동시에 끝난 경우가 있다.
 * ───────────────────────────────────────────── */

import type { ImprovementAxis } from "../model/whatif";
import { formatClock } from "./datetime";
import { minutesBetween } from "./forecast-twin";

/** 알린 뒤 이만큼 걸리면 눈에 띄게 적는다 — 시간표의 지연 색과 같은 값을 쓴다(두 벌 금지) */
export const LAG_WARN_MIN = 30;

/** 시간표가 만든 규정 줄 — `SimulationView` 의 sopRows 와 같은 모양 */
export interface VerdictSopRow {
  id: string;
  label: string;
  firedAt: string;
  actedAt?: string;
  lagMin: number | null;
}

export interface TrainingNote {
  /** 결론 한 줄 */
  text: string;
  tone: "safe" | "warn" | "none";
  /** 개선 항목 입력으로 넘기는 재료 — 축과 근거 한 줄. 고칠 문장은 넘기지 않는다 */
  seed: { axis: ImprovementAxis; note: string } | null;
}

/**
 * 조치가 도달보다 얼마나 앞섰나 — **"여유 n분"** 하나로 말한다. 도달이 없으면 null.
 * 비교 표의 대응 시점 칸(lib/forecast-compare)과 결과 결론 줄이 같은 함수를 쓴다 —
 * 한 칸은 "여유 0분", 옆 칸은 "도달 10분 전"으로 적었더니 같은 축인데 다른 말이 됐다(2026-09-16).
 * 물이 온 뒤에 한 것만 다르게 말한다(그건 여유가 아니라 늦은 것이다).
 */
export function marginText(at: string, arrivalAt: string | null): string | null {
  if (!arrivalAt) return null;
  const m = minutesBetween(at, arrivalAt);
  /* 줄이 바뀌어도 "10분 / 뒤"로 쪼개지지 않게 묶음 공백을 쓴다 */
  return m >= 0 ? `여유 ${m}분` : `도달 ${-m}분 뒤`;
}

/**
 * ① 규정 결론 — 시간표의 규정 블록 바닥 한 줄.
 * "3건 모두 조치. 가장 늦은 것은 하구 천변도로 통제 47분, 물 도착과 동시"
 */
export function sopNoteOf(sop: VerdictSopRow[], arrivalAt: string | null): TrainingNote | null {
  if (sop.length === 0) return null;
  const acted = sop.filter((x) => x.actedAt);
  const missed = sop.filter((x) => !x.actedAt);

  /* 안 한 것이 있으면 그것이 결론이다 — 늦은 것보다 앞선다 */
  if (missed.length > 0) {
    return {
      text: `${sop.length}건 중 ${missed.length}건을 하지 않았습니다. ${missed.map((x) => `${x.id} ${x.label}`).join(" · ")}`,
      tone: "warn",
      seed: { axis: "SOP", note: `안 한 조치 ${missed.map((x) => x.id).join("·")}` },
    };
  }

  /* 가장 늦은 조치 하나 — 지연이 기준을 넘거나 도달을 못 앞선 것만 말한다 */
  const worst = [...acted].sort((a, b) => (b.lagMin ?? 0) - (a.lagMin ?? 0))[0];
  const tight = worst && ((worst.lagMin ?? 0) >= LAG_WARN_MIN || (arrivalAt !== null && worst.actedAt! >= arrivalAt));
  if (!tight) {
    return { text: `${sop.length}건 모두 ${LAG_WARN_MIN}분 안에 조치했습니다`, tone: "none", seed: null };
  }
  const margin = marginText(worst.actedAt!, arrivalAt);
  return {
    text: `${sop.length}건 모두 조치. 가장 늦은 것은 ${worst.label} ${worst.lagMin}분${margin ? `, ${margin}` : ""}입니다`,
    tone: "warn",
    seed: { axis: "SOP", note: `${worst.id} ${worst.label} 지연 ${worst.lagMin}분${margin ? ` · ${margin}` : ""}` },
  };
}

/**
 * 이 대응의 규정 근거 한 줄 — 결과 카드에 선다.
 * "S3 하구 천변도로 통제 · 발동 14:35 → 실제 15:22 · 47분, 여유 0분"
 * 사건 진행(규정 블록)을 접어 두어도 결론의 근거가 화면에서 사라지지 않게 한다(2026-09-16).
 */
export function sopLineOf(row: VerdictSopRow | null, arrivalAt: string | null): TrainingNote | null {
  if (!row) return null;
  if (!row.actedAt) {
    return { text: `${row.id} ${row.label} · 발동 ${formatClock(row.firedAt)} · 하지 않았습니다`, tone: "warn", seed: { axis: "SOP", note: `안 한 조치 ${row.id} ${row.label}` } };
  }
  const margin = marginText(row.actedAt, arrivalAt);
  const late = (row.lagMin ?? 0) >= LAG_WARN_MIN || (arrivalAt !== null && row.actedAt >= arrivalAt);
  return {
    text: `${row.id} ${row.label} · 발동 ${formatClock(row.firedAt)} → 실제 ${formatClock(row.actedAt)} · ${row.lagMin}분${margin ? `, ${margin}` : ""}`,
    tone: late ? "warn" : "none",
    seed: { axis: "SOP", note: `${row.id} ${row.label} 지연 ${row.lagMin}분${margin ? ` · ${margin}` : ""}` },
  };
}

/**
 * ② 결과 결론 — 결과 표 바닥 한 줄.
 * **바뀐 것(대응 효과)과 안 바뀐 것(자연현상)을 한 문장에서 가른다**(2026-09-16 지적).
 * "통제 여유 0분 → 10분. 합류부 수위와 도달 시각은 그대로"
 * 앞서 "도달 10분 전 · 영향 변화 없음"으로 적었더니 같은 말이 두 번 나오고 끝이 "변화 없음"이라,
 * 훈련의 답이 "아무것도 안 달라졌다"로 읽혔다.
 * 재료는 비교 표가 이미 만든 것이다. 여기서 값을 새로 계산하지 않는다.
 */
export function branchNoteOf({ actionLabel, baseMargin, altMargin, metricLabel, parts }: {
  /** 대응 이름 — "통제 시점" 에서 왔다. 여기서는 "통제 여유"로 쓴다 */
  actionLabel: string | null;
  /** 실제 대응의 여유(분). 도달이 없거나 실제 대응이 없으면 null */
  baseMargin: number | null;
  /** 고른 대응의 여유(분) */
  altMargin: number | null;
  /** 유형 핵심 지표 이름 — "합류부 수위" */
  metricLabel: string;
  /** 비교 표가 만든 변화 문장 */
  parts: string[];
}): TrainingNote | null {
  const changed = parts.filter((x) => x !== "영향 변화 없음");
  /* 노출 대응의 결과는 여유 하나다 — 실제보다 얼마나 앞섰는지를 앞세운다 */
  const gain = actionLabel && baseMargin !== null && altMargin !== null && altMargin !== baseMargin
    ? `${actionLabel.replace(/\s*시점$/, "")} 여유 ${baseMargin}분 → ${altMargin}분`
    : null;
  const head = [gain, ...changed].filter(Boolean).join(" · ");
  if (!head) return null;
  /* 안 바뀐 것을 끝에 적는다 — "침수는 그대로"가 노출 대응의 핵심 사실이다(03 §26.7) */
  const same = changed.length === 0 ? `${metricLabel}와 도달 시각은 그대로` : null;
  const text = same ? `${head}. ${same}` : head;
  return { text, tone: "safe", seed: { axis: "임계치", note: text } };
}
