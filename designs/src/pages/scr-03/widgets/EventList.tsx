/* ─────────────────────────────────────────────
 * 이벤트 카드 목록 — 03 화면정의서 §3 좌측
 *
 * 위험 신호가 잡힌 지구를 최신순으로 쌓는다. 카드를 누르면 지도·CCTV·그래프·기준표가
 * 그 이벤트 기준으로 갱신된다. 시연은 카드를 순서대로 넘기며 진행한다.
 *
 * 카드 문법은 KISA 관제 대시보드의 이벤트 현황 카드를 따른다
 * (cuvia_platform_web / features/dashboard-kisa/components/event-panel.tsx):
 *   테두리 카드(bg-card) → 헤더 행(단계·처리상태 뱃지) → 제목 행 → 메타 3줄(dl)
 *   · 진행 중 카드만 테두리가 danger 로 서고, 해제된 카드는 흐려진다
 *   · 선택된 카드는 링으로 세운다
 *   · 빈 값은 `-` 로 낸다 — "모른다"와 "없다"가 갈려야 한다
 * 담는 정보는 정본 §3 그대로다 — 지구명·장비명·타입·단계·발생/해제 일시·당시 측정값.
 * ───────────────────────────────────────────── */

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import {
  EmptyState,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
} from "@ds";
import { findDistrict } from "../../../demo/districts";
import { DEMO_NOW, type AlertEvent } from "../../../demo/events";
import { LevelBadge } from "../../../components/LevelBadge";
import { formatClock, formatRelative } from "../../../lib/datetime";

/**
 * 처리상태 탭 — KISA 이벤트 현황 패널의 상태 탭과 같은 구성이다(점 + 라벨 + 건수).
 *
 * KISA 는 미확인·대응중·종료 3단이지만 이 데모에는 확인·대응 절차가 없다(01 개요 §범위).
 * 남는 상태는 진행 중과 해제 둘이라 그 둘로 나눈다. 점 색은 event-kit 의
 * EVENT_STATUS_DOT 을 그대로 쓴다 — 진행 중은 danger, 끝난 것은 무채색.
 */
const STATUS_TABS = [
  { id: "active", label: "진행중", dot: "bg-danger" },
  { id: "cleared", label: "해제", dot: "bg-foreground-subtle" },
] as const;

type StatusTab = (typeof STATUS_TABS)[number]["id"];

interface EventListProps {
  events: AlertEvent[];
  selectedId: string;
  onSelect: (event: AlertEvent) => void;
}

export function EventList({ events, selectedId, onSelect }: EventListProps) {
  const [tab, setTab] = useState<StatusTab>("active");

  const byStatus = useMemo(() => {
    const map: Record<StatusTab, AlertEvent[]> = { active: [], cleared: [] };
    for (const event of events) map[event.clearedAt === null ? "active" : "cleared"].push(event);
    return map;
  }, [events]);

  /* 선택은 이 패널 밖에서도 온다(첫 진입 기본 선택·지도 마커). 그 이벤트가 다른 탭에
     있으면 탭이 따라간다 — 고른 카드가 안 보이는 탭에 숨어 있으면 안 된다 */
  useEffect(() => {
    const hit = events.find((event) => event.id === selectedId);
    if (hit) setTab(hit.clearedAt === null ? "active" : "cleared");
  }, [selectedId, events]);

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => setTab(next as StatusTab)}
      className="flex min-h-0 flex-1 flex-col p-3 pt-2"
    >
      <TabsList variant="panel" className="!h-9 w-full shrink-0 !gap-0.5 !p-0.5">
        {STATUS_TABS.map((status) => (
          <TabsTrigger
            key={status.id}
            value={status.id}
            variant="panel"
            className="gap-1 !px-2 !py-1 text-caption"
          >
            <span className={cn("size-1.5 shrink-0 rounded-full", status.dot)} aria-hidden />
            <span>{status.label}</span>
            <span className="font-mono text-foreground-muted">{byStatus[status.id].length}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {STATUS_TABS.map((status) => (
        <TabsContent
          key={status.id}
          value={status.id}
          className="mt-2 min-h-0 flex-1 overflow-y-auto"
        >
          {byStatus[status.id].length === 0 ? (
            <EmptyState
              variant="inline"
              icon="mdi:inbox-outline"
              message={`${status.label} 이벤트가 없습니다`}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {byStatus[status.id].map((event) => (
                <li key={event.id}>
                  <EventCard
                    event={event}
                    selected={event.id === selectedId}
                    onClick={() => onSelect(event)}
                  />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function EventCard({
  event,
  selected,
  onClick,
}: {
  event: AlertEvent;
  selected: boolean;
  onClick: () => void;
}) {
  const district = findDistrict(event.districtId);
  const active = event.clearedAt === null;

  /* 선택은 이 목록 밖에서도 온다(첫 진입 기본 선택). 그 카드가 스크롤 밖이면 끌어온다 */
  const cardRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (selected) cardRef.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "w-full cursor-pointer rounded-lg border bg-card p-3 text-left transition-colors",
        active ? "border-danger/60" : "border-border hover:border-foreground-subtle",
        selected && "border-primary-text/60 ring-1 ring-primary-text/40",
        !active && "opacity-60",
      )}
    >
      {/* 헤더 — 단계와 처리상태 */}
      <div className="flex items-center gap-2">
        <LevelBadge level={event.level} />
        <StatusBadge
          status={active ? "live" : "done"}
          label={active ? "진행중" : "해제"}
          className="ml-auto shrink-0"
        />
      </div>

      {/* 제목 — 어느 지구의 무슨 이벤트인가 */}
      <div className="mt-2 truncate text-body font-semibold leading-snug text-foreground">
        {district?.name ?? "-"} {event.type}
      </div>

      {/* 메타 — 위치 · 탐지 장비 · 측정값과 시각 */}
      <dl className="mt-1.5 flex flex-col gap-0.5">
        <MetaRow icon="mdi:map-marker" label="위치">
          <span className="truncate">{district?.target || "-"}</span>
        </MetaRow>
        <MetaRow icon="mdi:access-point" label="탐지">
          <span className="truncate">{event.device || "-"}</span>
        </MetaRow>
        <MetaRow icon="mdi:gauge" label="측정">
          <span className="shrink-0 font-mono">
            {event.value}
            <span className="ml-1 text-foreground-subtle">{event.unit}</span>
          </span>
          {/* 진행 중은 경과 시간, 해제된 이벤트는 해제 시각 (정본 §3 동작) */}
          <span className="ml-auto shrink-0 truncate font-mono text-foreground-muted">
            {active
              ? `${formatClock(event.raisedAt)} · ${formatRelative(event.raisedAt, DEMO_NOW)}`
              : `${formatClock(event.clearedAt as string)} 해제`}
          </span>
        </MetaRow>
      </dl>
    </button>
  );
}

function MetaRow({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 text-caption">
      <Icon icon={icon} className="size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
      <dt className="shrink-0 text-foreground-muted">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center gap-1.5 text-foreground">{children}</dd>
    </div>
  );
}
