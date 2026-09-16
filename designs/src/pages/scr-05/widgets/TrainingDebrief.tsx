/* ─────────────────────────────────────────────
 * 강평 — 훈련이 끝나고 남는 것 (03 §26.7·§26.8 · 2026-09-16 v2)
 *
 * ★ 주 비교는 **같은 조건 안에서** 한다. `실제와 같게 했을 때` ↔ `내 조치`.
 *   조건과 조치를 동시에 바꾼 비교로 원인을 말하지 않는다(칸마다 한 가지씩만 달라진다).
 * ★ **"나아졌다"와 "막았다"를 구분한다.** 기준 수위를 안 넘었을 때만 성공으로 말한다.
 * ★ 규정 준수는 **양호·지연으로 판정하지 않는다** — 목표 시간의 근거가 없다.
 *   발동에서 조치까지 걸린 시간과 실제와의 차이만 적는다.
 * ───────────────────────────────────────────── */

import { Button, cn } from "@ds";
import { Icon } from "@iconify/react";
import { formatClock } from "../../../lib/datetime";
import { formatMarkMetric, markMetricLabel, minutesBetween } from "../../../lib/forecast-twin";
import { arrivalAtOf } from "../../../lib/forecast-compare";
import type { Forecast } from "../../../model/forecast";
import type { ImprovementAxis, ImprovementItem, WhatIfCase } from "../../../model/whatif";
import { ImprovementCard } from "./ImprovementCard";

/** 그 판의 최고 지표 눈금 */
const peakOf = (f: Forecast) => f.marks.reduce((a, x) => ((x.metric?.value ?? x.maxDepthM) > (a.metric?.value ?? a.maxDepthM) ? x : a), f.marks[0]);
/** 기준 초과 시각 — 없으면 "없음" */
const crossOf = (f: Forecast) => { const at = arrivalAtOf(f); return at ? formatClock(at) : "없음"; };
/** 사람 대상의 상태 */
const exposureOf = (f: Forecast) => f.targets.find((x) => x.kind === "대상자")?.exposure ?? "-";

/** 강평 표의 행 — 저장 기록도 이 값을 그대로 담는다(판을 고쳐도 과거 훈련이 안 바뀐다) */
export function debriefRowsOf(mine: Forecast | null, base: Forecast | null): { label: string; base: string; mine: string }[] {
  if (!base) return [];
  const my = mine ?? base;
  const bp = peakOf(base), mp = peakOf(my);
  return [
    { label: `${markMetricLabel(bp)} · 최고`, base: formatMarkMetric(bp), mine: formatMarkMetric(mp) },
    { label: "기준 초과 시각", base: crossOf(base), mine: crossOf(my) },
    { label: "천변도로 이용자", base: exposureOf(base), mine: exposureOf(my) },
  ];
}

/** 결론 한 줄 — "나아졌다"와 "막았다"를 구분한다 */
export function debriefHeadline(mine: Forecast | null, base: Forecast | null, condLabel: string, noAct: boolean): string {
  if (!base) return "";
  const my = mine ?? base;
  const bp = peakOf(base), mp = peakOf(my);
  const bv = bp.metric?.value ?? bp.maxDepthM, mv = mp.metric?.value ?? mp.maxDepthM;
  const held = crossOf(my) === "없음";
  const bc = arrivalAtOf(base), mc = arrivalAtOf(my);
  const delay = bc && mc ? minutesBetween(bc, mc) : null;
  if (noAct) return "실제와 같은 시각에 조치했으므로 결과가 달라지지 않았습니다.";
  if (held) return `조치를 앞당긴 결과 기준 수위를 넘지 않았습니다. 같은 조건(강우 ${condLabel})에서 실제와 같게 했을 때와 견준 것이라, 차이는 조치에서만 왔습니다.`;
  if (mv < bv) return `최고 수위가 ${Number((bv - mv).toFixed(1))} m 낮아지고 초과가 ${delay ?? 0}분 늦어졌지만, 여전히 기준을 넘었습니다. 이 조건에서는 그 조치만으로 막지 못합니다.`;
  return "조치를 했지만 이 조건에서는 나아지지 않았습니다.";
}

