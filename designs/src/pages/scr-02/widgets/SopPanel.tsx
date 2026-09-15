/* ─────────────────────────────────────────────
 * 대응 탭 — 사건 작업공간 우측 (IA §9 · 02 D6~D7 · 초안 사건작업공간_화면상세 §3 대응 · W4, 결정 2026-09-14)
 *
 * 구조는 CSMS 판단 팝업 SOP 대응 탭(sop-section.tsx)과 같다. 위에서 아래로
 *   권고(NDMS 고유 · 판단 요약 한 줄 포함) → 대응 흐름 4단계 → SOP 진행률 → MUST / SHOULD / MAY 그룹 → SOP 바닥
 * 항목 줄은 `[체크(수동·대기만)] 상태 아이콘 · 이름 / 담당 또는 실패 사유 · [자동/수동] · 오른쪽 상태 칸`이고
 * 주민 전파 항목은 줄 아래 채널별 결과, 시설 항목은 가동 여부 한 줄이 붙는다. 전파는 SOP 한 항목이다.
 *
 * 승인·실행 요청, 대체조치, 통제 전환처럼 집중 확인이 필요한 순간에만 호출부가 팝업을 연다(onRequestConfirm).
 * 실패는 성공처럼 칠하지 않는다 — 실패 줄은 남고 대체조치가 그 아래 붙는다(IA §9 승인 경계).
 * 값은 전부 selectors 에서 온다. 여기서 상태를 쓰지 않는다.
 *
 * // TODO(engine): 항목 단위·부분 승인. 대표 데모의 결정(DC-02)은 권고 전체를 한 번에 승인하므로 [부분 승인]도
 * //   같은 tick 을 옮긴다. 결정이 항목별로 기록되면 체크한 것만 배정한다.
 * // TODO(I2): 수동 현장 확인 항목의 완료 확인(현장영상 컷 + 한 줄 메모, CSMS SopRow confirming) — 완료가 세계
 * //   tick(현장 결과 도착)에서 오는 지금 구조에서는 담당자 완료 조작이 없다.
 * ───────────────────────────────────────────── */

import { useState } from "react";
import { Icon } from "@iconify/react";
import { Badge, Button, Checkbox, Notice, cn, toast } from "@ds";
import type { WorkflowStatus } from "../../../model/incident";
import type { Decision } from "../../../model/response";
import type { RiskGrade } from "../../../model/risk-matrix";
import { SOP_PRIORITY_BADGE, SOP_PRIORITY_ORDER, sopProgress, type ChainStageView, type SopItem, type SopRecipient } from "../../../model/sop";
import { ALTERNATIVE_LABEL, type AlternativeId } from "../../../model/forecast";
import { SOP_STATUS_TONE } from "../../../lib/status-tone";
import { formatClock } from "../../../lib/datetime";
import { ResponseChain } from "./ResponseChain";

export type ConfirmRequest =
  | { kind: "approve"; itemLabels: string[] }
  | { kind: "fallback"; channel: string; failReason: string }
  | { kind: "control" }
  | { kind: "dismiss" };

interface SopPanelProps {
  status: WorkflowStatus;
  /** 항목을 켠 위험등급 — 머리 줄 "경계 기준 8항목" */
  grade: RiskGrade | null;
  approval: Decision | null;
  items: SopItem[];
  chain: ChainStageView[];
  /** 조치안을 채운 전망 기준 — 담당자가 전망 탭에서 고른 것이 우선, 없으면 CUVIA 기준 전망 */
  basis: { validAt: string; alternativeId: AlternativeId } | null;
  /** 판단·전망 없이 열렸는가 */
  emergency: boolean;
  onRequestConfirm: (req: ConfirmRequest) => void;
}

/* 권고를 따로 보이지 않는다 (2026-09-14 사용자 결정 "그게 SOP잖아"). 시스템이 채운 대상·시한·근거는 항목 아래 줄이고,
   어떤 항목이 서는지는 위험등급이 정한다. 승인은 SOP 승인 하나다 */
