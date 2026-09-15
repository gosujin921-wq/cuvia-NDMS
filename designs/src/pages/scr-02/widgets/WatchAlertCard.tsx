/* ─────────────────────────────────────────────
 * 알림 카드 — 사건 전 알림으로 연 사건 작업공간의 우측 판단 탭 (IA §7 · 02 D0 · 초안 사건작업공간_화면상세 §3)
 *
 * 종합상황 감지 카드가 실어 보낸 알림을 그대로 보인다: 역할 · 등급 · 종류 · 생성시각 / 연결 이유 / 담당자 할 일 /
 * 규칙. 사건 후보가 아니므로 위험도·전망·대응이 없고, 후보는 규칙이 조건을 충족할 때 만든다 — 여기서 사건을
 * 만들지 않는다(IA §5.2 예외 "지구나 이벤트로 임의 사건을 생성하지 않는다").
 * ───────────────────────────────────────────── */

import { Badge, Tag } from "@ds";
import type { AlertView } from "../../../model/selectors";
import { ALERT_GRADE_TONE, alertKindLabel, alertRoleLabel } from "../../../lib/status-tone";
import { formatClock } from "../../../lib/datetime";

export function WatchAlertCard({ alert }: { alert: AlertView }) {
  return (
    <section className="flex flex-col gap-2 px-3 py-2.5" aria-label="알림">
      <header className="flex items-baseline justify-between">
        <h2 className="text-body font-semibold text-foreground">알림</h2>
        <span className="text-caption text-foreground-subtle">{formatClock(alert.createdAt)} 생성</span>
      </header>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={ALERT_GRADE_TONE[alert.grade].badge}>{alert.grade}</Badge>
        <span className="text-body font-semibold text-foreground">{alertRoleLabel(alert.demoRole)}</span>
        <Tag className="ml-auto">{alertKindLabel(alert.kind)}</Tag>
      </div>
      <dl className="flex flex-col gap-1 text-caption">
        <div className="flex items-baseline gap-2"><dt className="w-[60px] shrink-0 text-foreground-subtle">왜</dt><dd className="min-w-0 flex-1 text-foreground-muted">{alert.reason}</dd></div>
        <div className="flex items-baseline gap-2"><dt className="w-[60px] shrink-0 text-foreground-subtle">할 일</dt><dd className="min-w-0 flex-1 text-foreground">{alert.task}</dd></div>
      </dl>
      <p className="text-caption text-foreground-subtle">아직 사건이 아닙니다. 징후가 더 잡히면 사건 후보로 알려 드립니다.</p>
    </section>
  );
}
