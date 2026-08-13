/* ─────────────────────────────────────────────
 * SCR-05 디지털트윈 — 배경: docs/레거시/정본/03_화면정의서.md §5
 *
 * 지구를 3D 로 띄워 놓고 **조건을 바꿔 공간 영향과 대응 대상을 비교하는** 자리다.
 * 사고 난 뒤가 아니라 나기 전을 본다.
 *
 * ★ 사건에 종속된 화면이 아니다. 두 모드로 산다 (02 §2 · demo/analysis.ts AnalysisMode):
 *
 *     사건 연계 분석   SCR-02 에서 사건을 들고 들어온다. 기준 조건은 실시간 계측이고,
 *                     결과는 그 사건에 붙어 대응 판단·SOP 대상을 구체화한다.
 *     사전 모의분석    메뉴로 직접 들어오거나 진행 중 사건이 없는 지구를 연다. 지구·재난
 *                     유형·조건을 사용자가 세우고, 결과는 모의분석안으로만 남는다.
 *
 *   평소에는 예방 도구이고 사건이 나면 대응 보조 도구가 된다. 모드는 사건 유무에서
 *   파생되며, 머리말·기준 조건·근거·완료 버튼이 함께 갈린다.
 *
 * 화면별 역할이 겹치지 않아야 한다 (02 §2):
 *   SCR-02  왜 위험한지 확인하고 대응을 결정
 *   SCR-05  어떤 조건에서 어디까지, 누구에게 영향이 가는지 공간적으로 검토   ← 여기
 *   SCR-04  실제 결과와 과거 이력을 사후 분석
 *   SCR-06  여러 화면의 근거를 문장으로 종합
 *
 * ★ 두 모드의 주 조작축은 **시간**이다. 사건 연계는 시각(17:29), 모의분석은 경과(+55분).
 *   사람이 미는 것은 시간이고 **예상 수위는 그 시간에 따라 나오는 결과다** — 예상은
 *   시스템의 몫이라 사람이 미는 값이 될 수 없다. 조건(강우 강도 · 해일 편차)은 그 시간을
 *   만드는 산정 근거로 내려간다(demo/progression.ts · demo/scenario-timeline.ts).
 *
 * ★ 우측 레일은 **결론이 위**다. 분석 대상 → 시간축 → 영향 결과 → 근거·가정 → 완료 동작.
 *   1280×720 에서 첫 화면에 다 서야 하는 것이 그 다섯이다. 미니맵·과거 이벤트는 분석
 *   보조라 맨 아래 접힌 자리로 내려가고, 레이어는 지도 위 팝오버로 나간다(다른 지도
 *   화면과 같은 자리·같은 문법 — components/MapUtilStrip.tsx).
 *
 * 실사 3D 모델은 확보 대상이 아니다. 지형·건물을 세우고 그 위에 반투명 수면을 얹어,
 * 조건값으로 높이를 키우는 방식으로 만든다(lib/flood-scene.ts).
 * ───────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { Badge, Button, CollapsibleSection, EmptyState, GlassPanel, toast } from "@ds";
import { useMapLibre } from "../../lib/useMapLibre";
import { useWindLayer } from "../../lib/useWindLayer";
import {
  DEFAULT_WEATHER,
  isWeatherKey,
  weatherLayerItems,
  type WeatherState,
} from "../../lib/weather-layers";
import { useTemperatureLayer } from "../../lib/useTemperatureLayer";
import { usePrecipitationLayer } from "../../lib/usePrecipitationLayer";
import { MapUtilStrip } from "../../components/MapUtilStrip";
import {
  CENTER_LEFT,
  CENTER_RIGHT,
  LEFT_RAIL,
  RAIL_BASE,
  RIGHT_RAIL,
  UTIL_STRIP,
} from "../../lib/layout";
import {
  ensureFloodLayers,
  ensureHillshade,
  setBuildings3D,
  setFloodLevel,
  setFloodLineVisible,
  setHillshadeVisible,
  setTerrain,
} from "../../lib/flood-scene";
import { ensureSafemapLayers, setSafemapVisible } from "../../lib/safemap";
import { loadTerrainGrid, type TerrainPatch } from "../../lib/terrain-grid";
import { findDistrict, type District } from "../../demo/districts";
import { DEVICE_KINDS, devicesOf, type DeviceKind } from "../../demo/devices";
import { activeEventOfAt, eventViewAt, hazardLabel, type HazardType } from "../../demo/events";
import { WATER_THRESHOLDS } from "../../demo/levels";
import { scenarioOfDistrictAt } from "../../demo/forecast";
import { hazardLayersOf, hazardSwatchOf } from "../../demo/hazard-layers";
import {
  analysisBasisOf,
  conditionSpecOf,
  drillBasisOf,
  drillDistrictAt,
  hazardTypesOf,
  impactAt,
  observedBasisOf,
  type AnalysisMode,
  type DrillSnapshot,
} from "../../demo/analysis";
import {
  conditionOf,
  formatOffset,
  progressionSpecOf,
  progressionTimelineOf,
} from "../../demo/progression";
import { markAt, timelineOf, valueAt, type TimeMark } from "../../demo/scenario-timeline";
import { recordReview, saveDrill, useDrills } from "../../state/analysis-results";
import { formatClock } from "../../lib/datetime";
import { TimelinePanel } from "./widgets/TimelinePanel";
import { HazardLayers } from "../../components/HazardLayers";
import { AnalysisHeader } from "./widgets/AnalysisHeader";
import { DrillSetupPanel } from "./widgets/DrillSetupPanel";
import { ImpactResultCard } from "./widgets/ImpactResultCard";
import { AnalysisBasisCard } from "./widgets/AnalysisBasisCard";
import { DistrictEventList } from "./widgets/DistrictEventList";
import { MiniMap } from "./widgets/MiniMap";
import { TwinDeviceMarkers } from "./widgets/TwinDeviceMarkers";
import { TwinWeather } from "./widgets/TwinWeather";
import { useScenario } from "../../state/ScenarioProvider";
import { DEMO_USER } from "../../demo/user";

/**
 * 마을과 건물이 함께 잡히는 배율. 베이스맵 3D 건물이 15부터 나온다.
 * 16 까지 당기면 영향 범위가 화면을 넘어 "어디까지"의 경계가 사라진다.
 */
