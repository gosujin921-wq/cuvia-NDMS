/* ─────────────────────────────────────────────
 * 지구 현황 카드 — 사건도 알림도 없는 지구를 열었을 때의 우측 판단 탭 (04 §3 · 2026-09-14 결정)
 *
 * Phase 1 재난관제가 하던 "이 지구의 장비와 지금 값" 확인을 잇는다. 사건·알림이 생기면 이 자리가 알림 카드·위험도
 * 카드로 바뀐다. 여기서 사건을 만들지 않는다 — 후보는 규칙이 만든다(IA §5.2 예외).
 * ───────────────────────────────────────────── */

import { Notice, StatusDotLabel } from "@ds";
import type { Incident } from "../../../model/incident";
import type { DataStatusRow } from "../../../model/selectors";
import { formatClock } from "../../../lib/datetime";

export function DistrictStatusCard({ incident, subjectCount, eventCount, lastReceivedAt, faults }: { incident: Incident; subjectCount: number; eventCount: number; lastReceivedAt: string | null; faults: DataStatusRow[] }) {
  return (
    <section className="flex flex-col gap-2 px-3 py-2.5" aria-label="지구 현황">
      <header className="flex items-baseline justify-between">
        <h2 className="text-body font-semibold text-foreground">지구 현황</h2>
        <span className="text-caption text-foreground-subtle">{lastReceivedAt ? `최근 수신 ${formatClock(lastReceivedAt)}` : "수신 없음"}</span>
      </header>
      <dl className="flex flex-col gap-1 text-caption">
        <div className="flex items-baseline gap-2"><dt className="w-[60px] shrink-0 text-foreground-subtle">범위</dt><dd className="min-w-0 flex-1 text-foreground">{incident.scope.label} · {incident.scope.kind}</dd></div>
        <div className="flex items-baseline gap-2"><dt className="w-[60px] shrink-0 text-foreground-subtle">감시 유형</dt><dd className="min-w-0 flex-1 text-foreground-muted">{incident.hazardKind}</dd></div>
        <div className="flex items-baseline gap-2"><dt className="w-[60px] shrink-0 text-foreground-subtle">주체</dt><dd className="min-w-0 flex-1 text-foreground-muted">센서·CCTV·시설 {subjectCount} · 이벤트 {eventCount}</dd></div>
        <div className="flex items-baseline gap-2"><dt className="w-[60px] shrink-0 text-foreground-subtle">담당</dt><dd className="min-w-0 flex-1 text-foreground-muted">{incident.ownership.organization} · {incident.ownership.officer}</dd></div>
        <div className="flex items-center gap-2"><dt className="w-[60px] shrink-0 text-foreground-subtle">데이터</dt><dd className="min-w-0 flex-1">{faults.length === 0 ? <StatusDotLabel status="success" label="장애 없음" /> : faults.map((f) => <StatusDotLabel key={f.subjectId} status={f.quality === "결측" ? "danger" : "pending"} label={`${f.label} ${f.quality}`} />)}</dd></div>
      </dl>
      <Notice inline variant="info" title="진행 중인 사건 없음 · 감시 대상 아님" description="관측이 알림 조건을 충족하면 알림이 서고, 후보 조건을 충족하면 규칙이 사건 후보를 만듭니다." />
    </section>
  );
}
