/* ─────────────────────────────────────────────
 * 색 유틸
 *
 * 단계 색(levels.ts)은 `var(--color-risk-lv4)` 형태의 토큰 참조라 hex 알파(`#f9731633`)를
 * 붙일 수 없다. `var(...)33` 은 잘못된 CSS 값이라 그 선언이 통째로 무시된다 — 테두리 글로우가
 * 조용히 사라지는 사고가 그렇게 난다. 반투명이 필요하면 이 함수를 쓴다.
 * ───────────────────────────────────────────── */

/** 색을 투명에 섞어 옅게 만든다. percent = 원색이 남는 비율(%) */
export function fadeColor(color: string, percent: number) {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
