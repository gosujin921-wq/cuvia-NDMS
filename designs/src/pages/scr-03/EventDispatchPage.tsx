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
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { Button, GlassPanel } from "@ds";
import { DISTRICT_ZOOM } from "../../lib/map-config";
import { useMapLibre } from "../../lib/useMapLibre";
import { findDistrict } from "../../demo/districts";
import { EVENTS, eventViewAt } from "../../demo/events";
import { useScenario } from "../../state/ScenarioProvider";
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
  levelSpec,
} from "../../demo/levels";
import { assessRisk } from "../../demo/risk";
import { MapUtilStrip } from "../../components/MapUtilStrip";
import {
  CENTER_LEFT,
  CENTER_RIGHT,
  LEFT_RAIL,
  RAIL_BASE,
  RIGHT_RAIL,
  UTIL_STRIP,
} from "../../lib/layout";
import { CctvStrip } from "./widgets/CctvStrip";
import { DispatchHistory } from "./widgets/DispatchHistory";
import { DispatchPanel } from "./widgets/DispatchPanel";
import { EventList } from "./widgets/EventList";
import { EventMarkers } from "./widgets/EventMarkers";
import { RiskCard } from "./widgets/RiskCard";
import { SopPanel } from "./widgets/SopPanel";
import { ThresholdTable } from "./widgets/ThresholdTable";

/** 주인공 사건 — SOP 승인·실행의 무대 (04 §4-2) */
const HERO_EVENT_ID = "EVT-260812-006";

export function EventDispatchPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { now, advanceTo, approvedResponseLevel, approveResponseLevel } = useScenario();
  /* 트윈 [이 판단으로 대응하기]가 ?event= 로 그 사건을 지정해 온다 (02 §2) */
  const requested = params.get("event");
  const [selectedId, setSelectedId] = useState(
    () => (requested && EVENTS.some((e) => e.id === requested) ? requested : EVENTS[0].id),
  );
  const [history, setHistory] = useState<DispatchRecord[]>(DISPATCH_HISTORY);

  /* 상황대응 진입 = S5 (04 §0). 스텝은 단조라 이미 지난 뒤에는 아무 일도 없다 */
  useEffect(() => {
    advanceTo(5);
  }, [advanceTo]);

  const event = EVENTS.find((e) => e.id === selectedId) ?? EVENTS[0];
  const view = eventViewAt(event, now);
  const district = findDistrict(event.districtId);

  /* 위험도 판정(04 §10) — 주인공 사건만 시나리오·권고가 계측 위로 올라간다.
     SOP 와 문안은 승인 대응등급을 따르고, 승인 전에는 권고 기준의 제안 상태다 */
  const hero = event.id === HERO_EVENT_ID;
  const risk = assessRisk(event, now);
  const approved = hero ? approvedResponseLevel : null;
  const effectiveLevel = approved ?? risk.recommended;

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

  const handleDispatch = (channels: ChannelId[]) => {
    const spec = levelSpec(view.level);
    setHistory((prev) => [
      {
        id: `DSP-${event.id.slice(4)}-${prev.length + 1}`,
        /* 시나리오 시계의 스텝 시각을 쓴다. 실제 지금 시각을 넣으면 "4시간 전"처럼
           다른 기록과 앞뒤가 뒤집힌 상대 시간이 뜬다 (04 §0 · §7-3) */
        at: now.toISOString(),
        summary: `${district?.name} ${event.type} ${spec.label}`,
        channels,
        recipients: RECIPIENTS[event.districtId] ?? 0,
      },
      ...prev,
    ]);
  };

  /* SOP 실행이 곧 전파다(03 §3) — 완료되면 내역 맨 위에 쌓인다. 시각은 승인 시각(17:37) */
  const handleSopExecuted = () => {
    const spec = levelSpec(effectiveLevel);
    setHistory((prev) => [
      {
        id: `DSP-${event.id.slice(4)}-SOP`,
        at: "2026-08-12T17:37:00",
        summary: `${district?.name} ${event.type} ${spec.label}`,
        channels: ["sms", "broadcast", "sign"],
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
        <EventMarkers map={map} ready={ready} devices={visibleDevices} event={event} eventLevel={view.level} />
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
          <ThresholdTable event={event} view={view} threshold={threshold} scenario={risk.scenario} />
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

      {/* 우측 — 위험도 판정 · SOP · 상황전파 문안 · 전파 내역 · [상세 기록 보기] (03 §3).
          이벤트 발생 그래프는 내렸다 — 판정 카드가 같은 숫자를 더 짧게 말하고, 추이는
          [상세 기록 보기]가 잇는다. 블록이 다섯이라 레일이 본문에서 스크롤한다 */}
      <div
        className={`${RAIL_BASE} right-3 overflow-y-auto`}
        style={{ width: RIGHT_RAIL }}
      >
        <GlassPanel className="pointer-events-auto shrink-0">
          <RiskCard
            event={event}
            risk={risk}
            approved={approved}
            onApprove={hero && view.active ? approveResponseLevel : undefined}
          />
        </GlassPanel>

        {/* SOP 는 주인공 사건에서만 상호작용한다 — 엔진의 실행 상태가 이 사건 것이다 */}
        {hero && view.active && (
          <GlassPanel className="pointer-events-auto shrink-0">
            <SopPanel
              level={effectiveLevel}
              approved={approved !== null}
              onExecuted={handleSopExecuted}
            />
          </GlassPanel>
        )}

        <GlassPanel className="pointer-events-auto shrink-0">
          <DispatchPanel
            event={event}
            effectiveLevel={effectiveLevel}
            scenario={risk.scenario}
            onDispatch={handleDispatch}
          />
        </GlassPanel>

        <GlassPanel className="pointer-events-auto flex min-h-0 flex-col">
          <DispatchHistory records={history} />
        </GlassPanel>

        {/* S7 → S8 — 그 지구·그 사건 기간이 선택된 채 통계·분석이 열린다 (02 §2) */}
        <Button
          variant="outline"
          className="pointer-events-auto w-full shrink-0"
          onClick={() => navigate(`/scr-04?district=${event.districtId}`)}
        >
          <Icon icon="mdi:chart-line" className="size-4" aria-hidden />
          상세 기록 보기
        </Button>
      </div>
    </div>
  );
}
