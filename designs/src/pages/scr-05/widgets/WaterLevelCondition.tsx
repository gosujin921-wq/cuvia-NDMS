/* ─────────────────────────────────────────────
 * 수위 조건 — 폭풍해일 · 하천범람 · 내수침수의 조건 패널 (03 화면정의서 §5)
 *
 * 값은 수면 표고(EL.m)로 읽는다. 숫자 없이 물결만 올라가면 "얼마나 차오른 것인지"가
 * 남지 않는다. 그 값이 이 지구의 어느 단계에 해당하는지도 함께 붙인다.
 *
 * ★ 이 부품은 조건 패널의 **한 종류**다. 재난유형이 바뀌면 통째로 다른 부품이 선다
 *   (ConditionPanel). 화학 누출이면 풍향·풍속·누출 지속시간, 산불이면 풍향·습도·확산
 *   시간이 조절 대상이고, 그건 수위 슬라이더로 흉내낼 수 있는 것이 아니다.
 *
 * step 은 0.01 이다(03 §5 · 차수 K) — 정본 수치(3.41 · 4.24)를 손으로도 맞출 수 있어야
 * "시나리오 값은 조건 축 위의 한 점"이라는 말이 성립한다. 프리셋과 시나리오 표식 클릭은
 * 그 점으로 정확히 점프하는 길이다.
 * ───────────────────────────────────────────── */

import { Button } from "@ds";
import { ALERT_LEVELS } from "../../../demo/levels";
import type { ConditionSpec } from "../../../demo/analysis";

/** 조건 프리셋 — [현재 조건 3.41] · [만조 조건 4.24] (03 §5 · 04 §10-3) */
export interface ConditionPreset {
  label: string;
  value: number;
}

interface WaterLevelConditionProps {
  spec: ConditionSpec;
  value: number;
  onChange: (next: number) => void;
  /** 조건 시나리오 표식 (04 §9·§10) — 클릭하면 그 값으로 점프한다 */
  marker?: { value: number; label: string };
  presets?: ConditionPreset[];
}

/** 이 값이 어느 단계인가 */
function levelAt(value: number, threshold: ConditionSpec["threshold"]) {
  if (value >= threshold.evacuate) return ALERT_LEVELS[2];
  if (value >= threshold.warning) return ALERT_LEVELS[1];
  if (value >= threshold.advisory) return ALERT_LEVELS[0];
  return null;
}

/** 프리셋과 같은 값인가 — 0.01 스텝이라 부동소수 비교 대신 반 스텝으로 본다 */
export function isPreset(value: number, preset: number) {
  return Math.abs(value - preset) < 0.005;
}

export function WaterLevelCondition({
  spec,
  value,
  onChange,
  marker,
  presets,
}: WaterLevelConditionProps) {
  const level = levelAt(value, spec.threshold);
  const markerPct = marker
    ? Math.min(100, Math.max(0, ((marker.value - spec.min) / (spec.max - spec.min)) * 100))
    : null;

  /* 지금 선 자리가 프리셋인가 사용자 조건인가 — 값 옆에 이름을 붙여 준다.
     "4.24" 만 있으면 그게 만조 조건인지 손으로 민 값인지 화면에 남지 않는다 */
  const activePreset = presets?.find((preset) => isPreset(value, preset.value));

  return (
    <section className="flex flex-col gap-2 p-3" aria-label="분석 조건">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-body font-semibold text-foreground">{spec.title}</h2>
        <span className="flex items-baseline gap-1">
          <span className="font-mono text-h5 font-semibold text-foreground">{value.toFixed(2)}</span>
          <span className="text-caption text-foreground-muted">{spec.unit}</span>
        </span>
      </header>

      <div className="relative">
        {/* 시나리오 표식 — 트랙 위 세로선 + 라벨. 장식이 아니라 조작 대상이다(03 §5).
            시나리오와 조건 축은 같은 what-if 의 언어고, 이 값은 그 위의 한 점이다(04 §10-3) */}
        {markerPct !== null && marker && (
          <button
            type="button"
            onClick={() => onChange(marker.value)}
            aria-label={`${marker.label} 값으로 설정`}
            className="absolute -top-4 z-10 flex -translate-x-1/2 cursor-pointer flex-col items-center"
            style={{ left: `${markerPct}%` }}
          >
            <span className="whitespace-nowrap text-caption font-medium text-primary-text">
              {marker.label}
            </span>
            <span className="h-5 w-px bg-primary-text" aria-hidden />
          </button>
        )}
        <input
          type="range"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={spec.title}
          className={marker ? "mt-5 w-full accent-primary" : "w-full accent-primary"}
        />
      </div>

      {/* 프리셋 — 현재와 조건의 비교가 클릭 한 번이다(03 §5). 선택된 값은 채워서 세운다 */}
      {presets && presets.length > 0 && (
        <div className="flex items-center gap-1.5">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              variant={isPreset(value, preset.value) ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => onChange(preset.value)}
            >
              {preset.label}
            </Button>
          ))}
          {/* 프리셋 밖으로 민 값 — 누를 것이 아니라 지금 어디에 서 있는지의 표시다 */}
          {!activePreset && (
            <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-caption text-foreground-muted">
              사용자 조건
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-caption">
        <span className="text-foreground-subtle">{spec.min}</span>
        {level ? (
          <span className="font-medium" style={{ color: level.color }}>
            {level.label} 구간 ({spec.threshold[level.id]} {spec.unit} 이상)
          </span>
        ) : (
          <span className="text-foreground-subtle">
            주의보 기준 {spec.threshold.advisory} {spec.unit} 아래
          </span>
        )}
        <span className="text-foreground-subtle">{spec.max.toFixed(1)}</span>
      </div>
    </section>
  );
}
