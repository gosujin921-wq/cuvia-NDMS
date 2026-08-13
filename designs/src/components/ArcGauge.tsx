/* ─────────────────────────────────────────────
 * 반원 게이지 — 수준 표시
 *
 * IDC SCR-01 `ArcGauge` 이식(원본은 cuvia3(secon) 관제 LeftPanel 어휘).
 * 그라데이션 아크(success→warning→danger) + 바늘 + 중앙 상태 칩.
 * 트랙은 surface-raised, 칩은 카드 배경 + 톤 보더·텍스트(색 배경 금지 규칙 · 03 §0-3).
 * 값 전환은 1s ease-out.
 *
 * 이 데모에서는 등급(관심·주의·경계·심각 등)을 0~100 으로 환산해 넘긴다(04 §5).
 * 계측 단계(주의보·경보·대피)는 이 게이지를 쓰지 않는다 — 그 축은 핀·뱃지 몫이다(03 §0-8).
 * ───────────────────────────────────────────── */

import { useEffect, useId, useState } from "react";
import { cn } from "@ds";

export type GaugeTone = "normal" | "warning" | "danger";

/** 상태 칩 톤 — 어두운 면 위 가독을 위해 경고·위험은 파스텔 텍스트 토큰 */
const CHIP_TONE: Record<GaugeTone, string> = {
  normal: "border-success/40 text-success",
  warning: "border-warning/40 text-warning-text",
  danger: "border-danger/40 text-danger-text",
};

/** 마운트 후 한 프레임 뒤에 실값으로 전환해 아크·바늘이 0에서 차오르게 한다 */
function useDrawnValue(value: number) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return drawn ? Math.max(0, Math.min(100, value)) : 0;
}

interface ArcGaugeHeroProps {
  /** 0~100 */
  value: number;
  label: string;
  /** 중앙 상태 칩 문구 (정상·주의 등) */
  chipLabel: string;
  chipTone: GaugeTone;
  /** 게이지 폭(px). 높이는 반원 비율로 따라간다 */
  size?: number;
}

/** 그라데이션 반원 + 바늘 + 상태 칩 */
export function ArcGaugeHero({
  value,
  label,
  chipLabel,
  chipTone,
  size = 150,
}: ArcGaugeHeroProps) {
  const gradientId = useId();
  const drawn = useDrawnValue(value);

  /* 기준 좌표계 140×90 (반지름 50 · 피벗 70,65 · 아크 길이 ≈157) 을 size 로 비례 확대 */
  const s = size / 140;
  const h = 90 * s;
  const r = 50 * s;
  const cx = 70 * s;
  const cy = 65 * s;
  const stroke = 12 * s;
  const arcLen = Math.PI * r;

  return (
    <div
      className="relative"
      style={{ width: size, height: h }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      aria-valuetext={chipLabel}
    >
      <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: "var(--color-success)" }} />
            <stop offset="50%" style={{ stopColor: "var(--color-warning)" }} />
            <stop offset="100%" style={{ stopColor: "var(--color-danger)" }} />
          </linearGradient>
        </defs>

        {/* 트랙 */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="var(--color-surface-raised)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* 컬러 아크 */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={arcLen}
          strokeDashoffset={arcLen - arcLen * (drawn / 100)}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
        {/* 바늘 */}
        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            transform: `rotate(${-90 + 180 * (drawn / 100)}deg)`,
            transition: "transform 1s ease-out",
          }}
        >
          <line
            x1={cx}
            y1={cy}
            x2={cx}
            y2={cy - r + stroke}
            stroke="var(--color-foreground)"
            strokeWidth={3 * s}
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r={6 * s} fill="var(--color-foreground)" />
        </g>
      </svg>

      {/* 상태 칩 — 바늘 피벗 아래 중앙 */}
      <div className="absolute left-1/2 top-1/2 mt-2 -translate-x-1/2 -translate-y-1/2">
        <span
          className={cn(
            "inline-flex items-center rounded-full border bg-card px-2 py-0.5 text-caption font-medium leading-none",
            CHIP_TONE[chipTone],
          )}
        >
          {chipLabel}
        </span>
      </div>
    </div>
  );
}
