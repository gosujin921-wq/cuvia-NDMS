/* ─────────────────────────────────────────────
 * 폭염 · 도시 열환경 시뮬레이션 — /scr-00 의 폭염 탭 (2026-09-17)
 *
 *   기상청 예보 격자(기온·습도) → 체감온도 → 고온이 언제·어디에 오래 남나 → 폭염 단계 → 관련 SOP
 *
 * 좌(입력): 대상 · 시나리오 · 슬라이더 · 그 시각(기온·습도·체감)      중앙: 체감온도 색면 + 열돔 인셋 + 시간축(12시 → 21시)      우(결과): 기준 대비 · 그 시각 열환경 · 해당 규정 · 근거
 * ★ 열돔을 메인 지도에 움직이는 덩어리로 그리지 않는다. 열돔은 원인이고, 보여 주는 건 도시 열환경이다.
 *   다만 좌측 열돔 인셋은 시계에 걸려 움직인다 — 한 시간에 한 프레임씩 넘어가 시간축 끝에서 자료의 가장 깊은 프레임에 닿는다
 *   (2026-09-17 사용자 "열돔 패널에서 열돔 이동 안 함"). ⚠ 데이터 이슈: 상층장은 6~7월 44프레임이고 폭염일(8-24)이 아니다. 보이는 게 우선.
 * ★ 메인 지도는 창원시 전체가 들어오게 시 외곽 상자에 맞춘다(2026-09-17 사용자 "메인 지도는 창원시가 나와야 함").
 * ★ 저감 대책 전후 비교는 모델이 없어 없다. 지어내지 않는다.
 * ───────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { Button, GlassPanel } from "@ds";
import { useMapLibre } from "../../lib/useMapLibre";
import { CENTER_LEFT, CENTER_RIGHT, EDGE, FAB_SIZE, LEFT_RAIL, RAIL_BASE, RIGHT_RAIL, UTIL_STRIP, utilStripStyle } from "../../lib/layout";
import { ensureHillshade, setBuildings3D, setHillshadeVisible, setTerrain } from "../../lib/flood-scene";
import { cssColor, setPolygonLayerVisible, upsertMultiPolygonLayer } from "../../lib/map-polygon";
import { loadTemperatureField, type TemperatureField } from "../../lib/temperature-field";
import { ensureTemperatureLayer, repaintTemperature, setTemperatureVisible } from "../../lib/temperature-layer";
import { formatClock } from "../../lib/datetime";
import { CITY_SHAPE_BOUNDS } from "../../lib/map-config";
import { SCOPE_ZOOM } from "../../fixtures";
import { useScenario } from "../../state/ScenarioProvider";
import { MapUtilStrip } from "../../components/MapUtilStrip";
import { ContextInset } from "../../components/twin/ContextInset";
import { MapLegend } from "../../components/twin/MapLegend";
import { HOT_AREA_PAINT, SHELTER_DOT } from "../../lib/heat-paint";
import { useHeatDomeData } from "../../components/heat-dome";
import { scenariosOf } from "../../model/sim/flood";
import { cellIndexOf, fieldRange, fieldValuesAt, heatSite, heatStateAt, hotCellRings, hotShareAt, HEAT_ADVISORY, HEAT_WARNING, HOT_HOURS, offsetOf, summarizeHeat } from "../../model/sim/heat";
import { loadShelters, sheltersGeoJson, summarizeShelters, type Shelter } from "../../model/sim/shelters";
import { setCircleLayerVisible, upsertCircleLayer } from "../../lib/map-points";
import { SimScenarios } from "./widgets/SimScenarios";
import { HeatResult } from "./widgets/HeatResult";
import { SimBasisDialog } from "./widgets/SimBasisDialog";
import { TimeAxis } from "./widgets/TimeAxis";

/** 시 전역 배율 — 지도 첫 생성용. 실제 화면 맞춤은 fitCity(창원시 외곽 상자)가 한다 */
const CITY_ZOOM = SCOPE_ZOOM.구역 - 3.2;
const FIT_MARGIN = 24;
const PLAY_MS_PER_MIN = 40;
const HOT_SOURCE = "sim-heat-hot";
const SHELTER_SOURCE = "sim-heat-shelters";
const plusMin = (iso: string, m: number) => new Date(new Date(iso).getTime() + m * 60_000).toISOString();

