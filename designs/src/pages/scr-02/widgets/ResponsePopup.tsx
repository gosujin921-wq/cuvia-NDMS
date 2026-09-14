/* ─────────────────────────────────────────────
 * 대응 실행 집중 팝업 — 실행 국면 (IA §9 · 04 §2·§4 · README §8.2 2026-09-14 · 레거시 정본 03 §0-9·§2)
 *
 * 판단·전망은 지도 위 레일, 승인·실행은 이 팝업이다. 조작 밀도가 가장 높은 국면이라 340px 레일에 두지 않는다.
 * 골격은 platform_web 관제 팝업 원본(kits/event-kit control-popup)과 같다: 헤더 한 줄 / 좌 영상 · 우 400 고정 탭 /
 * 바닥 액션 바. 탭은 `사건 개요 · SOP 대응 · 이력`. SOP 탭은 CSMS SOP 대응 탭 구조(SopPanel).
 *
 * 진입로 셋이 한 팝업이다 — 레일 [대응 실행] · 지도 마커 [이 사건 대응하기] · 전망 [이 전망으로 대응 검토].
 * 팝업은 별도 상태를 만들지 않는다. 승인·대체조치·통제 전환은 호출부가 여는 중첩 확인창(ExecutionPopup)이 tick 을 옮기고,
 * 닫으면 결과가 레일 `대응 요약`과 이력에 그대로 이어진다. 긴급 경로(판단·전망 전)로 열리면 사건 개요가 그 사실을 적는다.
 *
 * // TODO(I3): 실행 중 닫기 잠금 · ESC/배경 클릭 정책 · 닫힘 후 포커스 복귀 (레거시 03 §2 수용 기준). 지금은 관제 팝업 기본 동작
 * ───────────────────────────────────────────── */

import { useState } from "react";
import { Icon } from "@iconify/react";
import { Badge, Button, Modal, ModalContent, ModalTitle, StatusBadge, Tabs, TabsContent, TabsList, TabsTrigger, Tag, cn } from "@ds";
import type { Incident } from "../../../model/incident";
import type { Recommendation, Decision } from "../../../model/response";
import type { AlternativeId, Forecast } from "../../../model/forecast";
import type { ChainStageView, SopItem } from "../../../model/sop";
import type { CctvChannelView, IncidentView } from "../../../model/selectors";
import { RISK_GRADE_TONE, statusTone } from "../../../lib/status-tone";
import { formatClock, formatElapsed } from "../../../lib/datetime";
import { CctvStill } from "../../../components/CctvStill";
import { SopPanel, RecommendationCard, type ConfirmRequest } from "./SopPanel";
import { EventTimeline } from "./EventTimeline";

export type ResponseTab = "overview" | "sop" | "history";

interface ResponsePopupProps {
  open: boolean;
  onClose: () => void;
  view: IncidentView;
  incident: Incident;
  now: Date;
  channels: CctvChannelView[];
  recommendation: Recommendation | null;
  approval: Decision | null;
  items: SopItem[];
  chain: ChainStageView[];
  /** 기준 전망 — 사건 개요의 영향 요약 */
  baseline: Forecast | null;
  basisHint: string | null;
  /** 담당자가 전망 탭에서 고른 시각·대안 — 권고 카드의 기준 줄 (02 D6). 없으면 권고 기록의 기준 */
  selectedBasis: { validAt: string; alternativeId: AlternativeId } | null;
  /** 판단·전망 없이 열렸는가 */
  emergency: boolean;
  /** 실행 결과가 도착했는가 — 통제 전환 버튼 */
  resultsArrived: boolean;
  initialTab?: ResponseTab;
  onRequestConfirm: (req: ConfirmRequest) => void;
  onCloseReview: () => void;
}

