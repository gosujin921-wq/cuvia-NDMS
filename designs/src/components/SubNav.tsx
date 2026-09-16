/* ─────────────────────────────────────────────
 * 화면 상단 탭 줄 — 좌측 탭 · 우측 보조 동작, 높이 48px 한 줄
 *
 * ▸ 구조 정본: METIS `system-monitoring-sub-nav.tsx`(SCR-044 시스템 모니터링 · SCR-042 계정관리가 같은 문법).
 *   디지털트윈(scr-05 widgets/TwinSubNav)이 먼저 이 모양으로 짰고, 이력(scr-07 · [사건] · [보고서])이 같은 줄을 쓰도록 여기로 올렸다.
 *   TwinSubNav 도 이 부품으로 옮길 대상이다(2026-09-16 다른 세션 작업 중이라 아직 손대지 않았다).
 * ▸ 탭은 query `tab` 이 든다. 신규 라우트를 만들지 않는다(CLAUDE.md · IA §5.2).
 *
 * TODO(ds): METIS system-monitoring-sub-nav 와 같은 부품. DS 승격 대상
 * ───────────────────────────────────────────── */

import type { ReactNode } from "react";
import { Icon } from "@iconify/react";
import { Tabs, TabsList, TabsTrigger } from "@ds";

export interface SubNavTab<T extends string> {
  id: T;
  label: string;
  icon: string;
  /** 탭 옆 숫자. 0 이거나 없으면 붙이지 않는다 */
  count?: number;
}

export function SubNav<T extends string>({ tabs, value, onChange, action, label }: {
  tabs: readonly SubNavTab<T>[];
  value: T;
  onChange: (next: T) => void;
  /** 우측 보조 동작 (ml-auto) */
  action?: ReactNode;
  /** nav 의 aria-label */
  label: string;
}) {
  return (
    <nav className="flex h-12 shrink-0 items-center gap-4 border-b border-border bg-surface px-4" aria-label={label}>
      <Tabs value={value} onValueChange={(next) => onChange(next as T)}>
        <TabsList variant="panel" className="bg-transparent">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id} variant="panel" className="text-caption">
              <Icon icon={t.icon} className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{t.label}</span>
              {t.count ? <span className="font-mono text-foreground-subtle">{t.count}</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
    </nav>
  );
}
