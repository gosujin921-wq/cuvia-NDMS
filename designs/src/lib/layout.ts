/* ─────────────────────────────────────────────
 * 지도 화면 레일 기하 — 제품 GIS 대시보드 정본
 *
 * 값의 출처는 제품 저장소다. 이 앱이 임의로 정한 숫자가 아니다.
 *   · cuvia_platform_web / features/dashboard-kisa/index.tsx
 *       LEFT_PANEL  = w-[300px]   좌측 레일 (absolute left-3 top-3 bottom-3, z-20)
 *       RIGHT_PANEL = w-[340px]   우측 레일 (absolute right-3 top-3 bottom-3, z-20)
 *       CENTER_SPAN = left-[324px] right-[364px]
 *       유틸 스트립  = absolute right-[364px] top-1/2 z-30 -translate-y-1/2
 *   · apps/storybook/stories/layout-map.stories.tsx (같은 값을 그림으로 낸 배치도)
 *
 * 레일 폭이 바뀌면 가운데 영역과 유틸 스트립 자리가 같이 움직인다. 그래서 폭을 화면마다
 * 다르게 두지 않는다 — 화면을 오갈 때 패널과 스트립이 좌우로 튀면 같은 앱으로 안 읽힌다.
 * ───────────────────────────────────────────── */

/** 좌측 레일 폭 (px) */
export const LEFT_RAIL = 300;

/** 우측 레일 폭 (px) */
export const RIGHT_RAIL = 340;

/** 화면 가장자리 여백 (px) — Tailwind `left-3` / `top-3` 과 같은 값 */
export const EDGE = 12;

/**
 * 가운데 영역의 좌·우 경계 (px) — 레일 폭 + 양쪽 여백.
 *
 * 지도 중심 맞춤(fitBounds·easeTo padding)과 가운데 하단 요소의 좌우 기준으로 쓴다.
 * 제품의 CENTER_SPAN(left-[324px] right-[364px])과 같은 값이다.
 */
export const CENTER_LEFT = LEFT_RAIL + EDGE * 2;
export const CENTER_RIGHT = RIGHT_RAIL + EDGE * 2;

/**
 * 레일 컨테이너 공통 클래스 — 세로 전체를 쓰고 패널을 gap-2 로 쌓는다.
 *
 * 레일 자체는 클릭을 받지 않는다(pointer-events-none). 지도를 덮은 빈 자리까지 클릭을
 * 먹으면 마커를 못 짚는다. 패널마다 pointer-events-auto 로 되살린다.
 */
export const RAIL_BASE = "pointer-events-none absolute bottom-3 top-3 z-20 flex flex-col gap-2";

/** 지도 위 유틸 스트립(맵 조작) 자리 — 우측 레일 바로 왼쪽, 세로 중앙 */
export const UTIL_STRIP = "absolute right-[364px] top-1/2 z-30 -translate-y-1/2";
