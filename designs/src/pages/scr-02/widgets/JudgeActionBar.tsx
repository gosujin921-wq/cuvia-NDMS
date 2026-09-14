/* ─────────────────────────────────────────────
 * 판단 탭 액션 바 — 사건 작업공간 우측 레일 바닥 (IA §7 주요 행동 · 초안 §3 판단 바닥). Phase 1 대응 절차 카드 자리
 *
 * 처리상태별 한 줄: 후보 [검토 인수] / 확인중 [추가 확인] [오탐] [사건 확인] / 확인됨·대응중 [대응 실행] / 통제 [대응 실행]
 * [종료 검토]. [대응 실행]은 확인됨부터 항상 선다 — 판단·전망 없이 여는 긴급 경로다(04 §4). 버튼은 상태를 쓰지 않는다 — 엔진 tick 을
 * 옮긴다(CLAUDE.md). 추가 확인·오탐·병합·분리·관계 지정은 대표 데모 경로가 아니라 자리만 둔다(결정 2026-09-14).
 * ───────────────────────────────────────────── */

import { Button } from "@ds";
import { Icon } from "@iconify/react";
import type { WorkflowStatus } from "../../../model/incident";

interface JudgeActionBarProps {
  status: WorkflowStatus;
  /** 판단 갱신이 끝났는가 — 끝나기 전에 여는 대응은 긴급 경로다(캡션만 다르고 잠그지 않는다) */
  assessed: boolean;
  onTakeReview: () => void;
  onConfirm: () => void;
  /** 대응 실행 집중 팝업을 연다 */
  onOpenResponse: () => void;
  onCloseReview: () => void;
}

export function JudgeActionBar({ status, assessed, onTakeReview, onConfirm, onOpenResponse, onCloseReview }: JudgeActionBarProps) {
  return (
    <div className="flex items-center gap-1.5 p-2" aria-label="담당자 행동">
      <Button variant="ghost" size="icon" className="size-8 shrink-0 text-foreground-subtle" disabled title="병합 · 분리 · 관계 지정 — 이번 데모 범위 밖" aria-label="더보기">
        <Icon icon="mdi:dots-horizontal" className="size-4" aria-hidden />
      </Button>
      <span className="min-w-0 flex-1 truncate text-caption text-foreground-subtle">
        {status === "후보" && "복합 알림이 만든 후보 · 인수하면 확인중"}
        {status === "확인중" && "영상·계측·시설 근거를 보고 결정"}
        {status === "확인됨" && !assessed && "판단 갱신 전 · 긴급 대응 경로"}
      </span>
      {status === "후보" && (
        <Button size="sm" onClick={onTakeReview}>
          <Icon icon="mdi:account-check-outline" className="size-4" aria-hidden />
          검토 인수
        </Button>
      )}
      {status === "확인중" && (
        <>
          <Button size="sm" variant="secondary" disabled title="대표 데모 경로 아님">추가 확인</Button>
          <Button size="sm" variant="secondary" disabled title="대표 데모 경로 아님">오탐</Button>
          <Button size="sm" onClick={onConfirm}>
            <Icon icon="mdi:check-circle-outline" className="size-4" aria-hidden />
            사건 확인
          </Button>
        </>
      )}
      {(status === "확인됨" || status === "대응중" || status === "통제") && (
        <Button size="sm" variant={status === "통제" ? "secondary" : "default"} onClick={onOpenResponse}>
          <Icon icon="mdi:clipboard-play-outline" className="size-4" aria-hidden />
          대응 실행
        </Button>
      )}
      {status === "통제" && (
        <Button size="sm" onClick={onCloseReview}>
          <Icon icon="mdi:file-check-outline" className="size-4" aria-hidden />
          종료 검토
        </Button>
      )}
    </div>
  );
}
