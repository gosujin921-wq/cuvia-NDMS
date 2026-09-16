/* ─────────────────────────────────────────────
 * 대응 실행 집중 팝업 — 실행 국면 (IA §9 · 04 §2·§4 · README §8.2 2026-09-14 · 레거시 정본 03 §0-9·§2)
 *
 * 판단·전망은 지도 위 레일, 승인·실행은 이 팝업이다. 조작 밀도가 가장 높은 국면이라 340px 레일에 두지 않는다.
 * 골격은 platform_web 관제 팝업 원본(kits/event-kit control-popup)과 같다: 헤더 한 줄 / 좌 영상 · 우 400 고정 탭 /
 * 바닥 액션 바. 탭은 `사건 개요 · SOP 대응 · 이력`. SOP 탭은 CSMS SOP 대응 탭 구조(SopPanel).
 *
 * 진입로 셋이 한 팝업이다 — 레일 [대응 실행] · 지도 마커 [이 사건 대응하기] · 전망 [이 전망으로 대응 검토].
 * 팝업은 별도 상태를 만들지 않는다. 승인·대체조치·안정 전환은 호출부가 여는 중첩 확인창(ExecutionPopup)이 tick 을 옮기고,
 * 닫으면 결과가 레일 `대응 요약`과 이력에 그대로 이어진다. 긴급 경로(판단·전망 전)로 열리면 사건 개요가 그 사실을 적는다.
 *
 * // TODO(I3): 실행 중 닫기 잠금 · ESC/배경 클릭 정책 · 닫힘 후 포커스 복귀 (레거시 03 §2 수용 기준). 지금은 관제 팝업 기본 동작
 * ───────────────────────────────────────────── */

import { useState } from "react";
import { Icon } from "@iconify/react";
import { Badge, Button, Modal, ModalContent, ModalHeader, ModalTitle, StatusBadge, Tabs, TabsContent, TabsList, TabsTrigger, Tag, cn } from "@ds";
import type { Incident } from "../../../model/incident";
import type { Recommendation, Decision } from "../../../model/response";
import type { AlternativeId, Forecast } from "../../../model/forecast";
import type { ChainStageView, SopItem } from "../../../model/sop";
import type { CctvChannelView, IncidentView } from "../../../model/selectors";
import { RISK_GRADE_TONE, statusTone } from "../../../lib/status-tone";
import { formatClock, formatElapsed } from "../../../lib/datetime";
import { CctvStill } from "../../../components/CctvStill";
import { SopPanel, type ConfirmRequest } from "./SopPanel";
import { RiskCard } from "./RiskCard";
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
  /** 담당자가 전망 탭에서 고른 시각·대안 — 권고 카드의 기준 줄 (02 D6). 없으면 권고 기록의 기준 */
  selectedBasis: { validAt: string; alternativeId: AlternativeId } | null;
  /** 판단·전망 없이 열렸는가 */
  emergency: boolean;
  /** 실행 결과가 도착했는가 — 안정 전환 버튼 */
  resultsArrived: boolean;
  initialTab?: ResponseTab;
  onRequestConfirm: (req: ConfirmRequest) => void;
  onCloseReview: () => void;
}

