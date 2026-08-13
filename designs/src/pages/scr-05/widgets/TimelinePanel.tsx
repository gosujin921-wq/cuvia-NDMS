/* ─────────────────────────────────────────────
 * 시간축 — 03 화면정의서 §5 우측 (두 모드의 주 조작축)
 *
 * 시간을 옮기면 예상 수위·영향 범위·대응 대상이 함께 바뀐다. 수위 슬라이더가 하던
 * 자리를 이것이 대신하고, 조건은 그 시간을 만드는 산정 근거로 내려간다.
 *
 * ★ 부품은 하나다. 사건 연계는 **시각**(17:29 · demo/scenario-timeline.ts), 모의분석은
 *   **경과**(+55분 · demo/progression.ts)를 밀지만, 축·눈금·보간·점프 버튼의 문법은 같다.
 *   두 벌로 나누면 슬라이더 하나는 자유롭고 하나는 자석인 축이 다시 생긴다(차수 T).
 *   갈리는 것은 표기와 문안뿐이라 그 넷만 주입받는다(title · formatAt · caption · freeLabel).
 *
 * ★ 화면 이름을 "침수 예측"이라 하지 않는다. 시간 모델이 없다 — 눈금은 원장 계측과
 *   조건 시나리오 한 점이고, 그 사이는 계산한 것이 아니라 조건이 유지된다는 가정 아래
 *   두 점을 이은 램프다(demo/scenario-timeline.ts valueAt).
 *
 * ★ 슬라이더는 **조건 슬라이더와 같은 물건이다** (차수 T · 03 §5). 1분 단위로 자유롭게
 *   끌리고 눈금은 축 위 표식과 점프 버튼으로 남는다. 같은 레일에 선 두 슬라이더가 하나는
 *   자유롭고 하나는 자석이면 먹지 않는 쪽이 고장으로 읽힌다 — 실제로 그랬다. 눈금이
 *   셋뿐인데 축이 분 단위로 이어지니 17:29 하나가 314px 중 157px 을 먹어, 트랙의 4분의
 *   1을 끌어도 값이 안 바뀌고 화살표 키는 50번을 눌러야 다음 눈금에 닿았다.
 *
 * ★ 사이에 선 값은 04 에 없는 수다. 그래서 [사용자 시각] 으로 표시해 등재값과 구분하고,
 *   판단에 쓰이는 자리로는 점프 버튼이 정확히 데려간다. 조건 슬라이더의 [사용자 조건]
 *   칩과 같은 어법이다(WaterLevelCondition).
 *
 * ★ 결정을 만드는 숫자는 "몇 시"가 아니라 **"지금부터 몇 분"** 이다. 19:10 이라는 시각만
 *   보면 아직 먼 일 같지만, 1시간 41분이라고 적히면 지금 결재를 올릴지가 정해진다.
 *   04 의 선제 대응 리드타임(승인 17:37 → 계측 도달 19:22 = 1시간 45분)이 그 값이다.
 *
 * ★ 눈금 이름은 축 위에 늘어놓지 않는다. 서항은 17:22 와 17:29 가 6.5% 간격이라(그 사이
 *   단계가 안 움직였다) 라벨을 다 세우면 겹친다. 축 위에는 점만 시간 비율 그대로 찍고,
 *   이름은 아래 점프 버튼 줄이 맡는다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Button, cn } from "@ds";
import { formatClock } from "../../../lib/datetime";
import { formatLead, type TimeMark, type Timeline } from "../../../demo/scenario-timeline";

interface TimelinePanelProps {
  timeline: Timeline;
  /** 지금 손잡이가 선 시각. 상세 조건으로 손수 민 값이면 undefined */
  at: Date | undefined;
  /** 그 시각이 눈금 위면 그 눈금. 사이를 짚었으면 undefined */
  mark: TimeMark | undefined;
  onScrub: (at: Date) => void;
  onPick: (mark: TimeMark) => void;
  /** 카드 제목 — 기본은 사건 연계의 이름 */
  title?: string;
  /** 축 위 한 점의 표기 — 기본은 절대 시각. 모의분석은 "+55분" */
  formatAt?: (at: Date) => string;
  /** 축 아래 가운데 한 줄 — 눈금 사이의 보간을 정당화하는 문장 */
  caption?: string;
  /** 눈금 밖에 선 값의 이름 */
  freeLabel?: string;
}

/** 네이티브 range 의 손잡이 반지름 — 눈금 점을 트랙과 같은 폭에 맞추려고 양옆을 들인다 */
const THUMB_INSET = 8;

