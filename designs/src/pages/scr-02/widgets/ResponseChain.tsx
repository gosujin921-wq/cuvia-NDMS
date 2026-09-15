/* ─────────────────────────────────────────────
 * 대응 흐름 · 상황실 → 담당기관 → 주민 전파 → 현장 조치 (04 §7 W4 · CSMS response-chain 과 같은 골격)
 *
 * 아래 SOP 줄들이 "무엇을" 이라면 이 줄은 "누구에게까지 닿았나" 다. 네 칸이 폭을 나눠 갖고(고정폭이면 400px 패널에서
 * 넷째 칸이 밀린다), 앞 단계가 끝나야 사이 선이 이어진다 · 끊긴 자리가 곧 지금 막힌 자리다. 상태 계산은 selectors 가 한다.
 * ───────────────────────────────────────────── */

import { Fragment } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@ds";
import type { ChainStageView } from "../../../model/sop";
import { SOP_STATUS_TONE } from "../../../lib/status-tone";

export function ResponseChain({ stages }: { stages: ChainStageView[] }) {
  return (
    <section className="flex flex-col gap-2" aria-label="상황실에서 현장까지 대응 흐름">
      <span className="text-caption font-semibold text-foreground-muted">대응 흐름 · 상황실 → 현장</span>
      <ol className="flex items-start rounded-md border border-border bg-row-zebra px-2 py-2.5">
        {stages.map((s, i) => {
          const tone = SOP_STATUS_TONE[s.state];
          const prevDone = i > 0 && stages[i - 1].state === "완료";
          return (
            <Fragment key={s.stage}>
              {i > 0 && <span aria-hidden className={cn("mt-2 h-px w-3 shrink-0 transition-colors duration-300", prevDone ? "bg-success/60" : "bg-border")} />}
              <li className="flex min-w-0 flex-1 flex-col items-center gap-1 break-keep text-center">
                <span key={s.state} className="flex size-4 items-center justify-center duration-300 animate-in fade-in zoom-in-50">
                  <Icon icon={tone.icon} className={cn("size-4", tone.text, tone.spin && "animate-spin")} aria-hidden />
                </span>
                <span className={cn("text-caption font-medium leading-tight", s.state === "대기" ? "text-foreground-muted" : "text-foreground")}>{s.actor}</span>
                <span className={cn("text-caption leading-tight", tone.text)}>{s.note}</span>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </section>
  );
}
