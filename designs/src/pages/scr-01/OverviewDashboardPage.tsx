/* ─────────────────────────────────────────────
 * IA-01 종합상황 — 어떤 사건부터 확인할지 결정하는 진입점 (IA §6 · 02 D0)
 *
 * 구성은 CSMS 통합관제 · platform_web 관제 대시보드 계보를 따른다(초안 종합상황_화면상세 §1·§2):
 * 지도 배경, 상단 캡슐(심각 배지 · 특보 · 시각 · 데이터 장애), 좌측 지구 현황 · 지구 목록(푸터 범례), 우측 위험 현황 · 이벤트 유형 현황 · 실시간 주요 사건, 하단 CCTV.
 * 대상만 사업장 → 지구, 위험도 → 매트릭스 등급이다. 정본 IA §6 영역은 초안 §2 표대로 이 자리들에 든다.
 *
 * 값은 전부 model/selectors 에서 온다. 이 화면은 정렬도 집계도 하지 않는다.
 * 시계는 Phase 2 시연 시계(demoNow)다. 지도는 z-0 + isolation 으로 눕혀 두고 패널이 그 위에 선다.
 * ───────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { GlassPanel } from "@ds";
import { CITY_NAME, CITY_SHAPE_BOUNDS } from "../../lib/map-config";
import { useMapLibre } from "../../lib/useMapLibre";
import { useWindLayer } from "../../lib/useWindLayer";
import { useTemperatureLayer } from "../../lib/useTemperatureLayer";
import { SAFEMAP_LAYERS, ensureSafemapLayers, setSafemapVisible } from "../../lib/safemap";
import { useScenario } from "../../state/ScenarioProvider";
import { DistrictHoverProvider } from "../../lib/district-hover";
import { DISTRICTS, type DistrictKind } from "../../demo/districts";
import { districtStatusAt, incidentsAt, riskCountsAt, topIncidentByDistrictAt, watchTargetsAt, type FeedItem } from "../../model/selectors";
import { MapUtilStrip } from "../../components/MapUtilStrip";
import {
  CENTER_LEFT,
  CENTER_RIGHT,
  EDGE,
  LEFT_RAIL,
  RAIL_BASE,
  RIGHT_RAIL,
  UTIL_STRIP,
  utilStripStyle,
} from "../../lib/layout";
import { PILL_SLOT_ID } from "../../agent";
import { CctvLiveStrip } from "./widgets/CctvLiveStrip";
import { DistrictList } from "./widgets/DistrictList";
import { DistrictSummaryCard } from "./widgets/DistrictSummaryCard";
import { EventTypeSummary } from "./widgets/EventTypeSummary";
import { IncidentMarkers, type MapLabel } from "./widgets/IncidentMarkers";
import { RiskSummary } from "./widgets/RiskSummary";
import { SituationFeed } from "./widgets/SituationFeed";
import { StatusStrip } from "./widgets/StatusStrip";

/** 질의 바 + 추천 질문 칩 두 줄의 높이 (px) — 슬롯을 아직 못 잰 첫 맞춤에서만 쓰는 예비값 */
const PILL_AREA_FALLBACK = 140;

/** 하단 주요 CCTV 스트립 높이 (px) — IDC LiveStrip(176) 선례에서 이 화면 몫으로 줄인 값 */
const CCTV_STRIP_H = 160;

/** 스트립 위에 앉는 요소(질의 바)의 바닥 오프셋 (px) — 가장자리 여백 + 스트립 + 사이 간격.
 *  좌우 레일은 화면 바닥까지 내려가고, 스트립은 레일 사이에만 선다(IDC 사건 대응 배치) */
const ABOVE_STRIP = 12 + CCTV_STRIP_H + 12;

/** 지도 레이어로 켜고 끄는 지구 유형 — 표기 순서는 목록·범례와 같다 (Phase 1 그대로) */
const DISTRICT_KINDS: DistrictKind[] = ["하천", "해일", "내수", "저수지"];

/** 지구 하나로 날아갈 때의 배율 */
const FIT_MAX_ZOOM = 14.5;
/** 지구를 못 찾을 때의 중심 — 시 전체 (lib/map-config CITY_CENTER 와 같은 값) */
const CITY_CENTER_FALLBACK: [number, number] = [128.667, 35.201];

