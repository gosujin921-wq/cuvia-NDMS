/* ─────────────────────────────────────────────
 * 광역 맥락 인셋 — "왜 지금 이런 조건인가" (03 §23)
 *
 * 메인 지도가 "그래서 선택한 지역에 어떤 일이 생기는가"를 보이고, 이 작은 지도가 광역 원인을 보인다.
 * 항상 서지 않는다 — 광역 원인이 장면 이해에 도움이 되는 유형(A~F)에서만 세우고 G 는 계통도가 그 자리다.
 *   A · B · F   광역 강우 분포 (강수 격자 · 시각 동기)
 *   C · D       광역 풍향장 (바람 입자)
 *   E           열돔 지구본 (상층 기압 높이 · 자기 시간축)
 * 선택 지역 위치를 항상 표시한다. 누르면 커진다(메인 전환은 두지 않는다 — 인셋은 원인, 메인은 결과).
 * 값을 새로 계산하지 않는다. 기존 기상 층과 열돔 부품을 그대로 쓴다.
 * ───────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { Icon } from "@iconify/react";
import { GlassPanel, cn } from "@ds";
import type { TwinFamily } from "../../model/incident";
import type { LngLat } from "../../model/scene";
import { useMapLibre } from "../../lib/useMapLibre";
import { useWindLayer } from "../../lib/useWindLayer";
import { usePrecipitationLayer } from "../../lib/usePrecipitationLayer";
import { CITY_SHAPE_BOUNDS } from "../../lib/map-config";
import { HeatDomeGlobe, type HeatDomeData } from "../heat-dome";

type InsetKind = "rain" | "wind" | "globe";
const KIND: Partial<Record<TwinFamily, InsetKind>> = { A: "rain", B: "rain", F: "rain", C: "wind", D: "wind", E: "globe" };
const TITLE: Partial<Record<TwinFamily, string>> = { A: "광역 강우 분포", B: "유역 강우", C: "광역 풍향", D: "광역 풍향", E: "열돔 · 상층 기압 높이", F: "누적 강우" };

/** 작은 상태 — 좌측 열 폭(lib/layout LEFT_RAIL)과 같다. 열 안의 날씨·범례와 너비를 맞춘다 */
export const INSET_SIZE = { w: 300, h: 188 };
const BIG = { w: 480, h: 300 };

export function insetKindOf(family: TwinFamily): InsetKind | null {
  return KIND[family] ?? null;
}

interface ContextInsetProps {
  family: TwinFamily;
  /** 선택 지역 위치 — 인셋에 항상 표시 */
  anchor: LngLat;
  /** 시각 동기 — 강수 격자가 이 시각을 그린다 */
  hour: number;
  /** E 열돔 자료. 페이지가 하나만 들고 나눠 준다 */
  dome?: HeatDomeData;
  /** 시각 라벨 — 머리 오른쪽 */
  meta?: string;
  /**
   * 그 사건이 아는 바람 — 풍향 인셋(C·D)이 이 값으로 흐른다.
   * 없으면 광역 격자를 쓰는데, 그 격자는 태풍 솔릭 한 사건의 자료라 **다른 사건에서는 방향이 거짓**이다.
   * 메인 지도의 풍향 화살표와 인셋 입자가 어긋나면 화면을 믿을 수 없게 된다(2026-09-17).
   */
  wind?: { bearing: number; speed: number } | null;
}

export function ContextInset({ family, anchor, hour, dome, meta, wind }: ContextInsetProps) {
  const kind = insetKindOf(family);
  /* 기본은 작은 상태 — 인셋은 원인 맥락이고 판단은 메인 지도에서 한다(03 §23). 누르면 커진다 */
  const [big, setBig] = useState(false);
  if (!kind) return null;
  const size = big ? BIG : INSET_SIZE;
  return (
    <GlassPanel className="pointer-events-auto flex flex-col overflow-hidden" style={{ width: size.w }}>
      <button type="button" onClick={() => setBig((v) => !v)} className="flex cursor-pointer items-center justify-between gap-2 border-none bg-transparent px-2.5 py-1.5 text-left hover:bg-surface-raised" aria-label={big ? "인셋 줄이기" : "인셋 키우기"}>
        <span className="flex min-w-0 items-center gap-1.5 text-caption font-semibold text-foreground">
          <Icon icon="mdi:earth" className="size-4 shrink-0 text-foreground-subtle" aria-hidden />
          <span className="truncate">{TITLE[family]}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-caption text-foreground-subtle">
          {meta}
          <Icon icon={big ? "mdi:arrow-collapse" : "mdi:arrow-expand"} className="size-3.5" aria-hidden />
        </span>
      </button>
      <div className="relative" style={{ height: size.h }}>
        {kind === "globe" ? (
          dome && <HeatDomeGlobe lower={dome.lower} upper={dome.upper} index={dome.index} variant="panel" showGrid={big} className="absolute inset-0" style={{ height: "100%" }} />
        ) : (
          <InsetMap kind={kind} anchor={anchor} hour={hour} big={big} wind={wind} />
        )}
      </div>
    </GlassPanel>
  );
}

/** 시 전체를 담은 작은 지도 + 선택 지역 표식. 조작은 막는다 — 인셋은 읽는 것이다 */
function InsetMap({ kind, anchor, hour, big, wind }: { kind: "rain" | "wind"; anchor: LngLat; hour: number; big: boolean; wind?: { bearing: number; speed: number } | null }) {
  const container = useRef<HTMLDivElement>(null);
  const { map, ready } = useMapLibre(container, { zoom: 9, pitch: 0 });
  useWindLayer(map, ready, kind === "wind", kind === "wind" ? wind : null);
  usePrecipitationLayer(map, ready, kind === "rain", hour);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    instance.scrollZoom.disable(); instance.dragPan.disable(); instance.dragRotate.disable(); instance.doubleClickZoom.disable(); instance.touchZoomRotate.disable(); instance.keyboard.disable();
    instance.resize();
    instance.fitBounds(CITY_SHAPE_BOUNDS, { padding: 6, duration: 0 });
  }, [map, ready, big]);

  /* 선택 지역 표식 — 위치는 앵커, 모양은 링 하나 */
  const [host] = useState(() => { const el = document.createElement("div"); el.style.pointerEvents = "none"; return el; });
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    const marker = new maplibregl.Marker({ element: host, anchor: "center" }).setLngLat(anchor).addTo(instance);
    return () => { marker.remove(); };
  }, [map, ready, host, anchor]);
  useEffect(() => {
    host.className = "flex items-center justify-center";
    host.innerHTML = "";
    const ring = document.createElement("div");
    ring.className = cn("size-4 rounded-full border-2 border-primary bg-primary/30 shadow");
    host.appendChild(ring);
  }, [host]);

  /* .maplibregl-map 이 position:relative 를 덮어써서 inset-0 이 안 먹는다 — 크기를 직접 준다 */
  return <div ref={container} className="h-full w-full" />;
}