export function ResponsePopup({ open, onClose, view, incident, now, channels, recommendation, approval, items, chain, baseline, basisHint, selectedBasis, emergency, resultsArrived, initialTab = "sop", onRequestConfirm, onCloseReview }: ResponsePopupProps) {
  const [tab, setTab] = useState<ResponseTab>(initialTab);
  const [channelId, setChannelId] = useState<string | null>(null);
  const channel = channels.find((c) => c.id === channelId) ?? channels[0] ?? null;
  const tone = statusTone(view.workflowStatus);
  const grade = view.assessment?.matrix.grade ?? null;

  return (
    <Modal open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <ModalContent
        variant="glass"
        overlayClassName="duration-200 bg-black/55 backdrop-blur-xs"
        className="flex h-[calc(100%-3rem)] max-h-[860px] w-[calc(100%-3rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1120px]"
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* 헤더 한 줄 — [등급] 제목 [처리상태] · 위치 · 유형 ─ 생성 · 경과 */}
        <header className="flex shrink-0 items-center gap-2 border-b border-border py-3 pl-5 pr-12">
          {grade && <Badge variant={RISK_GRADE_TONE[grade].badge} className="shrink-0">{grade}</Badge>}
          <ModalTitle className="min-w-0 truncate text-body font-semibold text-foreground">{incident.title}</ModalTitle>
          <StatusBadge status={tone.badge} label={view.workflowStatus} className="shrink-0" />
          <span className="flex min-w-0 items-center gap-1 truncate text-caption text-foreground-muted">
            <Icon icon="mdi:map-marker-outline" className="size-3.5 shrink-0" aria-hidden />
            {incident.scope.label}
          </span>
          <Tag className="shrink-0">{incident.hazardKind}</Tag>
          <span className="ml-auto shrink-0 font-mono text-caption text-foreground-muted">
            {view.createdAt && `${formatClock(view.createdAt)} 생성 · 경과 ${formatElapsed(view.createdAt, now)}`}
          </span>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* 좌 영상 — 사건 카메라 큰 보기 + VLM. 수동 현장 확인의 증적 컷은 이 프레임에서 뜬다(I2) */}
          <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-md bg-black">
              {channel ? (
                <>
                  <CctvStill src={{ still: channel.still }} className="absolute inset-0" />
                  <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-surface px-1.5 py-0.5 text-caption text-foreground">
                    <span className="size-1.5 animate-pulse rounded-full bg-danger" aria-hidden />LIVE
                  </span>
                  <span className="absolute bottom-2 left-2 rounded bg-surface/80 px-1.5 py-0.5 text-caption text-foreground">{channel.label} · {channel.scene}</span>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-caption text-foreground-subtle">이 사건에 연결된 CCTV 가 없습니다.</div>
              )}
            </div>
            <div className="flex shrink-0 items-start gap-3">
              <div className="flex shrink-0 gap-1.5">
                {channels.map((c) => (
                  <button key={c.id} type="button" onClick={() => setChannelId(c.id)} className={cn("relative h-12 w-20 cursor-pointer overflow-hidden rounded border bg-black p-0", channel?.id === c.id ? "border-primary" : "border-border")} aria-label={`${c.label} 선택`}>
                    <CctvStill src={{ still: c.still }} className="absolute inset-0" />
                  </button>
                ))}
              </div>
              <div className="min-w-0 flex-1 text-caption">
                {channel?.analysis ? (
                  <>
                    <div className="flex items-center gap-2 text-foreground"><span className="font-semibold">VLM</span><span className="truncate">{channel.analysis.description}</span></div>
                    <div className="text-foreground-muted">신뢰도 {Math.round(channel.analysis.confidence * 100)}% · {channel.analysis.model} {channel.analysis.version} · 분석 {formatClock(channel.analysis.analyzedAt)}</div>
                  </>
                ) : (
                  <div className="text-foreground-subtle">장면 분석 없음</div>
                )}
              </div>
            </div>
          </div>

          {/* 우 400 고정 — 사건 개요 · SOP 대응 · 이력 */}
          <div className="flex w-[400px] shrink-0 flex-col border-l border-border">
            <Tabs value={tab} onValueChange={(v) => setTab(v as ResponseTab)} className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 px-3 pt-3">
                <TabsList className="w-full">
                  <TabsTrigger value="overview">사건 개요</TabsTrigger>
                  <TabsTrigger value="sop">SOP 대응</TabsTrigger>
                  <TabsTrigger value="history">이력</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="overview" className="mt-0 min-h-0 flex-1 overflow-y-auto">
                <div className="flex flex-col gap-3 p-3">
                  <RecommendationCard recommendation={recommendation} assessment={view.assessment} basisHint={basisHint} selectedBasis={selectedBasis} emergency={emergency && !recommendation} />
                  <div className="flex flex-col gap-1">
                    <h3 className="text-caption font-semibold text-foreground-muted">영향 요약</h3>
                    {baseline ? (
                      <ul className="flex flex-col gap-0.5 rounded-lg border border-border bg-card px-2.5 py-2 text-caption">
                        {baseline.targets.map((t) => (
                          <li key={t.id} className="flex items-center gap-2">
                            <Tag className="w-[56px] justify-center">{t.kind}</Tag>
                            <span className="min-w-0 flex-1 truncate text-foreground">{t.label}</span>
                            <span className="shrink-0 font-mono text-foreground-muted">{t.arrivalAt ? formatClock(t.arrivalAt) : "-"}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-caption text-foreground-subtle">유효한 전망 없음</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-caption font-semibold text-foreground-muted">관계</h3>
                    <p className="text-caption text-foreground-subtle">원인·파생·동시 사건 없음</p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="sop" className="mt-0 min-h-0 flex-1 overflow-y-auto">
                <SopPanel
                  status={view.workflowStatus}
                  showRecommendation={false}
                  assessment={view.assessment}
                  recommendation={recommendation}
                  approval={approval}
                  items={items}
                  chain={chain}
                  basisHint={basisHint}
                  onRequestConfirm={onRequestConfirm}
                />
              </TabsContent>
              <TabsContent value="history" className="mt-0 flex min-h-0 flex-1 flex-col">
                <EventTimeline events={view.events} />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* 바닥 액션 바 — 왼쪽 [오탐](자리만), 오른쪽 상태별 */}
        <footer className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2.5">
          <Button size="sm" variant="ghost" disabled title="대표 데모 경로 아님">오탐</Button>
          <span className="min-w-0 flex-1 truncate text-right text-caption text-foreground-subtle">
            {approval ? `${formatClock(approval.recordedAt)} ${approval.approver} 승인 · ${approval.level}` : view.workflowStatus === "확인됨" ? "승인 전 · SOP 대응에서 조치를 고르고 승인" : ""}
          </span>
          {view.workflowStatus === "대응중" && (
            <Button size="sm" variant="secondary" disabled={!resultsArrived} title={resultsArrived ? undefined : "실행 결과가 도착한 뒤 전환"} onClick={() => onRequestConfirm({ kind: "control" })}>
              <Icon icon="mdi:shield-check-outline" className="size-4" aria-hidden />
              통제로 전환
            </Button>
          )}
          {view.workflowStatus === "통제" && (
            <Button size="sm" variant="secondary" onClick={onCloseReview}>
              <Icon icon="mdi:file-check-outline" className="size-4" aria-hidden />
              종료 검토
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onClose}>닫기</Button>
        </footer>
      </ModalContent>
    </Modal>
  );
}
