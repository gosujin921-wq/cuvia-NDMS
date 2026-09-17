/* ─────────────────────────────────────────────
 * 폭염 결과 — 우측 레일 (scr-00 · 2026-09-17)
 *
 *   결과 · 기준 대비   두 열뿐. 예보대로 | 고른 시나리오. 행은 최고 체감온도 · 주의보 기준(33°C↑) 시간 · 경보 기준(35°C↑) 시간 · 고온 지속 지역
 *   그 시각 열환경     고온 격자 비율과 무더위쉼터(원장 집계 · 그 시각 운영 중 · 야간 개방)
 *   해당 규정          폭염 대응 규정 매칭. 단계는 체감온도 기준에서 읽은 강조
 *   근거               버튼은 패널 밖(레일 바닥)에 선다(2026-09-17 사용자). 출처·격자·산식·셈 기준 문장은 전부 그 창에 있다
 * ★ 좌 = 입력(기온·습도·체감은 좌측 "그 시각"), 우 = 결과. 절 = 머리 한 줄 + 상자 하나(panel-style).
 *   침수처럼 "이 건물이 위험"으로 잇지 않는다. 폭염의 결과는 공간적 위험 상태의 지속이다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Tag, cn } from "@ds";
import { formatClock } from "../../../lib/datetime";
import type { SimScenario, SimSop } from "../../../model/sim/flood";
import { HEAT_ADVISORY, HEAT_WARNING, type HeatSummary } from "../../../model/sim/heat";
import type { ShelterSummary } from "../../../model/sim/shelters";
import { ACTION_STYLE, SOP_ICON } from "./action-style";
import { FirstLine } from "./FirstLine";
import { PANEL } from "./panel-style";

const num = (n: number) => n.toLocaleString("ko-KR");

type Stage = "none" | "advisory" | "warning";
const LEVEL_LABEL = { advisory: "주의보", warning: "경보", evacuate: "대피" } as const;
const RANK = { none: 0, advisory: 1, warning: 2, evacuate: 3 } as const;

export function HeatResult({ base, selected, summaries, hotShareNow, stage, shelters, sop }: {
  base: SimScenario;
  selected: SimScenario;
  summaries: Record<string, HeatSummary | null>;
  hotShareNow: number;
  stage: Stage;
  /** 무더위쉼터 원장 집계(그 시각) · 아직 못 읽었으면 null */
  shelters: ShelterSummary | null;
  sop: SimSop[];
}) {
  const same = base.id === selected.id;
  const cols = same ? [base] : [base, selected];
  const bs = summaries[base.id] ?? null;
  const worse = (v: number | null | undefined, b: number | null | undefined) => (v == null || b == null || v === b ? null : v > b);
  const cell = (v: string, w: boolean | null, on: boolean) => (
    <span className={cn("whitespace-nowrap text-right font-mono tabular-nums", on ? "font-semibold text-foreground" : "text-foreground-muted", w === true && "text-warning", w === false && "text-success")}>{v}</span>
  );
  const row = (label: string, pick: (s: HeatSummary) => number, fmt: (s: HeatSummary) => string, sub?: (s: HeatSummary) => string) => (
    <>
      <span className="whitespace-nowrap py-0.5 text-foreground-muted">{label}</span>
      {cols.map((s) => {
        const sum = summaries[s.id] ?? null;
        const on = s.id === selected.id && !same;
        return (
          <span key={s.id} className="flex flex-col items-end py-0.5 leading-tight">
            {cell(sum ? fmt(sum) : "-", on && sum && bs ? worse(pick(sum), pick(bs)) : null, on)}
            {sub && sum && <span className="whitespace-nowrap font-mono text-foreground-subtle">{sub(sum)}</span>}
          </span>
        );
      })}
    </>
  );

  return (
    <div className={PANEL.rail}>
      <section className={PANEL.section} aria-label="결과 · 기준 대비">
        <header className={PANEL.header}>
          <h2 className={PANEL.title}>결과</h2>
          <span className={PANEL.meta}>{same ? "도심 기준 칸 · 하루치" : `${base.tag} 대비 · 하루치`}</span>
        </header>
        <div className={PANEL.box}>
          <div className="grid gap-x-3" style={{ gridTemplateColumns: `auto repeat(${cols.length}, minmax(72px, 1fr))` }}>
            <span />
            {cols.map((s) => (
              <span key={s.id} className={cn("whitespace-nowrap py-0.5 text-right font-mono font-semibold", s.id === selected.id && !same ? "text-primary-text" : "text-foreground-muted")}>{s.tag}</span>
            ))}
            {row("최고 체감온도", (s) => s.maxFeel, (s) => `${s.maxFeel.toFixed(1)}°C`, (s) => formatClock(s.maxFeelAt))}
            {row(`${HEAT_ADVISORY}°C↑ 시간`, (s) => s.advisoryHours, (s) => `${s.advisoryHours}시간`)}
            {row(`${HEAT_WARNING}°C↑ 시간`, (s) => s.warningHours, (s) => `${s.warningHours}시간`)}
            {row("고온 지속 지역", (s) => s.hotShare, (s) => `${Math.round(s.hotShare * 100)} %`)}
          </div>
        </div>
      </section>

      <section className={PANEL.section} aria-label="그 시각 열환경">
        <header className={PANEL.header}>
          <h2 className={PANEL.title}>그 시각 열환경</h2>
          <span className={cn(PANEL.meta, "font-mono")}>고온 격자 {Math.round(hotShareNow * 100)} %</span>
        </header>
        {shelters && (
          <dl className={cn(PANEL.box, PANEL.dl)}>
            <div className="contents">
              <dt className="truncate py-0.5 text-foreground-muted">무더위쉼터 · 수용</dt>
              <dd className="py-0.5 text-right font-mono tabular-nums text-foreground">{num(shelters.total)}곳 · {num(shelters.capacity)}명</dd>
            </div>
            <div className="contents">
              <dt className="truncate py-0.5 text-foreground-muted">운영 중</dt>
              <dd className={cn("py-0.5 text-right font-mono tabular-nums", shelters.closedNow > 0 ? "text-warning" : "text-foreground")}>
                {num(shelters.openNow)}곳{shelters.closedNow > 0 && <span className="ml-1 font-sans text-foreground-subtle">종료 {num(shelters.closedNow)}</span>}
              </dd>
            </div>
            <div className="contents">
              <dt className="truncate py-0.5 text-foreground-muted">야간 개방</dt>
              <dd className="py-0.5 text-right font-mono tabular-nums text-primary-text">{num(shelters.night)}곳</dd>
            </div>
          </dl>
        )}
      </section>

      <section className={PANEL.section} aria-label="해당 규정">
        <header className={PANEL.header}>
          <h2 className={PANEL.title}>해당 규정</h2>
          {stage === "none"
            ? <span className={PANEL.meta}>해당 단계 없음</span>
            : <Tag tone={stage === "warning" ? "danger" : "warning"}>폭염{LEVEL_LABEL[stage]} 기준</Tag>}
        </header>
        <ul className={cn(PANEL.box, PANEL.list)}>
          {sop.map((s) => {
            const hit = RANK[s.from] <= RANK[stage];
            return (
              <li key={s.id} className={cn(PANEL.row, "flex-col gap-0.5", hit ? "text-foreground" : "text-foreground-subtle")}>
                <span className="flex w-full items-start justify-between gap-2">
                  <span className="flex min-w-0 items-start gap-1.5">
                    <FirstLine><Icon icon={SOP_ICON} className={cn("size-3.5", hit ? ACTION_STYLE.규정.text : "text-border-light")} aria-hidden /></FirstLine>
                    <span className="min-w-0 break-keep">{s.label}</span>
                  </span>
                  <span className="shrink-0 font-mono text-foreground-subtle">{LEVEL_LABEL[s.from]}부터</span>
                </span>
                {s.detail && <span className="break-keep pl-5 text-caption leading-snug text-foreground-subtle">{s.detail}</span>}
              </li>
            );
          })}
        </ul>
      </section>

    </div>
  );
}
