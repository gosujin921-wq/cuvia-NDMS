/* ─────────────────────────────────────────────
 * SCR-01 대시보드 — 배경: docs/레거시/정본/03_화면정의서.md §1
 *
 * 시 전체 지도를 배경으로 깔고, 상단에 상태 스트립(대응단계·시계·요약)을, 좌측에 주요
 * 재난 카드·위험지구 목록·색상 기준표를, 우측에 기상·통계·연계 현황을 오버레이로 얹는다.
 * 담당자가 아침에 켜자마자 오늘 볼 것을 한 화면에서 판단하는 자리이고, 지구를 고르면
 * 조기경보(SCR-02)로 넘어간다.
 *
 * 지도는 z-0 + isolation 으로 눕혀 두고 패널이 그 위에 선다(03 §0-1).
 * ───────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import maplibregl from "maplibre-gl";
import { GlassPanel } from "@ds";
import { CITY_NAME } from "../../lib/map-config";
import { useMapLibre } from "../../lib/useMapLibre";
import { useWindLayer } from "../../lib/useWindLayer";
import { useTemperatureLayer } from "../../lib/useTemperatureLayer";
import { SAFEMAP_LAYERS, ensureSafemapLayers, setSafemapVisible } from "../../lib/safemap";
import { DISTRICTS, type District, type DistrictKind } from "../../demo/districts";
import { majorDisasterAt } from "../../demo/events";
import { useScenario } from "../../state/ScenarioProvider";
import { MapUtilStrip } from "../../components/MapUtilStrip";
import { CENTER_LEFT, CENTER_RIGHT, LEFT_RAIL, RAIL_BASE, RIGHT_RAIL, UTIL_STRIP } from "../../lib/layout";
import { AgentBar } from "./widgets/AgentBar";
import { CctvLiveStrip } from "./widgets/CctvLiveStrip";
import { DistrictList } from "./widgets/DistrictList";
import { DistrictMarkers } from "./widgets/DistrictMarkers";
import { EventStats } from "./widgets/EventStats";
import { InteropPanel } from "./widgets/InteropPanel";
import { LevelLegend } from "./widgets/LevelLegend";
import { MajorDisasterCard } from "./widgets/MajorDisasterCard";
import { StatusStrip } from "./widgets/StatusStrip";
import { WeatherCard } from "./widgets/WeatherCard";

/** 지구 이름표 반폭 (px) — 가장자리 지구가 패널에 물리지 않게 지도 여백에 더한다 */
const LABEL_MARGIN = 70;

/** 하단 주요 CCTV 스트립 높이 (px) — IDC LiveStrip(176) 선례에서 이 화면 몫으로 줄인 값 */
const CCTV_STRIP_H = 160;

/** 스트립 위에 앉는 요소(질의 바)의 바닥 오프셋 (px) — 가장자리 여백 + 스트립 + 사이 간격.
 *  좌우 레일은 화면 바닥까지 내려가고, 스트립은 레일 사이에만 선다(IDC 사건 대응 배치) */
const ABOVE_STRIP = 12 + CCTV_STRIP_H + 12;

/** 지도 레이어로 켜고 끄는 지구 유형 — 표기 순서는 목록·범례와 같다 */
const DISTRICT_KINDS: DistrictKind[] = ["하천", "해일", "내수", "저수지"];

