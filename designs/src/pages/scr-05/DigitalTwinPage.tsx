/* ─────────────────────────────────────────────
 * SCR-05 대응 모의훈련 · 사전 조건분석 — IA-T01 (IA §5.2 · §13.1 · §15, 02 §8, 03 §16)
 *
 * 훈련 시나리오는 두 출처다. (1) 사건 없이 조건(강우 강도 · 만조)을 골라 그 조합에 준비된 예측판을 여는
 * **조건 세트**(fixtures/seohang-flood/training.ts) — 메뉴 진입의 기본이다. (2) D8 이 종료 시점 스냅샷으로 묶은
 * **사건 스냅샷**. 둘 다 같은 3D 트윈 위에서 기준·대안 전망을 상대시간으로 재생하며 대응을 연습한다.
 * ★ 조건에서 값을 계산하지 않는다(Phase 1 상승률 램프 폐기). 준비 안 된 조합은 빈 자리로 두고 실개발의 ModelRun 요청 자리다. 사건의 전망(IA-03)은 사건 작업공간(scr-02) 안의
 * 예측 모드가 맡고, 이 화면은 사건 없이 도는 훈련 실행 화면이다 — Phase 1 의 "사건 연계 분석"
 * 모드는 그쪽으로 옮겨 갔다(IA §5 자산 표 "재편").
 *
 * 3D 씬 · 지도 위 레이어 스트립 · 날씨 · 시간축·영향·근거 카드는 Phase 1 자산 그대로다(IA §8 "유지").
 * 바뀐 것은 패널이 읽는 것과 말하는 것이다:
 *   읽는 것   TrainingScenario(스냅샷) · Forecast(기준·대안 예측판) · TrainingRun(훈련 기록)
 *   말하는 것 훈련 시나리오 → 대안 선택 → 유효 시각 → 기준 대 대안 영향 → 근거·한계 → 훈련 기록
 *
 * ★ 원 사건은 바뀌지 않는다(IA §13.1). 훈련 중 결정·조치·결과는 TrainingRun 에만 쌓인다.
 * ★ 대안은 런타임 계수로 계산하지 않는다. 시나리오가 참조한 사전 작성 예측판을 고른다.
 * ★ 유효 시각 눈금값만 판단에 쓴다(IA §8). 눈금 사이 값을 만들지 않는다.
 * ★ 선택(scenarioId · alternativeId · validAt · family)은 query 가 든다(IA §5.2). 훈련 진행은 엔진이 든다.
 *
 * 유형별 장면은 예측판이 든 장면 층(SceneLayers)이 그린다. 좌하단 조건 요약, 우하단 광역 인셋(03 §23), 아래 보조 분석뷰(종단도·계통도)는
 * 공통 부품이다. 열돔 지구본(components/heat-dome)은 E 의 광역 인셋으로 내려갔고 메인은 격자 노출 장면이다(03 §22 E).
 *
 * 실사 3D 모델은 확보 대상이 아니다. 지형·건물을 세우고 예측판의 침수 범위 폴리곤을 얹는다.
 * TODO(실개발): 예측판 침수심 격자 → 지형 위 수면(lib/flood-scene setFloodLevel) 매핑. 지금은 범위 폴리곤만 그린다
 * ───────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import maplibregl from "maplibre-gl";
import { Button, EmptyState, GlassPanel, Notice, toast } from "@ds";
import { useMapLibre } from "../../lib/useMapLibre";
import { useWindLayer } from "../../lib/useWindLayer";
import { DEFAULT_WEATHER, isWeatherKey, weatherLayerItems, type WeatherState } from "../../lib/weather-layers";
import { useTemperatureLayer } from "../../lib/useTemperatureLayer";
import { usePrecipitationLayer } from "../../lib/usePrecipitationLayer";
import { MapUtilStrip } from "../../components/MapUtilStrip";
import type { LegendShape } from "../../components/LayerSwatch";
import { CENTER_LEFT, CENTER_RIGHT, LEFT_RAIL, RAIL_BASE, RIGHT_RAIL, UTIL_STRIP, utilStripStyle } from "../../lib/layout";
import { ensureHillshade, setBuildings3D, setHillshadeVisible, setTerrain } from "../../lib/flood-scene";
import { ensureSafemapLayers, setSafemapVisible } from "../../lib/safemap";
import { cssColor, depthLevel, extentPaint, scopePaint, setPolygonLayerVisible, upsertPolygonLayer, type ExtentTone } from "../../lib/map-polygon";
import { ensureFloodSurface, setFloodSurface } from "../../lib/flood-surface";
import { loadTerrainFine, type TerrainPatch } from "../../lib/terrain-grid";
import { FLOOD_BOX, FLOOD_LEVELS, FLOOD_SEED } from "../../fixtures/seohang-flood/geometry.generated";
import { forecastBasisOf, markOf } from "../../lib/forecast-twin";
import { formatClock } from "../../lib/datetime";
import { DEVICE_KINDS, type DeviceKind } from "../../demo/devices";
import { hazardLayersOf, hazardSwatchOf } from "../../demo/hazard-layers";
import type { TwinFamily } from "../../model/incident";
import { TWIN_FAMILY_CATALOG, TWIN_FAMILY_HAZARD_NAME, TWIN_FAMILY_ORDER } from "../../model/twin-family";
import { CITY_CENTER } from "../../lib/map-config";
import { ALTERNATIVE_LABEL, type AlternativeId, type Forecast } from "../../model/forecast";
import type { TrainingOrigin, TrainingScenario } from "../../model/training";
import { conditionScenarios, findForecast, findIncident } from "../../model/selectors";
import { GEOMETRIES, SCOPE_ZOOM, deviceOfSubject, isSensorSubject } from "../../fixtures";
import { useScenario } from "../../state/ScenarioProvider";
import { TimeStrip } from "./widgets/TimeStrip";
import { AlternativePicker } from "./widgets/AlternativePicker";
import { AnalysisBasisCard } from "./widgets/AnalysisBasisCard";
import { TrainingScenarioCard } from "./widgets/TrainingScenarioCard";
import { ConditionSetCard, type RegionOption } from "./widgets/ConditionSetCard";
import type { TwinFamilyOption } from "./widgets/TwinFamilySelect";
import { TRAINING_CONDITION_SETS, TRAINING_REGIONS } from "../../fixtures";
import { ForecastCompareCard } from "./widgets/ForecastCompareCard";
import { TrainingRunCard } from "./widgets/TrainingRunCard";
import { TwinDeviceMarkers } from "./widgets/TwinDeviceMarkers";
import { HazardLayers } from "../../components/HazardLayers";
import { useHeatDomeData } from "../../components/heat-dome";
import { ContextInset, insetKindOf } from "../../components/twin/ContextInset";
import { MapLegend } from "../../components/twin/MapLegend";
import { SceneLayers, raiseSceneLayers } from "../../components/twin/SceneLayers";
import { ProfileView, SystemView } from "../../components/twin/AuxView";
import { ConditionSummary } from "../../components/twin/ConditionSummary";
import { TwinWeather } from "./widgets/TwinWeather";
import { mergeScene } from "../../model/scene";
import { previewScene } from "../../lib/twin-preview";
import { DecisionDialog, type DecisionDraft } from "./widgets/DecisionDialog";
import { TrainingSummaryCard } from "./widgets/TrainingSummaryCard";

/** 마을과 건물이 함께 잡히는 배율 — 구역 범위 배율보다 한 단 가깝다. 베이스맵 3D 건물이 15부터 나온다 */
const TWIN_ZOOM = SCOPE_ZOOM.구역 + 0.8;
/** 트윈은 지도 화면보다 더 눕힌다. 물이 차오르는 것은 높이의 이야기라 위에서 내려다보면 "잠긴다"가 안 보인다 */
const TWIN_PITCH = 60;
/** 구역 맞춤 여백(px) — 패널 안쪽에서 구역 외곽선까지 */
const FIT_MARGIN = 32;

