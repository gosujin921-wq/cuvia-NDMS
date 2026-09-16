/* ─────────────────────────────────────────────
 * 모의훈련 본체 — 준비 → 판단 → 결과 → 강평 (README §2.3 · 03 §26 · 2026-09-16 v2)
 *
 * 뼈대는 이것이다(03 §26.1).
 *   시나리오가 시간에 따라 전개된다        지도가 정지점마다 바뀐다
 *     └ 단계마다 규정이 뜬다               발동한 SOP
 *         └ 조치를 실행한다                [실행] · 되돌리기
 *             └ 시간이 흐르고 결과가 나온다  결과 국면
 *                 └ 강평 · 개선 항목        고칠 거리
 *
 * ★ v1(예측판 비교 + 잠금 + 질문 하나)을 대신한다. v1은 Phase 1 화면에 잠금을 씌운 것이라
 *   훈련 고유의 것(전개 · 규정 발동 · 조치 입력)이 없었다.
 * ★ 사건·조건은 query 가 들고 **훈련 진행(지금 정지점 · 내 조치)은 세션이 든다**(03 §26 · E-10).
 *   새로고침하면 훈련이 처음으로 돌아간다. 조치 목록은 길고 자주 바뀌어 주소에 싣지 않는다.
 * ★ 안 한 조치는 **실제와 같은 시각에 한 것**으로 본다. 아무 조치도 안 한 판은 만들지 않는다.
 * ───────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import maplibregl from "maplibre-gl";
import { Button, GlassPanel, Notice, Tag, cn } from "@ds";
import { useMapLibre } from "../../lib/useMapLibre";
import { CENTER_LEFT, CENTER_RIGHT, LEFT_RAIL, RAIL_BASE, RIGHT_RAIL, UTIL_STRIP, utilStripStyle } from "../../lib/layout";
import { ensureHillshade, setBuildings3D, setHillshadeVisible, setTerrain } from "../../lib/flood-scene";
import { depthLevel, extentPaint, scopePaint, setPolygonLayerVisible, upsertPolygonLayer } from "../../lib/map-polygon";
import { ensureFloodSurface, setFloodSurface } from "../../lib/flood-surface";
import { loadTerrainFine, type TerrainGrid, type TerrainPatch } from "../../lib/terrain-grid";
import { floodSurfaceOf } from "../../lib/flood-surfaces";
import { captureMap } from "../../lib/map-capture";
import { formatMarkMetric, markMetricLabel, markOf, minutesBetween } from "../../lib/forecast-twin";
import { formatClock } from "../../lib/datetime";
import { CITY_CENTER } from "../../lib/map-config";
import { GEOMETRIES, SCOPE_ZOOM } from "../../fixtures";
import { findWhatIfCase, trainingResultOf, trainingSopsAt, whatIfStateRowsAt } from "../../model/selectors";
import { TWIN_FAMILY_HAZARD_NAME } from "../../model/twin-family";
import type { Forecast } from "../../model/forecast";
import { useScenario } from "../../state/ScenarioProvider";
import { MapUtilStrip } from "../../components/MapUtilStrip";
import { usePrecipitationLayer } from "../../lib/usePrecipitationLayer";
import { cssColor } from "../../lib/map-polygon";
import { MapLegend } from "../../components/twin/MapLegend";
import { ContextInset, insetKindOf } from "../../components/twin/ContextInset";
import { SceneLayers, raiseSceneLayers } from "../../components/twin/SceneLayers";
import { mergeScene } from "../../model/scene";
import { TrainingClock } from "./widgets/TrainingClock";
import { TrainingActions } from "./widgets/TrainingActions";
import { TrainingDebrief, debriefHeadline, debriefRowsOf } from "./widgets/TrainingDebrief";
import { ConditionSlider } from "./widgets/ConditionSlider";

const TWIN_ZOOM = SCOPE_ZOOM.구역 + 0.8;
const FIT_MARGIN = 32;
const SCOPE_SOURCE = "twin-scope";
const EXTENT_SOURCE = "twin-extent";
/** 조치를 안 했다면 잠겼을 범위 — 점선으로 함께 세운다. 그 안쪽인데 물이 안 찬 곳이 "내가 막은 곳"이다 */
const BASE_EXTENT_SOURCE = "twin-extent-base";
/** 훈련 기록의 작성자 — 시연 사용자(레이아웃 좌하단) */
const OFFICER = "김상황";

/**
 * 정지점 사이를 흐르는 시간 — **실제 경과 1분당 100 ms**.
 *
 * 구간마다 실제 간격이 다르다(20분 · 35분 · 30분). 전부 같은 길이로 흘리면 시계가 거짓말을 한다 —
 * 20분과 35분이 같은 속도로 지나가고, 물이 차오르는 속도도 구간의 성격과 어긋난다.
 * 비례시키면 수위가 가파르게 오르는 구간은 그만큼 오래 흘러 "물이 온다"가 읽힌다.
 * 위아래를 묶는 것은 시연 호흡이다. 너무 짧으면 점프로 보이고 너무 길면 기다리게 된다.
 */
