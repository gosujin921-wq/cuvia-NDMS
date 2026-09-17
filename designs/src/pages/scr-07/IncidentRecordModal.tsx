/* ─────────────────────────────────────────────
 * 사건 기록 창 — 이 사건이 무엇이었고, 왜 사건이 됐고, 무엇을 했고, 예측은 맞았는가 (IA §10.1 · §13.1 · 2026-09-16)
 *
 * 탭으로 나누지 않고 한 번에 읽히는 기록이다. 경과 타임라인 하나로는 "무엇이었고 무엇을 했는지"가 안 보였다
 * (2026-09-16 사용자 "이력이 너무 부실하다 · SK 만 봐도 이 사건이 뭔지 + 어떤 대응을 했는지 나온다").
 * ▸ 결: SK2 `pages/scr-02/IncidentDetail.tsx`(머리 → 근거 결합 → 묶인 알람 → 대응 절차 → 타임라인)와
 *   SK 결과보고서의 요약 항목표. 부품은 `@ds` 와 이 앱 부품(EventTimeline · PredictionCasePanel)이다.
 *
 * 읽는 순서 여섯 절 — 사용자가 알고 싶은 순서다
 *   ① 사건 요약      무엇이었나
 *   ② 발생 근거      왜 사건이 되었나. 알림 → 근거 관측 → 예측판. 예측판은 근거의 하나라 여기 서고, 실제 결과·오차를 바로 붙인다
 *   ③ 위험 판단      어떻게 판단했나
 *   ④ 대응           무엇을 했나. 결정·승인 → 조치 → 전파
 *   ⑤ 예측 검증·학습 근거가 된 예측은 맞았나, 다음에 무엇을 반영하나. 오차는 실패가 아니라 학습 재료다
 *   ⑥ 경과           전부 어떤 순서였나
 * 맨 위에 절 바로가기가 선다. D8 종료로 들어오면(`&view=case`) ⑤ 로 연다.
 *
 * 값은 전부 model/records(incidentDossierAt · incidentTimelineAt)와 selectors(predictionCasesAt)가 만든다.
 * 이 창은 판단·조작을 하지 않는다 — 이력은 읽는 자리다. 바닥은 [사건 작업공간](진행 중) · [보고서 보기](보고서가 있을 때).
 * ───────────────────────────────────────────── */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "@iconify/react";
import { Badge, Button, DataTable, EmptyState, StatusDotLabel, Tabs, TabsList, TabsTrigger, cn, type DataTableColumn } from "@ds";
import { FormDialog } from "../../components/FormDialog";
import { EventTimeline } from "../../components/EventTimeline";
import { formatClock, formatElapsed, formatStamp } from "../../lib/datetime";
import {
  ACTION_RESULT_BADGE,
  ALERT_GRADE_TONE,
  EVIDENCE_KIND_ICON,
  RECORD_STATUS_TONE,
  RISK_GRADE_TONE,
  type EvidenceKind,
} from "../../lib/status-tone";
import { incidentDossierAt, incidentTimelineAt, timelineSummaryOf, type IncidentDossier, type IncidentRecord } from "../../model/records";
import type { AlertGrade } from "../../model/alert";
import type { ActionStatus } from "../../model/response";
import { predictionCasesAt } from "../../model/selectors";
import { ImprovementList, PredictionCasePanel } from "./widgets/PredictionCasePanel";

type SectionId = "summary" | "basis" | "judge" | "response" | "case" | "timeline";
const SECTIONS: { id: SectionId; label: string; question: string }[] = [
  { id: "summary", label: "사건 요약", question: "무엇이었나" },
  { id: "basis", label: "발생 근거", question: "왜 사건이 되었나" },
  { id: "judge", label: "위험 판단", question: "어떻게 판단했나" },
  { id: "response", label: "대응", question: "무엇을 했나" },
  { id: "case", label: "예측 검증 · 학습", question: "근거가 된 예측은 맞았나, 다음에 무엇을 반영하나" },
  { id: "timeline", label: "경과", question: "전부 어떤 순서였나" },
];