export function HeatSim() {
  const [params, setParams] = useSearchParams();
  const { agentOpen } = useScenario();
  const [field, setField] = useState<TemperatureField | null>(null);
  useEffect(() => { loadTemperatureField().then(setField).catch(() => undefined); }, []);
  /* 무더위쉼터 — 행정안전부 원장(창원 967곳). 운영시간·야간 개방은 등록값 그대로, 효과는 셈하지 않는다 */
  const [shelters, setShelters] = useState<Shelter[] | null>(null);
  useEffect(() => { loadShelters().then((f) => setShelters(f.rows)).catch(() => undefined); }, []);

  const site = useMemo(() => heatSite(field), [field]);
  const sites = useMemo(() => [site], [site]);
  /* 슬라이더가 준 직접 값(`rf`) — 앵커 밖이면 C 시나리오. 습도 축은 그때 고른 것을 따른다(`ro`) */
  const rf = params.get("rf");
  const custom = useMemo(() => (rf && site.slider ? { temp: site.slider.encode(Number(rf)), ...(params.get("ro") ? { rh: params.get("ro") as string } : {}) } : null), [rf, site, params]);
  const scenarios = useMemo(() => scenariosOf(site, custom), [site, custom]);
  const selected = scenarios.find((s) => s.id === params.get("sc")) ?? scenarios[0];
  const setQuery = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) { if (v === null) next.delete(k); else next.set(k, v); }
    setParams(next, { replace: true });
  };
  /* 객체라 시나리오 id 로 메모한다 — 매 렌더 새 객체면 색면 다시 칠하기·고온 칸 계산이 렌더마다 돈다 */
  const offsetKey = `${selected.id}:${selected.choice.temp ?? ""}:${selected.choice.rh ?? ""}`;
  const offset = useMemo(() => offsetOf(selected.choice), [offsetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 시간축 — 자료의 첫 시각부터 마지막 시각까지, 분 단위 */
  const origin = site.now;
  const span = field ? (field.hours.length - 1) * 60 : 540;
  const end = plusMin(origin, span);
  const [minutes, setMinutes] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [basisOpen, setBasisOpen] = useState(false);
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

  /* ── 계산값 ── */
  const anchorCell = field ? cellIndexOf(field, site.anchor) : 0;
  const summaries = useMemo(
    () => Object.fromEntries(scenarios.map((s) => [s.id, field ? summarizeHeat(field, offsetOf(s.choice), anchorCell) : null])),
    [field, scenarios, anchorCell],
  );
  const state = field ? heatStateAt(field, offset, anchorCell, minutes) : { rows: [], feel: null, hourIndex: 0 };
  const stage: "none" | "advisory" | "warning" = state.feel === null ? "none" : state.feel >= HEAT_WARNING ? "warning" : state.feel >= HEAT_ADVISORY ? "advisory" : "none";
  const hotShareNow = field ? hotShareAt(field, offset, state.hourIndex) : 0;
  const range = useMemo(() => (field ? fieldRange(field) : null), [field]);
  /* 쉼터는 시각(그 날의 몇 시 몇 분)만 본다 — 시나리오와 무관하다 */
  const minuteOfDay = new Date(at).getHours() * 60 + new Date(at).getMinutes();
  const shelterSummary = useMemo(() => (shelters ? summarizeShelters(shelters, minuteOfDay) : null), [shelters, minuteOfDay]);
  /* 지도에 찍는 점은 운영시간이 등록된 곳(132)과 야간 개방(15)뿐 — 등록 없는 835곳까지 찍으면 점이 지도를 덮는다(2026-09-17 사용자 "지도 영역에 dot 들").
     패널이 세는 기준과 같다(등록 없는 곳은 세지 않는다) */
  const shelterRows = useMemo(() => (shelters ? shelters.filter((s) => (s.open && s.close) || s.night) : null), [shelters]);
  const shelterGeo = useMemo(() => (shelterRows ? sheltersGeoJson(shelterRows, minuteOfDay) : null), [shelterRows, minuteOfDay]);

  /* ── 지도 — 체감온도 색면. 시각·시나리오가 바뀌면 같은 램프로 다시 칠한다 ── */
  const mapContainer = useRef<HTMLDivElement>(null);
  const { map, ready } = useMapLibre(mapContainer, { center: site.anchor, zoom: CITY_ZOOM, pitch: 0, capture: true });
  const [layers, setLayers] = useState({ temp: true, hot: true, shelter: true });
  /* 창원시 전체 — 시 외곽 상자를 좌우 레일 안쪽 여백에 맞춘다 */
  const fitCity = useCallback((duration: number) => {
    const m = map.current;
    if (!m) return;
    m.fitBounds(CITY_SHAPE_BOUNDS, { padding: { top: FIT_MARGIN, bottom: FIT_MARGIN + 100, left: CENTER_LEFT + FIT_MARGIN, right: CENTER_RIGHT + FIT_MARGIN }, pitch: 0, bearing: 0, duration });
  }, [map]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    ensureHillshade(m);
    setBuildings3D(m, false);
    setTerrain(m, false);
    setHillshadeVisible(m, true);
    fitCity(800);
  }, [map, ready, fitCity]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !field || !range) return;
    ensureTemperatureLayer(m, field);
    repaintTemperature(m, field, fieldValuesAt(field, state.hourIndex, offset), range);
    setTemperatureVisible(m, layers.temp);
  }, [map, ready, field, range, state.hourIndex, offset, layers.temp]);
  /* 고온 지속 지역 — 33°C↑ 가 3시간 넘게 이어지는 칸을 면으로. 색면이 "지금 어디가 뜨거운가"라면 이것은 "어디에 오래 남는가"다 */
  const hotRings = useMemo(() => (field ? hotCellRings(field, offset) : []), [field, offset]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    upsertMultiPolygonLayer(m, HOT_SOURCE, hotRings, HOT_AREA_PAINT(), 0);
    setPolygonLayerVisible(m, HOT_SOURCE, layers.hot);
  }, [map, ready, hotRings, layers.hot]);
  /* 무더위쉼터 점 — 야간 개방은 primary 로 크게, 그 시각 문 닫은 곳은 옅게. 갈 수 있는지를 지도에서 바로 읽는다 */
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !shelterGeo) return;
    /* 색·크기·농도는 heat-paint 한 벌 — 범례가 같은 값을 그린다 */
    upsertCircleLayer(m, SHELTER_SOURCE, shelterGeo, {
      color: ["case", ["==", ["get", "night"], 1], SHELTER_DOT.night.color(), SHELTER_DOT.open.color()],
      radius: ["case", ["==", ["get", "night"], 1], SHELTER_DOT.night.radius, SHELTER_DOT.open.radius],
      opacity: ["case", ["==", ["get", "open"], 0], SHELTER_DOT.closed.opacity, SHELTER_DOT.open.opacity],
      stroke: SHELTER_DOT.stroke(),
    });
    setCircleLayerVisible(m, SHELTER_SOURCE, layers.shelter);
  }, [map, ready, shelterGeo, layers.shelter]);

  const dome = useHeatDomeData(undefined, true);
  /* 열돔 프레임을 시계에 건다 — 시간축 끝(마지막 시각)에 자료의 기본(가장 깊은) 프레임, 그 앞은 한 시간에 한 프레임씩 거슬러 */
  const domeIndex = useMemo(() => {
    const n = dome.labels.length;
    if (!n) return dome.index;
    const deepest = (dome.lower?.meta as { defaultIndex?: number } | undefined)?.defaultIndex ?? dome.index;
    const back = Math.round((span - Math.min(span, minutes)) / 60);
    return Math.max(0, Math.min(n - 1, deepest - back));
  }, [dome.labels.length, dome.index, dome.lower, span, minutes]);
  const ticks = useMemo(() => (field ? field.hours.map((_, h) => plusMin(origin, h * 60)) : []), [field, origin]);
  const basis = useMemo(() => [
    `고온 지속 지역 = 체감 ${HEAT_ADVISORY}°C 이상이 ${HOT_HOURS}시간 넘게 이어지는 격자의 비율`,
    `지도 색면은 체감온도 ${range ? `${range.min}~${range.max}°C` : ""} 한 램프. 시각과 시나리오를 바꿔도 같은 색은 같은 값`,
    `${field?.source ?? "기상청(KMA) 국지예보모델"} · ${site.date} ${field?.hours[0] ?? 12}~${field?.hours[field.hours.length - 1] ?? 21}시 · 격자 ${field ? `${field.nx}×${field.ny} · ${field.step}°(약 1.5 km)` : "1.5 km"}`,
    "체감온도 = 기상청 여름철 산식(습구온도 Stull 2011 입력) · 기온·상대습도 격자값으로 칸마다 계산",
    `특보 기준 = 일 최고 체감온도 주의보 ${HEAT_ADVISORY}°C · 경보 ${HEAT_WARNING}°C 이상(2일 이상 지속 예상). 하루치 자료라 도달만 판정`,
    "시나리오 A = 예보 기온 +2°C 균일 가정 · B = 예보 습도 +10 %p 균일 가정(100 % 상한). 도시 열환경(녹지·포장) 모델은 없어 저감 대책 비교는 두지 않는다",
    "열돔 인셋 = 상층(500 · 200 hPa) 지위고도 재분석 격자. 원인 맥락이며 결과 계산엔 쓰지 않는다",
    `무더위쉼터 = 행정안전부 원장(재난안전데이터 공유플랫폼 · 2026) 창원 ${shelters?.length ?? 967}곳. 운영시간·야간 개방은 등록값 그대로. 쉼터가 덮는 인원은 셈하지 않는다`,
    `운영 중·종료는 운영시간이 등록된 ${shelterSummary ? shelterSummary.withHours : ""}곳만 센다. 등록이 없는 곳은 세지 않는다`,
    "해당 규정은 이 조건이면 해당되는 기존 SOP다. 쉼터·살수차의 효과는 모델이 없어 계산하지 않는다",
  ], [field, site.date, shelters, range, shelterSummary]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden bg-surface" style={{ isolation: "isolate" }} aria-label="폭염 시뮬레이션 씬">
        <div ref={mapContainer} className="h-full w-full" />
      </div>

      <div className={`${RAIL_BASE} left-3`} style={{ width: LEFT_RAIL }}>
        <GlassPanel className="pointer-events-auto flex min-h-0 flex-1 flex-col">
          <SimScenarios
            sites={sites} site={site} onSite={() => undefined} scenarios={scenarios} selected={selected} onSelect={(id) => setQuery({ sc: id })}
            onSlide={(v) => setQuery({ rf: String(Number(v.toFixed(1))), ro: selected.choice.rh ?? null, sc: "C" })}
            at={at}
            stateRows={state.rows}
          />
        </GlassPanel>
        <ContextInset family="E" anchor={site.anchor} hour={new Date(at).getHours()} meta={formatClock(at)} dome={{ ...dome, index: domeIndex }} />
        {/* 범례 — 침수 탭과 같은 자리. 켜진 층만 선다 */}
        <MapLegend
          feel={layers.temp ? range : null}
          hot={layers.hot}
          shelter={layers.shelter && Boolean(shelterRows)}
          inset="globe"
        />
      </div>

      <div className="pointer-events-none absolute bottom-3 z-30 flex justify-center px-3 [&>*]:w-full [&>*]:max-w-[640px]" style={{ left: CENTER_LEFT, right: CENTER_RIGHT + FAB_SIZE + EDGE }}>
        <TimeAxis
          origin={origin}
          end={end}
          ticks={ticks}
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
          onReset={() => fitCity(500)}
          layers={[{
            title: "열환경",
            items: [
              { id: "temp", label: "체감온도 색면", color: cssColor("--color-warning", "#eb6834"), icon: "mdi:thermometer", shape: "raster" as const, visible: layers.temp },
              { id: "hot", label: "고온 지속 지역", color: cssColor("--color-danger", "#ef4444"), icon: "mdi:vector-square", shape: "area" as const, visible: layers.hot },
              { id: "shelter", label: "무더위쉼터", color: cssColor("--color-primary", "#3b82f6"), icon: "mdi:home-thermometer-outline", shape: "point" as const, count: shelterRows?.length, visible: layers.shelter },
            ],
            onToggle: (id) => setLayers((p) => ({ ...p, [id as keyof typeof p]: !p[id as keyof typeof p] })),
            onSetAll: (visible) => setLayers({ temp: visible, hot: visible, shelter: visible }),
          }]}
        />
      </div>

      <div className={`${RAIL_BASE} right-3`} style={{ width: RIGHT_RAIL }}>
        <GlassPanel className="pointer-events-auto flex min-h-0 flex-1 flex-col">
          {field ? (
            <HeatResult
              base={scenarios[0]}
              selected={selected}
              summaries={summaries}
              hotShareNow={hotShareNow}
              stage={stage}
              shelters={shelterSummary}
              sop={site.sop}
            />
          ) : (
            <p className="p-3 text-caption text-foreground-muted">기온 격자를 읽는 중입니다.</p>
          )}
        </GlassPanel>
        <Button variant="outline" size="sm" className="pointer-events-auto w-full shrink-0 bg-surface/95 backdrop-blur" onClick={() => setBasisOpen(true)}>
          <Icon icon="mdi:file-search-outline" className="size-4" aria-hidden />
          근거 · 입력과 산식
        </Button>
      </div>

      {basisOpen && (
        <SimBasisDialog title={site.label} onClose={() => setBasisOpen(false)} notes={[{ heading: "입력과 산식", lines: basis }]} />
      )}
    </div>
  );
}
