/* ─────────────────────────────────────────────
 * 대응 흐름 · 상황실 → 현장 — 대응 탭 (초안 사건작업공간_화면상세 §3 대응 2 · 결정 2026-09-14)
 *
 * CSMS decision-popup/response-chain.tsx 와 같은 부품이다. 단계 키·상태 4값·상태 문구는 그대로이고 단계 이름만
 * NDMS 담당(상황실 관제 · 담당기관 · 주민 전파 · 현장 조치)이다. 새 상태를 만들지 않는다 — 네 단계는 SOP 항목의
 * 단계 태그와 처리상태에서 파생한다(selectors.chainStagesAt). 주민 전파가 실패로 멈추면 셋째 단계가
 * `전파 실패`로 끊기고 대체조치가 끝나면 이어진다.
 * ───────────────────────────────────────────── */

import { Fragment } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@ds";
import type { ChainStageView } from "../../../model/sop";
import { SOP_STATUS_TONE } from "../../../lib/status-tone";

export function ResponseChain({ stages }: { stages: ChainStageView[] }) {
  return (
    <section className="flex flex-col gap-1.5" aria-label="상황실에서 현장까지 대응 흐름">
      <span className="text-caption font-semibold text-foreground-muted">대응 흐름 · 상황실 → 현장</span>
      <ol className="flex items-start rounded-md border border-border bg-surface-raised/60 px-2 py-2">
        {stages.map((s, i) => {
          const tone = SOP_STATUS_TONE[s.state];
          return (
            <Fragment key={s.stage}>
              {i > 0 && <span className={cn("mt-2 h-px flex-1 shrink-0", s.state === "대기" ? "bg-border" : "bg-foreground-subtle")} aria-hidden />}
              <li className="flex min-w-0 shrink-0 flex-col items-center gap-0.5 text-center" style={{ width: 72 }}>
                <Icon icon={tone.icon} className={cn("size-4", tone.text, tone.spin && "animate-spin")} aria-hidden />
                <span className="truncate text-caption font-medium text-foreground">{s.actor}</span>
                <span className={cn("truncate text-caption", tone.text)}>{s.note}</span>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </section>
  );
}
