/* ─────────────────────────────────────────────
 * 대응 절차(SOP) + 실행 결과 — 03 화면정의서 §3 우측 2·4 · 04 §11 · §13
 *
 * 승인 대응등급의 항목이 자동으로 표출된다. 항목마다 자동 처리 / 승인 후 실행을 밝히고,
 * 승인 전에는 제안 상태(실행 버튼 잠김)다. [승인·실행]을 누르면 항목이 위에서 아래로
 * 하나씩 넘어간다(0.45초 간격) — 한 번에 다 체크되면 "버튼을 눌렀더니 화면이 바뀐" 것으로
 * 보이고, 하나씩 넘어가면 "일이 진행되는" 것으로 보인다. (IDC SopChecklist 패턴)
 *
 * 실행 결과는 실패를 성공처럼 칠하지 않는다. 경남 보고(자동 처리 · 등급 확정 후 실행)가
 * 연계 끊김으로 실패하고, [유선 보고 기록]이 대체 조치를 같은 기록에 잇는다.
 * ───────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { Button, StatusDotLabel, Tag, cn, toast } from "@ds";
import { sopItemsFor, HERO_SOP_RESULTS, type SopItem } from "../../../demo/sop";
import { levelSpec, type AlertLevel } from "../../../demo/levels";
import { formatClock } from "../../../lib/datetime";
import { useScenario } from "../../../state/ScenarioProvider";

/** 항목이 하나씩 완료로 넘어가는 간격 — 일이 진행되는 속도로 보이는 값 (03 §3) */
const STEP_MS = 450;

interface SopPanelProps {
  /** SOP 가 따르는 등급 — 승인 대응등급, 승인 전에는 권고 (04 §10-1) */
  level: AlertLevel;
  /** 담당자가 등급을 승인했는가 — 승인 전에는 제안 상태로 잠긴다 */
  approved: boolean;
  /** 실행 완료 시 전파 내역에 한 줄을 쌓는다 (04 §7-3) */
  onExecuted: () => void;
}

export function SopPanel({ level, approved, onExecuted }: SopPanelProps) {
  const { sopExecuted, completeSopExecution, phoneReportedAt, logPhoneReport } = useScenario();
  const items = sopItemsFor(level);
  const approvalItems = items.filter((item) => item.mode === "approval");

  const [checked, setChecked] = useState<string[]>([]);
  const [running, setRunning] = useState<string[]>([]);
  const [executing, setExecuting] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    },
    [],
  );

  /** [승인·실행] — 체크한 항목을 0.45초 간격으로 순차 실행하고 엔진에 반영한다 */
  const run = () => {
    const ids = approvalItems.filter((i) => checked.includes(i.id)).map((i) => i.id);
    if (ids.length === 0) {
      toast.error("승인할 항목을 하나 이상 고르세요.");
      return;
    }
    setExecuting(true);
    ids.forEach((id, index) => {
      timers.current.push(window.setTimeout(() => setRunning((prev) => [...prev, id]), index * STEP_MS));
    });
    timers.current.push(
      window.setTimeout(() => {
        completeSopExecution();
        onExecuted();
        toast.success("SOP 실행 완료 — 실행 결과를 확인하세요. 자동 항목도 결과 확인이 필요합니다.");
      }, ids.length * STEP_MS + 200),
    );
  };

  const spec = levelSpec(level);

  return (
    <section className="flex flex-col gap-2 p-3" aria-label="대응 절차">
      <header className="flex items-baseline gap-2">
        <h2 className="text-body font-semibold text-foreground">대응 절차</h2>
        <Tag className="shrink-0">SOP-해일-{spec.label}</Tag>
        {!approved && (
          <span className="ml-auto shrink-0 text-caption text-foreground-subtle">제안 상태</span>
        )}
      </header>

      {sopExecuted ? (
        <ResultList phoneReportedAt={phoneReportedAt} onPhoneReport={logPhoneReport} />
      ) : (
        <>
          <ul className="flex flex-col">
            {items.map((item) => (
              <SopRow
                key={item.id}
                item={item}
                approved={approved}
                checked={checked.includes(item.id)}
                running={running.includes(item.id)}
                disabled={!approved || executing}
                onToggle={() =>
                  setChecked((prev) =>
                    prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id],
                  )
                }
              />
            ))}
          </ul>

          {/* 승인 전: 되돌릴 수 없는 조치는 승인 없이 나가지 않는다(04 §11-1).
              승인 후: [전체 승인·실행] 한 번으로 세 갈래가 동시에 나간다(05 S6) */}
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={!approved || executing}
              onClick={() => setChecked(approvalItems.map((i) => i.id))}
            >
              전체 승인
            </Button>
            <Button size="sm" className="flex-1" disabled={!approved || executing} onClick={run}>
              <Icon icon="mdi:send" className="size-4" aria-hidden />
              승인 · 실행
            </Button>
          </div>
          {!approved && (
            <p className="text-caption text-foreground-subtle">
              위 판정 카드에서 대응등급을 승인하면 실행 버튼이 열립니다
            </p>
          )}
        </>
      )}
    </section>
  );
}

