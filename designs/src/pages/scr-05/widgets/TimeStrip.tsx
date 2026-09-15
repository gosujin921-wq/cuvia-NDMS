/* ─────────────────────────────────────────────
 * 시간별 영향 — 기준 시각 · 눈금 칩 · 핵심 도달까지 남은 시간 (03 §21 · 사용자 재정비 2026-09-15)
 *
 * 세 가지만 말한다. 기준이 언제인가, 지금 어느 미래를 보고 있는가, 핵심 대상에 물이 닿기까지 얼마나 남았는가.
 * 유효 시각 · 도달 예상 +52분 · +20분 · 52분 남음 같은 상대·절대 표기를 한 카드에 섞지 않는다 — 시간 관계가 깨져 읽힌다.
 * 눈금은 예측판이 든 시각 그대로이고 사이 값을 만들지 않는다(IA §8).
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Button, cn } from "@ds";
import { formatClock } from "../../../lib/datetime";
import { minutesBetween } from "../../../lib/forecast-twin";

export interface TimeStripProps {
  baseTime: string;
  /** 눈금 유효시각들 — 예측판 marks 순서대로 */
  marks: string[];
  selected: string;
  onPick: (validAt: string) => void;
  /** 핵심 도달 — 첫 영향 대상과 그 도달 예상 시각. at 이 null 이면 예측 범위 안에 도달이 없다 */
  arrival?: { label: string; at: string | null } | null;
  /** 고른 대응의 시점 — "통제 시점 17:50". 도달과의 여유가 결정의 핵심이다. 결정 전에는 가정이다 */
  action?: { label: string; at: string } | null;
  /** 기록한 결정 — 어느 대응을(label) 언제(at) 결정했고 언제부터(startAt) 하는가. 선택 시각에 따라 예정·진행 중·경과로 말한다 */
  decision?: { label: string; at: string; startAt: string } | null;
  /** 눈금 아래 ◆ 마커 — 그 시각에 기록한 결정들 */
  markers?: { at: string; label: string }[];
}

export function TimeStrip({ baseTime, marks, selected, onPick, arrival, action, decision, markers = [] }: TimeStripProps) {
  const since = decision ? minutesBetween(new Date(decision.startAt), new Date(selected)) : null;
  const decisionMargin = decision && arrival?.at ? minutesBetween(new Date(decision.startAt), new Date(arrival.at)) : null;
  const remain = arrival?.at ? minutesBetween(new Date(selected), new Date(arrival.at)) : null;
  const margin = action && arrival?.at ? minutesBetween(new Date(action.at), new Date(arrival.at)) : null;
  return (
    <section className="flex flex-col gap-1.5 p-3" aria-label="시간별 영향">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-body font-semibold text-foreground">시간별 영향</h2>
        <span className="font-mono text-caption text-foreground-subtle">기준 {formatClock(baseTime)}</span>
      </header>
      {/* 기준 시각은 머리가 말한다 — 줄 안에 흐린 칩으로 두면 비활성 버튼으로 읽힌다 */}
      <div className="flex items-center gap-1">
        {marks.map((at) => (
          <Button key={at} size="sm" variant={at === selected ? "default" : "glass"} className="min-w-0 flex-1 px-1 font-mono text-caption" onClick={() => onPick(at)} aria-pressed={at === selected}>
            {formatClock(at)}
          </Button>
        ))}
      </div>
      {markers.length > 0 && (
        /* 칩과 같은 칸 나눔 — 결정한 시각 아래에 ◆ 와 대응 이름 */
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${marks.length}, minmax(0, 1fr))` }} aria-label="결정 마커">
          {marks.map((at) => {
            const here = markers.filter((m) => m.at === at);
            return (
              <span key={at} className="flex flex-col items-center leading-tight text-primary-text">
                {here.length > 0 && <Icon icon="mdi:cards-diamond" className="size-3.5" aria-hidden />}
                {here.length > 0 && <span className="truncate text-caption">{here[here.length - 1].label}</span>}
              </span>
            );
          })}
        </div>
      )}
      {arrival && arrival.at === null && (
        <p className="flex items-center gap-1.5 text-caption text-foreground-muted">
          <Icon icon="mdi:timer-off-outline" className="size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
          <span className="min-w-0 truncate">{arrival.label.replace(/ 예상$/, "")} 없음 · 예측 범위 안</span>
        </p>
      )}
      {arrival && arrival.at && remain !== null && (
        <p className="flex items-center gap-1.5 text-caption">
          <Icon icon="mdi:timer-outline" className="size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
          <span className="min-w-0 truncate text-foreground">{arrival.label} <span className="font-mono">{formatClock(arrival.at)}</span></span>
          <span className={cn("shrink-0 font-mono font-semibold", remain > 0 ? "text-warning" : remain === 0 ? "text-danger" : "text-foreground-subtle")}>
            {remain > 0 ? `${remain}분 남음` : remain === 0 ? "도달" : `${-remain}분 지남`}
          </span>
        </p>
      )}
      {decision && since !== null && (
        <p className="flex items-center gap-1.5 text-caption">
          <Icon icon="mdi:cards-diamond" className="size-3.5 shrink-0 text-primary-text" aria-hidden />
          <span className="min-w-0 truncate text-foreground">
            {decision.label} 결정 <span className="font-mono text-foreground-muted">{formatClock(decision.at)}</span> · 시작 <span className="font-mono">{formatClock(decision.startAt)}</span>
          </span>
          <span className={cn("shrink-0 font-mono font-semibold", since < 0 ? "text-foreground-muted" : "text-success")}>
            {since < 0 ? (decisionMargin !== null ? (decisionMargin > 0 ? `예정 · 도달 ${decisionMargin}분 전` : `예정 · 도달 ${-decisionMargin}분 뒤`) : "예정") : since === 0 ? "시작" : `진행 중 · ${since}분 경과`}
          </span>
        </p>
      )}
      {action && !decision && (
        <p className="flex items-center gap-1.5 text-caption">
          <Icon icon="mdi:shield-check-outline" className="size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
          <span className="min-w-0 truncate text-foreground">{action.label} <span className="font-mono">{formatClock(action.at)}</span></span>
          {margin !== null && (
            <span className={cn("shrink-0 font-mono font-semibold", margin > 0 ? "text-success" : "text-danger")}>{margin > 0 ? `도달 ${margin}분 전` : margin === 0 ? "도달과 동시" : `도달 ${-margin}분 뒤`}</span>
          )}
        </p>
      )}
    </section>
  );
}
