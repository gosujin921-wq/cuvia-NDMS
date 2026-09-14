/* ─────────────────────────────────────────────
 * 상단 상태 스트립 — 종합상황 (초안 §2 · CSMS StatusStrip · IDC KpiTiles 문법)
 *
 * 지도를 읽기 전에 만나는 한 줄: (심각 사건 배지) · 특보 배지 · 시각 · 위험 지구 · 주의 지구 · 대응중.
 * 심각 사건이 서면 맨 앞에 배지가 뜬다. 평상시에는 접어 둔다. 값은 전부 파생이며 표시만 한다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { GlassPanel, cn } from "@ds";
import { districtSummaryAt, officialAlertsAt, riskCountsAt } from "../../../model/selectors";
import { DISTRICT_STATUS_TONE } from "../../../lib/status-tone";
import { formatClock, formatDate } from "../../../lib/datetime";
import { useScenario } from "../../../state/ScenarioProvider";

export function StatusStrip() {
  const { demoNow: now } = useScenario();
  const s = districtSummaryAt(now);
  const r = riskCountsAt(now);
  const alerts = officialAlertsAt(now);

  return (
    <GlassPanel borderStyle="none" className="flex items-center gap-4 whitespace-nowrap rounded-full px-5 py-2" aria-label="진행 사건과 지구 현황 요약">
      {r.severe > 0 && (
        <>
          <span className="shrink-0 rounded-full border border-risk-lv5 px-2 py-0.5 text-caption font-medium text-risk-lv5">심각 사건 {r.severe}건 대응 필요</span>
          <Divider />
        </>
      )}
      {alerts.map((a) => (
        <span key={a.eventId} className={cn("shrink-0 rounded-full border px-2 py-0.5 text-caption font-medium", a.payload.level.includes("경보") ? "border-risk-lv4 text-risk-lv4" : "border-risk-lv3 text-risk-lv3")} title={`${a.sourceSystem} · ${formatClock(a.observedAt)} ${a.payload.change}`}>
          기상특보 · {a.payload.level}
        </span>
      ))}
      {alerts.length > 0 && <Divider />}

      <div className="flex shrink-0 items-center gap-2">
        <Icon icon="mdi:clock-outline" className="size-4 shrink-0 text-foreground-subtle" aria-hidden />
        <span className="font-mono text-body font-semibold tabular-nums text-foreground">{formatDate(now)} {formatClock(now)}</span>
      </div>
      <Divider />

      <Stat icon="mdi:alert-octagon-outline" label="위험 지구" value={s.danger} valueClass={s.danger > 0 ? DISTRICT_STATUS_TONE.위험.text : "text-foreground-muted"} iconToned={s.danger > 0} />
      <Stat icon="mdi:alert-outline" label="주의 지구" value={s.warning} valueClass={s.warning > 0 ? DISTRICT_STATUS_TONE.주의.text : "text-foreground-muted"} iconToned={s.warning > 0} />
      <Stat icon="mdi:progress-wrench" label="대응중" value={r.responding} valueClass={r.responding > 0 ? "text-foreground" : "text-foreground-muted"} />
    </GlassPanel>
  );
}

function Divider() {
  return <span className="h-6 w-px shrink-0 bg-border" aria-hidden />;
}

function Stat({ icon, label, value, valueClass, iconToned = false }: { icon: string; label: string; value: number; valueClass: string; iconToned?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2" title={label} aria-label={`${label} ${value}`}>
      <Icon icon={icon} className={cn("size-4 shrink-0", iconToned ? valueClass : "text-foreground-subtle")} aria-hidden />
      <span className="text-caption text-foreground-muted">{label}</span>
      <span className={cn("font-mono text-body font-semibold tabular-nums", valueClass)}>{value}</span>
    </div>
  );
}
