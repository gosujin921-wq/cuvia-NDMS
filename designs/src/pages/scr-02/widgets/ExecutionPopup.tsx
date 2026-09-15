/* ─────────────────────────────────────────────
 * 집중 확인 팝업 — 승인·전파문 확인 / 대체조치 / 통제 전환 / 오탐 (IA §9 · 04 §7 W7)
 *
 * 대응 전체를 여기 두지 않는다 — 검토는 우측 대응 탭이 한다. 이 팝업은 되돌리기 어려운 결정을 담당자가 한 번 더
 * 읽고 확인하는 자리다. 확인 버튼은 행위 동사이고 그 버튼이 곧 엔진 tick 전진이다(호출부). 상태는 여기 없다.
 *
 * 승인은 CAP 문안 전문이 있어 640, 대체조치·통제 전환은 참조 확인창 폭 480 (platform_web control-popup 문법).
 * 딤 규격은 KISA 관제 팝업 원본 값(variant glass · rgba(0,0,0,.55) + blur)을 그대로 쓴다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Button, Modal, ModalContent, ModalHeader, ModalTitle, Tag, cn } from "@ds";
import type { CapMessage } from "../../../model/response";
import type { ConfirmRequest } from "./SopPanel";
import { formatClock } from "../../../lib/datetime";

interface ExecutionPopupProps {
  open: boolean;
  request: ConfirmRequest;
  onClose: () => void;
  onConfirm: () => void;
  incidentTitle: string;
  now: Date;
  approver: string;
  /** 전파문 — 권고가 만든 CAP 초안. 승인 전에는 fixture 의 요청 문안을 미리보기로 보인다 */
  message: CapMessage | null;
  channels: string[];
  /** 전파 대상 — 지역·수신자·매체 (02 D6) */
  recipients?: string | null;
}

export function ExecutionPopup({ open, request, onClose, onConfirm, incidentTitle, now, approver, message, channels, recipients }: ExecutionPopupProps) {
  const wide = request.kind === "approve";
  const title = request.kind === "approve" ? (message ? "SOP 승인 · 전파문 확인" : "SOP 승인 · 추가 조치") : request.kind === "fallback" ? `${request.channel} 실패 · 대체조치` : request.kind === "dismiss" ? "오탐으로 닫을까요?" : "통제 상태로 전환할까요?";
  const verb = request.kind === "approve" ? "승인 · 실행 요청" : request.kind === "fallback" ? "대체조치 기록" : request.kind === "dismiss" ? "오탐으로 닫기" : "통제로 전환";
  const verbIcon = request.kind === "approve" ? "mdi:check-decagram-outline" : request.kind === "fallback" ? "mdi:phone-outline" : request.kind === "dismiss" ? "mdi:close-circle-outline" : "mdi:shield-check-outline";

  return (
    <Modal open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <ModalContent variant="glass" overlayClassName="duration-200 bg-black/55 backdrop-blur-xs" className={cn("flex w-[calc(100%-3rem)] flex-col gap-0 overflow-hidden p-0", wide ? "sm:max-w-[640px]" : "sm:max-w-[480px]")}>
        <ModalHeader className="shrink-0 border-b border-border px-5 py-4">
          <ModalTitle className="text-h6 font-semibold text-foreground">{title}</ModalTitle>
          <p className="mt-0.5 text-caption text-foreground-muted">{incidentTitle} · {formatClock(now)} · {approver}</p>
        </ModalHeader>

        <div className="flex flex-col gap-3 px-5 py-4 text-caption">
          {request.kind === "approve" && (
            <>
              <div>
                <div className="mb-1 font-semibold text-foreground-muted">승인할 조치 {request.itemLabels.length}건</div>
                <div className="flex flex-wrap gap-1">{request.itemLabels.map((k) => <Tag key={k}>{k}</Tag>)}</div>
              </div>
              {message && (
              <div>
                <div className="mb-1 font-semibold text-foreground-muted">전파 채널</div>
                <div className="flex flex-wrap gap-1">{channels.map((c) => <Tag key={c}>{c}</Tag>)}</div>
                {recipients && <div className="mt-1 text-foreground-muted">대상 · {recipients}</div>}
              </div>
              )}
              {message && (
                <div className="rounded-md border border-border bg-card p-3">
                  <div className="mb-1 flex items-center gap-2 text-foreground-subtle">
                    <span className="font-mono">{message.identifier}</span>
                    <Tag>{message.msgType}</Tag>
                    <span>{message.severity} / {message.urgency} / {message.certainty}</span>
                  </div>
                  <div className="font-semibold text-foreground">{message.headline}</div>
                  <div className="text-foreground-muted">{message.areaDesc}</div>
                  <p className="mt-1 text-foreground">{message.description}</p>
                  <p className="text-foreground-muted">{message.instruction}</p>
                </div>
              )}
              <p className="text-foreground-subtle">사건 확정·대응수준·외부 전파·시설 요청은 담당자 승인 사항입니다. 실제 원격제어는 하지 않고 요청·승인·결과 확인까지 기록합니다.</p>
            </>
          )}
          {request.kind === "fallback" && (
            <>
              <p className="text-danger">{request.failReason}</p>
              <dl className="flex flex-col gap-1">
                <div className="flex items-center gap-2"><dt className="w-[64px] shrink-0 text-foreground-subtle">대체 채널</dt><dd className="text-foreground">유선 연락</dd></div>
                <div className="flex items-center gap-2"><dt className="w-[64px] shrink-0 text-foreground-subtle">대상</dt><dd className="text-foreground">신포동 통장 6명</dd></div>
              </dl>
              <p className="text-foreground-subtle">실패 기록은 남고 대체조치가 같은 줄 아래 이어집니다.</p>
            </>
          )}
          {request.kind === "dismiss" && (
            <>
              <p className="text-foreground">실제 사건이 아닌 것으로 닫습니다. 알림·근거·판단 이력은 기록으로 남고, 이 사건은 다시 열리지 않습니다.</p>
              <p className="text-foreground-subtle">같은 구역에서 징후가 다시 잡히면 새 후보가 만들어집니다. 오탐 기록은 규칙 검증에 쓰입니다.</p>
            </>
          )}
          {request.kind === "control" && (
            <p className="text-foreground">급격한 확대가 멈추고 조치가 유지되는 감시 상태로 전환합니다. 종료가 아닙니다. 잔여 조치와 확인사항은 그대로 남습니다.</p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
          <Button size="sm" onClick={onConfirm}>
            <Icon icon={verbIcon} className="size-4" aria-hidden />
            {verb}
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
