/* ─────────────────────────────────────────────
 * SCR-03 이벤트·상황전파 — 정본: docs/정본/03_화면정의서.md §3
 *
 * 데모에서 가장 중요한 화면이다. 위험 신호가 잡힌 지구를 모아 보고, 판단하고, 그 자리에서
 * 전파하고, 보낸 기록을 남긴다.
 *
 * 첫 진입에 최신 이벤트가 선택된 상태로 연다. 아무것도 선택되지 않은 빈 화면으로 시작하면
 * 시연자가 먼저 카드를 눌러야 하고, 그 사이 화면이 무엇을 하는 자리인지 보이지 않는다.
 * ───────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { GlassPanel } from "@ds";
import { DISTRICT_ZOOM } from "../../lib/map-config";
import { useMapLibre } from "../../lib/useMapLibre";
import { findDistrict } from "../../demo/districts";
import { DEMO_NOW, EVENTS } from "../../demo/events";
import { DEVICE_KINDS, devicesOf, type DeviceKind } from "../../demo/devices";
import {
  DISPATCH_HISTORY,
  RECIPIENTS,
  type ChannelId,
  type DispatchRecord,
} from "../../demo/dispatch";
import {
  DISPLACEMENT_THRESHOLD,
  RAIN_THRESHOLD,
  WATER_THRESHOLDS,
  ALERT_LEVELS,
  levelSpec,
} from "../../demo/levels";
import { sensorSeries } from "../../demo/measurements";
import { findDevice } from "../../demo/devices";
import { TrendChart } from "../../components/TrendChart";
import { MapUtilStrip } from "../../components/MapUtilStrip";
import {
  CENTER_LEFT,
  CENTER_RIGHT,
  LEFT_RAIL,
  RAIL_BASE,
  RIGHT_RAIL,
  UTIL_STRIP,
} from "../../lib/layout";
import { formatClock } from "../../lib/datetime";
import { CctvStrip } from "./widgets/CctvStrip";
import { DispatchHistory } from "./widgets/DispatchHistory";
import { DispatchPanel } from "./widgets/DispatchPanel";
import { EventList } from "./widgets/EventList";
import { EventMarkers } from "./widgets/EventMarkers";
import { ThresholdTable } from "./widgets/ThresholdTable";

export function EventDispatchPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState(EVENTS[0].id);
  const [history, setHistory] = useState<DispatchRecord[]>(DISPATCH_HISTORY);

  const event = EVENTS.find((e) => e.id === selectedId) ?? EVENTS[0];
  const district = findDistrict(event.districtId);

  const { map, ready } = useMapLibre(mapContainer, {
    center: district?.center,
    zoom: DISTRICT_ZOOM,
  });

  const devices = useMemo(() => devicesOf(event.districtId), [event.districtId]);
  const cameras = devices.filter((d) => d.kind === "CV");

  /* 지도에서 내려 둔 장비 종류. CCTV 스트립은 레이어와 무관하게 전체 카메라를 쓴다 —
     지도에서 핀을 내렸다고 현장 영상까지 사라지면 판단할 거리가 없어진다 */
  const [hiddenKinds, setHiddenKinds] = useState<DeviceKind[]>([]);
  /* 이벤트를 낸 장비는 이 화면의 주제라 종류를 꺼도 자리에 남는다 */
  const visibleDevices = devices.filter(
    (d) => d.id === event.deviceId || !hiddenKinds.includes(d.kind),
  );
  const counts = useMemo(() => {
    const acc = {} as Record<DeviceKind, number>;
    for (const item of devices) acc[item.kind] = (acc[item.kind] ?? 0) + 1;
    return acc;
  }, [devices]);

  /* 지구를 여는 자리 — 카드 전환·"원래대로"가 모두 여기로 온다 */
  const focusDistrict = useCallback(
    (duration: number) => {
      const instance = map.current;
      if (!instance || !district) return;
      instance.easeTo({
        center: district.center,
        zoom: DISTRICT_ZOOM,
        /* 아래 여백은 CCTV 패널이 가리는 높이 — 타일이 커지면서 같이 늘었다.
           이만큼 비워야 장비 마커가 패널 뒤로 숨지 않는다 */
        padding: { top: 0, bottom: 200, left: CENTER_LEFT, right: CENTER_RIGHT },
        pitch: 0,
        bearing: 0,
        duration,
      });
    },
    [map, district],
  );

  /* 카드를 바꾸면 지도가 그 지구로 날아간다 */
  useEffect(() => {
    if (!ready) return;
    focusDistrict(700);
  }, [ready, focusDistrict]);

  const threshold =
    event.type === "수위"
      ? WATER_THRESHOLDS[event.districtId]
      : event.type === "강우"
        ? RAIN_THRESHOLD
        : DISPLACEMENT_THRESHOLD;

  const device = findDevice(event.deviceId);
  /* 발생 전 6시간부터 현재까지. 해제된 이벤트도 같은 방식으로 그린다 */
  const series = device ? sensorSeries(device) : [];
  const thresholdLines = ALERT_LEVELS.map((level) => ({
    value: threshold[level.id],
    color: level.color,
    label: level.label,
  }));

  const handleDispatch = (channels: ChannelId[]) => {
    const spec = levelSpec(event.level);
    setHistory((prev) => [
      {
        id: `DSP-${event.id.slice(4)}-${prev.length + 1}`,
        /* 시연 기준 시각을 쓴다. 실제 지금 시각을 넣으면 "4시간 전"처럼 다른 기록과
           앞뒤가 뒤집힌 상대 시간이 뜬다 (04 §0) */
        at: DEMO_NOW.toISOString(),
        summary: `${district?.name} ${event.type} ${spec.label}`,
        channels,
        recipients: RECIPIENTS[event.districtId] ?? 0,
      },
      ...prev,
    ]);
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* 지도 — 배경 */}
      <div
        className="absolute inset-0 z-0 overflow-hidden bg-surface"
        style={{ isolation: "isolate" }}
        aria-label={`${district?.name} 지도`}
      >
        <div ref={mapContainer} className="h-full w-full" />
        <EventMarkers map={map} ready={ready} devices={visibleDevices} event={event} />
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
          layers={{
            title: "장비",
            items: DEVICE_KINDS.filter((spec) => (counts[spec.kind] ?? 0) > 0).map((spec) => ({
              id: spec.kind,
              label: spec.label,
              color: spec.color,
              icon: spec.icon,
              count: counts[spec.kind],
              visible: !hiddenKinds.includes(spec.kind),
            })),
            onToggle: (id) =>
              setHiddenKinds((prev) =>
                prev.includes(id as DeviceKind)
                  ? prev.filter((kind) => kind !== id)
                  : [...prev, id as DeviceKind],
              ),
            onSetAll: (visible) =>
              setHiddenKinds(
                visible
                  ? []
                  : DEVICE_KINDS.filter((s) => (counts[s.kind] ?? 0) > 0).map((s) => s.kind),
              ),
            note: "이벤트를 낸 장비 핀은 항상 표시된다",
          }}
        />
      </div>

      {/* 좌측 — 이벤트 목록 + 발령 기준표 */}
      <div className={`${RAIL_BASE} left-3`} style={{ width: LEFT_RAIL }}>
        <GlassPanel className="pointer-events-auto flex min-h-0 flex-1 flex-col">
          {/* 건수는 헤더에 적지 않는다 — 상태 탭이 탭마다 건수를 이미 들고 있다(KISA 문법) */}
          <header className="flex shrink-0 items-baseline justify-between gap-2 px-3 pb-1 pt-2.5">
            <h1 className="text-body font-semibold text-foreground">이벤트 현황</h1>
            <span className="text-caption text-foreground-subtle">전체 {EVENTS.length}건</span>
          </header>
          <EventList
            events={EVENTS}
            selectedId={event.id}
            onSelect={(next) => setSelectedId(next.id)}
          />
        </GlassPanel>

        <GlassPanel className="pointer-events-auto shrink-0">
          <ThresholdTable event={event} threshold={threshold} />
        </GlassPanel>
      </div>

      {/* 중앙 하단 — 현장 CCTV 4분할 */}
      <div
        className="pointer-events-none absolute bottom-3 z-20"
        style={{ left: CENTER_LEFT, right: CENTER_RIGHT }}
      >
        {/* 가운데 영역 전폭을 쓴다 — KISA CCTV 미리보기와 같은 자리·같은 폭.
            폭을 좁혀 가운데 정렬하면 타일이 200px 아래로 내려가 현장이 안 보인다 */}
        <GlassPanel className="pointer-events-auto w-full">
          <CctvStrip cameras={cameras} />
        </GlassPanel>
      </div>

      {/* 우측 — 발생 그래프 · 상황전파 · 전파 내역
          레일은 스크롤하지 않는다 — 전파가 쌓여 자리가 모자라면 전파 내역 패널만
          줄어들며 자기 본문에서 스크롤한다. 그래프와 전파 버튼은 항상 같은 자리에
          있어야 하므로 자연 높이를 지킨다. 레일째 스크롤하면 내역을 훑는 사이
          전파 버튼이 화면 밖으로 나간다 */}
      <div className={`${RAIL_BASE} right-3`} style={{ width: RIGHT_RAIL }}>
        <GlassPanel className="pointer-events-auto shrink-0">
          <section className="flex flex-col gap-2 p-3" aria-label="이벤트 발생 그래프">
            <header className="flex items-baseline justify-between gap-2">
              <h2 className="text-body font-semibold text-foreground">이벤트 발생 그래프</h2>
              <span className="truncate text-caption text-foreground-subtle">
                {formatClock(event.raisedAt)} 발생
              </span>
            </header>
            <TrendChart
              samples={series}
              thresholds={thresholdLines}
              height={110}
              unit={event.unit}
              ariaLabel={`${event.device} 발생 전후 추이`}
            />
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-h5 font-semibold text-foreground">{event.value}</span>
              <span className="text-caption text-foreground-muted">{event.unit}</span>
              <span
                className="ml-auto shrink-0 text-caption font-medium"
                style={{ color: levelSpec(event.level).color }}
              >
                {levelSpec(event.level).label} 기준 {threshold[event.level]} {event.unit}
              </span>
            </div>
          </section>
        </GlassPanel>

        <GlassPanel className="pointer-events-auto shrink-0">
          <DispatchPanel event={event} onDispatch={handleDispatch} />
        </GlassPanel>

        <GlassPanel className="pointer-events-auto flex min-h-0 flex-col">
          <DispatchHistory records={history} />
        </GlassPanel>
      </div>
    </div>
  );
}
