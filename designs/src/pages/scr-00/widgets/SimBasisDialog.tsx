/* ─────────────────────────────────────────────
 * 근거 — 입력과 계산 (scr-00 · 2026-09-17)
 *
 * 패널에 흩어져 있던 출처·산식·범례·면책 문장을 전부 여기로 모았다. 패널은 판단에 쓰는 값만 들고,
 * "이 값이 어디서 왔나"는 이 창에서 한 번에 본다(2026-09-17 사용자 "우측에 기획을 다 때려넣었다").
 * 값을 다시 계산하지 않는다. 판이 스스로 든 근거(`Forecast.basis`)가 있으면 그것도 그대로 편다.
 * scr-05 `ForecastBasisDialog` 는 진행 중 사건용(훈련 불가 안내)이라 재현 대상인 여기서는 쓰지 않는다.
 * ───────────────────────────────────────────── */

import { Tag } from "@ds";
import { FormDialog } from "../../../components/FormDialog";
import { formatClock, formatStamp } from "../../../lib/datetime";
import type { Forecast } from "../../../model/forecast";

export interface BasisNote { heading: string; lines: string[] }

export function SimBasisDialog({ title, notes, forecast, onClose }: {
  title: string;
  notes: BasisNote[];
  /** 지금 서 있는 판. 근거를 들고 있으면 모델·입력·가정을 편다 */
  forecast?: Forecast | null;
  onClose: () => void;
}) {
  const b = forecast?.basis ?? null;
  return (
    <FormDialog
      open
      onClose={onClose}
      icon="mdi:file-search-outline"
      title={`${title} · 근거`}
      description="값이 어디서 왔고 무엇을 가정했는지. 판단은 보는 사람이 합니다"
      contentClassName="w-[640px] max-w-[calc(100vw-2rem)] sm:max-w-[640px] max-h-[92vh]"
      bodyClassName="flex flex-col gap-4 px-4 py-4"
    >
      {notes.filter((n) => n.lines.length > 0).map((n) => (
        <section key={n.heading} className="flex flex-col gap-1.5" aria-label={n.heading}>
          <h3 className="text-body font-semibold text-foreground">{n.heading}</h3>
          <ul className="flex flex-col gap-1 text-caption">
            {n.lines.map((l) => (
              <li key={l} className="flex items-baseline gap-1.5">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-foreground-subtle" aria-hidden />
                <span className="min-w-0 break-keep leading-snug text-foreground">{l}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {b && (
        <>
          <section className="flex flex-col gap-1.5" aria-label="무엇이 계산했나">
            <h3 className="text-body font-semibold text-foreground">무엇이 계산했나</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-caption">
              <dt className="text-foreground-muted">모델</dt>
              <dd className="min-w-0 break-keep text-foreground">{b.modelName} <span className="font-mono text-foreground-subtle">v{b.modelVersion}</span></dd>
              <dt className="text-foreground-muted">기준시각</dt>
              <dd className="font-mono text-foreground">{formatStamp(b.baseTime)}</dd>
              <dt className="text-foreground-muted">계산 주체</dt>
              <dd className="min-w-0 break-keep text-foreground">{b.calculationActor}</dd>
              <dt className="text-foreground-muted">입력 품질</dt>
              <dd className="min-w-0 break-keep text-foreground">{b.inputQuality}</dd>
            </dl>
          </section>
          {(b.inputs ?? []).length > 0 && (
            <section className="flex flex-col gap-1.5" aria-label="무엇을 넣었나">
              <h3 className="text-body font-semibold text-foreground">무엇을 넣었나</h3>
              <ul className="flex flex-col text-caption">
                {(b.inputs ?? []).map((i) => (
                  <li key={`${i.label}-${i.at}`} className="flex items-baseline justify-between gap-2 border-b border-border py-1 last:border-0">
                    <span className="flex min-w-0 items-baseline gap-1.5"><Tag>{i.kind}</Tag><span className="min-w-0 break-keep text-foreground">{i.label}</span></span>
                    <span className="shrink-0 font-mono text-caption text-foreground-subtle">{formatClock(i.at)}까지</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {(b.assumptions ?? []).length > 0 && (
            <section className="flex flex-col gap-1.5" aria-label="무엇을 가정했나">
              <h3 className="text-body font-semibold text-foreground">무엇을 가정했나</h3>
              <ul className="flex flex-col gap-1 text-caption">
                {(b.assumptions ?? []).map((a) => (
                  <li key={a} className="flex items-baseline gap-1.5">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-foreground-subtle" aria-hidden />
                    <span className="min-w-0 break-keep text-foreground">{a}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="flex flex-col gap-1" aria-label="어디가 흔들리나">
            <header className="flex items-baseline justify-between gap-2">
              <h3 className="text-body font-semibold text-foreground">어디가 흔들리나</h3>
              <span className="shrink-0 text-caption font-semibold text-foreground">불확실성 {b.uncertainty.grade}</span>
            </header>
            <p className="break-keep text-caption text-foreground-muted">민감 · {b.uncertainty.sensitiveTo.join(" · ")}</p>
            {b.uncertainty.unusableRanges.length > 0 && (
              <p className="break-keep text-caption text-warning">이 구간은 쓰지 않습니다 · {b.uncertainty.unusableRanges.join(" · ")}</p>
            )}
          </section>
        </>
      )}
    </FormDialog>
  );
}
