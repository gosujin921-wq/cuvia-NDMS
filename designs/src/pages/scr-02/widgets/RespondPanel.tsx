/* ─────────────────────────────────────────────
 * 대응 절차 — 03 화면정의서 §2 판단·대응 · §0-9 · 04 §13
 *
 * 분석 이후 이어지는 실행 영역. [대응 실행]이 집중 팝업(승인 · SOP · 실행 · 재전파)을
 * 열고, 실행 뒤에는 결과 요약이 이 카드에 남는다. 판정할 거리(시나리오·승인)가 생긴
 * 뒤에만 선다(§위험도 판정 등장 조건) — 격상까지는 실행으로 보낼 판정이 없다.
 *
 * 조작 가능한 SOP 는 여기 없다. 체크박스·승인·실행은 전부 집중 팝업 몫이라(§0-9
 * 활성 조작면 하나), 같은 조작면이 레일과 팝업에 동시에 서지 않는다. 결과 요약도
 * 읽기 전용이다 — 유선 보고 기록 같은 조작은 팝업을 다시 열어서 한다.
 * ───────────────────────────────────────────── */

import { Button, StatusDotLabel, cn } from "@ds";
import { Icon } from "@iconify/react";
import { FLOOD_SOP_ITEMS, SOP_ITEMS, sopResultsFor } from "../../../demo/sop";
import { formatClock } from "../../../lib/datetime";
import { useScenario } from "../../../state/ScenarioProvider";

interface RespondPanelProps {
  /** [대응 실행] — 주인공 진행 사건에서만 온다. 없으면 버튼이 서지 않는다 */
  onOpenExecution?: () => void;
  /** 집중 팝업이 닫힌 뒤 포커스가 돌아오는 자리 (03 §2 수용 기준) */
  executeButtonRef: React.RefObject<HTMLButtonElement | null>;
  /** 실행 결과 요약을 세울 것인가 — 주인공 사건 + SOP 실행 뒤 */
  showResult: boolean;
  /** 트윈 검토를 마쳤는가 — 검토 전에는 권장 문구가 선다. 승인을 막지는 않는다(03 §2) */
  twinReviewed: boolean;
}

export function RespondPanel({
  onOpenExecution,
  executeButtonRef,
  showResult,
  twinReviewed,
}: RespondPanelProps) {
  return (
    <section className="flex flex-col gap-1.5 p-3" aria-label="대응 절차">
      <h2 className="text-body font-semibold text-foreground">대응 절차</h2>

      {onOpenExecution && (
        <Button ref={executeButtonRef} size="sm" className="w-full" onClick={onOpenExecution}>
          <Icon icon="mdi:arrow-expand-all" className="size-4" aria-hidden />
          대응 실행
        </Button>
      )}

      {/* 트윈이 대응을 막지 않는다 — 선제 승인 전 검토를 권할 뿐, 긴급 시 담당자가
          검토 없이 승인할 수 있다(03 §2 판단·대응) */}
      {onOpenExecution && !showResult && !twinReviewed && (
        <p className="text-caption text-foreground-subtle">
          선제 승인 전 디지털트윈 검토 권장 · 긴급 시 검토 없이 승인 가능
        </p>
      )}

      {/* 실행 후 결과 요약 — 팝업이 남긴 결과를 레일이 이어서 보인다(03 §2).
          값은 전부 엔진에서 파생하므로 팝업과 어긋날 수 없다 */}
      {showResult && <SopResultSummary />}
    </section>
  );
}

/* ── 실행 결과 요약 (읽기 전용) — 04 §13 을 엔진 상태로 자른 것 ────────── */

function SopResultSummary() {
  const { track, sopExecutedItemIds, approvedAt, phoneReportedAt } = useScenario();
  if (!approvedAt) return null;

  /* 결과에는 실행된 승인 항목과 자동 항목만 선다(04 §13 · §15-11) — SopPanel 과 같은 규칙.
     절차표는 재난유형이 고르므로 결과표와 항목 정의를 같은 트랙에서 집는다 */
  const bongam = track === "bongam";
  const items = bongam ? FLOOD_SOP_ITEMS : SOP_ITEMS;
  const results = sopResultsFor(bongam ? "내수침수" : undefined).filter((result) => {
    const item = items.find((i) => i.id === result.itemId);
    return item?.mode === "auto" || (sopExecutedItemIds?.includes(result.itemId) ?? false);
  });

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2" aria-label="실행 결과 요약">
      <span className="text-caption font-semibold text-foreground-muted">실행 결과</span>
      <ul className="mt-1 flex flex-col gap-0.5">
        {results.map((result) => (
          <li key={result.itemId} className="flex items-center gap-1.5">
            <Icon
              icon={result.ok ? "mdi:check-circle" : "mdi:close-circle"}
              className={cn("size-3.5 shrink-0", result.ok ? "text-success" : "text-danger")}
              aria-hidden
            />
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-caption",
                result.ok ? "text-foreground-muted" : "text-danger",
              )}
            >
              {result.label}
            </span>
            <span className="shrink-0 font-mono text-caption text-foreground-subtle">
              {formatClock(new Date(approvedAt.getTime() + result.offsetMin * 60_000))}
            </span>
          </li>
        ))}
      </ul>
      {phoneReportedAt && (
        <div className="mt-1 border-t border-border pt-1">
          <StatusDotLabel
            status="success"
            label={`유선 보고 대체 · ${formatClock(phoneReportedAt)}`}
          />
        </div>
      )}
    </div>
  );
}
