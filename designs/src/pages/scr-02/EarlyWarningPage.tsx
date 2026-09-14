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
 * 연다. 열림은 UI 상태라 URL 에 넣지 않는다(IA §5.2). 승인·대체조치·통제 전환은 그 위의 중첩 확인창이 tick 을 옮긴다.
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
import { CCTV_DOCK, CENTER_RIGHT, EDGE, RAIL_BASE, RIGHT_RAIL, UTIL_STRIP, utilStripStyle } from "../../lib/layout";
import { useScenario } from "../../state/ScenarioProvider";
import { formatClock, formatElapsed } from "../../lib/datetime";
import { ALERT_GRADE_TONE, RISK_GRADE_TONE, statusTone } from "../../lib/status-tone";
import type { Device } from "../../demo/devices";
import type { Facility } from "../../demo/facilities";
import type { EventEnvelope } from "../../model/event";
import type { Forecast, AlternativeId } from "../../model/forecast";
import { ALTERNATIVE_LABEL } from "../../model/forecast";
import {
  alternativesOf, cctvChannelsAt, chainStagesAt, currentForecastsOf, decisionsAt, derivedFlagOf, disseminationsAt,
  incidentViewAt, incidentsAt, isActiveStatus, recommendationsAt, relatedEventsAt, resolveForecast, sopItemsAt, watchViewAt, type CctvChannelView,
} from "../../model/selectors";
import { GEOMETRIES, SCOPE_ZOOM, SUBJECTS, deviceOfSubject, facilityOfSubject, isFacilitySubject, isSensorSubject } from "../../fixtures";
import { DISTRICTS } from "../../demo/districts";
import { TimelinePanel } from "../scr-05/widgets/TimelinePanel";
import { AnalysisBasisCard } from "../scr-05/widgets/AnalysisBasisCard";
import type { TimeMark, Timeline } from "../../demo/scenario-timeline";
import type { AnalysisBasis } from "../../demo/analysis";
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
import { EventTimeline } from "./widgets/EventTimeline";
import { type ConfirmRequest } from "./widgets/SopPanel";
import { ResponsePopup } from "./widgets/ResponsePopup";
import { ResponseSummaryCard } from "./widgets/ResponseSummaryCard";
import { ExecutionPopup } from "./widgets/ExecutionPopup";

/** 좌측 열 폭 — 우선 420 (결정 2026-09-14 · 구현 후 재검토). 제품 300 과 다르지만 좌측 열이 서는 화면은 이 화면뿐이다 */
const LEFT_COL = 420;

type Mode = "judge" | "twin";

/** 토큰 → 실제 색. MapLibre paint 는 var() 를 못 읽는다. 리터럴을 박지 않고 토큰을 풀어 쓴다 */
function cssColor(token: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback;
}

const EXTENT_SOURCE = "incident-extent";
const SCOPE_SOURCE = "incident-scope";

