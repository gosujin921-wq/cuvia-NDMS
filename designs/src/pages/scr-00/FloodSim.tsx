/* ─────────────────────────────────────────────
 * 침수 시뮬레이션 — /scr-00 의 침수 탭 (2026-09-17)
 *
 *   실제 사건 데이터 → 트윈에서 사건 재현(기준) → 조건 변경(A · B) → 결과 계산 → 기준과 비교 → 관련 SOP 판단
 *
 * 좌(입력): 대상 · 시나리오 · 슬라이더 · 그 시각 상태      중앙: 지도(지형 수면) + 종단도(있으면) + 시간축      우(결과): 기준 대비 · 그 시각 영향 · 해당 규정 · 근거
 * ★ 상태는 `대상 · 시나리오 · 시각` 셋뿐이고 나머지는 전부 계산이다. 조치를 정하는 자리가 아니라 결과를 읽는 자리라 정지점이 없다.
 * ★ "과거 재현"은 메인이 아니다. 기준을 설명하는 자리이고, 메인은 "그때 조건이 달랐다면"이다.
 * ───────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import maplibregl from "maplibre-gl";
import { Icon } from "@iconify/react";
import { Button, GlassPanel } from "@ds";
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
import { ensureSafemapLayers, setSafemapVisible } from "../../lib/safemap";
import { MapLegend } from "../../components/twin/MapLegend";
import { ContextInset, insetKindOf } from "../../components/twin/ContextInset";
import { SceneLayers, raiseSceneLayers } from "../../components/twin/SceneLayers";
import { ProfileView } from "../../components/twin/AuxView";
import { mergeScene } from "../../model/scene";
import {
  depthAt, floodSites, floorMarkAt, horizonOf, impactsAt, ringAreaHa, ringOf, scenariosOf, sopEventsOf, stageAt, stateRowsAt, summarizeForecast, surfaceLevelAt,
} from "../../model/sim/flood";
import { SimBasisDialog } from "./widgets/SimBasisDialog";
import { SimScenarios } from "./widgets/SimScenarios";
import { FacilityMarkers } from "./widgets/FacilityMarkers";
import type { ScenePoint } from "../../model/scene";
import type { SimScenario } from "../../model/sim/flood";
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
  const { agentOpen } = useScenario();

  /* ── 상태 셋: 대상 · 시나리오 · 시각 ── */
  const sites = useMemo(() => floodSites(), []);
  /* `site` 로도, 사건 ID(`incident`)로도 연다 — 재난관제 전망 탭이 사건으로 넘긴다 */
  const site = sites.find((s) => s.id === params.get("site") || (params.get("incident") !== null && s.incidentId === params.get("incident"))) ?? sites[0];
  /* 슬라이더가 준 직접 배율(`rf`) — 규칙 대상에서 앵커 밖 값을 고르면 C 시나리오가 선다. 한계강우량 축은 그때 고른 것을 따른다(`rl`) */
  const rf = site.slider ? params.get("rf") : null;
  const custom = useMemo(() => (rf && site.slider ? { [site.slider.condId]: site.slider.encode(Number(rf)), ...(params.get("rl") ? { lim: params.get("rl") as string } : {}) } : null), [rf, site, params]);
  const scenarios = useMemo(() => scenariosOf(site, custom), [site, custom]);
  const picked = scenarios.find((s) => s.id === params.get("sc")) ?? scenarios[0];
  /* 규정 스위치 — `sop=S2@14:35,S3@14:55`. 켜진 규정을 고른 시나리오에 그 시각으로 적용한 열이 하나 더 서고 그것을 본다. 여럿을 동시에 켤 수 있다 */
  const sopParam = params.get("sop") ?? "";
  const sopOn = useMemo<Record<string, string>>(() => Object.fromEntries(
    sopParam.split(",").map((x) => x.split("@")).filter(([id, at]) => id && at && site.sopApply?.[id]?.times(picked.choice).some((t) => t.at === at)).map(([id, at]) => [id, at]),
  ), [sopParam, site, picked]);
  const sopIds = Object.keys(sopOn);
  const selected = useMemo<SimScenario>(() => {
    if (!sopIds.length || !site.sopApply) return picked;
    const apply = site.sopApply;
    return {
      id: `${picked.id}+${sopIds.join("+")}`, tag: "규정대로",
      label: `${picked.label} · ${sopIds.map((id) => `${site.sop.find((s) => s.id === id)?.label ?? id} ${apply[id].times(picked.choice).find((t) => t.at === sopOn[id])?.label ?? sopOn[id]}`).join(" · ")}`,
      choice: sopIds.reduce((c, id) => apply[id].apply(c, sopOn[id]), picked.choice), baseline: false,
    };
  }, [picked, site, sopIds, sopOn]);
  const setSop = (id: string, at: string | null) => {
    const next = { ...sopOn };
    if (at) next[id] = at; else delete next[id];
    setQuery({ sop: Object.entries(next).map(([k, v]) => `${k}@${v}`).join(",") || null });
  };
  /* 전부 켜기 — 켤 수 있는 규정을 각자의 기본 시각으로. 끄면 그날 그대로다 */
  const setSopAll = (on: boolean) => {
    if (!on) return setQuery({ sop: null });
    const apply = site.sopApply ?? {};
    const all = Object.entries(apply)
      .map(([id, v]) => { const t = v.times(picked.choice)[0]; return t ? `${id}@${t.at}` : null; })
      .filter((x): x is string => Boolean(x));
    setQuery({ sop: all.join(",") || null });
  };
  /* 비교의 왼쪽 열 — 규정을 켰으면 "그 규정을 실제 시각에 했을 때"(고른 시나리오), 아니면 기준 시나리오. 표는 이 둘만 세운다 */
  const baseCol = sopIds.length ? picked : scenarios[0];
  const columns = useMemo(() => (baseCol.id === selected.id ? [baseCol] : [baseCol, selected]), [baseCol, selected]);
  const setQuery = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) { if (v === null) next.delete(k); else next.set(k, v); }
    setParams(next, { replace: true });
  };

  const forecast = useMemo(() => site.boardOf(selected.choice), [site, selected]);
  const baseline = useMemo(() => site.boardOf(baseCol.choice), [site, baseCol]);
  const summaries = useMemo(
    () => Object.fromEntries(columns.map((s) => {
      const f = site.boardOf(s.choice);
      if (!f) return [s.id, null];
      const sum = summarizeForecast(f);
      /* 규칙 대상은 면적이 연속값이다 — 눈금 링의 면적이 아니라 첨두 수위의 지형 채우기 면적 */
      if (site.rule) { const rule = site.rule; sum.maxAreaHa = rule.areaOfLevel(Math.max(...f.marks.map((m) => rule.levelAt(s.choice, m.validAt)))); }
      return [s.id, sum];
    })),
    [site, columns],
  );

  /* 노출 규정의 결과 = 도달 전 여유 시간 하나(README §2.3). 규정이 막는 대상의 도달 시각에서 조치 시각을 뺀다. 두 열 다 조치가 없으면 행을 안 세운다 */
  const leadRows = useMemo(() => {
    const lead = (sc: SimScenario, sopId: string, targetId: string): { text: string; min: number | null } => {
      const f = site.boardOf(sc.choice);
      const t = f?.targets.find((x) => x.id === targetId);
      const a = f ? site.actionsOf(sc.choice, f).find((x) => x.id === sopId) : undefined;
      if (!f || !t || !t.arrivalAt) return { text: "도달 없음", min: null };
      if (!a) return { text: "조치 없음", min: null };
      const min = Math.round((new Date(t.arrivalAt).getTime() - new Date(a.at).getTime()) / 60_000);
      /* 음수는 조치가 도달보다 늦었다는 뜻이다 — "-12분"보다 "12분 늦음"이 읽힌다 */
      return { text: min >= 0 ? `${min}분` : `${-min}분 늦음`, min };
    };
    return Object.entries(site.sopTargetOf ?? {}).map(([sopId, tg]) => ({ label: `${tg.short} 여유`, base: lead(baseCol, sopId, tg.id), sel: lead(selected, sopId, tg.id) }))
      .filter((r) => r.base.min !== null || r.sel.min !== null);
  }, [site, baseCol, selected]);

  /* ── 시간축: 현재 → 지평선. 재생은 끝에 닿으면 처음부터 ── */
  const origin = site.now;
  const end = forecast ? horizonOf(forecast) : plusMin(origin, 60);
  const span = spanMin(origin, end);
  /* 재생 시작점 — 물이 차오르기 조금 전(대상이 정한다). 시간축 범위는 그대로고, 첫 위치와 되풀이의 시작만 여기다 */
  const playFromMin = useMemo(() => {
    const iso = site.playFrom?.(selected.choice) ?? null;
    return iso ? Math.max(0, Math.min(span, Math.round((new Date(iso).getTime() - new Date(origin).getTime()) / 60_000))) : 0;
  }, [site, selected, origin, span]);
  const playFromRef = useRef(playFromMin);
  useEffect(() => { playFromRef.current = playFromMin; }, [playFromMin]);
  const [minutes, setMinutes] = useState(() => playFromMin);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { setMinutes(playFromRef.current); setPlaying(false); }, [site.id]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dm = (now - last) / PLAY_MS_PER_MIN;
      if (dm >= 1) { last = now; setMinutes((m) => (m + Math.floor(dm) > span ? playFromRef.current : m + Math.floor(dm))); }
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
  /* 규칙 대상은 수위·수심·면적이 연속값(규칙)이고, 사전 작성 판은 눈금 사이를 보간한다 */
  const level = forecast ? (site.rule ? site.rule.levelAt(selected.choice, at) : surfaceLevelAt(forecast, site.wcase, at)) : null;
  const depthNow = forecast ? (site.rule && level !== null ? site.rule.depthOfLevel(level) : depthAt(forecast, at)) : 0;
  const ring = ringOf(floorMark?.extentGeometryId);
  const ruleArea = site.rule && level !== null ? site.rule.areaOfLevel(level) : null;
  /* 0.05 ha(약 500 m²) 아래는 "아직 없음" — 그릇 바닥에 물이 비치기 시작한 것을 0.0 ha 로 적지 않는다 */
  const areaHa = site.rule ? (ruleArea !== null && ruleArea >= 0.05 ? ruleArea : null) : ring ? ringAreaHa(ring) : null;
  /* 잠기기 전의 두 번째 타일 — "도로 잠김까지 n m". 수심 0 m 는 아무 말도 아니다(2026-09-17 사용자 "수심?") */
  const headroomM = site.rule && level !== null && depthNow <= 0 ? Math.max(0, site.rule.floodLevel - level) : null;
  const sceneLayers = useMemo(() => mergeScene(forecast?.scene, floorMark?.scene), [forecast, floorMark]);
  /* 규칙 대상은 도로가 잠기기 전엔 장면과의 공간 교차를 하지 않는다 — 하천 물길 링 안의 수위계·합류점이 "범위 안"으로 서면
     "영향 3 · 침수 범위 아직 없음"이 한 머리에 선다(2026-09-17 사용자). 판의 대상(도달 시각)은 그대로 본다 */
  const impacts = useMemo(() => (forecast ? impactsAt(forecast, at, site.rule && depthNow <= 0 ? [] : sceneLayers) : []), [forecast, at, sceneLayers, site.rule, depthNow]);
  /* 조치 — 이 시나리오에서 일어나는 것. 시간축 눈금 · 마커 배지 · 조치 이력이 같은 목록을 읽는다 */
  const actions = useMemo(() => {
    const acted = site.actionsOf(selected.choice, forecast);
    /* 조치가 없는 규정은 "해당되기 시작하는 시각"으로 짚는다 — 서항처럼 그날 대응 기록이 없는 재현에도 타임라인에 규정이 선다 */
    const matched = forecast ? sopEventsOf(forecast, site.sop, origin, end, acted) : [];
    return [...acted, ...matched].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [site, selected, forecast, origin, end]);
  /* 시설 = 장면의 점 + 대상의 장치. 마커는 DS 로 따로 그리므로 장면층에서는 점을 뺀다 */
  /* 계측 지점은 대상이 아는 값만 채운다(도로수위계 = 규칙 침수심 · 강우계 = 실자료 강도). 모르는 것은 "계측 미연계"로 남는다 */
  const points = useMemo<ScenePoint[]>(() => [
    ...sceneLayers.filter((l): l is ScenePoint => l.kind === "point"),
    ...site.extraFacilities.map((p) => { const st = site.facilityStateOf?.(p.id, selected.choice, at); return st ? { ...p, state: st.state, tone: st.tone } : p; }),
  ], [sceneLayers, site, selected, at]);
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
  const [layers, setLayers] = useState({ scope: true, extent: true, rain: false, marks: true });
  /* ⚠ 데이터 이슈(2026-09-17): 강수 격자는 2024-09-21 한 날짜만 구워 뒀다. 창원천(2024-08-28)에도 그 격자가 그려진다.
     화면이 우선이라 인셋·레이어는 그대로 세운다(사용자). 창원천 날짜 격자를 구우면(scripts/fetch-precipitation-field.mjs) 여기서 날짜별로 읽게 바꾼다 */
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
    /* 침수흔적도(생활안전지도 · 실자료) — 과거에 잠겼던 곳. 시뮬레이션과 나란히 보여야 "그때 조건이 달랐다면"이 땅에 붙는다 */
    ensureSafemapLayers(m);
    focusScope(800);
  }, [map, ready, focusScope]);
  useEffect(() => { const m = map.current; if (ready && m) setSafemapVisible(m, "flood-marks", layers.marks); }, [map, ready, layers.marks]);
  /* 이 대상 밖으로 나가지 않는다 — 줌아웃해도 창원시 전체가 열리지 않게 범위를 건다(2026-09-17 사용자 "해당영역만 보이게").
     대상을 바꾸면 그 대상의 범위로 다시 건다. 여백은 범위 한 변의 60 % */
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || fitPoints.length < 2) return;
    const b = fitPoints.reduce((acc, p) => acc.extend(p), new maplibregl.LngLatBounds(fitPoints[0], fitPoints[0]));
    const [w, s] = [b.getWest(), b.getSouth()], [e, n] = [b.getEast(), b.getNorth()];
    const mx = (e - w) * 0.6, my = (n - s) * 0.6;
    m.setMaxBounds([[w - mx, s - my], [e + mx, n + my]]);
  }, [map, ready, fitPoints]);

  /* 지형을 채운 침수면 — 수위(해발)를 넣으면 범위·수심이 지형에서 나온다 */
  const surfaceGeometryId = site.rule ? site.rule.surfaceGeometryId : floorMark?.extentGeometryId ?? null;
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

      {/* 좌측 레일(입력) — 대상 · 시나리오 · 슬라이더 · 그 시각 상태, 아래로 광역 인셋과 범례 */}
      <div className={`${RAIL_BASE} left-3`} style={{ width: LEFT_RAIL }}>
        <GlassPanel className="pointer-events-auto flex min-h-0 flex-1 flex-col">
          <SimScenarios
            sites={sites} site={site} onSite={(id) => setQuery({ site: id, sc: null, rf: null, rl: null })}
            scenarios={scenarios} selected={picked} onSelect={(id) => setQuery({ sc: id })}
            onSlide={site.slider ? (f) => setQuery({ rf: String(Number(f.toFixed(2))), rl: picked.choice.lim ?? null, sc: "C" }) : undefined}
            at={at}
            stateRows={stateRows}
          />
        </GlassPanel>
        {insetKindOf(family) && (
          <ContextInset family={family} anchor={site.anchor} hour={new Date(at).getHours()} meta={formatClock(at)} />
        )}
        {/* 침수심 줄: 규칙 대상은 연속 수심으로 — 시간 눈금(정시)의 수심이 0 이어도 그 사이에 물이 차기 시작하면 범례가 서야 한다 */}
        <MapLegend
          depth={layers.extent && (site.rule ? depthNow > 0 : Boolean(floorMark && floorMark.maxDepthM > 0)) ? { label: "침수심" } : null}
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
          events={actions.map((a) => ({ at: a.at, label: a.label, kind: a.kind === "환경" ? "물이 달라진다" : a.kind === "규정" ? "규정 해당" : "노출만" }))}
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
          homePitch={0}
          onReset={() => focusScope(500)}
          layers={[{
            title: "영향 표현",
            items: [
              { id: "scope", label: "대상 범위", color: cssColor("--color-danger", "#ef4444"), icon: "mdi:vector-polygon", shape: "area" as const, visible: layers.scope },
              { id: "extent", label: "침수 범위", color: cssColor("--color-primary-text", "#60a5fa"), icon: "mdi:waves", shape: "area" as const, visible: layers.extent },
              { id: "rain", label: "강우", color: cssColor("--color-rain", "#7c5cff"), icon: "mdi:weather-pouring", shape: "raster" as const, visible: layers.rain },
              { id: "marks", label: "침수흔적도 · 과거", color: "#bf7fff", icon: "mdi:water-alert", shape: "raster" as const, visible: layers.marks },
            ],
            onToggle: (id) => setLayers((p) => ({ ...p, [id as keyof typeof p]: !p[id as keyof typeof p] })),
            onSetAll: (visible) => setLayers({ scope: visible, extent: visible, rain: visible, marks: visible }),
          }]}
        />
      </div>

      {/* 우측 레일(결과) — 기준 대비 · 그 시각 영향 · 해당 규정 · 근거 */}
      <div className={`${RAIL_BASE} right-3`} style={{ width: RIGHT_RAIL }}>
        <GlassPanel className="pointer-events-auto flex min-h-0 flex-1 flex-col">
          {forecast ? (
            <FloodResult
              base={baseCol}
              selected={selected}
              sopApply={Object.fromEntries(Object.entries(site.sopApply ?? {}).map(([id, v]) => [id, { label: v.label, times: v.times(picked.choice), actualAt: v.actualAt }]))}
              sopOn={sopOn}
              onSop={setSop}
              onSopAll={setSopAll}
              summaries={summaries}
              leadRows={leadRows}
              observed={site.observed}
              at={at}
              depthNow={depthNow}
              headroomM={headroomM}
              areaHa={areaHa}
              impacts={impacts}
              marks={site.marks ? { areaHa: site.marks.areaHa, floodedAt: site.marks.floodedAt(selected.choice) } : null}
              actions={actions}
              sop={sop}
              stage={stage}
              focus={focus}
              onFocus={focusFacilities}
              compare={compare}
              onCompare={setCompare}
            />
          ) : (
            <p className="p-3 text-caption text-foreground-muted">이 조합은 계산한 판이 없습니다. 아무 판이나 대신 보이지 않습니다.</p>
          )}
        </GlassPanel>
        {/* 근거는 패널 밖 바닥에 — 결과를 스크롤해 내려야 닿던 자리였다(2026-09-17 사용자) */}
        <Button variant="outline" size="sm" className="pointer-events-auto w-full shrink-0 bg-surface/95 backdrop-blur" onClick={() => setBasisOpen(true)}>
          <Icon icon="mdi:file-search-outline" className="size-4" aria-hidden />
          근거 · 입력과 계산
        </Button>
      </div>

      {basisOpen && (
        <SimBasisDialog
          title={site.label}
          subtitle={site.dateLabel}
          forecast={forecast}
          onClose={() => setBasisOpen(false)}
          notes={[
            { id: "input", rows: [
              { label: "강우", value: site.rule
                ? (site.id === "seohang" ? `${site.now.slice(0, 10)} 기상청 국지예보모델 재분석 격자 · 배수권역 최근접 칸` : "상류 강우계 시계열 · 사건 기록")
                : "사전 작성 판의 강우 조건" },
              { label: "지형", value: "10 m 수치표고 · 침수면은 여기서 채운다" },
              { label: "한계강우량", value: "24년 도시침수 완료보고 p.41 표(40 · 50 · 70 mm)" },
              ...(site.marks ? [{ label: "침수흔적도", value: `생활안전지도 IF_0092 · 범위 안 ${site.marks.areaHa.toFixed(1)} ha` }] : []),
              ...site.observed.map((o) => ({ label: `실측 · ${o.label}`, value: o.value })),
            ] },
            { id: "calc", rows: [
              { label: "수위 → 범위·수심", value: "지형 채우기. 수위(해발)를 넣으면 잠기는 면과 깊이가 지형에서 나온다" },
              { label: "강우 → 수위", value: site.rule
                ? (site.id === "seohang"
                  ? "누적 강우 규칙. 침수흔적 면적에 맞춰 보정했고 수리 모델이 오면 교체한다"
                  : "편집 판 세 벌(당시 · +20% · +50%) 사이 보간. 실측 보정은 없고 수위 시계열이 오면 규칙으로 교체한다")
                : "사전 작성 판. 모델이 오면 교체한다" },
              { label: "침수 범위", value: `도로가 잠기는 수위 위만 센다${site.rule ? ` (${site.rule.levelLabel} ${site.rule.floodLevel} EL.m 기준)` : ""}` },
              ...(site.id === "seohang" ? [{ label: "펌프 재가동", value: "켜면 그 시각부터 누적 강우에서 배수 환산량을 뺀다. 펌프 제원이 오면 그 값으로 바꾼다" }] : []),
            ] },
            { id: "assume", lines: [
              "한계강우량 표의 값을 이 지점에 그대로 대응시킨다",
              ...(site.marks ? [site.marks.note] : []),
              "통제·대피는 물을 바꾸지 않는다. 사람이 빠지는 것이라 결과는 도달 전 여유 시간 하나다",
            ] },
            { id: "limit", lines: [
              "하천·노면 수위 시계열, 펌프 제원과 가동 기록, 조위는 아직 반영하지 않았다",
              ...(site.sopNote ? [site.sopNote] : []),
            ] },
            { id: "read", lines: [
              "그 시각 상태의 파란 값은 이 시나리오의 계산값, 주황 값은 조건대로 환산한 관측값, 나머지는 관측 기록이다",
              "해당 규정은 이 조건이면 해당되는 기존 SOP다. 당시 실행 여부가 아니며 발령·전파는 승인 뒤에 한다",
            ] },
          ]}
        />
      )}
    </div>
  );
}
