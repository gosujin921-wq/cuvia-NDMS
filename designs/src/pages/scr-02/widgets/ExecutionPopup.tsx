/* ─────────────────────────────────────────────
 * 대응 실행 집중 팝업 — KISA 관제 팝업 구조 이식
 *
 * 원본: cuvia_platform_web `kits/event-kit/src/control-popup/control-popup-modal.tsx`
 *
 * 골격을 원본 그대로 세운다:
 *   헤더  단계 뱃지 · 재난유형 · 위치 · 처리상태 · (우측) 발생 후 경과
 *   본문  좌 영상 영역(flex-1) / 우 400px 3탭 — 이벤트 정보 · SOP 대응 · 이력
 *   푸터  복귀 길 하나
 * 크기·딤도 원본 값이다(1120px · h-[calc(100%-3rem)] · rgba(0,0,0,.55) + blur 4px).
 *
 * 원본에서 오지 않은 것: 접수 · 상황종료 · 상황오인 판정과 관련 이벤트 묶기다. 전부
 * KISA 서버 API(verdict · related/group)에 물린 조작이고, DSMS 의 대응 국면은 **대응등급
 * 승인 → SOP 승인·실행** 한 줄기라 대응물이 없다. 판정은 정보 탭 맨 위 `RiskCard`,
 * 실행은 SOP 탭 `SopPanel` 이 든다.
 *
 * 상태는 여기 없다 — 승인 등급 · 실행 결과 · 전파 기록은 전부 엔진 소유라 팝업을 닫았다
 * 다시 열어도 그대로다(CLAUDE.md). 이 컴포넌트가 드는 것은 열린 탭과 실행 중 잠금뿐이다.
 *
 * 닫기 정책(03 §2 수용 기준): 실행 전·후에는 ESC·X·배경 클릭·[관제 화면으로 돌아가기]
 * 전부 닫힘, 실행 중에는 전부 무시. 실행 연출이 이 데모의 핵심인데 조작 실수로 끊기면
 * 안 되고, 타이머가 이 트리 안에 있어 닫히면 실행이 화면 없이 매달린다.
 * 닫힌 뒤 포커스는 [대응 실행]으로 복귀한다(onCloseAutoFocus).
 * ───────────────────────────────────────────── */

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@ds";
import { LevelBadge } from "../../../components/LevelBadge";
import { findDistrict, type District } from "../../../demo/districts";
import { featuredCctvOf } from "../../../demo/devices";
import {
  activeEventsAt,
  eventViewAt,
  hazardLabel,
  type AlertEvent,
} from "../../../demo/events";
import { levelSpec, type AlertLevel } from "../../../demo/levels";
import type { RiskAssessment } from "../../../demo/risk";
import type { ChannelId } from "../../../demo/dispatch";
import type { ProcessState } from "../../../demo/sop";
import { eventTimelineAt } from "../../../demo/timeline";
import { formatElapsed, formatRelative } from "../../../lib/datetime";
import { useScenario } from "../../../state/ScenarioProvider";
import { EventInfoTab } from "../control-popup/event-info-tab";
import { HistoryTab } from "../control-popup/history-tab";
import { VideoArea } from "../control-popup/video-area";
import type { RelatedEventCandidate } from "../control-popup/types";
import { SopPanel } from "./SopPanel";

type TabKey = "info" | "sop" | "history";

