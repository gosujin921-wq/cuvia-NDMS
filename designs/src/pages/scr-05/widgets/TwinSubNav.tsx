/* ─────────────────────────────────────────────
 * 디지털트윈 상단 탭 — 사건 │ 저장된 분석 (03 §26 · 2026-09-16 확정)
 *
 * ▸ 구조 정본: METIS `src/components/screens/system-monitoring/system-monitoring-sub-nav.tsx`
 *   (SCR-044 시스템 모니터링 · SCR-042 계정관리가 같은 문법). 거기와 같은 모양으로 짰다 —
 *   페이지 머리를 따로 두지 않고 **탭 줄 자체가 머리**이고, 높이 48px 한 줄에 좌측 탭 · 우측 보조 동작(ml-auto)이다.
 *   부품만 `@ds` 로 바꿨다(METIS 는 자체 Radix 프리미티브, NDMS 는 DS Tabs). 색도 NDMS 토큰이다.
 *
 * ▸ 다른 점 하나: METIS 는 자식 라우트 + `<Outlet/>` 로 탭을 가른다. NDMS 는 신규 라우트를 만들지 않으므로
 *   (CLAUDE.md · IA §5.2) query `tab` 이 그 자리를 맡는다. scr-02 의 `panel`, scr-04 의 `tab` 과 같은 문법이다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Tabs, TabsList, TabsTrigger } from "@ds";

export type TwinTab = "incidents" | "saved";

/* 모의훈련은 지난 사건에서 출발한다 — 진행 중 사건은 목록에 올리지 않고 재난관제의 전망 탭이 맡는다(README §2.3 · 03 §26.1) */
const TABS: readonly { id: TwinTab; label: string; icon: string }[] = [
  { id: "incidents", label: "훈련하기", icon: "mdi:play-box-outline" },
  { id: "saved", label: "지난 훈련", icon: "mdi:history" },
] as const;

export function TwinSubNav({ tab, onChange, counts, action }: {
  tab: TwinTab;
  onChange: (next: TwinTab) => void;
  /** 탭 옆 숫자 — 0 이면 붙이지 않는다 */
  counts?: Partial<Record<TwinTab, number>>;
  /** 우측 보조 동작 (ml-auto) */
  action?: React.ReactNode;
}) {
  return (
    <nav className="flex h-12 shrink-0 items-center gap-4 border-b border-border bg-surface px-4" aria-label="모의훈련 작업">
      <Tabs value={tab} onValueChange={(next) => onChange(next as TwinTab)}>
        <TabsList variant="panel" className="bg-transparent">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} variant="panel" className="text-caption">
              <Icon icon={t.icon} className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{t.label}</span>
              {counts?.[t.id] ? <span className="font-mono text-foreground-subtle">{counts[t.id]}</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
    </nav>
  );
}
