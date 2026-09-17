/* ─────────────────────────────────────────────
 * 보고서 차트 사양 — 문서가 그리는 그림의 데이터 계약 (양식 정본: KISA 월간 운영 보고서 v0.5 · 2026-09-17)
 *
 * 양식은 표만으로 끝나지 않는다. 상단 요약 지표 타일과 절마다 SVG 차트가 선다(발생 분포 막대 · 결과 도넛 ·
 * 일자별 꺾은선 · 구역별 누적막대). 사건 보고서도 같은 문법을 쓴다 — 여기는 **무엇을 그릴지**의 값만 든다.
 * 값은 전부 원장에서 파생한 것이고(lib/incident-report), 문서는 다시 계산하지 않는다.
 * 그리는 법(색·굵기·간격)은 components/ReportCharts 가 종이 팔레트 토큰으로 든다.
 * ───────────────────────────────────────────── */

export interface ChartPoint {
  at: string;
  value: number;
  /** 관측 품질 — "정상"이 아니면 속이 빈 점으로 그린다(지연·대체값을 숨기지 않는다) */
  quality?: string;
}

/** 등급·상태처럼 색이 뜻을 갖는 값 — 렌더러가 상태 팔레트로 옮긴다 */
export type ChartTone = "neutral" | "good" | "warning" | "serious" | "critical" | "series-1" | "series-2";

export type ReportChart =
  /** 경과 마일스톤 — 순서 다이어그램. 시간 간격이 아니라 순서를 보인다 */
  | { kind: "milestones"; items: { label: string; at: string }[] }
  /** 관측 시계열 소형 다중 — 단위가 다른 계열은 축을 나눈다(이중축 금지) */
  | {
      kind: "series";
      panels: { title: string; unit: string; points: ChartPoint[]; digits?: number }[];
      /** 모든 패널에 같이 서는 세로 표식 — "침수 도달 17:50" */
      markers?: { at: string; label: string }[];
    }
  /** 위험도 추이 — 계단선 + 등급 띠 */
  | { kind: "score-trend"; points: { at: string; score: number; grade: string; tone: ChartTone }[]; thresholds: { grade: string; minScore: number; tone: ChartTone }[] }
  /** 지표별 기여도 — 트랙은 가중치, 채움은 기여도 */
  | { kind: "meters"; rows: { label: string; band: string; value: number; max: number; degraded: boolean }[]; digits: number }
  /** 예측 대 실측 — 같은 단위 두 계열, 한 축 */
  | { kind: "compare"; unit: string; digits: number; series: { label: string; points: ChartPoint[]; tone: ChartTone }[]; verify?: { at: string; label: string } }
  /** 조치 간트 — 배정부터 완료까지 */
  | { kind: "gantt"; rows: { label: string; sub: string; from: string; to: string; status: string; tone: ChartTone }[] };

/** 상단 요약 지표 타일 */
export interface ReportStat {
  label: string;
  value: string;
  unit?: string;
  note?: string;
}
