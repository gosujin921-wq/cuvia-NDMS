/* ─────────────────────────────────────────────
 * 훈련 기록 — TrainingRun (IA §13.1 · §15)
 *
 * 훈련 중 내린 결정·조치·결과는 여기만 쌓인다. 원 사건의 Decision·Action·Outcome 은 비교·회고
 * 기준으로만 세우고 정답으로 재실행하지 않는다. 시각은 훈련 축 위 시각(상대시간 재생)이다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { StatusBadge, cn } from "@ds";
import type { TrainingRun, TrainingScenario } from "../../../model/training";
import { formatClock } from "../../../lib/datetime";
import { ALTERNATIVE_LABEL } from "../../../model/forecast";

const KIND_LABEL = { decisions: "결정", actions: "조치", outcomes: "결과" } as const;
const KIND_ICON = { decisions: "mdi:gavel", actions: "mdi:clipboard-play-outline", outcomes: "mdi:flag-checkered" } as const;

export function TrainingRunCard({ scenario, run, runs }: {
  scenario: TrainingScenario;
  /** 이 시나리오의 최근 훈련. 없으면 시작 전 */
  run: TrainingRun | null;
  /** 이 시나리오로 돈 훈련 전체 — 회차 표기 */
  runs: TrainingRun[];
}) {
  const entries = run
    ? (["decisions", "actions", "outcomes"] as const)
        .flatMap((kind) => run[kind].map((e) => ({ kind, ...e })))
        .sort((a, b) => a.at.localeCompare(b.at))
    : [];
  const original = scenario.history;

  return (
    <section className="flex flex-col gap-1.5 p-3" aria-label="훈련 기록">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-body font-semibold text-foreground">훈련 기록{runs.length > 0 && <span className="ml-1 font-mono text-caption text-foreground-subtle">{runs.length}회차</span>}</h2>
        {run ? (
          <StatusBadge status={run.status === "완료" ? "done" : run.status === "진행중" ? "active" : "pending"} label={run.status} className="shrink-0" />
        ) : (
          <span className="text-caption text-foreground-subtle">시작 전</span>
        )}
      </header>

      {/* 원 사건 이력 — 비교 기준. 훈련이 이 숫자를 맞추는 것이 목표가 아니다. 조건 세트 훈련에는 원 사건 이력이 없다 */}
      <p className="text-caption text-foreground-muted">
        {scenario.origin === "incident-snapshot"
          ? <>원 사건 이력 · 결정 {original.decisionIds.length} · 조치 {original.actionIds.length} · 결과 {original.outcomeIds.length}<span className="text-foreground-subtle"> · 회고 기준으로만 사용</span></>
          : <>조건 세트 훈련 · {scenario.conditionSet?.label ?? ""}<span className="text-foreground-subtle"> · 비교할 원 사건 이력 없음</span></>}
      </p>

      {run && (
        <p className="font-mono text-caption text-foreground-subtle">
          {run.startedAt && `시작 ${formatClock(run.startedAt)}`}{run.endedAt && ` · 종료 ${formatClock(run.endedAt)}`} · {run.participants.join(", ")}
        </p>
      )}

      {entries.length > 0 ? (
        <ol className="flex flex-col gap-1 border-t border-border pt-1.5">
          {entries.map((e, i) => (
            <li key={`${e.kind}-${i}`} className="flex items-start gap-1.5 text-caption">
              <Icon icon={KIND_ICON[e.kind]} className="mt-px size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
              <span className="w-[48px] shrink-0 font-mono text-foreground-muted">{formatClock(e.at)}</span>
              {e.kind === "decisions" && e.alternativeId ? (
                /* 결정 — "도로 통제 결정 → 17:45 통제 시작". 시각·상황·선택이 자동으로 들어온 기록이다 */
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="text-foreground">{ALTERNATIVE_LABEL[e.alternativeId]} {e.alternativeId === "baseline" ? "· 대응하지 않음" : "결정"}</span>
                  {e.startAt && <span className="font-mono text-foreground-muted">→ {formatClock(e.startAt)} 시작</span>}
                  {e.memo && <span className="text-foreground-subtle">{e.memo}</span>}
                </span>
              ) : (
                <>
                  <span className={cn("shrink-0 text-foreground-muted")}>{KIND_LABEL[e.kind]}</span>
                  <span className="min-w-0 flex-1 text-foreground">{e.summary}</span>
                </>
              )}
            </li>
          ))}
        </ol>
      ) : run ? (
        <p className="border-t border-border pt-1.5 text-caption text-foreground-subtle">아직 기록이 없습니다. 대안과 유효 시각을 고르고 결정을 기록합니다.</p>
      ) : null}

      {run?.retrospective && (
        <p className="flex items-start gap-1 border-t border-border pt-1.5 text-caption text-foreground">
          <Icon icon="mdi:comment-text-outline" className="mt-px size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
          <span>{run.retrospective}</span>
        </p>
      )}
    </section>
  );
}
