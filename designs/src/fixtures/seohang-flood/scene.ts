/* ─────────────────────────────────────────────
 * A 도시 배수·침수 장면 층 — 침수면 위에 같이 움직이는 넷 (03 §22 A)
 *
 * "침수면 · 침수심 · 영향 도로 · 영향 시설 넷이 같이 움직인다." 침수면·침수심은 예측판 눈금(extentGeometryId · maxDepthM)이 들고,
 * 여기는 나머지 둘이다.
 *   해안도로 저지대 구간   선. 통행 가능 → 물고임 → 차로 침수·서행 → 통행 불가. 통제되면 점선(primary)
 *   신포 지하차도 진입부   지점. 정상 → 유입 시작 → 부분 중단 → 중단. 통제되면 primary
 *   제2배수펌프장 · 우수저류시설   시설 핀과 가동 상태. 배수 대안이 바꾸는 것이 이 둘이다
 * 배수 대응은 현상(침수면·펌프·저류)을 바꾸고 도로 통제는 노출(도로·지하차도 상태)을 바꾼다.
 * 좌표는 subjects.ts 의 시나리오 공간 데이터다. 상태값은 예측판마다 사전 작성한다 — 화면이 침수심에서 상태를 계산하지 않는다.
 * ───────────────────────────────────────────── */

import type { ConditionLine, LngLat, PointTone, SceneLayer, SceneState } from "../../model/scene";
import { COAST_ROAD_LINE, SUBJECTS, SUBJECT_LOCATION } from "./subjects";
import { COAST_ROAD_WET } from "./geometry.generated";

const anchor = (id: keyof typeof SUBJECT_LOCATION): LngLat => SUBJECT_LOCATION[id].displayAnchor;

/** 해안도로 저지대 구간 — 베이스맵 해안대로 형상(geometry.generated.ts) */
const COAST_ROAD: LngLat[] = COAST_ROAD_LINE;
/** 우회로 — 베이스맵 도로망을 최단경로로 이은 채록 좌표(2026-09-15). 만조 정점 수위 5.15 m 에서 마른 꼭짓점(5.5 m 이상)만 지나
    해안대로 남단 → 중앙북길 → 3·15대로로 빠진다. 북쪽 합포로·해안대로 북단(2~5 m)은 그때 잠기므로 해안대로로 되돌아오지 않는다 */
const DETOUR: LngLat[] = [[128.57019, 35.19651], [128.57029, 35.19723], [128.5703, 35.1973], [128.5703, 35.19735], [128.57034, 35.19762], [128.57047, 35.19817], [128.57044, 35.19823], [128.57045, 35.19827], [128.56978, 35.1984], [128.56955, 35.19845], [128.56943, 35.19852], [128.56932, 35.1986], [128.56925, 35.19889], [128.56901, 35.19883], [128.56882, 35.19939], [128.56873, 35.19971], [128.5687, 35.19994], [128.5686, 35.20039], [128.56858, 35.2005], [128.56823, 35.20053], [128.56822, 35.20076], [128.56834, 35.20227], [128.56844, 35.20259], [128.56851, 35.2026], [128.56858, 35.2028]];

export type RoadState = "통행 가능" | "물고임" | "차로 침수 · 서행" | "통행 불가" | "통제됨";
export type UnderpassState = "정상" | "유입 시작" | "부분 중단" | "중단" | "통제됨";
export type PumpState = "가용 3/3" | "2호기 정지 · 가용 2/3" | "2호기 재가동 · 3/3";
export type RetentionState = "여유 62 %" | "여유 90 % · 사전 방류" | "추가 유입 중";

const ROAD: Record<RoadState, { tone: PointTone; state: SceneState }> = {
  "통행 가능": { tone: "neutral", state: "on" },
  물고임: { tone: "warning", state: "on" },
  "차로 침수 · 서행": { tone: "warning", state: "on" },
  "통행 불가": { tone: "danger", state: "on" },
  통제됨: { tone: "primary", state: "planned" },
};
const UNDERPASS: Record<UnderpassState, PointTone> = { 정상: "success", "유입 시작": "warning", "부분 중단": "warning", 중단: "danger", 통제됨: "primary" };
const PUMP: Record<PumpState, PointTone> = { "가용 3/3": "success", "2호기 정지 · 가용 2/3": "warning", "2호기 재가동 · 3/3": "primary" };
const RETENTION: Record<RetentionState, PointTone> = { "여유 62 %": "neutral", "여유 90 % · 사전 방류": "success", "추가 유입 중": "primary" };

