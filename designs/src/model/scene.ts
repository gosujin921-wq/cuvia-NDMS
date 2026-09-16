/* ─────────────────────────────────────────────
 * 트윈 장면 층 — 면 하나로는 안 되는 표현 부품 (03 §24 · §22)
 *
 * 예측판(Forecast)은 눈금마다 영향 면(extentGeometryId)을 든다. 유형이 갈리는 나머지는 여기 있다.
 *   line    선 층      방호시설 · 방화선 · 대피경로 · 통제 경계 · 하천 · 연결 · 도로(상태 색)
 *   vector  방향·벡터  풍향(이동 방향) · 변위
 *   node    노드       G 시설 노드. 상태 색과 복구 순번
 *   point   지점       발화점 · 위성 관측점 · 월류 지점 · 관측소 · 시설 상태 · 쉼터
 *   area    보조 면    연기 플룸 · 위험지도 배경 · 통제 구역 · 고립 구역
 *   grid    격자 면    E 노출 강도 · 취약성 · 서비스 공백
 *
 * 예측판 전체에 붙는 층(scene)은 시각과 무관하게 서고, 눈금에 붙는 층(mark.scene)은 그 시각에만 선다.
 * 같은 id 가 두 곳에 있으면 눈금 것이 이긴다. 값은 전부 사전 작성 시나리오다. 화면이 계산하지 않는다.
 *
 * 보조 분석뷰(종단도 · 계통도)는 지도 층이 아니라 별도 패널이다(03 §21). Forecast.profile · Forecast.system 이 든다.
 * ───────────────────────────────────────────── */

export type LngLat = [number, number];

export type SceneLineRole = "방호시설" | "방화선" | "대피경로" | "통제 경계" | "하천" | "연결" | "우회" | "도로";
/** on 켜짐(실선) · off 끊김(점선·흐림) · planned 예정(점선) */
export type SceneState = "on" | "off" | "planned";

export interface SceneLine {
  kind: "line";
  id: string;
  role: SceneLineRole;
  coords: LngLat[];
  state?: SceneState;
  label?: string;
  /** 역할 색 대신 상태 색 — 도로가 침수(warning)·통행 불가(danger)·통제(primary)로 바뀔 때 */
  tone?: PointTone;
}

export interface SceneVector {
  kind: "vector";
  id: string;
  role: "풍향" | "변위";
  at: LngLat;
  /** 이동 방향. 북 0 · 시계방향(도). 풍향은 "불어오는 방향"이 아니라 이동 방향으로 바꿔 둔다(03 부록 B) */
  bearing: number;
  /** 크기 — 풍속 m/s · 변위 mm. 화살표 길이가 이 값을 따른다 */
  magnitude: number;
  unit: string;
  label?: string;
}

export type NodeState = "정상" | "경고" | "중단" | "복구";

export interface SceneNode {
  kind: "node";
  id: string;
  at: LngLat;
  label: string;
  icon: string;
  state: NodeState;
  /** 복구 순번 — 대안 "복구 순서"가 붙인다 */
  order?: number;
}

export type PointTone = "danger" | "warning" | "success" | "neutral" | "primary";

export interface ScenePoint {
  kind: "point";
  id: string;
  at: LngLat;
  icon: string;
  label: string;
  /** 상태 한 마디 — "영향 임박" · "월류 중" · "운영 중" */
  state?: string;
  tone?: PointTone;
  /** 작게(관측점처럼 여럿일 때) */
  small?: boolean;
}

export type SceneAreaRole = "플룸" | "위험지도" | "통제 구역" | "고립 구역" | "접근권";

export interface SceneArea {
  kind: "area";
  id: string;
  role: SceneAreaRole;
  ring: LngLat[];
  opacity?: number;
  label?: string;
}

export interface SceneGridCell {
  ring: LngLat[];
  /** 그 시각의 강도 0~1 (면 색) */
  intensity: number;
  /** 취약대상 밀집 (해칭) */
  vulnerable?: boolean;
  /** 서비스 공백 (외곽선 강조) */
  gap?: boolean;
}

export interface SceneGrid {
  kind: "grid";
  id: string;
  cells: SceneGridCell[];
}

export type SceneLayer = SceneLine | SceneVector | SceneNode | ScenePoint | SceneArea | SceneGrid;

/** 종단도 — 상류 → 하류 수위 단면 (B 보조뷰). 값은 눈금별 시나리오 */
export interface ProfileStation {
  id: string;
  label: string;
  /** 상류 기준 거리 km */
  km: number;
  /** 하상고 EL.m */
  bed: number;
  /**
   * 이 관측소의 기준 수위 EL.m — 하천은 상류와 하류의 하상이 10 m 넘게 달라 기준선이 수평일 수 없다(창원천).
   * 안 주면 SceneProfile.threshold 하나를 쓴다(저수지처럼 짧은 구간).
   */
  threshold?: number;
}

export interface SceneProfile {
  stations: ProfileStation[];
  /** 기준 수위(월류 시작) EL.m — 관측소마다 threshold 가 있으면 그것이 이긴다 */
  threshold: number;
  /** 눈금(validAt) → 관측소별 수위 EL.m */
  levelsByMark: Record<string, number[]>;
}

/** 계통도 — 시설 노드와 의존 연결 (G 보조뷰). 노드 상태는 눈금별 */
export interface SystemEdge {
  from: string;
  to: string;
}

export interface SceneSystem {
  nodes: { id: string; label: string; icon: string }[];
  edges: SystemEdge[];
  /** 눈금(validAt) → 노드 상태 */
  stateByMark: Record<string, Record<string, NodeState>>;
  /** 눈금 → 복구 순번 (대안이 준다) */
  orderByMark?: Record<string, Record<string, number>>;
}

/** 조건 요약 카드 한 줄 — G 처럼 날씨가 원인이 아닌 유형이 든다 */
export interface ConditionLine {
  label: string;
  value: string;
  tone?: PointTone;
}

/** 같은 id 는 눈금 것이 이긴다 */
export function mergeScene(base: SceneLayer[] | undefined, mark: SceneLayer[] | undefined): SceneLayer[] {
  const out = new Map<string, SceneLayer>();
  for (const l of base ?? []) out.set(l.id, l);
  for (const l of mark ?? []) out.set(l.id, l);
  return [...out.values()];
}