export function ResponsePopup({ open, onClose, view, incident, now, channels, recommendation, approval, items, chain, baseline, selectedBasis, emergency, resultsArrived, initialTab = "sop", onRequestConfirm, onCloseReview }: ResponsePopupProps) {
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
        {/* ── 머리 한 줄 · [등급] 제목 [국면] 📍위치 · 유형 · 생성·경과 ─ 처리상태 (CSMS SituationHeader · KISA 헤더와 같은 골격.
            원본은 cuvia_platform_web kits/event-kit/control-popup) ── */}
        <ModalHeader className="shrink-0 border-b border-border px-5 py-4">
          <ModalTitle className="sr-only">대응 실행</ModalTitle>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pr-8">
            {grade && <Badge variant={RISK_GRADE_TONE[grade].badge} className="shrink-0">{grade}</Badge>}
            <h2 className="min-w-0 truncate text-h6 font-semibold text-foreground">{incident.title}</h2>
            {view.phase && <Badge variant="gray" className="shrink-0">{view.phase}</Badge>}
            <span className="flex min-w-0 items-center gap-1 text-caption text-foreground-muted">
              <Icon icon="mdi:map-marker" className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{incident.scope.label} · {incident.hazardKind}</span>
            </span>
            {view.createdAt && (
              <span className="shrink-0 font-mono text-caption text-foreground-muted">{formatClock(view.createdAt)} 생성 · 경과 {formatElapsed(view.createdAt, now)}</span>
            )}
            <StatusBadge status={tone.badge} label={view.workflowStatus} className="ml-auto shrink-0" />
          </div>
        </ModalHeader>

        {/* ── 본문 · 좌 영상(가변폭) / 우 400px 3탭 ── */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
            {/* 주 영상 · 16:9 한 장. 사건 채널이면 등급 배지가 우상단에 붙는다 (CSMS CameraTile 규칙) */}
            <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border bg-black">
              {channel ? (
                <>
                  <CctvStill src={{ still: channel.still }} className="absolute inset-0" />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-black/60 to-transparent" aria-hidden />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/75 to-transparent" aria-hidden />
                  <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-caption font-medium text-white backdrop-blur-sm">
                    <span className="size-1.5 animate-pulse rounded-full bg-danger" aria-hidden />실시간
                  </span>
                  {grade && channel.analysis && <Badge variant={RISK_GRADE_TONE[grade].badge} className="absolute right-3 top-3">{grade}</Badge>}
                  <span className="absolute bottom-3 left-3 max-w-[70%] truncate font-mono text-caption text-white/90">{channel.label} · {channel.scene}</span>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-caption text-foreground-subtle">이 사건에 연결된 CCTV 가 없습니다.</div>
              )}
            </div>

            {/* 장면 분석 · 영상 아래 한 줄. 판단 근거를 영상과 같은 자리에서 읽는다 */}
            {channel?.analysis ? (
              <div className="flex items-start gap-2 rounded-md border border-border bg-row-zebra px-3 py-2 text-caption">
                <Badge variant="blue" className="shrink-0">VLM</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground">{channel.analysis.description}</p>
                  <p className="text-foreground-muted">신뢰도 {Math.round(channel.analysis.confidence * 100)}% · {channel.analysis.model} {channel.analysis.version} · 분석 {formatClock(channel.analysis.analyzedAt)}</p>
                </div>
              </div>
            ) : (
              <p className="text-caption text-foreground-subtle">장면 분석 없음</p>
            )}

            {/* 관련 CCTV · 누르면 주 영상이 바뀐다. 팝업을 닫고 다시 열지 않는다 (CSMS video-area 규칙) */}
            {channels.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-caption font-semibold text-foreground-muted">관련 CCTV</span>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {channels.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setChannelId(c.id)}
                      aria-label={`${c.label} 선택`}
                      className={cn("w-56 shrink-0 cursor-pointer overflow-hidden rounded-md bg-surface p-0 text-left", channel?.id === c.id ? "border-2 border-primary-text" : "border border-border")}
                    >
                      <div className="relative aspect-video w-full bg-black">
                        <CctvStill src={{ still: c.still }} className="absolute inset-0" />
                        {c.analysis && <Badge variant="blue" className="absolute right-2 top-2">VLM</Badge>}
                      </div>
                      <div className="flex flex-col px-2.5 py-1.5">
                        <span className="truncate text-caption font-medium text-foreground">{c.label}</span>
                        <span className="truncate text-caption text-foreground-muted">{c.scene}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex min-h-0 w-[400px] shrink-0 flex-col border-l border-border">
            <Tabs value={tab} onValueChange={(v) => setTab(v as ResponseTab)} className="flex min-h-0 flex-1 flex-col">
              <TabsList variant="panel" className="mx-4 mt-3 w-[calc(100%-2rem)] shrink-0">
                <TabsTrigger value="overview" variant="panel">사건 정보</TabsTrigger>
                <TabsTrigger value="sop" variant="panel">SOP 대응</TabsTrigger>
                <TabsTrigger value="history" variant="panel">이력</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                <div className="flex flex-col gap-4">
                  <div className="rounded-md border border-border bg-row-zebra"><RiskCard assessment={view.assessment} previous={view.previousAssessment} compact /></div>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-caption font-semibold text-foreground-muted">영향 요약</h3>
                    {baseline ? (
                      <ul className="flex flex-col gap-0.5 rounded-md border border-border bg-row-zebra px-2.5 py-2 text-caption">
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
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-caption font-semibold text-foreground-muted">관계</h3>
                    <p className="text-caption text-foreground-subtle">원인·파생·동시 사건 없음</p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="sop" className="mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                <SopPanel
                  status={view.workflowStatus}
                  grade={view.assessment?.matrix.grade ?? null}
                  approval={approval}
                  items={items}
                  chain={chain}
                  basis={selectedBasis ?? recommendation?.basis ?? null}
                  emergency={emergency}
                  onRequestConfirm={onRequestConfirm}
                />
              </TabsContent>
              <TabsContent value="history" className="mt-1 flex min-h-0 flex-1 flex-col px-1 pb-2">
                <EventTimeline events={view.events} initial={Number.MAX_SAFE_INTEGER} />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* ── 바닥 · 캡션 왼쪽, 오른쪽에 [오탐] 과 국면 행위 하나. 닫기는 X·Esc (CSMS 2026-08-25 결정). 승인·실행은 SOP 탭 안 ── */}
        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">
          <span className="mr-auto min-w-0 truncate text-caption text-foreground-muted">
            {approval ? `${formatClock(approval.recordedAt)} ${approval.approver} 승인` : view.workflowStatus === "대응중" ? "승인 전 · 자동 조치 실행 중 · SOP 대응에서 승인 항목을 고른다" : ""}
          </span>
          <Button size="sm" variant="outline" onClick={() => onRequestConfirm({ kind: "dismiss" })}>
            <Icon icon="mdi:eye-off-outline" className="size-4" aria-hidden />
            오탐
          </Button>
          {view.workflowStatus === "대응중" && view.phase !== "안정" && approval && (
            <Button size="sm" variant={resultsArrived ? "default" : "secondary"} disabled={!resultsArrived} title={resultsArrived ? undefined : "실행 결과가 도착한 뒤 전환"} onClick={() => onRequestConfirm({ kind: "control" })}>
              <Icon icon="mdi:shield-check-outline" className="size-4" aria-hidden />
              안정으로 전환
            </Button>
          )}
          {view.phase === "안정" && (
            <Button size="sm" onClick={onCloseReview}>
              <Icon icon="mdi:file-check-outline" className="size-4" aria-hidden />
              종료 검토
            </Button>
          )}
        </footer>
      </ModalContent>
    </Modal>
  );
}
