/* ─────────────────────────────────────────────
 * 대응 요약 — 판단 탭 (04 §2 "우측 대응 요약: SOP 권고·승인 상태·실행 결과 요약과 다음 행동")
 *
 * 읽는 자리다. 진행률 · 승인 캡션 · 대응 흐름 4단계 한 줄. 조작은 집중 팝업이 하고 여는 길은 액션 바 [대응 실행] 하나다.
 * 카드 자체는 버튼이 아니다 — 호버에 버튼처럼 반응하던 것을 뺐다 (2026-09-14 사용자 지적).
 * 사건 후보가 생기면 선다: 내부 자동 조치가 이미 완료돼 "발생과 동시에 자동 대응이 진행됐다"가 보인다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { cn } from "@ds";
import type { Decision } from "../../../model/response";
import { sopProgress, type ChainStageView, type SopItem } from "../../../model/sop";
import { SOP_STATUS_TONE } from "../../../lib/status-tone";
import { formatClock } from "../../../lib/datetime";

export function ResponseSummaryCard({ items, chain, approval }: { items: SopItem[]; chain: ChainStageView[]; approval: Decision | null }) {
  const { done, total, pct } = sopProgress(items);
  const autoDone = items.filter((i) => i.execMode === "자동" && i.status === "완료").length;
  return (
    <section className="flex w-full flex-col gap-1.5 px-3 py-2.5" aria-label="대응 요약">
      <div className="flex items-baseline justify-between">
        <h2 className="text-body font-semibold text-foreground">대응 요약</h2>
        <span className="font-mono text-caption text-foreground-muted">SOP {done}/{total} · {pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
      <p className="truncate text-caption text-foreground-muted">
        {approval ? `${formatClock(approval.recordedAt)} ${approval.approver} 승인` : `승인 전 · 자동 조치 ${autoDone}건 완료`}
      </p>
      <ol className="grid grid-cols-4 gap-1 text-caption">
        {chain.map((s) => {
          const tone = SOP_STATUS_TONE[s.state];
          return (
            <li key={s.stage} className="flex min-w-0 flex-col items-center gap-0.5 text-center" title={`${s.actor} · ${s.note}`}>
              <Icon icon={tone.icon} className={cn("size-3.5 shrink-0", tone.text, tone.spin && "animate-spin")} aria-hidden />
              <span className="w-full truncate text-foreground-muted">{s.actor}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
