/* ─────────────────────────────────────────────
 * SCR-05 디지털트윈 — 정본: docs/정본/03_화면정의서.md §5
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
 * ★ 우측 레일은 **결론이 위**다. 분석 대상 → 조건 → 영향 결과 → 근거·가정 → 완료 동작.
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
import { Badge, Button, CollapsibleSection, GlassPanel, toast } from "@ds";
import { useMapLibre } from "../../lib/useMapLibre";
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
import { DISTRICTS, findDistrict, type District } from "../../demo/districts";
import { DEVICE_KINDS, devicesOf, type DeviceKind } from "../../demo/devices";
import { activeEventOfAt, eventViewAt, hazardLabel, type HazardType } from "../../demo/events";
import { WATER_THRESHOLDS } from "../../demo/levels";
import { scenarioOfDistrictAt } from "../../demo/forecast";
import { hazardLayersOf, hazardSwatchOf } from "../../demo/hazard-layers";
import {
  analysisBasisOf,
  conditionSpecOf,
  drillBasisOf,
  hazardTypesOf,
  impactAt,
  observedBasisOf,
  thresholdPresetsOf,
  type AnalysisMode,
  type AnalysisSnapshot,
  type DrillSnapshot,
} from "../../demo/analysis";
import { markOfValue, timelineOf, type TimeMark } from "../../demo/scenario-timeline";
import { applyAnalysis, saveDrill, useDrills } from "../../state/analysis-results";
import { formatClock } from "../../lib/datetime";
import { TimelinePanel } from "./widgets/TimelinePanel";
import { HazardLayers } from "../../components/HazardLayers";
import { AnalysisHeader } from "./widgets/AnalysisHeader";
import { DrillSetupPanel } from "./widgets/DrillSetupPanel";
import { ConditionPanel } from "./widgets/ConditionPanel";
import { ImpactResultCard } from "./widgets/ImpactResultCard";
import { AnalysisBasisCard } from "./widgets/AnalysisBasisCard";
import { DistrictEventList } from "./widgets/DistrictEventList";
import { MiniMap } from "./widgets/MiniMap";
import { TwinDeviceMarkers } from "./widgets/TwinDeviceMarkers";
import { TwinWeather } from "./widgets/TwinWeather";
import { useScenario } from "../../state/ScenarioProvider";

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
  buildings3d: boolean;
  weather: boolean;
  terrain: boolean;
  hillshade: boolean;
  devices: Record<DeviceKind, boolean>;
  floodLine: boolean;
  flood: boolean;
  /** 행안부 해안침수예상도 — 실시간 WMS(lib/safemap.ts). 시뮬레이션과 겹쳐 보는 대조층 */
  floodOfficial: boolean;
}

const DEFAULT_LAYERS: LayerState = {
  buildings3d: true,
  weather: false,
  terrain: true,
  /* 등고선 데이터가 없어 산이 단색 면으로만 보인다. 음영을 기본으로 켜 능선을 살린다 */
  hillshade: true,
  /* 사건 연계 핵심 장비만 기본 표시 — 전체 CCTV 를 깔면 분석 대상 지점이 묻힌다(03 §5) */
  devices: { WL: true, RN: false, DP: false, CV: true, BC: false, TD: false },
  floodLine: true,
  flood: false,
  /* 공식 자료는 대조용 — 기본 꺼짐. 04 §9 의 기본 켜짐 7종에 들지 않는다 */
  floodOfficial: false,
};

/** 씬 표현 토글 — 팝오버 첫 묶음. 표식 필터가 아니라 화면 자체의 모드다 */
const SCENE_ITEMS: { id: keyof LayerState; label: string }[] = [
  { id: "buildings3d", label: "3D 건물" },
  { id: "terrain", label: "지형 렌더링" },
  { id: "hillshade", label: "지형 음영" },
  { id: "weather", label: "날씨효과" },
];

/** 영향 표현 토글 — 조건 축이 그리는 층과 대조용 공식 자료 */
const IMPACT_ITEMS: { id: keyof LayerState; label: string }[] = [
  { id: "flood", label: "영향 예상범위" },
  { id: "floodLine", label: "침수선 보기" },
  { id: "floodOfficial", label: "해안침수예상도" },
];

const MODE_LABEL: Record<AnalysisMode, string> = {
  event: "사건 연계 분석",
  drill: "사전 모의분석",
};