export function EarlyWarningPage() {
  const { districtId = "" } = useParams();
  const districtName = DISTRICTS.find((d) => d.id === districtId)?.name ?? districtId;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { demoNow: now, ticks, tickIndex, advanceTick, agentOpen } = useScenario();
  /* 실행 결과가 도착한 뒤에만 통제 전환 — 결과 tick 이전의 담당자 조작으로 시계가 결과를 건너뛰지 않게 */
  const resultsArrived = tickIndex >= ticks.findIndex((t) => t.id === "d7-results");
  const panel = params.get("panel");
  const mode: Mode = panel === "twin" ? "twin" : "judge";
  /* 대응 실행 팝업 — 열림은 UI 상태. 긴급 경로(판단·전망 전) 여부는 여는 순간의 상태로 정한다 */
  const [responseOpen, setResponseOpen] = useState(false);

  /* ── 이 지구의 사건 — 진행 중인 것이 우선, 없으면 기록(오탐·종료)이라도 찾아 예외를 안내한다 ── */
  const all = useMemo(() => incidentsAt(now), [now]);
  const found = all.find((v) => v.incident.legacyDistrictId === districtId && isActiveStatus(v.workflowStatus)) ?? all.find((v) => v.incident.legacyDistrictId === districtId) ?? null;
  const incidentId = found?.incident.incidentId ?? "";
  const view = useMemo(() => (incidentId ? incidentViewAt(incidentId, now) : null), [incidentId, now]);
  const incident = view?.incident ?? null;
  /* 사건 전 알림 — 종합상황 감지 카드가 query `alertId` 로 보낸다. 사건이 없을 때만 그 알림의 근거를 세운다(IA §7).
     알림이 사건을 만든 뒤에는 사건이 우선이고 알림은 그 사건의 sourceAlerts 로 남는다 */
  const alertId = params.get("alertId");
  const watch = useMemo(() => (!found && alertId ? watchViewAt(alertId, now) : null), [found, alertId, now]);
  /* 지도 범위·주체·카메라의 기준 — 사건이 있으면 사건, 없으면 알림이 가리키는 구역의 정의 */
  const scope = incident ?? watch?.incident ?? null;
  const rows = useMemo(() => (view ? relatedEventsAt(incidentId, now) : watch?.rows ?? []), [view, incidentId, now, watch]);
  const forecasts = useMemo(() => currentForecastsOf(incidentId, now), [incidentId, now]);
  const baseline = forecasts.find((f) => f.alternativeId === "baseline") ?? forecasts[0] ?? null;
  const recommendation = useMemo(() => recommendationsAt(incidentId, now).at(-1) ?? null, [incidentId, now]);
  const approval = useMemo(() => decisionsAt(incidentId, now).find((d) => d.kind === "대응 승인" && d.status === "승인") ?? null, [incidentId, now]);
  const disseminations = useMemo(() => disseminationsAt(incidentId, now), [incidentId, now]);
  const sopItems = useMemo(() => sopItemsAt(incidentId, now), [incidentId, now]);
  const chain = useMemo(() => chainStagesAt(incidentId, now), [incidentId, now]);
  const channels = useMemo(() => cctvChannelsAt(now).filter((c) => scope?.correlationKeys.includes(c.id)), [now, scope]);

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

  const [safemapOn, setSafemapOn] = useState<Record<string, boolean>>(Object.fromEntries(SAFEMAP_LAYERS.map((spec) => [spec.id, true])));
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    ensureSafemapLayers(instance);
    for (const spec of SAFEMAP_LAYERS) setSafemapVisible(instance, spec.id, safemapOn[spec.id] ?? true);
  }, [map, ready, safemapOn]);
  const [weather, setWeather] = useState<WeatherState>(WEATHER_OFF);
  useWindLayer(map, ready, weather.wind);
  usePrecipitationLayer(map, ready, weather.rain, now.getHours());

  /* 사건 범위에 맞춘다 — 지점·시설은 그 자리, 구역·회랑은 영향 폴리곤, 전역은 시 전체 (README §9) */
  const focusScope = useCallback(
    (duration: number) => {
      const instance = map.current;
      if (!instance || !scope) return;
      const padding = { top: 72, bottom: CCTV_DOCK + EDGE * 2, left: LEFT_COL + EDGE * 2, right: CENTER_RIGHT };
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
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || !scope) return;
    const ring = scope.scope.affectedGeometryId ? GEOMETRIES[scope.scope.affectedGeometryId] : null;
    const scopeData = ring ? { type: "Feature" as const, geometry: { type: "Polygon" as const, coordinates: [[...ring, ring[0]]] }, properties: {} } : null;
    const extentRing = mode === "twin" && selectedMark ? GEOMETRIES[selectedMark.extentGeometryId] : null;
    const extentData = extentRing ? { type: "Feature" as const, geometry: { type: "Polygon" as const, coordinates: [[...extentRing, extentRing[0]]] }, properties: {} } : null;
    const empty = { type: "FeatureCollection" as const, features: [] };
    const upsert = (id: string, data: GeoJSON.Feature | null, paint: { fill: string; line: string; opacity: number }) => {
      const src = instance.getSource(id) as maplibregl.GeoJSONSource | undefined;
      if (!src) {
        instance.addSource(id, { type: "geojson", data: data ?? empty });
        instance.addLayer({ id: `${id}-fill`, type: "fill", source: id, paint: { "fill-color": paint.fill, "fill-opacity": paint.opacity } });
        instance.addLayer({ id: `${id}-line`, type: "line", source: id, paint: { "line-color": paint.line, "line-width": 1.5, "line-dasharray": [2, 2] } });
      } else {
        src.setData(data ?? empty);
      }
    };
    upsert(SCOPE_SOURCE, scopeData, { fill: cssColor("--color-primary", "#3b82f6"), line: cssColor("--color-primary", "#3b82f6"), opacity: 0.06 });
    upsert(EXTENT_SOURCE, extentData, { fill: cssColor("--color-risk-lv4", "#f97316"), line: cssColor("--color-risk-lv4", "#f97316"), opacity: 0.28 });
  }, [map, ready, scope, mode, selectedMark]);

  /* 패널에서 고른 주체 — 지도도 그 주체로 끌어온다 */
  const focusDevice = useCallback(
    (device: Device) => {
      setSelectedId(device.id);
      const instance = map.current;
      if (!instance || !ready) return;
      const el = instance.getContainer();
      const target = { x: (LEFT_COL + EDGE * 2 + (el.clientWidth - CENTER_RIGHT)) / 2, y: el.clientHeight - (CCTV_DOCK + EDGE * 2) - 32 };
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
  const pickAlternative = (id: AlternativeId) => {
    const target = alternativesOf(incidentId, now).find((a) => a.id === id);
    if (!target) return;
    advanceTick("d5");
    const next = new URLSearchParams(params);
    next.set("forecastId", target.forecast.forecastId);
    next.set("alternativeId", id);
    setParams(next);
  };
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
  const closeReview = () => { setResponseOpen(false); navigate("/scr-04"); };
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
  const responseAvailable = view ? ["확인됨", "대응중", "통제"].includes(view.workflowStatus) : false;

  /* 집중 확인 팝업 — 열림·종류만 화면이 든다 */
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const confirmAction = () => {
    if (!confirm) return;
    if (confirm.kind === "approve") advanceTick("d6-approve");
    if (confirm.kind === "fallback") advanceTick("d7-fallback");
    if (confirm.kind === "control") advanceTick("d7-control");
    setConfirm(null);
  };

  /* ── 예외 (IA §5.2) — 골격은 유지하고 좌측 열에 사실과 복귀 길을 세운다 ── */
  const exception = watch
    ? null
    : !view || !incident
    ? { title: "진행 중인 사건 없음", body: "이 지구에 확인할 사건 후보가 없습니다. 감시 우선대상과 알림은 종합상황에서 봅니다.", to: "/scr-01", label: "종합상황으로" }
    : view.workflowStatus === "병합됨" && view.mergedInto
      ? { title: "병합된 사건", body: `${all.find((v) => v.incident.incidentId === view.mergedInto)?.incident.title ?? view.mergedInto}에 병합됐습니다. 원 사건은 기록으로만 남습니다.`, to: `/scr-02/${all.find((v) => v.incident.incidentId === view.mergedInto)?.incident.legacyDistrictId ?? districtId}`, label: "대상 사건 열기" }
      : view.workflowStatus === "오탐" || view.workflowStatus === "종료"
        ? { title: `${view.workflowStatus === "오탐" ? "오탐" : "종료된"} 사건`, body: "읽기 전용 기록입니다. 현재 사건으로 되살리지 않습니다.", to: "/scr-04", label: "기록·검증에서 보기" }
        : null;

  const tone = view ? statusTone(view.workflowStatus) : null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden bg-surface" style={{ isolation: "isolate" }} aria-label={`${incident?.title ?? "사건"} 지도`}>
        <div ref={(el) => { mapContainer.current = el; }} className="h-full w-full" />
        {!exception && (
          <>
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
                ...SAFEMAP_LAYERS.map((spec) => ({ id: spec.id, label: spec.label, color: spec.color, icon: spec.icon, shape: "area" as const, visible: safemapOn[spec.id] ?? true })),
                ...weatherLayerItems(weather),
              ],
              onToggle: (id: string) => (isWeatherKey(id) ? setWeather((prev) => ({ ...prev, [id]: !prev[id] })) : setSafemapOn((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }))),
              onSetAll: (visible: boolean) => {
                setSafemapOn(Object.fromEntries(SAFEMAP_LAYERS.map((s) => [s.id, visible])));
                setWeather({ rain: visible, temp: visible, wind: visible });
              },
            },
          ]}
        />
      </div>

      {/* 상단 중앙 — 사건 캡슐 (IA §7 공통 헤더 · 초안 §3). 종합상황 상태 스트립과 같은 자리 문법.
          `[등급 배지] 제목 [처리상태] · 재난유형 · 생성 · 경과`. 등급 배지는 판단 갱신 전에는 그리지 않고 점수는 위험도
          카드가 든다. 범위·담당은 좌측 머리말이 들고 탭 전환은 우측 레일이 든다 */}
      {watch && (
        <div className="pointer-events-none absolute top-3 z-30 flex justify-center" style={{ left: LEFT_COL + EDGE * 2, right: CENTER_RIGHT }}>
          <GlassPanel borderStyle="none" className="pointer-events-auto flex max-w-full items-center gap-3 whitespace-nowrap rounded-full px-5 py-2" aria-label="알림 헤더">
            <Badge variant={ALERT_GRADE_TONE[watch.alert.grade].badge} className="shrink-0">{watch.alert.grade}</Badge>
            <span className="min-w-0 truncate text-body font-bold tracking-tight text-foreground">{watch.alert.demoRole} · {watch.alert.target.label}</span>
            <Badge variant="gray" className="shrink-0">감지</Badge>
            <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
            <span className="flex shrink-0 items-center gap-1 font-mono text-caption text-foreground-muted">
              <span>{formatClock(watch.alert.createdAt)} 생성</span>
              <span>· 경과 {formatElapsed(watch.alert.createdAt, now)}</span>
            </span>
          </GlassPanel>
        </div>
      )}
      {view && tone && incident && (
        <div className="pointer-events-none absolute top-3 z-30 flex justify-center" style={{ left: LEFT_COL + EDGE * 2, right: CENTER_RIGHT }}>
          <GlassPanel borderStyle="none" className="pointer-events-auto flex max-w-full items-center gap-3 whitespace-nowrap rounded-full px-5 py-2" aria-label="사건 헤더">
            {view.assessment && <Badge variant={RISK_GRADE_TONE[view.assessment.matrix.grade].badge} className="shrink-0">{view.assessment.matrix.grade}</Badge>}
            <span className="min-w-0 truncate text-body font-bold tracking-tight text-foreground">{incident.title}</span>
            <StatusBadge status={tone.badge} label={view.workflowStatus} className="shrink-0" />
            <Tag className="shrink-0">{incident.hazardKind}</Tag>
            <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
            <span className="flex shrink-0 items-center gap-1 font-mono text-caption text-foreground-muted">
              {view.createdAt && <span>{formatClock(view.createdAt)} 생성</span>}
              {view.createdAt && <span>· 경과 {formatElapsed(view.createdAt, now)}</span>}
            </span>
          </GlassPanel>
        </div>
      )}

      {/* 좌측 열 — 머리말 · 관측 추이 · 관련 이벤트 현황 (근거는 왼쪽) */}
      <div className={`${RAIL_BASE} left-3`} style={{ width: LEFT_COL }}>
        <GlassPanel className="pointer-events-auto shrink-0">
          <div className="flex items-center gap-2 px-3 py-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/scr-01")} aria-label="종합상황으로" className="size-7 shrink-0 text-foreground-subtle hover:text-foreground">
              <Icon icon="mdi:arrow-left" className="size-4" aria-hidden />
            </Button>
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-h6 font-semibold text-foreground">{scope?.scope.label ?? districtName}</h1>
                {scope && <Tag className="shrink-0">{scope.scope.kind}</Tag>}
              </div>
              <span className="truncate text-caption text-foreground-muted">
                {incident ? `${incident.ownership.organization} · ${incident.ownership.officer} · 주체 ${devices.length + facilities.length}` : watch ? `감시 우선구역 · 주체 ${devices.length + facilities.length}` : `지구 · 진행 사건 없음`}
              </span>
            </div>
          </div>
        </GlassPanel>

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
              <CrossCheckPanel rows={rows} selectedEventId={selectedEventId} onSelect={selectEvidence} onOpenForecast={openTwin} />
            </GlassPanel>
          </>
        )}
      </div>

      {/* 하단 중앙 — 현장영상 */}
      {!exception && (
        <div className="absolute bottom-3 z-20" style={{ left: LEFT_COL + EDGE * 2, right: CENTER_RIGHT, height: CCTV_DOCK }}>
          <GlassPanel className="h-full">
            <CctvDock channels={channels} onSelect={openChannel} />
          </GlassPanel>
        </div>
      )}

      {/* 우측 레일 · 사건 전 알림 — 탭은 같은 자리에 두되 판단만 열린다. 전망·대응은 사건이 있어야 한다 */}
      {watch && !view && (
        <div className={`${RAIL_BASE} right-3`} style={{ width: RIGHT_RAIL }}>
          <GlassPanel className="pointer-events-auto shrink-0 p-1.5">
            <Tabs value="judge">
              <TabsList variant="panel" className="w-full" aria-label="우측 레일 탭">
                <TabsTrigger variant="panel" value="judge"><span className="size-1.5 rounded-full bg-risk-lv3" aria-hidden />판단</TabsTrigger>
                <TabsTrigger variant="panel" value="twin" disabled title="사건 후보가 생기면 열립니다">전망</TabsTrigger>
              </TabsList>
            </Tabs>
          </GlassPanel>
          <GlassPanel className="pointer-events-auto shrink-0">
            <WatchAlertCard alert={watch.alert} />
          </GlassPanel>
          <GlassPanel className="pointer-events-auto flex shrink-0 items-center gap-2 p-2">
            <span className="min-w-0 flex-1 truncate text-caption text-foreground-subtle">감시 중 · 사건 후보는 규칙이 만든다</span>
            <Button size="sm" variant="secondary" onClick={() => navigate("/scr-01")}>종합상황으로</Button>
          </GlassPanel>
        </div>
      )}

      {/* 우측 레일 — 판단 · 전망 · 대응 탭 (결정은 오른쪽). 탭은 KISA 관제 우측 레일의 패널 탭 문법 */}
      {view && !exception && (
        <div className={`${RAIL_BASE} right-3`} style={{ width: RIGHT_RAIL }}>
          <GlassPanel className="pointer-events-auto shrink-0 p-1.5">
            <Tabs value={mode} onValueChange={onTab}>
              <TabsList variant="panel" className="w-full" aria-label="우측 레일 탭">
                <TabsTrigger variant="panel" value="judge">
                  <span className={cn("size-1.5 rounded-full", tone?.dot)} aria-hidden />
                  판단
                </TabsTrigger>
                <TabsTrigger variant="panel" value="twin" disabled={!twinAvailable} title={twinAvailable ? undefined : "유효한 전망 없음"}>
                  전망{twinAvailable && <span className="font-mono text-caption text-foreground-subtle">{forecasts.length}</span>}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </GlassPanel>

          {mode === "judge" && (
            <>
              <GlassPanel className="pointer-events-auto shrink-0">
                <RiskCard assessment={view.assessment} />
              </GlassPanel>
              <GlassPanel className="pointer-events-auto shrink-0">
                <ImpactPanel forecast={baseline} onOpenTwin={openTwin} />
              </GlassPanel>
              {sopItems.length > 0 && (
                <GlassPanel className="pointer-events-auto shrink-0">
                  <ResponseSummaryCard items={sopItems} chain={chain} approval={approval} onOpen={openResponse} />
                </GlassPanel>
              )}
              <GlassPanel className="pointer-events-auto flex min-h-0 flex-1 flex-col">
                <EventTimeline events={view.events} />
              </GlassPanel>
              <GlassPanel className="pointer-events-auto shrink-0">
                <JudgeActionBar
                  status={view.workflowStatus}
                  assessed={view.assessment !== null}
                  onTakeReview={() => advanceTick("d2-review")}
                  onConfirm={() => advanceTick("d2-confirm")}
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
              alternatives={alternativesOf(incidentId, now)}
              onPickAlternative={pickAlternative}
              onPickValidAt={pickValidAt}
              onBack={toJudge}
              onReview={reviewResponse}
              onRepick={(id) => setParams({ panel: "twin", forecastId: id })}
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
          basisHint={twinForecast && selectedMark ? `${formatClock(selectedMark.validAt)} 전망 · ${ALTERNATIVE_LABEL[twinForecast.alternativeId]} 기준으로 검토 중` : null}
          selectedBasis={twinForecast && selectedMark ? { validAt: selectedMark.validAt, alternativeId: twinForecast.alternativeId } : null}
          emergency={view.assessment === null || !recommendation?.basis && !twinForecast}
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
          approver={incident.ownership.approver ?? incident.ownership.officer}
          message={disseminations[0]?.message ?? null}
          channels={disseminations[0]?.channels ?? ["알림톡", "마을방송", "전광판", "기관 통보"]}
          recipients={disseminations[0]?.recipients ?? "신포동 주민 알림톡 등록자 · 해안도로 전광판 2기 · 마산합포구청 · 경찰서 교통과"}
        />
      )}
    </div>
  );
}

