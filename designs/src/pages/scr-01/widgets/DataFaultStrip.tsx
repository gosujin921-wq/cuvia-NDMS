/* ─────────────────────────────────────────────
 * 데이터 장애 스트립 — 종합상황 좌측 얇은 줄 (초안 §2 · platform_web device-fault-strip 문법)
 *
 * 지연·결측·의심 원천이 없으면 "데이터 장애 없음" 한 줄을 그대로 남긴다 — 줄이 사라지면 레이아웃 높이가
 * 튄다. 있으면 원천 칩으로 세우고 넘치면 "외 n곳".
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Tag, cn } from "@ds";
import { dataFaultsAt } from "../../../model/selectors";
import { useScenario } from "../../../state/ScenarioProvider";

const SHOWN = 2;

export function DataFaultStrip() {
  const { demoNow: now } = useScenario();
  const faults = dataFaultsAt(now);
  const shown = faults.slice(0, SHOWN);
  return (
    <div className={cn("flex items-center gap-2 px-3 py-2", faults.length > 0 && "text-warning")} aria-label="데이터 장애">
      <Icon icon={faults.length > 0 ? "mdi:database-alert-outline" : "mdi:database-check-outline"} className={cn("size-4 shrink-0", faults.length > 0 ? "text-warning" : "text-foreground-subtle")} aria-hidden />
      {faults.length === 0 ? (
        <span className="text-caption text-foreground-muted">데이터 장애 없음</span>
      ) : (
        <>
          <span className="shrink-0 text-caption font-medium">데이터 장애 {faults.length}</span>
          {shown.map((f) => (
            <Tag key={f.subjectId} tone="warning" className="min-w-0 truncate">{f.label} · {f.quality}</Tag>
          ))}
          {faults.length > SHOWN && <span className="shrink-0 text-caption text-foreground-muted">외 {faults.length - SHOWN}곳</span>}
        </>
      )}
    </div>
  );
}
