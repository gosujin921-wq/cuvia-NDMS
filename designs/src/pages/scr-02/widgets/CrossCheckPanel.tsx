/* ─────────────────────────────────────────────
 * 근거 — 사건 작업공간 좌 2 (IA §7 관련 이벤트 현황 · 초안 사건작업공간_화면상세 §7). Phase 1 교차검증 패널 자리
 *
 * 선택한 사건에 연결된 이벤트를 줄 단위로 세운다. 줄은 두 행이다: 종류 + 무슨 일 + 관측시각 / 어디서 · 품질 · [확인] ·
 * [전망 보기]. 왜 묶였는지(연결 이유)는 선택한 줄에서만 셋째 행으로 펼친다. 출처 기관·수신시각은 툴팁이다.
 * 이벤트 계층(원천·파생·분석·업무)은 내부 분류라 노출하지 않는다.
 * ★ 상태와 행위는 다른 모양이다(2026-09-14 사용자 지적). 품질(지연·결측·의심)은 점 라벨 — 데이터의 상태다.
 *   확인 요청은 버튼 [확인] — 담당자가 할 일이다. 누르면 그 주체를 지도·영상으로 연다(영상이면 큰 보기).
 *   연결 이유는 두 줄까지 보이고 전문은 툴팁이다. 같은 지구의 미연결 이벤트는 접힌 구분 `지구의 다른 이벤트 n` 아래 흐리게 선다(결정 2026-09-14).
 *
 * 줄을 누르면 지도에서 그 주체를 강조하고, Forecast 줄은 같은 지도를 예측 모드로 바꾼다.
 * ───────────────────────────────────────────── */

import { useState } from "react";
import { Icon } from "@iconify/react";
import { Button, StatusDotLabel, cn } from "@ds";
import type { EventEnvelope } from "../../../model/event";
import type { RelatedEventRow } from "../../../model/selectors";
import { EVIDENCE_KIND_ICON, evidenceKindOf } from "../../../lib/status-tone";
import { formatClock } from "../../../lib/datetime";
import { EvidenceHelp } from "./EvidenceHelp";

interface CrossCheckPanelProps {
  rows: RelatedEventRow[];
  selectedEventId: string | null;
  /** 위험도 카드의 기여도 줄이 가리킨 이벤트 — 강조 + `위험 요인` 표시. 해석은 우측, 사실은 좌측 */
  riskEventIds?: Set<string>;
  /** 우측에서 고른 지표 이름 — 머리에 `수위·변화율 근거` 로 적는다 */
  onSelect: (event: EventEnvelope) => void;
  onOpenForecast: (forecastId: string) => void;
}

export function CrossCheckPanel({ rows, selectedEventId, riskEventIds, onSelect, onOpenForecast }: CrossCheckPanelProps) {
  /* 위험도에 쓰인 것만 — 우측 위험도 카드가 근거를 다시 그리지 않는 대신 여기서 거른다 (2026-09-14) */
  const [riskOnly, setRiskOnly] = useState(false);
  const riskCount = rows.filter((r) => r.linked && (riskEventIds?.has(r.event.eventId) ?? false)).length;
  const linked = rows.filter((r) => r.linked && (!riskOnly || (riskEventIds?.has(r.event.eventId) ?? false)));
  const others = rows.filter((r) => !r.linked);
  const [othersOpen, setOthersOpen] = useState(false);

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 p-3" aria-label="근거">
      <header className="flex shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <h2 className="text-body font-semibold text-foreground">근거 <span className="font-normal text-foreground-muted">({linked.length})</span></h2>
          <EvidenceHelp />
        </div>
        {riskCount > 0 ? (
          <button type="button" onClick={() => setRiskOnly((v) => !v)} aria-pressed={riskOnly} className={cn("cursor-pointer rounded border-none bg-transparent px-1.5 py-0.5 text-caption hover:text-foreground", riskOnly ? "bg-surface-raised text-foreground" : "text-foreground-subtle")}>
            {riskOnly ? "전체 보기" : `위험도에 쓰인 ${riskCount}건만`}
          </button>
        ) : (
          <span className="text-caption text-foreground-subtle">연결 {linked.length} · 미연결 {others.length}</span>
        )}
      </header>

      <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
        {linked.map((row) => (
          <Row key={row.event.eventId} row={row} selected={row.event.eventId === selectedEventId} dimmed={false} onSelect={onSelect} onOpenForecast={onOpenForecast} />
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

function Row({ row, selected, dimmed = false, onSelect, onOpenForecast, muted }: { row: RelatedEventRow; selected: boolean; dimmed?: boolean; onSelect: (e: EventEnvelope) => void; onOpenForecast: (id: string) => void; muted?: boolean }) {
  const e = row.event;
  const kind = evidenceKindOf(e);
  const forecastId = e.eventType === "FORECAST_UPDATED" && e.incidentId ? (e.payload as { forecastIds?: string[] }).forecastIds?.[0] : undefined;
  const delayed = e.quality && e.quality !== "정상";
  /* 두 행이 기본이다: 무슨 일·언제 / 어디서·상태·행위. 연결 이유는 선택한 줄에서만 펼친다(2026-09-14 "카드가 복잡하다").
     줄마다 [확인]을 두지 않는다 — 담당자의 결정은 오탐이냐 대응이냐 둘이고 영상은 대응 팝업에 크게 뜬다 (2026-09-14) */
  return (
    <li
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border border-border bg-card px-2.5 py-1.5",
        selected && "ring-1 ring-inset ring-primary/60",
        (muted || dimmed) && "opacity-60",
      )}
    >
      <button type="button" onClick={() => onSelect(e)} className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-left" title={e.receivedAt !== e.observedAt ? `수신 ${formatClock(e.receivedAt)}` : undefined}>
        <Icon icon={EVIDENCE_KIND_ICON[kind]} className="size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
        <span className="w-[36px] shrink-0 whitespace-nowrap text-caption font-medium text-foreground-muted">{kind}</span>
        <span className="min-w-0 flex-1 truncate text-caption text-foreground">{e.summary}</span>
        <span className="shrink-0 font-mono text-caption text-foreground-subtle">{formatClock(e.observedAt)}</span>
      </button>
      <div className="flex items-center gap-1.5 pl-5 text-caption text-foreground-subtle">
        <span className="min-w-0 flex-1 truncate">{e.location?.label ?? e.subjectId}</span>
        {delayed && <StatusDotLabel status={e.quality === "결측" ? "danger" : "pending"} label={e.quality ?? ""} className="shrink-0" />}
        {forecastId && !muted && (
          <Button size="sm" variant="outline" className="h-6 shrink-0 px-2 text-foreground" onClick={() => onOpenForecast(forecastId)}>
            <Icon icon="mdi:cube-scan" className="size-3.5" aria-hidden />
            전망 보기
          </Button>
        )}
      </div>
      {selected && !muted && (
        <div className="flex items-start gap-1 pl-5 pt-0.5 text-caption text-foreground-muted">
          <Icon icon="mdi:link-variant" className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{row.linkReason}</span>
        </div>
      )}
    </li>
  );
}
