/* ─────────────────────────────────────────────
 * 침수 시뮬레이션 — /scr-00 의 침수 탭 (2026-09-17)
 *
 *   실제 사건 데이터 → 트윈에서 사건 재현(기준) → 조건 변경(A · B) → 결과 계산 → 기준과 비교 → 관련 SOP 판단
 *
 * 좌: 대상 · 시나리오 · 고른 조건      중앙: 지도(지형 수면) + 종단도(있으면) + 시간축      우: 비교표 · 그 시각 · 영향 객체 · 관련 SOP · 근거
 * ★ 상태는 `대상 · 시나리오 · 시각` 셋뿐이고 나머지는 전부 계산이다. 조치를 정하는 자리가 아니라 결과를 읽는 자리라 정지점이 없다.
 * ★ "과거 재현"은 메인이 아니다. 기준을 설명하는 자리이고, 메인은 "그때 조건이 달랐다면"이다.
 * ───────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import maplibregl from "maplibre-gl";
import { GlassPanel } from "@ds";
import { useMapLibre } from "../../lib/useMapLibre";
import { CENTER_LEFT, CENTER_RIGHT, EDGE, FAB_SIZE, LEFT_RAIL, RAIL_BASE, RIGHT_RAIL, UTIL_STRIP, utilStripStyle } from "../../lib/layout";
import { ensureHillshade, setBuildings3D, setHillshadeVisible, setTerrain } from "../../lib/flood-scene";
import { cssColor, depthLevel, extentPaint, scopePaint, setPolygonLayerVisible, upsertPolygonLayer } from "../../lib/map-polygon";
import { ensureFloodSurface, setFloodSurface } from "../../lib/flood-surface";
import { loadTerrainFine, type TerrainGrid, type TerrainPatch } from "../../lib/terrain-grid";
import { floodSurfaceOf } from "../../lib/flood-surfaces";
import { formatClock } from "../../lib/datetime";
import { CITY_CENTER } from "../../lib/map-config";
import { GEOMETRIES, SCOPE_ZOOM } from "../../fixtures";
import { useScenario } from "../../state/ScenarioProvider";
import { MapUtilStrip } from "../../components/MapUtilStrip";
import { usePrecipitationLayer } from "../../lib/usePrecipitationLayer";
import { MapLegend } from "../../components/twin/MapLegend";
import { ContextInset, insetKindOf } from "../../components/twin/ContextInset";
import { SceneLayers, raiseSceneLayers } from "../../components/twin/SceneLayers";
import { ProfileView } from "../../components/twin/AuxView";
import { mergeScene } from "../../model/scene";
import {
  depthAt, floodSites, floorMarkAt, horizonOf, impactsAt, ringAreaHa, ringOf, scenariosOf, stageAt, stateRowsAt, summarizeForecast, surfaceLevelAt,
} from "../../model/sim/flood";
import { ForecastBasisDialog } from "../scr-05/widgets/ForecastBasisDialog";
import { SimScenarios } from "./widgets/SimScenarios";
import { FacilityMarkers } from "./widgets/FacilityMarkers";
import type { ScenePoint } from "../../model/scene";
import { FloodResult } from "./widgets/FloodResult";
import { TimeAxis } from "./widgets/TimeAxis";

const TWIN_ZOOM = SCOPE_ZOOM.구역 + 0.8;
const FIT_MARGIN = 32;
const SCOPE_SOURCE = "sim-scope";
const EXTENT_SOURCE = "sim-extent";
const BASE_EXTENT_SOURCE = "sim-extent-base";
/** 재생 속도 — 실제 1분당 100 ms (모의훈련 시계와 같은 호흡) */
const PLAY_MS_PER_MIN = 100;

const plusMin = (iso: string, m: number) => new Date(new Date(iso).getTime() + m * 60_000).toISOString();
const spanMin = (a: string, b: string) => Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000));

