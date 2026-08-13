/* ─────────────────────────────────────────────
 * 현재 주요 재난 (03 화면정의서 §1 좌측 상단 · 04 §4-7)
 *
 * 진행 사건을 **사건군 하나로 묶어 한 번만 말하는** 카드다. 머리는 재난유형 표시명이고,
 * 특보명은 상단 상태 스트립이 화면에서 한 번만 적는다(기상 카드는 그 특보의 기상 근거만
 * 보인다). 지구별 행은 단계 색 점 · 측정값 · 처리상태만 적고 "주의보" 같은 단계 낱말을
 * 반복하지 않는다. 같은 사건군이라는 것은 점 색이 말한다(색 뜻은 좌하단 계측단계 범례).
 *
 * 여기 선 지구는 아래 위험지구 목록에서 빠진다(같은 지구를 두 번 세우지 않는다 · 03 §1).
 * 행을 누르면 그 지구의 재난관제(SCR-02)로 간다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { findDistrict, type District } from "../../../demo/districts";
import { HERO_EVENT_ID, eventViewAt, majorDisasterAt } from "../../../demo/events";
import { levelSpec } from "../../../demo/levels";
import { processStateAt } from "../../../demo/sop";
import { formatClock } from "../../../lib/datetime";
import { useScenario } from "../../../state/ScenarioProvider";

export function MajorDisasterCard({ onOpen }: { onOpen: (district: District) => void }) {
  const { now, approvedResponseLevel, approvedAt } = useScenario();
  const major = majorDisasterAt(now);

  if (!major) {
    return (
      <section className="flex flex-col gap-1 p-3" aria-label="현재 주요 재난">
        <h2 className="text-caption font-medium text-foreground-muted">현재 주요 재난</h2>
        <p className="text-body text-foreground-muted">진행 중인 주요 재난 없음</p>
      </section>
    );
  }

  /* 승인 대응등급 배지(03 §0-6)는 주인공 사건이 이 묶음에 진행 중일 때만 세운다.
     S8(서항 해제) 이후의 카드는 명동항·구항 몫이라 배지를 물려받지 않는다 */
  const heroApproved = major.events.some((event) => event.id === HERO_EVENT_ID)
    ? approvedResponseLevel
    : null;

  return (
    <section className="flex flex-col gap-2 p-3" aria-label="현재 주요 재난">
      <h2 className="text-caption font-medium text-foreground-muted">현재 주요 재난</h2>

      {/* 사건군 머리는 유형 표시명이다(04 §4-0). 특보명은 상단 상태 스트립 몫이라
          여기서 되풀이하지 않는다 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-h6 font-semibold leading-tight text-foreground">{major.label}</span>
        {heroApproved && (
          <span className="rounded-full border border-risk-lv5 px-2 py-0.5 text-caption font-medium text-risk-lv5">
            {levelSpec(heroApproved).label} 대응중
          </span>
        )}
      </div>

      <p className="text-caption text-foreground-muted">영향 지구 {major.events.length}곳</p>

      {/* 지구별 행. 점 색 = 그 지구 사건의 계측 단계(03 §0-2). 단계 낱말은 반복하지 않는다 */}
      <ul className="flex flex-col">
        {major.events.map((event) => {
          const view = eventViewAt(event, now);
          const district = findDistrict(event.districtId);
          const state = processStateAt(
            event,
            now,
            event.id === HERO_EVENT_ID ? approvedResponseLevel : null,
          );
          return (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => district && onOpen(district)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-md border-none bg-transparent px-1.5 py-1.5 text-left transition-colors hover:bg-surface-raised"
              >
                <span
                  className="size-2 shrink-0 animate-pulse rounded-full"
                  style={{ backgroundColor: levelSpec(view.level).color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-body font-medium text-foreground">
                  {district?.name ?? event.districtId}
                </span>
                <span className="shrink-0 text-caption text-foreground-muted">
                  <span className="font-mono">
                    {view.value} {event.unit}
                  </span>{" "}
                  · {state}
                </span>
                <Icon
                  icon="mdi:chevron-right"
                  className="size-4 shrink-0 text-foreground-subtle"
                  aria-hidden
                />
              </button>
            </li>
          );
        })}
      </ul>

      {heroApproved && approvedAt && (
        <p className="text-caption text-foreground-subtle">
          {formatClock(approvedAt)} 대응등급 {levelSpec(heroApproved).label} 상향 승인
        </p>
      )}
    </section>
  );
}
