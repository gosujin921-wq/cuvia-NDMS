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
import { formatLagMinutes, formatMarkMetric, markMetricLabel, minutesBetween } from "../../../lib/forecast-twin";
import { arrivalAtOf } from "../../../lib/forecast-compare";
import type { Forecast } from "../../../model/forecast";
import type { ImprovementAxis, ImprovementItem, WhatIfCase } from "../../../model/whatif";
import { ImprovementCard } from "./ImprovementCard";

/** 그 판의 최고 지표 눈금 */
const peakOf = (f: Forecast) => f.marks.reduce((a, x) => ((x.metric?.value ?? x.maxDepthM) > (a.metric?.value ?? a.maxDepthM) ? x : a), f.marks[0]);
/** 기준 초과 시각 — 없으면 "없음" */
const crossOf = (f: Forecast) => { const at = arrivalAtOf(f); return at ? formatClock(at) : "없음"; };
/** 사람 대상 — 라벨을 박지 않는다. 유형마다 다른 사람이 선다(천변도로 이용자 · 공백 격자 취약대상) */
const personOf = (f: Forecast) => f.targets.find((x) => x.kind === "대상자") ?? null;
/** 영향의 심각도 — 낮을수록 낫다. 유형별 영향을 견줄 유일한 공통 축이다 */
const TONE_RANK: Record<string, number> = { danger: 3, warning: 2, safe: 1, muted: 0 };

/** 값 안의 첫 수 — "5칸" · "3.5시간". 없으면 0 */
const numOf = (v: string): number => { const m = v.match(/[\d.]+/); return m ? Number(m[0]) : 0; };

/**
 * 훈련 **전체에서 가장 나빴던** 영향 — 라벨마다 한 줄.
 *
 * 마지막 눈금만 보면 안 된다. 창원천은 마지막이 최고 수위라 맞았지만, 폭염은 22:00 이 최악이고
 * 이튿날 낮에는 주간 쉼터가 다시 열려 격자가 같아진다 — 그 눈금만 읽으면 조치가 무의미해 보인다.
 * 강평이 물어야 하는 것은 "훈련하는 동안 가장 나빴을 때 어땠나"다.
 */
const worstImpactsOf = (f: Forecast) => {
  const best = new Map<string, { label: string; value: string; tone?: string }>();
  for (const m of f.marks) {
    for (const i of m.impacts ?? []) {
      const cur = best.get(i.label);
      if (!cur) { best.set(i.label, i); continue; }
      const ir = TONE_RANK[i.tone ?? "muted"] ?? 0, cr = TONE_RANK[cur.tone ?? "muted"] ?? 0;
      /* 심각도가 먼저, 같으면 수가 큰 쪽("1칸"과 "5칸"은 둘 다 danger 다) */
      if (ir > cr || (ir === cr && numOf(i.value) > numOf(cur.value))) best.set(i.label, i);
    }
  }
  return [...best.values()];
};

/**
 * 강평 표의 행 — 저장 기록도 이 값을 그대로 담는다(판을 고쳐도 과거 훈련이 안 바뀐다).
 *
 * ★ **유형을 박지 않는다.** 창원천만 있을 때는 `합류부 수위 · 기준 초과 · 천변도로 이용자`를
 *   그대로 적어 두었지만, 유형마다 답이 다르다 — 폭염은 "기준을 넘는다"는 개념이 없고 공백 격자가 답이다.
 *   그래서 판이 스스로 든 것만 읽는다: 유형 핵심 지표(`metric`) · 도달(있는 유형만) · 영향(`impacts`) · 사람.
 */
export interface DebriefRow {
  label: string;
  base: string;
  mine: string;
  /** 내 조치 쪽이 나아졌나 — 색만 정한다. 판정할 수 없으면 비운다 */
  better?: boolean;
}

