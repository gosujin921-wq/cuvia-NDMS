/* ─────────────────────────────────────────────
 * 대응 실행 집중 팝업 — 03 화면정의서 §2 · §0-9 · 차수 N
 *
 * 승인·SOP 실행은 이 데모에서 조작 밀도가 가장 높은 국면인데, 340px 레일의 체크박스
 * 연출은 시연장에서 읽히지 않는다. 실행 국면만 이 팝업이 크게 든다. 담는 것은 여덟뿐
 * (03 §2): 사건 요약 · 판정 요약 · 승인 · SOP · 문안 · 실행 · 결과 · 실패/대체 조치.
 * 지도·CCTV·전체 타임라인·다른 사건 목록은 넣지 않는다 — 넣으면 또 하나의 독립 화면이 된다.
 *
 * 활성 조작면은 하나다(§0-9). 열려 있는 동안 레일은 오버레이 뒤에 눕고, 승인·체크·
 * 실행은 여기서만 받는다. 상태는 전부 엔진 소유라 닫았다 다시 열어도 그대로다 —
 * 팝업은 별도 상태를 만들지 않는다.
 *
 * 닫기 정책(03 §2 수용 기준): 실행 전·후에는 ESC·X·배경 클릭·[관제 화면으로 돌아가기]
 * 전부 닫힘, 실행 중에는 전부 무시. 실행 연출이 이 데모의 핵심인데 조작 실수로 끊기면
 * 안 되고, 타이머가 이 트리 안에 있어 닫히면 실행이 화면 없이 매달린다.
 * 닫힌 뒤 포커스는 [대응 실행]으로 복귀한다(onCloseAutoFocus).
 * ───────────────────────────────────────────── */

import { useState } from "react";
import { Icon } from "@iconify/react";
import { Button, Modal, ModalContent, ModalHeader, ModalTitle, Tag } from "@ds";
import { hazardLabel, type AlertEvent } from "../../../demo/events";
import type { AlertLevel } from "../../../demo/levels";
import type { RiskAssessment } from "../../../demo/risk";
import type { ChannelId } from "../../../demo/dispatch";
import type { District } from "../../../demo/districts";
import { RiskCard } from "./RiskCard";
import { SopPanel } from "./SopPanel";

interface ExecutionPopupProps {
  open: boolean;
  /** 닫기 요청 — 실행 중(busy)에는 이 컴포넌트가 걸러서 부르지 않는다 */
  onClose: () => void;
  district: District;
  event: AlertEvent;
  /** 현재 계측 단계·값 — 사건 요약 한 줄이 쓴다 */
  levelLabel: string;
  levelColor: string;
  valueText: string;
  processState: string;
  risk: RiskAssessment;
  approved: AlertLevel | null;
  onApprove: (level: AlertLevel) => void;
  effectiveLevel: AlertLevel;
  message: string;
  onMessageChange: (message: string) => void;
  onExecuted: (itemIds: string[]) => void;
  onResend: (channels: ChannelId[], message: string) => void;
  /** 닫힌 뒤 포커스가 돌아갈 자리 — 레일의 [대응 실행] */
  returnFocusTo: React.RefObject<HTMLButtonElement | null>;
}

export function ExecutionPopup({
  open,
  onClose,
  district,
  event,
  levelLabel,
  levelColor,
  valueText,
  processState,
  risk,
  approved,
  onApprove,
  effectiveLevel,
  message,
  onMessageChange,
  onExecuted,
  onResend,
  returnFocusTo,
}: ExecutionPopupProps) {
  /* 실행 연출 진행 중 — SopPanel 이 올려 준다. 이 동안 모든 닫기 경로를 잠근다 */
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <ModalContent
        variant="glass"
        className="w-[860px] max-w-[94vw] gap-0 p-0"
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (busy) e.preventDefault();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          returnFocusTo.current?.focus();
        }}
      >
        {/* 헤더 — 사건 요약 한 줄. 스크롤과 무관하게 고정이다(03 §2 수용 기준) */}
        <ModalHeader className="border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            <ModalTitle className="text-body">
              대응 실행 · {district.name} {hazardLabel(event.hazardType)}
            </ModalTitle>
            <span className="text-caption font-medium" style={{ color: levelColor }}>
              {levelLabel}
            </span>
            <span className="font-mono text-caption text-foreground-muted">{valueText}</span>
            <Tag className="ml-auto mr-6 shrink-0">{processState}</Tag>
          </div>
        </ModalHeader>

        {/* 본문 — 판정 요약(읽기 전용 재확인 + 승인)과 SOP. 페이지 스크롤은 없고
            넘치면 이 본문만 스크롤한다(03 §2 수용 기준). 최초 진입은 1280×720 에서
            판정·7항목·[승인·실행]이 스크롤 없이 선다 */}
        <div className="flex max-h-[calc(100dvh-7.5rem)] min-h-0 flex-col overflow-y-auto">
          <RiskCard event={event} risk={risk} approved={approved} onApprove={onApprove} />
          <div className="border-t border-border" aria-hidden />
          <SopPanel
            level={effectiveLevel}
            approved={approved !== null}
            onExecuted={onExecuted}
            message={message}
            onMessageChange={onMessageChange}
            onResend={onResend}
            onBusyChange={setBusy}
          />
        </div>

        {/* 푸터 — 항상 보이는 복귀 길. 실행 중에는 잠긴다 */}
        <div className="flex justify-end border-t border-border px-4 py-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={onClose}>
            <Icon icon="mdi:arrow-left" className="size-4" aria-hidden />
            관제 화면으로 돌아가기
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
