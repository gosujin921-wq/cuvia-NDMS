/* ─────────────────────────────────────────────
 * AppSidebar — 폭 고정 레일 (80px, 펼침 없음)
 *
 * 이 앱 메뉴는 그룹 없는 단층 4개다(nav.ts — AI 검색은 hidden 이라 레일에 서지 않는다).
 * 펼침형 사이드바는 2depth 를 담기 위한
 * 물건이라 여기엔 담을 것이 없다 — 펼치면 같은 라벨이 한 줄 더 생길 뿐이다.
 * 그래서 접힌 폭에 고정하고 펼침·오버플로우·2depth 를 전부 들어낸다.
 *
 * ▸ 같은 판단의 제품 정본: cuvia_platform_web apps/metis/src/app/metis-sidebar.tsx
 *   ("80px 고정, 펼침 없음" — METIS 도 1depth 평면 메뉴라 공통 AppSidebar 를 안 쓴다)
 *
 * ▸ 정본과 다른 점: 표면·활성칩·사용자 영역을 손으로 그리지 않고 DS 부품을 쓴다.
 *     lnb-surface           바탕면 (그라데이션·blur·우측 hairline·z 계층)
 *     SidebarNavIcon        아이콘 + 활성 브랜드 링 칩
 *     SidebarUserMenu       하단 사용자 (호버 정보카드 · 클릭 액션)
 *     border-sidebar-divider  로고 밑·사용자 위 구분선
 *   metis 는 이 부품들이 DS 에 올라오기 전에 만들어져 그라데이션 문자열과 마스크 트릭을
 *   직접 들고 있다. 이 파일에는 원색 값이 없다.
 *
 * 펼침형이 필요해지면(2depth 가 생기면) DS AppSidebar 로 바꾼다 — 메뉴 배열만 넘기면 된다.
 * ───────────────────────────────────────────── */

import { useLocation, useNavigate } from "react-router-dom";
import { SidebarNavIcon, SidebarUserMenu, cn } from "@ds";
import symbolUrl from "@cuvia/assets/symbol.svg";
import wordmarkUrl from "@cuvia/assets/wordmark.svg";
import { HUB_ROUTE, VISIBLE_NAV_ITEMS, findNav, type NavItem } from "./nav";
import { DEMO_USER } from "../demo/user";

/** 레일 폭 — DS 접힘 사이드바와 같은 80px(w-20). 화면 좌표 계산에는 쓰지 않는다 */
const RAIL = "w-20";

export function AppSidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeId = findNav(pathname)?.id;

  /* 같은 경로를 다시 넣으면 히스토리에 빈 항목만 쌓인다 */
  const go = (route: string) => {
    if (route !== pathname) navigate(route);
  };

  return (
    <nav
      data-slot="app-sidebar"
      className={cn("lnb-surface flex h-full shrink-0 flex-col items-center px-3 py-2", RAIL)}
      aria-label="메인 내비게이션"
    >
      {/* 브랜드 — 클릭 시 허브(SCR-01)로 */}
      <button
        type="button"
        onClick={() => go(HUB_ROUTE)}
        aria-label="종합상황으로 이동"
        className="group mb-4 flex h-[69px] w-full shrink-0 cursor-pointer flex-col items-center justify-center border-x-0 border-b border-t-0 border-sidebar-divider bg-transparent p-0"
      >
        <img
          src={symbolUrl}
          alt=""
          className="block size-8 shrink-0 transition-opacity group-hover:opacity-80"
        />
        <img
          src={wordmarkUrl}
          alt="CUVIA"
          className="mt-1 block h-3 w-10 shrink-0 object-contain transition-opacity group-hover:opacity-80"
          /* 워드마크 원본은 색이 들어 있다. 레일은 검은 면이라 흰색으로 눕힌다 */
          style={{ filter: "brightness(0) invert(1)" }}
        />
      </button>

      <ul className="flex w-full flex-col items-center gap-3">
        {VISIBLE_NAV_ITEMS.map((item) => (
          <li key={item.id} className="w-full">
            <RailItem item={item} active={item.id === activeId} onClick={() => go(item.route)} />
          </li>
        ))}
      </ul>

      <div className="flex-1" />

      {/* 하단 사용자 — DS 부품. 로그인·권한은 이 데모의 범위 밖이라(01 개요 §범위)
          onInfoChange·onLogout 을 주지 않는다 */}
      <div className="my-4 w-full border-t border-sidebar-divider" aria-hidden />
      <SidebarUserMenu user={DEMO_USER} expanded={false} />
    </nav>
  );
}

function RailItem({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${item.scr} · ${item.label}`}
      aria-current={active ? "page" : undefined}
      className="group flex w-full cursor-pointer flex-col items-center border-none bg-transparent p-0"
    >
      <SidebarNavIcon icon={item.icon} active={active} />
      <span
        className={cn(
          "mt-1 max-w-full break-keep text-center text-lnb font-medium leading-tight transition-colors",
          active ? "text-white" : "text-foreground-muted group-hover:text-foreground",
        )}
      >
        {item.short ?? item.label}
      </span>
    </button>
  );
}
