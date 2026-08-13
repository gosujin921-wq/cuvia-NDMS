/* ─────────────────────────────────────────────
 * SCR-02 조기경보 — 정본: docs/정본/03_화면정의서.md §2
 *
 * 지구 하나로 좁혀 장비와 계측값을 본다. 숫자(센서 팝업)와 영상(CCTV 팝업)을 같은 지도
 * 위에서 이중 확인하는 자리다.
 *
 * 지구는 경로(/scr-02/:districtId)로 받는다. 대시보드에서 고른 지구가 그대로 열리고,
 * 메뉴로 직접 들어오면 진행 중 이벤트가 있는 지구부터 연다.
 * ───────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { Button, FilterCapsule, GlassPanel, Tag } from "@ds";
import { DISTRICT_ZOOM } from "../../lib/map-config";
import { useMapLibre } from "../../lib/useMapLibre";
import { DISTRICTS, findDistrict, type District } from "../../demo/districts";
import { activeEventOfAt, activeEventsAt, eventViewAt, hazardLabel } from "../../demo/events";
import { useScenario } from "../../state/ScenarioProvider";
import { levelSpec } from "../../demo/levels";
import { DEVICE_KINDS, devicesOf, type DeviceKind } from "../../demo/devices";
import { hazardLayersOf } from "../../demo/hazard-layers";
import { HazardLayers } from "../../components/HazardLayers";
import { MapPopup } from "../../components/MapPopup";
import { MapUtilStrip } from "../../components/MapUtilStrip";
import { LevelBadge } from "../../components/LevelBadge";
import { CENTER_RIGHT, RAIL_BASE, RIGHT_RAIL, UTIL_STRIP } from "../../lib/layout";
import { DeviceLegend } from "./widgets/DeviceLegend";
import { DeviceMarkers } from "./widgets/DeviceMarkers";
import { DevicePopup } from "./widgets/DevicePopup";
import { MonthlyEventsPanel } from "./widgets/MonthlyEventsPanel";
import { RealtimeSensorPanel } from "./widgets/RealtimeSensorPanel";
import { WindPanel } from "./widgets/WindPanel";

/** 진행 중 이벤트가 있는 지구 우선. 없으면 첫 지구 */
function defaultDistrict(now: Date): District {
  const active = activeEventsAt(now)[0];
  return (active && findDistrict(active.districtId)) ?? DISTRICTS[0];
}

