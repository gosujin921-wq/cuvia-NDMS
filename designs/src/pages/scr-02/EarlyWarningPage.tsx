/* ─────────────────────────────────────────────
 * SCR-02 조기경보 — 배경: docs/레거시/정본/03_화면정의서.md §2
 *
 * 지구 하나로 좁혀 장비와 계측값을 본다. 숫자(센서 팝업)와 영상(CCTV 팝업)을 같은 지도
 * 위에서 이중 확인하는 자리다.
 *
 * 지구는 경로(/scr-02/:districtId)로 받는다. 대시보드에서 고른 지구가 그대로 열리고,
 * 메뉴로 직접 들어오면 진행 중 이벤트가 있는 지구부터 연다.
 * ───────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { Button, GlassPanel, Tag, cn } from "@ds";
import { DISTRICT_ZOOM } from "../../lib/map-config";
import { useMapLibre } from "../../lib/useMapLibre";
import { DISTRICTS, findDistrict, type District } from "../../demo/districts";
import {
  HERO_EVENT_ID,
  activeEventsAt,
  eventViewAt,
  hazardLabel,
  watchedEventOfAt,
} from "../../demo/events";
import { useScenario } from "../../state/ScenarioProvider";
import { useAnalysisReview } from "../../state/analysis-results";
import { useWindLayer } from "../../lib/useWindLayer";
import { useTemperatureLayer } from "../../lib/useTemperatureLayer";
import { usePrecipitationLayer } from "../../lib/usePrecipitationLayer";
import {
  isWeatherKey,
  weatherLayerItems,
  WEATHER_OFF,
  type WeatherState,
} from "../../lib/weather-layers";
import { levelSpec } from "../../demo/levels";
import { assessRisk } from "../../demo/risk";
import { processStateAt } from "../../demo/sop";
import {
  RECIPIENTS,
  channelsFromSopItems,
  draftMessage,
  type ChannelId,
} from "../../demo/dispatch";
import {
  DEVICE_KINDS,
  devicesOf,
  featuredCctvOf,
  findDevice,
  type Device,
  type DeviceKind,
} from "../../demo/devices";
import {
  FACILITY_KINDS,
  facilitiesOf,
  type FacilityKind,
} from "../../demo/facilities";
import { SAFEMAP_LAYERS, ensureSafemapLayers, setSafemapVisible } from "../../lib/safemap";
import { MapPopup } from "../../components/MapPopup";
import { MapUtilStrip } from "../../components/MapUtilStrip";
import { CCTV_DOCK, CENTER_RIGHT, EDGE, RAIL_BASE, RIGHT_RAIL, UTIL_STRIP } from "../../lib/layout";
import { LevelBadge } from "../../components/LevelBadge";
import { formatClock } from "../../lib/datetime";
import { DeviceMarkers } from "./widgets/DeviceMarkers";
import { FacilityMarkers } from "./widgets/FacilityMarkers";
import { DevicePopup } from "./widgets/DevicePopup";
import { CrossCheckPanel } from "./widgets/CrossCheckPanel";
import { CctvDock } from "./widgets/CctvDock";
import { TrendPanel } from "./widgets/TrendPanel";
import { RiskCard } from "./widgets/RiskCard";
import { ImpactPanel } from "./widgets/ImpactPanel";
import { RespondPanel } from "./widgets/RespondPanel";
import { EventTimeline } from "./widgets/EventTimeline";
import { ExecutionPopup } from "./widgets/ExecutionPopup";
import { dismissAlarmsOf } from "../../lib/alarm-toast";

/** 좌측 열 폭 (px) — 머리말·상황 근거. 지도 중심 맞춤의 왼쪽 여백이 따른다 */
const LEFT_COL = 420;

/** 진행 중 이벤트가 있는 지구 우선. 없으면 첫 지구 */
function defaultDistrict(now: Date): District {
  const active = activeEventsAt(now)[0];
  return (active && findDistrict(active.districtId)) ?? DISTRICTS[0];
}