export function OverviewDashboardPage() {
  const navigate = useNavigate();
  /* 주요 재난 사건군에 선 지구는 아래 목록에서 뺀다(03 §1 · 04 §4-7).
     같은 지구를 화면에 두 번 세우지 않는다 */
  const { now } = useScenario();
  const majorDistrictIds = majorDisasterAt(now)?.events.map((e) => e.districtId) ?? [];
  const mapContainer = useRef<HTMLDivElement>(null);
  const { map, ready } = useMapLibre(mapContainer);

  /* 지도에서 내려 둔 지구 유형. 12개 이름표가 한 화면에 서므로, 오늘 볼 유형만 남기는
     길이 있어야 한다(해일 지구만 보는 태풍 상황 등) */
  const [hiddenKinds, setHiddenKinds] = useState<DistrictKind[]>([]);

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
  const visibleDistricts = useMemo(
    () => DISTRICTS.filter((district) => !hiddenKinds.includes(district.kind)),
    [hiddenKinds],
  );

  /* 12개 지구가 전부 보이는 자리로 맞춘다. 중심·배율을 고정값으로 두면 좌우 패널에 가려
     이름표가 반쯤 잘리는 지구가 생긴다. 패널 폭을 여백으로 넘겨 가려지지 않은 영역에 앉힌다.
     "원래대로"도 같은 자리로 되돌아온다 — 기울기·회전까지 여기서 함께 편다 */
  const fitCounty = useCallback(
    (duration: number) => {
      const instance = map.current;
      if (!instance) return;
      const bounds = DISTRICTS.reduce(
        (acc, district) => acc.extend(district.center),
        new maplibregl.LngLatBounds(DISTRICTS[0].center, DISTRICTS[0].center),
      );
      /* 이름표는 좌표를 가운데로 두고 좌우로 퍼지므로, 패널 폭에 이름표 반폭(LABEL_MARGIN)을
         더해야 가장자리 지구의 이름표가 패널 밑으로 들어가지 않는다.
         위쪽은 상단 상태 스트립(03 §1)이 서는 자리라 아래쪽보다 여유를 더 준다 */
      instance.fitBounds(bounds, {
        padding: {
          top: 96,
          bottom: ABOVE_STRIP + 56,
          left: CENTER_LEFT + LABEL_MARGIN,
          right: CENTER_RIGHT + LABEL_MARGIN,
        },
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
  }, [ready, fitCounty]);

  const openDistrict = (district: District) => navigate(`/scr-02/${district.id}`);

  return (
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
        <DistrictMarkers
          map={map}
          ready={ready}
          districts={visibleDistricts}
          onOpen={openDistrict}
        />
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

      {/* 맵 조작 — 우측 레일 왼쪽 세로 스트립. 지도 화면 어디서든 같은 자리 같은 버튼 */}
      <div className={UTIL_STRIP}>
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
                /* 지구 이름표 문법 그대로 — 글라스 알약. 색 점은 이벤트 단계 몫이라 평소 톤(03 §1) */
                shape: "pill" as const,
                count: DISTRICTS.filter((district) => district.kind === kind).length,
                visible: !hiddenKinds.includes(kind),
              })),
              onToggle: (id) =>
                setHiddenKinds((prev) =>
                  prev.includes(id as DistrictKind)
                    ? prev.filter((kind) => kind !== id)
                    : [...prev, id as DistrictKind],
                ),
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
        <div className="pointer-events-auto">
          <StatusStrip />
        </div>
      </div>

      {/* 하단 중앙 — 자연어 질의 바 (03 §1). 이 화면의 조연이라 폭 560px 로 낮게 서고,
          CCTV 스트립 바로 위에 앉는다 */}
      <div
        className="pointer-events-none absolute z-30 flex justify-center"
        style={{ left: CENTER_LEFT, right: CENTER_RIGHT, bottom: ABOVE_STRIP }}
      >
        <div className="pointer-events-auto w-full max-w-[560px]">
          <AgentBar />
        </div>
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

      {/* 좌측 — 현재 주요 재난(사건군) + 그 외 위험지구 목록 + 색상 기준표.
          레일은 화면 바닥까지 내려간다 — CCTV 스트립은 레일 사이에만 선다 */}
      <div className={`${RAIL_BASE} left-3`} style={{ width: LEFT_RAIL }}>
        <GlassPanel className="pointer-events-auto shrink-0">
          <MajorDisasterCard onOpen={openDistrict} />
        </GlassPanel>

        <GlassPanel className="pointer-events-auto flex min-h-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <h1 className="text-h6 font-semibold text-foreground">
              {majorDistrictIds.length > 0 ? "그 외 위험지구" : `${CITY_NAME} 위험지구`}
            </h1>
            <span className="shrink-0 text-caption text-foreground-subtle">
              {DISTRICTS.length - majorDistrictIds.length}곳
            </span>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <DistrictList onOpen={openDistrict} excludeIds={majorDistrictIds} />
          </div>
        </GlassPanel>

        <GlassPanel className="pointer-events-auto shrink-0">
          <LevelLegend />
        </GlassPanel>
      </div>

      {/* 우측 — 기상 · 통계 · 연계 현황
          레일 자체는 스크롤하지 않는다. 기상·통계는 자연 높이로 서고, 연계 현황이
          남는 높이를 받아 브라우저 크기를 따라 늘고 준다(03 §1). 최소 높이 아래로는
          줄지 않고, 좁으면 목록만 자기 본문 안에서 스크롤한다.
          레일째 스크롤하면 세 패널이 한 덩어리로 밀려 기상 헤더까지 화면 밖으로 나가고,
          패널이 스크롤 컨테이너의 클립 상자에 붙어 그림자·외곽선도 잘린다 */}
      <div className={`${RAIL_BASE} right-3`} style={{ width: RIGHT_RAIL }}>
        <GlassPanel className="pointer-events-auto shrink-0">
          <WeatherCard />
        </GlassPanel>
        <GlassPanel className="pointer-events-auto shrink-0">
          <EventStats />
        </GlassPanel>
        {/* min-h 가 둘을 겸한다: flex 기본 min-height:auto 를 풀어 줄어들 수 있게 하고,
            그 바닥(최소 높이 · 헤더 + 두 행)도 정한다. 이보다 크게 잡으면 낮은 화면에서
            레일 합이 자리를 넘쳐 CCTV 스트립을 덮는다 */}
        <GlassPanel className="pointer-events-auto flex min-h-[140px] flex-1 flex-col">
          <InteropPanel />
        </GlassPanel>
      </div>
    </div>
  );
}
