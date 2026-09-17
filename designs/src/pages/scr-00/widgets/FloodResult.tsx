/* ─────────────────────────────────────────────
 * 침수 결과 — 우측 레일 (scr-00 · 2026-09-17)
 *
 *   결과 · 기준 대비   두 열뿐. 기준 | 고른 시나리오(규정 스위치를 켰으면 실제 시각 | 규정 시각). 행은 침수 시작 · 최대 수심 · 침수 면적 · 영향 시설.
 *                      실측은 같은 상자의 바닥 줄. 아래에 "지도에 기준 겹쳐 보기" 스위치 한 줄
 *   그 시각 영향       침수 범위 · 수심 타일과 영향 객체 상자(과거 침수 지점도 한 줄로)
 *   해당 규정          기존 SOP 를 **매칭**한다(발동이 아니다). 조치 기록이 있으면 같은 줄에 시각이 선다. 조치 이력을 따로 두지 않는다.
 *                      판이 있는 규정엔 "시각을 앞당겼다면" 스위치와 시각 칩이 붙는다 — 켜면 그 열이 다시 계산되고, 여럿을 동시에 켤 수 있다
 *   근거               버튼 하나. 출처·산식·범례 문장은 전부 그 창에 있다
 * ★ 좌 = 입력, 우 = 결과. 절 = 머리 한 줄 + 상자 하나(panel-style). 시나리오를 고르는 자리는 좌측 하나뿐이라 여기 표 머리는 버튼이 아니다.
 * ★ "당시 실제로 이 SOP 가 실행됐다"고 말하지 않는다. "이 조건이면 이 SOP 가 해당된다"만 말한다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Badge, Button, Switch, Tag, cn } from "@ds";
import { formatClock } from "../../../lib/datetime";
import { isPast, type ImpactObject, type ScenarioSummary, type SimAction, type SimScenario, type SimSop } from "../../../model/sim/flood";
import type { AlertLevel } from "../../../demo/levels";
import { ACTION_STYLE, SOP_ICON } from "./action-style";
import { FirstLine } from "./FirstLine";
import { PANEL } from "./panel-style";

const LEVEL_LABEL: Record<AlertLevel, string> = { advisory: "주의보", warning: "경보", evacuate: "대피" };
const LEVEL_RANK: Record<AlertLevel, number> = { advisory: 1, warning: 2, evacuate: 3 };

export function FloodResult({ base, selected, summaries, observed, at, depthNow, headroomM, areaHa, impacts, marks, actions, sop, stage, focus, onFocus, sopApply, sopOn, onSop, compare, onCompare, onBasis }: {
  /** 비교의 왼쪽 열 — 기준 시나리오. 규정 스위치를 켰으면 "그 규정을 실제 시각에 했을 때" */
  base: SimScenario;
  selected: SimScenario;
  summaries: Record<string, ScenarioSummary | null>;
  /** 실제 사건의 실측 — 사건 원장. 없으면 비운다 */
  observed: { label: string; value: string }[];
  at: string;
  depthNow: number;
  /** 아직 안 잠겼을 때 도로 잠김 수위까지 남은 높이(m). 규칙 대상만 */
  headroomM: number | null;
  areaHa: number | null;
  impacts: ImpactObject[];
  /** 시가지 과거 침수 지점(침수흔적도) — 실자료. 잠김 시각은 누적 강우 ≥ 한계강우량 */
  marks: { areaHa: number; floodedAt: string | null } | null;
  /** 이 시나리오의 조치(시각순). 규정 줄이 자기 시각을 여기서 찾는다 */
  actions: SimAction[];
  sop: SimSop[];
  stage: "none" | AlertLevel;
  /** 켜진 시설 id — 규정 줄·영향 객체 줄과 지도 마커가 같은 집합을 본다 */
  focus: Set<string>;
  onFocus: (facilityIds: string[] | null) => void;
  /** 스위치를 붙일 규정 id → 문구와 고를 수 있는 조치 시각(판이 있는 것만). 켜면 첫 시각, 칩으로 바꾼다 */
  sopApply: Record<string, { label: string; times: { at: string; label: string }[] }>;
  /** 켜진 규정 id → 고른 시각(HH:MM) */
  sopOn: Record<string, string>;
  onSop: (id: string, at: string | null) => void;
  compare: boolean;
  onCompare: (v: boolean) => void;
  onBasis: () => void;
}) {
  const same = base.id === selected.id;
  const cols = same ? [base] : [base, selected];
  const bs = summaries[base.id] ?? null;
  const better = (v: number | string | null, b: number | string | null, lowerIsBetter: boolean) =>
    v === null || b === null || v === b ? null : lowerIsBetter ? v < b : v > b;
  const cell = (v: string, good: boolean | null, on: boolean) => (
    <span className={cn("whitespace-nowrap py-0.5 text-right font-mono tabular-nums", on ? "font-semibold text-foreground" : "text-foreground-muted", good === true && "text-success", good === false && "text-warning")}>{v}</span>
  );
  const row = (label: string, pick: (s: ScenarioSummary) => number | string | null, fmt: (s: ScenarioSummary) => string, lowerIsBetter: boolean) => (
    <>
      <span className="whitespace-nowrap py-0.5 text-foreground-muted">{label}</span>
      {cols.map((s) => {
        const sum = summaries[s.id] ?? null;
        const on = s.id === selected.id && !same;
        return <span key={s.id} className="contents">{cell(sum ? fmt(sum) : "-", on && sum && bs ? better(pick(sum), pick(bs), lowerIsBetter) : null, on)}</span>;
      })}
    </>
  );
  const flooded = marks?.floodedAt ? isPast(marks.floodedAt, at) : false;
  /* 집계에 과거 침수 지점도 한 줄로 센다 — 목록과 머리 숫자가 같아야 한다 */
  const hit = impacts.filter((i) => i.status === "영향" || i.status === "범위 안").length + (flooded ? 1 : 0);
  const soon = impacts.filter((i) => i.status === "예상").length + (marks?.floodedAt && !flooded ? 1 : 0);

  return (
    <div className={PANEL.rail}>
      <section className={PANEL.section} aria-label="결과 · 기준 대비">
        <header className={PANEL.header}>
          <h2 className={PANEL.title}>결과</h2>
          <span className={PANEL.meta}>{same ? "기준 시나리오" : `${base.tag} 대비`}</span>
        </header>
        <div className={PANEL.box}>
          <div className="grid gap-x-3" style={{ gridTemplateColumns: `auto repeat(${cols.length}, minmax(72px, 1fr))` }}>
            <span />
            {cols.map((s) => (
              <span key={s.id} className={cn("whitespace-nowrap py-0.5 text-right font-mono font-semibold", s.id === selected.id && !same ? "text-primary-text" : "text-foreground-muted")}>{s.tag}</span>
            ))}
            {/* 판의 startAt = 도로 위 수심이 0 을 넘는 첫 시각. "침수 시작"이라 쓰면 그릇 바닥이 차는 시각과 헷갈린다 */}
            {row("도로 잠김", (s) => s.startAt ?? null, (s) => (s.startAt ? formatClock(s.startAt) : "없음"), false)}
            {row(bs ? (bs.metricLabel.startsWith("최대") ? bs.metricLabel : `최대 ${bs.metricLabel}`) : "최대 수심", (s) => s.maxDepthM, (s) => `${s.maxDepthM.toFixed(2)} m`, true)}
            {row("침수 면적", (s) => s.maxAreaHa, (s) => `${s.maxAreaHa.toFixed(1)} ha`, true)}
            {row("영향 시설", (s) => s.hitTargets, (s) => `${s.hitTargets}곳`, true)}
          </div>
          {/* 실측 — 같은 상자의 바닥 줄. 기준 열과 견줄 값이다 */}
          {observed.length > 0 && (
            <dl className={cn(PANEL.dl, "mt-1 border-t border-border pt-1")}>
              {observed.map((o) => (
                <div key={o.label} className="contents">
                  <dt className="truncate py-0.5 text-foreground-muted">실측 · {o.label}</dt>
                  <dd className="py-0.5 text-right font-mono tabular-nums text-foreground">{o.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {!same && (
          <label className={PANEL.switchRow}>
            <span className="flex items-center gap-1.5"><Icon icon="mdi:compare-horizontal" className="size-4" aria-hidden />지도에 {base.tag} 겹쳐 보기</span>
            <Switch checked={compare} onCheckedChange={onCompare} aria-label={`지도에 ${base.tag} 겹쳐 보기`} />
          </label>
        )}
      </section>

      <section className={PANEL.section} aria-label="그 시각 영향">
        <header className={PANEL.header}>
          <h2 className={PANEL.title}>그 시각 영향</h2>
          <span className={PANEL.meta}>영향 {hit} · 예상 {soon}</span>
        </header>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="침수 범위" value={areaHa === null ? "아직 없음" : `${areaHa.toFixed(1)} ha`} />
          {/* 도로 위 물 깊이. 잠기기 전엔 "잠김까지 남은 높이"가 판단에 쓰이는 값이다 */}
          {depthNow > 0 || headroomM === null
            ? <Stat label="도로 수심" value={depthNow > 0 ? `${depthNow.toFixed(2)} m` : "0 m"} />
            : <Stat label="도로 잠김까지" value={`${headroomM.toFixed(2)} m`} />}
        </div>
        <ul className={cn(PANEL.box, PANEL.list)}>
          {/* 과거 침수 지점 — 지도의 침수흔적도와 같은 것. 잠김은 누적 강우가 한계강우량을 넘는 시각부터 */}
          {marks && (
            <li className={cn(PANEL.row, flooded && "text-danger")}>
              <span className="flex min-w-0 items-start gap-1.5">
                <FirstLine><Badge variant="outline" className="text-caption">과거 지점</Badge></FirstLine>
                <span className="min-w-0 break-keep text-foreground">과거 침수 지점 · {marks.areaHa.toFixed(1)} ha</span>
              </span>
              <span className={cn("shrink-0 font-mono", flooded ? "text-danger" : marks.floodedAt ? "text-warning" : "text-success")}>
                {marks.floodedAt ? (flooded ? `잠김 ${formatClock(marks.floodedAt)}~` : `${formatClock(marks.floodedAt)} 예상`) : "한계 미달"}
              </span>
            </li>
          )}
          {impacts.map((i) => (
            <li
              key={`${i.kind}-${i.id}`}
              onMouseEnter={() => i.kind === "지점" && onFocus([i.id])}
              onMouseLeave={() => i.kind === "지점" && onFocus(null)}
              className={cn(PANEL.row, "flex-col gap-0.5", focus.has(i.id) && "bg-primary/10")}
            >
              <span className="flex w-full items-start justify-between gap-2">
                <span className="flex min-w-0 items-start gap-1.5">
                  <FirstLine><Badge variant="outline" className="text-caption">{i.kind}</Badge></FirstLine>
                  <span className="min-w-0 break-keep text-foreground">{i.label}</span>
                </span>
                <span className={cn("shrink-0 font-mono", i.status === "영향" || i.status === "범위 안" ? "text-danger" : i.status === "예상" ? "text-warning" : "text-success")}>
                  {/* 통제·대피가 앞선 대상은 도달 전에도 "통제됨"이다 — 규정을 켠 효과가 도달 전에 보여야 한다 */}
                  {i.status === "예상" && i.at ? (i.exposure === "통제됨" ? `통제됨 · ${formatClock(i.at)} 도달` : `${formatClock(i.at)} 예상`) : i.status === "영향" && i.exposure ? i.exposure : i.status}
                </span>
              </span>
              {/* 공간 교차가 덧붙인 한마디 — "범위 안 약 320 m" */}
              {i.detail && <span className="text-caption text-foreground-subtle">{i.detail}</span>}
            </li>
          ))}
          {!marks && impacts.length === 0 && <li className={cn(PANEL.row, "text-foreground-subtle")}>이 판에 적힌 대상이 없습니다</li>}
        </ul>
      </section>

      <section className={PANEL.section} aria-label="해당 규정">
        <header className={PANEL.header}>
          <h2 className={PANEL.title}>해당 규정</h2>
          {stage === "none"
            ? <span className={PANEL.meta}>해당 단계 없음</span>
            : <Tag tone={stage === "evacuate" ? "danger" : stage === "warning" ? "warning" : undefined}>{LEVEL_LABEL[stage]} 단계</Tag>}
        </header>
        <ul className={cn(PANEL.box, PANEL.list)}>
          {sop.map((s) => {
            const hitRule = stage !== "none" && LEVEL_RANK[s.from] <= LEVEL_RANK[stage];
            const linked = s.facilityIds?.length ? s.facilityIds : null;
            const on = Boolean(linked?.some((id) => focus.has(id)));
            /* 타임라인과 같은 시각 — 조치 기록이 있으면 그 시각(지나면 파랑), 없으면 이 시나리오에서 규정이 해당되기 시작한 시각(주황) */
            const ev = actions.find((a) => a.id === s.id || a.id === `sop-${s.id}`);
            const done = ev ? isPast(ev.at, at) : false;
            const style = ev && ev.kind !== "규정" ? ACTION_STYLE[ev.kind] : ACTION_STYLE.규정;
            const spec = sopApply[s.id];
            const chosen = sopOn[s.id] ?? null;
            return (
              <li
                key={s.id}
                onMouseEnter={() => linked && onFocus(linked)}
                onMouseLeave={() => linked && onFocus(null)}
                className={cn(PANEL.row, "flex-col gap-0.5", hitRule || done ? "text-foreground" : "text-foreground-subtle", on && "bg-primary/10", linked && "cursor-default")}
              >
                <span className="flex w-full items-start justify-between gap-2">
                  <span className="flex min-w-0 items-start gap-1.5">
                    <FirstLine><Icon icon={ev && ev.kind !== "규정" ? style.icon : SOP_ICON} className={cn("size-3.5", done ? style.text : hitRule ? ACTION_STYLE.규정.text : "text-border-light")} aria-hidden /></FirstLine>
                    <span className="min-w-0 break-keep">{s.label}</span>
                    {linked && <FirstLine><Icon icon="mdi:map-marker-outline" className="size-3.5 text-foreground-subtle" aria-label="지도에 시설 있음" /></FirstLine>}
                  </span>
                  {ev
                    ? <span className={cn("shrink-0 font-mono", done ? style.text : "text-foreground-subtle")}>{formatClock(ev.at)}{done ? "" : " 예정"}</span>
                    : <span className="shrink-0 font-mono text-foreground-subtle">{LEVEL_LABEL[s.from]}부터</span>}
                </span>
                {s.detail && <span className="break-keep pl-5 text-caption leading-snug text-foreground-subtle">{s.detail}</span>}
                {/* 판이 있는 규정만 — 켜면 "앞당겼다면"이 오른쪽 열로 서고 결과가 다시 계산된다. 시각 칩은 판이 있는 시각뿐 */}
                {spec && (
                  <div className="mt-1 flex w-full flex-col gap-1 pl-5">
                    <label className={cn(PANEL.switchRow, "pr-0", chosen ? "text-foreground" : "")}>
                      <span className="break-keep">{spec.label}</span>
                      <Switch checked={chosen !== null} onCheckedChange={(v) => onSop(s.id, v ? spec.times[0]?.at ?? null : null)} aria-label={`${s.label} · ${spec.label}`} />
                    </label>
                    {chosen && spec.times.length > 1 && (
                      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="조치 시각">
                        {spec.times.map((t) => (
                          <button key={t.at} type="button" role="radio" aria-checked={chosen === t.at} onClick={() => onSop(s.id, t.at)}
                            className={cn("cursor-pointer rounded-md border px-2 py-0.5 text-caption", chosen === t.at ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-foreground-muted hover:text-foreground")}>
                            {/^\d\d:\d\d$/.test(t.at) && <><span className="font-mono">{t.at}</span> · </>}{t.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={cn(PANEL.section, "py-3")}>
        <Button variant="outline" size="sm" className="w-full" onClick={onBasis}>
          <Icon icon="mdi:file-search-outline" className="size-4" aria-hidden />
          근거 · 입력과 계산
        </Button>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn(PANEL.box, "flex min-w-0 flex-col gap-0.5 py-2")}>
      <span className="truncate text-foreground-muted">{label}</span>
      <span className="truncate font-mono text-body font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}