export function TimelinePanel({
  timeline,
  at,
  mark,
  onScrub,
  onPick,
  title = "시간대별 영향 시나리오",
  formatAt = formatClock,
  caption = "현재 조건 유지 시",
  freeLabel = "사용자 시각",
}: TimelinePanelProps) {
  const { marks, leadMinutes } = timeline;
  const first = marks[0].at.getTime();
  const last = marks[marks.length - 1].at.getTime();
  const span = Math.max(1, last - first);
  const pct = (t: Date) => ((t.getTime() - first) / span) * 100;

  const nowMark = marks[timeline.nowIndex];
  const projection = marks.find((m) => m.kind === "projection");
  /* 조건으로 민 값이면 손잡이는 현재에 둔다 — 축 위에 자리가 없는 값이라서다 */
  const handleAt = at ?? nowMark.at;

  return (
    <section className="flex flex-col gap-2 p-3" aria-label={title}>
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="min-w-0 truncate text-body font-semibold text-foreground">{title}</h2>
        {/* 조건 패널이 값을 머리에 세우듯 시간축은 시각을 세운다. 손잡이를 끄는 동안
            읽히는 것이 이 한 칸이라, 눈금 이름이 없어도 지금 몇 시인지가 남는다.
            ★ 눈금 밖 표시도 여기 붙인다 — 아래 버튼 줄에 두면 338px 레일에서 버튼 셋을
              밀어 "바닷물 최고"가 잘린다. 시각 바로 옆이 이 말이 걸릴 자리이기도 하다 */}
        <span className="flex shrink-0 items-center gap-1.5">
          {!mark && (
            <span className="rounded border border-border px-1.5 py-0.5 text-caption text-foreground-muted">
              {at ? freeLabel : "사용자 조건"}
            </span>
          )}
          <span className="font-mono text-body font-semibold text-foreground">
            {formatAt(handleAt)}
          </span>
        </span>
      </header>

      <div className="relative">
        <input
          type="range"
          min={first}
          max={last}
          /* 1분 단위 자유 스크럽 — 조건 슬라이더(0.01 EL.m)와 같은 문법 */
          step={60_000}
          value={handleAt.getTime()}
          onChange={(e) => onScrub(new Date(Number(e.target.value)))}
          aria-label="분석 시점"
          aria-valuetext={`${formatAt(handleAt)} ${mark?.label ?? freeLabel}`}
          className="w-full accent-primary"
        />

        {/* 눈금 — 축 위 점. 시간 간격을 그대로 그린다. 17:22 와 17:29 가 붙어 있고 19:10 이
            멀리 있는 것이 이 사건의 모양이고, 등간격으로 펴면 그 모양이 사라진다.
            트랙은 불투명이라 **위에** 얹는다. 아래 깔면 브라우저 기본 트랙에 덮여 안 보인다.
            클릭은 통과시켜 슬라이더가 그대로 조작을 받는다 — 정확한 점프는 아래 버튼 몫 */}
        <div
          className="pointer-events-none absolute top-1/2 h-2.5 -translate-y-1/2"
          style={{ left: THUMB_INSET, right: THUMB_INSET }}
          aria-hidden
        >
          {marks.map((m) => (
            <span
              key={m.id}
              className={cn(
                "absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1",
                m.kind === "projection"
                  ? "bg-primary-text ring-surface"
                  : "bg-foreground-subtle ring-surface",
              )}
              style={{ left: `${pct(m.at)}%` }}
            />
          ))}
        </div>
      </div>

      {/* 양 끝 시각 + 가운데 이름 — 조건 패널의 `{min} {단계 구간} {max}` 와 같은 줄이다.
          "현재 조건 유지 시"가 이 자리에 서야 하는 이유는 눈금 사이가 보간이라서다(03 §5).
          램프를 정당화하는 문장이 축 바로 아래 있어야 중간값이 예측으로 안 읽힌다 */}
      <div className="flex items-center justify-between text-caption text-foreground-subtle">
        <span className="font-mono">{formatAt(marks[0].at)}</span>
        <span>{caption}</span>
        <span className="font-mono">{formatAt(marks[marks.length - 1].at)}</span>
      </div>

      {/* 눈금 점프 — 조건 패널의 프리셋 줄과 같은 자리·같은 문법. 04 에 등재된 값으로
          정확히 데려가는 길이고, 자유 스크럽이 만든 보간값과 구분되는 자리다.
          ★ 아이콘을 달지 않는다. 338px 레일에서 셋으로 나누면 버튼 하나가 101px 인데
            아이콘과 간격이 22px 을 먹어 "저지대 영향 확대"(봉암 · 04 §15-7)가 잘린다.
            눈금의 성격은 축 위 점 색과 버튼 순서가 이미 말한다 */}
      <div className="flex items-center gap-1.5">
        {marks.map((m) => (
          <Button
            key={m.id}
            variant={mark?.id === m.id ? "default" : "outline"}
            size="sm"
            className="min-w-0 flex-1 px-1.5 text-caption"
            onClick={() => onPick(m)}
          >
            <span className="truncate">{m.label}</span>
          </Button>
        ))}
      </div>

      {/* 남은 시간 — 이 화면이 만들어야 하는 문장. "19:10" 이 아니라 "1시간 41분 뒤" 가
          지금 결재를 올릴지를 정한다 */}
      {projection && leadMinutes !== null && (
        <p
          className={cn(
            "flex items-center gap-1.5 border-t border-border pt-1.5 text-caption",
            mark?.kind === "projection" ? "text-foreground" : "text-foreground-muted",
          )}
        >
          <Icon icon="mdi:clock-alert-outline" className="size-3.5 shrink-0" aria-hidden />
          <span>
            {projection.label} <span className="font-mono">{formatAt(projection.at)}</span> 까지{" "}
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
