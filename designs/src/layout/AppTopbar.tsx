/* ─────────────────────────────────────────────
 * AppTopbar — 상단바 (Type B 페이지 헤더, 64px)
 *
 * 좌측에 화면명과 화면 ID 를 둔다. 전면 화면(대시보드·조기경보·이벤트·디지털트윈)은 이
 * 상단바를 쓰지 않는다 — nav.ts 의 fullBleed. 지금 이 헤더가 서는 화면은 통계뿐이다.
 *
 * ▸ 정본: cuvia_platform_design publishing/drive/src/layout/app-topbar.tsx
 *   (공통레이아웃 v0.6 §1 Type B + §6 치수). 제품 @cuvia/ui AppTopbar 도 같은 파일에서
 *   나왔고 두 벌의 렌더 코드가 같다. DS 패키지에는 아직 안 올라와 있어 여기서 다시 세운다.
 *
 *   정본과 맞춘 것: h-16 · px-6 · bg-background · role="banner" · 현재 화면명 강조
 *   (font-semibold text-foreground truncate) · 우측 actions 슬롯 · className 병합.
 *
 *   정본과 다른 두 가지
 *     · 제목 크기는 text-h6(16px) 토큰을 쓴다. 정본은 같은 16px 를 tailwind text-base 로
 *       적었다 — 값은 같고 이쪽이 토큰이다.
 *     · "1depth › 2depth" 경로 표기(parentLabel · " > " 분리)를 뺐다. 이 앱 메뉴는 그룹
 *       없는 단층 5개라(nav.ts) 앞 세그먼트가 영영 비어 죽은 분기가 된다. 2depth 가 생기면
 *       정본의 그 부분을 그대로 가져온다.
 *
 *   화면 ID(SCR-03)는 정본에 없는 이 앱의 추가분이다 — 화면정의서와 화면을 눈으로
 *   맞대보는 자리라 제목 옆에 남긴다.
 * ───────────────────────────────────────────── */

import type { ReactNode } from "react";
import { cn } from "@ds";

interface AppTopbarProps {
  /** 화면명 (예: 이벤트·상황전파) */
  title: string;
  /** 화면 ID (예: SCR-03) — 이 앱 추가분 */
  scr?: string;
  /** 우측 액션 영역 (선택) */
  actions?: ReactNode;
  className?: string;
}

export function AppTopbar({ title, scr, actions, className }: AppTopbarProps) {
  return (
    <header
      className={cn(
        "flex h-16 shrink-0 items-center justify-between gap-4 bg-background px-6",
        className,
      )}
      role="banner"
    >
      <h1 className="flex min-w-0 items-center text-h6">
        <span className="truncate font-semibold text-foreground">{title}</span>
        {scr && (
          <span className="ml-2 shrink-0 font-mono text-caption text-foreground-subtle">{scr}</span>
        )}
      </h1>

      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
