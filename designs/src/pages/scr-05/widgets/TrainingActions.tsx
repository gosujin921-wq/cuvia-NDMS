/* ─────────────────────────────────────────────
 * 지금 해야 할 조치 — 판단 국면의 본체 (03 §26.5 · 2026-09-16 v2)
 *
 * 규정이 뜨면 [실행]하거나 넘긴다. 규칙 다섯이 화면 문법을 정한다.
 *   ① 한 정지점에서 여러 건을 실행할 수 있다. 실행해도 시계는 가지 않는다
 *   ② 안 한 것 중 첫 번째는 늘 펴져 있다 — 실행하면 그다음이 그 자리로 올라온다(두 번 누르면 흐름이 끊긴다)
 *   ③ 핵심(현상 대응)이 위다. 세 장을 한꺼번에 던지면 시험지가 된다
 *   ④ [다음 단계] 전까지 되돌릴 수 있다. 시간이 안 갔으면 아직 확정이 아니다
 *   ⑤ "안 함"은 선택지가 아니다 — 안 한 조치는 실제와 같은 시각에 한 것으로 본다
 * 지침은 대응의 target·level 에서 옮겨 적고 없으면 비운다(지어내지 않는다).
 * ───────────────────────────────────────────── */

import { useState } from "react";
import { Icon } from "@iconify/react";
import { Button, Tag, cn } from "@ds";
import { formatClock } from "../../../lib/datetime";
import type { WhatIfPreset, WhatIfResponse, WhatIfSopItem } from "../../../model/whatif";

export interface ActionRow {
  sop: WhatIfSopItem;
  response: WhatIfResponse | null;
  preset: WhatIfPreset | null;
}

/** 그 조치의 효과가 언제 보이나 — 현상 대응은 나중, 노출 대응은 바로 */
const effectOf = (r: WhatIfResponse | null): string =>
  r?.kind === "현상" ? "결과는 다음 단계부터 보입니다" : "지도에 바로 섭니다";

/**
 * 이 조치가 **무엇을 바꾸나** — 펴진 카드가 고를 이유를 댄다.
 * 규정이 왜 떴는지(트리거)는 머리글이 이미 말하므로 거기서 되풀이하지 않는다.
 * 무엇이 달라지는지는 대응 성격이 정한다(README §2.3 기준 ③ · 노출 대응의 결과는 여유 시간 하나다).
 * 지명·지표 이름을 박지 않는다 — 사건이 늘면 그 자리가 먼저 틀린다.
 */
const changesOf = (r: WhatIfResponse | null): string =>
  r?.effect
    ?? (r?.kind === "현상"
      ? "이 판단이 수위와 도달 시각을 바꿉니다"
      : "도달까지 얼마나 여유를 두는지가 달라집니다");

export function TrainingActions({ rows, at, note, acts, onAct, onUndo, frozen }: {
  rows: ActionRow[];
  at: string;
  note: string;
  acts: Record<string, string>;
  onAct: (sopId: string) => void;
  onUndo: (sopId: string) => void;
  /** 시간이 흐르는 중 — 이미 지나간 시각으로 조치가 들어가면 안 된다 */
  frozen?: boolean;
}) {
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  /* 안 한 것 중 첫 번째 — 늘 펴져 있다 */
  const first = rows.find((r) => !acts[r.sop.id]);

  if (rows.length === 0) {
    return (
      <section className="flex flex-col gap-1 p-3" aria-label="지금 해야 할 조치">
        <h2 className="text-body font-semibold text-foreground">지금 해야 할 조치</h2>
        <p className="break-keep text-caption text-foreground-muted">이 시점에 남은 조치가 없습니다. 다음 단계로 넘어가세요.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2 p-3" aria-label="지금 해야 할 조치">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-body font-semibold text-foreground">지금 해야 할 조치</h2>
        {/* 와이어프레임대로 "3건 발동". 시작 직후엔 실행이 늘 0건이라 읽을 게 없고,
            시각 옆에 `실행` 이 붙으면 "14:35 에 실행"으로 읽힌다. 실행 수는 카드가 내려가며 보인다 */}
        <span className="shrink-0 text-caption text-foreground-subtle">{formatClock(at)} · {rows.length}건 발동</span>
      </header>
      <p className="break-keep text-caption text-foreground-subtle">{note}</p>

      {rows.map((r) => {
        const done = acts[r.sop.id] === at;
        const open = r === first || opened[r.sop.id];
        const core = r.response?.kind === "현상";

        if (done) {
          return (
            <div key={r.sop.id} className="flex flex-col gap-1.5 rounded-md border border-success bg-card px-2.5 py-2">
              <span className="flex items-center gap-1.5 text-caption font-semibold text-foreground">
                <Icon icon="mdi:check" className="size-4 shrink-0 text-success" aria-hidden />
                {r.sop.id} {r.sop.label}
                <Tag tone="success">{formatClock(at)} 실행</Tag>
              </span>
              <span className="break-keep text-caption leading-snug text-foreground-subtle">{effectOf(r.response)}</span>
              <Button size="sm" variant="secondary" disabled={frozen} onClick={() => onUndo(r.sop.id)}>되돌리기</Button>
            </div>
          );
        }

        if (!open) {
          return (
            <button
              key={r.sop.id}
              type="button"
              onClick={() => setOpened((p) => ({ ...p, [r.sop.id]: true }))}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-left text-caption text-foreground-muted transition-colors hover:text-foreground"
            >
              {r.sop.id} {r.sop.label}
              <Tag className="ml-auto shrink-0">펴기</Tag>
            </button>
          );
        }

        return (
          <div key={r.sop.id} className={cn("flex flex-col gap-1 rounded-md border bg-card px-2.5 py-2", core ? "border-warning" : "border-border")}>
            <span className="flex items-center gap-1.5 text-caption font-semibold text-foreground">
              {r.sop.id} {r.sop.label}
              {core && <Tag tone="warning">핵심</Tag>}
            </span>
            <span className="break-keep text-caption leading-snug text-foreground-subtle">{changesOf(r.response)}</span>
            {/* 지침 — 근거가 있는 것만. 없으면 줄 자체를 그리지 않는다 */}
            {r.response?.level && (
              <span className="break-keep border-t border-border pt-1 text-caption leading-snug text-foreground-subtle">
                <span className="text-foreground-muted">지침</span> {r.response.target} · {r.response.level}
              </span>
            )}
            <Button size="sm" className="mt-1" disabled={frozen} onClick={() => onAct(r.sop.id)}>실행</Button>
          </div>
        );
      })}

      <p className="break-keep text-caption leading-snug text-foreground-subtle">
        실행해도 <span className="text-foreground-muted">시계는 그대로</span>입니다. 같은 시각에 여러 건을 할 수 있고,
        [다음 단계]를 누르기 전까지 되돌릴 수 있습니다. 안 한 조치는 실제와 같은 시각에 한 것으로 봅니다.
      </p>
    </section>
  );
}
