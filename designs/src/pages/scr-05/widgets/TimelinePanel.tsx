/* ─────────────────────────────────────────────
 * 시간대별 영향 시나리오 — 03 화면정의서 §5 우측 (사건 연계 모드의 주 조작축)
 *
 * 시각을 옮기면 예상 수위·영향 범위·대응 대상이 함께 바뀐다. 수위 슬라이더가 하던
 * 자리를 이것이 대신하고, 조건은 [상세 조건 조정]으로 내려간다.
 *
 * ★ 화면 이름을 "침수 예측"이라 하지 않는다. 시간 모델이 없다 — 눈금은 원장 계측과
 *   조건 시나리오 한 점이고, 그 사이를 계산한 것이 아니다(demo/scenario-timeline.ts).
 *   "시간대별 영향 시나리오" · "현재 조건 유지 시" 가 사실에 맞는 이름이다.
 *
 * ★ 슬라이더는 **눈금에 물린다(자석).** 손잡이는 이어서 끌리지만 값은 문서에 있는 시각에만
 *   선다. 자유롭게 놓이면 18:00 에 3.72 같은, 04 어디에도 없는 숫자가 뜬다 — 조건
 *   슬라이더의 중간값은 "사용자가 가정한 조건"이지만 시간축의 중간값은 "시스템이 계산한
 *   예측"으로 읽혀서, 없는 모델을 있다고 말하게 된다.
 *
 * ★ 결정을 만드는 숫자는 "몇 시"가 아니라 **"지금부터 몇 분"** 이다. 19:10 이라는 시각만
 *   보면 아직 먼 일 같지만, 1시간 41분이라고 적히면 지금 결재를 올릴지가 정해진다.
 *   04 의 선제 대응 리드타임(승인 17:37 → 계측 도달 19:22 = 1시간 45분)이 그 값이다.
 *
 * ★ 눈금 이름은 축 위에 늘어놓지 않고 손잡이 아래 한 줄로 낸다. 서항은 17:22 와 17:29 가
 *   6.5% 간격이라(그 사이 단계가 안 움직였다) 라벨을 다 세우면 겹친다. 슬라이더의 어법
 *   그대로 양 끝에 시작·끝 시각만 두고, 지금 짚은 것은 아래에서 이름과 함께 말한다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { cn } from "@ds";
import { formatClock } from "../../../lib/datetime";
import { formatLead, type TimeMark, type Timeline } from "../../../demo/scenario-timeline";

interface TimelinePanelProps {
  timeline: Timeline;
  /** 지금 선택된 눈금. 상세 조건으로 손수 민 값이면 undefined */
  selected: TimeMark | undefined;
  onSelect: (mark: TimeMark) => void;
}

const KIND_ICON: Record<TimeMark["kind"], string> = {
  past: "mdi:history",
  now: "mdi:circle-medium",
  projection: "mdi:trending-up",
};

/** 네이티브 range 의 손잡이 반지름 — 눈금 점을 트랙과 같은 폭에 맞추려고 양옆을 들인다 */
const THUMB_INSET = 8;

