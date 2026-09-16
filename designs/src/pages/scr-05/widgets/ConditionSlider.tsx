/* ─────────────────────────────────────────────
 * 조건 슬라이더 — 훈련을 더 어렵게 (03 §26.6 · 2026-09-16)
 *
 * "강수량을 세게 해 본다"가 손에 잡혀야 한다. 카드 두세 장으로 고르는 것보다 슬라이더가 그 감각에 맞는다.
 *   ★ **판이 있는 값에만 멈춘다.** 사이 값으로 끌어도 가장 가까운 단계로 붙는다 —
 *     계산 경로가 없는 값을 만들지 않는다(README §2.3 기준 ③).
 * 네이티브 range 를 쓴다(step=1). 드래그·클릭·좌우 키가 모두 따라오고 접근성도 그대로다.
 * ───────────────────────────────────────────── */

import { cn } from "@ds";

export interface ConditionStep {
  id: string;
  label: string;
  detail: string;
}

export function ConditionSlider({ label, steps, value, onChange }: {
  label: string;
  steps: ConditionStep[];
  value: string;
  onChange: (id: string) => void;
}) {
  const index = Math.max(0, steps.findIndex((s) => s.id === value));
  const last = Math.max(1, steps.length - 1);
  const at = (i: number) => (i / last) * 100;
  const cur = steps[index];

  return (
    <div className="flex flex-col gap-1">
      <span className="text-caption text-foreground-muted">{label}</span>

      <div className="relative px-1 pb-1 pt-2">
        {/* 단계 눈금 — 멈출 수 있는 자리 */}
        <div className="pointer-events-none absolute inset-x-1 top-[14px] h-1 rounded-full bg-border" aria-hidden>
          <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${at(index)}%` }} />
          {steps.map((s, i) => (
            <span key={s.id} className={cn("absolute top-[-4px] h-3 w-0.5 rounded-sm", i <= index ? "bg-primary-text" : "bg-border-light")} style={{ left: `${at(i)}%` }} />
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={index}
          onChange={(e) => onChange(steps[Number(e.target.value)]?.id ?? value)}
          aria-label={`${label} 조건`}
          aria-valuetext={`${cur?.label} ${cur?.detail}`}
          className="slider-range relative z-10 h-4 w-full cursor-pointer appearance-none bg-transparent"
        />
      </div>

      <div className="flex justify-between px-1 font-mono">
        {steps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            aria-pressed={i === index}
            className={cn("cursor-pointer rounded px-1 text-center font-mono text-caption transition-colors",
              i === index ? "font-bold text-primary-text" : "text-foreground-subtle hover:text-foreground-muted")}
          >
            {s.label}
          </button>
        ))}
      </div>
      {/* 고른 단계가 무엇인지 한 줄로 — 눈금에 값까지 적으면 글줄이 겹친다 */}
      {cur && <p className="break-keep px-1 text-caption text-foreground-subtle">{cur.detail}</p>}
    </div>
  );
}
