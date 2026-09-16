/* ─────────────────────────────────────────────
 * 판단 탭 액션 바 — 사건 작업공간 우측 레일 바닥 (IA §7 주요 행동 · 04 §2 "다음 행동")
 *
 * 담당자가 내리는 결정은 둘뿐이다 — 오탐이냐 대응이냐 (2026-09-14 확정). 나머지는 팝업 안 승인·안정 전환·종료 검토.
 * 누를 수 없는 자리는 세우지 않는다. 추가 확인·병합·분리는 I3 예외 경로.
 *   후보     [검토 인수]           보통은 안 보인다 — 후보는 여는 순간 인수돼 확인중이 된다(EarlyWarningPage). 대비용
 *   확인중   [오탐] [사건 대응]    사건 대응 = 대응중 전환 + 대응 팝업. 자동 조치는 그 순간 돌고 승인 항목은 팝업에서 기다린다
 *   대응중   [대응 실행]           팝업에서 승인·결과 확인·안정 전환
 *   대응중·안정 국면  [대응 실행] [종료 검토]
 * 버튼은 상태를 쓰지 않는다 — 엔진 tick 을 옮긴다(CLAUDE.md).
 * ───────────────────────────────────────────── */

import { Button } from "@ds";
import { Icon } from "@iconify/react";
import type { IncidentPhase, WorkflowStatus } from "../../../model/incident";

interface JudgeActionBarProps {
  status: WorkflowStatus;
  phase: IncidentPhase | null;
  /** 판단 갱신이 끝났는가 — 끝나기 전에 여는 대응은 긴급 경로다(캡션만 다르고 잠그지 않는다) */
  assessed: boolean;
  /** 대응중의 국면을 캡션이 읽는다 — 승인 전 · 실패 · 결과 대기 · 결과 도착 (2026-09-14 검수 7번) */
  approved: boolean;
  /** 실패했고 대체조치가 아직인 SOP 항목 이름 */
  failure: string | null;
  resultsArrived: boolean;
  /** 승인 뒤 등급 상향으로 새로 선 수동 항목 수 — 다시 승인받아야 한다 */
  pendingApproval: number;
  onTakeReview: () => void;
  /** 오탐으로 닫기 — 확인창을 거친다 */
  onDismiss: () => void;
  /** 실제 사건으로 판단하고 곧바로 대응 팝업을 연다 */
  onRespond: () => void;
  onOpenResponse: () => void;
  onCloseReview: () => void;
}

const NEXT: Partial<Record<WorkflowStatus, { caption: string; label: string; icon: string }>> = {
  후보: { caption: "규칙이 만든 후보입니다. 인수하면 확인중이 됩니다.", label: "검토 인수", icon: "mdi:account-check-outline" },
  확인중: { caption: "실제 사건이면 대응, 아니면 오탐으로 닫습니다.", label: "사건 대응", icon: "mdi:clipboard-play-outline" },
  대응중: { caption: "권고와 SOP를 승인하고 조치·전파 결과를 확인합니다.", label: "대응 실행", icon: "mdi:clipboard-play-outline" },
};

export function JudgeActionBar({ status, phase, assessed, approved, failure, resultsArrived, pendingApproval, onTakeReview, onDismiss, onRespond, onOpenResponse, onCloseReview }: JudgeActionBarProps) {
  const next = NEXT[status];
  if (!next) return null;
  const controlled = status === "대응중" && phase === "안정";
  const responding = status === "대응중" && !controlled
    ? !assessed ? "판단 갱신 전입니다. 긴급이면 전망 없이 대응을 엽니다."
      : !approved ? "CUVIA가 채운 SOP를 검토하고 승인합니다."
      : pendingApproval > 0 ? `위험도 상향 · 추가 조치 ${pendingApproval}건 승인이 필요합니다.`
      : failure ? `${failure} 실패 · 대체조치가 필요합니다.`
      : !resultsArrived ? "조치·전파 결과를 기다립니다."
      : "결과를 확인하고 상황 안정으로 전환합니다."
    : null;
  const caption = controlled ? "잔여 조치를 감시하고 종료 조건을 확인합니다." : responding ?? next.caption;
  const primary = controlled ? { label: "종료 검토", icon: "mdi:file-check-outline", onClick: onCloseReview } : { label: next.label, icon: next.icon, onClick: status === "후보" ? onTakeReview : status === "확인중" ? onRespond : onOpenResponse };
  return (
    <div className="flex items-center gap-2 p-2" aria-label="다음 행동">
      {status === "확인중" && (
        <Button size="sm" variant="secondary" onClick={onDismiss} title={caption}>
          <Icon icon="mdi:close-circle-outline" className="size-4" aria-hidden />
          오탐
        </Button>
      )}
      <span className="min-w-0 flex-1 truncate text-caption text-foreground-muted" title={caption}>{status === "확인중" ? "" : caption}</span>
      {controlled && (
        <Button size="sm" variant="secondary" onClick={onOpenResponse}>
          <Icon icon="mdi:clipboard-play-outline" className="size-4" aria-hidden />
          대응 실행
        </Button>
      )}
      <Button size="sm" onClick={primary.onClick} className="shrink-0">
        <Icon icon={primary.icon} className="size-4" aria-hidden />
        {primary.label}
      </Button>
    </div>
  );
}
