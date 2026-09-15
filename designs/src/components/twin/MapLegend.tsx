/* ─────────────────────────────────────────────
 * 면 범례 — 지도에 색면으로 깔리는 층의 눈금을 한 패널에 (03 §22 A "침수심 범례는 화면에 유지한다" · 2026-09-15 사용자)
 *
 * 켜진 층만 선다. 예측 침수 범위(침수심) · 해안침수예상도(안전지도 5등급) · 강수(mm/h) · 기온(℃).
 * 색은 각 층이 실제로 칠하는 램프·페인트 함수 그대로 가져온다 — 범례 색을 따로 적으면 두 벌이 된다.
 * 바람은 면이 아니라 입자라 여기 없다.
 * ───────────────────────────────────────────── */

import { useEffect, useState } from "react";
import { GlassPanel } from "@ds";
import { depthLevel, extentPaint } from "../../lib/map-polygon";
import { FLOOD_DEPTH_LEGEND } from "../../lib/safemap";
import { RAIN_RAMP } from "../../lib/precipitation-layer";
import { TEMP_RAMP } from "../../lib/temperature-layer";
import { loadTemperatureField, temperatureRange } from "../../lib/temperature-field";

const DEPTH_STOPS = [0.1, 0.3, 0.5];

export interface MapLegendProps {
  /** 예측 침수 범위(물 유형) */
  depth?: { label: string } | null;
  official?: boolean;
  rain?: boolean;
  temp?: boolean;
}

export function MapLegend({ depth, official, rain, temp }: MapLegendProps) {
  const tempRange = useTemperatureRange(Boolean(temp));
  if (!depth && !official && !rain && !temp) return null;
  return (
    <GlassPanel className="pointer-events-auto flex w-full flex-col gap-1.5 px-2.5 py-2" aria-label="면 범례">
      {depth && (
        <Row title={depth.label}>
          {DEPTH_STOPS.map((d) => {
            const paint = extentPaint(depthLevel(d), "water");
            return (
              <span key={d} className="flex items-center gap-1 font-mono text-caption text-foreground-muted">
                <span className="inline-block size-3.5 rounded-sm border" style={{ backgroundColor: paint.fill, opacity: Math.min(1, paint.opacity * 1.9), borderColor: paint.line }} aria-hidden />
                {d.toFixed(1)}
              </span>
            );
          })}
          <span className="text-caption text-foreground-subtle">m 이상</span>
        </Row>
      )}
      {official && (
        <Row title="해안침수예상도">
          {FLOOD_DEPTH_LEGEND.map((l) => (
            <span key={l.label} className="flex items-center gap-1 text-caption text-foreground-muted">
              <span className="inline-block size-3.5 rounded-sm" style={{ backgroundColor: l.color, opacity: 0.6 }} aria-hidden />
              {l.label}
            </span>
          ))}
        </Row>
      )}
      {rain && (
        <Row title="강수">
          <Ramp colors={RAIN_RAMP} from="0.5" to="30 mm/h 이상" />
        </Row>
      )}
      {temp && (
        <Row title="기온">
          <Ramp colors={TEMP_RAMP} from={tempRange ? `${tempRange.min.toFixed(0)}℃` : "낮음"} to={tempRange ? `${tempRange.max.toFixed(0)}℃` : "높음"} />
        </Row>
      )}
    </GlassPanel>
  );
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[88px] shrink-0 text-caption font-semibold text-foreground">{title}</span>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">{children}</div>
    </div>
  );
}

/** 시퀀셜 램프 — 층이 쓰는 색 배열 그대로 그라데이션 */
function Ramp({ colors, from, to }: { colors: readonly string[]; from: string; to: string }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-caption text-foreground-muted">
      {from}
      <span className="inline-block h-3 w-20 rounded-sm" style={{ background: `linear-gradient(90deg, ${colors.join(", ")})`, opacity: 0.85 }} aria-hidden />
      {to}
    </span>
  );
}

/** 기온 층이 그리는 시각(자료 기본 시각)의 최소·최대 — 램프 양끝이 자료 범위에 맞춰지므로 범례도 그 값을 적는다 */
function useTemperatureRange(enabled: boolean) {
  const [range, setRange] = useState<{ min: number; max: number } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadTemperatureField().then((field) => {
      if (cancelled) return;
      setRange(temperatureRange(field, Math.max(0, field.hours.indexOf(field.defaultHour))));
    }).catch(() => setRange(null));
    return () => { cancelled = true; };
  }, [enabled]);
  return range;
}