export function SopPanel({ status, grade, approval, items, chain, basis, emergency, onRequestConfirm }: SopPanelProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [collapsedDone, setCollapsedDone] = useState(true);
  const { done, total, pct } = sopProgress(items);
  const allDone = total > 0 && done === total;
  /* 승인 전 수동 항목 — 체크·부분 승인의 대상. 자동은 사람이 미룰 수 있는 일이 아니다 */
  /* 승인 뒤에도 등급이 올라 새로 선 수동 항목은 다시 승인 대상이다 (2026-09-14 대응 중 악화) */
  const pendingManual = items.filter((i) => i.execMode === "수동" && i.status === "대기");
  const interactive = status === "대응중";

  const requestApprove = (ids: string[]) => {
    if (ids.length === 0) { toast.error("승인할 조치를 하나 이상 고르세요."); return; }
    const labels = items.filter((i) => ids.includes(i.id) || (i.confirm === "cap" && i.status === "대기")).map((i) => i.label);
    onRequestConfirm({ kind: "approve", itemLabels: labels });
  };

  return (
    <section className="flex flex-col gap-4" aria-label="대응">
      {emergency && <Notice inline variant="warning" title="판단·전망 없이 대응" description="위험도 판단이나 기준 전망이 아직 없습니다. 근거는 그대로 남고 승인 절차도 같습니다." />}

      {items.length > 0 && (
        <>
          {/* 머리 한 줄 — 누가 무엇을 기준으로 채웠나. 이 줄이 옛 권고 카드의 전부다 */}
          <p className="-mb-2 text-caption text-foreground-subtle">
            {grade ? `${grade} SOP ${items.length}항목` : `SOP ${items.length}항목`}
            {basis ? ` · ${formatClock(basis.validAt)} 전망(${ALTERNATIVE_LABEL[basis.alternativeId]}) 기준 · CUVIA 작성` : " · 전망 없이 CUVIA 작성"}
          </p>
          <ResponseChain stages={chain} />

          {/* 진행률 — 전체 요약. 아래부터가 목록이라 한 단계 더 띄운다 */}
          <div className="mb-2">
            <div className="flex items-baseline justify-between pb-1.5">
              <span className="text-caption text-foreground-muted">SOP 진행률</span>
              <span className="font-mono text-caption text-foreground-muted">{done}/{total} 완료 · {pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-fill-subtle" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-primary-text transition-[width] duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {SOP_PRIORITY_ORDER.map((priority) => {
            const group = items.filter((i) => i.priority === priority);
            if (group.length === 0) return null;
            const groupDone = group.filter((i) => i.status === "완료").length;
            const groupAllDone = groupDone === group.length;
            const collapsed = groupAllDone && collapsedDone;
            return (
              <div key={priority} className="flex flex-col gap-2">
                <button type="button" onClick={() => groupAllDone && setCollapsedDone((v) => !v)} className={cn("flex w-full items-center gap-1.5 border-none bg-transparent p-0 text-left", groupAllDone ? "cursor-pointer" : "cursor-default")} aria-expanded={!collapsed}>
                  <Badge variant={SOP_PRIORITY_BADGE[priority]} className="shrink-0">{priority}</Badge>
                  <span className="text-caption text-foreground-muted">{groupDone} / {group.length} 완료</span>
                  {groupAllDone && <Icon icon="mdi:chevron-down" className={cn("ml-auto size-4 text-foreground-subtle transition-transform", collapsed && "-rotate-90")} aria-hidden />}
                </button>
                {!collapsed && (
                  <ul className="flex flex-col gap-1.5">
                    {group.map((item) => (
                      <li key={item.id}>
                        <SopRow
                          item={item}
                          checkable={interactive && pendingManual.some((p) => p.id === item.id)}
                          checked={checked.has(item.id)}
                          onToggleCheck={() => setChecked((prev) => { const next = new Set(prev); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })}
                          onApproveCap={interactive && item.status === "대기" && item.confirm === "cap" ? () => requestApprove(pendingManual.map((p) => p.id)) : undefined}
                          added={approval !== null && item.execMode === "수동" && item.status === "대기"}
                          onFallback={item.fallbackAvailable && item.recipients ? () => { const f = item.recipients!.find((r) => r.sent === "실패" && !r.fallback)!; onRequestConfirm({ kind: "fallback", channel: f.name, failReason: f.detail ?? "실패" }); } : undefined}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          {/* SOP 바닥 — [SOP 중단] … [부분 승인 n] [전체 승인·실행]. 전부 완료면 이 줄이 없다 */}
          {interactive && !allDone && (
            <div className="flex items-center gap-2 pt-1">
              <Button variant="outline" size="sm" disabled title="필수 조치를 못 채운 채 닫는 탈출구 — 대표 데모 범위 밖 (I3)">
                <Icon icon="mdi:pause-circle-outline" className="size-4" aria-hidden />
                SOP 중단
              </Button>
              {pendingManual.length > 0 && (
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={checked.size === 0} onClick={() => requestApprove([...checked].filter((id) => pendingManual.some((p) => p.id === id)))}>
                    부분 승인{checked.size > 0 && <span className="ml-1 font-mono">{checked.size}</span>}
                  </Button>
                  <Button size="sm" onClick={() => requestApprove(pendingManual.map((p) => p.id))}>
                    전체 승인·실행
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ── 항목 줄 — CSMS SopRow 와 같은 해부 ── */

function SopRow({ item, checkable, checked, onToggleCheck, onApproveCap, onFallback, added = false }: {
  item: SopItem;
  /** 승인 뒤 등급 상향으로 새로 선 항목 — `추가` 표식 */
  added?: boolean;
  checkable: boolean;
  checked: boolean;
  onToggleCheck: () => void;
  /** 주민 전파 항목의 [전파 승인] — CAP 문안 확인창을 거친다 */
  onApproveCap?: () => void;
  /** 실패 뒤 [대체조치] — 기록 전에만 */
  onFallback?: () => void;
}) {
  const tone = SOP_STATUS_TONE[item.status];
  const auto = item.execMode === "자동";
  const done = item.status === "완료";
  const failed = item.status === "실패";

  return (
    <div className={cn("rounded-md border bg-row-zebra transition-colors", failed ? "border-danger-border" : checkable ? "border-primary-text/50" : "border-border")}>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {checkable && <Checkbox checked={checked} onCheckedChange={onToggleCheck} aria-label={`${item.label} 선택`} className="shrink-0" />}
        <span key={`icon-${item.status}`} className="shrink-0 duration-300 animate-in fade-in zoom-in-50">
          <Icon icon={item.status === "대기" ? (auto ? "mdi:cog-outline" : "mdi:account-outline") : tone.icon} className={cn("size-4", item.status === "대기" ? "text-foreground-subtle" : tone.text, tone.spin && "animate-spin")} aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn("flex items-center gap-1.5 truncate text-body", done ? "text-foreground-muted" : "text-foreground")}>{item.label}{added && <Badge variant="red" className="shrink-0">추가</Badge>}</span>
          {failed && item.failReason ? (
            <span className="truncate text-caption text-danger">{item.failReason}</span>
          ) : (
            (item.assignee || item.organization) && <span className="truncate text-caption text-foreground-subtle">{item.organization && item.assignee !== item.organization ? `${item.organization} · ${item.assignee}` : item.assignee}</span>
          )}
        </span>
        <Badge variant={auto ? "blue" : "outline"} className="shrink-0">{item.execMode}</Badge>
        <span key={`status-${item.status}`} className="flex shrink-0 items-center gap-1.5 text-caption duration-300 animate-in fade-in slide-in-from-right-1">
          {done ? (
            <span className={tone.text}>완료{item.at && <span className="ml-1 font-mono text-foreground-muted">{formatClock(item.at)}</span>}</span>
          ) : failed ? (
            onFallback ? (
              <Button size="sm" variant="outline" onClick={onFallback}>
                <Icon icon="mdi:phone-outline" className="size-4" aria-hidden />
                대체조치
              </Button>
            ) : (
              <span className={tone.text}>실패</span>
            )
          ) : item.status === "진행 중" ? (
            <span className={tone.text}>진행 중</span>
          ) : onApproveCap ? (
            <Button size="sm" onClick={onApproveCap}>
              <Icon icon="mdi:bullhorn-outline" className="size-4" aria-hidden />
              전파 승인
            </Button>
          ) : (
            <span className="text-foreground-muted">{auto ? "승인 후 실행" : "대기"}</span>
          )}
        </span>
      </div>

      {(item.detail || item.basis || item.facility || (item.recipients && item.recipients.length > 0)) && (
        <div className="flex flex-col gap-1 border-t border-border px-3 py-2 text-caption">
          {item.detail && !failed && <p className="truncate text-foreground-muted">{item.detail}</p>}
          {item.basis && !failed && <p className="truncate text-foreground-subtle" title={item.basis}>근거 · {item.basis}</p>}
          {item.facility && (
            <p className="flex items-center gap-1.5"><span className="text-foreground-subtle">가동 여부</span><span className={cn("font-medium", item.facility.engaged ? "text-danger" : "text-foreground")}>{item.facility.label}</span></p>
          )}
          {item.recipients && item.recipients.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {item.recipients.map((r) => <RecipientLine key={r.name} r={r} />)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function RecipientLine({ r }: { r: SopRecipient }) {
  const icon = r.sent === "완료" ? "mdi:check" : r.sent === "실패" ? "mdi:alert-circle-outline" : r.sent === "확인 대기" ? "mdi:clock-outline" : "mdi:circle-small";
  const color = r.sent === "완료" ? "text-foreground" : r.sent === "실패" ? "text-danger" : r.sent === "확인 대기" ? "text-warning" : "text-foreground-subtle";
  return (
    <li className="flex flex-col gap-0.5">
      <span className={cn("flex items-center gap-1.5", color)}>
        <Icon icon={icon} className="size-3.5 shrink-0" aria-hidden />
        <span className="w-[60px] shrink-0">{r.name}</span>
        <span className="min-w-0 flex-1 truncate text-foreground-muted">{r.detail ?? (r.sent === "대기" ? "요청됨" : "")}</span>
        {r.at && <span className="shrink-0 font-mono text-foreground-subtle">{formatClock(r.at)}</span>}
      </span>
      {r.fallback && (
        <span className="flex items-center gap-1.5 pl-5 text-foreground-muted">
          <Icon icon="mdi:subdirectory-arrow-right" className="size-3.5 shrink-0" aria-hidden />
          <span className={r.fallback.done ? "text-success" : "text-warning"}>대체 · {r.fallback.channel}</span>
          <span className="min-w-0 flex-1 truncate">{r.fallback.detail}</span>
          {r.fallback.at && <span className="shrink-0 font-mono text-foreground-subtle">{formatClock(r.fallback.at)}</span>}
        </span>
      )}
    </li>
  );
}