export function DigitalTwinPage() {
  const navigate = useNavigate();
  const { districtId } = useParams();
  const [params] = useSearchParams();
  const { advanceTo, now, selectedDeviceId, selectDevice } = useScenario();
  /* 04 §9 — 기본 지구는 봉암지구. 재난관제에서 넘어오면 그 지구를 연다 */
  const district = (districtId && findDistrict(districtId)) || findDistrict("bongam") || DISTRICTS[0];

  /* 주인공 지구로 트윈에 들어오면 S4 — 영향 분석 (04 §0).
     모의분석으로 다른 지구를 둘러보는 것은 대본 진행이 아니므로 스텝을 건드리지 않는다 */
  useEffect(() => {
    if (district.id === "seohang") advanceTo(4);
  }, [district.id, advanceTo]);

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
  const [level, setLevel] = useState(0);
  /* 참고 자리(미니맵·과거 이벤트)는 접힌 채로 연다 — 분석 결과가 첫 화면을 차지해야 한다 */
  const [referenceOpen, setReferenceOpen] = useState(false);
  /* 상세 조건도 접힌 채로. 기본 조작은 시간축이고 조건은 고급 조작이다(03 §5) */
  const [conditionOpen, setConditionOpen] = useState(false);

  /* 접힌 자리를 펼치면 그 자리로 스크롤한다. 둘 다 레일 아래쪽에 있어서, 펼쳐도 열린
     내용이 화면 밖에 있으면 눌러도 아무 일 없는 것처럼 보인다. block:"end" 로 펼친
     내용의 끝을 맞춰야 본문이 다 들어온다 */
  const conditionRef = useRef<HTMLDivElement>(null);
  const referenceRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (conditionOpen) conditionRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conditionOpen]);
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

  /* 모의분석의 재난유형 — 원장에 이 지구 사건으로 등재된 것 중에서 고른다 */
  const hazardTypes = useMemo(() => hazardTypesOf(district.id), [district.id]);
  const [drillHazard, setDrillHazard] = useState<HazardType | null>(null);
  useEffect(() => {
    /* 조건 패널이 설 수 있는 유형을 먼저 세운다 — 지구를 바꾸자마자 "미등재"가 뜨면
       무엇을 잘못 골랐나 싶어진다. 없으면 첫 유형으로 두고 패널이 미등재를 말한다 */
    const usable = hazardTypes.find((type) => conditionSpecOf(district.id, type));
    setDrillHazard(usable ?? hazardTypes[0] ?? null);
  }, [district.id, hazardTypes]);

  const hazardType = mode === "event" ? (activeEvent?.hazardType ?? null) : drillHazard;
  const threshold = WATER_THRESHOLDS[district.id] ?? null;
  const conditionSpec = hazardType ? conditionSpecOf(district.id, hazardType) : null;
  const unit = conditionSpec?.unit ?? activeEvent?.unit ?? "";

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

  /* 위험요소 레이어 2종 — 서항 한정 · 기본 켜짐 (04 §9 · §1-1) */
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

  /* ── 기준 조건 ──────────────────────────────────────────────────────────
     사건 연계는 **현재 시각의 계측**이 기준이다("지금 이렇고, 19:10 이면 이렇게 된다").
     모의분석은 관측이 없으므로 그 지구가 발령을 내는 지점(경보 기준)을 붙박이로 둔다 —
     계획·훈련이 묻는 것이 "발령 수준에서 대피 수준으로 가면 얼마나 커지나"라서다 */
  const observed = activeView?.value ?? null;
  const baselineValue = mode === "event" ? observed : (threshold?.warning ?? null);
  /* 열 머리 — 사건 연계는 시각으로, 모의분석은 조건 이름으로 읽는다. 시간축이 없는
     자리에 "17:16" 을 세우면 그 시각에 무슨 뜻이 있는 것처럼 보인다 */
  const baselineLabel =
    mode === "event"
      ? `현재 ${formatClock(now)}`
      : threshold
        ? `경보 ${threshold.warning.toFixed(2)}`
        : "기준";

  /* 조건값 초기화 — 지구·모드가 바뀌면 첫 장면을 다시 잡는다. 앞 마을에서 올려 둔 물이
     남으면 다음 마을이 이미 잠긴 채로 열린다.

     사건 연계는 **현재 계측**에서 연다 — S4 가 "현재를 보고 조건을 올려 비교"라 첫 장면이
     지금이어야 한다(03 §5 · 차수 K).
     모의분석은 **대피 기준**에서 연다. 발령 기준(경보)에서 열면 영향표가 아직 0 인 지구가
     있어(봉암은 4.02 부터 · 04 §15-8) 첫 화면이 통째로 0 으로 뜬다. 계획·훈련이 먼저
     묻는 것도 "대피 기준에 닿으면 어디까지인가"라 그 조건이 열린 화면의 기본값이다 */
  const openingValue = mode === "event" ? observed : (threshold?.evacuate ?? null);
  useEffect(() => {
    if (openingValue != null) {
      setLevel(openingValue);
      setLayers((prev) => (prev.flood ? prev : { ...prev, flood: true }));
    } else {
      setLevel(0);
    }
  }, [district.id, mode, openingValue]);

  /* 레이어 토글 반영 */
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    setBuildings3D(instance, layers.buildings3d);
    setTerrain(instance, layers.terrain);
    setHillshadeVisible(instance, layers.hillshade);
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
    if (mode === "drill") return drillBasisOf(threshold, unit, now);
    if (scenario) return analysisBasisOf(scenario, now, observed, unit);
    return observedBasisOf(threshold, unit, now, observed);
  }, [mode, threshold, unit, now, scenario, observed]);

  /* ── 시간축 (03 §5) ──────────────────────────────────────────────────────
     사건 연계의 주 조작축. 시각을 옮기면 예상 수위·영향·대응 대상이 함께 바뀐다.
     모의분석에는 서지 않는다 — 관측도 예보도 없어 "언제"가 뜻을 못 가진다 */
  const timeline = useMemo(
    () =>
      mode === "event" && activeEvent && observed != null
        ? timelineOf(activeEvent, scenario, now, observed)
        : null,
    [mode, activeEvent, scenario, now, observed],
  );
  /* 어느 눈금을 짚었나.
     ★ 값이 아니라 **id** 로 기억한다. 서항은 17:22 격상값과 17:29 현재값이 둘 다 3.41 이라
       (그 사이 단계가 안 움직였으니 당연하다) 값으로 되찾으면 [경보 격상]을 눌러도 선택이
       [현재]로 튄다. 누른 칩이 안 켜지면 조작이 먹지 않은 것으로 읽힌다.
     상세 조건으로 손수 밀면 id 를 놓고, 그때는 값으로 되찾아 눈금 밖이면 undefined 가 된다 */
  const [pickedMarkId, setPickedMarkId] = useState<string | null>(null);
  const selectedMark = timeline
    ? (pickedMarkId
        ? timeline.marks.find(
            (mark) => mark.id === pickedMarkId && Math.abs(mark.value - level) < 0.005,
          )
        : undefined) ?? markOfValue(timeline, level)
    : undefined;

  /* 조건 프리셋 — 시간축이 선 뒤로 사건 연계에서는 상세 조건 안쪽 보조가 됐다.
     발령 기준 세 점은 두 모드가 같이 쓴다 */
  const presets = useMemo(
    () => (threshold ? thresholdPresetsOf(threshold) : undefined),
    [threshold],
  );

  /* 조건을 밀면 영향 층이 따라 켜진다 — 값은 움직이는데 화면이 안 변하면 조작이 죽은
     것으로 읽힌다. "레이어에서 켜세요" 안내로 사용자를 돌려보내지 않는다 */
  const changeLevel = (next: number) => {
    setLevel(next);
    setLayers((prev) => (prev.flood ? prev : { ...prev, flood: true }));
  };

  /* 시간축 눈금 짚기 — 값과 함께 어느 눈금인지도 기억한다 */
  const pickMark = (mark: TimeMark) => {
    setPickedMarkId(mark.id);
    changeLevel(mark.value);
  };

  /* 상세 조건으로 손수 밀기 — 눈금에서 벗어난다 */
  const pushCondition = (next: number) => {
    setPickedMarkId(null);
    changeLevel(next);
  };

  const setLayer = (id: keyof LayerState) =>
    setLayers((prev) => ({ ...prev, [id]: !prev[id as keyof LayerState] }));

  const openDistrict = (next: District) => navigate(`/scr-05/${next.id}`);

  /* ── 완료 동작 — 모드마다 저장처가 갈린다 (02 §2) ────────────────────────
     사건 연계: 트윈은 판단을 확정하지 않는다. 조건·영향·근거를 사건에 붙일 뿐이고,
       권고 대응과 SOP 대상을 구체화하는 것은 SCR-02 의 몫이다. 그래서 버튼도 "이 판단으로
       대응하기"가 아니라 "분석 결과를 사건에 반영"이다 — 무엇이 저장되는지가 문안에 있다.
     사전 모의분석: 모의분석안으로만 남는다. 사건 id 를 들지 않아 대응 등급·타임라인·
       전파 원장 어디에도 닿지 않는다 */
  const drills = useDrills(district.id);
  const canFinish = Boolean(selected && basis && hazardType);

  const applyToEvent = () => {
    if (!activeEvent || !selected || !basis || !hazardType) return;
    const snapshot: AnalysisSnapshot = {
      districtId: district.id,
      eventId: activeEvent.id,
      hazardType,
      conditionValue: level,
      conditionLabel: `${level.toFixed(2)} ${unit}`,
      baseline,
      impact: selected,
      basis,
    };
    applyAnalysis(snapshot);
    toast.success("분석 결과를 사건에 반영했습니다", {
      /* 대피 대상은 카드와 같은 말로 적는다 — 한쪽이 "0명", 다른 쪽이 "없음"이면
         같은 값을 두 번 말한 것으로 안 읽힌다 */
      description: `${level.toFixed(2)} ${unit} 조건 · 영향 건물 ${selected.buildings}동 · 대피 대상 ${selected.evacuees > 0 ? `${selected.evacuees}명` : "없음"}`,
    });
    navigate(`/scr-02/${activeEvent.districtId}?event=${activeEvent.id}`);
  };

  const saveDrillResult = () => {
    if (!selected || !basis || !hazardType) return;
    const snapshot: DrillSnapshot = {
      districtId: district.id,
      districtName: district.name,
      hazardType,
      conditionValue: level,
      conditionLabel: `${level.toFixed(2)} ${unit}`,
      baseline,
      baselineLabel,
      impact: selected,
      basis,
      savedAt: now,
    };
    saveDrill(snapshot);
    toast.success("모의분석 결과를 저장했습니다", {
      description: `${district.name} ${hazardType} · ${level.toFixed(2)} ${unit} · 실제 사건에는 반영되지 않습니다`,
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

      {/* 좌상단 — 화면 이름 · 모드 · 분석 대상.
          모드가 여기 서야 한다. 두 모드는 레일 모양이 거의 같아서, 무엇을 하는 중인지가
          화면 맨 위에 없으면 훈련 결과와 실제 사건 분석을 눈으로 못 가른다 */}
      <div className="pointer-events-none absolute left-3 top-3 z-30">
        <GlassPanel className="pointer-events-auto">
          <div className="flex items-center gap-2 px-3 py-2">
            <button
              type="button"
              /* 돌아갈 곳도 모드를 따른다 — 사건 연계는 그 사건의 재난관제로,
                 모의분석은 대응할 사건이 없으니 종합상황으로 */
              onClick={() => navigate(mode === "event" ? `/scr-02/${district.id}` : "/scr-01")}
              aria-label={mode === "event" ? "재난관제로" : "종합상황으로"}
              className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent text-foreground-subtle transition-colors hover:bg-surface-raised hover:text-foreground"
            >
              <Icon icon="mdi:arrow-left" className="size-4" aria-hidden />
            </button>
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center gap-1.5">
                <h1 className="shrink-0 text-h6 font-semibold text-foreground">디지털트윈</h1>
                <Badge variant={mode === "event" ? "default" : "gray"} className="shrink-0">
                  {MODE_LABEL[mode]}
                </Badge>
              </div>
              <span className="truncate text-caption text-foreground-muted">
                {subject}
                <span className="text-foreground-subtle"> · {district.target}</span>
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
              title: "씬 표현",
              items: SCENE_ITEMS.map((item) => ({
                id: item.id,
                label: item.label,
                visible: layers[item.id] as boolean,
              })),
              onToggle: (id) => setLayer(id as keyof LayerState),
              onSetAll: (visible) =>
                setLayers((prev) => ({
                  ...prev,
                  ...Object.fromEntries(SCENE_ITEMS.map((item) => [item.id, visible])),
                })),
            },
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
              note: "재난관제에서 넘어온 선택 장비는 종류를 꺼도 자리에 남는다",
            },
            /* 위험요소 — 등재된 지구(서항)에서만 온다. 빈 지구에 묶음을 세우지 않는다(04 §1-1) */
            ...(hazards.length > 0
              ? [
                  {
                    title: "위험요소",
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
              items: IMPACT_ITEMS.map((item) => ({
                id: item.id,
                label: item.label,
                visible: layers[item.id] as boolean,
              })),
              onToggle: (id) => setLayer(id as keyof LayerState),
              onSetAll: (visible) =>
                setLayers((prev) => ({
                  ...prev,
                  ...Object.fromEntries(IMPACT_ITEMS.map((item) => [item.id, visible])),
                })),
              note: "해안침수예상도는 행정안전부 생활안전지도 · 실시간 타일",
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
              />
            )}
          </GlassPanel>

          {/* 주 조작축. 사건 연계는 시간축이고, 모의분석은 예보가 없어 조건축이 그대로다 */}
          {timeline ? (
            <>
              <GlassPanel className="pointer-events-auto shrink-0">
                <TimelinePanel
                  timeline={timeline}
                  selected={selectedMark}
                  onSelect={pickMark}
                />
              </GlassPanel>

              {/* 조건은 시각을 만드는 세부라 접어 둔다 — 기본 조작은 시간, 고급 조작이
                  수위다(03 §5). 펼쳐 손수 밀면 시간축 눈금에서 벗어나 "사용자 조건"이 된다 */}
              <div ref={conditionRef} className="shrink-0">
              <CollapsibleSection
                className="pointer-events-auto border-border"
                bodyClassName="pb-1"
                headerClassName="px-3"
                collapsed={!conditionOpen}
                onToggle={() => setConditionOpen((prev) => !prev)}
                trailingChevron
                trigger={
                  <span className="flex items-center gap-1.5 text-caption text-foreground-muted">
                    <Icon icon="mdi:tune-variant" className="size-4 shrink-0" aria-hidden />
                    상세 조건 조정
                    {!selectedMark && (
                      <span className="text-primary-text">· 사용자 조건 {level.toFixed(2)}</span>
                    )}
                  </span>
                }
              >
                <ConditionPanel
                  districtId={district.id}
                  hazardType={hazardType}
                  value={level}
                  onChange={pushCondition}
                  marker={
                    scenario ? { value: scenario.peak, label: scenario.peakLabel } : undefined
                  }
                  presets={presets}
                />
              </CollapsibleSection>
              </div>
            </>
          ) : (
            <GlassPanel className="pointer-events-auto shrink-0">
              <ConditionPanel
                districtId={district.id}
                hazardType={hazardType}
                value={level}
                onChange={changeLevel}
                presets={presets}
              />
            </GlassPanel>
          )}

          {selected && (
            <GlassPanel className="pointer-events-auto shrink-0">
              <ImpactResultCard
                baseline={baseline}
                selected={selected}
                baselineLabel={baselineLabel}
                /* 사건 연계는 선택한 **시각**이 열 머리다. 눈금을 벗어나 손수 민 값이면
                   시각이 없으므로 조건값으로 되돌아간다 */
                selectedLabel={
                  timeline
                    ? selectedMark
                      ? `${formatClock(selectedMark.at)} ${selectedMark.label}`
                      : `사용자 조건 ${level.toFixed(2)}`
                    : `선택 ${level.toFixed(2)}`
                }
                same={sameAsBaseline}
                /* 예상 수위가 결과의 첫 행 — 시간축이 주축이 되면서 조작 대상이던 값이
                   그 시각에 따라오는 결과로 자리를 옮겼다(03 §5) */
                condition={
                  conditionSpec
                    ? {
                        label: "예상 수위",
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
              모의분석에서는 네 줄 중 셋이 다른 데서 이미 한 말이었다 — 발령 기준은 조건
              슬라이더가(경보 구간 · 프리셋 세 개), "가상 조건"은 설정 카드와 저장 버튼 아래가,
              산출표는 바로 위 영향 결과가 말한다. "설정한 조건이 성립한다고 가정"에 이르면
              사용자가 세운 조건이니 동어반복이다.
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
            <>
              <Button
                className="pointer-events-auto w-full"
                disabled={!canFinish}
                onClick={applyToEvent}
              >
                <Icon icon="mdi:content-save-move-outline" className="size-4" aria-hidden />
                분석 결과를 사건에 반영
              </Button>
              <Button
                variant="outline"
                className="pointer-events-auto w-full"
                onClick={() =>
                  navigate(
                    activeEvent
                      ? `/scr-02/${activeEvent.districtId}?event=${activeEvent.id}`
                      : `/scr-02/${district.id}`,
                  )
                }
              >
                대응 판단으로 돌아가기
              </Button>
            </>
          ) : (
            <>
              <Button
                className="pointer-events-auto w-full"
                disabled={!canFinish}
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
