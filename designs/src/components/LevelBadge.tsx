/* ─────────────────────────────────────────────
 * 이벤트 단계 뱃지 — 주의보 · 경보 · 대피
 *
 * 03 화면정의서 §0-2. 화면 어디서나 같은 색으로 선다.
 *
 * DS Badge 의 색 variant 를 쓴다(IDC RiskBadge 와 같은 패턴). 단계 원색은 카드 좌측 바·
 * 점·짧은 텍스트에만 쓰고 뱃지에는 덧씌우지 않는다 — lib/level-tone.ts 참고.
 * ───────────────────────────────────────────── */

import { Badge, cn } from "@ds";
import { levelSpec, type AlertLevel } from "../demo/levels";
import { levelTone } from "../lib/level-tone";

interface LevelBadgeProps {
  level: AlertLevel;
  /** 계측값 병기 ("경보 3.41 EL.m") — 헤더처럼 넓은 자리에만 */
  value?: string;
  className?: string;
}

export function LevelBadge({ level, value, className }: LevelBadgeProps) {
  const spec = levelSpec(level);

  return (
    <Badge
      variant={levelTone(level).badge}
      className={cn("shrink-0 gap-1", className)}
      title={spec.meaning}
    >
      {spec.label}
      {value && <span className="font-mono">{value}</span>}
    </Badge>
  );
}
