/* ─────────────────────────────────────────────
 * 시간축 — 지도 하단 (scr-00 · 2026-09-17)
 *
 * `현재 ───── 미래`. 연속 슬라이더다. 정지점이 없다 — 시뮬레이션은 조치를 정하는 자리가 아니라 결과를 읽는 자리라
 * 시간을 되돌려도 고장이 아니다(모의훈련 시계와 다른 점). 판의 눈금은 눈금 표시로만 선다.
 * 재생은 끝에 닿으면 처음부터 되풀이한다(멈출 때까지 · 2026-09-17 사용자 "모든 애니메이션은 루프").
 * // TODO(ds): 슬라이더 부품이 DS 에 없어 native range 를 쓴다. DS 승격 대상
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { cn } from "@ds";
import { formatClock } from "../../../lib/datetime";

export function TimeAxis({ origin, end, ticks, minutes, onChange, playing, onTogglePlay }: {
  /** 현재(시작) · 지평선 끝 */
  origin: string;
  end: string;
  /** 판의 눈금 시각 — 표시만 */
  ticks: string[];
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

  return (
    /* 한 줄 캡슐이다 — 안내 문장 줄을 두지 않는다(대상·날짜는 좌측 레일이 말한다 · 2026-09-17 사용자). 눈금 라벨 몫으로 아래만 한 칸.
       모양은 캡슐 카드 + 원형 재생 버튼(2026-09-17 사용자) */
    <div className="pointer-events-auto rounded-full border border-border bg-surface/95 pb-5 pl-2 pr-4 pt-2 backdrop-blur" aria-label="시간축">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onTogglePlay}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90"
          aria-label={playing ? "재생 멈춤" : "재생"}
        >
          <Icon icon={playing ? "mdi:pause" : "mdi:play"} className="size-5" aria-hidden />
        </button>
        <span className="font-mono text-[20px] font-bold leading-none tracking-tight text-foreground tabular-nums">{formatClock(at)}</span>
        <span className={cn("shrink-0 rounded border px-1.5 py-0.5 text-caption", m === 0 ? "border-primary-text text-primary-text" : "border-warning text-warning")}>
          {m === 0 ? "현재" : `+${m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60 ? `${m % 60}분` : ""}`.trim() : `${m}분`}`}
        </span>

        <span className="relative mx-1 h-6 flex-1">
          {/* 지나온 구간 */}
          <i className="absolute left-0 top-[11px] h-1 rounded-full bg-primary" style={{ width: `${(m / span) * 100}%` }} aria-hidden />
          <i className="absolute right-0 top-[11px] h-1 rounded-full bg-border" style={{ left: `${(m / span) * 100}%` }} aria-hidden />
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