const SCOPE_SOURCE = "training-scope";
const EXTENT_SOURCE = "training-extent";

/** 씬 표식 토글 — 상태만 여기, 조작은 지도 위 레이어 팝오버(MapUtilStrip) */
interface LayerState {
  devices: Record<DeviceKind, boolean>;
  /** 사건 범위 외곽선 */
  scope: boolean;
  /** 선택 눈금의 예측 침수 범위 */
  extent: boolean;
  /** 행안부 해안침수예상도 — 실시간 WMS(lib/safemap.ts). 예측판과 겹쳐 보는 대조층 */
  floodOfficial: boolean;
}

const DEFAULT_LAYERS: LayerState = {
  /* 사건 주체 핵심 장비만 기본 표시 — 전체를 깔면 분석 지점이 묻힌다 */
  devices: { WL: true, RN: false, DP: false, CV: true, BC: false, TD: false },
  scope: true,
  extent: true,
  /* 공식 자료는 대조용 — 기본 꺼짐 */
  floodOfficial: false,
};

/** 레이어 목록 견본 — 지도 면·범례와 같은 토큰. 렌더 시점에 읽는다(모듈 평가 때는 토큰 CSS 가 아직 없을 수 있다) */
const impactItems = (): { id: keyof LayerState; label: string; color: string; icon: string; shape: LegendShape }[] => [
  /* 순서는 위계 — 틀(사건 범위) → 결과(침수면) → 대조(공식 자료). 표식은 지도에 그린 문법 그대로 */
  { id: "scope", label: "사건 범위", color: cssColor("--color-danger", "#ef4444"), icon: "mdi:vector-polygon", shape: "area" },
  { id: "extent", label: "예측 침수 범위", color: cssColor("--color-primary-text", "#60a5fa"), icon: "mdi:waves", shape: "area" },
  { id: "floodOfficial", label: "해안침수예상도", color: cssColor("--color-foreground-muted", "#9ca3af"), icon: "mdi:map-legend", shape: "raster" },
];

/** 유형 축 — 03 §5 일곱 유형군. 조건 세트가 있는 유형은 그 수, 없는 유형은 개념 예시(03 §16) */
/* 화면에는 재난명만. A~G 표현 유형명·"조건 세트 n"·"개념 장면"은 제작자 언어라 셀렉트에 올리지 않는다 */
const FAMILY_OPTIONS: TwinFamilyOption[] = TWIN_FAMILY_ORDER.map((id) => ({ id, label: TWIN_FAMILY_HAZARD_NAME[id] }));