const TWIN_ZOOM = 15.8;
/**
 * 트윈은 지도 화면(TILT_PITCH)보다 더 눕힌다. 물이 차오르는 것은 높이의 이야기라
 * 위에서 내려다보면 색만 덮이고 "잠긴다"가 보이지 않는다.
 */
const TWIN_PITCH = 60;

/**
 * 씬 표현·표식 토글 (04 §9).
 *
 * LayerPanel 이라는 별도 카드로 레일 한 칸을 먹던 것을 지도 위 레이어 팝오버로 옮겼다 —
 * 다른 지도 화면(SCR-01·02)과 같은 자리, 같은 문법이다. 상태만 여기 남는다.
 */
interface LayerState {
  devices: Record<DeviceKind, boolean>;
  floodLine: boolean;
  flood: boolean;
  /** 행안부 해안침수예상도 — 실시간 WMS(lib/safemap.ts). 시뮬레이션과 겹쳐 보는 대조층 */
  floodOfficial: boolean;
}

const DEFAULT_LAYERS: LayerState = {
  /* 사건 연계 핵심 장비만 기본 표시 — 전체 CCTV 를 깔면 분석 대상 지점이 묻힌다(03 §5) */
  devices: { WL: true, RN: false, DP: false, CV: true, BC: false, TD: false },
  floodLine: true,
  flood: false,
  /* 공식 자료는 대조용 — 기본 꺼짐. 04 §9 의 기본 켜짐 7종에 들지 않는다 */
  floodOfficial: false,
};

/** 영향 표현 토글 — 조건 축이 그리는 층과 대조용 공식 자료 */
const IMPACT_ITEMS: { id: keyof LayerState; label: string; color: string; icon: string }[] = [
  { id: "flood", label: "영향 예상범위", color: "#2f6fd0", icon: "mdi:waves" },
  { id: "floodLine", label: "침수선 보기", color: "#7cc4ff", icon: "mdi:vector-polyline" },
  { id: "floodOfficial", label: "해안침수예상도", color: "#64748b", icon: "mdi:map-legend" },
];

const MODE_LABEL: Record<AnalysisMode, string> = {
  event: "사건 연계 분석",
  drill: "사전 모의분석",
};

