/* ─────────────────────────────────────────────
 * 면 범례 — 지도에 색면으로 깔리는 층의 눈금을 한 패널에 (03 §22 A "침수심 범례는 화면에 유지한다" · 2026-09-15 사용자)
 *
 * 켜진 층만 선다. 예측 침수 범위(침수심) · 해안침수예상도(안전지도 5등급) · 강수(mm/h) · 기온(℃).
 * 색은 각 층이 실제로 칠하는 램프·페인트 함수 그대로 가져온다 — 범례 색을 따로 적으면 두 벌이 된다.
 * 좌상단 광역 인셋이 그리는 층(광역 강우 · 풍향장 · 열돔)도 여기 선다(2026-09-16 사용자
 * "전역지도패널에 강우 또는 열섬 등등이 노출되는거면 범례영역에도 추가해줘"). 인셋도 지도라 눈금이 필요하다.
 * ───────────────────────────────────────────── */

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { GlassPanel } from "@ds";
import { depthLevel, extentPaint, scopePaint, type ExtentTone, type PolygonPaint } from "../../lib/map-polygon";
import { FLOOD_DEPTH_LEGEND } from "../../lib/safemap";
import { RAIN_RAMP } from "../../lib/precipitation-layer";
import { TEMP_RAMP } from "../../lib/temperature-layer";
import { loadTemperatureField, temperatureRange } from "../../lib/temperature-field";
import { HOT_AREA_PAINT, SHELTER_DOT } from "../../lib/heat-paint";

const DEPTH_STOPS = [0.1, 0.3, 0.5];

export interface MapLegendProps {
  /** 예측 침수 범위(물 유형) */
  depth?: { label: string } | null;
  official?: boolean;
  rain?: boolean;
  temp?: boolean;
  wind?: boolean;
  /** 사건 범위 링(빨간 점선) */
  scope?: boolean;
  /** 영향 범위 — 물 유형은 침수심 줄이 대신하므로 색 하나만 쓰는 유형에서 준다 */
  extent?: { label: string; tone: ExtentTone } | null;
  /** 좌상단 광역 인셋이 그리는 층 — 강우 격자 · 풍향장 · 열돔 */
  inset?: "rain" | "wind" | "globe" | null;
  /** 폭염 탭 — 체감온도 색면(램프 양끝은 자료 범위) · 고온 지속 지역 면 · 무더위쉼터 점 */
  feel?: { min: number; max: number } | null;
  hot?: boolean;
  shelter?: boolean;
}

/**
 * 켜진 층은 모두 선다(2026-09-16 사용자 "화면에 나와있는 레이어가 다 범례에 나와야 하지 않나").
 * 다만 장비 핀·대피 시설은 핀마다 이름표가 붙어 스스로 읽히므로 넣지 않는다 — 범례가 조작판의 복제가 되면 지도를 덮는다.
 */
export function MapLegend({ depth, official, rain, temp, wind, scope, extent, inset, feel, hot, shelter }: MapLegendProps) {
  const tempRange = useTemperatureRange(Boolean(temp));
  if (!depth && !official && !rain && !temp && !wind && !scope && !extent && !inset && !feel && !hot && !shelter) return null;
  return (
    <GlassPanel className="pointer-events-auto flex w-full flex-col gap-1.5 px-2.5 py-2" aria-label="면 범례">
      {/* 이름이 곧 설명이라 문장을 덧붙이지 않는다 — 줄이 접혀 범례가 두 배가 됐다(2026-09-16 사용자 "글줄 정리 좀") */}
      {scope && (
        <Row title="사건 범위">
          <Swatch paint={scopePaint()} dashed />
        </Row>
      )}
      {extent && (
        <Row title={extent.label}>
          <Swatch paint={extentPaint(0.45, extent.tone)} dashed />
        </Row>
      )}
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
      {/* 광역 인셋 — 메인 지도의 층과 같은 램프를 쓴다. 메인에 같은 층이 켜져 있으면 겹쳐 적지 않는다 */}
      {inset === "rain" && !rain && (
        <Row title="광역 강우">
          <Ramp colors={RAIN_RAMP} from="0.5" to="30 mm/h 이상" />
        </Row>
      )}
      {inset === "wind" && (
        <Row title="광역 풍향">
          <span className="flex items-center gap-1.5 text-caption text-foreground-muted">
            <Icon icon="mdi:arrow-right-thin" className="size-4 text-primary-text" aria-hidden />
            방향 = 풍향 · 속도 = 풍속
          </span>
        </Row>
      )}
      {inset === "globe" && (
        <Row title="열돔">
          <span className="whitespace-nowrap text-caption text-foreground-muted">붉을수록 상층 기압이 높다</span>
        </Row>
      )}
      {temp && (
        <Row title="기온">
          <Ramp colors={TEMP_RAMP} from={tempRange ? `${tempRange.min.toFixed(0)}℃` : "낮음"} to={tempRange ? `${tempRange.max.toFixed(0)}℃` : "높음"} />
        </Row>
      )}
      {feel && (
        <Row title="체감온도">
          <Ramp colors={TEMP_RAMP} from={`${feel.min}℃`} to={`${feel.max}℃`} />
        </Row>
      )}
      {hot && (
        <Row title="고온 지속">
          <Swatch paint={HOT_AREA_PAINT()} />
          <span className="text-caption text-foreground-muted">33℃↑ 3시간 넘게</span>
        </Row>
      )}
      {shelter && (
        <Row title="무더위쉼터">
          {([["운영 중", SHELTER_DOT.open], ["종료", SHELTER_DOT.closed], ["야간 개방", SHELTER_DOT.night]] as const).map(([label, d]) => (
            <span key={label} className="flex items-center gap-1 text-caption text-foreground-muted">
              <span className="inline-block shrink-0 rounded-full border" style={{ width: d.radius * 2 + 2, height: d.radius * 2 + 2, backgroundColor: d.color(), opacity: d.opacity, borderColor: SHELTER_DOT.stroke() }} aria-hidden />
              {label}
            </span>
          ))}
        </Row>
      )}
      {wind && (
        <Row title="바람">
          <span className="flex items-center gap-1.5 text-caption text-foreground-muted">
            <Icon icon="mdi:arrow-right-thin" className="size-4 text-primary-text" aria-hidden />
            방향 = 풍향 · 속도 = 풍속
          </span>
        </Row>
      )}
    </GlassPanel>
  );
}

/** 단색 면 견본 — 지도가 칠하는 페인트 그대로 */
function Swatch({ paint, dashed }: { paint: PolygonPaint; dashed?: boolean }) {
  return (
    <span
      className="inline-block size-3.5 shrink-0 rounded-sm border"
      style={{ backgroundColor: paint.fill, opacity: Math.min(1, paint.opacity * 2.2), borderColor: paint.line, borderStyle: dashed ? "dashed" : "solid" }}
      aria-hidden
    />
  );
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[72px] shrink-0 truncate text-caption font-semibold text-foreground">{title}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2">{children}</div>
    </div>
  );
}

/** 시퀀셜 램프 — 층이 쓰는 색 배열 그대로 그라데이션 */
function Ramp({ colors, from, to }: { colors: readonly string[]; from: string; to: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap font-mono text-caption text-foreground-muted">
      {from}
      <span className="inline-block h-3 w-14 shrink-0 rounded-sm" style={{ background: `linear-gradient(90deg, ${colors.join(", ")})`, opacity: 0.85 }} aria-hidden />
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