/* ── 전망 모드 우측 레일 (IA-03) — scr-05 의 시간축·근거 카드를 그대로 쓴다 ── */

function ForecastRail({ now, resolution, forecast, mark, alternatives, onPickAlternative, onPickValidAt, onBack, onReview, onRepick }: {
  now: Date;
  resolution: ReturnType<typeof resolveForecast> | null;
  forecast: Forecast | null;
  mark: Forecast["marks"][number] | null;
  alternatives: { id: AlternativeId; forecast: Forecast }[];
  onPickAlternative: (id: AlternativeId) => void;
  onPickValidAt: (at: string) => void;
  onBack: () => void;
  onReview: () => void;
  onRepick: (forecastId: string) => void;
}) {
  if (!forecast || !mark) {
    const reason = !resolution ? "예측판을 고르지 않았다." : resolution.kind === "not-found" ? "존재하지 않는 예측판이다." : resolution.kind === "expired" ? `유효 종료 ${formatClock(resolution.forecast.validUntil)} 가 지난 예측판이다.` : "이 시각에는 아직 생성되지 않은 예측판이다.";
    return (
      <GlassPanel className="pointer-events-auto flex flex-col gap-3 p-3">
        <Notice variant="warning" title="선택한 예측판이 유효하지 않음" description={`${reason} 다른 예측판으로 바꾸지 않는다 — 목록에서 다시 고른다.`} />
        <ul className="flex flex-col gap-1.5">
          {alternatives.map((a) => (
            <li key={a.forecast.forecastId}>
              <Button size="sm" variant="secondary" className="w-full justify-start" onClick={() => onRepick(a.forecast.forecastId)}>
                {ALTERNATIVE_LABEL[a.id]} · 기준 {formatClock(a.forecast.basis.baseTime)} · ~{formatClock(a.forecast.validUntil)}
              </Button>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="ghost" onClick={onBack}>현재 상태로</Button>
      </GlassPanel>
    );
  }

  /* 시간축 — 눈금은 예측판 유효시각. 눈금 사이 값은 판단에 쓰지 않는다(IA §8) */
  const timeline: Timeline = {
    marks: [
      { id: "now", at: now, label: "현재", kind: "now", value: 0, level: null },
      ...forecast.marks.map<TimeMark>((m) => ({
        id: m.validAt,
        at: new Date(m.validAt),
        label: `+${Math.round((new Date(m.validAt).getTime() - new Date(forecast.basis.baseTime).getTime()) / 60_000)}분`,
        kind: "projection",
        value: m.maxDepthM,
        level: null,
      })),
    ],
    nowIndex: 0,
    leadMinutes: Math.max(0, Math.round((new Date(forecast.arrivalAt).getTime() - now.getTime()) / 60_000)),
    unit: "m",
  };
  const current = timeline.marks.find((m) => m.id === mark.validAt);
  const basis: AnalysisBasis = {
    at: new Date(forecast.basis.generatedAt),
    projectedAt: new Date(mark.validAt),
    terms: [
      { label: "모델", value: `${forecast.basis.modelName} ${forecast.basis.modelVersion}`, note: forecast.basis.calculationActor },
      { label: "기준시각", value: formatClock(forecast.basis.baseTime), note: `입력 품질 ${forecast.basis.inputQuality}` },
      { label: "불확실성", value: forecast.basis.uncertainty.grade, note: forecast.basis.uncertainty.sensitiveTo.join(" · ") },
    ],
    sources: forecast.basis.inputEventIds,
    assumptions: forecast.basis.assumptions,
  };

  return (
    <>
      <GlassPanel className="pointer-events-auto shrink-0 p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate text-body font-semibold text-foreground">디지털트윈 · {ALTERNATIVE_LABEL[forecast.alternativeId]}</h2>
          <div className="flex gap-1">
            {alternatives.map((a) => (
              <Button key={a.id} size="sm" variant={a.id === forecast.alternativeId ? "default" : "secondary"} onClick={() => onPickAlternative(a.id)}>{ALTERNATIVE_LABEL[a.id]}</Button>
            ))}
          </div>
        </div>
        {forecast.deltaSummary && <p className="mt-1 text-caption text-warning">기준 대비: {forecast.deltaSummary}</p>}
      </GlassPanel>

      <GlassPanel className="pointer-events-auto shrink-0">
        <TimelinePanel
          timeline={timeline}
          at={current?.at}
          mark={current}
          onScrub={() => undefined}
          onPick={(m) => { if (m.kind === "projection") onPickValidAt(m.id); }}
          title="유효 시각"
          formatAt={formatClock}
          caption={`도달 예상 ${formatClock(forecast.arrivalAt)}`}
        />
      </GlassPanel>

      <GlassPanel className="pointer-events-auto shrink-0 p-3">
        <div className="mb-1 text-caption font-semibold text-foreground-muted">영향 결과 · {formatClock(mark.validAt)} 최대 {mark.maxDepthM.toFixed(2)} m</div>
        <ul className="flex flex-col gap-1 text-caption">
          {forecast.targets.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <Tag className="w-[56px] justify-center">{t.kind}</Tag>
              <span className="min-w-0 flex-1 truncate text-foreground">{t.label}</span>
              <span className="shrink-0 font-mono text-foreground-muted">{t.arrivalAt ? formatClock(t.arrivalAt) : "-"}</span>
              <Tag tone={t.exposure === "통제됨" ? "success" : t.exposure === "노출" ? "warning" : "danger"}>{t.exposure}</Tag>
            </li>
          ))}
        </ul>
      </GlassPanel>

      <GlassPanel className="pointer-events-auto min-h-0 flex-1 overflow-y-auto">
        <AnalysisBasisCard basis={basis} />
      </GlassPanel>

      <GlassPanel className="pointer-events-auto flex shrink-0 gap-2 p-2">
        <Button variant="ghost" size="sm" className="flex-1" onClick={onBack}>현재 상태로</Button>
        <Button size="sm" className="flex-1" onClick={onReview}>이 전망으로 대응 검토</Button>
      </GlassPanel>
    </>
  );
}
