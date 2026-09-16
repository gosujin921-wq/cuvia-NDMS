/* ─────────────────────────────────────────────
 * IA-02 사건 작업공간 — 정말 같은 사건인가, 무엇을 더 확인해야 하는가 (IA §7 · §8 · §9 · 02 D1~D7)
 *
 * Phase 1 SCR-02 재난관제의 골격을 그대로 잇는다: 지도 배경 + 상단 캡슐 + 좌측 열(추이·근거) + 우측 레일 +
 * 하단 현장영상 + 집중 팝업. 바뀐 것은 단위다 — 지구가 아니라 **사건**이고, 지도는 사건의 공간 범위
 * (지점·시설·회랑·구역·전역)에 맞춘다. 서항 배율을 박아 두지 않는다(README §9).
 *
 * 경로는 /scr-02/:districtId 그대로다(IA §5.2 — 신규 라우트를 만들지 않는다). 지구는 진입 키일 뿐 사건 범위를
 * 현장 하나로 제한하지 않는다. 화면이 보는 사건은 그 지구의 진행 사건이다.
 *
 * 판단·전망은 지도 위 우측 레일, 대응 승인·실행은 집중 팝업이다(04 §4 · README §8.2 2026-09-14 · 레거시 03 §0-9).
 * 우측 레일은 패널 탭 두 개로 전환한다(KISA 관제 우측 레일 문법). 별도 URL 없이 query `panel` 이 든다.
 *   (없음)          판단 — 위험도 · 전망 · 대응 요약 · 이력 · 바닥 액션 바
 *   panel=twin      전망 — 같은 지도가 예측 모드로 (IA-03). 대안 · 유효 시각 · 영향 · 근거·한계. 유효 전망이 있을 때만
 * 대응 실행 팝업(ResponsePopup)은 레일 [대응 실행] · 마커 [이 사건 대응하기] · 전망 [이 전망으로 대응 검토] 셋이 같은 것을
 * 연다. 열림은 UI 상태라 URL 에 넣지 않는다(IA §5.2). 승인·안정 전환은 그 위의 중첩 확인창이 tick 을 옮긴다.
 *
 * 담당자 조작(검토 인수·확인·전망 열기·대응 검토·승인·통제)은 상태를 쓰지 않는다 — 엔진 tick 을 옮긴다.
 * 선택(panel · forecastId · validAt · alternativeId · evidenceId · alertId)은 query 가 정본이다(IA §5.2).
 * 잘못된 사건·만료된 예측판은 임의로 바꾸지 않고 사실을 보이고 복귀 길을 준다(IA §5.2 예외).
 * ───────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import maplibregl from "maplibre-gl";
import { Badge, Button, GlassPanel, Notice, StatusBadge, Tabs, TabsList, TabsTrigger, Tag, cn } from "@ds";
import { useMapLibre } from "../../lib/useMapLibre";
import { useWindLayer } from "../../lib/useWindLayer";
import { usePrecipitationLayer } from "../../lib/usePrecipitationLayer";
import { SAFEMAP_LAYERS, ensureSafemapLayers, setSafemapVisible } from "../../lib/safemap";
import { weatherLayerItems, isWeatherKey, WEATHER_OFF, type WeatherState } from "../../lib/weather-layers";
import { CITY_CENTER } from "../../lib/map-config";
import { MapUtilStrip } from "../../components/MapUtilStrip";
import { MapPopup } from "../../components/MapPopup";
import { CctvBigView } from "../../components/CctvBigView";
import { CCTV_DOCK, CENTER_LEFT, CENTER_RIGHT, EDGE, LEFT_RAIL, RAIL_BASE, RIGHT_RAIL, UTIL_STRIP, utilStripStyle } from "../../lib/layout";
import { useScenario } from "../../state/ScenarioProvider";
import { formatClock, formatElapsed } from "../../lib/datetime";
import { ALERT_GRADE_TONE, alertRoleLabel, statusTone } from "../../lib/status-tone";
import type { Device } from "../../demo/devices";
import type { Facility } from "../../demo/facilities";
import type { EventEnvelope } from "../../model/event";
import type { Forecast } from "../../model/forecast";
import {
  chainStagesAt, channelsOfScope, currentForecastsOf, dataFaultsAt, decisionsAt, derivedFlagOf, disseminationsAt, districtViewAt, findWhatIfCase,
  districtAlertAt, riskEvidenceIdsOf, incidentViewAt, incidentsAt, isActiveStatus, recommendationsAt, relatedEventsAt, resolveForecast, sopItemsAt, watchViewAt, type CctvChannelView,
} from "../../model/selectors";
import { GEOMETRIES, SCOPE_ZOOM, SUBJECTS, deviceOfSubject, facilityOfSubject, isFacilitySubject, isSensorSubject } from "../../fixtures";
import { DISTRICTS } from "../../demo/districts";
import { ForecastRail } from "./widgets/ForecastRail";
import { ALTERNATIVE_LABEL } from "../../model/forecast";
import { cssColor, depthLevel, extentPaint, scopePaint, upsertPolygonLayer } from "../../lib/map-polygon";
import { ensureFloodSurface, setFloodSurface } from "../../lib/flood-surface";
import { loadTerrainFine, type TerrainGrid, type TerrainPatch } from "../../lib/terrain-grid";
import { floodSurfaceOf } from "../../lib/flood-surfaces";
import { SceneLayers, raiseSceneLayers } from "../../components/twin/SceneLayers";
import { mergeScene } from "../../model/scene";
import { previewScene } from "../../lib/twin-preview";
import { DeviceMarkers, type SubjectPin } from "./widgets/DeviceMarkers";
import { FacilityMarkers } from "./widgets/FacilityMarkers";
import { DevicePopup } from "./widgets/DevicePopup";
import { TrendPanel } from "./widgets/TrendPanel";
import { CrossCheckPanel } from "./widgets/CrossCheckPanel";
import { CctvDock } from "./widgets/CctvDock";
import { RiskCard } from "./widgets/RiskCard";
import { ImpactPanel } from "./widgets/ImpactPanel";
import { JudgeActionBar } from "./widgets/JudgeActionBar";
import { WatchAlertCard } from "./widgets/WatchAlertCard";
import { DistrictStatusCard } from "./widgets/DistrictStatusCard";
import { DistrictPickerChip } from "./widgets/DistrictPickerChip";
import { EventTimeline } from "./widgets/EventTimeline";
import { type ConfirmRequest } from "./widgets/SopPanel";
import { ResponsePopup } from "./widgets/ResponsePopup";
import { ResponseSummaryCard } from "./widgets/ResponseSummaryCard";
import { ExecutionPopup } from "./widgets/ExecutionPopup";


type Mode = "judge" | "twin";

const EXTENT_SOURCE = "incident-extent";
const SCOPE_SOURCE = "incident-scope";

export function EarlyWarningPage() {
  const { districtId = "" } = useParams();
  const districtName = DISTRICTS.find((d) => d.id === districtId)?.name ?? districtId;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { demoNow: now, ticks, tickIndex, advanceTick, agentOpen, selectDistrict, heroIncidentId, falsePositiveIds, markFalsePositive } = useScenario();
  /* URL 의 지구를 엔진의 선택 지구로 비춘다 — 종합상황으로 돌아가면 이 지구의 이름표·줄이 선택 상태로 선다 */
  useEffect(() => {
    if (districtId) selectDistrict(districtId);
  }, [districtId, selectDistrict]);
  /* 실행 결과가 도착한 뒤에만 안정 전환 —결과 tick 이전의 담당자 조작으로 시계가 결과를 건너뛰지 않게 */
  const resultsArrived = tickIndex >= ticks.findIndex((t) => t.id === "d7-results");
  const panel = params.get("panel");
  const mode: Mode = panel === "twin" ? "twin" : "judge";
  /* 대응 실행 팝업 — 열림은 UI 상태. 긴급 경로(판단·전망 전) 여부는 여는 순간의 상태로 정한다 */
  const [responseOpen, setResponseOpen] = useState(false);
  /* 위험도 기여도 줄 → 좌측 근거 강조. 같은 지표를 다시 누르면 해제 */

  /* ── 이 지구의 사건 — 진행 중인 것이 우선, 없으면 기록(오탐·종료)이라도 찾아 예외를 안내한다 ── */
  const all = useMemo(() => incidentsAt(now), [now]);
  const found = all.find((v) => v.incident.legacyDistrictId === districtId && isActiveStatus(v.workflowStatus)) ?? all.find((v) => v.incident.legacyDistrictId === districtId) ?? null;
  const incidentId = found?.incident.incidentId ?? "";
  /* 오탐은 담당자가 닫은 결과다 — 엔진 상태(falsePositiveIds)를 사건 뷰 위에 얹는다. 시나리오 이벤트를 고치지 않는다 */
  const view = useMemo(() => {
    const raw = incidentId ? incidentViewAt(incidentId, now) : null;
    return raw && falsePositiveIds.includes(raw.incident.incidentId) ? { ...raw, workflowStatus: "오탐" as const } : raw;
  }, [incidentId, now, falsePositiveIds]);
  const riskEvidenceIds = useMemo(() => riskEvidenceIdsOf(view?.assessment ?? null), [view]);
  const incident = view?.incident ?? null;
  /* 사건 전 알림 — 종합상황 감지 카드가 query `alertId` 로 보낸다. 사건이 없을 때만 그 알림의 근거를 세운다(IA §7).
     알림이 사건을 만든 뒤에는 사건이 우선이고 알림은 그 사건의 sourceAlerts 로 남는다 */
  const alertId = params.get("alertId") ?? (!found ? districtAlertAt(districtId, now)?.alertId ?? null : null);
  const watch = useMemo(() => (!found && alertId ? watchViewAt(alertId, now, districtId) : null), [found, alertId, now, districtId]);
  /* 지구 현황 — 사건도 알림도 없는 지구. 정의(주체·범위)가 있는 지구만 (04 §3 · 2026-09-14 결정) */
  const district = useMemo(() => (!found && !watch ? districtViewAt(districtId, now) : null), [found, watch, districtId, now]);
  /* 지도 범위·주체·카메라의 기준 — 사건 → 알림이 가리키는 구역 → 지구 정의 순 */
  const scope = incident ?? watch?.incident ?? district?.incident ?? null;
  const rows = useMemo(() => (view ? relatedEventsAt(incidentId, now) : watch?.rows ?? district?.rows ?? []), [view, incidentId, now, watch, district]);
  const faults = useMemo(() => (scope ? dataFaultsAt(now).filter((r) => scope.correlationKeys.includes(r.subjectId)) : []), [scope, now]);
  const forecasts = useMemo(() => currentForecastsOf(incidentId, now), [incidentId, now]);
  const baseline = forecasts.find((f) => f.alternativeId === "baseline") ?? forecasts[0] ?? null;
  const recommendation = useMemo(() => recommendationsAt(incidentId, now).at(-1) ?? null, [incidentId, now]);
  const approval = useMemo(() => decisionsAt(incidentId, now).find((d) => d.kind === "대응 승인" && d.status === "승인") ?? null, [incidentId, now]);
  const disseminations = useMemo(() => disseminationsAt(incidentId, now), [incidentId, now]);
  const sopItems = useMemo(() => sopItemsAt(incidentId, now), [incidentId, now]);
  const chain = useMemo(() => chainStagesAt(incidentId, now), [incidentId, now]);
  const channels = useMemo(() => (scope ? channelsOfScope(scope, now) : []), [now, scope]);

  /* 사건 주체 → Phase 1 핀 부품이 받는 모양으로 */
  const legacyDistrict = scope?.legacyDistrictId ?? "seohang";
  const devices = useMemo(() => (scope?.correlationKeys ?? []).filter(isSensorSubject).map((id) => deviceOfSubject(id, legacyDistrict)), [scope, legacyDistrict]);
  const sensors = devices.filter((d) => d.kind !== "CV");
  const facilities = useMemo(() => (scope?.correlationKeys ?? []).filter(isFacilitySubject).map((id) => facilityOfSubject(id, legacyDistrict)), [scope, legacyDistrict]);
  const pins = useMemo<SubjectPin[]>(
    () =>
      devices.map((device) => {
        const flag = derivedFlagOf(device.id, now);
        return {
          device,
          flag: flag ? { type: device.kind === "RN" ? "강우" : "수위", level: flag.eventType === "RATE_CHANGED" ? "warning" : "advisory", label: device.name } : undefined,
        };
      }),
    [devices, now],
  );

  /* ── 지도 ── */
  const mapContainer = useState(() => ({ current: null as HTMLDivElement | null }))[0];
  const { map, ready } = useMapLibre(mapContainer);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = devices.find((d) => d.id === selectedId) ?? null;
  const selectedChannel = selected?.kind === "CV" ? channels.find((c) => c.id === selected.id) ?? null : null;

  /* 안전지도 층(해안침수예상도·침수흔적도)은 기본 끔 — 전망 범위와 겹치면 어느 것이 예측인지 안 보인다 (2026-09-15) */
  const [safemapOn, setSafemapOn] = useState<Record<string, boolean>>(Object.fromEntries(SAFEMAP_LAYERS.map((spec) => [spec.id, false])));
  /* 침수 전망 범위 층 — 전망 탭에서만 서고 영향 표현 목록에서 끌 수 있다 */
  const [extentOn, setExtentOn] = useState(true);
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    ensureSafemapLayers(instance);
    for (const spec of SAFEMAP_LAYERS) setSafemapVisible(instance, spec.id, safemapOn[spec.id] ?? false);
  }, [map, ready, safemapOn]);
  const [weather, setWeather] = useState<WeatherState>(WEATHER_OFF);
  useWindLayer(map, ready, weather.wind);
  usePrecipitationLayer(map, ready, weather.rain, now.getHours());

  /* 사건 범위에 맞춘다 — 지점·시설은 그 자리, 구역·회랑은 영향 폴리곤, 전역은 시 전체 (README §9) */
  const focusScope = useCallback(
    (duration: number) => {
      const instance = map.current;
      if (!instance || !scope) return;
      const padding = { top: 72, bottom: CCTV_DOCK + EDGE * 2, left: CENTER_LEFT, right: CENTER_RIGHT };
      const ring = scope.scope.affectedGeometryId ? GEOMETRIES[scope.scope.affectedGeometryId] : undefined;
      if (scope.scope.kind === "전역") {
        instance.easeTo({ center: CITY_CENTER, zoom: SCOPE_ZOOM.전역, padding, pitch: 0, bearing: 0, duration });
      } else if (ring) {
        const bounds = ring.reduce((acc, p) => acc.extend(p), new maplibregl.LngLatBounds(ring[0], ring[0]));
        instance.fitBounds(bounds, { padding, maxZoom: SCOPE_ZOOM[scope.scope.kind], pitch: 0, bearing: 0, duration });
      } else {
        instance.easeTo({ center: scope.scope.displayAnchor, zoom: SCOPE_ZOOM[scope.scope.kind], padding, pitch: 0, bearing: 0, duration });
      }
    },
    [map, scope],
  );
  useEffect(() => {
    setSelectedId(null);
    if (ready) focusScope(700);
  }, [ready, focusScope]);

  /* 사건 범위 외곽선 + (전망 모드) 선택 눈금의 침수 범위 */
  const forecastId = params.get("forecastId") ?? "";
  const validAt = params.get("validAt");
  const resolution = useMemo(() => (forecastId ? resolveForecast(forecastId, now) : null), [forecastId, now]);
  const twinForecast: Forecast | null = resolution?.kind === "ok" ? resolution.forecast : null;
  const selectedMark = twinForecast ? twinForecast.marks.find((m) => m.validAt === validAt) ?? twinForecast.marks.find((m) => new Date(m.validAt) >= now) ?? twinForecast.marks[0] : null;
  /* 장면 층 — 도로 상태 선 · 차단 지점 · 우회로 · 시설 상태. 디지털트윈과 같은 부품이다(03 §24).
     대안은 비교라 "통제됨"을 "통제 시"로 바꿔 올린다(lib/twin-preview) */
  const sceneLayers = useMemo(
    () => (mode === "twin" && twinForecast ? previewScene(mergeScene(twinForecast.scene, selectedMark?.scene)) : []),
    [mode, twinForecast, selectedMark],
  );
  /* 고해상 지형 — 침수면을 지형을 따라 채운다. 전망 탭에서, 고른 눈금의 침수면이 구운 것일 때만 읽는다(lib/flood-surfaces) */
  const surfaceGeometryId = mode === "twin" && selectedMark && extentOn ? selectedMark.extentGeometryId : null;
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
    const instance = map.current;
    if (!ready || !instance || !scope) return;
    const ring = scope.scope.affectedGeometryId ? GEOMETRIES[scope.scope.affectedGeometryId] : null;
    const extentRing = mode === "twin" && selectedMark && extentOn ? GEOMETRIES[selectedMark.extentGeometryId] : null;
    upsertPolygonLayer(instance, SCOPE_SOURCE, ring, scopePaint());
    /* 지형에서 구운 수위가 있으면 면 대신 지형을 채운 수면이 선다. 굽지 않은 지구는 폴리곤 그대로 */
    const paint = extentPaint(depthLevel(selectedMark?.maxDepthM));
    ensureFloodSurface(instance);
    if (surfaceEntry && finePatch) {
      setFloodSurface(instance, finePatch, surfaceEntry.spec, true);
      upsertPolygonLayer(instance, EXTENT_SOURCE, extentRing, { ...paint, opacity: 0 });
    } else {
      setFloodSurface(instance, null, null, false);
      upsertPolygonLayer(instance, EXTENT_SOURCE, extentRing, paint);
    }
    raiseSceneLayers(instance);
  }, [map, ready, scope, mode, selectedMark, extentOn, finePatch, surfaceEntry]);

  /* 패널에서 고른 주체 — 지도도 그 주체로 끌어온다 */
  const focusDevice = useCallback(
    (device: Device) => {
      setSelectedId(device.id);
      const instance = map.current;
      if (!instance || !ready) return;
      const el = instance.getContainer();
      const target = { x: (CENTER_LEFT + (el.clientWidth - CENTER_RIGHT)) / 2, y: el.clientHeight - (CCTV_DOCK + EDGE * 2) - 32 };
      const pt = instance.project(device.center);
      instance.panBy([pt.x - target.x, pt.y - target.y], { duration: 500 });
    },
    [map, ready],
  );
  const openChannel = (ch: CctvChannelView) => setSelectedId(ch.id);
  const cctvOfFacility = (facility: Facility) => {
    const ch = channels.find((c) => c.id === (facility.kind === "pump" ? SUBJECTS.cctvPump : SUBJECTS.cctvPole));
    return ch ? { name: ch.label, onOpen: () => openChannel(ch) } : undefined;
  };

  /* 근거 선택 — query 가 정본. 이벤트 줄을 누르면 그 주체를 지도에서 강조한다 */
  const selectedEventId = params.get("evidenceId");
  const selectEvidence = (e: EventEnvelope) => {
    const next = new URLSearchParams(params);
    next.set("evidenceId", e.eventId);
    setParams(next, { replace: true });
    const device = devices.find((d) => d.id === e.subjectId);
    if (device) focusDevice(device);
  };

  /* ── 모드 전환과 담당자 조작 — 전이는 엔진이 소유한다 ── */
  const setPanel = (next: URLSearchParams, value: Mode) => {
    if (value === "judge") next.delete("panel");
    else next.set("panel", value);
    return next;
  };
  const openTwin = (id: string) => {
    advanceTick("d4");
    const next = setPanel(new URLSearchParams(params), "twin");
    next.set("forecastId", id);
    setParams(next);
  };
  /* 대응을 바꾸면? — 디지털트윈이 답한다(03 §25 · 2026-09-16). 전망 탭은 기준만 보이고 대안 비교는 트윈으로 넘긴다.
     시연 시계는 "대안 비교" 칸으로 옮긴다. 이 사건의 대응 분석이 준비되지 않았으면 버튼을 닫는다(데이터가 답한다) */
  const compareInTwin = findWhatIfCase(incidentId)
    ? () => { advanceTick("d5"); navigate(`/scr-05?incident=${encodeURIComponent(incidentId)}`); }
    : null;
  const pickValidAt = (at: string) => {
    const next = new URLSearchParams(params);
    next.set("validAt", at);
    setParams(next, { replace: true });
  };
  const reviewResponse = () => {
    if (!twinForecast || !selectedMark) return;
    advanceTick("d6-review");
    const next = new URLSearchParams(params);
    next.set("forecastId", twinForecast.forecastId);
    next.set("validAt", selectedMark.validAt);
    next.set("alternativeId", twinForecast.alternativeId);
    setParams(next, { replace: true });
    setResponseOpen(true);
  };
  const toJudge = () => setParams(setPanel(new URLSearchParams(params), "judge"));
  const openResponse = () => setResponseOpen(true);
  /* 종료 검토 — D8 종료 tick 으로 시계를 옮기고 기록·검증으로 간다(02 D8 "종료 조건 확인 → 종료"). 종료된 사건은 읽기 전용이 되고
     이 지구 작업공간은 읽기 전용 기록으로 열린다 */
  /* 종료 → 이력. 그 사건의 기록 창이 예측 검증 탭으로 열린 채 도착한다 (IA §10.1 · §13.1 · 2026-09-16) */
  const closeReview = () => { setResponseOpen(false); advanceTick("d8-close"); navigate(`/scr-07?incident=${encodeURIComponent(incidentId)}&view=case`); };
  /* 탭 직접 클릭 — 마지막 맥락(forecastId · validAt · alternativeId)은 query 에 남아 있어 그대로 이어진다.
     전망 탭을 처음 열면 기준 전망을 고른다(다른 전망을 자동 선택하는 것이 아니라 아직 고른 것이 없을 때만) */
  const onTab = (value: string) => {
    if (value === "twin") {
      if (forecastId) setParams(setPanel(new URLSearchParams(params), "twin"));
      else if (baseline) openTwin(baseline.forecastId);
      return;
    }
    toJudge();
  };
  const twinAvailable = forecasts.length > 0;
  const responseAvailable = view?.workflowStatus === "대응중";

  /* 집중 확인 팝업 — 열림·종류만 화면이 든다 */
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const confirmAction = () => {
    if (!confirm) return;
    /* 발표자가 누르는 승인은 첫 승인 하나다. 추가 승인·대체조치는 시나리오가 기록해 세계 tick 에 실려 온다
       (2026-09-16 "승인하면 알아서 완료" · fixtures incident.ts). 그래서 fallback 확인은 옮길 tick 이 없다 */
    if (confirm.kind === "approve") advanceTick("d6-approve");
    if (confirm.kind === "control") advanceTick("d7-control");
    if (confirm.kind === "dismiss" && incident) { markFalsePositive(incident.incidentId); setResponseOpen(false); }
    setConfirm(null);
  };

  /* ── 예외 (IA §5.2) — 골격은 유지하고 좌측 열에 사실과 복귀 길을 세운다 ── */
  const exception = watch || district
    ? null
    : !view || !incident
    ? { title: "진행 중인 사건 없음", body: "이 지구에 확인할 사건 후보가 없습니다. 감시 우선대상과 알림은 종합상황에서 봅니다.", to: "/scr-01", label: "종합상황으로" }
    : view.workflowStatus === "병합됨" && view.mergedInto
      ? { title: "병합된 사건", body: `${all.find((v) => v.incident.incidentId === view.mergedInto)?.incident.title ?? view.mergedInto}에 병합됐습니다. 원 사건은 기록으로만 남습니다.`, to: `/scr-02/${all.find((v) => v.incident.incidentId === view.mergedInto)?.incident.legacyDistrictId ?? districtId}`, label: "대상 사건 열기" }
      : view.workflowStatus === "오탐" || view.workflowStatus === "종료"
        ? { title: `${view.workflowStatus === "오탐" ? "오탐" : "종료된"} 사건`, body: "읽기 전용 기록입니다. 현재 사건으로 되살리지 않습니다.", to: `/scr-07?incident=${encodeURIComponent(view.incident.incidentId)}`, label: "이력에서 보기" }
        : null;

  const tone = view ? statusTone(view.workflowStatus) : null;


  /* 검토 인수는 버튼이 아니라 여는 순간이다 (2026-09-14 사용자 지적 "검토 인수와 사건 확인이 같은 뎁스").
     후보를 연 담당자가 곧 인수자다 — 종합상황의 `확인 필요` 카드를 눌러 들어오면 확인중이 되고 이력에 인수가 남는다.
     화면 이동이 진행을 미는 것은 허용된 길이다(CLAUDE.md 데모 상태 엔진). 확인중의 버튼은 [오탐] [사건 대응] 둘이다 */
  useEffect(() => {
    if (view?.workflowStatus === "후보" && view.incident.incidentId === heroIncidentId) advanceTick("d2-review");
  }, [view, heroIncidentId, advanceTick]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden bg-surface" style={{ isolation: "isolate" }} aria-label={`${incident?.title ?? "사건"} 지도`}>
        <div ref={(el) => { mapContainer.current = el; }} className="h-full w-full" />
        {!exception && (
          <>
            <SceneLayers map={map} ready={ready} layers={sceneLayers} />
            <DeviceMarkers map={map} ready={ready} pins={pins} selectedId={selectedId} onSelect={(d) => setSelectedId(d.id)} />
            <FacilityMarkers map={map} ready={ready} facilities={facilities} cctvOf={cctvOfFacility} />
            {selectedChannel && (
              <CctvBigView
                channel={{ name: selectedChannel.label, address: "경남 창원시 마산합포구 신포동", scene: selectedChannel.scene, still: selectedChannel.still, analysis: selectedChannel.analysis ? `VLM ${Math.round(selectedChannel.analysis.confidence * 100)}% · ${selectedChannel.analysis.model} ${selectedChannel.analysis.version} · 분석 ${formatClock(selectedChannel.analysis.analyzedAt)} · ${selectedChannel.analysis.description}` : undefined, at: now }}
                onClose={() => setSelectedId(null)}
              />
            )}
            {selected && selected.kind !== "CV" && (
              <MapPopup map={map} lngLat={selected.center} onClose={() => setSelectedId(null)} offset={24}>
                <DevicePopup device={selected} onClose={() => setSelectedId(null)} onShowEvents={() => {
                  const row = rows.find((r) => r.event.subjectId === selected.id);
                  if (row) selectEvidence(row.event);
                  setSelectedId(null);
                }} onRespond={responseAvailable ? () => { setSelectedId(null); openResponse(); } : undefined} />
              </MapPopup>
            )}
          </>
        )}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-surface">
            <Icon icon="mdi:loading" className="size-5 animate-spin text-foreground-subtle" aria-hidden />
            <span className="text-body text-foreground-muted">지도를 불러오는 중</span>
          </div>
        )}
      </div>

      {/* 맵 조작 — 지도 화면 어디서든 같은 자리 같은 버튼 */}
      <div className={UTIL_STRIP} style={utilStripStyle(agentOpen)}>
        <MapUtilStrip
          map={map}
          disabled={!ready}
          onReset={() => focusScope(500)}
          layers={[
            {
              title: "영향 표현",
              items: [
                /* 전망 탭에서만 — 지금 지도가 그리는 그 면이 무엇인지 목록에 있어야 한다 */
                ...(mode === "twin" && twinForecast && selectedMark ? [{ id: "forecast-extent", label: `예측 침수 범위 · ${formatClock(selectedMark.validAt)} · ${ALTERNATIVE_LABEL[twinForecast.alternativeId]}`, color: cssColor("--color-primary-text", "#60a5fa"), icon: "mdi:waves", shape: "area" as const, visible: extentOn }] : []),
                ...SAFEMAP_LAYERS.map((spec) => ({ id: spec.id, label: spec.label, color: spec.color, icon: spec.icon, shape: "area" as const, visible: safemapOn[spec.id] ?? false })),
                ...weatherLayerItems(weather),
              ],
              onToggle: (id: string) => (id === "forecast-extent" ? setExtentOn((v) => !v) : isWeatherKey(id) ? setWeather((prev) => ({ ...prev, [id]: !prev[id] })) : setSafemapOn((prev) => ({ ...prev, [id]: !(prev[id] ?? false) }))),
              onSetAll: (visible: boolean) => {
                setExtentOn(visible);
                setSafemapOn(Object.fromEntries(SAFEMAP_LAYERS.map((s) => [s.id, visible])));
                setWeather({ rain: visible, temp: visible, wind: visible });
              },
            },
          ]}
        />
      </div>

      {/* 상단 좌측 · 어디를 보고 있는지. 종합상황으로 되돌아가는 길이기도 하다 (CSMS 사업장 집중관제 상단 좌측 캡슐 그대로,
          2026-09-14 사용자 지시). 좌측 열 바로 오른쪽에 붙인다 · 읽기 시작점이 왼쪽 열이라 그 열에 세운다.
          그 옆에 상태 캡슐 — 사건 `[등급] 제목 [처리상태] · 유형 · 생성 · 경과` / 알림 / 지구 현황. 브레드크럼은 길, 캡슐은 상태 */}
      <div className="pointer-events-none absolute top-3 z-30 flex items-start justify-between gap-2" style={{ left: CENTER_LEFT, right: CENTER_RIGHT }}>
        <GlassPanel borderStyle="none" className="pointer-events-auto flex h-10 shrink-0 items-center gap-2 rounded-full px-4">
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-foreground-muted" onClick={() => navigate("/scr-01")}>
            <Icon icon="mdi:chevron-left" width={16} height={16} aria-hidden />
            종합상황
          </Button>
          <span className="h-4 w-px bg-border" aria-hidden />
          <DistrictPickerChip districtId={districtId} label={scope?.scope.label ?? districtName} onSelect={(id) => navigate(`/scr-02/${id}`)} />
        </GlassPanel>
      {watch && (
          <GlassPanel borderStyle="none" className="pointer-events-auto flex min-w-0 h-10 items-center gap-3 whitespace-nowrap rounded-full px-4" aria-label="알림 헤더">
            <Badge variant={ALERT_GRADE_TONE[watch.alert.grade].badge} className="shrink-0">{watch.alert.grade}</Badge>
            <span className="min-w-0 truncate text-body font-bold tracking-tight text-foreground">{alertRoleLabel(watch.alert.demoRole)} · {watch.alert.target.label}</span>
            <Badge variant="gray" className="shrink-0">감지</Badge>
            <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
            <span className="flex shrink-0 items-center gap-1 font-mono text-caption text-foreground-muted">
              <span>{formatClock(watch.alert.createdAt)} 생성</span>
              <span>· 경과 {formatElapsed(watch.alert.createdAt, now)}</span>
            </span>
          </GlassPanel>
      )}
      {district && (
          <GlassPanel borderStyle="none" className="pointer-events-auto flex min-w-0 h-10 items-center gap-3 whitespace-nowrap rounded-full px-4" aria-label="지구 헤더">
            <Tag className="shrink-0">지구 현황</Tag>
            <Tag className="shrink-0">{district.incident.hazardKind}</Tag>
            <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
            <span className="shrink-0 font-mono text-caption text-foreground-muted">{district.lastReceivedAt ? `최근 수신 ${formatClock(district.lastReceivedAt)}` : "수신 없음"}</span>
          </GlassPanel>
      )}
      {view && tone && incident && (
          <GlassPanel borderStyle="none" className="pointer-events-auto flex min-w-0 h-10 items-center gap-3 whitespace-nowrap rounded-full px-4" aria-label="사건 헤더">
            {/* 제목은 크럼(범위 이름)과 팝업 헤더가, 등급은 우측 위험도 카드가 든다 — 캡슐은 처리상태 · 유형 · 시간만 (2026-09-14 사용자 지시) */}
            <StatusBadge status={tone.badge} label={view.workflowStatus} className="shrink-0" />
            {view.phase && <Tag className="shrink-0">{view.phase}</Tag>}
            <Tag className="shrink-0">{incident.hazardKind}</Tag>
            <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
            <span className="flex shrink-0 items-center gap-1 font-mono text-caption text-foreground-muted">
              {view.createdAt && <span>{formatClock(view.createdAt)} 생성</span>}
              {view.createdAt && <span>· 경과 {formatElapsed(view.createdAt, now)}</span>}
            </span>
          </GlassPanel>
      )}

      </div>

      {/* 좌측 열 — 관측 · 근거 (근거는 왼쪽). 머리말은 상단 좌측 캡슐로 옮겼다 */}
      <div className={`${RAIL_BASE} left-3`} style={{ width: LEFT_RAIL }}>

        {exception ? (
          <GlassPanel className="pointer-events-auto shrink-0 p-3">
            <Notice variant={exception.title.includes("찾을 수") ? "danger" : "warning"} title={exception.title} description={exception.body} action={<Button size="sm" onClick={() => navigate(exception.to)}>{exception.label}</Button>} />
          </GlassPanel>
        ) : (
          <>
            <GlassPanel className="pointer-events-auto shrink-0">
              <TrendPanel sensors={sensors} selected={selected} onSelect={focusDevice} />
            </GlassPanel>
            <GlassPanel className="pointer-events-auto flex min-h-0 flex-1 flex-col">
              <CrossCheckPanel rows={rows} selectedEventId={selectedEventId} riskEventIds={riskEvidenceIds} onSelect={selectEvidence} onOpenForecast={openTwin} />
            </GlassPanel>
          </>
        )}
      </div>

      {/* 하단 중앙 — 현장영상 */}
      {!exception && (
        <div className="absolute bottom-3 z-20" style={{ left: CENTER_LEFT, right: CENTER_RIGHT, height: CCTV_DOCK }}>
          <GlassPanel className="h-full">
            <CctvDock channels={channels} onSelect={openChannel} />
          </GlassPanel>
        </div>
      )}

      {/* 우측 레일 · 지구 현황 — 사건·알림 없음. 판단 탭 자리에 지구 현황 카드만 */}
      {district && (
        <div className={`${RAIL_BASE} right-3`} style={{ width: RIGHT_RAIL }}>
          <div className="pointer-events-auto shrink-0">
            <Tabs value="judge">
              <TabsList variant="panel" className="w-full" aria-label="우측 레일 탭">
                <TabsTrigger variant="panel" value="judge"><span className="size-1.5 rounded-full bg-success" aria-hidden />판단</TabsTrigger>
                <TabsTrigger variant="panel" value="twin" disabled title="사건 후보가 생기면 열립니다">전망</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <GlassPanel className="pointer-events-auto shrink-0">
            <DistrictStatusCard incident={district.incident} subjectCount={devices.length + facilities.length} eventCount={district.rows.length} lastReceivedAt={district.lastReceivedAt} faults={faults} />
          </GlassPanel>
          <GlassPanel className="pointer-events-auto flex shrink-0 items-center gap-2 p-2">
            <span className="min-w-0 flex-1 truncate text-caption text-foreground-subtle">상시 관측 · 알림·사건 없음</span>
            <Button size="sm" variant="secondary" onClick={() => navigate("/scr-01")}>종합상황으로</Button>
          </GlassPanel>
        </div>
      )}

      {/* 우측 레일 · 사건 전 알림 — 탭은 같은 자리에 두되 판단만 열린다. 전망·대응은 사건이 있어야 한다 */}
      {watch && !view && (
        <div className={`${RAIL_BASE} right-3`} style={{ width: RIGHT_RAIL }}>
          <div className="pointer-events-auto shrink-0">
            <Tabs value="judge">
              <TabsList variant="panel" className="w-full" aria-label="우측 레일 탭">
                <TabsTrigger variant="panel" value="judge"><span className="size-1.5 rounded-full bg-risk-lv3" aria-hidden />판단</TabsTrigger>
                <TabsTrigger variant="panel" value="twin" disabled title="사건 후보가 생기면 열립니다">전망</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <GlassPanel className="pointer-events-auto shrink-0">
            <WatchAlertCard alert={watch.alert} />
          </GlassPanel>
          <GlassPanel className="pointer-events-auto flex shrink-0 items-center gap-2 p-2">
            <span className="min-w-0 flex-1 truncate text-caption text-foreground-subtle">감시 중 · 아직 사건 아님</span>
            <Button size="sm" variant="secondary" onClick={() => navigate("/scr-01")}>종합상황으로</Button>
          </GlassPanel>
        </div>
      )}

      {/* 우측 레일 — 판단 · 전망 · 대응 탭 (결정은 오른쪽). 탭은 KISA 관제 우측 레일의 패널 탭 문법 */}
      {view && !exception && (
        <div className={`${RAIL_BASE} right-3`} style={{ width: RIGHT_RAIL }}>
          <div className="pointer-events-auto shrink-0">
            <Tabs value={mode} onValueChange={onTab}>
              <TabsList variant="panel" className="w-full" aria-label="우측 레일 탭">
                <TabsTrigger variant="panel" value="judge">
                  <span className={cn("size-1.5 rounded-full", tone?.dot)} aria-hidden />
                  판단
                </TabsTrigger>
                <TabsTrigger variant="panel" value="twin" disabled={!twinAvailable} title={twinAvailable ? undefined : "유효한 전망 없음"}>
                  전망
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {mode === "judge" && (
            <>
              {/* 브라우저 높이에 맞춘다 (2026-09-15) — 카드 묶음이 남는 높이를 나눠 갖고, 모자라면 이 묶음이 스크롤한다. 액션 바는 바닥 고정 */}
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              <GlassPanel className="pointer-events-auto shrink-0">
                <RiskCard assessment={view.assessment} previous={view.previousAssessment} />
              </GlassPanel>
              <GlassPanel className="pointer-events-auto shrink-0">
                <ImpactPanel forecast={baseline} onOpenTwin={openTwin} />
              </GlassPanel>
              {sopItems.length > 0 && (
                <GlassPanel className="pointer-events-auto shrink-0">
                  <ResponseSummaryCard items={sopItems} chain={chain} approval={approval} />
                </GlassPanel>
              )}
              <GlassPanel className="pointer-events-auto flex min-h-[168px] flex-1 flex-col">
                <EventTimeline events={view.events} />
              </GlassPanel>
              </div>
              <GlassPanel className="pointer-events-auto shrink-0">
                <JudgeActionBar
                  status={view.workflowStatus}
                  phase={view.phase}
                  assessed={view.assessment !== null}
                  approved={approval !== null}
                  failure={sopItems.find((i) => i.status === "실패" && i.fallbackAvailable)?.label ?? null}
                  pendingApproval={approval ? sopItems.filter((i) => i.execMode === "수동" && i.status === "대기").length : 0}
                  resultsArrived={resultsArrived}
                  onTakeReview={() => advanceTick("d2-review")}
                  onDismiss={() => setConfirm({ kind: "dismiss" })}
                  /* 사건 대응 = 확인 + 대응 팝업. 확인을 따로 누르는 뎁스를 없앤다 (2026-09-14 사용자 지시) */
                  onRespond={() => { advanceTick("d2-confirm"); setResponseOpen(true); }}
                  onOpenResponse={openResponse}
                  onCloseReview={closeReview}
                />
              </GlassPanel>
            </>
          )}

          {mode === "twin" && (
            <ForecastRail
              now={now}
              resolution={resolution}
              forecast={twinForecast}
              mark={selectedMark}
              repick={forecasts.filter((f) => f.alternativeId === "baseline")}
              onPickValidAt={pickValidAt}
              onBack={toJudge}
              onReview={reviewResponse}
              onRepick={(id) => setParams({ panel: "twin", forecastId: id })}
              onCompare={compareInTwin}
            />
          )}

        </div>
      )}

      {/* 대응 실행 집중 팝업 (IA §9 · 04 §4) — 판단·전망 위에 뜬다. 지도·레일은 뒤에 흐리게 남는다 */}
      {view && incident && responseAvailable && (
        <ResponsePopup
          open={responseOpen}
          /* 닫으면 판단 탭으로 — 결과는 대응 요약과 이력에 이어져 있다(04 §4) */
          onClose={() => { setResponseOpen(false); toJudge(); }}
          view={view}
          incident={incident}
          now={now}
          channels={channels}
          recommendation={recommendation}
          approval={approval}
          items={sopItems}
          chain={chain}
          baseline={baseline}
          selectedBasis={twinForecast && selectedMark ? { validAt: selectedMark.validAt, alternativeId: twinForecast.alternativeId } : null}
          emergency={view.assessment === null || !baseline}
          resultsArrived={resultsArrived}
          onRequestConfirm={setConfirm}
          onCloseReview={closeReview}
        />
      )}

      {/* 집중 확인 팝업 (IA §9) */}
      {view && incident && confirm && (
        <ExecutionPopup
          open
          request={confirm}
          onClose={() => setConfirm(null)}
          onConfirm={confirmAction}
          incidentTitle={incident.title}
          now={now}
          /* 오탐은 담당자의 결정이고 승인·전파·통제는 승인권자의 결정이다 */
          approver={confirm.kind === "dismiss" ? incident.ownership.officer : (incident.ownership.approver ?? incident.ownership.officer)}
          message={confirm.kind === "approve" && !confirm.itemLabels.some((l) => l.includes("전파")) ? null : (disseminations[0]?.message ?? null)}
          channels={disseminations[0]?.channels ?? ["알림톡", "마을방송", "전광판", "기관 통보"]}
          recipients={disseminations[0]?.recipients ?? "신포동 주민 알림톡 등록자 · 해안도로 전광판 2기 · 마산합포구청 · 경찰서 교통과"}
        />
      )}
    </div>
  );
}