export function IncidentRecordModal({ record, now, focusCase, onClose, onOpenReport, onOpenWorkspace }: {
  record: IncidentRecord | null;
  now: Date;
  /** D8 종료로 들어왔는가 — ⑤ 예측 검증 절로 연다 */
  focusCase: boolean;
  onClose: () => void;
  onOpenReport: (reportId: string) => void;
  onOpenWorkspace: (districtId: string) => void;
}) {
  const dossier = useMemo(() => (record ? incidentDossierAt(record, now) : null), [record, now]);
  const entries = useMemo(() => (record ? incidentTimelineAt(record, now) : []), [record, now]);
  const cases = useMemo(() => (record?.hasLedger ? predictionCasesAt(record.incidentId, now) : []), [record, now]);

  /* 절 바로가기 — 누르면 그 절로, 읽어 내려가면 지금 읽는 절이 켜진다 */
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<SectionId>("summary");
  const goSection = (id: SectionId) => {
    setActive(id);
    scroller.current?.querySelector(`[data-section="${id}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const onScroll = () => {
    const box = scroller.current;
    if (!box) return;
    const top = box.getBoundingClientRect().top + 24;
    let current: SectionId = "summary";
    for (const s of SECTIONS) {
      const el = box.querySelector(`[data-section="${s.id}"]`);
      if (el && el.getBoundingClientRect().top <= top) current = s.id;
    }
    setActive(current);
  };
  useEffect(() => {
    if (!record || !focusCase) return;
    const id = window.setTimeout(() => {
      setActive("case");
      scroller.current?.querySelector(`[data-section="case"]`)?.scrollIntoView({ block: "start" });
    }, 80);
    return () => window.clearTimeout(id);
  }, [record?.incidentId, focusCase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!record || !dossier) return null;

  const sum = timelineSummaryOf(entries);
  const period = `${formatStamp(record.occurredAt)} ~ ${record.closedAt ? formatClock(record.closedAt) : "진행 중"}`;
  const latestReport = record.reports.at(-1);
  const workspaceDistrict = record.status === "진행 중" ? record.districtId : null;

  return (
    <FormDialog
      open
      onClose={onClose}
      icon="mdi:history"
      title={record.title}
      description={
        <span className="flex flex-wrap items-center gap-2">
          {/* 설명 줄은 <p> 라 캡슐(StatusBadge · div)을 못 넣는다 — 글 사이에 끼우는 인라인 표기를 쓴다 */}
          <StatusDotLabel status={RECORD_STATUS_TONE[record.status].badge} label={record.status} />
          <span className="text-foreground-muted">{record.hazardKind}</span>
          <span className="text-foreground-subtle" aria-hidden>·</span>
          <span className="text-foreground-muted">{record.scopeLabel}</span>
          <span className="text-foreground-subtle" aria-hidden>·</span>
          <span className="font-mono text-foreground-muted">{period}</span>
        </span>
      }
      /* 예측 검증의 표·지도 두 칸이 나란히 서야 한다 — sm:max-w 를 덮어야 넓어진다 */
      contentClassName="w-[1080px] max-w-[calc(100vw-2rem)] sm:max-w-[1080px] h-[90vh]"
      bodyClassName="flex flex-col px-0 py-0"
      /* 누를 것이 없으면 바닥을 세우지 않는다 — 빈 띠만 남는다 */
      footer={
        workspaceDistrict || latestReport ? (
          <>
            {workspaceDistrict && (
              <FormDialog.CancelButton onClick={() => onOpenWorkspace(workspaceDistrict)}>
                <Icon icon="mdi:map-marker-radius-outline" className="size-4 shrink-0" aria-hidden />
                사건 작업공간
              </FormDialog.CancelButton>
            )}
            <div className="flex-1" aria-hidden />
            {latestReport && (
              <FormDialog.PrimaryButton onClick={() => onOpenReport(latestReport.reportId)}>
                <Icon icon="mdi:file-document-outline" className="size-4 shrink-0" aria-hidden />
                보고서 보기
              </FormDialog.PrimaryButton>
            )}
          </>
        ) : undefined
      }
    >
      {/* 절 바로가기 — 긴 기록이라 목차가 위에 고정된다 */}
      <div className="shrink-0 border-b border-border px-6 py-2">
        <Tabs value={active} onValueChange={(next) => goSection(next as SectionId)}>
          <TabsList variant="panel" className="w-fit bg-transparent">
            {SECTIONS.map((s, i) => (
              <TabsTrigger key={s.id} value={s.id} variant="panel" className="text-caption">
                <span className="font-mono text-foreground-subtle">{i + 1}</span>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div ref={scroller} onScroll={onScroll} className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-6 pb-8 pt-5">
        <Section id="summary" index={1}>
          <SummarySection dossier={dossier} />
        </Section>

        <Section id="basis" index={2}>
          <BasisSection dossier={dossier} onCheck={() => goSection("case")} />
        </Section>

        <Section id="judge" index={3}>
          <JudgeSection dossier={dossier} />
        </Section>

        <Section id="response" index={4}>
          <ResponseSection dossier={dossier} />
        </Section>

        <Section id="case" index={5}>
          {cases.length > 0 ? (
            <div className="-mx-4">
              {cases.map((item) => <PredictionCasePanel key={item.caseId} item={item} />)}
            </div>
          ) : (
            /* 케이스가 없어도 훈련이 남긴 개선 항목은 여기 선다 — 예측 검증과 한 목록(README §2.3) */
            <div className="flex flex-col gap-3">
              <CaseEmpty record={record} />
              <ImprovementList incidentId={record.incidentId} verified={[]} hideWhenEmpty />
            </div>
          )}
        </Section>

        <Section id="timeline" index={6}>
          <EventTimeline
            entries={entries}
            summary={
              /* 한 줄 요약 — 기간 → 조치 → 전파 → 실패. 실패만 위험색이다 */
              <span className="flex flex-wrap items-center gap-x-2">
                <span>{record.closedAt ? `${formatElapsed(record.occurredAt, record.closedAt)} 만에 ${record.status}` : "진행 중"}</span>
                <span aria-hidden>·</span>
                <span>조치 {sum.actions}건</span>
                {/* 전파는 원장이 있는 사건만 센다. 지난 사건은 전파 기록이 없어서 0건이 아니라 모르는 것이다 */}
                {record.hasLedger && (
                  <>
                    <span aria-hidden>·</span>
                    <span>전파 {sum.disseminations}건</span>
                  </>
                )}
                {sum.failures > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="text-danger">실패 {sum.failures}건</span>
                  </>
                )}
              </span>
            }
          />
        </Section>
      </div>
    </FormDialog>
  );
}

/* ── 절 틀 ─────────────────────────────────────── */

function Section({ id, index, children }: { id: SectionId; index: number; children: ReactNode }) {
  const spec = SECTIONS.find((s) => s.id === id)!;
  return (
    <section data-section={id} aria-label={spec.label} className="flex scroll-mt-2 flex-col gap-3">
      <header className="flex items-baseline gap-2 border-b border-border pb-2">
        <span className="font-mono text-body font-semibold text-primary-text">{String(index).padStart(2, "0")}</span>
        <h3 className="text-body font-semibold text-foreground">{spec.label}</h3>
        <span className="truncate text-caption text-foreground-subtle">{spec.question}</span>
      </header>
      {children}
    </section>
  );
}

function Blank({ children }: { children: ReactNode }) {
  return <p className="text-caption text-foreground-subtle">{children}</p>;
}

function SubHead({ children }: { children: ReactNode }) {
  return <h4 className="text-caption font-semibold text-foreground-muted">{children}</h4>;
}

/* ── ① 사건 요약 ── */
function SummarySection({ dossier }: { dossier: IncidentDossier }) {
  return (
    <>
      <dl className="grid grid-cols-3 gap-x-6 gap-y-3">
        {dossier.summary.map((row) => (
          <div key={row.label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-caption text-foreground-subtle">{row.label}</dt>
            <dd className="truncate font-mono text-body text-foreground" title={row.value}>{row.value}</dd>
          </div>
        ))}
      </dl>
      {dossier.outcome && (
        <div className="flex items-start gap-3 rounded-md border border-border bg-surface px-3 py-2.5">
          <span className="shrink-0 text-caption font-semibold text-foreground">결과</span>
          <span className="min-w-0 text-body text-foreground">{dossier.outcome}</span>
        </div>
      )}
    </>
  );
}

/* ── ② 발생 근거 — 알림 → 근거 관측 → 예측판 ── */
function BasisSection({ dossier, onCheck }: { dossier: IncidentDossier; onCheck: () => void }) {
  const { alerts, evidence, forecast, forecastNotes, observed } = dossier;
  if (alerts.length === 0 && evidence.length === 0 && !forecast && forecastNotes.length === 0) return <Blank>사건 발생 근거 기록이 없습니다.</Blank>;
  return (
    <div className="flex flex-col gap-4">
      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          <SubHead>사건을 만든 알림</SubHead>
          {alerts.map((a) => (
            <div key={`${a.at}-${a.title}`} className="flex flex-col gap-1 rounded-md border border-border bg-surface px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-caption text-foreground-muted">{formatClock(a.at)}</span>
                <Badge variant={ALERT_GRADE_TONE[a.grade as AlertGrade]?.badge ?? "outline"}>{a.grade}</Badge>
                <span className="text-body font-medium text-foreground">{a.title}</span>
              </div>
              <p className="text-caption text-foreground-muted">{a.reason}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="flex flex-col gap-2">
          <SubHead>근거 관측</SubHead>
          {evidence.length === 0 ? (
            <Blank>근거 관측 기록이 없습니다.</Blank>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {evidence.map((e) => (
                <li key={`${e.at}-${e.label}`} className="flex items-center gap-2.5 rounded-md border border-border bg-surface px-3 py-2">
                  <Icon icon={EVIDENCE_KIND_ICON[e.kind as EvidenceKind] ?? "mdi:gauge"} className="size-4 shrink-0 text-foreground-muted" aria-hidden />
                  <span className="w-10 shrink-0 text-caption text-foreground-subtle">{e.kind}</span>
                  <span className="min-w-0 flex-1 truncate text-body text-foreground" title={e.label}>{e.label}</span>
                  <span className="shrink-0 font-mono text-caption text-foreground-muted">{formatClock(e.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 예측판 — 근거의 하나다. 실제 결과가 들어오면 같은 카드에서 견준다(2026-09-16 사용자 "예측검증도 이 이벤트를 발생시킨 근거") */}
        <div className="flex flex-col gap-2">
          <SubHead>근거가 된 예측</SubHead>
          {!forecast ? (
            forecastNotes.length > 0 ? (
              /* 지난 사건 — 예측판 객체 없이 당시 예측 기록 줄과 실제 기록 값만 안다. 짝지은 오차는 세우지 않는다 */
              <div className="flex flex-col gap-2.5 rounded-md border border-primary-border bg-primary-bg px-3 py-3">
                <div className="flex items-center gap-2">
                  <Icon icon="mdi:chart-timeline-variant" className="size-4 shrink-0 text-primary-text" aria-hidden />
                  <span className="text-body font-semibold text-foreground">당시 예측</span>
                </div>
                <ul className="flex flex-col gap-1">
                  {forecastNotes.map((n) => (
                    <li key={`${n.at}-${n.label}`} className="flex gap-2 text-caption">
                      <span className="w-10 shrink-0 font-mono text-foreground-muted">{formatClock(n.at)}</span>
                      <span className="min-w-0 text-foreground">{n.label}</span>
                    </li>
                  ))}
                </ul>
                {observed.length > 0 && (
                  <div className="flex flex-col gap-1 border-t border-border pt-2">
                    <span className="text-caption font-semibold text-foreground-muted">실제는</span>
                    {observed.map((o) => (
                      <div key={o.label} className="grid grid-cols-[96px_1fr] gap-2 text-caption">
                        <span className="text-foreground-subtle">{o.label}</span>
                        <span className="font-mono text-foreground">{o.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Blank>이 사건에는 예측 기록이 없습니다.</Blank>
            )
          ) : (
            <div className="flex flex-col gap-2.5 rounded-md border border-primary-border bg-primary-bg px-3 py-3">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:chart-timeline-variant" className="size-4 shrink-0 text-primary-text" aria-hidden />
                <span className="text-body font-semibold text-foreground">예측판</span>
                <span className="font-mono text-caption text-foreground-muted">{formatClock(forecast.at)}</span>
                {/* 모델 이름은 올리지 않는다 — 데모 예측판의 이름이 제작 구분이라 제품 화면에 설 말이 아니다(CLAUDE.md) */}
                <span className="ml-auto truncate text-caption text-foreground-subtle">기준 {formatClock(forecast.baseTime)}</span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-caption">
                <dt className="text-foreground-subtle">첫 도달</dt>
                <dd className="font-mono text-foreground">{formatClock(forecast.arrivalAt)}</dd>
                <dt className="text-foreground-subtle">{forecast.peakLabel}</dt>
                <dd className="font-mono text-foreground">{forecast.peak}</dd>
              </dl>
              {forecast.impact && <p className="text-caption text-foreground-muted">{forecast.impact}</p>}
              {forecast.targets.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {forecast.targets.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
                </div>
              )}
              {forecast.check.length > 0 ? (
                <div className="flex flex-col gap-1 border-t border-border pt-2">
                  <span className="text-caption font-semibold text-foreground-muted">실제는</span>
                  {forecast.check.map((c) => (
                    <div key={c.label} className="grid grid-cols-[72px_1fr_auto] items-baseline gap-2 text-caption">
                      <span className="text-foreground-subtle">{c.label}</span>
                      <span className="font-mono text-foreground">{c.predicted} → {c.actual}</span>
                      <span className="font-mono text-foreground-muted">{c.error ?? c.unavailable ?? ""}</span>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" className="mt-1 w-fit text-caption" onClick={onCheck}>
                    예측 검증 · 학습으로
                    <Icon icon="mdi:arrow-down" className="size-4 shrink-0" aria-hidden />
                  </Button>
                </div>
              ) : (
                <p className="border-t border-border pt-2 text-caption text-foreground-subtle">실제 결과와의 비교는 사건이 종료되면 붙습니다.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── ③ 위험 판단 ── */
function JudgeSection({ dossier }: { dossier: IncidentDossier }) {
  if (dossier.assessments.length === 0) return <Blank>당시 위험 판단 기록이 없습니다.</Blank>;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <ol className="flex flex-col gap-1.5">
        {dossier.assessments.map((a) => (
          <li key={a.at} className="flex items-center gap-2.5">
            <span className="w-11 shrink-0 font-mono text-caption text-foreground-muted">{formatClock(a.at)}</span>
            <span className={cn("size-2 shrink-0 rounded-full", RISK_GRADE_TONE[a.grade].dot)} aria-hidden />
            <Badge variant={RISK_GRADE_TONE[a.grade].badge} className="shrink-0">{a.grade}</Badge>
            <span className="min-w-0 truncate text-body text-foreground" title={a.label}>{a.label}</span>
          </li>
        ))}
      </ol>
      {dossier.judgement.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border border-border bg-surface px-3 py-2.5">
          <span className="text-caption font-semibold text-foreground-muted">가장 높았던 판단</span>
          {dossier.judgement.map((line) => (
            <p key={line} className="text-caption text-foreground">{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── ④ 대응 — 결정·승인 → 조치 → 전파 ── */
type ActionRow = IncidentDossier["actions"][number];

function ResponseSection({ dossier }: { dossier: IncidentDossier }) {
  const { decisions, actions, disseminations } = dossier;
  const columns = useMemo<DataTableColumn<ActionRow>[]>(
    () => [
      { key: "kind", label: "조치", width: "112px", cellClassName: "text-foreground", getValue: (r) => r.kind },
      { key: "target", label: "대상", render: (r) => <span className="block truncate text-foreground" title={r.target}>{r.target}</span> },
      { key: "org", label: "담당", width: "200px", render: (r) => <span className="block truncate text-foreground-muted">{r.organization ?? "-"}</span> },
      {
        key: "status", label: "결과", width: "96px",
        render: (r) => (r.status ? <Badge variant={ACTION_RESULT_BADGE[r.status as ActionStatus] ?? "outline"}>{r.status}</Badge> : <span className="text-foreground-subtle">-</span>),
      },
      { key: "at", label: "시각", width: "72px", align: "right", cellClassName: "font-mono text-foreground-muted", render: (r) => formatClock(r.at) },
      { key: "detail", label: "내용", width: "26%", render: (r) => <span className="block truncate text-foreground-muted" title={r.detail ?? ""}>{r.detail ?? "-"}</span> },
    ],
    [],
  );

  if (decisions.length === 0 && actions.length === 0 && disseminations.length === 0) return <Blank>대응 기록이 없습니다.</Blank>;
  return (
    <div className="flex flex-col gap-4">
      {decisions.length > 0 && (
        <div className="flex flex-col gap-2">
          <SubHead>결정·승인</SubHead>
          <ol className="flex flex-col gap-1.5">
            {decisions.map((d) => (
              <li key={`${d.at}-${d.kind}`} className="flex flex-col gap-0.5 rounded-md border border-border bg-surface px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-caption text-foreground-muted">{formatClock(d.at)}</span>
                  <Badge variant="green">{d.kind}</Badge>
                  <span className="ml-auto text-caption text-foreground-muted">{d.actor}</span>
                </div>
                <p className="text-caption text-foreground">{d.reason}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {actions.length > 0 && (
        <div className="flex flex-col gap-2">
          <SubHead>조치 {actions.length}건</SubHead>
          <DataTable className="h-auto" data={actions} columns={columns} rowKey={(r) => r.key} hidePagination />
        </div>
      )}

      {disseminations.length > 0 && (
        <div className="flex flex-col gap-2">
          <SubHead>전파</SubHead>
          <ul className="flex flex-col gap-1.5">
            {disseminations.map((d) => (
              <li key={d.key} className="flex items-center gap-2.5 rounded-md border border-border bg-surface px-3 py-2">
                <span className="w-16 shrink-0 text-body text-foreground">{d.channel}</span>
                <Badge variant={ACTION_RESULT_BADGE[d.status as ActionStatus] ?? "outline"} className="shrink-0">{d.status}</Badge>
                <span className="min-w-0 flex-1 truncate text-caption text-foreground-muted" title={d.detail}>{d.detail}</span>
                {d.fallback && <span className="shrink-0 text-caption text-warning">대체 · {d.fallback}</span>}
                <span className="shrink-0 font-mono text-caption text-foreground-muted">{formatClock(d.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── ⑤ 예측 검증이 없는 까닭 — 상태마다 다르다. 없는 것을 빈칸으로 두지 않고 왜 없는지 말한다 ── */
function CaseEmpty({ record }: { record: IncidentRecord }) {
  if (record.status === "진행 중") {
    return <EmptyState variant="inline" icon="mdi:timer-sand" message="사건이 종료되면 예측 검증이 생깁니다" description="예측과 실제를 견주려면 실제 결과가 있어야 합니다." />;
  }
  if (record.status === "오탐") {
    return <EmptyState variant="inline" icon="mdi:close-circle-outline" message="오탐으로 닫힌 사건은 예측 검증을 하지 않습니다" />;
  }
  return <EmptyState variant="inline" icon="mdi:compare-horizontal" message="이 사건에는 예측 대 실제 기록이 없습니다" />;
}