interface ExecutionPopupProps {
  open: boolean;
  /** 닫기 요청 — 실행 중(busy)에는 이 컴포넌트가 걸러서 부르지 않는다 */
  onClose: () => void;
  district: District;
  event: AlertEvent;
  processState: ProcessState;
  risk: RiskAssessment;
  approved: AlertLevel | null;
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
  processState,
  risk,
  approved,
  effectiveLevel,
  message,
  onMessageChange,
  onExecuted,
  onResend,
  returnFocusTo,
}: ExecutionPopupProps) {
  const {
    now,
    dispatches,
    approvedResponseLevel,
    approvedAt,
    sopExecutedItemIds,
    phoneReportedAt,
  } = useScenario();

  /* 실행 연출 진행 중 — SopPanel 이 올려 준다. 이 동안 모든 닫기 경로를 잠근다 */
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<TabKey>("info");

  /* 승인이 나면 SOP 탭으로 넘긴다 — 승인 버튼과 [승인·실행]이 다른 탭에 있어서,
     승인 직후 화면이 그대로면 다음에 누를 것이 보이지 않는다. 승인은 한 번뿐이라
     이 전환도 한 번이다(단조) */
  useEffect(() => {
    if (approved) setTab("sop");
  }, [approved]);

  /* 계측 단계는 지금 값이 정한다 — risk.measured 가 곧 현재 시계의 사건 모습이다 */
  const view = risk.measured;

  /* 좌측 영상 — 그 지구의 주요 CCTV (04 §2-5) */
  const cameras = useMemo(() => featuredCctvOf(district.id), [district.id]);

  /* 같은 시각 진행 중인 다른 사건 — 원본의 `관련 이벤트 추정` 자리.
     추정이 아니라 원장을 현재 시계로 자른 것이라 이름도 그렇게 적는다 */
  const candidates = useMemo<RelatedEventCandidate[]>(
    () =>
      activeEventsAt(now)
        .filter((other) => other.id !== event.id)
        .map((other) => {
          const otherView = eventViewAt(other, now);
          return {
            id: other.id,
            hazardLabel: hazardLabel(other.hazardType),
            level: otherView.level,
            districtId: other.districtId,
            location: findDistrict(other.districtId)?.name ?? other.districtId,
            valueText: `${otherView.value} ${other.unit}`,
            relativeTime: formatRelative(otherView.stageAt, now),
            device: other.device,
            sameDistrict: other.districtId === event.districtId,
          };
        }),
    [now, event.id, event.districtId],
  );

  /* 이력 — 별도 원장이 아니라 단계·전파·승인·실행 결과의 파생이다(demo/timeline.ts) */
  const timeline = useMemo(
    () =>
      eventTimelineAt(event, {
        now,
        dispatches,
        approvedResponseLevel,
        approvedAt,
        sopExecutedItemIds,
        phoneReportedAt,
      }),
    [
      event,
      now,
      dispatches,
      approvedResponseLevel,
      approvedAt,
      sopExecutedItemIds,
      phoneReportedAt,
    ],
  );

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <ModalContent
        /* 글라스 표면 · 딤 규격 전부 원본 값 — 모달 rgba(0,0,0,.55) + blur 4px */
        variant="glass"
        overlayClassName="duration-200 bg-black/55 backdrop-blur-xs"
        className="flex h-[calc(100%-3rem)] max-h-[860px] w-[calc(100%-3rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1120px]"
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
        {/* 헤더 — 사건의 신원 한 줄. 스크롤과 무관하게 고정이다 */}
        <ModalHeader className="shrink-0 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3 pr-10">
            <LevelBadge
              level={view.level}
              value={`${view.value} ${event.unit}`}
              className="shrink-0"
            />
            <ModalTitle className="shrink-0 text-h6 font-semibold text-foreground">
              {hazardLabel(event.hazardType)}
            </ModalTitle>
            <span className="flex min-w-0 items-center gap-1 text-caption text-foreground-muted">
              <Icon icon="mdi:map-marker" className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{district.name}</span>
            </span>
            <StatusBadge
              status={processState === "대응중" ? "pending" : processState === "종료" ? "done" : "live"}
              label={processState}
              className="shrink-0"
            />
            {/* 승인 대응등급은 계측 뱃지와 별도로 선다(03 §0-6) — 계측 뱃지를 승인 색으로
                칠하면 "실측이 대피 기준을 넘었다"로 읽힌다 */}
            {approved && (
              <span
                className="shrink-0 rounded-full border px-2 py-0.5 text-caption font-medium"
                style={{
                  borderColor: levelSpec(approved).color,
                  color: levelSpec(approved).color,
                }}
              >
                {levelSpec(approved).label} 대응중
              </span>
            )}
            <span className="ml-auto shrink-0 font-mono text-caption text-foreground-muted">
              발생 후 {formatElapsed(event.raisedAt, now)} 경과
            </span>
          </div>
        </ModalHeader>

        {/* 본문 — 좌 영상 · 우 탭 */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <VideoArea cameras={cameras} candidates={candidates} />

          <div className="flex min-h-0 w-[400px] shrink-0 flex-col border-l border-border">
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as TabKey)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList variant="panel" className="mx-4 mt-3 w-[calc(100%-2rem)] shrink-0">
                <TabsTrigger value="info" variant="panel">
                  이벤트 정보
                </TabsTrigger>
                <TabsTrigger value="sop" variant="panel">
                  SOP 대응
                </TabsTrigger>
                <TabsTrigger value="history" variant="panel">
                  이력
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="info"
                className="mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-4"
              >
                <EventInfoTab
                  event={event}
                  view={view}
                  district={district}
                  risk={risk}
                  approved={approved}
                  processState={processState}
                  relatedIds={candidates.map((c) => c.id)}
                  now={now}
                />
              </TabsContent>

              {/* SopPanel 이 자기 여백(p-3)을 들고 있어 탭 본문은 가로 여백을 비운다 */}
              <TabsContent
                value="sop"
                className="mt-3 min-h-0 flex-1 overflow-y-auto px-1 pb-4"
              >
                <SopPanel
                  level={effectiveLevel}
                  onExecuted={onExecuted}
                  message={message}
                  onMessageChange={onMessageChange}
                  onResend={onResend}
                  onBusyChange={setBusy}
                />
              </TabsContent>

              <TabsContent
                value="history"
                className="mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-4"
              >
                <HistoryTab entries={timeline} />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* 푸터 — 항상 보이는 복귀 길. 실행 중에는 잠긴다 */}
        <div className="flex shrink-0 items-center justify-end border-t border-border px-5 py-3">
          <Button variant="outline" size="sm" disabled={busy} onClick={onClose}>
            <Icon icon="mdi:arrow-left" className="size-4" aria-hidden />
            관제 화면으로 돌아가기
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
