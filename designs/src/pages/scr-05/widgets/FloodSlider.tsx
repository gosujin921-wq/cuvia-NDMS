/* ─────────────────────────────────────────────
 * 침수 슬라이더 — 03 화면정의서 §5 우하단
 *
 * 값은 수위(EL.m)로 읽는다. 숫자 없이 물결만 올라가면 "얼마나 차오른 것인지"가 남지 않는다.
 * 그 값이 이 지구의 어느 단계에 해당하는지도 함께 붙인다.
 * ───────────────────────────────────────────── */

import { ALERT_LEVELS, type WaterThreshold } from "../../../demo/levels";

interface FloodSliderProps {
  value: number;
  max: number;
  disabled?: boolean;
  threshold: WaterThreshold;
  onChange: (next: number) => void;
}

/** 이 수위가 어느 단계인가 */
function levelAt(value: number, threshold: WaterThreshold) {
  if (value >= threshold.evacuate) return ALERT_LEVELS[2];
  if (value >= threshold.warning) return ALERT_LEVELS[1];
  if (value >= threshold.advisory) return ALERT_LEVELS[0];
  return null;
}

export function FloodSlider({ value, max, disabled, threshold, onChange }: FloodSliderProps) {
  const level = levelAt(value, threshold);

  return (
    <section className="flex flex-col gap-2 p-3" aria-label="범람시 침수 예상범위">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-body font-semibold text-foreground">침수 예상 수위</h2>
        <span className="flex items-baseline gap-1">
          <span className="font-mono text-h5 font-semibold text-foreground">
            {value.toFixed(1)}
          </span>
          <span className="text-caption text-foreground-muted">EL.m</span>
        </span>
      </header>

      <input
        type="range"
        min={0}
        max={max}
        step={0.1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="침수 예상 수위"
        className="w-full accent-primary disabled:opacity-40"
      />

      <div className="flex items-center justify-between text-caption">
        <span className="text-foreground-subtle">0</span>
        {level ? (
          <span className="font-medium" style={{ color: level.color }}>
            {level.label} 구간 ({threshold[level.id]} EL.m 이상)
          </span>
        ) : (
          <span className="text-foreground-subtle">
            주의보 기준 {threshold.advisory} EL.m 아래
          </span>
        )}
        <span className="text-foreground-subtle">{max.toFixed(1)}</span>
      </div>

      {disabled && (
        <p className="text-caption text-foreground-subtle">
          레이어에서 범람시 침수 예상범위를 켜면 조절할 수 있습니다.
        </p>
      )}
    </section>
  );
}
