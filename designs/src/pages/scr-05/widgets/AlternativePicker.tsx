/* ─────────────────────────────────────────────
 * 대응 비교 — 현재 조건 대 대안 하나를 고른다 (03 §21 · 사용자 재정비 2026-09-15)
 *
 * 버튼은 "무엇을 적용하는가"이고 그 아래 한 줄은 "그러면 무엇이 바뀌는가"다. "기준 그대로 · 17:10 예측판" 같은
 * 내부 구조 설명은 두지 않는다. 대안은 사전 작성 예측판이며 여기서 계산하지 않는다.
 * ───────────────────────────────────────────── */

import { Button } from "@ds";
import { ALTERNATIVE_LABEL, type AlternativeId, type Forecast } from "../../../model/forecast";

export function AlternativePicker({ baseline, alternatives, selected, onPick, decided }: {
  baseline: Forecast;
  alternatives: Forecast[];
  selected: Forecast;
  /** null 이면 현재 조건 */
  onPick: (forecast: Forecast | null) => void;
  /** 결정 기록으로 확정한 대응 — 그 버튼에만 표식이 붙는다. 나머지는 여전히 미리보기다 */
  decided?: AlternativeId | null;
}) {
  const isBase = selected.forecastId === baseline.forecastId;
  const isDecided = decided !== null && decided !== undefined && decided === selected.alternativeId;
  return (
    <section className="flex flex-col gap-1.5 p-3" aria-label="대응 비교">
      <h2 className="text-body font-semibold text-foreground">대응 비교</h2>
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant={isBase ? "default" : "glass"} onClick={() => onPick(null)} aria-pressed={isBase}>{ALTERNATIVE_LABEL.baseline}</Button>
        {alternatives.map((a) => (
          <Button key={a.forecastId} size="sm" variant={selected.forecastId === a.forecastId ? "default" : "glass"} onClick={() => onPick(a)} aria-pressed={selected.forecastId === a.forecastId}>
            {ALTERNATIVE_LABEL[a.alternativeId]}{decided === a.alternativeId && " · 결정"}
          </Button>
        ))}
      </div>
      {/* 결정 전에는 가정이다 — "…하는 경우". 결정한 대응만 "결정"으로 말한다 */}
      {!isBase && (
        <p className="text-caption text-foreground-muted">
          <span className="font-semibold text-foreground">{ALTERNATIVE_LABEL[selected.alternativeId]} {isDecided ? "결정" : "가정"}</span> · {selected.hypothesis ?? `${selected.changedConditions.join(" · ")}인 경우`}
        </p>
      )}
    </section>
  );
}