export function FloodSim() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { agentOpen, demoNow } = useScenario();

  /* ── 상태 셋: 대상 · 시나리오 · 시각 ── */
  const sites = useMemo(() => floodSites(demoNow), [demoNow]);
  /* `site` 로도, 사건 ID(`incident`)로도 연다 — 재난관제 전망 탭이 사건으로 넘긴다 */
  const site = sites.find((s) => s.id === params.get("site") || (params.get("incident") !== null && s.incidentId === params.get("incident"))) ?? sites[0];
  const scenarios = useMemo(() => scenariosOf(site), [site]);
  const selected = scenarios.find((s) => s.id === params.get("sc")) ?? scenarios[0];
  const setQuery = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) { if (v === null) next.delete(k); else next.set(k, v); }
    setParams(next, { replace: true });
  };

  const forecast = useMemo(() => site.boardOf(selected.choice), [site, selected]);
  const baseline = useMemo(() => site.boardOf(scenarios[0].choice), [site, scenarios]);
  const summaries = useMemo(
    () => Object.fromEntries(scenarios.map((s) => { const f = site.boardOf(s.choice); return [s.id, f ? summarizeForecast(f) : null]; })),
    [site, scenarios],
  );

  /* ── 시간축: 현재 → 지평선. 재생은 끝에 닿으면 처음부터 ── */
  const origin = site.now;
  const end = forecast ? horizonOf(forecast) : plusMin(origin, 60);
  const span = spanMin(origin, end);
  const [minutes, setMinutes] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { setMinutes(0); setPlaying(false); }, [site.id]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dm = (now - last) / PLAY_MS_PER_MIN;
      if (dm >= 1) { last = now; setMinutes((m) => (m + Math.floor(dm) > span ? 0 : m + Math.floor(dm))); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, span]);
  const at = plusMin(origin, Math.min(span, minutes));

  const [compare, setCompare] = useState(false);
  const [basisOpen, setBasisOpen] = useState(false);
  const [profileCollapsed, setProfileCollapsed] = useState(false);

  /* ── 그 시각의 계산값 ── */
  const floorMark = forecast ? floorMarkAt(forecast, at) : null;
  const level = forecast ? surfaceLevelAt(forecast, site.wcase, at) : null;
  const depthNow = forecast ? depthAt(forecast, at) : 0;
  const ring = ringOf(floorMark?.extentGeometryId);
  const areaHa = ring ? ringAreaHa(ring) : null;
  const sceneLayers = useMemo(() => mergeScene(forecast?.scene, floorMark?.scene), [forecast, floorMark]);
  const impacts = useMemo(() => (forecast ? impactsAt(forecast, at, sceneLayers) : []), [forecast, at, sceneLayers]);
  /* 조치 — 이 시나리오에서 일어나는 것. 시간축 눈금 · 마커 배지 · 조치 이력이 같은 목록을 읽는다 */
  const actions = useMemo(() => site.actionsOf(selected.choice, forecast).sort((a, b) => a.at.localeCompare(b.at)), [site, selected, forecast]);
  /* 시설 = 장면의 점 + 대상의 장치. 마커는 DS 로 따로 그리므로 장면층에서는 점을 뺀다 */
  const points = useMemo<ScenePoint[]>(() => [...sceneLayers.filter((l): l is ScenePoint => l.kind === "point"), ...site.extraFacilities], [sceneLayers, site]);
  const lineLayers = useMemo(() => sceneLayers.filter((l) => l.kind !== "point"), [sceneLayers]);
  /* 서로 가리킴 — SOP 줄을 짚으면 시설이, 마커를 누르면 SOP 줄이 켜진다 */
  const [focus, setFocus] = useState<Set<string>>(() => new Set());
  const focusFacilities = useCallback((ids: string[] | null) => setFocus(new Set(ids ?? [])), []);
  const stage = forecast ? stageAt(forecast, at) : "none";
  const sop = site.sop;
  const stateRows = useMemo(() => stateRowsAt(site, forecast, selected.choice, at), [site, forecast, selected, at]);
  const baseMark = compare && baseline && forecast && baseline.forecastId !== forecast.forecastId ? floorMarkAt(baseline, at) : null;

  /* ── 지도 ── */
  const family = site.family;
  const center = site.anchor;
  const mapContainer = useRef<HTMLDivElement>(null);
  const { map, ready } = useMapLibre(mapContainer, { center, zoom: TWIN_ZOOM, pitch: 0, capture: true });
  const [layers, setLayers] = useState({ scope: true, extent: true, rain: false });
  usePrecipitationLayer(map, ready, layers.rain, new Date(at).getHours());
  const scopeRing = site.scopeGeometryId ? GEOMETRIES[site.scopeGeometryId] : undefined;
  const fitPoints = useMemo<[number, number][]>(() => (scopeRing && scopeRing.length > 0 ? scopeRing : [center]), [scopeRing, center]);
  const focusScope = useCallback((duration: number) => {
    const m = map.current;
    if (!m) return;
    const padding = { top: FIT_MARGIN, bottom: FIT_MARGIN + 120, left: CENTER_LEFT + FIT_MARGIN, right: CENTER_RIGHT + FIT_MARGIN };
    if (fitPoints.length > 1) {
      const b = fitPoints.reduce((acc, p) => acc.extend(p), new maplibregl.LngLatBounds(fitPoints[0], fitPoints[0]));
      m.fitBounds(b, { padding, pitch: 0, bearing: 0, duration });
      return;
    }
    m.easeTo({ center: center ?? CITY_CENTER, zoom: TWIN_ZOOM, pitch: 0, bearing: 0, padding, duration });
  }, [map, center, fitPoints]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    ensureHillshade(m);
    setBuildings3D(m, true);
    setTerrain(m, true);
    setHillshadeVisible(m, true);
    focusScope(800);
  }, [map, ready, focusScope]);

  /* 지형을 채운 침수면 — 수위(해발)를 넣으면 범위·수심이 지형에서 나온다 */
  const surfaceGeometryId = floorMark?.extentGeometryId ?? null;
  const surfaceEntry = useMemo(() => floodSurfaceOf(surfaceGeometryId), [surfaceGeometryId]);
  const [fineGrid, setFineGrid] = useState<TerrainGrid | null>(null);
  useEffect(() => {
    if (!surfaceEntry || fineGrid) return;
    let cancelled = false;
    loadTerrainFine().then((g) => { if (!cancelled) setFineGrid(g); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [surfaceEntry, fineGrid]);
  const finePatch: TerrainPatch | null = surfaceEntry && fineGrid ? fineGrid.patches[surfaceEntry.patchId] ?? null : null;

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const extentRing = floorMark ? GEOMETRIES[floorMark.extentGeometryId] : null;
    upsertPolygonLayer(m, SCOPE_SOURCE, scopeRing, scopePaint());
    const paint = extentPaint(floorMark ? depthLevel(floorMark.maxDepthM) : 0.4, "water");
    ensureFloodSurface(m);
    if (surfaceEntry && finePatch) {
      setFloodSurface(m, finePatch, level !== null ? { ...surfaceEntry.spec, level } : surfaceEntry.spec, layers.extent);
      upsertPolygonLayer(m, EXTENT_SOURCE, extentRing, { ...paint, opacity: 0 });
    } else {
      setFloodSurface(m, null, null, false);
      upsertPolygonLayer(m, EXTENT_SOURCE, extentRing, paint);
    }
    /* 실제 사건 겹쳐 보기 — 점선 외곽만 */
    const baseRing = baseMark ? GEOMETRIES[baseMark.extentGeometryId] : null;
    upsertPolygonLayer(m, BASE_EXTENT_SOURCE, baseRing, { ...extentPaint(0.1, "water"), fill: cssColor("--color-warning", "#f59e0b"), line: cssColor("--color-warning", "#f59e0b"), opacity: 0 });
    setPolygonLayerVisible(m, SCOPE_SOURCE, layers.scope);
    setPolygonLayerVisible(m, EXTENT_SOURCE, layers.extent && Boolean(extentRing));
    setPolygonLayerVisible(m, BASE_EXTENT_SOURCE, Boolean(baseRing));
    raiseSceneLayers(m);
  }, [map, ready, scopeRing, floorMark, baseMark, surfaceEntry, finePatch, level, layers.scope, layers.extent]);

  const profileAt = floorMark?.validAt ?? (forecast ? [...forecast.marks].sort((a, b) => a.validAt.localeCompare(b.validAt))[0]?.validAt : undefined);
  const ticks = useMemo(() => (forecast ? forecast.marks.map((m) => m.validAt).sort() : []), [forecast]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden bg-surface" style={{ isolation: "isolate" }} aria-label="침수 시뮬레이션 3D 씬">
        <div ref={mapContainer} className="h-full w-full" />
        <SceneLayers map={map} ready={ready} layers={lineLayers} />
        <FacilityMarkers map={map} ready={ready} points={points} actions={actions} at={at} focus={focus} onPick={(id) => focusFacilities(focus.has(id) ? null : [id])} />
      </div>

      {/* 좌측 레일 — 대상 · 시나리오 · 고른 조건, 아래로 광역 인셋과 범례 */}
      <div className={`${RAIL_BASE} left-3`} style={{ width: LEFT_RAIL }}>
        <GlassPanel className="pointer-events-auto flex min-h-0 flex-1 flex-col">
          <SimScenarios sites={sites} site={site} onSite={(id) => setQuery({ site: id, sc: null })} scenarios={scenarios} selected={selected} onSelect={(id) => setQuery({ sc: id })} />
        </GlassPanel>
        {insetKindOf(family) && (
          <ContextInset family={family} anchor={site.anchor} hour={new Date(at).getHours()} meta={formatClock(at)} />
        )}
        <MapLegend
          depth={floorMark && layers.extent && floorMark.maxDepthM > 0 ? { label: "침수심" } : null}
          scope={layers.scope}
          rain={layers.rain}
          extent={baseMark ? { label: "실제 사건", tone: "ground" } : null}
          inset={insetKindOf(family)}
        />
      </div>

      {/* 상단 좌측 — 종단도(있으면). 좌측 레일 `대상` 옆에 작게 붙는다. 유형 탭은 오른쪽 끝으로 비켜 있다(2026-09-17 사용자) */}
      {forecast?.profile && profileAt && (
        <div className="pointer-events-none absolute top-3 z-20" style={{ left: CENTER_LEFT, width: 340 }}>
          <GlassPanel className="pointer-events-auto w-full">
            <ProfileView
              profile={forecast.profile}
              validAt={profileAt}
              compareAt={baseMark && baseline?.profile ? baseline.profile.levelsByMark[profileAt] ?? null : null}
              collapsed={profileCollapsed}
              onToggle={() => setProfileCollapsed((v) => !v)}
              compact
            />
          </GlassPanel>
        </div>
      )}

      {/* 하단 중앙 — 시간축 캡슐. 가운데에 좁게(최대 640) 서고, 오른쪽은 질의 버튼 자리를 비워 둔다 */}
      <div className="pointer-events-none absolute bottom-3 z-30 flex justify-center px-3 [&>*]:w-full [&>*]:max-w-[640px]" style={{ left: CENTER_LEFT, right: CENTER_RIGHT + FAB_SIZE + EDGE }}>
        <TimeAxis
          origin={origin}
          end={end}
          ticks={ticks}
          events={actions.map((a) => ({ at: a.at, label: a.label, icon: a.kind === "환경" ? "mdi:play" : "mdi:hand-back-left" }))}
          minutes={minutes}
          onChange={(m) => { setPlaying(false); setMinutes(m); }}
          playing={playing}
          onTogglePlay={() => setPlaying((v) => !v)}
        />
      </div>

      <div className={UTIL_STRIP} style={utilStripStyle(agentOpen)}>
        <MapUtilStrip
          map={map}
          disabled={!ready}
          homePitch={60}
          onReset={() => focusScope(500)}
          layers={[{
            title: "영향 표현",
            items: [
              { id: "scope", label: "대상 범위", color: cssColor("--color-danger", "#ef4444"), icon: "mdi:vector-polygon", shape: "area" as const, visible: layers.scope },
              { id: "extent", label: "침수 범위", color: cssColor("--color-primary-text", "#60a5fa"), icon: "mdi:waves", shape: "area" as const, visible: layers.extent },
              { id: "rain", label: "강우", color: cssColor("--color-rain", "#7c5cff"), icon: "mdi:weather-pouring", shape: "raster" as const, visible: layers.rain },
            ],
            onToggle: (id) => setLayers((p) => ({ ...p, [id as keyof typeof p]: !p[id as keyof typeof p] })),
            onSetAll: (visible) => setLayers({ scope: visible, extent: visible, rain: visible }),
          }]}
        />
      </div>

      {/* 우측 레일 — 비교표 · 그 시각 · 영향 객체 · 관련 SOP · 근거 */}
      <div className={`${RAIL_BASE} right-3`} style={{ width: RIGHT_RAIL }}>
        <GlassPanel className="pointer-events-auto flex min-h-0 flex-1 flex-col">
          {forecast ? (
            <FloodResult
              scenarios={scenarios}
              selected={selected}
              onSelect={(id) => setQuery({ sc: id })}
              summaries={summaries}
              observed={site.status === "재현" ? site.wcase?.observed ?? [] : []}
              at={at}
              stateRows={stateRows}
              depthNow={depthNow}
              areaHa={areaHa}
              impacts={impacts}
              actions={actions}
              sop={sop}
              stage={stage}
              focus={focus}
              onFocus={focusFacilities}
              compare={compare}
              onCompare={setCompare}
              onBasis={() => setBasisOpen(true)}
            />
          ) : (
            <p className="p-3 text-caption text-foreground-muted">이 조합은 계산한 판이 없습니다. 아무 판이나 대신 보이지 않습니다.</p>
          )}
        </GlassPanel>
      </div>

      {basisOpen && (
        <ForecastBasisDialog
          wcase={site.wcase}
          forecast={forecast}
          onClose={() => setBasisOpen(false)}
          onOpenLive={() => navigate(`/scr-02/${site.wcase?.legacyDistrictId ?? "seohang"}?panel=twin`)}
        />
      )}
    </div>
  );
}
