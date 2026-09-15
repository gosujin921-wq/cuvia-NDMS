/* ─────────────────────────────────────────────
 * 훈련 시나리오 — 대응 모의훈련 우측 레일 첫 카드 (IA §13.1 · IA-T01)
 *
 * "무엇으로 훈련하는가"를 한 장에 세운다. D8 이 종료 시점 스냅샷으로 묶은 원 사건 · 기준시각 ·
 * 훈련 목표 · 바꿀 수 있는 조건. 시나리오가 여럿이면 여기서 고른다.
 *
 * ★ 원 사건의 값을 여기서 고치지 않는다. 스냅샷은 읽기 전용이고, 훈련 중 결정은 TrainingRun 이 든다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tag } from "@ds";
import type { TrainingScenario } from "../../../model/training";
import { formatClock } from "../../../lib/datetime";

export function TrainingScenarioCard({ scenarios, scenario, sourceTitle, onSelect, header }: {
  scenarios: TrainingScenario[];
  scenario: TrainingScenario;
  /** 원 사건 제목 — 시나리오는 id 만 들고 있다 */
  sourceTitle: string;
  onSelect: (scenarioId: string) => void;
  /** 머리 오른쪽 자리 — 출처 전환 */
  header?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 p-3" aria-label="사건 스냅샷">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-body font-semibold text-foreground">사건 스냅샷</h2>
        {header}
      </header>
      <p className="font-mono text-caption text-foreground-subtle">v{scenario.snapshotVersion} · {formatClock(scenario.createdAt)} 생성</p>

      {scenarios.length > 1 ? (
        <Select value={scenario.scenarioId} onValueChange={onSelect}>
          <SelectTrigger className="h-8 text-caption" aria-label="사건 스냅샷 선택">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {scenarios.map((s) => (
              <SelectItem key={s.scenarioId} value={s.scenarioId} className="text-caption">{s.scenarioId}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="truncate font-mono text-caption text-foreground-muted">{scenario.scenarioId}</p>
      )}

      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-body font-semibold text-foreground">{sourceTitle}</span>
        <Tag className="shrink-0">{scenario.source.hazardKind}</Tag>
      </div>
      <dl className="grid grid-cols-[64px_1fr] gap-x-2 gap-y-0.5 text-caption">
        <dt className="text-foreground-muted">범위</dt>
        <dd className="truncate text-foreground">{scenario.source.scope.label} · {scenario.source.scopeKind}</dd>
        <dt className="text-foreground-muted">스냅샷</dt>
        <dd className="font-mono text-foreground">{formatClock(scenario.timing.snapshotAt)} 종료 시점</dd>
        <dt className="text-foreground-muted">기준시각</dt>
        <dd className="font-mono text-foreground">{formatClock(scenario.timing.trainingBaseTime)} <span className="text-foreground-subtle">· 원 사건 시작 {formatClock(scenario.timing.originalStartAt)}</span></dd>
        <dt className="text-foreground-muted">이벤트</dt>
        <dd className="text-foreground">{scenario.conditionEvents.length}건 <span className="text-foreground-subtle">· 원 이벤트 참조, 수정 없음</span></dd>
      </dl>


      <div className="flex flex-col gap-1 border-t border-border pt-1.5">
        <p className="text-caption font-semibold text-foreground-muted">훈련 목표</p>
        <ul className="flex flex-col gap-0.5">
          {scenario.training.objectives.map((o) => (
            <li key={o} className="flex items-start gap-1 text-caption text-foreground">
              <Icon icon="mdi:target" className="mt-px size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
              <span>{o}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-caption text-foreground-subtle">바꿀 수 있는 조건 · {scenario.training.changeableConditions.join(" · ")}</p>
      </div>
    </section>
  );
}
