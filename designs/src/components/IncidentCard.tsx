/* ─────────────────────────────────────────────
 * 사건 카드 — 실시간 주요 사건(scr-01)이 쓴다. CSMS components/SituationCard 문법 그대로
 *
 * 위험도 배지 · 제목 · (감지 · 확인 필요 · 오인 배지) / 지구 · 장비 · 시각 / SOP 진행률 또는 상태 문구.
 * 카드 자체는 깜빡이지 않는다. 메인 사건이 진행 중인 동안 위험도 색 1px 테두리 + 반투명 후광만.
 * 판단 전(등급 없음)은 위험도 배지를 그리지 않는다 — 값을 지어내지 않는다(platform_web toRiskLevel 규칙).
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Badge, StatusBadge, cn } from "@ds";
import type { FeedItem } from "../model/selectors";
import { RISK_GRADE_TONE, PROCESS_BADGE, processBucket } from "../lib/status-tone";
import { findDistrict } from "../demo/districts";
import { formatClock } from "../lib/datetime";

export function IncidentCard({ item, highlighted, onOpen }: { item: FeedItem; highlighted: boolean; onOpen: () => void }) {
  const tone = item.grade ? RISK_GRADE_TONE[item.grade] : null;
  const district = item.districtId ? findDistrict(item.districtId) : undefined;
  const bucket = item.process ? processBucket(item.process) : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full cursor-pointer flex-col gap-1.5 rounded-md border bg-row-zebra py-2 pl-2.5 pr-2 text-left transition-[background-color,border-color,box-shadow] duration-300 hover:border-border-light hover:bg-surface-raised",
        highlighted && tone ? cn("ring-2", tone.stroke, tone.halo) : "border-border",
        !item.active && "opacity-60",
      )}
      aria-label={`${item.grade ?? ""} ${item.title} ${item.needsAck ? "확인 필요" : "상세 열기"}`}
    >
      <span className="flex items-center gap-1.5">
        {tone && item.grade && <Badge variant={tone.badge} className="shrink-0">{item.grade}</Badge>}
        <span className="min-w-0 flex-1 truncate text-body font-semibold text-foreground">{item.title}</span>
        {item.kind === "감지" && <Badge variant="gray" className="shrink-0">감지</Badge>}
        {item.needsAck && <Badge variant="red" className="shrink-0">확인 필요</Badge>}
        {item.process === "오탐" && <Badge variant="yellow" className="shrink-0">오인</Badge>}
        {bucket && !item.needsAck && item.process !== "오탐" && <StatusBadge status={PROCESS_BADGE[bucket]} label={bucket} showDot={false} className="shrink-0" />}
      </span>
      <span className="flex items-center gap-1 text-caption text-foreground-muted">
        <span className="min-w-0 truncate">{district?.name ?? "-"} · {item.subjectLabel}</span>
        <span className="shrink-0 text-foreground-subtle">·</span>
        <span className="shrink-0 font-mono">{formatClock(item.at)}</span>
      </span>
      {item.sop ? (
        <SopProgress done={item.sop.done} total={item.sop.total} />
      ) : (
        <span className="flex items-center gap-1 text-caption text-foreground-muted">
          {item.kind === "감지" && <Icon icon="mdi:radar" className="size-3 shrink-0 text-primary-text" aria-hidden />}
          {item.statusText}
        </span>
      )}
    </button>
  );
}

/** SOP 진행률 트랙바 — CSMS decision-popup sop-section 과 같은 규칙 */
function SopProgress({ done, total }: { done: number; total: number }) {
  const percent = Math.round((done / total) * 100);
  return (
    <span className="flex items-center gap-2" aria-label={`SOP 대응 ${done}/${total}건 완료`}>
      <span className="shrink-0 text-caption text-foreground-muted">SOP {done}/{total}</span>
      <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-fill-subtle" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <span className="block h-full rounded-full bg-primary-text transition-all duration-300" style={{ width: `${percent}%` }} />
      </span>
      <span className="shrink-0 font-mono text-caption text-foreground-muted">{percent}%</span>
    </span>
  );
}
