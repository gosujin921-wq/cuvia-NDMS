/* ─────────────────────────────────────────────
 * 열돔 판독 — 창원 상공 두 층의 값과 판정
 *
 * 이 화면이 답해야 하는 것은 하나다: **창원이 두 층 모두 안쪽인가.**
 * 그 한 문장을 내는 부분만 떼어 두어, 지도를 붙이는 자리(미리보기)와 안 붙이는 자리
 * (디지털트윈 곁 패널)가 같은 markup 을 쓴다.
 *
 * 값의 뜻은 dome-layer.ts 머리말에 있다 — 두 숫자 모두 **지면에서부터** 잰 공기 기둥의
 * 부풀음이지 뚜껑의 아래판·윗판이 아니다.
 * ───────────────────────────────────────────── */

import type { LayerReading } from "./useHeatDomeData";

export interface HeatDomeReadoutProps {
  readings: LayerReading[];
  /** 두 층 모두 안쪽인가 */
  deep: boolean;
}

export function HeatDomeReadout({ readings, deep }: HeatDomeReadoutProps) {
  return (
    <>
      <div className="flex flex-col gap-1">
        {readings.map((r) => (
          <div key={r.spec.id} className="flex items-baseline justify-between gap-3">
            <span className="text-caption text-foreground-subtle">
              {r.spec.label}
              <span className="ml-1 opacity-70">{r.reach}</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="font-mono text-body font-semibold tabular-nums">
                {Math.round(r.value).toLocaleString()}
              </span>
              {/* 기준선과의 차 — 값보다 이 부호가 판정을 만든다 */}
              <span
                className="w-10 text-right font-mono text-caption tabular-nums"
                style={{ color: r.inside ? "var(--color-risk-lv5)" : "var(--color-risk-lv2)" }}
              >
                {r.inside ? "+" : ""}
                {r.margin.toLocaleString()}
              </span>
            </span>
          </div>
        ))}
      </div>

      <p
        className="mt-2 border-t border-border pt-1.5 text-caption font-semibold"
        style={{ color: deep ? "var(--color-risk-lv5)" : "var(--color-risk-lv3)" }}
      >
        {deep ? "두 층 모두 안쪽 — 깊은 돔" : "한 층만 안쪽 — 얕다"}
      </p>
    </>
  );
}
