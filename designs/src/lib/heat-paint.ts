/* ─────────────────────────────────────────────
 * 폭염 탭 지도 층의 페인트 한 벌 — 지도(HeatSim)와 범례(MapLegend)가 같은 값을 읽는다 (2026-09-17)
 *   고온 지속 지역   체감 33°C↑ 가 3시간 넘게 이어지는 칸의 면
 *   무더위쉼터 점    운영 중 · 종료(옅게) · 야간 개방(파랑 · 크게)
 * 범례 색을 따로 적으면 두 벌이 된다.
 * ───────────────────────────────────────────── */

import { cssColor } from "./map-polygon";

export const HOT_AREA_PAINT = () => ({ fill: cssColor("--color-danger", "#ef4444"), line: cssColor("--color-danger", "#ef4444"), opacity: 0.2 });

export const SHELTER_DOT = {
  open: { color: () => cssColor("--color-foreground-muted", "#6b7280"), radius: 3, opacity: 0.8 },
  closed: { color: () => cssColor("--color-foreground-muted", "#6b7280"), radius: 3, opacity: 0.3 },
  night: { color: () => cssColor("--color-primary", "#3b82f6"), radius: 5, opacity: 0.8 },
  stroke: () => cssColor("--color-surface", "#ffffff"),
} as const;