export interface FloodSceneState {
  road: RoadState;
  underpass: UnderpassState;
  pump: PumpState;
  retention: RetentionState;
  /** 그 눈금의 침수면 id — 도로 상태·통제 구간은 이 면에 닿는 구간에만 선다(geometry.generated COAST_ROAD_WET) */
  extent: string;
}

/** 한 눈금의 장면 — 같은 id 라 눈금이 바뀌면 그 자리가 바뀐다 */
export function floodScene({ road, underpass, pump, retention, extent }: FloodSceneState): SceneLayer[] {
  const controlled = road === "통제됨";
  const wet = COAST_ROAD_WET[extent];
  /* 도로는 셋으로 가른다 — 마른 앞·뒤 구간은 "통행 가능", 침수면에 닿는 구간만 그 눈금의 상태. 통제도 그 구간에만 건다 */
  const [from, to] = wet ?? [COAST_ROAD.length - 1, COAST_ROAD.length - 1];
  const before = COAST_ROAD.slice(0, from + 1), wetPart = COAST_ROAD.slice(from, to + 1), after = COAST_ROAD.slice(to);
  const roadLines: SceneLayer[] = [
    ...(before.length > 1 ? [{ kind: "line" as const, id: "a-coast-road-s", role: "도로" as const, coords: before, state: "on" as const, tone: "neutral" as const }] : []),
    ...(wet && wetPart.length > 1 ? [{ kind: "line" as const, id: "a-coast-road", role: "도로" as const, coords: wetPart, state: ROAD[road].state, tone: ROAD[road].tone, label: `해안도로 · ${road}` }] : []),
    ...(after.length > 1 ? [{ kind: "line" as const, id: "a-coast-road-n", role: "도로" as const, coords: after, state: "on" as const, tone: "neutral" as const }] : []),
  ];
  return [
    ...roadLines,
    /* 통제되면 침수 구간 양 끝 차단 지점과 우회로가 선다 — "통제됨"이 점선 하나로 끝나면 무엇을 막았는지 안 보인다 */
    ...(controlled && wet
      ? ([
          { kind: "point", id: "a-block-s", at: COAST_ROAD[from], icon: "mdi:traffic-cone", label: "차단 (남)", state: "통제 중", tone: "primary", small: true },
          { kind: "point", id: "a-block-n", at: COAST_ROAD[to], icon: "mdi:traffic-cone", label: "차단 (북)", state: "통제 중", tone: "primary", small: true },
          { kind: "line", id: "a-detour", role: "우회", coords: DETOUR, state: "on", label: "우회 · 3·15대로 방면" },
        ] as SceneLayer[])
      : []),
    { kind: "point", id: "a-underpass", at: anchor(SUBJECTS.underpass), icon: "mdi:tunnel", label: "신포 지하차도", state: underpass, tone: UNDERPASS[underpass] },
    { kind: "point", id: "a-pump", at: anchor(SUBJECTS.pumpStation), icon: "mdi:water-pump", label: "제2배수펌프장", state: pump, tone: PUMP[pump] },
    { kind: "point", id: "a-retention", at: anchor(SUBJECTS.retention), icon: "mdi:storage-tank", label: "우수저류시설", state: retention, tone: RETENTION[retention] },
  ];
}

/** 눈금별 도로·지하차도 상태에 시설 상태(예측판 공통)를 붙여, 눈금의 침수면 id 로 장면을 만드는 함수 */
export function floodSceneAt(facility: Pick<FloodSceneState, "pump" | "retention">, steps: [RoadState, UnderpassState][]): (extent: string, i: number) => SceneLayer[] {
  return (extent, i) => floodScene({ road: steps[i][0], underpass: steps[i][1], extent, ...facility });
}

/** 좌하단 조건 요약 — 강우 · 만조 · 펌프. 날씨 카드 위에 선다 */
export function floodConditions(rain: string, tide: string, pump: PumpState): ConditionLine[] {
  return [
    { label: "강우", value: rain, tone: "warning" },
    { label: "만조", value: tide },
    { label: "펌프", value: pump, tone: PUMP[pump] === "success" ? undefined : PUMP[pump] },
  ];
}