function SopRow({
  item,
  approved,
  checked,
  running,
  disabled,
  onToggle,
}: {
  item: SopItem;
  approved: boolean;
  checked: boolean;
  running: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const auto = item.mode === "auto";
  /* 자동 처리의 실행 조건 — 내부 3종은 이미 끝났고(✓), 상급기관 보고는 등급 확정
     후에 나간다(⋯ 조건 대기 · 04 §11-2 표기). 승인이 서도 결과가 판명되기 전에는
     ✓ 로 칠하지 않는다 — 실패할 항목을 성공처럼 미리 보이면 S7 의 회수가 죽는다(05 S7).
     결과는 실행 결과 목록이 말한다 */
  const done = auto ? !item.afterApproval : running;
  const pending = auto && item.afterApproval && !approved;

  return (
    <li
      className={cn(
        "flex items-center gap-2 border-b border-border py-1.5 last:border-b-0",
        running && "bg-surface-raised",
      )}
    >
      {auto ? (
        <Icon
          icon={done ? "mdi:check-circle" : "mdi:dots-horizontal-circle-outline"}
          className={cn("size-4 shrink-0", done ? "text-success" : "text-foreground-subtle")}
          aria-hidden
        />
      ) : (
        <input
          type="checkbox"
          checked={checked || running}
          disabled={disabled}
          onChange={onToggle}
          aria-label={`${item.label} 승인`}
          className="size-3.5 shrink-0 accent-[var(--color-primary)]"
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "truncate text-caption",
            done || running ? "text-foreground" : "text-foreground-muted",
          )}
        >
          {item.label}
        </span>
        {item.target !== "—" && (
          <span className="truncate text-caption text-foreground-subtle">{item.target}</span>
        )}
      </span>
      <span
        className={cn(
          "shrink-0 text-caption",
          auto ? "text-foreground-subtle" : "font-medium text-foreground-muted",
        )}
      >
        {auto ? (pending ? "조건 대기" : "자동 처리") : "승인 후 실행"}
      </span>
    </li>
  );
}

/* ── 실행 결과 (04 §13) — 성공 셋과 실패 하나가 같은 목록에 나란히 선다 ── */

function ResultList({
  phoneReportedAt,
  onPhoneReport,
}: {
  phoneReportedAt: Date | null;
  onPhoneReport: () => void;
}) {
  /* 실행 시각 = 승인 시각(17:37) + 항목별 오프셋. now 가 아니라 고정 계산 —
     결과는 그때 일어난 일이지 화면을 보는 시각이 아니다 */
  const executedAt = new Date("2026-08-12T17:37:00");

  return (
    <div className="flex flex-col gap-1.5" aria-label="실행 결과">
      <ul className="flex flex-col">
        {HERO_SOP_RESULTS.map((result) => (
          <li
            key={result.itemId}
            className="flex flex-col gap-0.5 border-b border-border py-1.5 last:border-b-0"
          >
            <div className="flex items-center gap-2">
              <Icon
                icon={result.ok ? "mdi:check-circle" : "mdi:close-circle"}
                className={cn("size-4 shrink-0", result.ok ? "text-success" : "text-danger")}
                aria-hidden
              />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-caption",
                  result.ok ? "text-foreground" : "font-medium text-danger",
                )}
              >
                {result.label}
              </span>
              <span className="shrink-0 font-mono text-caption text-foreground-subtle">
                {formatClock(new Date(executedAt.getTime() + result.offsetMin * 60_000))}
              </span>
            </div>
            <span
              className={cn(
                "pl-6 text-caption",
                result.ok ? "text-foreground-muted" : "text-danger",
              )}
            >
              {result.outcome}
            </span>

            {/* 실패 항목의 대체 조치 — [유선 보고 기록]이 같은 기록에 이어 붙는다(04 §13-1) */}
            {!result.ok &&
              (phoneReportedAt ? (
                <div className="ml-6 mt-1 flex items-center gap-1.5 rounded border border-border px-2 py-1">
                  <StatusDotLabel status="success" label="유선 보고" />
                  <span className="min-w-0 flex-1 truncate text-caption text-foreground-muted">
                    경상남도 재난안전상황실 당직 · 기록자 상황실 담당
                  </span>
                  <span className="shrink-0 font-mono text-caption text-foreground-subtle">
                    {formatClock(phoneReportedAt)}
                  </span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-6 mt-1 w-fit"
                  onClick={() => {
                    onPhoneReport();
                    toast.success("유선 보고를 기록했습니다 — 대체 조치가 같은 사건 이력에 남습니다.");
                  }}
                >
                  <Icon icon="mdi:phone" className="size-3.5" aria-hidden />
                  유선 보고 기록
                </Button>
              ))}
          </li>
        ))}
      </ul>
      <p className="text-caption text-foreground-subtle">
        자동 처리는 승인이 필요 없다는 뜻이지 확인이 필요 없다는 뜻이 아닙니다 — 실패는
        실패로 표시되고 대체 조치까지 같은 기록에 남습니다
      </p>
    </div>
  );
}
