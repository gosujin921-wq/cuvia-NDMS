/* ─────────────────────────────────────────────
 * 상단 상태 스트립 — 종합상황 (초안 §2 · CSMS StatusStrip · IDC KpiTiles 문법)
 *
 * 지도를 읽기 전에 만나는 한 줄: (심각 사건 배지) · 특보 배지 · 시각 · 데이터 장애.
 * 심각 사건이 서면 맨 앞에 배지가 뜬다. 평상시에는 접어 둔다. 값은 전부 파생이며 표시만 한다.
 *
 * 위험 지구·주의 지구·대응중 숫자는 뺐다(사용자 지시, 2026-09-14) — 좌측 지구 현황·우측 위험 현황이 같은
 * 값을 이미 든다. 그 자리에 데이터 장애를 올렸다. 지연·결측·의심 원천이 없으면 "데이터 장애 없음" 을 그대로
 * 남긴다 — 항목이 사라지면 캡슐 폭이 튄다. 있으면 원천 칩으로 세우고 넘치면 "외 n곳".
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { GlassPanel, Tag, cn } from "@ds";
import { dataFaultsAt, officialAlertsAt, riskCountsAt } from "../../../model/selectors";
import { formatClock, formatDate } from "../../../lib/datetime";
import { useScenario } from "../../../state/ScenarioProvider";

/** 캡슐에 세우는 장애 원천 칩 수 — 넘치면 "외 n곳" */
const FAULTS_SHOWN = 2;

export function StatusStrip() {
  const { demoNow: now } = useScenario();
  const r = riskCountsAt(now);
  const alerts = officialAlertsAt(now);
  const faults = dataFaultsAt(now);
  const shownFaults = faults.slice(0, FAULTS_SHOWN);

  return (
    <GlassPanel borderStyle="none" className="flex items-center gap-4 whitespace-nowrap rounded-full px-5 py-2" aria-label="특보 · 시각 · 데이터 장애 요약">
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

      <div className={cn("flex min-w-0 items-center gap-2", faults.length > 0 && "text-warning")} aria-label="데이터 장애">
        <Icon icon={faults.length > 0 ? "mdi:database-alert-outline" : "mdi:database-check-outline"} className={cn("size-4 shrink-0", faults.length > 0 ? "text-warning" : "text-foreground-subtle")} aria-hidden />
        {faults.length === 0 ? (
          <span className="text-caption text-foreground-muted">데이터 장애 없음</span>
        ) : (
          <>
            <span className="shrink-0 text-caption font-medium">데이터 장애 {faults.length}</span>
            {shownFaults.map((f) => (
              <Tag key={f.subjectId} tone="warning" className="min-w-0 truncate">{f.label} · {f.quality}</Tag>
            ))}
            {faults.length > FAULTS_SHOWN && <span className="shrink-0 text-caption text-foreground-muted">외 {faults.length - FAULTS_SHOWN}곳</span>}
          </>
        )}
      </div>
    </GlassPanel>
  );
}

function Divider() {
  return <span className="h-6 w-px shrink-0 bg-border" aria-hidden />;
}
