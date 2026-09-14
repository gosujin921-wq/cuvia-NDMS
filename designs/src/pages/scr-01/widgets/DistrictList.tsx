/* ─────────────────────────────────────────────
 * 지구 목록 — 종합상황 좌 2 (초안 §2 · CSMS SiteList 문법)
 *
 * 정렬은 위험 → 주의 → 정상, 동률은 최근 사건. 행은 상태 점 · 지구명 · 유형 / 두 번째 줄에 진행 사건
 * (`등급 사건 제목`) 또는 감시 사유, 그도 없으면 관측 대상. 줄을 비우면 목록 높이가 들쭉날쭉해진다.
 * 메인 사건이 도는 동안 그 줄에 위험도 색 테두리 + 후광. 펄스는 지도 이름표 몫이라 여기엔 없다.
 * 푸터 범례는 목록이 스크롤돼도 제자리에 남는다.
 * ───────────────────────────────────────────── */

import { useMemo } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@ds";
import { DISTRICTS, type District } from "../../../demo/districts";
import { districtStatusAt, gradeOf, topIncidentByDistrictAt, watchTargetsAt } from "../../../model/selectors";
import { DISTRICT_STATUS_ORDER, DISTRICT_STATUS_TONE, RISK_GRADE_TONE } from "../../../lib/status-tone";
import { useScenario } from "../../../state/ScenarioProvider";
import { DistrictStatusLegend } from "./DistrictStatusLegend";

export function DistrictList({ onOpen }: { onOpen: (district: District) => void }) {
  const { demoNow: now, heroIncidentId } = useScenario();
  const status = useMemo(() => districtStatusAt(now), [now]);
  const top = useMemo(() => topIncidentByDistrictAt(now), [now]);
  const watched = useMemo(() => new Map(watchTargetsAt(now).map((w) => [w.incident.legacyDistrictId, w])), [now]);
  const ordered = useMemo(
    () =>
      DISTRICTS.slice().sort((a, b) => {
        const ra = DISTRICT_STATUS_ORDER.indexOf(status.get(a.id) ?? "정상");
        const rb = DISTRICT_STATUS_ORDER.indexOf(status.get(b.id) ?? "정상");
        if (ra !== rb) return ra - rb;
        const ta = top.get(a.id)?.lastUpdatedAt ?? "";
        const tb = top.get(b.id)?.lastUpdatedAt ?? "";
        if (ta !== tb) return tb.localeCompare(ta);
        if (watched.has(a.id) !== watched.has(b.id)) return watched.has(a.id) ? -1 : 1;
        return a.name.localeCompare(b.name, "ko");
      }),
    [status, top, watched],
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="지구 목록">
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <header className="flex shrink-0 items-baseline justify-between">
          <h2 className="text-body font-semibold text-foreground">지구</h2>
          <span className="text-caption text-foreground-muted">{DISTRICTS.length}곳</span>
        </header>
        <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {ordered.map((d) => {
            const tone = DISTRICT_STATUS_TONE[status.get(d.id) ?? "정상"];
            const v = top.get(d.id);
            const grade = v ? gradeOf(v) : null;
            const watch = watched.get(d.id);
            const highlighted = v?.incident.incidentId === heroIncidentId;
            const hl = grade ? RISK_GRADE_TONE[grade] : RISK_GRADE_TONE.주의;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => onOpen(d)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-md bg-transparent px-2.5 py-2 text-left transition-[background-color,border-color,box-shadow] duration-300 hover:bg-surface-raised",
                    highlighted ? cn("border ring-2", hl.stroke, hl.halo) : "border-none",
                  )}
                >
                  <span className={cn("size-2 shrink-0 rounded-full", tone.dot)} aria-hidden />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-body font-medium text-foreground">{d.name}</span>
                      <span className="shrink-0 text-caption text-foreground-muted">{d.kind}</span>
                    </span>
                    <span className="truncate text-caption text-foreground-muted">
                      {v ? (
                        <>
                          {grade && <span className={RISK_GRADE_TONE[grade].text}>{grade} </span>}
                          {v.incident.title}
                        </>
                      ) : watch ? (
                        <><span className="text-primary-text">감시</span> · {watch.alert?.reason ?? watch.reasons[0]?.summary}</>
                      ) : (
                        d.target
                      )}
                    </span>
                  </span>
                  <Icon icon="mdi:chevron-right" className="size-4 shrink-0 text-foreground-subtle" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <footer className="shrink-0 border-t border-border">
        <DistrictStatusLegend />
      </footer>
    </section>
  );
}
