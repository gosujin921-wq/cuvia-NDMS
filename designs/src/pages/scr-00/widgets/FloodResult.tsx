/* ─────────────────────────────────────────────
 * 침수 결과 — 우측 레일 (scr-00 · 2026-09-17)
 *
 *   비교표      실제 사건 | A | B | A+B. 행은 침수 시작 · 최대 수심 · 침수 면적 · 영향 시설. 실제 사건 열엔 실측이 함께 선다
 *   그 시각     고른 시나리오의 그 시각 상태(재현 관측 · 시뮬레이션 값)
 *   영향 객체   판의 대상 + 범위 링과 공간 교차한 지점
 *   관련 SOP    기존 SOP 를 **매칭**한다(발동이 아니다). 단계는 영향에서 읽은 강조이고 발령은 승인 경계다
 *   근거        입력 · 관측시각 · 모델 · 불확실성 (접힌 창)
 * ★ 숫자마다 출처가 갈린다 — 수위→범위·수심은 지형 계산, 강우→수위는 사전 작성 판, 실측은 사건 원장.
 * ★ "당시 실제로 이 SOP 가 실행됐다"고 말하지 않는다. "이 조건이면 이 SOP 가 해당된다"만 말한다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Badge, Button, Tag, cn } from "@ds";
import { formatClock } from "../../../lib/datetime";
import type { ImpactObject, ScenarioSummary, SimScenario, SimSop, StateRow } from "../../../model/sim/flood";
import type { AlertLevel } from "../../../demo/levels";

const LEVEL_LABEL: Record<AlertLevel, string> = { advisory: "주의보", warning: "경보", evacuate: "대피" };
const LEVEL_RANK: Record<AlertLevel, number> = { advisory: 1, warning: 2, evacuate: 3 };

export function FloodResult({ scenarios, selected, onSelect, summaries, observed, at, stateRows, depthNow, areaHa, impacts, sop, stage, compare, onCompare, onBasis }: {
  scenarios: SimScenario[];
  selected: SimScenario;
  onSelect: (id: string) => void;
  summaries: Record<string, ScenarioSummary | null>;
  /** 실제 사건의 실측 — 사건 원장. 없으면 비운다 */
  observed: { label: string; value: string }[];
  at: string;
  stateRows: (StateRow & { computed?: boolean; scaled?: boolean })[];
  depthNow: number;
  areaHa: number | null;
  impacts: ImpactObject[];
  sop: SimSop[];
  stage: "none" | AlertLevel;
  compare: boolean;
  onCompare: (v: boolean) => void;
  onBasis: () => void;
}) {
  const cols = scenarios.map((s) => ({ s, sum: summaries[s.id] ?? null }));
  const base = summaries[scenarios[0]?.id ?? ""] ?? null;
  const better = (v: number | string | null, b: number | string | null, lowerIsBetter: boolean) =>
    v === null || b === null || v === b ? null : lowerIsBetter ? v < b : v > b;
  const cell = (v: string, good: boolean | null, on: boolean) => (
    <span className={cn("whitespace-nowrap text-right font-mono tabular-nums", on ? "font-semibold" : "", good === null ? (on ? "text-foreground" : "text-foreground-muted") : good ? "text-success" : "text-warning")}>{v}</span>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col divide-y divide-border overflow-y-auto overflow-x-hidden rounded-[inherit]">
      <section className="flex shrink-0 flex-col gap-2 p-3" aria-label="시나리오 비교">
        <header className="flex items-baseline justify-between gap-2">
          <h2 className="text-body font-semibold text-foreground">시나리오 비교</h2>
          <span className="shrink-0 text-caption text-foreground-subtle">기준은 실제 사건</span>
        </header>
        <div className="overflow-x-auto rounded-md border border-border bg-card px-2.5 py-2 text-caption">
          <div className="grid gap-x-2 gap-y-1" style={{ gridTemplateColumns: `auto repeat(${cols.length}, minmax(0, 1fr))` }}>
            <span />
            {cols.map(({ s }) => (
              <button key={s.id} type="button" onClick={() => onSelect(s.id)} aria-pressed={s.id === selected.id}
                className={cn("cursor-pointer whitespace-nowrap rounded px-1 text-right font-mono font-semibold", s.id === selected.id ? (s.baseline ? "bg-surface-raised text-foreground" : "bg-primary text-primary-foreground") : "text-foreground-muted hover:text-foreground")}>
                {s.baseline ? "실제" : s.tag}
              </button>
            ))}
            <span className="text-foreground-muted">침수 시작</span>
            {cols.map(({ s, sum }) => <span key={s.id} className="contents">{cell(sum?.startAt ? formatClock(sum.startAt) : "없음", better(sum?.startAt ?? null, base?.startAt ?? null, false), s.id === selected.id)}</span>)}
            <span className="text-foreground-muted">{base ? (base.metricLabel.startsWith("최대") ? base.metricLabel : `최대 ${base.metricLabel}`) : "최대 수심"}</span>
            {cols.map(({ s, sum }) => <span key={s.id} className="contents">{cell(sum ? `${sum.maxDepthM.toFixed(2)} m` : "-", better(sum?.maxDepthM ?? null, base?.maxDepthM ?? null, true), s.id === selected.id)}</span>)}
            <span className="text-foreground-muted">침수 면적</span>
            {cols.map(({ s, sum }) => <span key={s.id} className="contents">{cell(sum ? `${sum.maxAreaHa.toFixed(1)} ha` : "-", better(sum?.maxAreaHa ?? null, base?.maxAreaHa ?? null, true), s.id === selected.id)}</span>)}
            <span className="text-foreground-muted">영향 시설</span>
            {cols.map(({ s, sum }) => <span key={s.id} className="contents">{cell(sum ? `${sum.hitTargets}곳` : "-", better(sum?.hitTargets ?? null, base?.hitTargets ?? null, true), s.id === selected.id)}</span>)}
          </div>
        </div>
        {observed.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-caption">
            {observed.map((o) => (
              <div key={o.label} className="contents">
                <dt className="truncate text-foreground-muted">실측 · {o.label}</dt>
                <dd className="text-right font-mono tabular-nums text-foreground">{o.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {!selected.baseline && (
          <button
            type="button"
            onClick={() => onCompare(!compare)}
            aria-pressed={compare}
            className={cn("flex cursor-pointer items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-caption",
              compare ? "border-warning bg-warning/10 text-foreground" : "border-border bg-card text-foreground-muted hover:text-foreground")}
          >
            <span className="flex items-center gap-1.5"><Icon icon="mdi:compare-horizontal" className="size-4" aria-hidden />지도에 실제 사건 겹쳐 보기</span>
            <span className="font-mono text-foreground-subtle">{compare ? "점선 = 실제" : "끔"}</span>
          </button>
        )}
        <p className="break-keep text-caption leading-snug text-foreground-subtle">
          수위 → 범위·수심은 지형 계산 · 강우 → 수위는 사전 작성 판(모델 연결 시 교체) · 실측은 사건 원장
        </p>
      </section>

      <section className="flex shrink-0 flex-col gap-1.5 p-3" aria-label="그 시각 상태">
        <header className="flex items-baseline justify-between gap-2">
          <h2 className="text-body font-semibold text-foreground">그 시각 · {selected.tag}</h2>
          <span className="shrink-0 font-mono text-caption text-foreground-subtle">{formatClock(at)}</span>
        </header>
        <div className="grid grid-cols-2 gap-1.5">
          <Stat label="침수 범위" value={areaHa === null ? "아직 없음" : `${areaHa.toFixed(1)} ha`} />
          <Stat label="수심" value={depthNow > 0 ? `${depthNow.toFixed(2)} m` : "0 m"} />
        </div>
        {stateRows.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-md border border-border bg-card px-2.5 py-2 text-caption">
            {stateRows.map((r) => (
              <div key={r.label} className="contents">
                <dt className="truncate text-foreground-muted">{r.label}</dt>
                <dd className={cn("text-right font-mono tabular-nums", r.scaled ? "font-semibold text-warning" : r.computed ? "font-semibold text-primary-text" : "text-foreground")}>{r.value}{r.note && <span className="ml-1 font-sans text-foreground-subtle">{r.note}</span>}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="break-keep text-caption leading-snug text-foreground-subtle">
          <span className="text-primary-text">파란 값</span>은 이 시나리오의 계산값, <span className="text-warning">주황 값</span>은 조건대로 환산한 관측값, 나머지는 당시 기록입니다
        </p>
      </section>

      <section className="flex shrink-0 flex-col gap-1.5 p-3" aria-label="영향 객체">
        <header className="flex items-baseline justify-between gap-2">
          <h2 className="text-body font-semibold text-foreground">영향 객체</h2>
          <span className="shrink-0 text-caption text-foreground-subtle">영향 {impacts.filter((i) => i.status === "영향" || i.status === "범위 안").length} · 예상 {impacts.filter((i) => i.status === "예상").length}</span>
        </header>
        {impacts.length === 0 ? (
          <p className="text-caption text-foreground-subtle">이 판에 적힌 대상이 없습니다.</p>
        ) : (
          <ul className="flex flex-col text-caption">
            {impacts.map((i) => (
              <li key={`${i.kind}-${i.id}`} className="flex items-baseline justify-between gap-2 border-b border-border py-1 last:border-0">
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <Badge variant="outline" className="h-fit shrink-0 text-caption">{i.kind}</Badge>
                  <span className="min-w-0 break-keep text-foreground">{i.label}</span>
                </span>
                <span className={cn("shrink-0 font-mono", i.status === "영향" || i.status === "범위 안" ? "text-danger" : i.status === "예상" ? "text-warning" : "text-success")}>
                  {i.status === "예상" && i.at ? `${formatClock(i.at)} 예상` : i.status === "영향" && i.exposure ? i.exposure : i.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex shrink-0 flex-col gap-1.5 p-3" aria-label="관련 SOP">
        <header className="flex items-baseline justify-between gap-2">
          <h2 className="text-body font-semibold text-foreground">관련 SOP</h2>
          {stage === "none"
            ? <span className="shrink-0 text-caption text-foreground-subtle">해당 단계 없음</span>
            : <Tag tone={stage === "evacuate" ? "danger" : stage === "warning" ? "warning" : undefined}>{LEVEL_LABEL[stage]} 단계 해당</Tag>}
        </header>
        <ul className="flex flex-col text-caption">
          {sop.map((s) => {
            const hit = stage !== "none" && LEVEL_RANK[s.from] <= LEVEL_RANK[stage];
            return (
              <li key={s.id} className={cn("flex flex-col gap-0.5 border-b border-border py-1 last:border-0", hit ? "text-foreground" : "text-foreground-subtle")}>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <Icon icon={hit ? "mdi:checkbox-blank-circle" : "mdi:checkbox-blank-circle-outline"} className={cn("size-2.5 shrink-0 self-center", hit ? "text-primary-text" : "text-border-light")} aria-hidden />
                    <span className="min-w-0 break-keep">{s.label}</span>
                  </span>
                  <span className="shrink-0 font-mono text-foreground-subtle">{LEVEL_LABEL[s.from]}부터{s.mode ? ` · ${s.mode === "auto" ? "자동" : "승인"}` : ""}</span>
                </span>
                {s.detail && <span className="break-keep pl-4 text-caption leading-snug text-foreground-subtle">{s.detail}</span>}
              </li>
            );
          })}
        </ul>
        <p className="break-keep text-caption leading-snug text-foreground-subtle">
          이 조건이면 해당되는 기존 SOP입니다. 당시 실행 여부가 아니며, 발령·전파는 승인 뒤에 합니다
        </p>
      </section>

      <section className="flex shrink-0 p-3">
        <Button variant="outline" size="sm" className="w-full" onClick={onBasis}>
          <Icon icon="mdi:file-search-outline" className="size-4" aria-hidden />
          예측 근거 · 입력과 모델
        </Button>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-md border border-border bg-card px-2 py-1.5">
      <span className="truncate text-caption text-foreground-muted">{label}</span>
      <span className="truncate font-mono text-body font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}
