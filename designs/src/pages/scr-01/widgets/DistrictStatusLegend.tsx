/* ─────────────────────────────────────────────
 * 지구 상태 색상 기준표 — 지구 목록 푸터 (초안 §3 · CSMS SiteStatusLegend 문법)
 *
 * 같은 화면에 위험도 축(심각·경계·주의)과 지구 상태 축(위험·주의·정상)이 색 램프를 공유한다.
 * 이 범례가 어느 축을 말하는지부터 밝혀야 둘이 안 섞인다. 뜻은 툴팁으로 내린다.
 * ───────────────────────────────────────────── */

import { cn } from "@ds";
import { DISTRICT_STATUS_ORDER, DISTRICT_STATUS_TONE } from "../../../lib/status-tone";

export function DistrictStatusLegend() {
  return (
    <section className="flex items-center gap-3 px-3 py-2" aria-label="지구 상태 색상 기준">
      <h2 className="shrink-0 text-caption font-semibold text-foreground-muted">지구 상태</h2>
      <ul className="ml-auto flex items-center gap-3">
        {DISTRICT_STATUS_ORDER.map((s) => (
          <li key={s} className="flex items-center gap-1.5 text-caption text-foreground" title={DISTRICT_STATUS_TONE[s].meaning}>
            <span className={cn("size-2.5 shrink-0 rounded-sm", DISTRICT_STATUS_TONE[s].dot)} aria-hidden />
            {s}
          </li>
        ))}
      </ul>
    </section>
  );
}