export function EarlyWarningPage() {
  const navigate = useNavigate();
  const { districtId } = useParams();
  const { now, advanceTo, approvedResponseLevel } = useScenario();
  const district = (districtId && findDistrict(districtId)) || defaultDistrict(now);

  const mapContainer = useRef<HTMLDivElement>(null);
  const { map, ready } = useMapLibre(mapContainer, {
    center: district.center,
    zoom: DISTRICT_ZOOM,
  });

  const [hiddenKinds, setHiddenKinds] = useState<DeviceKind[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* 위험요소 레이어 3종 — 서항 한정 · 기본 켜짐. 장비 토글과 별도 그룹이다(03 §2).
     장비는 "무엇이 설치돼 있나", 위험요소는 "왜 위험지구인가"를 말하는 다른 층이다 */
  const hazards = useMemo(() => hazardLayersOf(district.id, "control"), [district.id]);
  const [hazardOn, setHazardOn] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setHazardOn(Object.fromEntries(hazards.map((h) => [h.id, true])));
  }, [hazards]);

  const devices = useMemo(() => devicesOf(district.id), [district.id]);
  const visibleDevices = devices.filter((d) => !hiddenKinds.includes(d.kind));
  const sensors = devices.filter((d) => d.kind === "WL" || d.kind === "RN" || d.kind === "DP");
  const selected = devices.find((d) => d.id === selectedId) ?? null;

  const counts = useMemo(() => {
    const acc = { WL: 0, RN: 0, DP: 0, CV: 0, BC: 0 } as Record<DeviceKind, number>;
    for (const device of devices) acc[device.kind] += 1;
    return acc;
  }, [devices]);

  const toggleKind = (kind: DeviceKind) =>
    setHiddenKinds((prev) =>
      prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind],
    );

  /* 지구를 여는 자리 — 처음 진입·지구 전환·"원래대로"가 모두 여기로 온다.
     기울기·회전은 되돌릴 때만 의미가 있어 easeTo 에 0 으로 함께 실어 보낸다 */
  const focusDistrict = useCallback(
    (duration: number) => {
      const instance = map.current;
      if (!instance) return;
      instance.easeTo({
        center: district.center,
        zoom: DISTRICT_ZOOM,
        padding: { top: 0, bottom: 0, left: 0, right: CENTER_RIGHT },
        pitch: 0,
        bearing: 0,
        duration,
      });
    },
    [map, district],
  );

  /* 지구를 바꾸면 지도가 그 지구로 날아가고, 앞 지구에서 열어 둔 팝업은 닫는다 */
  useEffect(() => {
    setSelectedId(null);
    if (!ready) return;
    focusDistrict(700);
  }, [ready, focusDistrict]);

  /* ── 시나리오 스텝 트리거 (04 §0) — 조작이 스텝을 올린다 ──
     서항을 열면 S1. 주인공 수위계 팝업을 열면 S2 — 8초 뒤 격상은 엔진이 올린다(03 §2).
     서항 CCTV 팝업을 열면 S3. 스텝은 단조라 곁가지(다른 지구 구경)에는 흔들리지 않는다 */
  useEffect(() => {
    if (district.id === "seohang") advanceTo(1);
  }, [district.id, advanceTo]);
  useEffect(() => {
    if (!selected) return;
    if (selected.id === "seohang-WL-001") advanceTo(2);
    else if (selected.districtId === "seohang" && selected.kind === "CV") advanceTo(3);
  }, [selected, advanceTo]);

  const event = activeEventOfAt(district.id, now);
  const view = event ? eventViewAt(event, now) : null;
  const spec = view ? levelSpec(view.level) : null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        className="absolute inset-0 z-0 overflow-hidden bg-surface"
        style={{ isolation: "isolate" }}
        aria-label={`${district.name} 지도`}
      >
        <div ref={mapContainer} className="h-full w-full" />
        <HazardLayers map={map} ready={ready} layers={hazards} visible={hazardOn} />
        <DeviceMarkers
          map={map}
          ready={ready}
          devices={visibleDevices}
          selectedId={selectedId}
          onSelect={(device) => setSelectedId(device.id)}
        />
        {selected && (
          <MapPopup
            map={map}
            lngLat={selected.center}
            onClose={() => setSelectedId(null)}
            offset={24}
          >
            <DevicePopup device={selected} onClose={() => setSelectedId(null)} />
          </MapPopup>
        )}
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
          onReset={() => focusDistrict(500)}
          layers={[
            {
              title: "장비",
              items: DEVICE_KINDS.filter((spec) => counts[spec.kind] > 0).map((spec) => ({
                id: spec.kind,
                label: spec.label,
                color: spec.color,
                icon: spec.icon,
                count: counts[spec.kind],
                visible: !hiddenKinds.includes(spec.kind),
              })),
              onToggle: (id) => toggleKind(id as DeviceKind),
              onSetAll: (visible) =>
                setHiddenKinds(
                  visible ? [] : DEVICE_KINDS.filter((s) => counts[s.kind] > 0).map((s) => s.kind),
                ),
              note: "이벤트 핀은 별도 종류가 아니다 — 그 장비 종류를 끄면 같이 내려간다",
            },
            /* 위험요소 — 장비와 별도 그룹(03 §2). 등재된 지구(서항)에서만 선다 */
            ...(hazards.length > 0
              ? [
                  {
                    title: "위험요소",
                    items: hazards.map((h) => ({
                      id: h.id,
                      label: h.label,
                      color: h.color,
                      icon: h.icon,
                      visible: hazardOn[h.id] ?? true,
                    })),
                    onToggle: (id: string) =>
                      setHazardOn((prev) => ({ ...prev, [id]: !(prev[id] ?? true) })),
                    onSetAll: (visible: boolean) =>
                      setHazardOn(Object.fromEntries(hazards.map((h) => [h.id, visible]))),
                  },
                ]
              : []),
          ]}
        />
      </div>

      {/* 상단 — 지구 머리말 · 지구 전환 · Twin 진입.
          머리말과 지구 전환은 정본(§2 구성)에서도 다른 블록이다. 카드를 나눠 세워
          "지금 보는 곳"과 "옮겨 갈 곳"이 한 판에 섞이지 않게 한다 */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-30 flex items-start gap-3">
        <div className="flex w-[420px] shrink-0 flex-col gap-2">
          {/* 지구 머리말 — 지금 보는 지구가 무엇이고 어떤 상태인지. 대시보드로 돌아가는 길 */}
          <GlassPanel className="pointer-events-auto">
            <div className="flex items-center gap-2 px-3 py-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/scr-01")}
                aria-label="종합상황으로"
                className="size-7 shrink-0 text-foreground-subtle hover:text-foreground"
              >
                <Icon icon="mdi:arrow-left" className="size-4" aria-hidden />
              </Button>
              <div className="flex min-w-0 flex-col">
                <div className="flex items-center gap-1.5">
                  <h1 className="truncate text-h6 font-semibold text-foreground">{district.name}</h1>
                  {/* 지구 유형(시설 축) · 재난유형(현상 축) — 다른 축이라 함께 적는다(04 §4-0) */}
                  <Tag className="shrink-0">
                    {event ? `${district.kind} · ${hazardLabel(event.hazardType)}` : district.kind}
                  </Tag>
                </div>
                <span className="truncate text-caption text-foreground-muted">
                  {district.target} · 장비 {devices.length}대
                </span>
              </div>
              {spec && event && view && (
                <span className="ml-auto flex shrink-0 items-center gap-1.5">
                  {/* 승인 대응등급 배지(03 §0-6) — 계측 뱃지는 주황을 지키고, 승인 등급은
                      별도로 선다. 핀을 빨갛게 칠하면 "실측이 대피 기준을 넘었다"로 오독된다 */}
                  {district.id === "seohang" && approvedResponseLevel && (
                    <span className="rounded-full border border-risk-lv5 px-2 py-0.5 text-caption font-medium text-risk-lv5">
                      {levelSpec(approvedResponseLevel).label} 대응중
                    </span>
                  )}
                  <LevelBadge level={view.level} value={`${view.value} ${event.unit}`} />
                </span>
              )}
            </div>
          </GlassPanel>

          {/* 지구 전환 — 시연은 지구를 옮겨 다니며 진행한다.
              DS FilterCapsule(토글 칩). 진행 중 이벤트가 있는 지구만 colorDot 으로 단계 색을
              달아, 어느 지구를 열지 고르는 자리에서 오늘 볼 곳이 먼저 눈에 든다 */}
          <GlassPanel className="pointer-events-auto">
            <div className="flex flex-wrap gap-1 px-2 py-1.5">
              {DISTRICTS.map((item) => {
                const itemEvent = activeEventOfAt(item.id, now);
                return (
                  <FilterCapsule
                    key={item.id}
                    selected={item.id === district.id}
                    colorDot={itemEvent ? levelSpec(eventViewAt(itemEvent, now).level).color : undefined}
                    onClick={() => navigate(`/scr-02/${item.id}`)}
                    className="shrink-0 px-2"
                  >
                    {item.name}
                  </FilterCapsule>
                );
              })}
            </div>
          </GlassPanel>
        </div>

        <div className="flex-1" />

        <Button
          className="pointer-events-auto shrink-0"
          onClick={() => navigate(`/scr-05/${district.id}`)}
          style={{ marginRight: RIGHT_RAIL + 12 }}
        >
          <Icon icon="mdi:cube-scan" className="size-4" aria-hidden />
          디지털트윈 분석
        </Button>
      </div>

      {/* 하단 — 표출 기준표 */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20">
        <GlassPanel className="pointer-events-auto">
          <DeviceLegend counts={counts} hidden={hiddenKinds} onToggle={toggleKind} />
        </GlassPanel>
      </div>

      {/* 우측 — 실시간 센서 · 월별 이벤트 · 풍향풍속
          레일은 스크롤하지 않는다 — 자리가 모자라면 센서 목록 패널만 줄어들며 자기
          본문에서 스크롤한다. 차트 두 개는 자연 높이를 지킨다 (SCR-01 과 동일) */}
      <div className={`${RAIL_BASE} right-3`} style={{ width: RIGHT_RAIL }}>
        <GlassPanel className="pointer-events-auto flex min-h-0 flex-col">
          <RealtimeSensorPanel
            sensors={sensors}
            selected={selected}
            onSelect={(device) => setSelectedId(device.id)}
          />
        </GlassPanel>
        <GlassPanel className="pointer-events-auto shrink-0">
          <MonthlyEventsPanel districtId={district.id} />
        </GlassPanel>
        <GlassPanel className="pointer-events-auto shrink-0">
          <WindPanel districtId={district.id} districtName={district.name} />
        </GlassPanel>
      </div>
    </div>
  );
}
