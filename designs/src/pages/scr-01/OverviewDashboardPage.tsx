/* ─────────────────────────────────────────────
 * SCR-01 대시보드 — 정본: docs/정본/03_화면정의서.md §1
 *
 * 시 전체 지도를 배경으로 깔고, 좌측에 위험지구 목록과 색상 기준표를, 우측에 기상·통계·
 * 연계 현황을 오버레이로 얹는다. 담당자가 아침에 켜자마자 오늘 볼 것을 한 화면에서
 * 판단하는 자리이고, 지구를 고르면 조기경보(SCR-02)로 넘어간다.
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
import { formatDateTime } from "../../lib/datetime";
import { DISTRICTS, type District, type DistrictKind } from "../../demo/districts";
import { activeEventsAt } from "../../demo/events";
import { useScenario } from "../../state/ScenarioProvider";
import { MapUtilStrip } from "../../components/MapUtilStrip";
import { CENTER_LEFT, CENTER_RIGHT, LEFT_RAIL, RAIL_BASE, RIGHT_RAIL, UTIL_STRIP } from "../../lib/layout";
import { AgentBar } from "./widgets/AgentBar";
import { DistrictList } from "./widgets/DistrictList";
import { DistrictMarkers } from "./widgets/DistrictMarkers";
import { EventStats } from "./widgets/EventStats";
import { InteropPanel } from "./widgets/InteropPanel";
import { LevelLegend } from "./widgets/LevelLegend";
import { WeatherCard } from "./widgets/WeatherCard";

/** 지구 이름표 반폭 (px) — 가장자리 지구가 패널에 물리지 않게 지도 여백에 더한다 */
const LABEL_MARGIN = 70;

/** 지도 레이어로 켜고 끄는 지구 유형 — 표기 순서는 목록·범례와 같다 */
const DISTRICT_KINDS: DistrictKind[] = ["하천", "해일", "내수", "저수지"];

export function OverviewDashboardPage() {
  const { now, cityStage } = useScenario();
  const activeEvents = activeEventsAt(now);
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const { map, ready } = useMapLibre(mapContainer);

  /* 지도에서 내려 둔 지구 유형. 12개 이름표가 한 화면에 서므로, 오늘 볼 유형만 남기는
     길이 있어야 한다(해일 지구만 보는 태풍 상황 등) */
  const [hiddenKinds, setHiddenKinds] = useState<DistrictKind[]>([]);
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
         더해야 가장자리 지구의 이름표가 패널 밑으로 들어가지 않는다 */
      instance.fitBounds(bounds, {
        padding: {
          top: 56,
          bottom: 56,
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
          layers={{
            title: "위험지구",
            items: DISTRICT_KINDS.map((kind) => ({
              id: kind,
              label: `${kind} 지구`,
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
            note: "이름표 색은 이벤트 단계다 — 좌하단 기준표 참고",
          }}
        />
      </div>

      {/* 하단 중앙 — 자연어 질의 바 (03 §1).
          좌우 레일 사이 가운데 영역에 폭 680px 로 세운다. 레일 폭을 좌우 기준으로 삼아야
          패널 밑으로 파고들지 않고, 지구가 몰린 화면 가운데를 피해 바닥에 붙는다 */}
      <div
        className="pointer-events-none absolute bottom-3 z-30 flex justify-center"
        style={{ left: CENTER_LEFT, right: CENTER_RIGHT }}
      >
        <div className="pointer-events-auto w-full max-w-[680px]">
          <AgentBar />
        </div>
      </div>

      {/* 좌측 — 위험지구 목록 + 색상 기준표 */}
      <div className={`${RAIL_BASE} left-3`} style={{ width: LEFT_RAIL }}>
        <GlassPanel className="pointer-events-auto flex min-h-0 flex-1 flex-col">
          <header className="shrink-0 border-b border-border px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-h6 font-semibold text-foreground">{CITY_NAME} 위험지구</h1>
              {/* 도시 대응단계 — 이 축은 이 자리에만 선다(03 §0-8). S6 승인에서
                  초기대응(보강)으로 오른다. 시나리오 상태값이지 판정 로직이 아니다(04 §0-1) */}
              <span
                className={
                  cityStage === "상시대비"
                    ? "shrink-0 rounded-full border border-border px-2 py-0.5 text-caption text-foreground-muted"
                    : "shrink-0 rounded-full border border-risk-lv4 px-2 py-0.5 text-caption font-medium text-risk-lv4"
                }
              >
                대응단계 · {cityStage}
              </span>
            </div>
            <p className="mt-0.5 text-caption text-foreground-muted">
              진행 중 {activeEvents.length}건 · {formatDateTime(now)} 기준
            </p>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <DistrictList onOpen={openDistrict} />
          </div>
        </GlassPanel>

        <GlassPanel className="pointer-events-auto shrink-0">
          <LevelLegend />
        </GlassPanel>
      </div>

      {/* 우측 — 기상 · 통계 · 연계 현황
          레일 자체는 스크롤하지 않는다. 세 패널 모두 자연 높이로 서고, 자리가 모자랄
          때만 목록 패널(연계 현황)이 줄어들며 **자기 본문 안에서** 스크롤한다.
          레일째 스크롤하면 세 패널이 한 덩어리로 밀려 기상 헤더까지 화면 밖으로 나가고,
          패널이 스크롤 컨테이너의 클립 상자에 붙어 그림자·외곽선도 잘린다.
          목록 패널에 flex-1 로 남는 높이를 다 주면 반대로 빈 유리가 길게 남는다 */}
      <div className={`${RAIL_BASE} right-3`} style={{ width: RIGHT_RAIL }}>
        <GlassPanel className="pointer-events-auto shrink-0">
          <WeatherCard />
        </GlassPanel>
        <GlassPanel className="pointer-events-auto shrink-0">
          <EventStats />
        </GlassPanel>
        <GlassPanel className="pointer-events-auto flex min-h-0 flex-col">
          <InteropPanel />
        </GlassPanel>
      </div>
    </div>
  );
}
