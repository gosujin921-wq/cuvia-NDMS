/* ─────────────────────────────────────────────
 * 내비게이션 구조 — 정본: docs/정본/02_IA_화면구조.md
 *
 * 메뉴명은 기능명이 아니라 역할명이다(02 §1). 순서는 평시 업무 순서 — 전체를 보고(종합상황),
 * 지구로 좁히고(재난관제), 대응하고(상황대응), 되짚고(통계·분석), 앞을 본다(디지털트윈).
 * 시연 순서와는 다르다 — 시연은 사건 순서라 트윈이 상황대응보다 먼저 온다.
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
  /**
   * 하단 중앙 도크가 서는 화면 — 현장영상 스트립(SCR-02 · 03 §2). 좌우 레일 사이 바닥을
   * 도크가 쓰므로, 화면 위에 떠 있는 질의 버튼이 그 자리를 비켜 선다(AgentFab).
   */
  bottomDock?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    scr: "SCR-01",
    label: "종합상황",
    route: "/scr-01",
    icon: "mdi:view-dashboard-outline",
    fullBleed: true,
  },
  {
    id: "warning",
    scr: "SCR-02",
    label: "재난관제",
    route: "/scr-02",
    icon: "mdi:map-marker-radius-outline",
    fullBleed: true,
    bottomDock: true,
  },
  /* SCR-03 상황대응은 차수 N 에서 SCR-02 재난관제로 통합 — 번호는 결번(02 §4) */
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
