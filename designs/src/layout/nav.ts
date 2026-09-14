/* ─────────────────────────────────────────────
 * 내비게이션 구조 — 정본: docs/고도화/CUVIA_NDMS_기능및정보구조도.md §4 · §5.2
 *
 * 메뉴는 Phase 1 다섯 개 그대로다. IA-01 종합상황 = /scr-01, IA-02·04 사건 작업공간과 대응 패널 = /scr-02/:districtId,
 * IA-03 디지털트윈 = /scr-05, IA-05 기록·검증 = /scr-04 · /scr-07. 대응은 별도 URL 없이 우측 패널이다(IA §5.2).
 *
 * 화면을 추가하거나 메뉴를 바꿀 때는 IA 문서를 먼저 고친다.
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
  /**
   * 하단 중앙 도크가 서는 화면 — 현장영상 스트립(SCR-02 · 03 §2). 좌우 레일 사이 바닥을
   * 도크가 쓰므로, 화면 위에 떠 있는 질의 버튼이 그 자리를 비켜 선다(AgentFab).
   */
  bottomDock?: boolean;
  /**
   * 레일에 세우지 않는 화면 — 목록에는 남기고 메뉴에서만 감춘다.
   * 항목 자체를 지우면 상단바 화면명(findNav)까지 같이 사라진다.
   */
  hidden?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  /* Phase 2 는 신규 라우트를 만들지 않고 /scr-* 를 유지한다(IA §5.2). 메뉴도 그대로다 — 재편은 URL 교체가
     아니라 화면 안의 정보 구조와 패널 역할을 바꾸는 것이다. 한 화면씩 간다 */
  {
    id: "dashboard",
    scr: "IA-01",
    label: "종합상황",
    route: "/scr-01",
    icon: "mdi:view-dashboard-outline",
    fullBleed: true,
  },
  {
    id: "warning",
    scr: "IA-02",
    label: "재난관제",
    /* 재편됨 — /scr-02/:districtId 가 그 지구의 진행 사건 작업공간이다(IA §5.2). 메뉴는 대표 사건 지구로 */
    route: "/scr-02",
    icon: "mdi:map-marker-radius-outline",
    fullBleed: true,
    bottomDock: true,
  },
  {
    id: "statistics",
    scr: "SCR-04",
    label: "통계·분석",
    short: "통계",
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
  {
    id: "report",
    scr: "SCR-07",
    label: "보고서",
    route: "/scr-07",
    icon: "mdi:file-document-outline",
  },
  { id: "ai-search", scr: "SCR-06", label: "AI 검색", route: "/scr-06", icon: "mdi:creation-outline", hidden: true },
];

/** 레일에 서는 항목 — 사이드바가 쓴다 */
export const VISIBLE_NAV_ITEMS: NavItem[] = NAV_ITEMS.filter((item) => !item.hidden);

/** 허브 — 시연이 출발하고 되돌아오는 자리. 브랜드 로고도 여기로 보낸다. */
export const HUB_ROUTE = "/scr-01";

/** 경로로 항목 조회. 상단바 화면명 표기에 쓴다. */
export function findNav(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find(
    (item) => pathname === item.route || pathname.startsWith(`${item.route}/`),
  );
}
