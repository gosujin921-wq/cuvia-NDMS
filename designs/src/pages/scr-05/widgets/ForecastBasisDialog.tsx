/* ─────────────────────────────────────────────
 * 예측 근거 — 진행 중 사건의 전망을 재는 창 (README §2.3 · 2026-09-17 사용자)
 *
 * 진행 중 사건은 **훈련할 수 없다.** 훈련의 기준은 "실제와 같게 했을 때"인데 그 실제가 아직 없다.
 * 대신 물을 수 있는 것이 하나 있다 — **지금 저 전망은 무엇으로 계산됐나.**
 *
 * 예측을 믿고 대응을 정하는 자리(재난관제 전망 탭)와, 그 예측이 믿을 만한지 재는 자리(모의훈련)는 다르다.
 * 이 창은 뒤쪽이다. 값을 다시 계산하지 않고 판이 스스로 든 근거(`ForecastBasis`)를 그대로 편다.
 *
 * ★ 판단을 대신하지 않는다. 등급을 매기거나 "믿을 만하다/아니다"를 말하지 않는다 —
 *   무엇을 넣었고 무엇을 가정했으며 어디에 민감한지를 보이고, 판단은 보는 사람이 한다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Tag, cn } from "@ds";
import { FormDialog } from "../../../components/FormDialog";
import { formatClock, formatStamp } from "../../../lib/datetime";
import { TWIN_FAMILY_HAZARD_NAME } from "../../../model/twin-family";
import type { Forecast } from "../../../model/forecast";
import type { WhatIfCase } from "../../../model/whatif";

const GRADE_TONE: Record<string, string> = { 낮음: "text-success", 보통: "text-foreground", 높음: "text-warning" };

/** 입력 한 줄 — 무엇을 언제까지 받았나 */
function InputRow({ label, at, kind }: { label: string; at: string; kind: string }) {
  return (
    <li className="flex items-baseline justify-between gap-2 border-b border-border py-1 last:border-0">
      <span className="flex min-w-0 items-baseline gap-1.5">
        <Tag>{kind}</Tag>
        <span className="min-w-0 break-keep text-foreground">{label}</span>
      </span>
      <span className="shrink-0 font-mono text-caption text-foreground-subtle">{formatClock(at)}까지</span>
    </li>
  );
}

export function ForecastBasisDialog({ wcase, forecast, onClose, onOpenLive }: {
  wcase: WhatIfCase | null;
  /** 지금 서 있는 기준 전망. 없으면 아직 판이 붙지 않은 것이다 */
  forecast: Forecast | null;
  onClose: () => void;
  /** 대응 판단이 있는 자리로 — 그건 여전히 재난관제가 맡는다 */
  onOpenLive: () => void;
}) {
  if (!wcase) return null;
  const b = forecast?.basis ?? null;

  return (
    <FormDialog
      open
      onClose={onClose}
      icon="mdi:scale-balance"
      title={`${wcase.title} · 예측 근거`}
      description={
        <span className="flex flex-wrap items-center gap-1.5 text-caption text-foreground-subtle">
          <Tag tone="warning">진행 중</Tag>
          <span>{TWIN_FAMILY_HAZARD_NAME[wcase.twinFamily]} · {wcase.scope.label}</span>
        </span>
      }
      contentClassName="w-[680px] max-w-[calc(100vw-2rem)] sm:max-w-[680px] max-h-[92vh]"
      bodyClassName="flex flex-col gap-4 px-4 py-4"
      footer={
        <>
          <FormDialog.CancelButton onClick={onOpenLive}>
            <Icon icon="mdi:open-in-new" className="size-4 shrink-0" aria-hidden />
            재난관제에서 열기
          </FormDialog.CancelButton>
          <div className="flex-1" aria-hidden />
        </>
      }
    >
      <p className="break-keep rounded-md border border-border bg-card px-3 py-2 text-caption leading-snug text-foreground-muted">
        진행 중 사건은 <span className="text-foreground">훈련할 수 없습니다</span>. 훈련은 실제로 한 대응과 견주는 것인데
        그 실제가 아직 없습니다. 여기서는 <span className="text-foreground">지금 서 있는 예측이 무엇으로 계산됐는지</span>만 봅니다.
        대응 판단은 재난관제에서 합니다.
      </p>

      {!b ? (
        <p className="break-keep text-caption text-foreground-subtle">이 사건에 아직 기준 예측이 붙지 않았습니다.</p>
      ) : (
        <>
          <section className="flex flex-col gap-1.5" aria-label="무엇이 계산했나">
            <h3 className="text-body font-semibold text-foreground">무엇이 계산했나</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-caption">
              <dt className="text-foreground-muted">모델</dt>
              <dd className="min-w-0 break-keep text-foreground">{b.modelName} <span className="font-mono text-foreground-subtle">v{b.modelVersion}</span></dd>
              <dt className="text-foreground-muted">기준시각</dt>
              <dd className="font-mono text-foreground">{formatStamp(b.baseTime)}</dd>
              <dt className="text-foreground-muted">계산 시각</dt>
              <dd className="font-mono text-foreground">{formatStamp(b.generatedAt)}</dd>
              <dt className="text-foreground-muted">계산 주체</dt>
              <dd className="min-w-0 break-keep text-foreground">{b.calculationActor}</dd>
              <dt className="text-foreground-muted">입력 품질</dt>
              <dd className="min-w-0 break-keep text-foreground">{b.inputQuality}</dd>
              {forecast?.validUntil && (
                <>
                  <dt className="text-foreground-muted">유효</dt>
                  <dd className="font-mono text-foreground">{formatClock(forecast.validUntil)}까지</dd>
                </>
              )}
            </dl>
          </section>

          <section className="flex flex-col gap-1.5" aria-label="무엇을 넣었나">
            <header className="flex items-baseline justify-between gap-2">
              <h3 className="text-body font-semibold text-foreground">무엇을 넣었나</h3>
              <span className="shrink-0 text-caption text-foreground-subtle">{b.observedFrom ? `${formatClock(b.observedFrom)}부터 관측` : ""}</span>
            </header>
            <ul className="flex flex-col text-caption">
              {(b.inputs ?? []).map((i) => <InputRow key={`${i.label}-${i.at}`} label={i.label} at={i.at} kind={i.kind} />)}
            </ul>
          </section>

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

          <section className="flex flex-col gap-1.5" aria-label="어디가 흔들리나">
            <header className="flex items-baseline justify-between gap-2">
              <h3 className="text-body font-semibold text-foreground">어디가 흔들리나</h3>
              <span className={cn("shrink-0 text-caption font-semibold", GRADE_TONE[b.uncertainty.grade] ?? "text-foreground")}>
                불확실성 {b.uncertainty.grade}
              </span>
            </header>
            <p className="break-keep text-caption text-foreground-muted">
              민감 · {b.uncertainty.sensitiveTo.join(" · ")}
            </p>
            {b.uncertainty.unusableRanges.length > 0 && (
              <p className="break-keep text-caption text-warning">
                이 구간은 쓰지 않습니다 · {b.uncertainty.unusableRanges.join(" · ")}
              </p>
            )}
          </section>

          {b.replacementNote && (
            <p className="break-keep border-t border-border pt-2 text-caption text-foreground-subtle">
              {b.replacementNote}
            </p>
          )}

          <p className="break-keep text-caption text-foreground-subtle">
            사건이 끝나면 이 사건도 <span className="text-foreground-muted">훈련으로 돌려 볼 수 있습니다</span> —
            그때는 실제로 한 대응이 기준이 됩니다.
          </p>
        </>
      )}
    </FormDialog>
  );
}