export function debriefRowsOf(mine: Forecast | null, base: Forecast | null): DebriefRow[] {
  if (!base) return [];
  const my = mine ?? base;
  const bp = peakOf(base), mp = peakOf(my);
  const bv = bp.metric?.value ?? bp.maxDepthM, mv = mp.metric?.value ?? mp.maxDepthM;
  /* 유형 핵심 지표는 전부 "낮을수록 낫다"이다 — 수위·침수심·화선 거리·위험 지속시간 */
  const rows: DebriefRow[] = [{ label: `${markMetricLabel(bp)} · 최고`, base: formatMarkMetric(bp), mine: formatMarkMetric(mp), better: mv < bv }];

  /* 도달·초과는 그 개념이 있는 유형만 — 판의 대상에 도달 시각이 붙어 있을 때다 */
  const bc = arrivalAtOf(base), mc = arrivalAtOf(my);
  if (bc || mc) {
    rows.push({
      label: "기준 초과 시각", base: crossOf(base), mine: crossOf(my),
      /* 안 넘었거나 늦어졌으면 나아진 것이다 */
      better: mc === null || (bc !== null && mc > bc),
    });
  }

  /* 유형별 영향 — 창원천은 도로·건물, 폭염은 공백 격자. 같은 라벨끼리만 맞춘다 */
  const bi = worstImpactsOf(base), mi = worstImpactsOf(my);
  for (const b of bi) {
    const m = mi.find((x) => x.label === b.label);
    if (!m) continue;
    const br = TONE_RANK[b.tone ?? "muted"] ?? 0, mr = TONE_RANK[m.tone ?? "muted"] ?? 0;
    /* 심각도가 같아도 수가 줄었으면 나아진 것이다 — `5칸 → 3칸` 은 둘 다 danger 지만 분명히 낫다 */
    rows.push({ label: b.label, base: b.value, mine: m.value, better: mr < br || (mr === br && numOf(m.value) < numOf(b.value)) });
  }

  /* 사람 — 라벨은 그 유형이 든 것 그대로 */
  const bTarget = personOf(base), mTarget = personOf(my);
  if (bTarget && mTarget) {
    rows.push({
      label: bTarget.label, base: bTarget.exposure ?? "-", mine: mTarget.exposure ?? "-",
      better: mTarget.exposure !== bTarget.exposure && mTarget.exposure !== "노출",
    });
  }

  /**
   * ★ **달라진 것이 먼저 온다.** 표의 논리 순서(핵심 지표 → 도달 → 영향 → 사람)를 그대로 두면
   * 조치로 바뀌지 않는 값이 맨 위에 서는 유형이 있다 — 폭염의 `위험 지속시간`은 조건이 정하지
   * 쉼터가 바꾸지 않아 `28시간 → 28시간`이 첫 줄이 되고, 훈련의 답이 "효과 없음"으로 읽힌다.
   * 안 바뀐 행도 버리지 않는다(그대로임을 아는 것도 정보다). 아래로 내릴 뿐이다.
   * 조건과 조치가 같으면 순서도 같으므로 표가 흔들리지 않는다.
   */
  return [...rows.filter((r) => r.base !== r.mine), ...rows.filter((r) => r.base === r.mine)];
}

/**
 * 결론 한 줄 — **"나아졌다"와 "막았다"를 구분한다.**
 *
 * ★ 유형을 박지 않는다. 예전에는 `최고 수위가 n m 낮아지고`라고 적어 두었는데, 폭염은 강도가
 *   조치로 바뀌지 않고 **공백 격자**가 준다 — 그 문장으로는 "나아지지 않았다"가 되어 거짓이 된다.
 *   그래서 **비교표에서 실제로 달라진 행을 읽어** 문장을 만든다.
 * ★ `condLabel` 은 완성된 조건 이름이다("강우 +20%" · "열대야 +2°C"). 여기서 유형 이름을 붙이지 않는다.
 */
export function debriefHeadline(mine: Forecast | null, base: Forecast | null, condLabel: string, noAct: boolean): string {
  if (!base) return "";
  if (noAct) return "실제와 같은 시각에 조치했으므로 결과가 달라지지 않았습니다.";

  const rows = debriefRowsOf(mine, base);
  const changed = rows.filter((r) => r.base !== r.mine);
  if (changed.length === 0) return `조치를 했지만 이 조건(${condLabel})에서는 결과가 달라지지 않았습니다.`;

  /* 달라진 것 둘까지만 적는다 — 셋을 넘기면 결론이 표를 되풀이한다 */
  const what = changed.slice(0, 2).map((r) => `${r.label} ${r.base} → ${r.mine}`).join(" · ");
  const cross = rows.find((r) => r.label === "기준 초과 시각");
  const same = `같은 조건(${condLabel})에서 실제와 같게 했을 때와 견준 것이라, 차이는 조치에서만 왔습니다.`;

  /* 넘는다는 개념이 있는 유형에서만 "막았다"를 말한다 */
  if (cross && cross.mine === "없음" && cross.base !== "없음") return `${what}. 기준을 넘지 않았습니다 — ${same}`;
  if (cross) return `${what}. 나아졌지만 여전히 기준을 넘었습니다. 이 조건에서는 그 조치만으로 막지 못합니다.`;
  return `${what}. ${same}`;
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
  const held = crossOf(my) === "없음";

  /* 화면과 저장 기록이 **같은 표**를 읽는다. 두 벌로 적으면 보고서와 화면이 갈린다 */
  const rows = debriefRowsOf(mine, base);
  /* 개선 항목에 자동으로 붙는 맥락 — 사람이 다시 적지 않는다 */
  const context = [wcase.title, condLabel,
    Object.keys(acts).length > 0
      ? (wcase.sop ?? []).filter((s) => acts[s.id]).map((s) => `${s.id} ${formatLagMinutes(minutesBetween(s.firedAt, acts[s.id]))}`).join(" · ")
      : "조치 없음",
  ].join(" · ");

  return (
    <>
      <section className="flex flex-col gap-2 p-3" aria-label="내 조치가 만든 차이">
        <header className="flex items-baseline justify-between gap-2">
          <h2 className="text-body font-semibold text-foreground">내 조치가 만든 차이</h2>
          <span className="shrink-0 text-caption text-foreground-subtle">둘 다 {condLabel}</span>
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
              <span className="text-right font-mono leading-tight text-foreground-muted">{r.base}</span>
              <span className={cn("text-right font-mono font-semibold leading-tight", r.base === r.mine ? "text-foreground-muted" : r.better ? "text-success" : "text-warning")}>{r.mine}</span>
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
                    ? <><span className="font-semibold text-foreground">{formatLagMinutes(mineLag)}</span> · 실제 {realLag === null ? "원장 없음" : formatLagMinutes(realLag)}</>
                    : <>안 함 · 실제와 같게({realLag === null ? "원장 없음" : formatLagMinutes(realLag)})</>}
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
