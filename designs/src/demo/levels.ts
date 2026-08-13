/* ─────────────────────────────────────────────
 * 이벤트 단계와 발령 기준 — 정본: docs/정본/04_데모_데이터.md §3
 *
 * 단계 색은 화면 어디서나 같다(03 화면정의서 §0-2). 색 값은 DS 위험도 램프를 쓴다.
 * ───────────────────────────────────────────── */

export type AlertLevel = "advisory" | "warning" | "evacuate";

export interface AlertLevelSpec {
  id: AlertLevel;
  label: string;
  /** CSS 색 값 */
  color: string;
  /** 색상 기준표에 함께 적는 뜻 */
  meaning: string;
}

export const ALERT_LEVELS: AlertLevelSpec[] = [
  { id: "advisory", label: "주의보", color: "var(--color-risk-lv3)", meaning: "기준선에 닿음" },
  { id: "warning", label: "경보", color: "var(--color-risk-lv4)", meaning: "기준선을 넘음" },
  { id: "evacuate", label: "대피", color: "var(--color-risk-lv5)", meaning: "대피 판단 구간" },
];

export function levelSpec(level: AlertLevel): AlertLevelSpec {
  return ALERT_LEVELS.find((l) => l.id === level) ?? ALERT_LEVELS[0];
}

/** 지구별 수위계 발령 기준 (EL.m) */
export interface WaterThreshold {
  advisory: number;
  warning: number;
  evacuate: number;
}

export const WATER_THRESHOLDS: Record<string, WaterThreshold> = {
  bongam: { advisory: 3.45, warning: 3.83, evacuate: 5.83 },
  yangdeok: { advisory: 2.1, warning: 2.6, evacuate: 3.4 },
  guhang: { advisory: 2.8, warning: 3.2, evacuate: 4.1 },
  seohang: { advisory: 2.9, warning: 3.35, evacuate: 4.2 },
  myeongdong: { advisory: 2.75, warning: 3.15, evacuate: 4.0 },
  gwangryeo: { advisory: 1.9, warning: 2.4, evacuate: 3.1 },
  yeojwa: { advisory: 2.05, warning: 2.55, evacuate: 3.3 },
  changwoncheon: { advisory: 2.2, warning: 2.7, evacuate: 3.5 },
  namcheon: { advisory: 3.1, warning: 3.6, evacuate: 4.4 },
  yongwon: { advisory: 2.85, warning: 3.25, evacuate: 4.05 },
  /* 낙동강 배후습지성 저수지라 수면 표고가 낮다. 나머지 열한 곳은 하천·항만 수위대다 (04 §3) */
  junam: { advisory: 4.8, warning: 5.4, evacuate: 6.0 },
  paryong: { advisory: 1.75, warning: 2.2, evacuate: 2.9 },
};

/** 강우량계 (mm/h) · 변위계 (누적 mm) 는 전 지구 공통 */
export const RAIN_THRESHOLD: WaterThreshold = { advisory: 30, warning: 50, evacuate: 70 };
export const DISPLACEMENT_THRESHOLD: WaterThreshold = { advisory: 10, warning: 20, evacuate: 30 };
