/* ─────────────────────────────────────────────
 * 시간축 — 지도 하단 (scr-00 · 2026-09-17)
 *
 * `현재 ───── 미래`. 연속 슬라이더다. 정지점이 없다 — 시뮬레이션은 조치를 정하는 자리가 아니라 결과를 읽는 자리라
 * 시간을 되돌려도 고장이 아니다(모의훈련 시계와 다른 점). 판의 눈금은 눈금 표시로만 선다.
 * 재생은 끝에 닿으면 처음부터 되풀이한다(멈출 때까지 · 2026-09-17 사용자 "모든 애니메이션은 루프").
 * // TODO(ds): 슬라이더 부품이 DS 에 없어 native range 를 쓴다. DS 승격 대상
 * ───────────────────────────────────────────── */

import { useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@ds";
import { formatClock } from "../../../lib/datetime";
import { useElementWidth } from "../../../lib/useElementWidth";

/** 눈금 두 개가 이보다 가까우면 하나로 묶는다(px) — 사실상 같은 자리. 겹치면 개수가 뒤 눈금에 가려 안 읽힌다 */
const CLUSTER_PX = 14;
/** 묶을 만큼은 아니지만 이보다 가까우면 윗줄로 비켜 세운다(px) — 닷 지름 8 + 여백 */
const STACK_PX = 16;

export function TimeAxis({ origin, end, ticks, events = [], minutes, onChange, playing, onTogglePlay }: {
  /** 현재(시작) · 지평선 끝 */
  origin: string;
  end: string;
  /** 판의 눈금 시각 — 표시만 */
  ticks: string[];
  /**
   * 조치 눈금 — 트랙 위에 선 **작은 닷**이다(2026-09-17 사용자 "아이콘 말고 작은 닷으로"). 지나면 채워지고, 앞의 것은 테두리만.
   * 무엇이 서 있는지는 **호버 쪽지**가 말한다 — 시각 · 규정 이름 · 어떤 대응인지(`kind`). 닷을 누르면 그 시각으로 간다
   */
  events?: { at: string; label: string; kind?: string }[];
  /** 현재로부터 몇 분 뒤를 보고 있나 */
  minutes: number;
  onChange: (minutes: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
}) {
  const span = Math.max(1, Math.round((new Date(end).getTime() - new Date(origin).getTime()) / 60_000));
  const m = Math.min(span, Math.max(0, minutes));
  const at = new Date(new Date(origin).getTime() + m * 60_000).toISOString();
  const pct = (iso: string) => Math.min(100, Math.max(0, ((new Date(iso).getTime() - new Date(origin).getTime()) / 60_000 / span) * 100));
  /* 트랙 픽셀 폭 — 눈금이 픽셀로 겹치는지는 폭을 알아야 안다 */
  const trackRef = useRef<HTMLSpanElement>(null);
  const trackWidth = useElementWidth(trackRef, 300);
  /* 시각순으로 놓고, 앞 눈금과 CLUSTER_PX 안이면 한 눈금으로 묶는다. 자리는 첫 건, 개수는 합, 호버 라벨은 전부 */
  const grouped = (() => {
    const inRange = events
      .filter((e) => { const t = new Date(e.at).getTime(); return t >= new Date(origin).getTime() && t <= new Date(end).getTime(); })
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    const out: { at: string; labels: { at: string; label: string; kind?: string }[]; row: 0 | 1 }[] = [];
    const px = (a: string, b: string) => ((pct(b) - pct(a)) / 100) * trackWidth;
    for (const e of inRange) {
      const prev = out[out.length - 1];
      if (prev && px(prev.at, e.at) < CLUSTER_PX) { prev.labels.push({ at: e.at, label: e.label, kind: e.kind }); continue; }
      /* 앞 눈금과 겹칠 만큼 가까우면 윗줄 — 슬라이더 눈금 라벨과 같은 규칙. 앞이 이미 윗줄이면 아랫줄로 돌아온다 */
      const row: 0 | 1 = prev && px(prev.at, e.at) < STACK_PX ? (prev.row === 0 ? 1 : 0) : 0;
      out.push({ at: e.at, labels: [{ at: e.at, label: e.label, kind: e.kind }], row });
    }
    return out;
  })();
  const stacked = grouped.some((g) => g.row === 1);
  /* 호버한 눈금 — 쪽지를 띄운다. native title 은 늦게 뜨고 여러 줄이 안 읽힌다 */
  const [hover, setHover] = useState<string | null>(null);

  return (
    /* 한 줄 캡슐이다 — 안내 문장 줄을 두지 않는다(대상·날짜는 좌측 레일이 말한다 · 2026-09-17 사용자). 눈금 라벨 몫으로 아래만 한 칸.
       모양은 캡슐 카드 + 원형 재생 버튼(2026-09-17 사용자) */
    <div className={cn("pointer-events-auto rounded-full border border-border bg-surface/95 pb-5 pl-2 pr-4 backdrop-blur", stacked ? "pt-9" : events.length ? "pt-5" : "pt-2")} aria-label="시간축">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onTogglePlay}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90"
          aria-label={playing ? "재생 멈춤" : "재생"}
        >
          <Icon icon={playing ? "mdi:pause" : "mdi:play"} className="size-5" aria-hidden />
        </button>
        {/* 시계·경과는 고정 폭 — 값마다 폭이 달라지면 트랙이 좌우로 흔들린다. 둘은 바짝 붙인다(2026-09-17 사용자) */}
        <span className="flex shrink-0 items-baseline gap-1.5">
          <span className="w-[60px] font-mono text-[20px] font-bold leading-none tracking-tight text-foreground tabular-nums">{formatClock(at)}</span>
          <span className={cn("w-[92px] truncate text-left font-mono text-caption", m === 0 ? "text-primary-text" : "text-warning")}>
            {m === 0 ? "현재" : `+${m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60 ? `${m % 60}분` : ""}`.trim() : `${m}분`}`}
          </span>
        </span>

        <span ref={trackRef} className="relative mx-1 h-6 flex-1">
          {/* 지나온 구간 */}
          <i className="absolute left-0 top-[11px] h-1 rounded-full bg-primary" style={{ width: `${(m / span) * 100}%` }} aria-hidden />
          <i className="absolute right-0 top-[11px] h-1 rounded-full bg-border" style={{ left: `${(m / span) * 100}%` }} aria-hidden />
          {/* 조치 눈금 — 트랙 위. 지난 것은 채운 원, 앞의 것은 빈 원. 같은 분의 여러 건은 한 눈금에 개수를 단다(겹치면 못 읽는다). 라벨은 title(호버) */}
          {grouped.map((g) => {
            const passed = pct(g.at) <= (m / span) * 100 + 0.5;
            const on = hover === g.at;
            /* 왼쪽 끝 눈금의 쪽지는 왼쪽으로 잘린다 — 트랙 왼쪽 1/4 안이면 쪽지를 오른쪽으로 연다 */
            const near = pct(g.at) < 25 ? "left-0" : pct(g.at) > 75 ? "right-0" : "left-1/2 -translate-x-1/2";
            return (
              <span key={g.at} className={cn("absolute -translate-x-1/2", g.row === 1 ? "-top-[34px]" : "-top-[16px]")} style={{ left: `${pct(g.at)}%` }}>
                {/* 닷 — 점 하나다. 누르는 자리는 20px 이고 보이는 점은 8px(묶인 건 10px + 링). 무엇인지는 쪽지가 말한다 */}
                <button
                  type="button"
                  onMouseEnter={() => setHover(g.at)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(g.at)}
                  onBlur={() => setHover(null)}
                  onClick={() => onChange(Math.round((new Date(g.at).getTime() - new Date(origin).getTime()) / 60_000))}
                  aria-label={g.labels.map((l) => `${formatClock(l.at)} ${l.label}`).join(", ")}
                  className="flex size-5 cursor-pointer items-center justify-center rounded-full bg-transparent"
                >
                  <span className={cn("block rounded-full border transition-transform",
                    g.labels.length > 1 ? "size-2.5 ring-2 ring-primary-text/30" : "size-2",
                    on && "scale-150",
                    passed ? "border-primary bg-primary" : "border-primary-text bg-surface")} aria-hidden />
                </button>
                {/* 호버 쪽지 — 시각 · 무엇을 · 어떤 대응인지 */}
                {on && (
                  <span className={cn("absolute bottom-[22px] z-10 flex w-max max-w-[260px] flex-col gap-0.5 rounded-md border border-border bg-surface px-2 py-1.5 text-caption shadow-lg", near)} role="tooltip">
                    {g.labels.map((l) => (
                      <span key={`${l.at}-${l.label}`} className="flex items-baseline gap-1.5">
                        <span className="shrink-0 font-mono text-foreground-subtle">{formatClock(l.at)}</span>
                        <span className="min-w-0 break-keep text-foreground">{l.label}</span>
                        {l.kind && <span className="ml-auto shrink-0 text-foreground-subtle">{l.kind}</span>}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            );
          })}
          {/* 눈금이 많으면(폭염 · 시간별 10개) 라벨은 띄엄띄엄 — 다 적으면 겹친다. 눈금 자체는 다 세운다 */}
          {ticks.map((t, i) => (
            <span key={t} className="absolute top-[7px] flex -translate-x-1/2 flex-col items-center" style={{ left: `${pct(t)}%` }} aria-hidden>
              <u className={cn("h-3 w-0.5 rounded-sm", pct(t) <= (m / span) * 100 + 0.5 ? "bg-primary-text" : "bg-border-light")} />
              {(ticks.length <= 6 || i % Math.ceil(ticks.length / 5) === 0) && (
                <span className="mt-0.5 whitespace-nowrap font-mono text-caption text-foreground-subtle">{formatClock(t)}</span>
              )}
            </span>
          ))}
          <input
            type="range"
            min={0}
            max={span}
            step={1}
            value={m}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label="시각 이동"
            className="absolute inset-x-0 top-0 h-6 w-full cursor-pointer appearance-none bg-transparent opacity-0"
          />
        </span>
        <span className="shrink-0 whitespace-nowrap font-mono text-caption text-foreground-subtle">{formatClock(end)}</span>
      </div>
    </div>
  );
}
