/* ─────────────────────────────────────────────
 * 비교 결과 — 현재 조건 대 선택한 대응, 같은 유효시각에서 (IA §8 "영향 결과" · 사용자 재정비 2026-09-15)
 *
 * 열은 둘뿐이다. 현재 조건 | 선택한 대응. 대응을 안 골랐으면 한 열만 선다 — "그대로 / 그대로" 두 열은 "그래서 뭐가 다른데"가 된다.
 * 행은 유형 지표(최대 침수심 등) · 도달 시각 · 영향 대상별 상태. 값은 예측판 결과 객체 그대로이고 차이를 계산해 새 숫자를 만들지 않는다.
 * 장식은 없다 — 아이콘·화살표·칸마다 시각을 두었더니 표가 읽히지 않았다(2026-09-15 사용자). 색 글자와 숫자뿐이다.
 * ───────────────────────────────────────────── */

import { cn } from "@ds";
import { ALTERNATIVE_LABEL, type Forecast, type ForecastMark, type ImpactTarget } from "../../../model/forecast";
import { formatClock } from "../../../lib/datetime";
import { formatMarkMetric, markMetricLabel } from "../../../lib/forecast-twin";
import { previewExposure } from "../../../lib/twin-preview";

/* 상태는 색 글자 — 숫자 행과 같은 문법. 뱃지로 감싸면 그 행만 튀고 표가 두 문법이 된다(2026-09-15 사용자) */
const EXPOSURE_CLASS: Record<ImpactTarget["exposure"], string> = {
  "영향 없음": "text-foreground-muted",
  통제됨: "text-success",
  노출: "text-warning",
  "부분 중단": "text-danger",
  중단: "text-danger",
};
/* 상태 + 수(있으면). 표는 예측판의 결론이다 — 언제 그 상태가 되는지는 도달 시각 행과 시간 줄이 말한다 */
const Exposure = ({ t, count, changed, preview }: { t: ImpactTarget | null; count?: string; changed?: boolean; /** 결정 전 대응 열 — 통제됨을 가정 문구로 */ preview?: boolean }) =>
  t ? (
    <span className={cn("whitespace-nowrap font-semibold", EXPOSURE_CLASS[t.exposure])}>
      {preview ? previewExposure(t) : t.exposure}
      {count && t.exposure !== "영향 없음" && <span className={cn("ml-1 font-mono font-normal", changed ? "font-semibold text-warning" : "text-foreground-muted")}>{count}</span>}
    </span>
  ) : <span className="text-foreground-subtle">-</span>;
/** 예측 범위 안에 도달이 없으면 arrivalAt 은 자리값(유효 종료)이라 "없음"으로 말한다 */
const arrivalText = (f: Forecast) => (f.targets.some((t) => t.arrivalAt) ? formatClock(f.arrivalAt) : "없음");

export function ForecastCompareCard({ baseline, baselineMark, selected, selectedMark, same, decided = false, decidedStartAt = null }: {
  baseline: Forecast;
  baselineMark: ForecastMark;
  selected: Forecast;
  /** 대안의 같은 유효시각 눈금. 대안에 그 시각이 없으면 null */
  selectedMark: ForecastMark | null;
  /** 현재 조건을 보고 있는가 — 한 열만 */
  same: boolean;
  /** 이 대응을 결정 기록했는가 — 아니면 열 이름이 "…시"이고 통제 상태는 가정 문구다 */
  decided?: boolean;
  /** 결정한 시작 시각 — 있으면 예측판의 대응 시점 대신 이것을 보인다 */
  decidedStartAt?: string | null;
}) {
  const ids = [...new Set([...baseline.targets, ...selected.targets].map((t) => t.id))];
  const rows = ids.map((id) => ({ id, base: baseline.targets.find((t) => t.id === id) ?? null, alt: selected.targets.find((t) => t.id === id) ?? null }));
  const cols = same ? "grid-cols-[1fr_88px]" : "grid-cols-[1fr_84px_84px]";

  return (
    <section className="flex flex-col gap-1.5 p-3" aria-label="비교 결과">
      <h2 className="text-body font-semibold text-foreground">비교 결과</h2>

      <div className={cn("grid items-center gap-x-2 gap-y-1 text-caption", cols)}>
        <span />
        <span className="truncate text-right font-semibold text-foreground-muted">{ALTERNATIVE_LABEL.baseline}</span>
        {!same && <span className="truncate text-right font-semibold text-primary-text">{ALTERNATIVE_LABEL[selected.alternativeId]}{decided ? "" : " 시"}</span>}

        <Row label={`${markMetricLabel(baselineMark)} · ${formatClock(baselineMark.validAt)}`}>
          <Cell mono>{formatMarkMetric(baselineMark)}</Cell>
          {!same && <Cell mono changed={selectedMark !== null && formatMarkMetric(selectedMark) !== formatMarkMetric(baselineMark)}>{selectedMark ? formatMarkMetric(selectedMark) : "-"}</Cell>}
        </Row>
        <Row label="도달 시각">
          <Cell mono>{arrivalText(baseline)}</Cell>
          {!same && <Cell mono changed={arrivalText(selected) !== arrivalText(baseline)}>{arrivalText(selected)}</Cell>}
        </Row>
        {!same && selected.actionAt && (
          <Row label={decided ? "시작 시각" : selected.actionAt.label}>
            <Cell mono>-</Cell>
            <Cell mono changed>{formatClock(decided && decidedStartAt ? decidedStartAt : selected.actionAt.at)}</Cell>
          </Row>
        )}

        {/* 지표 묶음 | 대상 묶음 */}
        <span className="col-span-full my-0.5 border-t border-border" aria-hidden />
        {rows.map((r) => {
          /* 같은 대상인데 수가 다르면("저지대 건물 12동" 대 "4동") 행 이름은 대상, 수는 상태 뱃지 안에 붙는다("노출 4동") */
          const raw = r.base?.label ?? r.alt?.label ?? r.id;
          const label = raw.replace(/\s*\d+\S*$/, "");
          const count = (t: ImpactTarget | null) => t?.label.match(/\d+\S*$/)?.[0];
          return (
            <Row key={r.id} label={label}>
              <span className="flex justify-end"><Exposure t={r.base} count={count(r.base)} /></span>
              {!same && <span className="flex justify-end"><Exposure t={r.alt} count={count(r.alt)} changed={count(r.alt) !== count(r.base)} preview={!decided} /></span>}
            </Row>
          );
        })}
      </div>

      {!same && selected.deltaSummary && <p className="border-t border-border pt-1.5 text-caption text-warning">{selected.deltaSummary}</p>}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      {/* 자르지 않고 두 줄로 — "해안도로 보행·차량 이용자"가 말줄임으로 끊기면 무엇인지 모른다 */}
      <span className="min-w-0 break-keep leading-tight text-foreground-muted">{label}</span>
      {children}
    </>
  );
}

function Cell({ children, mono, changed }: { children: React.ReactNode; mono?: boolean; changed?: boolean }) {
  return <span className={cn("text-right tabular-nums", mono && "font-mono", changed ? "font-semibold text-warning" : "text-foreground")}>{children}</span>;
}
