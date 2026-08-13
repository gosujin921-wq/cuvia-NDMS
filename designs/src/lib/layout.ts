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

/**
 * 하단 중앙 도크 높이 (px) — 현장영상 스트립(SCR-02 · 04 §2-5).
 *
 * 도크는 좌우 레일 사이(CENTER_LEFT~CENTER_RIGHT)에 bottom-3 으로 선다. 지도 중심 맞춤과
 * 질의 버튼 자리가 이 값을 따라가므로, 페이지가 같은 수를 따로 들지 않는다.
 */
export const CCTV_DOCK = 160;

/**
 * 질의 버튼(AgentFab) 자리 — 화면 성격에 따라 셋 중 하나에 선다.
 *
 * 우측 레일 위에 떠 있으면 판단·대응 카드의 글과 레일 바닥 버튼을 가린다. 그래서 레일이
 * 선 화면에서는 레일 왼쪽으로 비켜 가운데 영역의 우하단에 선다(right = CENTER_RIGHT) —
 * 유틸 스트립과 같은 열이고, 여백은 레일 사이와 같은 EDGE 한 칸이다.
 *
 *   · FAB_SLOT      화면 우하단. 레일이 없는 화면(SCR-04·06)
 *   · FAB_SLOT_RAIL 가운데 영역 우하단. 레일이 선 화면(SCR-05)
 *   · FAB_SLOT_DOCK 거기서 도크 위로. 하단 중앙 도크까지 있는 화면(SCR-02)
 *
 * 도크는 좌우 레일 사이에만 서므로(03 §1) 도크가 있는 화면에는 우측 레일도 반드시 있다.
 */
export const FAB_SLOT = { right: 16, bottom: 16 };
export const FAB_SLOT_RAIL = { right: CENTER_RIGHT, bottom: EDGE };
export const FAB_SLOT_DOCK = { right: CENTER_RIGHT, bottom: EDGE + CCTV_DOCK + EDGE };

/* 레일 바닥에 질의 버튼 자리를 비워 두던 RAIL_BOTTOM 은 없앴다 — 버튼이 레일 왼쪽으로
   비켜 서면서(FAB_SLOT_RAIL) 레일 바닥의 고정 버튼을 가리지 않는다. 레일은 어느 화면에서나
   bottom-3 까지 내려온다(RAIL_BASE). */
