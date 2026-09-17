/* ─────────────────────────────────────────────
 * 지난 훈련 한 회 — 목록 위에 뜨는 상세 창 (03 §26.9 · 2026-09-17)
 *
 * 게시판 줄을 누르면 목록 위에 창이 열린다(platform_web 방식 · 게시판에서 페이지로 나가지 않는다).
 * 줄이 요약이라면 창은 **그 회를 다시 읽는 자리**다 — 무엇을 언제 했고, 그래서 무엇이 달라졌나.
 *
 * ★ **지도 한 장이 맨 위다.** 숫자만 남기면 "그때 어땠는지"가 안 돌아온다. 저장 시점에 떠 둔
 *   화면이라 시나리오를 고쳐도 다시 그리지 않는다(`run.mapImage`).
 * ★ 값은 전부 저장 시점의 것이다. 여기서 다시 계산하지 않는다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Tag, cn } from "@ds";
import { FormDialog } from "../../../components/FormDialog";
import { formatClock } from "../../../lib/datetime";
import { formatLagMinutes } from "../../../lib/forecast-twin";
import { myActionsOf } from "../../../lib/training-report";
import type { TrainingRun } from "../../../model/whatif";

const stamp = (iso: string): string => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function TrainingRunDialog({ run, onClose, onReport }: {
  run: TrainingRun | null;
  onClose: () => void;
  onReport: (run: TrainingRun) => void;
}) {
  if (!run) return null;
  const acted = myActionsOf(run);
  /* 기준을 넘었나 — 저장된 표에서 읽는다(여기서 판을 다시 보지 않는다) */
  const cross = run.rows.find((r) => r.label.includes("초과"))?.mine ?? "?";
  const held = cross === "없음";

  return (
    <FormDialog
      open
      onClose={onClose}
      icon="mdi:clipboard-text-clock-outline"
      title={run.incidentTitle}
      description={
        <span className="flex flex-wrap items-center gap-1.5 text-caption text-foreground-subtle">
          <span className="rounded border border-border bg-surface-raised px-1.5 py-0.5 font-mono font-medium text-foreground-muted">{run.runId}</span>
          <Tag tone={run.conditionLabel.includes("당시") ? undefined : "warning"}>{run.conditionLabel}</Tag>
          <span>{run.author} · {stamp(run.finishedAt)}</span>
        </span>
      }
      contentClassName="w-[720px] max-w-[calc(100vw-2rem)] sm:max-w-[720px] max-h-[92vh]"
      bodyClassName="flex flex-col gap-4 px-4 py-4"
      footer={
        <>
          <div className="flex-1" aria-hidden />
          <FormDialog.PrimaryButton onClick={() => onReport(run)}>
            <Icon icon="mdi:file-document-outline" className="size-4 shrink-0" aria-hidden />
            훈련 보고서
          </FormDialog.PrimaryButton>
        </>
      }
    >
      {/* 그때 지도 — 이 창에서 가장 먼저 보여야 하는 것 */}
      {run.mapImage ? (
        <figure className="flex flex-col gap-1">
          <img src={run.mapImage} alt={`${run.incidentTitle} 훈련 결과 지도`} className="w-full rounded-md border border-border" />
          <figcaption className="break-keep text-caption text-foreground-subtle">
            마친 시점 {formatClock(run.stops[run.stops.length - 1]?.at ?? run.finishedAt)} · 저장할 때 떠 둔 화면입니다
          </figcaption>
        </figure>
      ) : (
        <p className="break-keep rounded-md border border-border bg-card px-3 py-2 text-caption text-foreground-subtle">
          저장 시점 지도를 남기지 못했습니다
        </p>
      )}

      <section className="flex flex-col gap-1.5" aria-label="결과">
        <header className="flex items-baseline justify-between gap-2">
          <h3 className="text-body font-semibold text-foreground">결과</h3>
          <span className="shrink-0 text-caption text-foreground-subtle">둘 다 {run.conditionLabel}</span>
        </header>
        <div className="grid grid-cols-[1fr_minmax(0,1fr)_minmax(0,1fr)] items-start gap-x-2 gap-y-1 rounded-md border border-border bg-card px-2.5 py-2 text-caption">
          <span />
          <span className="text-right font-semibold text-foreground-muted">실제와 같게</span>
          <span className="text-right font-semibold text-primary-text">내 훈련</span>
          {run.rows.map((r) => (
            <span key={r.label} className="contents">
              <span className="min-w-0 break-keep leading-tight text-foreground-muted">{r.label}</span>
              <span className="text-right font-mono leading-tight text-foreground-muted">{r.base}</span>
              <span className={cn("text-right font-mono font-semibold leading-tight", r.base === r.mine ? "text-foreground-muted" : "text-foreground")}>{r.mine}</span>
            </span>
          ))}
        </div>
        <p className={cn("break-keep text-caption leading-snug", held ? "text-success" : "text-warning")}>{run.headline}</p>
      </section>

      <section className="flex flex-col gap-1.5" aria-label="내 조치">
        <header className="flex items-baseline justify-between gap-2">
          <h3 className="text-body font-semibold text-foreground">내 조치</h3>
          <span className="shrink-0 text-caption text-foreground-subtle">{acted.length > 0 ? `${acted.length}건 실행` : "실행한 조치 없음"}</span>
        </header>
        <ul className="flex flex-col text-caption">
          {run.sopRows.map((s) => (
            <li key={s.id} className="flex flex-col gap-0.5 border-b border-border py-1 last:border-0">
              <span className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 break-keep text-foreground">{s.id} {s.label}</span>
                <span className="shrink-0 text-right font-mono text-foreground-subtle">
                  {s.mineAt
                    ? <><span className="font-semibold text-foreground">{formatClock(s.mineAt)}</span> · {formatLagMinutes(s.mineLagMin ?? 0)}{s.realLagMin !== null && ` · 실제 ${formatLagMinutes(s.realLagMin)}`}</>
                    : <>안 함 · 실제와 같게{s.realLagMin !== null && `(${formatLagMinutes(s.realLagMin)})`}</>}
                </span>
              </span>
              {s.reason && <span className="break-keep text-caption leading-snug text-foreground-subtle">이유 · {s.reason}</span>}
            </li>
          ))}
        </ul>
        <p className="break-keep text-caption text-foreground-subtle">
          목표 시간 기준이 없어 <span className="text-foreground-muted">양호·지연으로 판정하지 않습니다</span>
        </p>
      </section>

      {(run.improvements ?? []).length > 0 && (
        <section className="flex flex-col gap-1.5" aria-label="고칠 거리">
          <h3 className="text-body font-semibold text-foreground">고칠 거리</h3>
          <ul className="flex flex-col gap-1 text-caption">
            {(run.improvements ?? []).map((x, i) => (
              <li key={`${x.axis}-${i}`} className="flex items-baseline gap-2">
                <Tag>{x.axis}</Tag>
                <span className="min-w-0 break-keep text-foreground">{x.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </FormDialog>
  );
}
