/* ─────────────────────────────────────────────
 * 조치·규정 표식 한 벌 — 시간축 눈금 · 조치 이력 · 관련 SOP 줄 · 시설 마커 배지가 같은 아이콘·색을 쓴다 (scr-00 · 2026-09-17)
 *   환경  물을 바꾸는 조치(방류 · 펌프)   ▶  파랑
 *   노출  사람을 빼는 조치(통제 · 대피)   ✋  파랑
 *   규정  SOP 가 해당되기 시작함(매칭)     📋  주황
 * 자리마다 다른 아이콘을 쓰면 같은 일이 다른 일로 읽힌다(2026-09-17 사용자 "SOP 아이콘 스타일 통일").
 * ───────────────────────────────────────────── */

import type { SimAction } from "../../../model/sim/flood";

export const ACTION_STYLE: Record<SimAction["kind"], { icon: string; text: string; cssVar: string }> = {
  환경: { icon: "mdi:play", text: "text-primary-text", cssVar: "var(--color-primary)" },
  노출: { icon: "mdi:hand-back-left", text: "text-primary-text", cssVar: "var(--color-primary)" },
  규정: { icon: "mdi:clipboard-text-outline", text: "text-warning", cssVar: "var(--color-warning)" },
};
/** 관련 SOP 줄의 표식 — 규정과 같은 아이콘. 해당되면 주황, 아니면 흐리게 */
export const SOP_ICON = ACTION_STYLE.규정.icon;
