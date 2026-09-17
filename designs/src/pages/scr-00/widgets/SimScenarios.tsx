/* ─────────────────────────────────────────────
 * 입력 — 좌측 레일 (scr-00 · 2026-09-17)
 *
 *   대상        셀렉트. 과거 실제 사건(기준 · 실측 있음)이 먼저, 진행 중 사건은 둘째
 *   시나리오    셀렉트. 기준 | A 조건 변경 | B 조치 변경 | A+B | C(슬라이더). 이름이 곧 바꾼 조건이라 "고른 조건" 표를 따로 두지 않는다
 *   슬라이더    연속 축(규칙 대상만). 눈금은 근거 있는 앵커뿐이고 옮기면 C 가 선다
 *   그 시각     이 시나리오에서 그 시각의 조건·관측값(누적 강우 · 3시간 강우 · 한계강우량 · 수위)
 * ★ 좌 = 입력, 우 = 결과(2026-09-17 사용자 "우측에 기획을 다 때려넣었다"). 시나리오를 고르는 자리는 여기 하나뿐이다.
 *   카드 목록은 셀렉트로 바꿨다(같은 날 사용자 "셀렉트로 가능한데 굳이 카드가 아니라"). 간격은 panel-style 한 벌.
 * ───────────────────────────────────────────── */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from "@ds";
import { formatClock } from "../../../lib/datetime";
import type { SimScenario, SimSiteBase, StateRow } from "../../../model/sim/flood";
import { PANEL } from "./panel-style";

