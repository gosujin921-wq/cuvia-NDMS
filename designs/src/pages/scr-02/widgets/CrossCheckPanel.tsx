/* ─────────────────────────────────────────────
 * 근거 — 사건 작업공간 좌 2 (IA §7 관련 이벤트 현황 · 초안 사건작업공간_화면상세 §7). Phase 1 교차검증 패널 자리
 *
 * 선택한 사건에 연결된 이벤트를 줄 단위로 세운다. 줄은 세 행이다: 종류 라벨 + 요약 + 관측시각 / 위치 · 출처 ·
 * 품질 · 확인 필요 / 연결 이유 (예측 줄만 [디지털트윈 보기]). 이벤트 계층(원천·파생·분석·업무)은 내부 분류라
 * 노출하지 않는다. 같은 지구의 미연결 이벤트는 접힌 구분 `지구의 다른 이벤트 n` 아래 흐리게 선다(결정 2026-09-14).
 *
 * 줄을 누르면 지도에서 그 주체를 강조하고, Forecast 줄은 같은 지도를 예측 모드로 바꾼다.
 * ───────────────────────────────────────────── */

import { useState } from "react";
import { Icon } from "@iconify/react";
import { Button, Tag, cn } from "@ds";
import type { EventEnvelope } from "../../../model/event";
import type { RelatedEventRow } from "../../../model/selectors";
import { EVIDENCE_KIND_ICON, evidenceKindOf } from "../../../lib/status-tone";
import { formatClock } from "../../../lib/datetime";

interface CrossCheckPanelProps {
  rows: RelatedEventRow[];
  selectedEventId: string | null;
  onSelect: (event: EventEnvelope) => void;
  onOpenForecast: (forecastId: string) => void;
}

export function CrossCheckPanel({ rows, selectedEventId, onSelect, onOpenForecast }: CrossCheckPanelProps) {
  const linked = rows.filter((r) => r.linked);
  const others = rows.filter((r) => !r.linked);
  const [othersOpen, setOthersOpen] = useState(false);

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 p-3" aria-label="근거">
      <header className="flex shrink-0 items-baseline justify-between gap-2">
        <h2 className="text-body font-semibold text-foreground">근거 <span className="font-normal text-foreground-muted">({linked.length})</span></h2>
        <span className="text-caption text-foreground-subtle">연결 {linked.length} · 미연결 {others.length}</span>
      </header>

      <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
        {linked.map((row) => (
          <Row key={row.event.eventId} row={row} selected={row.event.eventId === selectedEventId} onSelect={onSelect} onOpenForecast={onOpenForecast} />
        ))}
        {others.length > 0 && (
          <li className="mt-1">
            <button type="button" onClick={() => setOthersOpen((v) => !v)} className="flex w-full cursor-pointer items-center gap-1 border-none bg-transparent px-1 py-1 text-left text-caption font-medium text-foreground-subtle hover:text-foreground" aria-expanded={othersOpen}>
              <Icon icon="mdi:chevron-right" className={cn("size-4 transition-transform", othersOpen && "rotate-90")} aria-hidden />
              지구의 다른 이벤트 {others.length}
              <span className="ml-auto font-normal">사건에 연결되지 않음</span>
            </button>
          </li>
        )}
        {othersOpen && others.map((row) => (
          <Row key={row.event.eventId} row={row} selected={row.event.eventId === selectedEventId} onSelect={onSelect} onOpenForecast={onOpenForecast} muted />
        ))}
      </ul>
    </section>
  );
}

function Row({ row, selected, onSelect, onOpenForecast, muted }: { row: RelatedEventRow; selected: boolean; onSelect: (e: EventEnvelope) => void; onOpenForecast: (id: string) => void; muted?: boolean }) {
  const e = row.event;
  const kind = evidenceKindOf(e);
  const forecastId = e.eventType === "FORECAST_UPDATED" && e.incidentId ? (e.payload as { forecastIds?: string[] }).forecastIds?.[0] : undefined;
  const delayed = e.quality && e.quality !== "정상";
  return (
    <li
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border border-border bg-card px-2.5 py-2",
        selected && "ring-1 ring-inset ring-primary/60",
        muted && "opacity-60",
      )}
    >
      <button type="button" onClick={() => onSelect(e)} className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-left" title={`수신 ${formatClock(e.receivedAt)}`}>
        <Icon icon={EVIDENCE_KIND_ICON[kind]} className="size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
        <span className="w-[28px] shrink-0 text-caption font-medium text-foreground-muted">{kind}</span>
        <span className="min-w-0 flex-1 truncate text-caption text-foreground">{e.summary}</span>
        <span className="shrink-0 font-mono text-caption text-foreground-subtle">{formatClock(e.observedAt)}</span>
      </button>
      <div className="flex items-center gap-1.5 pl-5 text-caption text-foreground-subtle">
        <span className="min-w-0 truncate">{e.location?.label ?? e.subjectId} · {e.sourceSystem}{e.receivedAt !== e.observedAt && ` · 수신 ${formatClock(e.receivedAt)}`}</span>
        {delayed && <Tag tone={e.quality === "결측" ? "danger" : "warning"} className="shrink-0">{e.quality}</Tag>}
        {row.needsReview && <Tag tone="danger" className="shrink-0">확인 필요</Tag>}
      </div>
      <div className="flex items-center gap-1 pl-5 text-caption text-foreground-muted">
        <Icon icon="mdi:link-variant" className="size-3 shrink-0" aria-hidden />
        <span className="line-clamp-1">{muted ? "사건에 연결되지 않음 · 같은 지구" : row.linkReason}</span>
        {forecastId && !muted && (
          <Button size="sm" variant="secondary" className="ml-auto shrink-0" onClick={() => onOpenForecast(forecastId)}>
            디지털트윈 보기
          </Button>
        )}
      </div>
    </li>
  );
}