export function TrainingDebrief({ wcase, condLabel, acts, mine, base, improvements, onAddImprovement, onRemoveImprovement, onSave, saved }: {
  wcase: WhatIfCase;
  condLabel: string;
  acts: Record<string, string>;
  /** 내 조치가 만든 판 · 같은 조건에서 실제와 같게 했을 때의 판 */
  mine: Forecast | null;
  base: Forecast | null;
  improvements: ImprovementItem[];
  onAddImprovement: (axis: ImprovementAxis, text: string) => void;
  onRemoveImprovement: (id: string) => void;
  onSave: () => void;
  /** 저장했으면 그 번호 */
  saved: string | null;
}) {
  if (!base) {
    return (
      <section className="p-3">
        <p className="break-keep text-caption text-foreground-muted">이 조건과 조치 조합은 계산한 판이 없습니다. 아무 판이나 대신 보이지 않습니다.</p>
      </section>
    );
  }
  const my = mine ?? base;
  const noAct = Object.keys(acts).length === 0;
  const basePeak = peakOf(base), myPeak = peakOf(my);
  const baseV = basePeak.metric?.value ?? basePeak.maxDepthM, myV = myPeak.metric?.value ?? myPeak.maxDepthM;
  const better = myV < baseV;
  const held = crossOf(my) === "없음";
  const baseCross = arrivalAtOf(base), myCross = arrivalAtOf(my);
  const delay = baseCross && myCross ? minutesBetween(baseCross, myCross) : null;

  const rows = [
    { label: `${markMetricLabel(basePeak)} · 최고`, a: formatMarkMetric(basePeak), b: formatMarkMetric(myPeak), good: better },
    { label: "기준 초과 시각", a: crossOf(base), b: crossOf(my), good: held || (delay !== null && delay > 0) },
    { label: "천변도로 이용자", a: exposureOf(base), b: exposureOf(my), good: exposureOf(my) !== exposureOf(base) },
  ];
  /* 개선 항목에 자동으로 붙는 맥락 — 사람이 다시 적지 않는다 */
  const context = [wcase.title, `강우 ${condLabel}`,
    Object.keys(acts).length > 0
      ? (wcase.sop ?? []).filter((s) => acts[s.id]).map((s) => `${s.id} ${minutesBetween(s.firedAt, acts[s.id])}분`).join(" · ")
      : "조치 없음",
  ].join(" · ");

  return (
    <>
      <section className="flex flex-col gap-2 p-3" aria-label="내 조치가 만든 차이">
        <header className="flex items-baseline justify-between gap-2">
          <h2 className="text-body font-semibold text-foreground">내 조치가 만든 차이</h2>
          <span className="shrink-0 text-caption text-foreground-subtle">둘 다 강우 {condLabel}</span>
        </header>
        <p className="break-keep text-caption text-foreground-subtle">
          기준은 <span className="text-foreground-muted">실제와 같은 시각에 했을 때</span>입니다
        </p>
        {noAct && (
          <p className="break-keep rounded-md border border-warning bg-card px-2 py-1.5 text-caption leading-snug text-warning">
            조치를 하나도 실행하지 않아 <span className="font-semibold">실제와 똑같은 훈련</span>이 되었습니다. 두 열이 같습니다
          </p>
        )}

        <div className="grid grid-cols-[1fr_minmax(0,1fr)_minmax(0,1fr)] items-start gap-x-2 gap-y-1 rounded-md border border-border bg-card px-2.5 py-2 text-caption">
          <span />
          <span className="text-right font-semibold text-foreground-muted">실제와 같게</span>
          <span className="text-right font-semibold text-primary-text">내 훈련</span>
          {rows.map((r) => (
            <span key={r.label} className="contents">
              <span className="min-w-0 break-keep leading-tight text-foreground-muted">{r.label}</span>
              <span className="text-right font-mono leading-tight text-foreground-muted">{r.a}</span>
              <span className={cn("text-right font-mono font-semibold leading-tight", r.a === r.b ? "text-foreground-muted" : r.good ? "text-success" : "text-warning")}>{r.b}</span>
            </span>
          ))}
        </div>

        {/* 결론 — "나아졌다"와 "막았다"를 구분한다.
            저장 기록도 같은 문장을 담으므로 `debriefHeadline` 한 벌만 쓴다(두 벌이면 한쪽만 고쳐진다) */}
        <p className={cn("break-keep text-caption leading-snug", held ? "text-success" : "text-warning")}>
          {debriefHeadline(mine, base, condLabel, noAct)}
        </p>
      </section>

      <section className="flex flex-col gap-1.5 p-3" aria-label="발동에서 조치까지">
        <header className="flex items-baseline justify-between gap-2">
          <h2 className="text-body font-semibold text-foreground">발동에서 조치까지</h2>
          <span className="shrink-0 text-caption text-foreground-subtle">실제와 견줌</span>
        </header>
        <ul className="flex flex-col text-caption">
          {(wcase.sop ?? []).map((s) => {
            const at = acts[s.id];
            const mineLag = at ? minutesBetween(s.firedAt, at) : null;
            const realLag = s.actedAt ? minutesBetween(s.firedAt, s.actedAt) : null;
            return (
              <li key={s.id} className="flex items-baseline justify-between gap-2 border-b border-border py-1 last:border-0">
                <span className="min-w-0 break-keep text-foreground">{s.id} {s.label}</span>
                <span className="shrink-0 text-right font-mono text-foreground-subtle">
                  {mineLag !== null
                    ? <><span className="font-semibold text-foreground">{mineLag}분</span> · 실제 {realLag}분</>
                    : <>안 함 · 실제와 같게({realLag}분)</>}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="break-keep text-caption text-foreground-subtle">
          목표 시간 기준이 없어 <span className="text-foreground-muted">양호·지연으로 판정하지 않습니다</span>
        </p>
      </section>

      {/* 고칠 거리 — 훈련의 산출물. 사람이 적고 시스템은 맥락만 붙인다(03 §26.8) */}
      <ImprovementCard
        items={improvements}
        context={context}
        canAdd
        onAdd={(axis, text) => onAddImprovement(axis, text)}
        onRemove={onRemoveImprovement}
      />

      <section className="flex flex-col gap-2 p-3" aria-label="훈련 저장">
        {saved ? (
          <p className="break-keep text-caption text-success">
            훈련을 저장했습니다 · {saved} · [지난 훈련]에서 다시 볼 수 있습니다
          </p>
        ) : (
          <Button variant="secondary" onClick={onSave}>
            <Icon icon="mdi:content-save-outline" className="size-4" aria-hidden />
            훈련 결과 저장
          </Button>
        )}
      </section>
    </>
  );
}