const FLOW_MS_PER_MIN = 100;
const FLOW_MS_MIN = 1400;
const FLOW_MS_MAX = 4200;
const flowMsOf = (from: string, to: string): number => {
  const min = (new Date(to).getTime() - new Date(from).getTime()) / 60_000;
  return Math.min(FLOW_MS_MAX, Math.max(FLOW_MS_MIN, min * FLOW_MS_PER_MIN));
};

export function TrainingView({ incidentId, onBackToList }: { incidentId: string; onBackToList: () => void }) {
  const [params, setParams] = useSearchParams();
  const { agentOpen, improvements, addImprovement, removeImprovement, saveTrainingRun } = useScenario();
  const wcase = findWhatIfCase(incidentId) ?? null;
  const t = wcase?.training ?? null;

  /* ── 사건·조건은 주소가, 훈련 진행은 세션이 든다 ── */
  const condStepId = params.get("cond") ?? t?.conditions[0]?.steps[0]?.id ?? "now";
  const started = params.get("run") === "1";
  const [stopIndex, setStopIndex] = useState(0);
  const [acts, setActs] = useState<Record<string, string>>({});
  const [replayAt, setReplayAt] = useState<number | null>(null);
  const phase: "prepare" | "drill" | "debrief" = !started ? "prepare" : replayAt !== null ? "debrief" : "drill";

  const stops = t?.stops ?? [];
  /**
   * 정지점 사이를 흐르는 중 — 진행도 p 는 아래 rAF 가 민다.
   * ★ 출발점 `from` 을 **흐름이 직접 든다.** 움직이는 `stopIndex` 로 출발 시각을 셈하면
   *   흐름이 끝나며 stopIndex 가 바뀌는 찰나에 시계가 앞뒤로 튄다(14:55 에서 눌렀는데 14:54).
   */
  const [flow, setFlow] = useState<{ from: number; to: number; p: number } | null>(null);
  const flowing = flow !== null;
  const index = phase === "debrief" ? replayAt ?? stops.length - 1 : stopIndex;
  const stop = stops[index] ?? null;
  /**
   * 지도가 서는 정지점 — **흐르는 동안은 목적지**다.
   *
   * 예전에는 흐름 내내 출발 정지점의 눈금에 머물러, 2.6초 동안 수면 높이만 오르고
   * 하천 선 색·도로 상태·수위계 마커는 끝나는 순간 한꺼번에 점프했다(2026-09-16 측정).
   * "시계가 흐르며 지도가 바뀐다"는 결과 국면의 약속인데 지도의 절반만 흐른 셈이다.
   * 이제 [다음 단계]를 누르면 상황이 먼저 바뀌고 **물이 그 위로 차오른다** — 끝에 점프가 없다.
   * 조치 패널은 출발 정지점(`stop`)을 그대로 쓴다. 흐르는 동안은 어차피 조치를 받지 않는다.
   */
  const mapStop = (flow ? stops[flow.to] : stop) ?? null;
  const condStep = t?.conditions[0]?.steps.find((s) => s.id === condStepId) ?? null;
  /** 조건의 완성된 이름 — "강우 +20%" · "열대야 +2°C". 화면·기록·보고서가 이 하나를 쓴다(유형 이름을 화면이 붙이지 않는다) */
  const condLabel = t?.conditions[0] && condStep ? `${t.conditions[0].label} ${condStep.label}` : "당시 조건";

  /* 내 조치가 만든 판과 기준 판 — 기준은 같은 조건에서 실제와 같게 했을 때다(03 §26.7) */
  const { mine, base } = useMemo(
    () => (wcase ? trainingResultOf(wcase, condStepId, acts) : { mine: null, base: null }),
    [wcase, condStepId, acts],
  );
  /**
   * 지도가 그리는 판 — **조치 전 / 조치 후를 번갈아 본다**(2026-09-16 사용자).
   * 비가 와서 하천이 차오르고 넘치는 것이 사건이고, 훈련의 답은 "내 조치로 그게 어떻게 달라졌나"다.
   * 점선을 겹쳐 두는 것만으로는 약하다 — 같은 시각의 두 장면을 바꿔 보면 차이가 수면으로 보인다.
   */
  const [view, setView] = useState<"mine" | "base">("mine");
  const changed = Boolean(mine && base && mine.forecastId !== base.forecastId);
  const shown: Forecast | null = (changed && view === "base" ? base : mine) ?? base;
  /* 준비 화면에서는 눈금을 잡지 않는다 — 조건을 바꿀 때 지도가 결과를 미리 말하면 훈련이 아니다.
     조건이 무엇을 바꾸는지는 슬라이더 아래 한 줄("최대 35 → 53 mm/h")이 말한다 */
  const shownMark = shown && mapStop && started ? markOf(shown, mapStop.at) : null;

  /* 이 정지점에서 고를 수 있는 조치 */
  const actionRows = useMemo(
    () => (wcase && stop && stop.phase === "판단" ? trainingSopsAt(wcase, stop.at, acts) : []),
    [wcase, stop, acts],
  );
  /**
   * 그 시각 상태 — 훈련 조건이 바꾸는 줄은 **배율로 환산해** 보인다.
   * 강우를 +20%로 훈련하는데 강우계가 당시 값 그대로면 모순이다. 조건의 정의가 "당시 강우 × 1.2"라
   * 그 값이 화면에 서는 것이 맞다(2026-09-16 사용자). 나머지 줄은 당시 기록 그대로다.
   */
  const state = useMemo(() => {
    if (!wcase || !stop) return null;
    const raw = whatIfStateRowsAt(wcase, stop.at);
    const cond = t?.conditions.find((c) => c.stateLabel);
    const f = condStep?.factor ?? 1;
    /* 유형 핵심 지표(합류부 수위)는 **관측이 아니라 계산 결과**다 — 조건과 조치를 반영한 판의 값을 쓴다.
       stateByTime 은 당시 관측이라 조건을 바꿔도 그대로다. 그 값을 그냥 두면 지도와 어긋난다(2026-09-16) */
    const metricLabel = shownMark ? markMetricLabel(shownMark) : null;
    const rows = raw.rows.map((r) => {
      /* 눈금이 이 정지점보다 뒤면 아직 그 값이 아니다 — 관측 기록을 그대로 둔다 */
      if (metricLabel && shownMark && shownMark.validAt <= stop.at && r.label === metricLabel) {
        return { ...r, value: formatMarkMetric(shownMark), computed: true } as typeof r & { computed?: boolean };
      }
      /* 조건이 바꾸는 관측 줄(강우계)은 배율로 환산한다 — 조건의 정의가 "당시 × 1.2"다 */
      if (cond?.stateLabel && f !== 1 && r.label === cond.stateLabel) {
        const n = Number.parseFloat(r.value);
        if (!Number.isFinite(n)) return r;
        const unit = r.value.replace(/^[\d.]+\s*/, "");
        return { ...r, value: `${Math.round(n * f)} ${unit}`.trim(), scaled: true } as typeof r & { scaled?: boolean };
      }
      return r;
    });
    return { ...raw, rows };
  }, [wcase, stop, t, condStep, shownMark]);

  /* ── 지도 ── */
  const family = wcase?.twinFamily ?? "B";
  const center = wcase?.scope.displayAnchor ?? CITY_CENTER;
  const mapContainer = useRef<HTMLDivElement>(null);
  const { map, ready } = useMapLibre(mapContainer, { center, zoom: TWIN_ZOOM, pitch: 0, capture: true });
  /* ── 레이어 토글 (지금 구현과 같은 스트립) ──
   * 훈련 조건이 강우를 올렸으면 그것이 지도에서도 보여야 한다. 다만 강수 색면은 범람면과 색이 싸우므로
   * 기본은 꺼 두고 스트립에서 켠다(03 §22 A "물 유형은 수면이 주인공"). 광역 인셋은 늘 강우를 든다.
   */
  const [layers, setLayers] = useState({ scope: true, extent: true, rain: false, baseline: true });
  const weatherHour = new Date(stop?.at ?? wcase?.occurredAt ?? Date.now()).getHours();
  usePrecipitationLayer(map, ready, layers.rain, weatherHour);
  const scopeRing = wcase?.scope.affectedGeometryId ? GEOMETRIES[wcase.scope.affectedGeometryId] : undefined;
  const fitPoints = useMemo<[number, number][]>(
    () => (scopeRing && scopeRing.length > 0 ? scopeRing : wcase ? [wcase.scope.displayAnchor] : []),
    [scopeRing, wcase],
  );
  const focusScope = useCallback((duration: number) => {
    const m = map.current;
    if (!m) return;
    const padding = { top: FIT_MARGIN, bottom: FIT_MARGIN + 92, left: CENTER_LEFT + FIT_MARGIN, right: CENTER_RIGHT + FIT_MARGIN };
    if (fitPoints.length > 1) {
      const b = fitPoints.reduce((acc, p) => acc.extend(p), new maplibregl.LngLatBounds(fitPoints[0], fitPoints[0]));
      m.fitBounds(b, { padding, pitch: 0, bearing: 0, duration });
      return;
    }
    m.easeTo({ center, zoom: TWIN_ZOOM, pitch: 0, bearing: 0, padding, duration });
  }, [map, center, fitPoints]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    ensureHillshade(m);
    setBuildings3D(m, true);
    setTerrain(m, true);
    setHillshadeVisible(m, true);
    focusScope(800);
  }, [map, ready, focusScope]);

  /* 같은 시각에 **조치를 안 했다면** 어디까지 잠겼나 — 애니메이션의 목적 ②(03 §26.7).
     내 조치 판만 그리면 "무엇이 달라졌나"가 지도에 없다. 점선 안쪽인데 물이 안 찬 곳이 내가 막은 곳이다. */
  const baseMark = base && mapStop && started && mine && mine.forecastId !== base.forecastId ? markOf(base, mapStop.at) : null;

  /* ── 시간 흐름 (03 §26.1 "시나리오가 시간에 따라 전개된다") ──
   * 정지점을 툭툭 갈아 끼우면 스냅샷 네 장이지 전개가 아니다. 지형 수면의 수위(m)는 연속 값이라
   * 두 정지점 사이를 보간하면 **물이 차오르는 것**이 보인다. 방류를 했으면 그 판의 수위를 쓰므로 덜 차오른다.
   * 격자 채우기가 매 프레임이면 무거워 ~120ms 간격으로만 갱신한다.
   */
  /**
   * 그 정지점의 수위(m).
   * ★ 첫 눈금보다 이른 정지점(14:35 · 14:55)은 **아직 그 눈금의 물이 아니다** — 예측판의 첫 눈금을
   *   당겨 쓰면 훈련 시작부터 이미 잠긴 지도를 보게 된다. 그때는 그 시각 관측 수위를 쓴다.
   *   그래야 판단 국면에서도 물이 조금씩 오르고, 두 정지점 사이가 정지 화면이 되지 않는다(2026-09-16 측정).
   */
  const levelAt = useCallback((i: number): number | null => {
    const st = stops[i];
    if (!shown || !st || !wcase) return null;
    const m = markOf(shown, st.at);
    if (!m) return null;
    if (m.validAt > st.at) {
      const label = markMetricLabel(m);
      const raw = whatIfStateRowsAt(wcase, st.at).rows.find((r) => r.label === label)?.value;
      const v = Number.parseFloat(raw ?? "");
      if (Number.isFinite(v)) return v;
    }
    return floodSurfaceOf(m.extentGeometryId)?.spec.level ?? null;
  }, [shown, stops, wcase]);
  useEffect(() => {
    if (!flow) return;
    const from = stops[flow.from], to = stops[flow.to];
    if (!from || !to) return;
    const span = flowMsOf(from.at, to.at);
    let raf = 0, last = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / span);
      if (p >= 1) { setStopIndex(flow.to); setFlow(null); return; }
      if (now - last > 120) { last = now; setFlow((f) => (f ? { ...f, p } : f)); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow?.from, flow?.to]);
  /**
   * 흐르는 동안 보이는 시각 — 두 정지점 사이를 분 단위로.
   * ★ **분으로 반올림한다.** 그냥 자르면 흐름 첫 프레임이 출발 시각보다 1분 앞서 찍혀
   *   14:55 에서 [다음 단계]를 눌렀는데 14:54 가 뜬다 — 시간이 거꾸로 가 보인다(2026-09-16 측정).
   */
  const flowClock = (() => {
    const from = flow ? stops[flow.from] : null, to = flow ? stops[flow.to] : null;
    if (!flow || !from || !to) return null;
    const a = new Date(from.at).getTime(), b = new Date(to.at).getTime();
    return new Date(Math.round((a + (b - a) * flow.p) / 60_000) * 60_000).toISOString();
  })();
  /** 흐르는 동안의 수위 — 두 눈금 사이를 보간한다 */
  const flowLevel = (() => {
    if (!flow) return null;
    const a = levelAt(flow.from), b = levelAt(flow.to);
    if (a === null || b === null) return null;
    return a + (b - a) * flow.p;
  })();

  /* 판을 바꿔 볼 때도 수면이 뛰지 않고 흐른다 — 줄고 느는 것이 눈에 보여야 차이가 읽힌다 */
  const easeRef = useRef<number | null>(null);
  const [easeLevel, setEaseLevel] = useState<number | null>(null);
  useEffect(() => {
    if (flow) return;
    const target = levelAt(index);
    if (target === null) { easeRef.current = null; setEaseLevel(null); return; }
    const from = easeRef.current;
    if (from === null || Math.abs(from - target) < 0.02) { easeRef.current = target; setEaseLevel(target); return; }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 600);
      const v = from + (target - from) * p;
      easeRef.current = v;
      setEaseLevel(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shownMark, flow, index, levelAt]);
  useEffect(() => { if (flowLevel !== null) easeRef.current = flowLevel; }, [flowLevel]);
  const drawLevel = flowLevel ?? easeLevel;

  /* 지형을 채운 침수면 — 훈련이 시작된 뒤에만 그린다(준비 화면은 범위만) */
  const surfaceGeometryId = phase !== "prepare" && shownMark ? shownMark.extentGeometryId : null;
  const surfaceEntry = useMemo(() => floodSurfaceOf(surfaceGeometryId), [surfaceGeometryId]);
  const [fineGrid, setFineGrid] = useState<TerrainGrid | null>(null);
  useEffect(() => {
    if (!surfaceEntry || fineGrid) return;
    let cancelled = false;
    loadTerrainFine().then((g) => { if (!cancelled) setFineGrid(g); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [surfaceEntry, fineGrid]);
  const finePatch: TerrainPatch | null = surfaceEntry && fineGrid ? fineGrid.patches[surfaceEntry.patchId] ?? null : null;

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const extentRing = phase !== "prepare" && shownMark ? GEOMETRIES[shownMark.extentGeometryId] : null;
    upsertPolygonLayer(m, SCOPE_SOURCE, scopeRing, scopePaint());
    const paint = extentPaint(shownMark ? depthLevel(shownMark.maxDepthM) : 0.4, "water");
    ensureFloodSurface(m);
    if (surfaceEntry && finePatch) {
      /* 흐르는 중에는 보간한 수위로 채운다 — 물이 차오르는 것이 보인다 */
      setFloodSurface(m, finePatch, drawLevel !== null ? { ...surfaceEntry.spec, level: drawLevel } : surfaceEntry.spec, layers.extent);
      upsertPolygonLayer(m, EXTENT_SOURCE, extentRing, { ...paint, opacity: 0 });
    } else {
      setFloodSurface(m, null, null, false);
      upsertPolygonLayer(m, EXTENT_SOURCE, extentRing, paint);
    }
    /* 조치 안 했다면 — 점선 외곽만. 채우지 않는다(내 수면이 주인공) */
    /* 두 장면을 바꿔 보는 중에는 점선을 끈다 — 둘 다 보이면 무엇이 무엇인지 헷갈린다 */
    const baseRing = layers.baseline && baseMark && view === "mine" ? GEOMETRIES[baseMark.extentGeometryId] : null;
    upsertPolygonLayer(m, BASE_EXTENT_SOURCE, baseRing, { ...extentPaint(0.1, "water"), fill: cssColor("--color-warning", "#f59e0b"), line: cssColor("--color-warning", "#f59e0b"), opacity: 0 });
    setPolygonLayerVisible(m, SCOPE_SOURCE, layers.scope);
    setPolygonLayerVisible(m, EXTENT_SOURCE, layers.extent && Boolean(extentRing));
    setPolygonLayerVisible(m, BASE_EXTENT_SOURCE, Boolean(baseRing));
    raiseSceneLayers(m);
  }, [map, ready, scopeRing, shownMark, baseMark, view, phase, surfaceEntry, finePatch, layers.scope, layers.extent, layers.baseline, drawLevel]);

  const sceneLayers = useMemo(() => mergeScene(shown?.scene, shownMark?.scene), [shown, shownMark]);
  /**
   * 그 장면이 아는 바람 — 광역 인셋이 이 값으로 흐른다.
   * 인셋의 기본 자료는 태풍 솔릭 한 사건의 광역 격자라, 다른 사건에 깔면 메인 지도의 풍향 화살표와
   * **반대로 흐른다**(2026-09-17 무학산에서 화살표 80° ↔ 입자 309°). 장면이 바람을 들고 있으면 그것이 이긴다.
   */
  const sceneWind = useMemo(() => {
    const v = (sceneLayers ?? []).find((l) => l.kind === "vector" && l.role === "풍향");
    return v && v.kind === "vector" ? { bearing: v.bearing, speed: v.magnitude } : null;
  }, [sceneLayers]);



  /* ── 조작 ── */
  /**
   * ★ **지금 주소창을 읽어서 고친다.** 렌더 시점의 `params` 를 베껴 쓰면, 조건을 고른 직후
   * (아직 다시 그려지기 전에) [훈련 시작]을 누를 때 낡은 스냅샷이 `cond` 를 되돌린다.
   * 지도 전환이 무거워 다시 그리는 데 1초 가까이 걸리므로 실제로 일어난다(2026-09-16 검증에서 발견).
   * react-router 7.18 의 함수형 업데이터도 **렌더 시점 값**을 넘겨주므로 그것으로는 못 막는다
   * (`useSearchParams` → `nextInit(new URLSearchParams(searchParams))`). 주소창만이 항상 최신이다.
   */
  const setQuery = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) { if (v === null) next.delete(k); else next.set(k, v); }
    setParams(next, { replace: true });
  };
  const start = () => { setStopIndex(0); setActs({}); setReplayAt(null); setSavedId(null); startedAt.current = new Date().toISOString(); setQuery({ run: "1" }); };
  const restart = () => { setStopIndex(0); setActs({}); setReplayAt(null); setSavedId(null); setQuery({ run: null }); };
  /** 훈련 한 회를 저장한다 — 판 id 와 보고서용 표시값을 둘 다 담는다(03 §26.9) */
  const [savedId, setSavedId] = useState<string | null>(null);
  const startedAt = useRef(new Date().toISOString());
  const save = () => {
    if (!wcase || !t || !base || savedId) return;
    const run = saveTrainingRun({
      incidentId: wcase.incidentId,
      incidentTitle: wcase.title,
      conditionStepIds: condStep ? [condStep.id] : [],
      conditionLabel: condLabel,
      stops: t.stops.map((s) => ({ at: s.at, phase: s.phase, note: s.note })),
      /* 안 한 규정도 담는다 — 보고서에서 "안 함 · 실제와 같게"가 한 줄로 서야 한다 */
      sopRows: (wcase.sop ?? []).map((s) => ({
        id: s.id, label: s.label, firedAt: s.firedAt,
        mineAt: acts[s.id] ?? null,
        mineLagMin: acts[s.id] ? minutesBetween(s.firedAt, acts[s.id]) : null,
        realLagMin: s.actedAt ? minutesBetween(s.firedAt, s.actedAt) : null,
      })),
      resultForecastId: (mine ?? base).forecastId,
      baselineForecastId: base.forecastId,
      rows: debriefRowsOf(mine, base),
      headline: debriefHeadline(mine, base, condLabel, Object.keys(acts).length === 0),
      stateRows: (state?.rows ?? []).map((r) => ({ label: r.label, value: r.value })),
      improvements: improvements.filter((x) => x.incidentId === wcase.incidentId).map(({ axis, text }) => ({ axis, text })),
      /* 저장 시점 지도 한 장 — 강평에서 누르므로 마지막 정지점의 화면이 담긴다 */
      mapImage: captureMap(map.current),
      author: OFFICER,
      startedAt: startedAt.current,
    });
    setSavedId(run.runId);
  };

  const next = () => {
    if (flowing) return;
    if (stopIndex >= stops.length - 1) { setReplayAt(stops.length - 1); return; }
    setFlow({ from: stopIndex, to: stopIndex + 1, p: 0 });
  };

  /* 시간은 [다음 단계]를 누를 때만 간다(검수 C-5). 자동 재생은 만들지 않는다 —
     흐르는 것은 애니메이션이지 진행이 아니다. 진행은 사람이 정한다(2026-09-16 사용자). */

  if (!wcase || !t) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md">
          <Notice variant="warning" title="이 사건은 훈련할 수 없습니다" description="훈련 시나리오(정지점·조건·발동 규정)가 아직 없습니다. 다른 사건으로 대체하지 않습니다." />
          <Button size="sm" variant="secondary" className="mt-2" onClick={onBackToList}>훈련 목록</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden bg-surface" style={{ isolation: "isolate" }} aria-label="훈련 3D 씬">
        <div ref={mapContainer} className="h-full w-full" />
        {/* 장면 층(하천 구간 상태 색 · 도로 상태 · 차단 지점)은 훈련이 시작된 뒤에만 선다.
            준비 화면에서 조건을 올릴 때 하천 선이 주황 → 빨강으로 바뀌면 결과를 미리 보여주는 것이 된다(2026-09-16 사용자) */}
        <SceneLayers map={map} ready={ready} layers={phase === "prepare" ? [] : sceneLayers} />
      </div>

      {/* 좌상단 광역 인셋 — 지금 구현에 있는 것을 그대로 쓴다 */}
      {insetKindOf(family) && (
        <div className="pointer-events-none absolute left-3 top-3 z-30" style={{ width: LEFT_RAIL }}>
          <ContextInset family={family} anchor={wcase.scope.displayAnchor} hour={new Date(stop?.at ?? wcase.occurredAt).getHours()} meta={stop ? formatClock(stop.at) : undefined} wind={sceneWind} />
        </div>
      )}

      {/* 조치 전 / 조치 후 — 같은 시각을 바꿔 본다. 수면이 줄고 느는 것이 곧 내 조치의 효과다 */}
      {changed && (phase === "debrief" || stop?.phase === "결과") && (
        <div className="pointer-events-none absolute top-3 z-30 flex justify-center" style={{ left: CENTER_LEFT, right: CENTER_RIGHT }}>
          <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-border bg-surface/95 p-0.5 backdrop-blur" role="group" aria-label="지도 보기">
            {(["base", "mine"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={cn("cursor-pointer rounded-md px-3 py-1.5 text-caption font-medium transition-colors",
                  view === v ? (v === "base" ? "bg-warning text-surface" : "bg-primary text-primary-foreground") : "text-foreground-muted hover:text-foreground")}
              >
                {v === "base" ? "조치 안 했다면" : "내 조치"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 좌하단 범례 — 조치를 실행하면 `조치` 줄이 함께 선다(지도에 표식이 서면 범례에 선다) */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20" style={{ width: LEFT_RAIL }}>
        <MapLegend
          depth={phase !== "prepare" && shownMark && layers.extent ? { label: "범람심" } : null}
          scope={layers.scope}
          rain={layers.rain}
          extent={layers.baseline && baseMark ? { label: "조치 안 했다면", tone: "ground" } : null}
          inset={insetKindOf(family)}
        />
      </div>

      {/* 하단 중앙 훈련 시계 */}
      {phase !== "prepare" && stop && (
        <div className="pointer-events-none absolute bottom-3 z-30" style={{ left: CENTER_LEFT + LEFT_RAIL + 12, right: CENTER_RIGHT }}>
          <TrainingClock stops={stops} index={index} replay={phase === "debrief"} onPick={(i) => setReplayAt(i)}
            flow={flow && flowClock ? { to: flow.to, p: flow.p, at: flowClock } : null}
            rising={mapStop?.phase === "결과"}
            waiting={!flowing && stop?.phase === "판단"} />
        </div>
      )}

      <div className={UTIL_STRIP} style={utilStripStyle(agentOpen)}>
        <MapUtilStrip
          map={map}
          disabled={!ready}
          homePitch={60}
          onReset={() => focusScope(500)}
          layers={[{
            title: "영향 표현",
            items: [
              { id: "scope", label: "사건 범위", color: cssColor("--color-danger", "#ef4444"), icon: "mdi:vector-polygon", shape: "area" as const, visible: layers.scope },
              { id: "extent", label: "범람 범위", color: cssColor("--color-primary-text", "#60a5fa"), icon: "mdi:waves", shape: "area" as const, visible: layers.extent },
              { id: "baseline", label: "조치 안 했다면", color: cssColor("--color-warning", "#f59e0b"), icon: "mdi:vector-polyline", shape: "area" as const, visible: layers.baseline },
              { id: "rain", label: "강우", color: cssColor("--color-rain", "#7c5cff"), icon: "mdi:weather-pouring", shape: "raster" as const, visible: layers.rain },
            ],
            onToggle: (id) => setLayers((p) => ({ ...p, [id as keyof typeof p]: !p[id as keyof typeof p] })),
            onSetAll: (visible) => setLayers({ scope: visible, extent: visible, rain: visible, baseline: visible }),
          }]}
        />
      </div>

      {/* 우측 레일 */}
      <div className={`${RAIL_BASE} right-3`} style={{ width: RIGHT_RAIL }}>
        <GlassPanel className="pointer-events-auto flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col divide-y divide-border overflow-y-auto overflow-x-hidden rounded-[inherit]">
            {phase === "prepare" ? (
              <>
                <section className="flex shrink-0 flex-col gap-1 p-3">
                  <header className="flex items-baseline justify-between gap-2">
                    <h2 className="text-body font-semibold text-foreground">고른 사건</h2>
                    <button type="button" onClick={onBackToList} className="shrink-0 cursor-pointer text-caption text-primary-text">바꾸기 ›</button>
                  </header>
                  <span className="flex items-center gap-1.5 text-body font-medium text-foreground">
                    {wcase.title} <Tag>{TWIN_FAMILY_HAZARD_NAME[family]}</Tag>
                  </span>
                  <span className="break-keep text-caption text-foreground-subtle">{wcase.scope.label}</span>
                </section>

                <section className="flex shrink-0 flex-col gap-2 p-3">
                  <h2 className="text-body font-semibold text-foreground">이 훈련에서 하는 일</h2>
                  <ol className="flex flex-col gap-1.5 text-caption">
                    {stops.map((s, i) => (
                      <li key={s.at} className="flex items-start gap-2">
                        <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border bg-surface-raised font-mono text-[10px] text-foreground-muted">{i + 1}</span>
                        <span className="w-10 shrink-0 font-mono text-foreground-subtle">{formatClock(s.at)}</span>
                        <span className="min-w-0 flex-1 break-keep leading-snug text-foreground-muted">{s.note}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="break-keep text-caption text-foreground-subtle">
                    발동하는 규정 {t.firedSopIds.length}건 · 언제 무엇이 일어나는지는 진행하면서 열립니다
                  </p>
                </section>

                {t.conditions.map((c) => (
                  <section key={c.id} className="flex shrink-0 flex-col gap-2 p-3">
                    <header className="flex items-baseline justify-between gap-2">
                      <h2 className="text-body font-semibold text-foreground">조건</h2>
                      <span className="shrink-0 text-caption text-foreground-subtle">더 어렵게 할 수 있습니다</span>
                    </header>
                    <ConditionSlider label={c.label} steps={c.steps} value={condStepId} onChange={(id) => setQuery({ cond: id })} />
                    <p className="break-keep text-caption text-foreground-subtle">판이 있는 값에만 멈춥니다. 관측값은 당시 기록 그대로입니다</p>
                  </section>
                ))}
              </>
            ) : phase === "drill" && stop ? (
              <>
                {/* 결과 국면에는 조치 판을 세우지 않는다 — 조치 창이 닫힌 국면이라 "해야 할 조치"를
                    묻는 자리가 맨 위에 빈 칸으로 남으면 흐름이 끊긴다(와이어프레임 화면 3).
                    그 국면의 머리는 `지금 일어나는 일`이고, 조치는 아래 `확정된 조치`가 든다 */}
                {stop.phase === "판단" && (
                  <div className="shrink-0">
                    <TrainingActions
                      rows={actionRows}
                      at={stop.at}
                      note={stop.note}
                      acts={acts}
                      frozen={flowing}
                      onAct={(id) => setActs((p) => ({ ...p, [id]: stop.at }))}
                      onUndo={(id) => setActs((p) => { const n = { ...p }; delete n[id]; return n; })}
                    />
                  </div>
                )}

                {state && (
                  <section className="flex shrink-0 flex-col gap-1.5 p-3" aria-label="지금 상태">
                    <header className="flex items-baseline justify-between gap-2">
                      <h2 className="text-body font-semibold text-foreground">{stop.phase === "결과" ? "지금 일어나는 일" : "지금 상태"}</h2>
                      <span className="shrink-0 font-mono text-caption text-foreground-subtle">{formatClock(stop.at)}</span>
                    </header>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-md border border-border bg-card px-2.5 py-2 text-caption">
                      {state.rows.map((r) => {
                        const tag = r as { scaled?: boolean; computed?: boolean };
                        return (
                          <div key={r.label} className="contents">
                            <dt className="truncate text-foreground-muted">{r.label}</dt>
                            <dd className={cn("text-right font-mono tabular-nums",
                              tag.scaled ? "font-semibold text-warning" : tag.computed ? "font-semibold text-foreground" : "text-foreground")}>{r.value}</dd>
                          </div>
                        );
                      })}
                    </dl>
                    {/* 결과 국면에서는 영향 대상이 어떻게 됐는지가 핵심이다(목업 화면 3) */}
                    {stop.phase === "결과" && shown && (
                      <ul className="flex flex-col text-caption">
                        {shown.targets.map((tg) => (
                          <li key={tg.id} className="flex items-baseline justify-between gap-2 border-b border-border py-1 last:border-0">
                            <span className="min-w-0 break-keep text-foreground-muted">{tg.label.replace(/\s*\d+\S*$/, "")}</span>
                            <span className={cn("shrink-0 font-medium",
                              tg.exposure === "통제됨" || tg.exposure === "영향 없음" ? "text-success" : tg.exposure === "노출" ? "text-warning" : "text-danger")}>
                              {tg.exposure}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {condStep?.situationId && (
                      <p className="break-keep text-caption leading-snug text-foreground-subtle">
                        <Tag tone="warning">강우 {condStep.label}</Tag> 강우계는 조건대로 환산한 값이고, 합류부 수위는 그 조건·조치로 계산한 값입니다
                      </p>
                    )}
                  </section>
                )}

                <section className="flex shrink-0 flex-col gap-1.5 p-3" aria-label="내 조치 기록">
                  <header className="flex items-baseline justify-between gap-2">
                    <h2 className="text-body font-semibold text-foreground">{stop.phase === "결과" ? "확정된 조치" : "내 조치 기록"}</h2>
                    <span className="shrink-0 text-caption text-foreground-subtle">{Object.keys(acts).length}건</span>
                  </header>
                  {Object.keys(acts).length === 0 ? (
                    <p className="break-keep text-caption text-foreground-subtle">
                      {stop.phase === "결과" ? "실행한 조치가 없습니다" : "실행한 조치가 시각과 함께 쌓입니다"}
                    </p>
                  ) : (
                    <ul className="flex flex-col text-caption">
                      {(wcase.sop ?? []).filter((s) => acts[s.id]).map((s) => (
                        <li key={s.id} className="flex items-baseline justify-between gap-2 border-b border-border py-1 last:border-0">
                          <span className="min-w-0 break-keep text-foreground">{s.id} {s.label}</span>
                          <span className="shrink-0 font-mono text-foreground-subtle">{formatClock(acts[s.id])}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {/* 조치 판을 걷어낸 자리를 대신하는 한 줄 — 왜 더 고를 수 없는지가 여기서 닫힌다(와이어프레임 화면 3) */}
                  {stop.phase === "결과" && (
                    <p className="break-keep text-caption text-foreground-subtle">
                      조치 창이 닫혔습니다 · 안 한 조치는 <span className="text-foreground-muted">실제와 같은 시각</span>에 한 것으로 봅니다
                    </p>
                  )}
                </section>
              </>
            ) : (
              <>
                {/* 복기 — 시각을 옮기면 지도와 이 카드가 함께 그 시각을 본다. 패널과 지도가 끊기지 않는다 */}
                {state && replayAt !== null && (
                  <section className="flex shrink-0 flex-col gap-1.5 p-3" aria-label="그 시각 상태">
                    <header className="flex items-baseline justify-between gap-2">
                      <h2 className="text-body font-semibold text-foreground">그 시각 상태</h2>
                      <span className="shrink-0 font-mono text-caption text-foreground-subtle">{stop ? formatClock(stop.at) : ""}</span>
                    </header>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-md border border-border bg-card px-2.5 py-2 text-caption">
                      {state.rows.map((r) => {
                        const tag = r as { scaled?: boolean; computed?: boolean };
                        return (
                          <div key={r.label} className="contents">
                            <dt className="truncate text-foreground-muted">{r.label}</dt>
                            <dd className={cn("text-right font-mono tabular-nums", tag.scaled ? "font-semibold text-warning" : "text-foreground")}>{r.value}</dd>
                          </div>
                        );
                      })}
                    </dl>
                    <p className="break-keep text-caption text-foreground-subtle">내 조치가 반영된 값입니다. 시각을 눌러 옮길 수 있습니다</p>
                  </section>
                )}
                <TrainingDebrief
                  wcase={wcase}
                  condLabel={condLabel}
                  acts={acts}
                  mine={mine}
                  base={base}
                  improvements={improvements.filter((x) => x.incidentId === wcase.incidentId)}
                  onAddImprovement={(axis, text) => addImprovement({
                    incidentId: wcase.incidentId, axis, text,
                    context: [wcase.title, condLabel].join(" · "),
                    author: OFFICER,
                  })}
                  onRemoveImprovement={removeImprovement}
                  onSave={save}
                  saved={savedId}
                />
              </>
            )}
          </div>
        </GlassPanel>

        <div className="flex shrink-0 flex-col gap-2">
          {phase === "prepare" && (
            <Button className="pointer-events-auto w-full" onClick={start}>
              <Icon icon="mdi:play-outline" className="size-4" aria-hidden />
              훈련 시작
            </Button>
          )}
          {phase === "drill" && (
            <Button
              className="pointer-events-auto w-full"
              variant={stopIndex >= stops.length - 1 ? "default" : "secondary"}
              onClick={next}
              disabled={flowing}
            >
              {flowing
                ? "시간이 흐르는 중…"
                : stopIndex >= stops.length - 1
                  ? "훈련 종료 · 강평"
                  : `다음 단계 · ${formatClock(stops[stopIndex + 1].at)}`}
            </Button>
          )}
          {phase === "debrief" && (
            <Button className="pointer-events-auto w-full" variant="secondary" onClick={restart}>
              <Icon icon="mdi:refresh" className="size-4" aria-hidden />
              조건을 바꿔 다시 훈련
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