export function EarlyWarningPage() {
  const navigate = useNavigate();
  const { districtId } = useParams();
  const [params] = useSearchParams();
  const {
    track,
    now,
    step,
    advanceTo,
    heroDistrictId,
    markStageReady,
    approvedResponseLevel,
    approvedAt,
    dispatches,
    addDispatch,
    sopExecuted,
    selectDevice,
  } = useScenario();
  const district = (districtId && findDistrict(districtId)) || defaultDistrict(now);
  /* 사건 지정 진입 (02 §2) — 트윈 [이 판단으로 대응하기]·구 /scr-03 리다이렉트가 싣는다 */
  const requestedEvent = params.get("event");

  const mapContainer = useRef<HTMLDivElement>(null);
  const { map, ready } = useMapLibre(mapContainer, {
    center: district.center,
    zoom: DISTRICT_ZOOM,
  });

  const [hiddenKinds, setHiddenKinds] = useState<DeviceKind[]>([]);
  /* 방재시설(배수문·배수펌프장)은 계측 장비와 다른 축이라 토글도 따로 든다 —
     장비를 다 끄면 시설까지 사라지는 일이 없다 */
  const [hiddenFacilityKinds, setHiddenFacilityKinds] = useState<FacilityKind[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* 위험요소 — 행안부 생활안전지도 WMS(해안침수예상도·침수흔적도). 시연용 도형이 아니라
     기관이 고시한 실 자료다(lib/safemap.ts · 외부-API-인계 §4). 장비 토글과 별도 그룹이다
     (03 §2) — 장비는 "무엇이 설치돼 있나", 위험요소는 "왜 위험지구인가"를 말하는 다른 층이다.
     기본 켜짐 — 이 지구가 왜 위험한지는 사람이 켜기 전에 지도가 먼저 말해야 한다 */
  const [safemapOn, setSafemapOn] = useState<Record<string, boolean>>(
    Object.fromEntries(SAFEMAP_LAYERS.map((spec) => [spec.id, true])),
  );
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    ensureSafemapLayers(instance);
    for (const spec of SAFEMAP_LAYERS) {
      setSafemapVisible(instance, spec.id, safemapOn[spec.id] ?? true);
    }
  }, [map, ready, safemapOn]);

  const devices = useMemo(() => devicesOf(district.id), [district.id]);
  /* 하단 현장영상의 카메라 — 장면 등재분 우선, 없으면 앞 2대 (04 §2-5) */
  const featuredCctvs = useMemo(() => featuredCctvOf(district.id), [district.id]);
  const visibleDevices = devices.filter((d) => !hiddenKinds.includes(d.kind));
  const sensors = devices.filter(
    (d) => d.kind === "WL" || d.kind === "RN" || d.kind === "DP" || d.kind === "TD",
  );
  const selected = devices.find((d) => d.id === selectedId) ?? null;

  const counts = useMemo(() => {
    const acc = { WL: 0, RN: 0, DP: 0, CV: 0, BC: 0, TD: 0 } as Record<DeviceKind, number>;
    for (const device of devices) acc[device.kind] += 1;
    return acc;
  }, [devices]);

  /* 방재시설 — 등재된 지구에서만 선다(지금은 봉암). 없으면 레이어 묶음도 서지 않는다:
     켤 수 없는 토글을 만들지 않는다(04 §9 원칙) */
  const facilities = useMemo(() => facilitiesOf(district.id), [district.id]);
  const facilityKinds = FACILITY_KINDS.filter((spec) =>
    facilities.some((f) => f.kind === spec.kind),
  );
  const visibleFacilities = facilities.filter((f) => !hiddenFacilityKinds.includes(f.kind));

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
        /* 하단 독·좌측 열·우측 레일이 지도를 가리므로 그만큼 여백을 준다 */
        padding: {
          top: 0,
          bottom: CCTV_DOCK + EDGE,
          left: LEFT_COL + EDGE * 2,
          right: CENTER_RIGHT,
        },
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

  /* 패널(현재 사건·계측 추이·현장영상)에서 고른 장비 — 지도도 그 장비로 끌어온다.
     가장자리 핀은 팝업이 잘리므로, 핀을 하단 독 바로 위로 데려온다. 팝업은 핀 위로
     서니(MapPopup anchor bottom) 그 자리가 팝업에 세로 공간을 가장 넓게 준다 */
  const focusDevice = useCallback(
    (device: Device) => {
      setSelectedId(device.id);
      const instance = map.current;
      if (!instance || !ready) return;
      const el = instance.getContainer();
      /* 좌측 열과 우측 레일 사이의 가운데 — 어느 쪽 패널 밑으로도 팝업이 파고들지 않는다 */
      const target = {
        x: (LEFT_COL + EDGE * 2 + (el.clientWidth - CENTER_RIGHT)) / 2,
        y: el.clientHeight - (CCTV_DOCK + EDGE * 2) - 32,
      };
      const pt = instance.project(device.center);
      instance.panBy([pt.x - target.x, pt.y - target.y], { duration: 500 });
    },
    [map, ready],
  );

  /* ── 시나리오 스텝 트리거 (04 §0) — 조작이 스텝을 올린다 ──
     서항을 열면 S1. 주인공 수위계 팝업을 열면 S2 이고, 엔진이 여기에 격상 타이머를
     얹는다(04 §0). 서항 CCTV 팝업을 열면 S3. 스텝은 단조라 곁가지에는 흔들리지 않는다 */
  useEffect(() => {
    if (track === "seohang" && district.id === "seohang") advanceTo(1);
    if (track === "bongam" && district.id === "bongam") advanceTo(1);
  }, [track, district.id, advanceTo, step]);

  /* 봉암은 이 화면이 격상의 무대다 (04 §15-1) — 지도가 앉았다고 엔진에 알리면 거기서부터
     2초를 센다. 스텝 도착에서 바로 재면 타일이 들어오는 사이에 격상이 지나가, 정작
     목격해야 할 사람은 이미 경보가 된 화면을 본다.
     step 을 함께 보는 것은 되감기(같은 트랙 재발사) 때문이다 — 이 화면에 선 채로 다시
     쏘면 지도는 이미 앉아 있어 ready 가 다시 바뀌지 않는다. 무대를 기다리지 않는
     트랙(서항)에서는 엔진이 이 신호를 흘려보낸다 */
  useEffect(() => {
    if (ready && district.id === heroDistrictId) markStageReady();
  }, [ready, district.id, heroDistrictId, markStageReady, step]);

  /* 이 지구를 보러 들어왔다 — 쌓여 있던 그 지구 알람은 제 할 일을 마쳤다. 화면 위를
     덮은 채로 두지 않는다. 들어선 뒤에 들어오는 알람(격상)은 새 소식이라 그대로 뜬다 */
  useEffect(() => {
    dismissAlarmsOf(district.id);
  }, [district.id]);
  useEffect(() => {
    if (!selected) return;
    if (track === "seohang") {
      if (selected.id === "seohang-WL-001") advanceTo(2);
      else if (selected.districtId === "seohang" && selected.kind === "CV") advanceTo(3);
    } else {
      /* 트랙 B (04 §15-2) — 강우량계 팝업이 B2, 배수문 CCTV 팝업이 B3(격상 발사 자리) */
      if (selected.id === "bongam-RN-001") advanceTo(2);
      else if (selected.districtId === "bongam" && selected.kind === "CV") advanceTo(3);
    }
  }, [track, selected, advanceTo]);

  /* 선택 장비는 엔진이 든다(03 §5 · 차수 K) — 트윈이 같은 핀을 강조하려면 화면을
     옮겨도 선택이 살아 있어야 한다. 팝업을 닫으면 선택도 걷는다 */
  useEffect(() => {
    selectDevice(selectedId);
  }, [selectedId, selectDevice]);

  /* 이 화면이 보는 사건 — 지도 핀·캡슐·판정·이력이 전부 같은 사건을 봐야 격상이 한
     장면이 된다. 대표 사건(최고 단계)이 아니라 대본 사건이다(watchedEventOfAt) */
  const event = watchedEventOfAt(district.id, now);
  const view = event ? eventViewAt(event, now) : null;

  /* 트윈 진입 — 선택 장비를 URL 에도 싣는다(트윈 새로고침·딥링크의 보조 복구 · 03 §5) */
  const openTwin = () =>
    navigate(selectedId ? `/scr-05/${district.id}?device=${selectedId}` : `/scr-05/${district.id}`);

  /* ── 대응 국면 (03 §2 · 차수 N) — 판정은 레일이 보이고, 승인·실행은 집중 팝업이 든다 ── */
  /* 주인공 사건은 트랙별이다 (04 §15-3). 서항 트랙은 해일 사건 하나, 봉암 트랙은
     봉암 대표 사건([이 사건 대응하기]·집중 팝업·승인의 무대). 서항 id 하드 게이트에
     묶으면 트랙 B 사건이 대응 없는 구경거리가 된다 */
  const hero =
    track === "bongam" ? event?.districtId === "bongam" : event?.id === HERO_EVENT_ID;
  const risk = event ? assessRisk(event, now) : null;
  /* 트윈이 이 사건에 남긴 검토 기록 — 영향 카드의 '검토 완료'와 대응 절차의
     권장 문구가 같은 출처를 본다(02 §2) */
  const twinReview = useAnalysisReview(event?.id);

  /* 기상 격자 — 트윈과 같은 자료·같은 항목(lib/weather-layers.ts)이되 **꺼진 채로 연다.**
     이 화면에서 지도를 열면 켜져 있어야 하는 것은 침수 주제도 둘이고, 비·바람 색면을
     깔면 짚어야 할 장비 핀이 묻힌다. 켜면 그 시각의 비로 칠한다 */
  const [weather, setWeather] = useState<WeatherState>(WEATHER_OFF);
  useWindLayer(map, ready, weather.wind);
  useTemperatureLayer(map, ready, weather.temp);
  usePrecipitationLayer(map, ready, weather.rain, now.getHours());
  const approved = hero ? approvedResponseLevel : null;
  const effectiveLevel = risk ? (approved ?? risk.recommended) : null;
  /* 판정할 거리 — 시나리오·승인이 생긴 뒤 (03 §위험도 판정 등장 조건). 대응 절차 카드와
     마커 팝업 [이 사건 대응하기]가 같은 게이트를 쓴다 */
  const judged = risk !== null && (risk.scenario !== null || approved !== null);

  /* 사건 지정 진입 = S5 (04 §0 · 05 S4→S5). 스텝은 단조라 지난 뒤에는 아무 일도 없다 */
  useEffect(() => {
    if (requestedEvent && event && requestedEvent === event.id) advanceTo(5);
  }, [requestedEvent, event, advanceTo]);

  /* 집중 팝업 — 열림 상태만 화면이 들고 나머지는 전부 엔진 소유다(03 §2).
     닫힌 뒤 포커스는 [대응 실행]으로 복귀한다(수용 기준) */
  const [executionOpen, setExecutionOpen] = useState(false);
  const executeButtonRef = useRef<HTMLButtonElement>(null);

  /* 전파 문안 — 자동 작성본을 담당자가 고칠 수 있다(04 §7-2). 팝업을 닫아도 유지돼야
     해서(수용 기준) 팝업이 아니라 페이지가 든다. 사건·등급·시나리오가 바뀌면 다시 쓴다 */
  const draft = useMemo(
    () =>
      event && effectiveLevel
        ? draftMessage(event, now, { effectiveLevel, scenario: risk?.scenario ?? null })
        : "",
    [event, now, effectiveLevel, risk?.scenario],
  );
  const [message, setMessage] = useState(draft);
  useEffect(() => setMessage(draft), [draft]);

  /* SOP 실행이 곧 전파다(03 §2). 수단은 승인·실행된 항목에서 파생하고(04 §7-5),
     시각은 승인 시각이다. 전파 성격 항목이 하나도 없으면 기록을 만들지 않는다 */
  const handleSopExecuted = (itemIds: string[]) => {
    if (!event || !effectiveLevel) return;
    const channels = channelsFromSopItems(itemIds, effectiveLevel);
    if (channels.length === 0) return;
    addDispatch({
      id: `DSP-${event.id.slice(4)}-SOP`,
      eventId: event.id,
      dispatchKind: "sop",
      responseLevel: effectiveLevel,
      sentAt: (approvedAt ?? now).toISOString(),
      summary: `${district.name} ${event.type} ${levelSpec(effectiveLevel).label}`,
      channels,
      message,
      recipients: RECIPIENTS[event.districtId] ?? 0,
      recordedBy: "시스템",
    });
  };

  /* 수정 문안 재전파 — 실행 결과 하단에서 온다(03 §2 · 차수 L). 재전파라
     durationMin(발생→최초 전파 소요)은 없다. 시각은 시나리오 시계의 스텝 시각(04 §0) */
  const handleResend = (channels: ChannelId[], sentMessage: string) => {
    if (!event || !effectiveLevel) return;
    addDispatch({
      id: `DSP-${event.id.slice(4)}-${dispatches.length + 1}`,
      eventId: event.id,
      dispatchKind: "manual-resend",
      responseLevel: effectiveLevel,
      sentAt: now.toISOString(),
      summary: `${district.name} ${event.type} ${levelSpec(effectiveLevel).label}`,
      channels,
      message: sentMessage,
      recipients: RECIPIENTS[event.districtId] ?? 0,
      recordedBy: "상황실 담당",
    });
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        className="absolute inset-0 z-0 overflow-hidden bg-surface"
        style={{ isolation: "isolate" }}
        aria-label={`${district.name} 지도`}
      >
        <div ref={mapContainer} className="h-full w-full" />
        <DeviceMarkers
          map={map}
          ready={ready}
          devices={visibleDevices}
          selectedId={selectedId}
          onSelect={(device) => setSelectedId(device.id)}
        />
        {/* 시설 피커의 [현장 영상] — 장비 목록·사건 캡슐이 쓰는 것과 같은 길이다.
            핀을 화면 가운데로 데려오고 그 자리에 CCTV 팝업을 연다 */}
        <FacilityMarkers
          map={map}
          ready={ready}
          facilities={visibleFacilities}
          onOpenCctv={focusDevice}
        />
        {selected && (
          <MapPopup
            map={map}
            lngLat={selected.center}
            onClose={() => setSelectedId(null)}
            offset={24}
          >
            <DevicePopup
              device={selected}
              onClose={() => setSelectedId(null)}
              /* 집중 팝업을 열 때 마커 팝업은 닫는다 — 오버레이 뒤에 열린 팝업이 남아
                 있으면 닫힌 뒤 조작면이 둘로 보인다. 판정·검토 게이트에 물리지 않는다 —
                 긴급 대응은 격상·트윈을 기다리지 않는다(03 §2 판단·대응) */
              onRespond={
                hero && view?.active
                  ? () => {
                      setSelectedId(null);
                      setExecutionOpen(true);
                    }
                  : undefined
              }
            />
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
                /* 장치 핀 문법 그대로 — 원형 글라스 칩 (03 §0-5 · IDC 선례) */
                shape: "device" as const,
                count: counts[spec.kind],
                visible: !hiddenKinds.includes(spec.kind),
              })),
              onToggle: (id) => toggleKind(id as DeviceKind),
              onSetAll: (visible) =>
                setHiddenKinds(
                  visible ? [] : DEVICE_KINDS.filter((s) => counts[s.kind] > 0).map((s) => s.kind),
                ),
            },
            /* 방재시설 — 계측 장비와 다른 축이다. 장비는 값을 재고 이쪽은 물을 막고
               퍼낸다. 등재된 지구(봉암)에서만 이 묶음이 선다 */
            ...(facilityKinds.length > 0
              ? [
                  {
                    title: "방재시설",
                    items: facilityKinds.map((spec) => ({
                      id: spec.kind,
                      label: spec.label,
                      color: spec.color,
                      icon: spec.icon,
                      /* 장치 핀과 같은 원형 글라스 칩 — 지도에 그린 문법 그대로 */
                      shape: "device" as const,
                      count: facilities.filter((f) => f.kind === spec.kind).length,
                      visible: !hiddenFacilityKinds.includes(spec.kind),
                    })),
                    onToggle: (id: string) =>
                      setHiddenFacilityKinds((prev) =>
                        prev.includes(id as FacilityKind)
                          ? prev.filter((k) => k !== id)
                          : [...prev, id as FacilityKind],
                      ),
                    onSetAll: (visible: boolean) =>
                      setHiddenFacilityKinds(visible ? [] : facilityKinds.map((s) => s.kind)),
                    note: "폐쇄·가동은 운영 로그다 — 센서가 감지한 사건이 아니다",
                  },
                ]
              : []),
            /* 영향 표현 — 트윈(03 §5)과 같은 묶음 이름·같은 기상 항목을 쓴다.
               침수예상도·흔적도는 "이 지역이 어디까지 잠기나"를 말하는 표현이지 위험요소
               목록이 아니고, 그 뒤에 붙는 강수·기온·바람은 그 침수를 만든 조건이다.
               같은 레이어가 화면마다 다른 묶음 이름으로 서면 같은 앱으로 안 읽힌다 */
            {
              title: "영향 표현",
              items: [
                ...SAFEMAP_LAYERS.map((spec) => ({
                  id: spec.id,
                  label: spec.label,
                  color: spec.color,
                  icon: spec.icon,
                  /* 래스터 주제도라 면(面) 표식 — 지도에 덮이는 모양 그대로 */
                  shape: "area" as const,
                  visible: safemapOn[spec.id] ?? true,
                })),
                ...weatherLayerItems(weather),
              ],
              onToggle: (id: string) =>
                isWeatherKey(id)
                  ? setWeather((prev) => ({ ...prev, [id]: !prev[id] }))
                  : setSafemapOn((prev) => ({ ...prev, [id]: !(prev[id] ?? true) })),
              onSetAll: (visible: boolean) => {
                setSafemapOn(Object.fromEntries(SAFEMAP_LAYERS.map((s) => [s.id, visible])));
                setWeather({ rain: visible, temp: visible, wind: visible });
              },
            },
          ]}
        />
      </div>

      {/* 상단 중앙 — 사건 캡슐 (03 §2). SCR-01 상태 스트립과 같은 자리 문법. 진행 사건의
          신원(재난유형·처리상태·단계 뱃지·발생/격상·탐지 장비)을 화면에서 한 번만 말한다.
          격상(S2)에 바뀌는 값(뱃지·격상 시각)이 전부 여기라, 격상 순간 캡슐만 통째로 변한다 */}
      {event && view && (
        <div
          className="pointer-events-none absolute top-3 z-30 flex justify-center"
          style={{ left: LEFT_COL + EDGE * 2, right: CENTER_RIGHT }}
        >
          {/* SCR-01 상태 스트립과 같은 캡슐 문법 — borderStyle none · rounded-full · px-5 py-2 */}
          <GlassPanel
            borderStyle="none"
            className="pointer-events-auto flex items-center gap-4 rounded-full px-5 py-2"
            aria-label="진행 사건"
          >
            <span className="shrink-0 text-body font-bold tracking-tight text-foreground">
              {hazardLabel(event.hazardType)}
            </span>
            <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-caption text-foreground-muted">
              {processStateAt(event, now, approvedResponseLevel)}
            </span>
            {/* 승인 대응등급 배지(03 §0-6). 계측 뱃지는 계측 단계 색을 지키고 승인
                등급은 별도로 선다 — 빨갛게 칠하면 "실측이 대피 기준을 넘었다"로 오독 */}
            {district.id === "seohang" && approvedResponseLevel && (
              <span className="shrink-0 rounded-full border border-risk-lv5 px-2 py-0.5 text-caption font-medium text-risk-lv5">
                {levelSpec(approvedResponseLevel).label} 대응중
              </span>
            )}
            <LevelBadge
              level={view.level}
              value={`${view.value} ${event.unit}`}
              className="px-2.5"
            />
            <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
            <span className="flex items-center gap-1 text-caption text-foreground-muted">
              <span className="font-mono">{formatClock(new Date(event.raisedAt))} 발생</span>
              {view.escalated && (
                <>
                  <span aria-hidden>·</span>
                  <span className="font-mono" style={{ color: levelSpec(view.level).color }}>
                    {formatClock(new Date(view.stageAt))} 격상
                  </span>
                </>
              )}
              <span aria-hidden>·</span>
              {/* 탐지 클릭 = 센서 선택 — 지도 핀·좌측 목록과 같은 선택 (03 §2 동작) */}
              <button
                type="button"
                onClick={() => {
                  const detector = findDevice(event.deviceId);
                  if (detector) focusDevice(detector);
                }}
                className="cursor-pointer truncate border-none bg-transparent p-0 text-caption text-primary-text underline-offset-2 hover:underline"
              >
                {event.device} 탐지
              </button>
            </span>
          </GlassPanel>
        </div>
      )}

      {/* 좌측 열 — 지구 머리말 · 상황 근거(계측 추이 → 현장 교차검증) (03 §2).
          근거는 좌측, 결정은 우측 — 한 레일에 몰면 높이를 넘는다.
          자리가 모자라면 교차검증 패널만 자기 본문에서 스크롤한다 */}
      <div className={`${RAIL_BASE} left-3`} style={{ width: LEFT_COL }}>
        {/* 지구 머리말 — 정적 신원(지구명·지구 유형·관측 대상·장비 대수)과 종합상황으로
            돌아가는 길만. 진행 사건은 상단 중앙 사건 캡슐 몫이다(03 §2) — 지구 유형(시설 축)과
            재난유형(현상 축)은 다른 축이라 자리를 가른다(04 §4-0) */}
        <GlassPanel className="pointer-events-auto shrink-0">
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
                <Tag className="shrink-0">{district.kind} 지구</Tag>
              </div>
              <span className="truncate text-caption text-foreground-muted">
                {district.target} · 장비 {devices.length}대
              </span>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="pointer-events-auto shrink-0">
          <TrendPanel
            sensors={sensors}
            districtName={district.name}
            selected={selected}
            onSelect={focusDevice}
          />
        </GlassPanel>
        {/* 좌측 열에서 남는 높이를 이 패널이 받는다 — 근거 카드가 화면 높이에 맞춰
            벌어지고, 스크롤바가 붙었다 떨어지며 흔들리는 일이 없다 */}
        <GlassPanel className="pointer-events-auto flex min-h-0 flex-1 flex-col">
          <CrossCheckPanel district={district} devices={devices} />
        </GlassPanel>
      </div>

      {/* 하단 중앙 — 현장영상 (03 §2 · 04 §2-5). SCR-01 주요 CCTV 스트립과 같은 자리
          문법: 좌우 패널 사이에 선다. 타일 클릭 = 지도 팝업 — S3 의 대체 경로 */}
      <div
        className="absolute bottom-3 z-20"
        style={{ left: LEFT_COL + EDGE * 2, right: CENTER_RIGHT, height: CCTV_DOCK }}
      >
        <GlassPanel className="h-full">
          <CctvDock districtName={district.name} cctvs={featuredCctvs} onSelect={focusDevice} />
        </GlassPanel>
      </div>

      {/* 우측 — 판단·대응 (03 §2). 서로 다른 기능은 서로 다른 카드다:
          위험도 판정 → 영향 분석 → 대응 절차 → 사건 진행. 전체 기록 열람은 이 레일이
          맡지 않는다 — 좌측 메뉴 [통계·분석]이 그 길이다.
          레일 바닥에 고정 버튼이 없어져 바닥까지 내려온다(bottom-3). 질의 버튼은 이 레일을
          덮지 않는다 — 도크 위·레일 왼쪽으로 비켜 선다(FAB_SLOT_DOCK · AgentFab) */}
      <div className={`${RAIL_BASE} right-3`} style={{ width: RIGHT_RAIL }}>
        {event && risk ? (
          <>
            <GlassPanel
              className={cn(
                "pointer-events-auto shrink-0",
                /* 사건 지정 진입(?event=) 직후 — 판단 국면의 시작점 강조 (02 §2) */
                requestedEvent === event.id && "ring-1 ring-primary/60",
              )}
            >
              <RiskCard event={event} risk={risk} approved={approved} />
            </GlassPanel>

            <GlassPanel className="pointer-events-auto shrink-0">
              <ImpactPanel
                districtId={district.id}
                measuredLevel={event.type === "수위" ? risk.measured.value : null}
                scenario={risk.scenario}
                eventId={event.id}
                onOpenTwin={openTwin}
              />
            </GlassPanel>

            {/* 대응 절차 — 판정할 거리(시나리오·승인)가 생긴 뒤에만 (§위험도 판정 등장 조건) */}
            {judged && (
              <GlassPanel className="pointer-events-auto shrink-0">
                <RespondPanel
                  onOpenExecution={hero && view?.active ? () => setExecutionOpen(true) : undefined}
                  executeButtonRef={executeButtonRef}
                  showResult={hero && sopExecuted}
                  twinReviewed={twinReview !== null}
                />
              </GlassPanel>
            )}

            {/* 우측 레일에서 남는 높이를 사건 진행이 받는다 — 접지 않고 늘어나며,
                넘치면 이 카드 본문만 스크롤한다(위 카드들과 푸터는 제자리) */}
            <GlassPanel className="pointer-events-auto flex min-h-0 flex-1 flex-col">
              <EventTimeline event={event} />
            </GlassPanel>
          </>
        ) : (
          /* 진행 사건이 없어도 분석 진입은 선다 — 분석 도구는 사건에 물리지 않는다(03 §2) */
          <GlassPanel className="pointer-events-auto shrink-0">
            <ImpactPanel
              districtId={district.id}
              measuredLevel={null}
              scenario={null}
              eventId={null}
              onOpenTwin={openTwin}
            />
          </GlassPanel>
        )}
      </div>

      {/* 대응 실행 집중 팝업 (03 §2 · 차수 N) — 주인공 진행 사건에서만 연다 */}
      {event && view && risk && effectiveLevel && hero && (
        <ExecutionPopup
          open={executionOpen}
          onClose={() => setExecutionOpen(false)}
          district={district}
          event={event}
          processState={processStateAt(event, now, approvedResponseLevel)}
          risk={risk}
          approved={approved}
          effectiveLevel={effectiveLevel}
          message={message}
          onMessageChange={setMessage}
          onExecuted={handleSopExecuted}
          onResend={handleResend}
          returnFocusTo={executeButtonRef}
        />
      )}
    </div>
  );
}
