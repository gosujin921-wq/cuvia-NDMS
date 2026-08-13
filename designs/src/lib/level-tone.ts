/* ─────────────────────────────────────────────
 * 이벤트 단계 표시 톤 — 주의보 · 경보 · 대피
 *
 * 정본은 IDC lib/risk-tone.ts 의 규칙이다. 쓰임새가 둘로 갈린다.
 *   badge : DS Badge 의 색 variant. 뱃지 글자는 파스텔 톤을 쓴다
 *   bar/dot/text : 위험도 토큰 원색(--color-risk-lv3~5). 카드 좌측 바·점·짧은 텍스트용
 *
 * 원색을 뱃지에 덧씌우지 않는다. 넓은 면적에 원색이 깔리면 정작 위험 신호가 묻힌다.
 *
 * 단계 ↔ 위험도 램프 대응은 03 화면정의서 §0-2 의 3단계(노랑·주황·빨강)를 따른다.
 * 차트 임계선·지도 마커처럼 CSS 색 값이 필요한 자리는 demo/levels.ts 의 `color` 를 쓴다.
 *
 * ▸ 제품 정본: cuvia_platform_web kits/event-kit 의 RISK_TONE · RISK_LEVELS ·
 *   EVENT_STATUS_BADGE(types.ts). 거기는 이벤트 중요도/상태 축이고 여기는 재난 발령 단계
 *   축이라 값 자체는 다르다. 같은 것은 규칙 — 원색은 바·점·짧은 텍스트에만, 뱃지는 variant.
 *   event-kit 을 물게 되면 이 파일은 그 톤 맵의 도메인 매핑으로 줄어든다.
 * ───────────────────────────────────────────── */

import type { AlertLevel } from "../demo/levels";

/** DS Badge 의 색 variant 이름 */
export type LevelBadgeVariant = "red" | "orange" | "yellow";

export interface LevelTone {
  badge: LevelBadgeVariant;
  /** 카드 좌측 컬러바 */
  bar: string;
  /** 목록·범례·기준표의 점 */
  dot: string;
  /** 원색 텍스트 (짧은 자리) */
  text: string;
}

export const LEVEL_TONE: Record<AlertLevel, LevelTone> = {
  evacuate: {
    badge: "red",
    bar: "border-l-risk-lv5",
    dot: "bg-risk-lv5",
    text: "text-risk-lv5",
  },
  warning: {
    badge: "orange",
    bar: "border-l-risk-lv4",
    dot: "bg-risk-lv4",
    text: "text-risk-lv4",
  },
  advisory: {
    badge: "yellow",
    bar: "border-l-risk-lv3",
    dot: "bg-risk-lv3",
    text: "text-risk-lv3",
  },
};

export function levelTone(level: AlertLevel): LevelTone {
  return LEVEL_TONE[level];
}
