/* ─────────────────────────────────────────────
 * 조건 요약 카드 — 좌하단 공통 부품 (03 §21)
 *
 * A~F 는 날씨(강우·풍향·기온·조위)가 조건이라 날씨 카드가 선다. G 처럼 날씨가 원인이 아닌 유형은
 * 예측판이 든 조건 줄(장애 원인 · 전력 상태)을 보인다. 둘 다 있으면 조건 줄이 위, 날씨가 아래.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { cn } from "@ds";
import type { ConditionLine, PointTone } from "../../model/scene";
import { TwinWeather } from "../../pages/scr-05/widgets/TwinWeather";

const TONE: Record<PointTone, string> = { danger: "text-danger", warning: "text-warning", success: "text-success", neutral: "text-foreground", primary: "text-primary-text" };

export function ConditionSummary({ lines, districtId, showWeather = true }: { lines?: ConditionLine[]; districtId: string; /** 날씨가 조건인 유형만 */ showWeather?: boolean }) {
  return (
    <div className="flex flex-col">
      {lines && lines.length > 0 && (
        <section className="flex flex-col gap-1 p-3" aria-label="조건 요약">
          <header className="flex items-center gap-1.5">
            <Icon icon="mdi:tune-variant" className="size-4 text-foreground-subtle" aria-hidden />
            <h2 className="text-caption font-semibold text-foreground-muted">조건</h2>
          </header>
          <dl className="grid grid-cols-[64px_1fr] gap-x-2 gap-y-0.5 text-caption">
            {lines.map((l) => (
              <div key={l.label} className="contents">
                <dt className="text-foreground-muted">{l.label}</dt>
                <dd className={cn("truncate", TONE[l.tone ?? "neutral"])}>{l.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {showWeather && <div className={cn(lines && lines.length > 0 && "border-t border-border")}><TwinWeather districtId={districtId} /></div>}
    </div>
  );
}
