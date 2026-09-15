/* ─────────────────────────────────────────────
 * 지구 현황 — 종합상황 좌 1 (초안 §2 · CSMS SiteSummaryCard 문법)
 *
 * 담당자가 지도를 읽기 전에 만나는 네 숫자: 전체 지구 · 온라인 CCTV · 위험 지구 · 주의 지구.
 * 숫자는 전부 파생이다(selectors.districtSummaryAt). 위험·주의는 관측 낱개가 아니라 사건에서 나온다.
 * ───────────────────────────────────────────── */

import { cn } from "@ds";
import { districtSummaryAt } from "../../../model/selectors";
import { DISTRICT_STATUS_TONE } from "../../../lib/status-tone";
import { useScenario } from "../../../state/ScenarioProvider";

export function DistrictSummaryCard() {
  const { demoNow: now } = useScenario();
  const s = districtSummaryAt(now);
  return (
    <section className="flex flex-col gap-2.5 p-3" aria-label="지구 현황">
      <h2 className="text-body font-semibold text-foreground">지구 현황</h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        <Stat label="전체 지구" value={s.total} unit="곳" />
        <Stat label="온라인 CCTV" value={s.onlineCctv} unit="대" />
        {/* 위험 지구 = 심각·경계 지구 수. 점은 램프 맨 위 색 */}
        <Stat label="위험 지구" value={s.danger} unit="곳" dot={DISTRICT_STATUS_TONE.심각.dot} valueClass={s.danger > 0 ? DISTRICT_STATUS_TONE.심각.text : undefined} />
        <Stat label="주의 지구" value={s.warning} unit="곳" dot={DISTRICT_STATUS_TONE.주의.dot} valueClass={s.warning > 0 ? DISTRICT_STATUS_TONE.주의.text : undefined} />
      </dl>
    </section>
  );
}

function Stat({ label, value, unit, dot, valueClass }: { label: string; value: number; unit: string; dot?: string; valueClass?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="flex items-center gap-1.5 text-caption text-foreground-muted">
        {dot && <span className={cn("size-2 shrink-0 rounded-full", dot)} aria-hidden />}
        {label}
      </dt>
      <dd className={cn("font-mono text-h5 font-semibold leading-none tabular-nums text-foreground", valueClass)}>
        {value}
        <span className="ml-0.5 font-sans text-caption font-normal text-foreground-subtle">{unit}</span>
      </dd>
    </div>
  );
}
