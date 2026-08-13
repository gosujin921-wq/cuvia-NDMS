/* ─────────────────────────────────────────────
 * 재난유형 색 — SCR-01 도넛과 SCR-04 분포가 같은 색을 써야 같은 축으로 읽힌다.
 *
 * 단계 색(노랑·주황·빨강)과 겹치지 않는 정보색으로 시연용 선정. 확정되면 04 에 등재한다.
 * ───────────────────────────────────────────── */

import type { HazardType } from "../demo/events";

export const HAZARD_COLOR: Record<HazardType, string> = {
  폭풍해일: "var(--color-primary)",
  하천범람: "#0ea5b7",
  내수침수: "#8b5cf6",
  집중호우: "var(--color-primary-text)",
  지반변위: "var(--color-success)",
};