export function TimelinePanel({ timeline, selected, onSelect }: TimelinePanelProps) {
  const { marks, leadMinutes } = timeline;
  const first = marks[0].at.getTime();
  const last = marks[marks.length - 1].at.getTime();
  const span = Math.max(1, last - first);
  const pct = (at: Date) => ((at.getTime() - first) / span) * 100;

  const nowMark = marks[timeline.nowIndex];
  const projection = marks.find((mark) => mark.kind === "projection");
  /* 눈금 밖으로 민 상태면 손잡이는 현재에 둔다 — 축 위에 자리가 없는 값이라서다 */
  const handleAt = selected?.at ?? nowMark.at;

  /* 자석 — 끌던 손을 놓은 자리에서 가장 가까운 눈금으로 붙는다 */
  const snap = (ms: number) => {
    let best = marks[0];
    for (const mark of marks) {
      if (Math.abs(mark.at.getTime() - ms) < Math.abs(best.at.getTime() - ms)) best = mark;
    }
    if (best.id !== selected?.id) onSelect(best);
  };

  return (
    <section className="flex flex-col gap-2 p-3" aria-label="시간대별 영향 시나리오">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-body font-semibold text-foreground">시간대별 영향 시나리오</h2>
        <span className="shrink-0 text-caption text-foreground-subtle">현재 조건 유지 시</span>
      </header>

      <div className="relative">
        <input
          type="range"
          min={first}
          max={last}
          /* 1분 단위로 끌리고, 손을 놓기 전에도 가까운 눈금으로 붙는다 */
          step={60_000}
          value={handleAt.getTime()}
          onChange={(e) => snap(Number(e.target.value))}
          aria-label="분석 시각"
          aria-valuetext={`${formatClock(handleAt)} ${selected?.label ?? ""}`}
          className="w-full accent-primary"
        />

        {/* 눈금 — 축 위 점. 시간 간격을 그대로 그린다. 17:22 와 17:29 가 붙어 있고 19:10 이
            멀리 있는 것이 이 사건의 모양이고, 등간격으로 펴면 그 모양이 사라진다.
            트랙은 불투명이라 **위에** 얹는다. 아래 깔면 브라우저 기본 트랙에 덮여 안 보인다.
            클릭은 통과시켜 슬라이더가 그대로 조작을 받는다 */}
        <div
          className="pointer-events-none absolute top-1/2 h-2.5 -translate-y-1/2"
          style={{ left: THUMB_INSET, right: THUMB_INSET }}
          aria-hidden
        >
          {marks.map((mark) => (
            <span
              key={mark.id}
              className={cn(
                "absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1",
                mark.kind === "projection"
                  ? "bg-primary-text ring-surface"
                  : "bg-foreground-subtle ring-surface",
              )}
              style={{ left: `${pct(mark.at)}%` }}
            />
          ))}
        </div>
      </div>

      {/* 양 끝 시각 — 슬라이더 어법 그대로. 가운데 눈금 이름은 아래 한 줄이 맡는다 */}
      <div className="flex items-center justify-between font-mono text-caption text-foreground-subtle">
        <span>{formatClock(marks[0].at)}</span>
        <span>{formatClock(marks[marks.length - 1].at)}</span>
      </div>

      {/* 지금 짚은 눈금 */}
      <div
        className={cn(
          "flex items-center gap-1.5 rounded border px-2 py-1 text-caption",
          selected
            ? "border-primary bg-primary/10 text-foreground"
            : "border-border bg-surface-raised text-foreground-muted",
        )}
      >
        {selected ? (
          <>
            <Icon icon={KIND_ICON[selected.kind]} className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate font-medium">{selected.label}</span>
            <span className="shrink-0 font-mono">{formatClock(selected.at)}</span>
          </>
        ) : (
          <>
            <Icon icon="mdi:tune-variant" className="size-4 shrink-0" aria-hidden />
            {/* 상세 조건으로 축 밖으로 민 상태 — 시각이 없는 값이라 이름도 시각도 못 붙인다 */}
            <span className="min-w-0 flex-1 truncate">상세 조건으로 조정한 값</span>
          </>
        )}
      </div>

      {/* 남은 시간 — 이 화면이 만들어야 하는 문장. "19:10" 이 아니라 "1시간 41분 뒤" 가
          지금 결재를 올릴지를 정한다 */}
      {projection && leadMinutes !== null && (
        <p
          className={cn(
            "flex items-center gap-1.5 border-t border-border pt-1.5 text-caption",
            selected?.kind === "projection" ? "text-foreground" : "text-foreground-muted",
          )}
        >
          <Icon icon="mdi:clock-alert-outline" className="size-3.5 shrink-0" aria-hidden />
          <span>
            {projection.label} <span className="font-mono">{formatClock(projection.at)}</span> 까지{" "}
            <span className="font-mono font-semibold text-foreground">
              {formatLead(leadMinutes)}
            </span>{" "}
            남음
          </span>
        </p>
      )}
    </section>
  );
}