export function DigitalTwinPage() {
  const navigate = useNavigate();
  const { districtId } = useParams();
  const [params] = useSearchParams();
  const { advanceTo, heroDistrictId, now, selectedDeviceId, selectDevice } = useScenario();
  /* 지구를 들고 오는 길은 재난관제뿐이다(`/scr-05/:districtId`). 메뉴로 들어오면 지구가
     없으므로 **사건이 없는 지구**를 골라 사전 모의분석으로 연다(02 §2 · demo/analysis.ts).
     봉암 고정이던 자리다 — 봉암 트랙에서는 그 지구가 사건 한복판이라, 메뉴로 들어왔는데
     진행 중 사건의 연계 분석이 열렸다.
     시계로 고르므로 트랙을 발사하면(0 키) 화면에 머문 채로도 답이 따라 바뀐다 */
  const clockMs = now.getTime();
  const menuDistrict = useMemo(() => drillDistrictAt(new Date(clockMs)), [clockMs]);
  const district = (districtId && findDistrict(districtId)) || menuDistrict;

  /* 선택 장비 복구 — 엔진이 정본이고 URL(`?device=`)은 새로고침·딥링크의 보조다(03 §5) */
  const deviceParam = params.get("device");
  useEffect(() => {
    if (deviceParam) selectDevice(deviceParam);
  }, [deviceParam, selectDevice]);

  const mapContainer = useRef<HTMLDivElement>(null);
  /* 진입은 평면(pitch 0)에서 시작한다 — 재난관제의 2D 시점을 이어받아 focusDistrict 가
     TWIN_PITCH 로 일으켜 세운다. "공간이 3D 로 일어선다"(05 S4)가 이 전환이다 (03 §5) */
  const { map, ready } = useMapLibre(mapContainer, {
    center: district.center,
    zoom: TWIN_ZOOM,
    pitch: 0,
  });

  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
  const [weather, setWeather] = useState<WeatherState>(DEFAULT_WEATHER);
  const [level, setLevel] = useState(0);
  /* 참고 자리(미니맵·과거 이벤트)는 접힌 채로 연다 — 분석 결과가 첫 화면을 차지해야 한다 */

  const [referenceOpen, setReferenceOpen] = useState(false);

  /* 접힌 자리를 펼치면 그 자리로 스크롤한다. 둘 다 레일 아래쪽에 있어서, 펼쳐도 열린
     내용이 화면 밖에 있으면 눌러도 아무 일 없는 것처럼 보인다. block:"end" 로 펼친
     내용의 끝을 맞춰야 본문이 다 들어온다 */
  const referenceRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (referenceOpen) referenceRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [referenceOpen]);

  /* ── 모드 (02 §2) ─────────────────────────────────────────────────────────
     진행 중 사건이 있으면 사건 연계, 없으면 사전 모의분석. 사용자가 고르는 것이 아니라
     사건 유무에서 파생된다 — 사건이 도는 지구를 "훈련"으로 열 수 있으면, 훈련으로 만든
     숫자가 실제 대응 근거와 같은 자리에 서게 된다 */
  const activeEvent = activeEventOfAt(district.id, now);
  const activeView = activeEvent ? eventViewAt(activeEvent, now) : null;
  const mode: AnalysisMode = activeEvent ? "event" : "drill";

  /* 주인공 지구의 사건을 들고 트윈에 들어오면 S4 — 영향 분석 (04 §0).
     주인공은 트랙이 정한다(04 §15-3) — 서항 id 에 하드로 물려 있어 봉암 트랙에서는 S4 가
     오지 않았다. 모의분석으로 둘러보는 것은 대본 진행이 아니므로 스텝을 건드리지 않는다:
     이 게이트가 없으면 봉암 트랙의 메뉴 진입(사건 없는 서항)이 스텝을 밀어 시계가
     09:05 로 뛴다 */
  useEffect(() => {
    if (mode === "event" && district.id === heroDistrictId) advanceTo(4);
  }, [mode, district.id, heroDistrictId, advanceTo]);

  /* 모의분석의 재난유형 — 원장에 이 지구 사건으로 등재된 것 중에서 고른다 */
  const hazardTypes = useMemo(() => hazardTypesOf(district.id), [district.id]);
  const [drillHazard, setDrillHazard] = useState<HazardType | null>(null);
  useEffect(() => {
    /* 시간축이 설 수 있는 유형을 먼저 세운다 — 지구를 바꾸자마자 "미등재"가 뜨면
       무엇을 잘못 골랐나 싶어진다. 없으면 첫 유형으로 두고 레일이 미등재를 말한다 */
    const usable = hazardTypes.find((type) => progressionSpecOf(district.id, type));
    setDrillHazard(usable ?? hazardTypes[0] ?? null);
  }, [district.id, hazardTypes]);

  const hazardType = mode === "event" ? (activeEvent?.hazardType ?? null) : drillHazard;
  const threshold = WATER_THRESHOLDS[district.id] ?? null;
  const conditionSpec = hazardType ? conditionSpecOf(district.id, hazardType) : null;
  const unit = conditionSpec?.unit ?? activeEvent?.unit ?? "";

  /* ── 모의분석의 조건 (demo/progression.ts) ───────────────────────────────
     사람이 세우는 마지막 값이다. 이 값이 상승률을 정하고 상승률이 축 위 눈금 시각을
     정한다 — 수위는 그 축을 밀어야 나온다. 지구·유형이 바뀌면 그 지구의 기본 조건으로
     돌아간다(conditionOf 가 물러설 자리를 안다) */
  const progression =
    mode === "drill" && hazardType ? progressionSpecOf(district.id, hazardType) : null;
  const [drillConditionId, setDrillConditionId] = useState<string | null>(null);
  useEffect(() => {
    setDrillConditionId(null);
  }, [district.id, hazardType]);
  const drillCondition = progression ? conditionOf(progression, drillConditionId) : null;

  /* 지형 고도 패치 — 있으면 수면이 지형을 따라 차오른다. 없으면(굽기 전·새 지구)
     flood-scene 이 원형 수면으로 물러나므로 실패해도 화면은 선다 */
  const [terrainPatch, setTerrainPatch] = useState<TerrainPatch | null>(null);
  useEffect(() => {
    let cancelled = false;
    setTerrainPatch(null);
    loadTerrainGrid()
      .then((grid) => {
        if (!cancelled) setTerrainPatch(grid.patches[district.id] ?? null);
      })
      .catch((e) =>
        console.error("[terrain] 지형 격자 로드 실패 — scripts/fetch-terrain-grid.mjs 를 돌렸나", e),
      );
    return () => {
      cancelled = true;
    };
  }, [district.id]);

  /* 대피 시설 — 서항 한정 · 기본 켜짐 (04 §9 · §1-1). 트윈은 대피소 하나만 세운다 */
  const hazards = useMemo(() => hazardLayersOf(district.id, "twin"), [district.id]);
  const [hazardOn, setHazardOn] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setHazardOn(Object.fromEntries(hazards.map((h) => [h.id, true])));
  }, [hazards]);

  /* 조건 시나리오(04 §10) — 주인공 사건 하나에만 있다. 조건 축의 표식과 프리셋의 출처 */
  const scenario = mode === "event" ? scenarioOfDistrictAt(district.id, now) : null;

  const devices = useMemo(() => devicesOf(district.id), [district.id]);
  /* 재난관제에서 보던 장비는 종류를 꺼도 자리에 남는다 — 잇는 대상이 사라지면 안 된다(03 §5) */
  const visibleDevices = devices.filter(
    (device) => layers.devices[device.kind as DeviceKind] || device.id === selectedDeviceId,
  );
  const deviceCounts = useMemo(() => {
    const counts = {} as Record<DeviceKind, number>;
    for (const spec of DEVICE_KINDS) counts[spec.kind] = 0;
    for (const device of devices) counts[device.kind as DeviceKind] += 1;
    return counts;
  }, [devices]);

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

  /* 지구가 바뀌면 그 마을로 날아간다 */
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    ensureFloodLayers(instance, district.center);
    ensureHillshade(instance);
    focusDistrict(800);
  }, [map, ready, district, focusDistrict]);

  /* ── 기준 조건 = 축의 출발점 ────────────────────────────────────────────
     사건 연계는 **현재 시각의 계측**이 기준이다("지금 이렇고, 19:10 이면 이렇게 된다").
     모의분석은 관측이 없으므로 **축의 출발점**(발령이 시작되는 지점)이 기준이다 —
     "주의보가 난 시점에서 이 조건이 지속되면 얼마나 커지나"가 계획·훈련의 물음이라서다.
     봉암은 그 자리에서 영향이 아직 0 인데, 그 0 이 비교의 왼쪽에 서는 것이 맞다:
     "지금은 아무 일 없지만 이 비가 55분 더 오면 11동" 이 이 화면이 만드는 문장이다 */
  const observed = activeView?.value ?? null;
  const baselineValue = mode === "event" ? observed : (progression?.startLevel ?? null);
  /* 열 머리 — 사건 연계는 시각으로, 모의분석은 눈금 이름으로 읽는다. 경과 축에
     "17:16" 을 세우면 그 시각에 무슨 뜻이 있는 것처럼 보인다 */
  const baselineLabel =
    mode === "event" ? `현재 ${formatClock(now)}` : (progression?.startLabel ?? "기준");

  /* 레이어 토글 반영 */
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    /* 씬 표현은 토글을 두지 않는다 — 3D 로 세우고 지형을 깔고 음영으로 능선을 살리는
       것이 이 화면의 정체이지 고르는 설정이 아니다. 끄면 트윈이 아니라 평면 지도가 된다.
       등고선 데이터가 없어 산이 단색 면으로만 보이므로 음영은 켠 채로 둔다 */
    setBuildings3D(instance, true);
    setTerrain(instance, true);
    setHillshadeVisible(instance, true);
    setFloodLineVisible(instance, layers.floodLine);
    /* 행안부 해안침수예상도 — 켤 때만 실시간 WMS 요청이 나간다(lib/safemap.ts) */
    ensureSafemapLayers(instance);
    setSafemapVisible(instance, "flood-expect", layers.floodOfficial);
  }, [map, ready, layers]);

  /* 수면 높이 — 조건값이 바뀔 때마다 지오메트리를 다시 계산해 갈아 끼운다 */
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    setFloodLevel(instance, level, layers.flood, district.center, terrainPatch);
  }, [map, ready, level, layers.flood, district, terrainPatch]);

  /* ── 영향 결과 — 기준 조건과 선택 조건을 같은 함수로 두 번 낸다 ──────────────
     이 두 값의 나란함이 디지털트윈이 내놓는 결과다. "6동 → 47동"은 한쪽만으로는
     못 하는 말이고, 대응 등급 상향의 근거로 소리 내어 말해지는 문장이다(05 §3 S4) */
  const baseline =
    hazardType && baselineValue != null ? impactAt(district.id, hazardType, baselineValue) : null;
  const selected = hazardType ? impactAt(district.id, hazardType, level) : null;
  const sameAsBaseline = baselineValue != null && Math.abs(level - baselineValue) < 0.005;

  /* 근거와 가정 — 모드마다 출처가 다르다. 모의분석은 "무엇을 안 썼는지"까지 적는다 */
  const basis = useMemo(() => {
    if (!threshold) return null;
    if (mode === "drill") {
      return progression && drillCondition
        ? drillBasisOf(progression, drillCondition, threshold, unit, now)
        : null;
    }
    if (scenario) return analysisBasisOf(scenario, now, observed, unit);
    return observedBasisOf(threshold, unit, now, observed);
  }, [mode, threshold, unit, now, scenario, observed, progression, drillCondition]);

  /* ── 시간축 (03 §5) ──────────────────────────────────────────────────────
     ★ 두 모드의 주 조작축이다. 시간을 옮기면 예상 수위·영향·대응 대상이 함께 바뀐다.

     사건 연계  절대 시각. 눈금은 원장 계측과 조건 시나리오가 세운다(scenario-timeline.ts)
     모의분석  출발점에서의 경과. 눈금은 발령 기준·영향표가 세우고 시각은 조건이 정한
               상승률이 계산한다(progression.ts). 예보가 없어 "몇 시"는 못 쓰지만
               "이 조건이면 대피 기준까지 2시간 35분"은 근거를 참칭하지 않는다 */
  const timeline = useMemo(() => {
    if (mode === "event") {
      return activeEvent && observed != null
        ? timelineOf(activeEvent, scenario, now, observed)
        : null;
    }
    return progression && drillCondition
      ? progressionTimelineOf(progression, drillCondition)
      : null;
  }, [mode, activeEvent, scenario, now, observed, progression, drillCondition]);

  /* 축 위 어디에 서 있나.
     ★ 값이 아니라 **시각**을 기억한다. 축이 자유 스크럽이라 한 값이 여러 시각에 설 수 있고
       (서항은 17:22 격상값과 17:29 현재값이 둘 다 3.41 이다), 값으로 되찾으면 [경보 격상]을
       눌러도 선택이 [현재]로 튄다. 누른 버튼이 안 켜지면 조작이 먹지 않은 것으로 읽힌다 */
  const [pickedAt, setPickedAt] = useState<Date | null>(null);

  /* 축이 열리는 자리 — 모드마다 다르다.

     사건 연계  **현재 눈금.** S4 가 "지금을 보고 앞을 비교"라 첫 장면이 지금이어야 한다
     모의분석  **마지막 눈금(대피 기준 도달).** 출발점에서 열면 영향이 아직 0 인 지구가
               있어(봉암 3.45 는 표 밖 · 04 §15-8) 첫 화면이 통째로 0 으로 뜬다. 계획·훈련이
               먼저 묻는 것도 "대피 기준에 닿으면 어디까지인가"라 그 자리가 기본값이다 */
  const openingMark = timeline
    ? timeline.marks[mode === "event" ? timeline.nowIndex : timeline.marks.length - 1]
    : null;
  /* 시각과 값을 한 효과로 함께 되돌린다 — 따로 두면 조건을 바꾸는 한 프레임 동안 축과
     수면이 어긋난다. 지구·모드·조건이 바뀌면 축이 새로 서므로 이 값들도 함께 바뀐다 */
  const openingAtMs = openingMark?.at.getTime() ?? null;
  const openingValue = openingMark?.value ?? null;
  useEffect(() => {
    setPickedAt(openingAtMs === null ? null : new Date(openingAtMs));
    if (openingValue == null) {
      setLevel(0);
      return;
    }
    setLevel(openingValue);
    setLayers((prev) => (prev.flood ? prev : { ...prev, flood: true }));
  }, [openingAtMs, openingValue, district.id, mode]);

  /* 눈금 위인가 사이인가 — 사이면 undefined 라 화면이 "사용자 시각"으로 말한다 */
  const selectedMark = timeline && pickedAt ? markAt(timeline, pickedAt) : undefined;
  /* 축 위 한 점의 표기 — 사건 연계는 시각, 모의분석은 경과 */
  const axisAt = (at: Date) =>
    mode === "event" || !timeline ? formatClock(at) : formatOffset(timeline, at);

  /* 기상 격자 — 켜고 끄는 것은 토글이 정하고, **어느 시각의 기상인가는 시간축이 정한다.**
     시각을 옮기면 근거 카드의 강우 유입과 지도의 비가 함께 움직인다.
     모의분석 축은 경과라 시각이 없다(축 기준점은 표기에 안 쓰는 상수다 · progression.ts) —
     그쪽은 시나리오 시계를 그대로 쓴다. 안 그러면 훈련 축을 밀 때 지도의 비가 자정으로 뛴다 */
  const weatherHour = (mode === "event" ? (pickedAt ?? now) : now).getHours();
  useWindLayer(map, ready, weather.wind);
  useTemperatureLayer(map, ready, weather.temp);
  usePrecipitationLayer(map, ready, weather.rain, weatherHour);

  /* 축을 밀면 영향 층이 따라 켜진다 — 값은 움직이는데 화면이 안 변하면 조작이 죽은
     것으로 읽힌다. "레이어에서 켜세요" 안내로 사용자를 돌려보내지 않는다 */
  const changeLevel = (next: number) => {
    setLevel(next);
    setLayers((prev) => (prev.flood ? prev : { ...prev, flood: true }));
  };

  /* 시간축 눈금 짚기 — 04 등재값으로 정확히 데려간다 */
  const pickMark = (mark: TimeMark) => {
    setPickedAt(mark.at);
    changeLevel(mark.value);
  };

  /* 시간축 스크럽 — 눈금 사이는 선형 보간(demo/scenario-timeline.ts valueAt).
     04 에 없는 값이라 화면이 "사용자 시각"으로 구분해 말한다 (03 §5) */
  const scrubTo = (at: Date) => {
    if (!timeline) return;
    setPickedAt(at);
    changeLevel(valueAt(timeline, at));
  };


  const setLayer = (id: keyof LayerState) =>
    setLayers((prev) => ({ ...prev, [id]: !prev[id as keyof LayerState] }));

  const openDistrict = (next: District) => navigate(`/scr-05/${next.id}`);

  /* ── 완료 동작 — 모드마다 남기는 것이 갈린다 (02 §2) ─────────────────────
     사건 연계: 트윈은 사건의 값도 SOP 도 바꾸지 않는다. SOP 를 정하는 것은 재난유형
       (목록)·승인 대응등급(활성 범위)·정본 데이터(대상 인원·수단·기관) 셋이고 셋 다 트윈
       밖이다. `재난문자 412명` 은 트윈에 들어가기 전부터 경보 등급 SOP 에 서 있다.
       그래서 남기는 것은 **"대표 전망을 언제 누가 검토했다"** 는 사실과 근거뿐이고,
       사건 상태를 바꾸는 행위는 SCR-02 의 [대응등급 대피로 상향] 하나다.
       버튼이 "분석 결과를 사건에 반영"이 아닌 이유가 이것이다 — 반영되는 것은 결과가
       아니라 검토다.
     사전 모의분석: 모의분석안으로만 남는다. 사건 id 를 들지 않아 대응 등급·타임라인·
       전파 원장 어디에도 닿지 않는다 */
  const drills = useDrills(district.id);

  /* 검토 대상은 언제나 **대표 전망**이다. 사용자가 상세 조건으로 밀어 본 값(3.80 같은)은
     "이 정도면 어디까지"를 알아보는 자유 탐색이고 사건의 공식 근거를 대체하지 않는다.
     그래서 슬라이더가 어디에 서 있든 기록되는 값은 이 한 벌이다 */
  const projectedImpact =
    scenario && hazardType ? impactAt(district.id, hazardType, scenario.peak) : null;
  const canSaveDrill = Boolean(selected && basis && hazardType);
  const returnToControl = () => {
    /* 돌아가는 길에 검토 기록을 남긴다. 트윈에 들어와 시간축을 본 것이 곧 검토이고,
       기록되는 값은 언제나 대표 전망 한 벌이다 — 화면에서 어느 시각을 짚고 있었든
       사건에 붙는 근거는 04 가 세운 전망이지 지나며 스친 사이값이 아니다(02 §2) */
    if (!activeEvent) return;
    if (!scenario || !projectedImpact || !basis || !hazardType) {
      navigate(`/scr-02/${activeEvent.districtId}?event=${activeEvent.id}`);
      return;
    }
    recordReview({
      districtId: district.id,
      eventId: activeEvent.id,
      hazardType,
      reviewedAt: now,
      reviewer: `${DEMO_USER.group} ${DEMO_USER.role}`,
      scenarioCreatedAt: new Date(scenario.createdAt),
      scenarioAt: new Date(scenario.peakAt),
      scenarioLabel: scenario.peakLabel,
      scenarioValue: scenario.peak,
      unit,
      scenarioImpact: projectedImpact,
      observedImpact: baseline,
      observedValue: observed,
      basis,
    });
    navigate(`/scr-02/${activeEvent.districtId}?event=${activeEvent.id}`);
  };

  const saveDrillResult = () => {
    if (!selected || !basis || !hazardType) return;
    /* 남기는 이름에 **경과가 먼저 선다.** 수위만 적으면 "5.83 을 세워 봤다"로 읽히는데
       실제로 세운 것은 조건이고 5.83 은 거기서 2시간 35분 뒤에 나온 결과다 */
    const offset = timeline && pickedAt ? formatOffset(timeline, pickedAt) : null;
    const conditionLabel = offset
      ? `${offset} · ${level.toFixed(2)} ${unit}`
      : `${level.toFixed(2)} ${unit}`;
    const snapshot: DrillSnapshot = {
      districtId: district.id,
      districtName: district.name,
      hazardType,
      conditionValue: level,
      conditionLabel,
      baseline,
      baselineLabel,
      impact: selected,
      basis,
      savedAt: now,
    };
    saveDrill(snapshot);
    toast.success("모의분석 결과를 저장했습니다", {
      description: `${district.name} ${hazardType} · ${drillCondition?.label ?? ""} ${conditionLabel} · 실제 사건에는 반영되지 않습니다`,
    });
  };

  /* 머리말 한 줄 — 모드 뱃지 옆에 "무엇을 분석 중인가".
     사건 연계는 원장 표기(하천범람·내수침수는 "위험"이 붙는다 · 04 §4-0), 모의분석은
     그 현상이 일어났다고 치고 보는 것이라 유형 이름을 그대로 쓴다 */
  const subject = hazardType
    ? `${district.name} ${mode === "event" ? hazardLabel(hazardType) : hazardType}`
    : district.name;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* 3D 씬 — 배경 */}
      <div
        className="absolute inset-0 z-0 overflow-hidden bg-surface"
        style={{ isolation: "isolate" }}
        aria-label={`${district.name} 3D 씬`}
      >
        <div ref={mapContainer} className="h-full w-full" />
        <TwinDeviceMarkers
          map={map}
          ready={ready}
          devices={visibleDevices}
          selectedId={selectedDeviceId}
        />
        <HazardLayers map={map} ready={ready} layers={hazards} visible={hazardOn} />


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

      {/* 좌상단 — 브레드크럼. 어디서 왔고 지금 어디이며 무엇을 보는 중인가를 한 줄로.
          두 줄로 세우면 화면 이름과 분석 대상이 따로 노는 표제처럼 읽힌다 */}
      <div className="pointer-events-none absolute left-3 top-3 z-30">
        <GlassPanel className="pointer-events-auto">
          <nav className="flex items-center gap-1.5 px-2 py-2 text-caption" aria-label="위치">
            <button
              type="button"
              /* 돌아갈 곳이 브레드크럼의 첫 마디다 — 사건 연계는 그 사건의 재난관제로,
                 모의분석은 대응할 사건이 없으니 종합상황으로 */
              onClick={() => navigate(mode === "event" ? `/scr-02/${district.id}` : "/scr-01")}
              className="flex shrink-0 cursor-pointer items-center gap-1 rounded border-none bg-transparent px-1 py-0.5 text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground"
            >
              <Icon icon="mdi:arrow-left" className="size-4" aria-hidden />
              {mode === "event" ? "재난관제" : "종합상황"}
            </button>
            <Icon
              icon="mdi:chevron-right"
              className="size-4 shrink-0 text-foreground-subtle"
              aria-hidden
            />
            <span className="shrink-0 text-foreground-muted">디지털트윈</span>
            <Icon
              icon="mdi:chevron-right"
              className="size-4 shrink-0 text-foreground-subtle"
              aria-hidden
            />
            <h1 className="min-w-0 truncate font-semibold text-foreground">{subject}</h1>
            {/* 모드는 마디가 아니라 지금 화면의 성격이라 끝에 붙인다 */}
            <Badge variant={mode === "event" ? "default" : "gray"} className="ml-0.5 shrink-0">
              {MODE_LABEL[mode]}
            </Badge>
          </nav>
        </GlassPanel>
      </div>

      {/* 좌하단 — 날씨 */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20" style={{ width: LEFT_RAIL }}>
        <GlassPanel className="pointer-events-auto">
          <TwinWeather districtId={district.id} />
        </GlassPanel>
      </div>

      {/* 씬 조작 — 지도 화면(SCR-01·02)과 같은 스트립을 같은 자리에 세운다.
          레이어도 여기 팝오버로 들어온다(03 §5) — 표현 설정은 분석 보조라 우측 레일의
          결론 자리를 먹으면 안 된다. "원래대로"는 트윈 기본 시점(기울인 채)으로 돌아간다 */}
      <div className={UTIL_STRIP}>
        <MapUtilStrip
          map={map}
          disabled={!ready}
          homePitch={TWIN_PITCH}
          onReset={() => focusDistrict(500)}
          layers={[
            {
              title: "장비",
              items: DEVICE_KINDS.filter((spec) => deviceCounts[spec.kind] > 0).map((spec) => ({
                id: spec.kind,
                label: spec.label,
                color: spec.color,
                icon: spec.icon,
                /* 장치 핀 문법 그대로 — 원형 글라스 칩 (03 §0-5) */
                shape: "device" as const,
                count: deviceCounts[spec.kind],
                visible: layers.devices[spec.kind],
              })),
              onToggle: (id) =>
                setLayers((prev) => ({
                  ...prev,
                  devices: { ...prev.devices, [id as DeviceKind]: !prev.devices[id as DeviceKind] },
                })),
              onSetAll: (visible) =>
                setLayers((prev) => ({
                  ...prev,
                  devices: Object.fromEntries(
                    DEVICE_KINDS.map((spec) => [spec.kind, visible]),
                  ) as Record<DeviceKind, boolean>,
                })),
            },
            /* 대피 시설 — 등재된 지구(서항)에서만 온다. 빈 지구에 묶음을 세우지 않는다(04 §1-1).
               "위험요소"라 부르지 않는다: 대피소는 피할 곳이지 위험한 곳이 아니다 */
            ...(hazards.length > 0
              ? [
                  {
                    title: "대피 시설",
                    items: hazards.map((h) => ({
                      id: h.id,
                      label: h.label,
                      color: h.color,
                      icon: h.icon,
                      shape: hazardSwatchOf(h),
                      visible: hazardOn[h.id] ?? true,
                    })),
                    onToggle: (id: string) =>
                      setHazardOn((prev) => ({ ...prev, [id]: !(prev[id] ?? true) })),
                    onSetAll: (visible: boolean) =>
                      setHazardOn(Object.fromEntries(hazards.map((h) => [h.id, visible]))),
                  },
                ]
              : []),
            {
              title: "영향 표현",
              items: [
                ...IMPACT_ITEMS.map((item) => ({
                  id: item.id,
                  label: item.label,
                  color: item.color,
                  icon: item.icon,
                  visible: layers[item.id] as boolean,
                })),
                ...weatherLayerItems(weather),
              ],
              onToggle: (id) =>
                isWeatherKey(id)
                  ? setWeather((prev) => ({ ...prev, [id]: !prev[id] }))
                  : setLayer(id as keyof LayerState),
              onSetAll: (visible) => {
                setLayers((prev) => ({
                  ...prev,
                  ...Object.fromEntries(IMPACT_ITEMS.map((item) => [item.id, visible])),
                }));
                setWeather({ rain: visible, temp: visible, wind: visible });
              },
            },
          ]}
        />
      </div>

      {/* 우측 — 분석 대상 · 조건 · 영향 결과 · 근거 · 완료. 결론이 위다(03 §5).
          카드는 스크롤하되 완료 버튼은 레일 바닥에 붙박는다 — 1280×720 에서 근거 카드가
          길어지면 결론 동작이 접히는데, 그러면 "설정이 먼저 보이는" 원래 문제로 돌아간다 */}
      <div className={`${RAIL_BASE} right-3`} style={{ width: RIGHT_RAIL }}>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {/* 레일 첫 카드 = "무엇을 분석하는가". 사건 연계는 사건이 정해 주고,
              모의분석은 사용자가 세운다 */}
          <GlassPanel className="pointer-events-auto shrink-0">
            {mode === "event" ? (
              <AnalysisHeader
                district={district}
                event={activeEvent ?? null}
                view={activeView}
                /* 만조는 목적의 이름이 아니다 — 시간축 위의 사건이고 산정 근거다(03 §5).
                   목적은 "언제까지 무엇이 오는가" 로 적는다 */
                /* 눈금 이름(바닷물 최고)은 시간축이 이미 말한다 — 여기서 또 붙이면 340px
                   한 줄을 넘겨 "전망"이 홀로 다음 줄로 떨어진다 */
                purpose={
                  scenario
                    ? `${formatClock(new Date(scenario.peakAt))} 영향 전망`
                    : "발령 기준별 영향 확인"
                }
              />
            ) : (
              <DrillSetupPanel
                district={district}
                onDistrictChange={(id) => navigate(`/scr-05/${id}`)}
                hazardType={drillHazard}
                hazardTypes={hazardTypes}
                onHazardChange={setDrillHazard}
                progression={progression}
                condition={drillCondition}
                onConditionChange={setDrillConditionId}
              />
            )}
          </GlassPanel>

          {/* 주 조작축 — 두 모드가 같은 부품에 선다. 갈리는 것은 표기와 문안뿐이다 */}
          <GlassPanel className="pointer-events-auto shrink-0">
            {timeline ? (
              <TimelinePanel
                timeline={timeline}
                at={pickedAt ?? undefined}
                mark={selectedMark}
                onScrub={scrubTo}
                onPick={pickMark}
                title={mode === "event" ? undefined : "경과 시간별 영향"}
                formatAt={mode === "event" ? undefined : (at) => formatOffset(timeline, at)}
                caption={mode === "event" ? undefined : "설정 조건 지속 시"}
                freeLabel={mode === "event" ? undefined : "사용자 시점"}
              />
            ) : (
              /* 04 에 진행 조건·영향표가 없는 유형이다. 근거 없이 움직이는 축을 세우는
                 것보다 "아직 등재되지 않음"이 정직하다 */
              <section className="flex flex-col gap-1.5 p-3" aria-label="분석 조건">
                <h2 className="text-body font-semibold text-foreground">분석 조건</h2>
                <EmptyState
                  variant="inline"
                  icon="mdi:tune-variant"
                  message={
                    hazardType
                      ? `${hazardType} 조건 분석은 아직 등재되지 않았습니다`
                      : "분석할 사건이 없습니다"
                  }
                />
              </section>
            )}
          </GlassPanel>

          {selected && (
            <GlassPanel className="pointer-events-auto shrink-0">
              <ImpactResultCard
                baseline={baseline}
                selected={selected}
                baselineLabel={baselineLabel}
                /* 선택한 **시간**이 열 머리다. 사건 연계는 시각("19:10 바닷물 최고"),
                   모의분석은 경과("+2시간 35분 대피 기준"). 축이 없으면 값으로 물러난다 */
                selectedLabel={
                  timeline
                    ? selectedMark
                      ? `${axisAt(selectedMark.at)} ${selectedMark.label}`
                      : pickedAt
                        ? `${axisAt(pickedAt)} ${mode === "event" ? "사용자 시각" : "사용자 시점"}`
                        : `사용자 조건 ${level.toFixed(2)}`
                    : `선택 ${level.toFixed(2)}`
                }
                same={sameAsBaseline}
                /* 예상 수위가 결과의 첫 행 — 시간축이 두 모드의 주축이 되면서 조작
                   대상이던 값이 그 시간에 따라오는 결과로 자리를 옮겼다(03 §5).
                   행 이름은 스펙이 든다(demo/analysis.ts ConditionSpec) */
                condition={
                  conditionSpec
                    ? {
                        label: conditionSpec.title,
                        unit: conditionSpec.unit,
                        baseline: baselineValue,
                        selected: level,
                      }
                    : undefined
                }
              />
            </GlassPanel>
          )}

          {/* 근거·가정은 **사건 연계에만** 세운다.
              모의분석에서는 네 줄이 다 다른 데서 이미 한 말이다 — 산정 한 항(상승률)은 설정
              카드의 조건 줄 바로 아래가, "가상 조건"은 같은 카드 맨 아래와 저장 버튼 아래가,
              산출표는 바로 위 영향 결과가 말한다. "설정한 조건이 지속된다고 가정"에 이르면
              사용자가 방금 고른 조건이니 동어반복이다.
              사건 연계는 사정이 다르다 — 산정 세 항이 04 §10-3 그대로고 SCR-02 판정 카드·AI
              답변이 같은 값을 쓴다. "유지" 한 줄이 "예측이 아니라 조건 시나리오"라는 이 데모의
              방어선이라, 만조를 제목에서 내릴 수 있었던 것도 이 카드가 있어서다.
              저장되는 basis 는 기록이라 모의분석에서도 그대로 남긴다(화면에만 안 선다) */}
          {mode === "event" && basis && (
            <GlassPanel className="pointer-events-auto shrink-0">
              <AnalysisBasisCard basis={basis} />
            </GlassPanel>
          )}

          {/* 참고 — 분석 보조. 접힌 채로 열리고, 묻는 사람만 펼친다(03 §5) */}
          <div ref={referenceRef} className="shrink-0">
          <CollapsibleSection
            className="pointer-events-auto border-border"
            bodyClassName="flex flex-col gap-3 p-3"
            headerClassName="px-3"
            collapsed={!referenceOpen}
            onToggle={() => setReferenceOpen((prev) => !prev)}
            trailingChevron
            trigger={
              <span className="flex items-center gap-1.5 text-caption text-foreground-muted">
                <Icon icon="mdi:map-search-outline" className="size-4 shrink-0" aria-hidden />
                참고 · 지구 위치와 과거 이벤트
              </span>
            }
          >
            <MiniMap current={district} onSelect={openDistrict} />
            <DistrictEventList
              districtId={district.id}
              onOpen={(target) => navigate(`/scr-02/${target.districtId}?event=${target.id}`)}
            />
          </CollapsibleSection>
          </div>
        </div>

        {/* 완료 동작 — 스크롤 밖에 두어 어떤 길이의 근거 카드에도 화면에 남는다 */}
        <div className="flex shrink-0 flex-col gap-1.5">
          {mode === "event" ? (
            /* 하나뿐이다. 트윈은 확인하는 자리라 여기서 결정할 것이 없고, 결정은 대응
               판단 레일이 받는다. "검토 완료"와 "검토 없이"를 나눠 물으면 확인만 하러 온
               사람에게 하지 않은 결정을 고르게 한다 — 돌아가는 순간 검토는 이미 끝났다 */
            <Button className="pointer-events-auto w-full" onClick={returnToControl}>
              <Icon icon="mdi:arrow-left" className="size-4" aria-hidden />
              재난관제로 돌아가기
            </Button>
          ) : (
            <>
              <Button
                className="pointer-events-auto w-full"
                disabled={!canSaveDrill}
                onClick={saveDrillResult}
              >
                <Icon icon="mdi:clipboard-check-outline" className="size-4" aria-hidden />
                모의분석 결과 저장
              </Button>
              {/* 저장한 것이 어디로 갔는지 화면에 남긴다 — 눌렀는데 아무 자취가 없으면
                  저장이 된 것인지 알 수 없다. 사건 원장이 아니라 이 목록이 저장처다.
                  버튼과 달리 채운 바탕이 없어 3D 씬 위에서 글자가 흩어진다 — 바탕을 깐다 */}
              <p className="pointer-events-auto rounded bg-surface/70 px-2 py-1 text-center text-caption text-foreground-subtle backdrop-blur-sm">
                {drills.length > 0
                  ? `이 지구 모의분석안 ${drills.length}건 · 최근 ${drills[0].conditionLabel}`
                  : "저장한 결과는 모의분석안으로만 남습니다"}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