export function DigitalTwinPage() {
  const navigate = useNavigate();
  const { districtId } = useParams();
  const [params, setParams] = useSearchParams();
  const { demoNow: now, trainingScenarios, trainingRuns, startTrainingRun, recordTrainingEntry, endTrainingRun, agentOpen, selectedDeviceId } = useScenario();

  /* ── 훈련 시나리오 — query 가 정본. Phase 1 진입점(`/scr-05/:districtId`)은 그 지구의 원 사건으로 좁힌다 ── */
  const candidates = useMemo(
    () => (districtId ? trainingScenarios.filter((s) => findIncident(s.source.sourceIncidentId)?.legacyDistrictId === districtId) : trainingScenarios),
    [trainingScenarios, districtId],
  );
  /* 출처 둘 — query `scenarioId` 가 있으면 사건 스냅샷, 없으면 조건 세트(`family` 유형 → `condition` 조합, 기본 A 첫 세트 = 대표 사건 조건) */
  const familyParam = params.get("family") as TwinFamily | null;
  const familyPick: TwinFamily = familyParam && TWIN_FAMILY_ORDER.includes(familyParam) ? familyParam : "A";
  const familySets = useMemo(() => TRAINING_CONDITION_SETS.filter((s) => s.twinFamily === familyPick), [familyPick]);
  const conditions = useMemo(() => conditionScenarios(), []);
  const scenarioParam = params.get("scenarioId");
  const conditionParam = params.get("condition");
  const snapshot = scenarioParam ? candidates.find((s) => s.scenarioId === scenarioParam) ?? null : null;
  const scenarioMissing = Boolean(scenarioParam) && !snapshot;
  const conditionScenario = conditions.find((s) => s.conditionSet?.twinFamily === familyPick && s.conditionSet.setId === conditionParam) ?? conditions.find((s) => s.conditionSet?.twinFamily === familyPick) ?? null;
  const scenario: TrainingScenario | null = snapshot ?? (scenarioMissing ? null : conditionScenario);
  const origin: TrainingOrigin = snapshot ? "incident-snapshot" : "condition-set";
  /* 조건 세트가 없는 유형(E) — 계약 한 줄만 세우고 결과를 만들지 않는다(03 §16) */
  const contractOnly = !snapshot && !scenarioMissing && familySets.length === 0;
  /* 지역 축 — 유형의 후보 전부. 예측판 있는 지역만 열린다 */
  const regionOptions = useMemo<RegionOption[]>(
    () => TRAINING_REGIONS.filter((r) => r.twinFamily === familyPick).map((r) => ({ id: r.regionId, label: r.label, prepared: familySets.some((s) => s.regionId === r.regionId && s.baselineForecastId) })),
    [familyPick, familySets],
  );
  const regionPick = conditionScenario?.conditionSet?.regionId ?? null;
  const regionSets = useMemo(() => familySets.filter((s) => s.regionId === regionPick), [familySets, regionPick]);
  const sourceIncident = scenario ? findIncident(scenario.source.sourceIncidentId) ?? null : null;
  const legacyDistrict = sourceIncident?.legacyDistrictId ?? "seohang";

  /* ── 예측판 — 스냅샷이 참조한 기준 예측판과 사전 작성 대안. 유효성은 보지 않는다(상대시간 재생) ── */
  const baseline: Forecast | null = scenario?.selectedForecast ? findForecast(scenario.selectedForecast.forecastId) ?? null : null;
  const alternatives = useMemo(() => {
    if (!scenario) return [];
    const seen = new Set<AlternativeId>();
    return scenario.training.alternativeForecastIds
      .map((id) => findForecast(id))
      .filter((f): f is Forecast => Boolean(f))
      .filter((f) => (seen.has(f.alternativeId) ? false : (seen.add(f.alternativeId), true)));
  }, [scenario]);
  const alternativeParam = params.get("alternativeId") as AlternativeId | null;
  const selected: Forecast | null = (alternativeParam ? alternatives.find((f) => f.alternativeId === alternativeParam) : null) ?? baseline;
  const validAt = params.get("validAt") ?? scenario?.selectedForecast?.validAt ?? null;
  const baselineMark = baseline ? markOf(baseline, validAt) : null;
  const selectedMark = selected ? markOf(selected, validAt, false) : null;
  const same = Boolean(baseline && selected && baseline.forecastId === selected.forecastId);
  /* 장면 층 — 고른 예측판의 고정 층 + 그 눈금의 층. 대안이 눈금을 공유하면 눈금 층은 같고 고정 층(방화선 등)만 다르다 */
  /* 결정 — 이 훈련의 마지막 결정 기록. 대응 버튼은 미리보기이고 이 기록만이 실제 선택이다 */
  const runs = useMemo(() => (scenario ? trainingRuns.filter((r) => r.scenarioId === scenario.scenarioId) : []), [trainingRuns, scenario]);
  const run = runs[runs.length - 1] ?? null;
  const running = run?.status === "진행중";
  const decision = useMemo(() => (run ? [...run.decisions].reverse().find((d) => d.alternativeId) ?? null : null), [run]);
  const decidedHere = Boolean(decision && selected && decision.alternativeId === selected.alternativeId);
  const sceneLayers = useMemo(() => {
    const merged = mergeScene(selected?.scene ?? baseline?.scene, selectedMark?.scene ?? baselineMark?.scene);
    /* 결정한 대응이 아니면 "통제됨"을 "통제 시"로 — 구경과 결정을 섞지 않는다 */
    return decidedHere ? merged : previewScene(merged);
  }, [selected, baseline, selectedMark, baselineMark, decidedHere]);

  /* ── 트윈 유형군 — 스냅샷은 원 사건의 유형군, 조건 세트는 유형 축이 정한다 ── */
  const family: TwinFamily = snapshot ? snapshot.source.twinFamily : familyPick;
  const contract = TWIN_FAMILY_CATALOG[family];
  /* 상층장은 폭염일 때만 읽는다(0.9MB). 광역 인셋의 열돔 지구본이 쓴다 */
  const dome = useHeatDomeData(undefined, family === "E");


  /* ── query 쓰기 ── */
  const setQuery = (patch: Record<string, string | null>, replace = false) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace });
  };
  const selectScenario = (id: string) => setQuery({ scenarioId: id, condition: null, alternativeId: null, validAt: null });
  const selectCondition = (setId: string) => setQuery({ scenarioId: null, condition: setId, alternativeId: null, validAt: null });
  const selectRegion = (regionId: string) => {
    const first = familySets.find((s) => s.regionId === regionId && s.baselineForecastId) ?? familySets.find((s) => s.regionId === regionId);
    if (first) selectCondition(first.setId);
  };
  const pickValidAt = (at: string) => setQuery({ validAt: at }, true);
  const pickFamily = (id: TwinFamily) => setQuery({ family: id === "A" ? null : id, scenarioId: null, condition: null, alternativeId: null, validAt: null });

  /* ── 지도 ── */
  /* 범위는 시나리오가 든다(사건 스냅샷·조건 세트·개념 장면 공통). 아무것도 없으면 시 전체 */
  const center = scenario?.source.scope.displayAnchor ?? CITY_CENTER;
  const zoom = scenario ? TWIN_ZOOM : SCOPE_ZOOM.전역;
  /* 시 전체는 눕히지 않는다 — 기울일 지형·건물이 없다 */
  /* 쉬는 시점은 평면이다 — 판단은 위에서 내려다볼 때 가장 잘 읽힌다. 3D 는 스트립 버튼으로 세운다(2026-09-15 사용자) */
  const pitch = 0;
  const mapContainer = useRef<HTMLDivElement>(null);
  /* 진입은 기울인 3D(TWIN_PITCH)에서 시작하고 focusScope 가 평면으로 눕힌다 — "공간이 자리에 내려앉는다" */
  const { map, ready } = useMapLibre(mapContainer, { center, zoom, pitch: scenario ? TWIN_PITCH : 0 });
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
  const [weather, setWeather] = useState<WeatherState>(DEFAULT_WEATHER);

  /* 기상 층 기본값은 유형이 정한다 — 폭염·산불에 비를 깔지 않는다. 격자 색과 기온 색을 같은 면에 섞지 않는다(03 §22 E).
     도시침수는 강수 색면을 메인에 깔지 않는다 — 광역 인셋이 강우를 들고, 메인은 수면(파랑)이 주인공이라 보라 색면이 겹치면 물이 안 읽힌다(03 §22 A) */
  useEffect(() => {
    setWeather(family === "E" || family === "A" ? { rain: false, temp: false, wind: false } : family === "D" || family === "C" ? { rain: false, temp: false, wind: true } : DEFAULT_WEATHER);
  }, [family]);
  /* 보조 분석뷰 접힘 — 지도 장면을 가리므로 머리만 남길 수 있다 */
  const [auxCollapsed, setAuxCollapsed] = useState(false);

  /* 범위 폴리곤이 있으면 그 안에 맞춘다(구역·시설 크기가 제각각이라 배율 하나로는 산불 영향권이 화면을 넘친다).
     지점·시설처럼 범위 링이 없으면 기준 예측판의 침수·영향 범위 전체를 담고, 그것도 없으면 앵커로 */
  const scopeRing = scenario?.source.scope.affectedGeometryId ? GEOMETRIES[scenario.source.scope.affectedGeometryId] : undefined;
  const fitPoints = useMemo<[number, number][]>(() => {
    if (scopeRing && scopeRing.length > 0) return scopeRing;
    const rings = (baseline?.marks ?? []).map((m) => GEOMETRIES[m.extentGeometryId]).filter(Boolean);
    return [...rings.flat(), ...(scenario ? [scenario.source.scope.displayAnchor] : [])];
  }, [scopeRing, baseline, scenario]);
  const focusScope = useCallback(
    (duration: number) => {
      const instance = map.current;
      if (!instance) return;
      /* 좌우 패널 영역은 빼고 그 안에서 가운데. 구역이 여백만 두고 꽉 차게 — 배율 상한을 두지 않는다 */
      const padding = { top: FIT_MARGIN, bottom: FIT_MARGIN, left: CENTER_LEFT + FIT_MARGIN, right: CENTER_RIGHT + FIT_MARGIN };
      if (fitPoints.length > 1) {
        const bounds = fitPoints.reduce((acc, p) => acc.extend(p), new maplibregl.LngLatBounds(fitPoints[0], fitPoints[0]));
        instance.fitBounds(bounds, { padding, pitch, bearing: 0, duration });
        return;
      }
      instance.easeTo({ center, zoom, pitch, bearing: 0, padding, duration });
    },
    [map, center, zoom, pitch, fitPoints],
  );
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    ensureHillshade(instance);
    focusScope(800);
  }, [map, ready, focusScope]);

  /* 씬 표현은 토글을 두지 않는다 — 3D 로 세우고 지형을 깔고 음영으로 능선을 살리는 것이 이 화면의 정체다 */
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    setBuildings3D(instance, true);
    setTerrain(instance, true);
    setHillshadeVisible(instance, true);
    ensureSafemapLayers(instance);
    setSafemapVisible(instance, "flood-expect", layers.floodOfficial);
  }, [map, ready, layers.floodOfficial]);

  /* 고해상 지형 — 침수 수면이 지형을 따라 차오르게(lib/flood-surface). 도시침수에서만 읽는다 */
  const [finePatch, setFinePatch] = useState<TerrainPatch | null>(null);
  useEffect(() => {
    if (family !== "A" || finePatch) return;
    let cancelled = false;
    loadTerrainFine().then((g) => { if (!cancelled) setFinePatch(g.patches.seohang ?? null); }).catch((e) => console.error("[flood-surface] 고해상 지형 로드 실패 — scripts/fetch-terrain-fine.mjs 를 돌렸나", e));
    return () => { cancelled = true; };
  }, [family, finePatch]);

  /* 사건 범위 + 선택 눈금의 예측 침수 범위 — 사건 작업공간과 같은 문법(lib/map-polygon).
     도시침수는 면 대신 지형을 채운 수면(flood-surface)이 서고 폴리곤 층은 점선 외곽만 남는다 */
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    /* 폭염은 격자 면이 영향 면이다 — 범위 폴리곤을 따로 칠하면 채널이 겹친다 */
    const extentRing = selectedMark && family !== "E" ? GEOMETRIES[selectedMark.extentGeometryId] : null;
    upsertPolygonLayer(instance, SCOPE_SOURCE, scopeRing, scopePaint());
    /* 영향 면의 색과 진하기는 유형이 정한다 — 물은 침수심, 불·지반·장애는 그 눈금 지표를 눈금 최대값 대비로 */
    const tone: ExtentTone = family === "D" ? "fire" : family === "F" ? "ground" : family === "G" ? "outage" : "water";
    const level = selectedMark
      ? selectedMark.metric && selected
        ? selectedMark.metric.value / Math.max(...selected.marks.map((m) => m.metric?.value ?? 0), 1e-9)
        : depthLevel(selectedMark.maxDepthM)
      : 0.4;
    const waterLevel = family === "A" && selectedMark ? FLOOD_LEVELS[selectedMark.extentGeometryId] : undefined;
    const paint = extentPaint(level, tone);
    ensureFloodSurface(instance);
    if (waterLevel !== undefined && finePatch) {
      setFloodSurface(instance, finePatch, { level: waterLevel, seed: FLOOD_SEED, box: FLOOD_BOX }, layers.extent);
      upsertPolygonLayer(instance, EXTENT_SOURCE, extentRing, { ...paint, opacity: 0 });
    } else {
      setFloodSurface(instance, null, null, false);
      upsertPolygonLayer(instance, EXTENT_SOURCE, extentRing, paint);
    }
    setPolygonLayerVisible(instance, SCOPE_SOURCE, layers.scope);
    setPolygonLayerVisible(instance, EXTENT_SOURCE, layers.extent);
    /* 범위·수면 층이 이 effect 에서 처음 붙으면 장면 층(도로 상태 선·차단 지점)이 그 아래로 내려간다 — 다시 올린다 */
    raiseSceneLayers(instance);
  }, [map, ready, scopeRing, selectedMark, selected, family, layers.scope, layers.extent, finePatch]);

  /* 사건 주체 → Phase 1 핀 부품이 받는 모양으로 (scr-02 와 같은 변환) */
  const devices = useMemo(
    () => (sourceIncident?.correlationKeys ?? []).filter(isSensorSubject).map((id) => deviceOfSubject(id, legacyDistrict)),
    [sourceIncident, legacyDistrict],
  );
  const visibleDevices = devices.filter((d) => layers.devices[d.kind as DeviceKind] || d.id === selectedDeviceId);
  const deviceCounts = useMemo(() => {
    const counts = {} as Record<DeviceKind, number>;
    for (const spec of DEVICE_KINDS) counts[spec.kind] = 0;
    for (const d of devices) counts[d.kind as DeviceKind] += 1;
    return counts;
  }, [devices]);

  /* 대피 시설 — 등재된 지구(서항)에서만 온다 */
  const hazards = useMemo(() => (sourceIncident ? hazardLayersOf(legacyDistrict, "twin") : []), [sourceIncident, legacyDistrict]);
  const [hazardOn, setHazardOn] = useState<Record<string, boolean>>({});
  /* 대피 시설은 기본 꺼짐 — 지금 장면의 질문(어디까지 잠기나 · 통제해야 하나)에서 한 단계 뒤다. 레이어 팝오버에서 켠다 */
  useEffect(() => {
    setHazardOn(Object.fromEntries(hazards.map((h) => [h.id, false])));
  }, [hazards]);

  /* 기상 격자 — 어느 시각의 기상인가는 훈련 축이 정한다. 훈련은 원 사건 시각을 보존하므로 유효시각 그대로 쓴다 */
  const weatherHour = new Date(validAt ?? now.toISOString()).getHours();
  useWindLayer(map, ready, weather.wind);
  useTemperatureLayer(map, ready, weather.temp);
  usePrecipitationLayer(map, ready, weather.rain, weatherHour);

  /* ── 시간축·근거 — 훈련 기준시각에서의 경과로 읽는다(IA §13.1 상대시간 재생) ── */
  const basis = selected && selectedMark ? forecastBasisOf(selected, selectedMark) : baseline && baselineMark ? forecastBasisOf(baseline, baselineMark) : null;

  /* ── 훈련 진행 — 전이는 엔진이 든다 ── */
  const start = () => {
    if (!scenario) return;
    startTrainingRun(scenario.scenarioId);
    toast.success("이 조건으로 훈련을 시작했습니다", { description: `기준 ${formatClock(scenario.timing.trainingBaseTime)} · 조건은 고정되고 기록은 원 사건과 분리됩니다` });
  };
  /* 결정 기록 — 대화상자에서 확정한다. 대응 버튼을 누른 것만으로는 아무것도 결정되지 않는다 */
  const [decisionOpen, setDecisionOpen] = useState(false);
  const recordDecision = ({ alternativeId, startAt, memo }: DecisionDraft) => {
    if (!run || !running || !selectedMark) return;
    const isBase = alternativeId === "baseline";
    /* 시각 · 상황(도달) · 선택 · 시작이 자동으로 들어간다. 사용자가 적는 건 메모뿐 */
    const seen = arrivalOf(selected ?? baseline!);
    recordTrainingEntry(run.trainingRunId, "decisions", {
      at: selectedMark.validAt,
      summary: `${formatClock(selectedMark.validAt)} 상태에서${seen.at ? ` · ${seen.label} ${formatClock(seen.at)} 를 보고` : ""} · ${isBase ? "대응하지 않음" : `${ALTERNATIVE_LABEL[alternativeId]} ${formatClock(startAt)} 시작`}${memo ? ` · ${memo}` : ""}`,
      alternativeId,
      startAt: isBase ? undefined : startAt,
      memo: memo || undefined,
    });
    /* 기록한 대응을 화면에도 올린다 — 기록 뒤 지도가 "통제됨"을 쓰는 것을 바로 본다 */
    setQuery({ alternativeId: isBase ? null : alternativeId });
    toast.success("결정을 기록했습니다", { description: `${formatClock(selectedMark.validAt)} · ${isBase ? "대응하지 않음" : `${ALTERNATIVE_LABEL[alternativeId]} ${formatClock(startAt)} 시작`}` });
  };
  const completed = run?.status === "완료";
  const [showRecords, setShowRecords] = useState(false);
  const regionLabel = regionOptions.find((r) => r.id === regionPick)?.label ?? scenario?.source.scope.label ?? "";
  const end = () => {
    if (!run || !running || !scenario) return;
    const last = selected ? ALTERNATIVE_LABEL[selected.alternativeId] : "-";
    endTrainingRun(run.trainingRunId, `훈련 결정 ${run.decisions.length}건 · 원 사건 결정 ${scenario.history.decisionIds.length}건 · 마지막 선택 ${last}`);
    toast.success("훈련을 종료했습니다", { description: "훈련 이력에 기록됐습니다. 원 사건은 바뀌지 않습니다" });
  };

  /* 시간 줄의 핵심 도달 — 첫 영향 대상. 도로는 "통행 지장", 시설·건물은 "침수 도달", 대상자는 "노출". 도달이 없는 예측판은 그렇다고 말한다 */
  const arrivalOf = (f: Forecast): { label: string; at: string | null } => {
    const first = f.targets[0];
    const verb = first?.kind === "도로" ? "통행 지장 예상" : first?.kind === "대상자" ? "노출 예상" : "침수 도달 예상";
    if (!first) return { label: "영향 범위 도달 예상", at: f.arrivalAt };
    return { label: `${first.label} ${verb}`, at: first.arrivalAt ?? null };
  };
  /* 물 유형 — 면의 진하기가 깊이라 범례를 세운다 */
  const water = family === "A" || family === "B" || family === "C";
  /* 보조 분석뷰가 서는가 — 인셋 자리 계산에 쓴다 */
  const aux = Boolean(selected && selectedMark && (selected.profile || selected.system));

  const title = contractOnly ? `디지털트윈 · ${TWIN_FAMILY_HAZARD_NAME[family]}` : !scenario ? "디지털트윈" : scenario.conditionSet ? `디지털트윈 · ${scenario.conditionSet.label}` : `디지털트윈 · ${sourceIncident?.title ?? scenario.source.sourceIncidentId}`;
  /* 출처 스위치는 없다 — 메뉴는 조건을 고르는 자리이고, 끝난 사건의 스냅샷은 사건 작업공간(scr-02 D8)에서 링크로 들어온다.
     스냅샷 모드에서는 첫 카드가 스냅샷 카드로 바뀌고 좌상단에 돌아갈 캡슐이 선다 */

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* 3D 씬 — 배경 */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-surface" style={{ isolation: "isolate" }} aria-label={`${title} 3D 씬`}>
        <div ref={mapContainer} className="h-full w-full" />
        {scenario && <TwinDeviceMarkers map={map} ready={ready} devices={visibleDevices} selectedId={selectedDeviceId} />}
        <HazardLayers map={map} ready={ready} layers={hazards} visible={hazardOn} />
        <SceneLayers map={map} ready={ready} layers={sceneLayers} />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-surface">
            <Icon icon="mdi:loading" className="size-5 animate-spin text-foreground-subtle" aria-hidden />
            <span className="text-body text-foreground-muted">3D 씬을 불러오는 중</span>
          </div>
        )}
      </div>

      {/* 좌상단 — 광역 인셋(03 §23). 브레드크럼은 없다 — 디지털트윈은 최상위 메뉴라 돌아갈 상위가 없고 지금 조건은 우측 카드가 말한다.
          사건 스냅샷으로 들어왔을 때만 원 사건 작업공간으로 돌아갈 캡슐을 세운다(2026-09-15 사용자) */}
      <div className="pointer-events-none absolute left-3 top-3 z-30 flex flex-col items-stretch gap-2" style={{ width: LEFT_RAIL }}>
        {snapshot && sourceIncident && (
          <GlassPanel borderStyle="none" className="pointer-events-auto flex h-10 shrink-0 items-center gap-2 rounded-full px-4" aria-label="위치">
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-foreground-muted" onClick={() => navigate(`/scr-02/${sourceIncident.legacyDistrictId}`)}>
              <Icon icon="mdi:chevron-left" width={16} height={16} aria-hidden />
              사건 작업공간
            </Button>
            <span className="h-4 w-px bg-border" aria-hidden />
            <h1 className="min-w-0 truncate text-body font-semibold text-foreground">{sourceIncident.title}</h1>
          </GlassPanel>
        )}
        {scenario && insetKindOf(family) && (
          <ContextInset family={family} anchor={scenario.source.scope.displayAnchor} hour={weatherHour} dome={dome} meta={selectedMark ? formatClock(selectedMark.validAt) : undefined} />
        )}
      </div>

      {/* 좌하단 — 위에서 아래로 시간별 예보(날씨 유형 · 비와 바람 줄) 또는 조건 줄(G·E), 그리고 면 범례(켜진 층만) (03 §21) */}
      {scenario && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex flex-col items-stretch gap-2" style={{ width: LEFT_RAIL }}>
          {family !== "G" && family !== "E" && (
            <GlassPanel className="pointer-events-auto">
              <TwinWeather districtId={legacyDistrict} focus="rain" />
            </GlassPanel>
          )}
          {(family === "G" || family === "E") && (selected?.conditions ?? baseline?.conditions) && (
            <GlassPanel className="pointer-events-auto">
              <ConditionSummary lines={selected?.conditions ?? baseline?.conditions} districtId={legacyDistrict} showWeather={false} />
            </GlassPanel>
          )}
          <MapLegend depth={water && layers.extent ? { label: family === "B" ? "범람심" : "침수심" } : null} official={layers.floodOfficial} rain={weather.rain} temp={weather.temp} />
        </div>
      )}


      {/* 보조 분석뷰 (03 §21) — 지도로 못 보이는 것. B 종단도 · G 계통도. 시간 칩과 같은 눈금 */}
      {aux && selected && selectedMark && (
        <div className="pointer-events-none absolute bottom-3 z-20" style={{ left: CENTER_LEFT, right: CENTER_RIGHT }}>
          <GlassPanel className="pointer-events-auto">
            {selected.profile && (
              <ProfileView profile={selected.profile} validAt={selectedMark.validAt} compareAt={!same && baseline?.profile ? baseline.profile.levelsByMark[selectedMark.validAt] ?? null : null} collapsed={auxCollapsed} onToggle={() => setAuxCollapsed((v) => !v)} />
            )}
            {selected.system && <SystemView system={selected.system} validAt={selectedMark.validAt} collapsed={auxCollapsed} onToggle={() => setAuxCollapsed((v) => !v)} />}
          </GlassPanel>
        </div>
      )}



      {/* 씬 조작 — 지도 화면과 같은 스트립을 같은 자리에. 열돔에는 세우지 않는다(조작할 지도가 안 보인다) */}
      <div className={UTIL_STRIP} style={utilStripStyle(agentOpen)}>
        <MapUtilStrip
          map={map}
          disabled={!ready}
          homePitch={TWIN_PITCH}
          onReset={() => focusScope(500)}
          layers={[
            {
              title: "장비",
              items: DEVICE_KINDS.filter((spec) => deviceCounts[spec.kind] > 0).map((spec) => ({
                id: spec.kind,
                label: spec.label,
                color: spec.color,
                icon: spec.icon,
                shape: "device" as const,
                count: deviceCounts[spec.kind],
                visible: layers.devices[spec.kind],
              })),
              onToggle: (id) => setLayers((prev) => ({ ...prev, devices: { ...prev.devices, [id as DeviceKind]: !prev.devices[id as DeviceKind] } })),
              onSetAll: (visible) => setLayers((prev) => ({ ...prev, devices: Object.fromEntries(DEVICE_KINDS.map((spec) => [spec.kind, visible])) as Record<DeviceKind, boolean> })),
            },
            ...(hazards.length > 0
              ? [{
                  title: "대피 시설",
                  items: hazards.map((h) => ({ id: h.id, label: h.label, color: h.color, icon: h.icon, shape: hazardSwatchOf(h), visible: hazardOn[h.id] ?? false })),
                  onToggle: (id: string) => setHazardOn((prev) => ({ ...prev, [id]: !(prev[id] ?? false) })),
                  onSetAll: (visible: boolean) => setHazardOn(Object.fromEntries(hazards.map((h) => [h.id, visible]))),
                }]
              : []),
            {
              title: "영향 표현",
              items: [
                ...impactItems().map((item) => ({ id: item.id, label: item.label, color: item.color, icon: item.icon, shape: item.shape, visible: layers[item.id] as boolean })),
                ...weatherLayerItems(weather),
              ],
              onToggle: (id) => (isWeatherKey(id) ? setWeather((prev) => ({ ...prev, [id]: !prev[id] })) : setLayers((prev) => ({ ...prev, [id]: !prev[id as keyof LayerState] }))),
              onSetAll: (visible) => {
                setLayers((prev) => ({ ...prev, ...Object.fromEntries(impactItems().map((item) => [item.id, visible])) }));
                setWeather({ rain: visible, temp: visible, wind: visible });
              },
            },
          ]}
        />
      </div>

      {/* 우측 — 한 패널 안의 다섯 단(조건 → 시간 → 대응 비교 → 결과 → 근거). 카드를 단마다 따로 세우지 않는다(2026-09-15 사용자) */}
      <div className={`${RAIL_BASE} right-3`} style={{ width: RIGHT_RAIL }}>
        {/* 유리판은 스크롤하지 않는다 — glass-edge ::before 가 스크롤 상자 안에서 내용과 같이 밀려 테두리가 중간에 뜬다. 안쪽 div 가 스크롤한다 */}
        <GlassPanel className="pointer-events-auto flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col divide-y divide-border overflow-y-auto overflow-x-hidden rounded-[inherit]">
          {/* 예외 (IA §5.2) — 빈 훈련을 만들지 않고 사실과 복귀 길을 세운다 */}
          {scenarioMissing && (
            <div className="shrink-0 p-3">
              <Notice
                variant="danger"
                title="사건 스냅샷을 찾을 수 없음"
                description={`${scenarioParam} 은 생성된 시나리오가 아닙니다. 다른 시나리오로 바꾸지 않습니다.`}
                action={candidates.length > 0 ? <Button size="sm" onClick={() => selectScenario(candidates[0].scenarioId)}>목록의 첫 시나리오 열기</Button> : <Button size="sm" onClick={() => navigate("/scr-01")}>종합상황으로</Button>}
              />
            </div>
          )}
          {!scenario && !scenarioMissing && !contractOnly && (
            <div className="shrink-0 p-3">
              <EmptyState
                variant="inline"
                icon="mdi:school-outline"
                message="열 수 있는 트윈이 없습니다"
                description="준비된 조건 세트가 없습니다. 종료된 사건에서 [훈련 스냅샷 만들기]로 스냅샷을 만들면 여기서 열립니다."
                action={<Button size="sm" variant="secondary" onClick={() => navigate("/scr-01")}>종합상황으로</Button>}
              />
            </div>
          )}

          {(scenario || contractOnly) && (
            <>
              {/* 훈련 완료 — 결정 타임라인 요약이 맨 위. 조건 카드는 다시 열려 새 훈련을 잡을 수 있다 */}
              {scenario && run && completed && (
                <div className="shrink-0">
                  <TrainingSummaryCard scenario={scenario} run={run} hazard={TWIN_FAMILY_HAZARD_NAME[family]} regionLabel={regionLabel} arrival={baseline ? arrivalOf(baseline) : null} showRecords={showRecords} onToggleRecords={() => setShowRecords((v) => !v)} />
                </div>
              )}
              <div className="shrink-0">
                {origin === "condition-set" ? (
                  <ConditionSetCard
                    sets={regionSets}
                    set={scenario?.conditionSet ?? null}
                    regions={regionOptions}
                    region={regionPick}
                    onRegionChange={selectRegion}
                    onChange={selectCondition}
                    families={FAMILY_OPTIONS}
                    family={family}
                    onFamilyChange={pickFamily}
                    contract={contract}
                    locked={running && scenario ? { baseTime: scenario.timing.trainingBaseTime } : null}
                  />
                ) : scenario ? (
                  <TrainingScenarioCard
                    scenarios={candidates}
                    scenario={scenario}
                    sourceTitle={sourceIncident?.title ?? scenario.source.sourceIncidentId}
                    onSelect={selectScenario}
                  />
                ) : null}
              </div>

              {!scenario ? null : !scenario.selectedForecast ? (
                /* 준비 안 된 조건 조합 — 값을 만들지 않는다. 실개발에서는 이 자리가 같은 조건의 ModelRun 요청이다 */
                <div className="shrink-0 p-3">
                  <Notice variant="info" title="이 조건의 예측판이 없습니다" description={scenario.conditionSet?.unavailableReason ?? "준비된 예측판이 없습니다 · 모델 연계 시 같은 조건으로 계산 요청"} />
                </div>
              ) : !baseline || !baselineMark ? (
                <div className="shrink-0 p-3">
                  <Notice variant="warning" title="기준 예측판이 유효하지 않음" description={`스냅샷이 참조한 ${scenario.selectedForecast.forecastId} 를 찾을 수 없습니다. 다른 예측판으로 대체하지 않습니다.`} />
                </div>
              ) : (
                /* 판단 순서대로 다섯 단 — 조건 → 시간 → 대응 비교 → 결과 → 근거 (사용자 재정비 2026-09-15) */
                <>
                  {/* ② 시간 — 기준 · 눈금 · 핵심 도달까지 남은 시간. 도달은 고른 대응의 예측판이 말한다 */}
                  <div className="shrink-0">
                    <TimeStrip
                      baseTime={scenario.timing.trainingBaseTime}
                      marks={baseline.marks.map((m) => m.validAt)}
                      selected={baselineMark.validAt}
                      onPick={pickValidAt}
                      arrival={arrivalOf(selected ?? baseline)}
                      action={selected?.actionAt ?? null}
                      decision={decidedHere && decision && decision.startAt ? { label: ALTERNATIVE_LABEL[decision.alternativeId!], at: decision.at, startAt: decision.startAt } : null}
                      markers={(run?.decisions ?? []).filter((d) => d.alternativeId).map((d) => ({ at: d.at, label: d.alternativeId === "baseline" ? "대응 없음" : ALTERNATIVE_LABEL[d.alternativeId!] }))}
                    />
                  </div>

                  {/* ③ 대응 비교 — 현재 조건 | 대안. 사전 작성 예측판 중에서 고른다 */}
                  {selected && (
                    <div className="shrink-0">
                      <AlternativePicker baseline={baseline} alternatives={alternatives} selected={selected} onPick={(f) => setQuery({ alternativeId: f ? f.alternativeId : null })} decided={decision?.alternativeId ?? null} />
                    </div>
                  )}

                  {/* ④ 결과 — 같은 시각에서 두 열 */}
                  {selected && (
                    <div className="shrink-0">
                      <ForecastCompareCard baseline={baseline} baselineMark={baselineMark} selected={selected} selectedMark={selectedMark} same={same} decided={decidedHere} decidedStartAt={decidedHere ? decision?.startAt ?? null : null} />
                    </div>
                  )}

                  {/* ⑤ 근거 — 접혀 있다 */}
                  {basis && (
                    <div className="shrink-0">
                      <AnalysisBasisCard basis={basis} />
                    </div>
                  )}
                </>
              )}

              {/* 훈련 기록은 첫 결정을 기록해야 생긴다. 완료 뒤에는 요약의 [기록 보기]가 연다 */}
              {scenario && run && run.decisions.length + run.actions.length + run.outcomes.length > 0 && (running || showRecords) && (
                <div className="shrink-0">
                  <TrainingRunCard scenario={scenario} run={run} runs={runs} />
                </div>
              )}
            </>
          )}
        </div>
        </GlassPanel>

        {/* 완료 동작 — 스크롤 밖. 훈련 시작 → 결정 기록 → 훈련 종료 */}
        {(scenario || contractOnly) && (
          <div className="flex shrink-0 flex-col gap-1.5">
            {running ? (
              <div className="flex gap-2">
                <Button className="pointer-events-auto flex-1" disabled={!selected || !selectedMark} onClick={() => setDecisionOpen(true)}>
                  <Icon icon="mdi:gavel" className="size-4" aria-hidden />
                  결정 기록
                </Button>
                <Button className="pointer-events-auto flex-1" variant="secondary" onClick={end}>
                  <Icon icon="mdi:flag-checkered" className="size-4" aria-hidden />
                  훈련 종료
                </Button>
              </div>
            ) : (
              <Button className="pointer-events-auto w-full" onClick={start} disabled={!baseline} title={baseline ? undefined : "예측판이 있는 유형·조건에서 시작합니다"}>
                <Icon icon="mdi:play-outline" className="size-4" aria-hidden />
                {runs.length > 0 ? "이 조건으로 새 훈련 시작" : "이 조건으로 훈련 시작"}
              </Button>
            )}
            {selected && selectedMark && (
              <DecisionDialog key={`${selected.forecastId}-${selectedMark.validAt}-${decisionOpen}`} open={decisionOpen} onOpenChange={setDecisionOpen} baseline={baseline!} alternatives={alternatives} initial={selected} validAt={selectedMark.validAt} arrival={arrivalOf(selected)} onConfirm={recordDecision} />
            )}
            <p className="pointer-events-auto rounded bg-surface/70 px-2 py-1 text-center text-caption text-foreground-subtle backdrop-blur-sm">
              훈련 기록은 훈련 이력에 남고 원 사건 기록과 분리됩니다
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
