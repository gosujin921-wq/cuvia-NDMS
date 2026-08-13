/* ─────────────────────────────────────────────
 * 내비게이션 구조 — 정본: docs/정본/02_IA_화면구조.md
 *
 * 메뉴는 그룹 없이 5개 단층이다. 대시보드에서 조기경보로 좁히고, 이벤트에서 전파하고,
 * 통계로 되짚고, 디지털트윈으로 앞을 내다보는 시연 순서가 그대로 메뉴 순서가 된다.
 *
 * 화면을 추가하거나 메뉴를 바꿀 때는 02 문서를 먼저 고친다.
 * ───────────────────────────────────────────── */

export interface NavItem {
  id: string;
  /** 화면 ID (예: SCR-01). URL · 페이지 폴더 · 화면정의서와 1:1 정렬 */
  scr: string;
  label: string;
  route: string;
  icon: string;
  /** 80px 레일용 짧은 라벨 — 생략하면 label 을 쓴다. 두 줄로 밀리는 이름만 준다 */
  short?: string;
  /**
   * 전면 화면 — 상단바(타이틀 영역) 없이 페이지가 화면 전체를 쓴다.
   * 지도·3D 가 배경인 화면이 여기 해당하고, 화면 요소는 페이지가 오버레이로 얹는다.
   */
  fullBleed?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    scr: "SCR-01",
    label: "대시보드",
    route: "/scr-01",
    icon: "mdi:view-dashboard-outline",
    fullBleed: true,
  },
  {
    id: "warning",
    scr: "SCR-02",
    label: "조기경보",
    route: "/scr-02",
    icon: "mdi:map-marker-radius-outline",
    fullBleed: true,
  },
  {
    id: "event",
    scr: "SCR-03",
    label: "이벤트·상황전파",
    short: "이벤트",
    route: "/scr-03",
    icon: "mdi:bell-ring-outline",
    fullBleed: true,
  },
  {
    id: "statistics",
    scr: "SCR-04",
    label: "통계",
    route: "/scr-04",
    icon: "mdi:chart-line",
  },
  {
    id: "twin",
    scr: "SCR-05",
    label: "디지털트윈",
    route: "/scr-05",
    icon: "mdi:cube-scan",
    fullBleed: true,
  },
  /* 순서가 아니라 옆길이다 — 어느 화면에 서 있든 말로 물어 답을 받는 자리라 맨 뒤에 둔다.
     실제 진입은 SCR-01 하단의 질의 바가 맡는다 (02 문서 §1) */
  {
    id: "ai-search",
    scr: "SCR-06",
    label: "AI 검색",
    route: "/scr-06",
    icon: "mdi:creation-outline",
  },
];

/** 허브 — 시연이 출발하고 되돌아오는 자리. 브랜드 로고도 여기로 보낸다. */
export const HUB_ROUTE = "/scr-01";

/** 경로로 항목 조회. 상단바 화면명 표기에 쓴다. */
export function findNav(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find(
    (item) => pathname === item.route || pathname.startsWith(`${item.route}/`),
  );
}