export function OverviewDashboardPage() {
  const navigate = useNavigate();
  /* Phase 2 시연 시계. AI 패널 열림은 아직 Phase 1 엔진 값 — 지도 조작 스트립이 그 폭만큼 비켜 선다 */
  const { demoNow: now, agentOpen } = useScenario();
  const mapContainer = useRef<HTMLDivElement>(null);
  const { map, ready } = useMapLibre(mapContainer);
  /* 지도를 덮는 세 요소 — 시 전체 맞춤이 이들의 실제 크기를 재서 비운다 */
  const statusRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const utilRef = useRef<HTMLDivElement>(null);

  const { heroIncidentId } = useScenario();
  const incidents = useMemo(() => incidentsAt(now), [now]);
  const status = useMemo(() => districtStatusAt(now), [now]);
  const top = useMemo(() => topIncidentByDistrictAt(now), [now]);
  const watchTargets = useMemo(() => watchTargetsAt(now), [now]);
  const risks = useMemo(() => riskCountsAt(now), [now]);

  /* 심각 사건이 서면 유형 도넛을 접는다 — 실시간 사건이 그만큼 높이를 받는다. 사람이 다시 펼 수 있고
     심각이 걷히면 자동으로 펼친다 (CSMS 결정) */
  const severeOn = risks.severe > 0;
  const [typesCollapsed, setTypesCollapsed] = useState(severeOn);
  useEffect(() => {
    setTypesCollapsed(severeOn);
  }, [severeOn]);

  /* 지도에서 내려 둔 지구 유형 — 12개 이름표가 한 화면에 서므로 오늘 볼 유형만 남기는 길 (Phase 1 그대로) */
  const [hiddenKinds, setHiddenKinds] = useState<DistrictKind[]>([]);

  /* 지구 12곳 이름표. 색은 지구 상태 하나, 메인 사건 지구만 숨쉰다. 정상 지구는 점만
     남고 이름은 이름표가 상태·선택·호버로 정한다(IncidentMarkers). 감시 우선구역은 "감시" 표기 */
  const labels = useMemo<MapLabel[]>(() => {
    return DISTRICTS.filter((d) => !hiddenKinds.includes(d.kind)).map((d) => {
      const st = status.get(d.id) ?? "정상";
      const hit = top.get(d.id);
      const watched = watchTargets.some((w) => w.incident.legacyDistrictId === d.id);
      return {
        id: d.id,
        name: d.name,
        kind: watched ? `${d.kind} · 감시` : d.kind,
        center: d.center,
        status: st,
        pulse: hit?.incident.incidentId === heroIncidentId,
        ariaLabel: `${d.name} ${d.kind} · ${st}${hit ? ` · ${hit.incident.title}` : watched ? " · 감시 우선구역" : ""}`,
      };
    });
  }, [status, top, watchTargets, hiddenKinds, heroIncidentId]);

  /* 기상 격자 — 미리 구운 자료(public/weather). 바람은 폭풍해일 상황의 배경 결이라
     켜 두고, 기온 색면은 지도를 덮으므로 꺼 두고 시작한다 */
  const [windOn, setWindOn] = useState(true);
  const [tempOn, setTempOn] = useState(false);
  useWindLayer(map, ready, windOn);
  useTemperatureLayer(map, ready, tempOn);

  /* 행안부 침수 자료 2종 — 실시간 WMS. 시연 회선이 불안하면 꺼 둔 채로 간다(safemap.ts) */
  const [safemapOn, setSafemapOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SAFEMAP_LAYERS.map((spec) => [spec.id, false])),
  );
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    ensureSafemapLayers(instance);
    for (const spec of SAFEMAP_LAYERS) setSafemapVisible(instance, spec.id, safemapOn[spec.id]);
  }, [map, ready, safemapOn]);

  /* 창원시 형상(섬 포함)이 잘리지 않고 다 들어오는 자리로 맞춘다. 지구 중심점이 아니라 시 경계 상자를
     쓴다 — 중심점만 맞추면 북쪽 의창·동쪽 진해 끝·남쪽 섬이 화면 밖으로 나간다.
     패딩은 지도를 덮는 것들의 실제 크기다: 좌우 레일(CENTER_LEFT·CENTER_RIGHT), 상단 상태 스트립,
     하단 도크 위의 질의 바·칩, 우측 유틸 스트립. 창 크기가 바뀌면 다시 잰다.
     "원래대로"도 같은 자리로 되돌아온다 — 기울기·회전까지 여기서 함께 편다 */
  const fitCounty = useCallback(
    (duration: number) => {
      const instance = map.current;
      if (!instance) return;
      const mapRect = instance.getContainer().getBoundingClientRect();
      const statusRect = statusRef.current?.getBoundingClientRect();
      const pillRect = pillRef.current?.getBoundingClientRect();
      const utilRect = utilRef.current?.getBoundingClientRect();

      const top = (statusRect ? statusRect.bottom - mapRect.top : EDGE) + EDGE;
      const pillTop = pillRect && pillRect.height > 0 ? mapRect.bottom - pillRect.top : ABOVE_STRIP + PILL_AREA_FALLBACK;
      const bottom = pillTop + EDGE;
      const left = CENTER_LEFT;
      const right = (utilRect && utilRect.width > 0 ? mapRect.right - utilRect.left : CENTER_RIGHT) + EDGE;

      /* 창이 패딩보다 작으면 MapLibre 가 예외를 던진다 — 그때는 레일만 비우고 나머지는 포기한다 */
      const fits = left + right < mapRect.width && top + bottom < mapRect.height;
      instance.fitBounds(CITY_SHAPE_BOUNDS, {
        padding: fits ? { top, bottom, left, right } : { top: EDGE, bottom: EDGE, left: Math.min(left, mapRect.width / 3), right: Math.min(right, mapRect.width / 3) },
        pitch: 0,
        bearing: 0,
        duration,
      });
    },
    [map],
  );

  useEffect(() => {
    if (!ready) return;
    fitCounty(0);
    const instance = map.current;
    if (!instance) return;
    const onResize = () => fitCounty(0);
    instance.on("resize", onResize);
    return () => {
      instance.off("resize", onResize);
    };
  }, [ready, map, fitCounty]);

  /* 지구를 열면 그 지구의 사건 작업공간 (사건이 없으면 사건 없음 안내) */
  const openDistrict = (districtId: string) => navigate(`/scr-02/${districtId}`);
  const openLabel = (label: MapLabel) => openDistrict(label.id);
  /* 사건 카드 — 지구 경로가 사건 작업공간이다(IA §5.2). 종료·오탐은 기록·검증(scr-04).
     감지 카드(사건 전 알림)는 같은 작업공간을 알림 근거로 연다 — 선택 알림은 query `alertId` 로 간다(IA §14 selectedAlertId).
     지구를 모르는 알림만 지도 이동으로 남는다 */
  const openFeedItem = (item: FeedItem) => {
    if (item.kind === "감지") {
      if (item.districtId && item.alertId) return navigate(`/scr-02/${item.districtId}?alertId=${item.alertId}`);
      if (item.districtId) map.current?.flyTo({ center: DISTRICTS.find((d) => d.id === item.districtId)?.center ?? CITY_CENTER_FALLBACK, zoom: FIT_MAX_ZOOM, duration: 600 });
      return;
    }
    if (!item.active) return navigate("/scr-04");
    const v = incidents.find((x) => x.incident.incidentId === item.incidentId);
    if (v?.incident.legacyDistrictId) openDistrict(v.incident.legacyDistrictId);
  };

  return (
    /* DistrictHoverProvider · 지구 목록 줄 호버를 지도 이름표가 같이 받는다 (lib/district-hover) */
    <DistrictHoverProvider>
    <div className="relative h-full w-full overflow-hidden">
      {/* 지도 — 배경. 패널보다 항상 아래.
          MapLibre 가 컨테이너에 position:relative 를 얹으므로 자리 잡기는 바깥 div 가 맡고,
          컨테이너는 그 안을 h-full 로 채운다. 컨테이너에 직접 absolute 를 주면 높이가 0 이 된다 */}
      <div
        className="absolute inset-0 z-0 overflow-hidden bg-surface"
        style={{ isolation: "isolate" }}
        aria-label={`${CITY_NAME} 전체 지도`}
      >
        <div ref={mapContainer} className="h-full w-full" />
        <IncidentMarkers map={map} ready={ready} labels={labels} onOpen={openLabel} />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-surface">
            <Icon
              icon="mdi:loading"
              className="size-5 animate-spin text-foreground-subtle"
              aria-hidden
            />
            <span className="text-body text-foreground-muted">지도를 불러오는 중</span>
          </div>
        )}
      </div>

      {/* 맵 조작 — 오른쪽 가장자리에 선 것(레일 · 열린 AI 패널) 왼쪽 세로 스트립.
          지도 화면 어디서든 같은 자리 같은 버튼 */}
      <div ref={utilRef} className={UTIL_STRIP} style={utilStripStyle(agentOpen)}>
        <MapUtilStrip
          map={map}
          disabled={!ready}
          onReset={() => fitCounty(500)}
          layers={[
            {
              title: "위험지구",
              items: DISTRICT_KINDS.map((kind) => ({
                id: kind,
                label: `${kind} 지구`,
                /* 지구 이름표 문법 그대로 — 글라스 알약. 색 점은 사건 처리상태 몫이라 평소 톤 */
                shape: "pill" as const,
                count: DISTRICTS.filter((d) => d.kind === kind).length,
                visible: !hiddenKinds.includes(kind),
              })),
              onToggle: (id) => setHiddenKinds((prev) => (prev.includes(id as DistrictKind) ? prev.filter((k) => k !== id) : [...prev, id as DistrictKind])),
              onSetAll: (visible) => setHiddenKinds(visible ? [] : [...DISTRICT_KINDS]),
            },
            {
              /* 미리 구운 격자(외부-API-인계 §3) — 시연 중 네트워크를 타지 않는다 */
              title: "기상",
              items: [
                {
                  id: "wind",
                  label: "바람",
                  color: "#94a3b8",
                  icon: "mdi:weather-windy",
                  visible: windOn,
                },
                {
                  id: "temp",
                  label: "기온",
                  color: "#d15f33",
                  icon: "mdi:thermometer",
                  visible: tempOn,
                },
              ],
              onToggle: (id) => (id === "wind" ? setWindOn((v) => !v) : setTempOn((v) => !v)),
              onSetAll: (visible) => {
                setWindOn(visible);
                setTempOn(visible);
              },
              /* CC BY 4.0 출처 표기는 추후 한곳에 모아 정리한다(외부-API-인계 §3-4) */
            },
            {
              /* 실시간 WMS(외부-API-인계 §4) — 지도를 움직일 때마다 요청이 나간다 */
              title: "침수 자료",
              items: SAFEMAP_LAYERS.map((spec) => ({
                id: spec.id,
                label: spec.label,
                color: spec.color,
                icon: spec.icon,
                visible: safemapOn[spec.id],
              })),
              onToggle: (id) => setSafemapOn((prev) => ({ ...prev, [id]: !prev[id] })),
              onSetAll: (visible) =>
                setSafemapOn(Object.fromEntries(SAFEMAP_LAYERS.map((spec) => [spec.id, visible]))),
            },
          ]}
        />
      </div>

      {/* 상단 중앙: 상태 스트립 (03 §1). 도시 대응단계·시나리오 시계·요약 3종.
          알약 캡슐은 위젯이 직접 든다(IDC KpiTiles 선례). 좌우 레일 사이에 띄워야
          패널 밑으로 파고들지 않는다 */}
      <div
        className="pointer-events-none absolute top-3 z-30 flex justify-center"
        style={{ left: CENTER_LEFT, right: CENTER_RIGHT }}
      >
        <div ref={statusRef} className="pointer-events-auto">
          <StatusStrip />
        </div>
      </div>

      {/* 하단 중앙 — 자연어 질의 바 (03 §1). 이 화면의 조연이라 낮게 서고,
          CCTV 스트립 바로 위에 앉는다.
          바 자체는 여기서 그리지 않는다 — **자리만 내주고 AI 패널이 포털로 그려 넣는다.**
          양쪽이 서로를 import 하지 않으므로 패널을 떼도 이 화면은 멀쩡히 돈다 */}
      <div
        className="pointer-events-none absolute z-30 flex justify-center"
        style={{ left: CENTER_LEFT, right: CENTER_RIGHT, bottom: ABOVE_STRIP }}
      >
        <div ref={pillRef} id={PILL_SLOT_ID} className="pointer-events-auto w-full max-w-[680px]" />
      </div>

      {/* 하단 중앙: 주요 CCTV 스트립 (03 §1 · 04 §2-5). 좌우 레일 사이에만 선다 —
          레일이 바닥까지 쓰는 IDC 사건 대응 배치와 같다 */}
      <div
        className="absolute bottom-3 z-20"
        style={{ left: CENTER_LEFT, right: CENTER_RIGHT, height: CCTV_STRIP_H }}
      >
        <GlassPanel className="h-full">
          <CctvLiveStrip />
        </GlassPanel>
      </div>

      {/* 좌측 — 지구 현황 · 지구 목록(푸터 범례). 레일은 화면 바닥까지 내려간다.
          데이터 장애 줄은 상단 캡슐로 올라갔다(StatusStrip) */}
      <div className={`${RAIL_BASE} left-3`} style={{ width: LEFT_RAIL }}>
        <GlassPanel className="pointer-events-auto shrink-0">
          <DistrictSummaryCard />
        </GlassPanel>
        <GlassPanel className="pointer-events-auto flex min-h-0 flex-1 flex-col">
          <DistrictList onOpen={(d) => openDistrict(d.id)} />
        </GlassPanel>
      </div>

      {/* 우측 — 위험 현황 · 이벤트 유형 현황 · 실시간 주요 사건. 레일 자체는 스크롤하지 않는다. 위 둘은 자연
          높이로 서고 실시간 사건이 남는 높이를 받는다 */}
      <div className={`${RAIL_BASE} right-3`} style={{ width: RIGHT_RAIL }}>
        <GlassPanel className="pointer-events-auto shrink-0">
          <RiskSummary />
        </GlassPanel>
        <GlassPanel className="pointer-events-auto shrink-0">
          <EventTypeSummary collapsed={typesCollapsed} onToggle={() => setTypesCollapsed((prev) => !prev)} />
        </GlassPanel>
        <GlassPanel className="pointer-events-auto flex min-h-[160px] flex-1 flex-col">
          <SituationFeed onOpen={openFeedItem} />
        </GlassPanel>
      </div>
    </div>
    </DistrictHoverProvider>
  );
}