export function SimScenarios({ sites, site, onSite, scenarios, selected, onSelect, onSlide, at, stateRows }: {
  sites: SimSiteBase[];
  site: SimSiteBase;
  onSite: (id: string) => void;
  scenarios: SimScenario[];
  selected: SimScenario;
  onSelect: (id: string) => void;
  /** 연속 축 — 배율을 옮기면 대상이 C 시나리오를 세운다. 규칙 대상만 준다 */
  onSlide?: (factor: number) => void;
  at: string;
  /** 그 시각의 조건·관측값. 파란 값 = 이 시나리오의 계산값, 주황 값 = 조건대로 환산한 관측값 */
  stateRows: (StateRow & { computed?: boolean; scaled?: boolean })[];
}) {
  const slider = site.slider;
  const factor = slider ? slider.valueOf(selected.choice) : null;
  const condLabel = slider ? site.conditions.find((c) => c.id === slider.condId)?.label ?? "조건" : "조건";
  /* 눈금을 값 순으로 놓고, 앞 눈금과 20% 안이면 아랫줄(row 1)로 */
  const placed = (() => {
    if (!slider) return [] as { value: number; label: string; row: 0 | 1 }[];
    const span = slider.max - slider.min;
    const sorted = [...slider.anchors].sort((x, y) => x.value - y.value);
    const out: { value: number; label: string; row: 0 | 1 }[] = [];
    for (const a of sorted) {
      const prev = out[out.length - 1];
      const row: 0 | 1 = prev && ((a.value - prev.value) / span) * 100 < 20 ? (prev.row === 0 ? 1 : 0) : 0;
      out.push({ ...a, row });
    }
    return out;
  })();
  const atAnchor = factor !== null && slider ? slider.anchors.some((a) => Math.abs(a.value - factor) < 1e-9) : true;
  const pct = (v: number) => (slider ? ((v - slider.min) / (slider.max - slider.min)) * 100 : 0);

  return (
    <div className={PANEL.rail}>
      <section className={PANEL.section} aria-label="대상">
        <header className={PANEL.header}>
          <h2 className={cn(PANEL.title, "shrink-0")}>대상</h2>
          <span className={cn(PANEL.meta, "min-w-0 truncate")} title={site.dateLabel}>{site.dateLabel}</span>
        </header>
        <Select value={site.id} onValueChange={onSite} disabled={sites.length < 2}>
          <SelectTrigger className="h-8 text-caption" aria-label="대상"><SelectValue /></SelectTrigger>
          <SelectContent>
            {sites.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-caption">
                {s.label}<span className={cn("ml-1.5", s.status === "진행 중" ? "text-warning" : "text-foreground-subtle")}>· {s.status}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className={PANEL.section} aria-label="시나리오">
        <header className={PANEL.header}>
          <h2 className={PANEL.title}>시나리오</h2>
          <span className={PANEL.meta}>그때 조건이 달랐다면</span>
        </header>
        <Select value={selected.id} onValueChange={onSelect}>
          <SelectTrigger className="h-8 text-caption" aria-label="시나리오"><SelectValue /></SelectTrigger>
          <SelectContent>
            {scenarios.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-caption">
                <span className="mr-1.5 font-mono font-semibold">{s.tag}</span>{s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* 연속 축 — 규칙 대상. 눈금은 근거 있는 앵커뿐이고 그 사이 어디든 멈춘다. 옮기면 C 가 선다 */}
        {slider && factor !== null && onSlide && (
          <div className={cn(PANEL.box, "flex flex-col gap-1 py-2")}>
            <div className="flex items-baseline justify-between">
              <span className="text-foreground-muted">{condLabel} 직접 조정</span>
              <span className={cn("font-mono font-semibold", atAnchor ? "text-foreground" : "text-warning")}>{slider.format(factor)}</span>
            </div>
            {/* 눈금 라벨 — 가까운 눈금(20% 안)은 아랫줄로 비켜 놓는다. 겹치면 둘 다 못 읽는다 */}
            <div className={cn("relative", placed.some((a) => a.row === 1) ? "h-14" : "h-10")}>
              {placed.map((a) => (
                <span key={a.label} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${pct(a.value)}%` }} aria-hidden>
                  <u className={cn("w-0.5 rounded-sm", a.row === 1 ? "h-8" : "h-2", Math.abs(a.value - factor) < 0.026 ? "bg-primary-text" : "bg-border-light")} />
                  <span className={cn("whitespace-nowrap font-mono text-caption text-foreground-subtle", a.row === 1 ? "mt-0.5" : "mt-3")}>{a.label}</span>
                </span>
              ))}
              <i className="absolute left-0 top-[6px] h-1 rounded-full bg-primary" style={{ width: `${pct(factor)}%` }} aria-hidden />
              <i className="absolute right-0 top-[6px] h-1 rounded-full bg-border" style={{ left: `${pct(factor)}%` }} aria-hidden />
              <input
                type="range" min={slider.min} max={slider.max} step={slider.step} value={factor}
                onChange={(e) => onSlide(Number(e.target.value))}
                aria-label={`${condLabel} 직접 조정`}
                className="absolute inset-x-0 top-0 h-4 w-full cursor-pointer appearance-none bg-transparent opacity-0"
              />
            </div>
          </div>
        )}
      </section>

      {stateRows.length > 0 && (
        <section className={PANEL.section} aria-label="그 시각 상태">
          <header className={PANEL.header}>
            <h2 className={PANEL.title}>그 시각 · {selected.tag}</h2>
            <span className={cn(PANEL.meta, "font-mono")}>{formatClock(at)}</span>
          </header>
          <dl className={cn(PANEL.box, PANEL.dl)}>
            {stateRows.map((r) => (
              <div key={r.label} className="contents">
                <dt className="truncate py-0.5 text-foreground-muted">{r.label}</dt>
                <dd className={cn("py-0.5 text-right font-mono tabular-nums", r.scaled ? "font-semibold text-warning" : r.computed ? "font-semibold text-primary-text" : "text-foreground")}>
                  {r.value}{r.note && <span className={cn("ml-1 font-sans", r.note.includes("기준") || r.note === "초과" ? "text-warning" : "text-foreground-subtle")}>{r.note}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
