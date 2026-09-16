/* ─────────────────────────────────────────────
 * 모의훈련 › 지난 훈련 — 훈련 한 회씩 쌓인다 (03 §26.9 · 2026-09-16 v2)
 *
 * 같은 사건을 조건만 바꿔 여러 번 훈련하면 목록에서 **"어디까지 버티나"** 가 읽힌다.
 * ★ 표시값은 저장 시점의 것이다(`rows`·`headline`). 판을 고치거나 모델을 교체해도
 *   과거 훈련 결과가 소급해서 바뀌지 않는다 — "그때 이렇게 나왔다"는 기록이라서다.
 * ───────────────────────────────────────────── */

import { useMemo } from "react";
import { DataTable, EmptyState, Tag, cn } from "@ds";
import { useScenario } from "../../state/ScenarioProvider";
import { formatClock } from "../../lib/datetime";

const stamp = (iso: string): string => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function TrainingRunBoard({ onNew }: { onNew: () => void }) {
  const { trainingRuns } = useScenario();

  /* 사건별로 묶어 회차를 대비한다. 조건이 나빠질수록 어디서 무너지는지가 보여야 한다 */
  const groups = useMemo(() => {
    const by = new Map<string, typeof trainingRuns>();
    for (const r of trainingRuns) by.set(r.incidentId, [...(by.get(r.incidentId) ?? []), r]);
    return [...by.entries()]
      .filter(([, runs]) => runs.length > 1)
      .map(([incidentId, runs]) => {
        const rows = runs
          .map((r) => {
            const cross = r.rows.find((x) => x.label.includes("초과"))?.mine ?? "?";
            const peak = r.rows.find((x) => x.label.includes("최고"))?.mine ?? "?";
            return { ...r, cross, peak, held: cross === "없음" };
          })
          /* 당시 → +20% → +50% 순. 조건 이름에 든 수를 기준으로 */
          .sort((a, b) => (Number.parseInt(a.conditionLabel.replace(/\D/g, "") || "0", 10)) - (Number.parseInt(b.conditionLabel.replace(/\D/g, "") || "0", 10)));
        const firstFail = rows.find((r) => !r.held);
        const lastHeld = [...rows].reverse().find((r) => r.held);
        return {
          incidentId,
          title: runs[0].incidentTitle,
          runs: rows,
          note: firstFail && lastHeld
            ? `${lastHeld.conditionLabel}까지는 막았고 ${firstFail.conditionLabel}부터 넘었습니다. 그 사이가 우리 규정의 한계입니다`
            : firstFail
              ? "고른 조건 모두에서 기준을 넘었습니다. 조치를 더 앞당기거나 임계를 고쳐야 합니다"
              : "고른 조건 모두에서 막았습니다. 더 나쁜 조건으로 한 번 더 해 보세요",
        };
      });
  }, [trainingRuns]);

  if (trainingRuns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon="mdi:clipboard-text-clock-outline"
          message="아직 저장한 훈련이 없습니다"
          description="훈련을 마치고 강평에서 [훈련 결과 저장]을 누르면 여기 쌓입니다. 같은 사건을 조건만 바꿔 여러 번 해 보면 어디까지 버티는지 보입니다."
          action={<button type="button" onClick={onNew} className="cursor-pointer text-caption text-primary-text">훈련하러 가기 ›</button>}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-title font-semibold text-foreground">지난 훈련</h1>
        <p className="text-body text-foreground-muted">훈련 한 회씩 쌓입니다 · {trainingRuns.length}회</p>
      </header>

      {/* 같은 사건을 조건만 바꿔 여러 번 하면 "어디까지 버티나"가 여기서 읽힌다(03 §26.6).
          회차를 나열만 하면 그 대비가 안 보여 반복 학습의 고리가 끊긴다 */}
      {groups.map((g) => (
        <section key={g.incidentId} className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-3" aria-label={`${g.title} 회차 대비`}>
          <header className="flex items-baseline justify-between gap-2">
            <h2 className="text-body font-semibold text-foreground">{g.title}</h2>
            <span className="shrink-0 text-caption text-foreground-subtle">{g.runs.length}회 · 조건이 나빠질수록</span>
          </header>
          <div className="flex flex-wrap gap-2">
            {g.runs.map((r) => (
              <div key={r.runId} className={cn("flex min-w-[190px] flex-1 flex-col gap-0.5 rounded-md border px-2.5 py-2",
                r.held ? "border-success" : "border-warning")}>
                <span className="flex items-baseline justify-between gap-2 text-caption">
                  <span className="font-medium text-foreground">{r.conditionLabel}</span>
                  <span className="font-mono text-foreground-subtle">{r.runId}</span>
                </span>
                <span className={cn("font-mono text-caption font-semibold", r.held ? "text-success" : "text-warning")}>
                  {r.held ? "기준 넘지 않음" : `기준 초과 ${r.cross}`}
                </span>
                <span className="font-mono text-caption text-foreground-subtle">최고 {r.peak} · 조치 {r.actions.length}건</span>
              </div>
            ))}
          </div>
          <p className="break-keep text-caption text-foreground-subtle">{g.note}</p>
        </section>
      ))}

      <DataTable
        data={trainingRuns}
        rowKey={(r) => r.runId}
        hidePagination
        columns={[
          { key: "runId", label: "회차", width: "90px", cellClassName: "font-mono", render: (r) => r.runId },
          { key: "title", label: "사건", width: "190px", render: (r) => <span className="font-medium text-foreground">{r.incidentTitle}</span> },
          { key: "cond", label: "조건", width: "130px", render: (r) => <Tag tone={r.conditionLabel.includes("당시") ? undefined : "warning"}>{r.conditionLabel}</Tag> },
          {
            key: "acts", label: "내 조치", width: "230px",
            render: (r) => (r.actions.length === 0
              ? <span className="text-foreground-subtle">없음 · 실제와 같게</span>
              : <span className="break-keep text-caption">{r.actions.map((a) => `${a.sopId} ${formatClock(a.at)}`).join(" · ")}</span>),
          },
          {
            key: "result", label: "결과",
            /* 저장 시점의 문장 그대로 — 지금 판을 다시 계산하지 않는다 */
            render: (r) => <span className="break-keep text-caption text-foreground-muted">{r.headline}</span>,
          },
          {
            key: "imp", label: "고칠 거리", width: "100px", align: "right",
            render: (r) => (r.improvements?.length ? `${r.improvements.length}건` : <span className="text-foreground-subtle">없음</span>),
          },
          { key: "at", label: "마친 시각", width: "110px", cellClassName: "font-mono whitespace-nowrap", render: (r) => stamp(r.finishedAt) },
        ]}
      />
    </div>
  );
}
