/* ─────────────────────────────────────────────
 * SCR-05 디지털트윈 — 정본: docs/정본/03_화면정의서.md §5
 *
 * 지구를 3D 로 띄워 놓고 침수 범위를 올려 본다. 사고 난 뒤가 아니라 나기 전을 보는 자리다.
 *
 * 실사 3D 모델은 확보 대상이 아니다. 지형·건물을 세우고 그 위에 반투명 수면을 얹어,
 * 슬라이더로 높이를 키우는 방식으로 만든다(lib/flood-scene.ts).
 * ───────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { GlassPanel } from "@ds";
import { useMapLibre } from "../../lib/useMapLibre";
import { MapUtilStrip } from "../../components/MapUtilStrip";
import { CENTER_LEFT, CENTER_RIGHT, LEFT_RAIL, RAIL_BASE, RIGHT_RAIL, UTIL_STRIP } from "../../lib/layout";
import {
  ensureFloodLayers,
  ensureHillshade,
  setBuildings3D,
  setFloodLevel,
  setFloodLineVisible,
  setHillshadeVisible,
  setTerrain,
} from "../../lib/flood-scene";
import { DISTRICTS, findDistrict, type District } from "../../demo/districts";
import { devicesOf, type DeviceKind } from "../../demo/devices";
import { WATER_THRESHOLDS } from "../../demo/levels";
import { DistrictEventList } from "./widgets/DistrictEventList";
import { FloodSlider } from "./widgets/FloodSlider";
import { LayerPanel, type LayerState } from "./widgets/LayerPanel";
import { MiniMap } from "./widgets/MiniMap";
import { TwinDeviceMarkers } from "./widgets/TwinDeviceMarkers";
import { TwinWeather } from "./widgets/TwinWeather";

/**
 * 마을과 건물이 함께 잡히는 배율. 베이스맵 3D 건물이 15부터 나온다.
 * 16 까지 당기면 침수 범위가 화면을 넘어 "어디까지 잠기는지"의 경계가 사라진다.
 */
const TWIN_ZOOM = 15.8;
/**
 * 트윈은 지도 화면(TILT_PITCH)보다 더 눕힌다. 물이 차오르는 것은 높이의 이야기라
 * 위에서 내려다보면 색만 덮이고 "잠긴다"가 보이지 않는다.
 */
const TWIN_PITCH = 60;
/** 침수 슬라이더 상한 (EL.m) — 04 §9 */
const FLOOD_MAX = 6;

const DEFAULT_LAYERS: LayerState = {
  buildings3d: true,
  weather: false,
  terrain: true,
  /* 등고선 데이터가 없어 산이 단색 면으로만 보인다. 음영을 기본으로 켜 능선을 살린다 */
  hillshade: true,
  devices: { WL: true, RN: false, DP: false, CV: true, BC: false },
  floodLine: true,
  flood: false,
};

export function DigitalTwinPage() {
  const navigate = useNavigate();
  const { districtId } = useParams();
  /* 04 §9 — 기본 지구는 봉암지구. 조기경보에서 넘어오면 그 지구를 연다 */
  const district = (districtId && findDistrict(districtId)) || findDistrict("bongam") || DISTRICTS[0];

  const mapContainer = useRef<HTMLDivElement>(null);
  const { map, ready } = useMapLibre(mapContainer, {
    center: district.center,
    zoom: TWIN_ZOOM,
    pitch: TWIN_PITCH,
  });

  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
  const [level, setLevel] = useState(0);

  const devices = useMemo(() => devicesOf(district.id), [district.id]);
  const visibleDevices = devices.filter((device) => layers.devices[device.kind as DeviceKind]);
  const threshold = WATER_THRESHOLDS[district.id];

  /* 마을을 여는 시점 — 진입·지구 전환·"원래대로"가 모두 여기로 온다.
     트윈은 기울인 시점이 기본이라 되돌릴 때도 평면이 아니라 TWIN_PITCH 로 간다 */
  const focusDistrict = useCallback(
    (duration: number) => {
      const instance = map.current;
      if (!instance) return;
      instance.easeTo({
        center: district.center,
        zoom: TWIN_ZOOM,
        pitch: TWIN_PITCH,
        bearing: 0,
        padding: { top: 0, bottom: 0, left: CENTER_LEFT, right: CENTER_RIGHT },
        duration,
      });
    },
    [map, district],
  );

  /* 지구가 바뀌면 그 마을로 날아가고 침수 수위는 0 으로 되돌린다.
     앞 마을에서 올려 둔 물이 남아 있으면 다른 마을이 이미 잠긴 채로 열린다 */
  useEffect(() => {
    setLevel(0);
    const instance = map.current;
    if (!ready || !instance) return;
    ensureFloodLayers(instance, district.center);
    ensureHillshade(instance);
    focusDistrict(800);
  }, [map, ready, district, focusDistrict]);

  /* 레이어 토글 반영 */
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    setBuildings3D(instance, layers.buildings3d);
    setTerrain(instance, layers.terrain);
    setHillshadeVisible(instance, layers.hillshade);
    setFloodLineVisible(instance, layers.floodLine);
  }, [map, ready, layers]);

  /* 수면 높이 */
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    setFloodLevel(instance, level, layers.flood);
  }, [map, ready, level, layers.flood]);

  const openDistrict = (next: District) => navigate(`/scr-05/${next.id}`);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* 3D 씬 — 배경 */}
      <div
        className="absolute inset-0 z-0 overflow-hidden bg-surface"
        style={{ isolation: "isolate" }}
        aria-label={`${district.name} 3D 씬`}
      >
        <div ref={mapContainer} className="h-full w-full" />
        <TwinDeviceMarkers map={map} ready={ready} devices={visibleDevices} />

        {/* 날씨효과 — 비 내리는 결. 씬 위에 얹고 클릭은 통과시킨다 */}
        {layers.weather && <div className="rain-overlay pointer-events-none absolute inset-0" />}

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-surface">
            <Icon
              icon="mdi:loading"
              className="size-5 animate-spin text-foreground-subtle"
              aria-hidden
            />
            <span className="text-body text-foreground-muted">3D 씬을 불러오는 중</span>
          </div>
        )}
      </div>

      {/* 좌상단 — 지구·복귀 */}
      <div className="pointer-events-none absolute left-3 top-3 z-30">
        <GlassPanel className="pointer-events-auto">
          <div className="flex items-center gap-2 px-3 py-2">
            <button
              type="button"
              onClick={() => navigate(`/scr-02/${district.id}`)}
              aria-label="조기경보로"
              className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent text-foreground-subtle transition-colors hover:bg-surface-raised hover:text-foreground"
            >
              <Icon icon="mdi:arrow-left" className="size-4" aria-hidden />
            </button>
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-h6 font-semibold text-foreground">{district.name}</h1>
                <span className="shrink-0 text-caption text-foreground-subtle">
                  {district.kind}
                </span>
              </div>
              <span className="truncate text-caption text-foreground-muted">
                {district.target} · Twin 모드
              </span>
            </div>
          </div>
        </GlassPanel>
      </div>

      {/* 좌하단 — 날씨 */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20" style={{ width: LEFT_RAIL }}>
        <GlassPanel className="pointer-events-auto">
          <TwinWeather districtId={district.id} />
        </GlassPanel>
      </div>

      {/* 씬 조작 — 지도 화면(SCR-01·02·03)과 같은 스트립을 같은 자리에 세운다.
          레이어는 우측 레이어 패널이 맡으므로 스트립에는 넣지 않고, "원래대로"는 트윈
          기본 시점(기울인 채)으로 돌아간다 */}
      <div className={UTIL_STRIP}>
        <MapUtilStrip
          map={map}
          disabled={!ready}
          homePitch={TWIN_PITCH}
          onReset={() => focusDistrict(500)}
        />
      </div>

      {/* 우측 — 미니맵 · 이벤트 · 레이어 · 침수 슬라이더 */}
      <div className={`${RAIL_BASE} right-3`} style={{ width: RIGHT_RAIL }}>
        <GlassPanel className="pointer-events-auto shrink-0">
          <MiniMap current={district} onSelect={openDistrict} />
        </GlassPanel>
        <GlassPanel className="pointer-events-auto shrink-0">
          <DistrictEventList districtId={district.id} />
        </GlassPanel>
        <GlassPanel className="pointer-events-auto shrink-0">
          <LayerPanel state={layers} onChange={setLayers} />
        </GlassPanel>
        <GlassPanel className="pointer-events-auto shrink-0">
          <FloodSlider
            value={level}
            max={FLOOD_MAX}
            disabled={!layers.flood}
            threshold={threshold}
            onChange={setLevel}
          />
        </GlassPanel>
      </div>
    </div>
  );
}
