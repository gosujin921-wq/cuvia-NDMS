/* ─────────────────────────────────────────────
 * 파생 함수 — 화면에 보이는 모든 값은 f(원장, 현재 시계) 다
 *
 * 화면은 fixtures 배열을 직접 뒤지지 않고 여기 함수를 문다(CLAUDE.md). 처리상태·근거·결정·조치·알림은
 * 이벤트·알림 원장을 `now` 로 잘라 만든다. 실서버로 가면 fixtures 가 API 응답으로 바뀌고 이 함수들의
 * 본문만 바뀐다. 시각 비교는 epoch 로 한다.
 * ───────────────────────────────────────────── */

import type { EventEnvelope, EventType } from "./event";
import { ALTERNATIVE_LABEL, type Forecast } from "./forecast";
import type { CityOperationalState, HazardAssessment, Incident, IncidentPhase, StatusChange, WorkflowStatus } from "./incident";
import { ACTIVE_WORKFLOW_STATUSES } from "./incident";
import type { AttentionAlert, AlertStatus } from "./alert";
import type { RiskMatrixResult, RiskMatrixSpec } from "./risk-matrix";
import type { Action, ActionStatus, Decision, Dissemination, DisseminationResult, Outcome, Recommendation, Report } from "./response";
import type { CaseAction, CaseRow, CaseTargetRow, PredictionCase } from "./prediction-case";
import type { DemoStage, DemoTick } from "./stage";
import { ALL_FORECASTS, EVENTS, INCIDENTS, DEMO_TICKS_BY_INCIDENT, ALERTS, CCTV_CHANNELS, RISK_MATRIX_SPECS, WHATIF_CASES, SUBJECT_LOCATION, type CctvChannel } from "../fixtures";
import type { RecordEntry, WhatIfCase, WhatIfPreset, WhatIfResponse, WhatIfSituation, WhatIfSopItem, WhatIfStatus } from "./whatif";

const ms = (iso: string): number => new Date(iso).getTime();
/** 예측 케이스 표의 시각 칸 — HH:MM */
const clockOf = (iso: string): string => new Date(iso).toTimeString().slice(0, 5);

/* ── 원장 ── */

/** 현재 시계까지 수신된 이벤트. `receivedAt` 기준 */
export function eventsUntil(now: Date): EventEnvelope[] {
  const cut = now.getTime();
  return EVENTS.filter((e) => ms(e.receivedAt) <= cut);
}

export function eventsOfIncident(incidentId: string, now: Date): EventEnvelope[] {
  return eventsUntil(now).filter((e) => e.incidentId === incidentId);
}

/** 원장의 마지막 수신 시각 — 이 시계로 읽으면 원장이 아는 모든 일이 다 일어난 뒤다. 원장이 비어 있으면 epoch */
export function ledgerEnd(): Date {
  return new Date(EVENTS.reduce((max, e) => Math.max(max, ms(e.receivedAt)), 0));
}

export function findEvent(eventId: string): EventEnvelope | undefined {
  return EVENTS.find((e) => e.eventId === eventId);
}

function lastOfType<P>(events: EventEnvelope[], type: EventType): EventEnvelope<P> | undefined {
  for (let i = events.length - 1; i >= 0; i--) if (events[i].eventType === type) return events[i] as EventEnvelope<P>;
  return undefined;
}

function allOfType<P>(events: EventEnvelope[], type: EventType): EventEnvelope<P>[] {
  return events.filter((e) => e.eventType === type) as EventEnvelope<P>[];
}

/** 정정·갱신으로 대체된 이벤트를 걷어낸다 (01 §5.3 supersedes) */
export function latestOnly(events: EventEnvelope[]): EventEnvelope[] {
  const superseded = new Set(events.map((e) => e.supersedes).filter(Boolean) as string[]);
  return events.filter((e) => !superseded.has(e.eventId));
}

/* ── 사건 ── */

export interface IncidentView {
  incident: Incident;
  workflowStatus: WorkflowStatus;
  /** 대응중 안의 국면. 통제면 종료 검토가 열린다 */
  phase: IncidentPhase | null;
  mergedInto: string | null;
  createdAt: string | null;
  firstObservedAt: string | null;
  lastUpdatedAt: string | null;
  assessment: HazardAssessment | null;
  /** 직전 판단 — 위험도 카드의 변화 방향(상승·하락·같음)이 여기서 나온다 */
  previousAssessment: HazardAssessment | null;
  pendingDecision: Decision | null;
  openReviews: number;
  forecastHeadline: string | null;
  /** 후보를 만들거나 갱신한 알림 (01 §8 sourceAlerts) */
  sourceAlerts: AlertView[];
  events: EventEnvelope[];
}

export function findIncident(incidentId: string): Incident | undefined {
  return INCIDENTS.find((i) => i.incidentId === incidentId);
}

export function incidentExistsAt(incidentId: string, now: Date): boolean {
  return eventsOfIncident(incidentId, now).some((e) => e.eventType === "INCIDENT_CREATED");
}

export function incidentViewAt(incidentId: string, now: Date): IncidentView | null {
  const incident = findIncident(incidentId);
  if (!incident) return null;
  const events = eventsOfIncident(incidentId, now);
  const created = events.find((e) => e.eventType === "INCIDENT_CREATED");
  if (!created) return null;

  const status = lastOfType<StatusChange>(events, "INCIDENT_STATUS_CHANGED");
  const workflowStatus: WorkflowStatus = status?.payload.to ?? "후보";
  const phase: IncidentPhase | null = workflowStatus === "대응중" ? (status?.payload.phase ?? null) : null;
  const mergedInto = workflowStatus === "병합됨" ? (status?.payload.mergedInto ?? null) : null;

  const decisions = allOfType<Decision>(events, "DECISION_RECORDED").map((e) => e.payload);
  const pendingDecision = decisions.find((d) => d.status === "검토중") ?? null;

  /* 열린 확인 요청 — 요청 뒤에 그 대상을 참조한 결정이 없는 것 */
  const reviews = allOfType<{ targetEventId: string }>(events, "REVIEW_REQUESTED");
  const referenced = new Set(decisions.flatMap((d) => d.references));
  const openReviews = reviews.filter((r) => !referenced.has(r.payload.targetEventId)).length;

  const assessmentEvents = allOfType<HazardAssessment>(events, "ASSESSMENT_UPDATED");
  const assessment = assessmentEvents[assessmentEvents.length - 1]?.payload ?? null;
  const previousAssessment = assessmentEvents[assessmentEvents.length - 2]?.payload ?? null;
  const forecast = currentForecastsOf(incidentId, now).find((f) => f.alternativeId === "baseline") ?? null;
  const forecastHeadline = forecast ? forecastHeadlineAt(forecast, now) : null;

  const firstObservedAt = (created.derivedFrom ?? []).map(findEvent).filter((e): e is EventEnvelope => Boolean(e)).map((e) => e.observedAt).sort()[0] ?? created.observedAt;

  return {
    incident, workflowStatus, phase, mergedInto, createdAt: created.observedAt, firstObservedAt,
    lastUpdatedAt: events[events.length - 1]?.receivedAt ?? created.receivedAt,
    assessment, previousAssessment, pendingDecision, openReviews, forecastHeadline,
    sourceAlerts: alertsAt(now).filter((a) => a.incidentId === incidentId),
    events,
  };
}

/** 현재 시계에 존재하는 사건 전부 — 활성 사건이 위, 그 안에서는 최근 갱신 순 */
export function incidentsAt(now: Date): IncidentView[] {
  return INCIDENTS.map((i) => incidentViewAt(i.incidentId, now))
    .filter((v): v is IncidentView => v !== null)
    .sort((a, b) => {
      const aa = ACTIVE_WORKFLOW_STATUSES.includes(a.workflowStatus) ? 0 : 1;
      const bb = ACTIVE_WORKFLOW_STATUSES.includes(b.workflowStatus) ? 0 : 1;
      if (aa !== bb) return aa - bb;
      return (b.lastUpdatedAt ?? "").localeCompare(a.lastUpdatedAt ?? "");
    });
}

export function isActiveStatus(status: WorkflowStatus): boolean {
  return ACTIVE_WORKFLOW_STATUSES.includes(status);
}

/** 매트릭스 결과 — 위험판단의 정본. 4축은 이것의 설명이다 */
/** 매트릭스 규칙 스펙 — 등급 경계(띠)의 정본. 결과의 ruleId 로 찾는다 */
export function matrixSpecOf(ruleId: string): RiskMatrixSpec | undefined {
  return RISK_MATRIX_SPECS[ruleId];
}

export function riskMatrixAt(incidentId: string, now: Date): RiskMatrixResult | null {
  return incidentViewAt(incidentId, now)?.assessment?.matrix ?? null;
}

/* ── 알림 (01 §6.1) ── */

export interface AlertView extends AttentionAlert {
  /** 현재 시계의 상태 — updates 를 잘라 만든 값. 원본 status 필드는 생성 시점 값이다 */
  currentStatus: AlertStatus;
  /** 현재 시계까지의 갱신 이력 */
  history: AttentionAlert["updates"];
  /** 아직 담당자 손이 필요한가 (확인·해제·억제 전) */
  open: boolean;
}

/** 현재 시계에 생성된 알림 — 열린 것이 위, 그 안에서는 등급·최근 갱신 순 */
export function alertsAt(now: Date): AlertView[] {
  const cut = now.getTime();
  const GRADE = { 심각: 0, 경계: 1, 주의: 2 } as const;
  return ALERTS.filter((a) => ms(a.createdAt) <= cut)
    .map((a) => {
      const history = a.updates.filter((u) => ms(u.at) <= cut);
      const currentStatus = history[history.length - 1]?.status ?? a.status;
      return { ...a, currentStatus, history, updatedAt: history[history.length - 1]?.at ?? a.createdAt, open: currentStatus === "생성" || currentStatus === "갱신" };
    })
    .sort((a, b) => Number(b.open) - Number(a.open) || GRADE[a.grade] - GRADE[b.grade] || b.updatedAt.localeCompare(a.updatedAt));
}

export function findAlert(alertId: string, now: Date): AlertView | undefined {
  return alertsAt(now).find((a) => a.alertId === alertId);
}

/* ── 근거 ── */

/** 사건 근거 목록 — 사건에 연결된 원천·파생·분석 이벤트를 관측시각 순으로. 업무 이벤트는 제외 */
export function evidenceEventsAt(incidentId: string, now: Date): EventEnvelope[] {
  const view = incidentViewAt(incidentId, now);
  if (!view) return [];
  const keys = new Set(view.incident.correlationKeys);
  /* 판단·권고는 사건의 결론이지 근거가 아니다 — 이력 카드가 든다(IA §7 관련 이벤트 현황 · 상태·관계 이력) */
  const NOT_EVIDENCE = new Set<EventType>(["ASSESSMENT_UPDATED", "RECOMMENDATION_UPDATED"]);
  return eventsUntil(now)
    .filter((e) => e.eventClass !== "업무" && !NOT_EVIDENCE.has(e.eventType) && (e.incidentId === incidentId || (e.correlationKeys ?? []).some((k) => keys.has(k))))
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
}

/** 같은 대상의 관측 시계열 — 그래프용 */
export function observationSeriesAt(subjectId: string, now: Date): { at: string; value: number; unit: string; quality: string }[] {
  return eventsUntil(now)
    .filter((e) => e.eventType === "OBSERVATION_RECORDED" && e.subjectId === subjectId && e.measurement)
    .map((e) => ({ at: e.observedAt, value: e.measurement!.value, unit: e.measurement!.unit, quality: e.quality ?? "정상" }));
}

/* ── Forecast ── */

export type ForecastResolution =
  | { kind: "ok"; forecast: Forecast }
  | { kind: "not-found" }
  | { kind: "expired"; forecast: Forecast }
  | { kind: "not-yet"; forecast: Forecast };

/** 예측판 찾기 — 유효성은 보지 않는다. 조건 세트처럼 고정 참조를 읽을 때 쓴다(03 §25) */
export function findForecast(forecastId: string): Forecast | undefined {
  return ALL_FORECASTS.find((f) => f.forecastId === forecastId);
}

/** forecastId 해석 — 잘못되거나 만료된 forecastId 를 다른 Forecast 로 바꾸지 않는다(IA §5.2) */
export function resolveForecast(forecastId: string, now: Date): ForecastResolution {
  const forecast = ALL_FORECASTS.find((f) => f.forecastId === forecastId);
  if (!forecast) return { kind: "not-found" };
  const src = forecast.sourceEventId ? findEvent(forecast.sourceEventId) : undefined;
  if (src && ms(src.receivedAt) > now.getTime()) return { kind: "not-yet", forecast };
  if (ms(forecast.validUntil) < now.getTime()) return { kind: "expired", forecast };
  return { kind: "ok", forecast };
}

/** 현재 시계에 유효한 Forecast — 대체된 갱신(supersedes)은 걷어낸다 */
export function currentForecastsOf(incidentId: string, now: Date): Forecast[] {
  const updates = latestOnly(eventsOfIncident(incidentId, now).filter((e) => e.eventType === "FORECAST_UPDATED"));
  const ids = new Set(updates.flatMap((e) => ((e.payload as { forecastIds?: string[] }).forecastIds ?? [])));
  return ALL_FORECASTS.filter((f) => ids.has(f.forecastId) && ms(f.validUntil) >= now.getTime());
}

/** 사건의 모든 Forecast (만료 포함) — 기록·검증이 쓴다 */
export function forecastsOf(incidentId: string, now: Date): Forecast[] {
  const ids = new Set(eventsOfIncident(incidentId, now).filter((e) => e.eventType === "FORECAST_UPDATED").flatMap((e) => ((e.payload as { forecastIds?: string[] }).forecastIds ?? [])));
  return ALL_FORECASTS.filter((f) => ids.has(f.forecastId));
}

/** 다음 눈금 기준 한 줄 — "38분 뒤 침수 예상 · 해안도로 저지대 구간" */
export function forecastHeadlineAt(forecast: Forecast, now: Date): string {
  const lead = Math.round((ms(forecast.arrivalAt) - now.getTime()) / 60_000);
  const first = forecast.targets[0]?.label ?? "영향 대상";
  if (lead > 0) return `${lead}분 뒤 침수 예상 · ${first}`;
  const next = forecast.marks.find((m) => ms(m.validAt) >= now.getTime());
  return next ? next.impactSummary : forecast.marks[forecast.marks.length - 1]?.impactSummary ?? "";
}

/* ── 대응·실행 ── */

export function recommendationsAt(incidentId: string, now: Date): Recommendation[] {
  return allOfType<Recommendation>(eventsOfIncident(incidentId, now), "RECOMMENDATION_UPDATED").map((e) => e.payload);
}

export function decisionsAt(incidentId: string, now: Date): Decision[] {
  return allOfType<Decision>(eventsOfIncident(incidentId, now), "DECISION_RECORDED").map((e) => e.payload);
}

export interface ActionView extends Action {
  status: ActionStatus;
  detail: string | null;
  updatedAt: string;
}

export function actionsAt(incidentId: string, now: Date): ActionView[] {
  const events = eventsOfIncident(incidentId, now);
  const assigned = allOfType<Action>(events, "ACTION_ASSIGNED");
  const changes = allOfType<{ actionId: string; status: ActionStatus; detail: string; recordedAt: string }>(events, "ACTION_STATUS_CHANGED");
  return assigned.map((e) => {
    const last = [...changes].reverse().find((c) => c.payload.actionId === e.payload.actionId);
    return { ...e.payload, status: last?.payload.status ?? "대기", detail: last?.payload.detail ?? null, updatedAt: last?.observedAt ?? e.observedAt };
  });
}

export interface DisseminationView extends Dissemination {
  results: (DisseminationResult & { at: string })[];
}

export function disseminationsAt(incidentId: string, now: Date): DisseminationView[] {
  const events = eventsOfIncident(incidentId, now);
  const results = allOfType<DisseminationResult>(events, "DISSEMINATION_RESULT_RECORDED");
  return allOfType<Dissemination>(events, "DISSEMINATION_REQUESTED").map((e) => ({
    ...e.payload,
    results: results.filter((r) => r.payload.disseminationId === e.payload.disseminationId).map((r) => ({ ...r.payload, at: r.observedAt })),
  }));
}

export function outcomesAt(incidentId: string, now: Date): Outcome[] {
  return allOfType<Outcome>(eventsOfIncident(incidentId, now), "OUTCOME_RECORDED").map((e) => e.payload);
}

export function reportsAt(incidentId: string, now: Date): Report[] {
  return allOfType<Report>(eventsOfIncident(incidentId, now), "REPORT_GENERATED").map((e) => e.payload);
}

/* ── 단계·시계 ── */

export function ticksOf(incidentId: string): DemoTick[] {
  return DEMO_TICKS_BY_INCIDENT[incidentId] ?? [];
}

export function stageAt(incidentId: string, now: Date): DemoStage {
  let stage: DemoStage = 0;
  for (const tick of ticksOf(incidentId)) if (ms(tick.at) <= now.getTime()) stage = tick.stage;
  return stage;
}

/* ── 종합상황 (IA §6) ── */

/** 광역 맥락 이벤트 — 사건에 묶이지 않은 특보·예측(정정분은 최신만) */
export function contextEventsAt(now: Date): EventEnvelope[] {
  return latestOnly(eventsUntil(now)).filter((e) => !e.incidentId && (e.eventType === "OFFICIAL_ALERT_CHANGED" || e.eventType === "FORECAST_UPDATED"));
}

export function officialAlertsAt(now: Date): EventEnvelope<{ level: string; change: string; area: string }>[] {
  return contextEventsAt(now).filter((e) => e.eventType === "OFFICIAL_ALERT_CHANGED") as EventEnvelope<{ level: string; change: string; area: string }>[];
}

/** 시 전체 대응단계 — CITY_STAGE_CHANGED 가 없으면 상시대비 (01 §8.1) */
export function cityStageAt(now: Date): CityOperationalState {
  const last = lastOfType<CityOperationalState>(eventsUntil(now), "CITY_STAGE_CHANGED");
  return last?.payload ?? { stage: "상시대비", changedAt: "", relatedIncidentIds: [] };
}

export interface WatchTarget {
  incident: Incident;
  /** 선정 근거 — 사전 감시 알림 */
  alert: AlertView | null;
  reasons: EventEnvelope[];
}

/** 감시 우선대상 (02 D0 · 01 §7.1) — 아직 사건이 아닌 구역. 사전 감시 알림 또는 그 구역에 걸린 예측·특보 */
export function watchTargetsAt(now: Date): WatchTarget[] {
  const context = contextEventsAt(now);
  const alerts = alertsAt(now);
  return INCIDENTS.filter((i) => !incidentExistsAt(i.incidentId, now))
    .map((incident) => {
      const keys = new Set(incident.correlationKeys);
      const reasons = context.filter((e) => (e.correlationKeys ?? []).some((k) => keys.has(k)));
      const alert = alerts.find((a) => a.demoRole === "사전 감시 알림" && a.open && a.target.label === incident.scope.label) ?? null;
      return { incident, alert, reasons };
    })
    .filter((w) => w.reasons.length > 0);
}

export interface DataStatusRow {
  subjectId: string;
  label: string;
  source: string;
  lastReceivedAt: string;
  quality: string;
  incidentIds: string[];
}

/** 데이터 상태 (IA §6) — 원천별 최근 수신과 품질. 지연·결측이 위로 */
export function dataStatusAt(now: Date): DataStatusRow[] {
  const rows = new Map<string, DataStatusRow>();
  for (const e of eventsUntil(now)) {
    if (e.eventClass !== "원천" && e.eventType !== "DATA_QUALITY_CHANGED") continue;
    if (e.eventType === "OFFICIAL_ALERT_CHANGED") continue;
    const prev = rows.get(e.subjectId);
    const isQ = e.eventType === "DATA_QUALITY_CHANGED";
    const qState = isQ ? (e.payload as { state: string }).state : null;
    rows.set(e.subjectId, {
      subjectId: e.subjectId,
      label: e.location?.label ?? e.subjectId,
      source: isQ ? (prev?.source ?? e.sourceSystem) : e.sourceSystem,
      lastReceivedAt: isQ ? (prev?.lastReceivedAt ?? e.receivedAt) : e.receivedAt,
      quality: isQ ? (qState === "복구" ? "정상" : qState ?? "정상") : (prev?.quality ?? e.quality ?? "정상"),
      incidentIds: [],
    });
  }
  const active = incidentsAt(now).filter((v) => isActiveStatus(v.workflowStatus));
  for (const row of rows.values()) row.incidentIds = active.filter((v) => v.incident.correlationKeys.includes(row.subjectId)).map((v) => v.incident.incidentId);
  const weight = (q: string) => (q === "결측" ? 0 : q === "지연" ? 1 : q === "의심" ? 2 : 3);
  return [...rows.values()].sort((a, b) => weight(a.quality) - weight(b.quality) || b.lastReceivedAt.localeCompare(a.lastReceivedAt));
}

export interface CctvChannelView extends CctvChannel {
  still: string;
  /** 실촬 클립 — 있으면 스틸을 포스터로 두고 클립을 튼다(CctvStill) */
  clip?: string;
  analysis: { description: string; confidence: number; analyzedAt: string; model: string; version: string } | null;
  incidentId: string | null;
}

/** 주요 CCTV — 활성 사건과 감시 우선구역의 카메라. E7 장면 분석이 오면 그 컷으로 바뀐다 */
export function cctvChannelsAt(now: Date): CctvChannelView[] {
  const active = incidentsAt(now).filter((v) => isActiveStatus(v.workflowStatus)).map((v) => v.incident);
  const scopes = [...active, ...watchTargetsAt(now).map((w) => w.incident)];
  const scenes = eventsUntil(now).filter((e) => e.eventType === "SCENE_ANALYZED");
  return CCTV_CHANNELS.filter((c) => scopes.some((i) => i.correlationKeys.includes(c.id))).map((c) => {
    const scene = [...scenes].reverse().find((e) => e.subjectId === c.id);
    const p = scene?.payload as { still?: string; clip?: string; description: string; confidence: number; analyzedAt: string; model: string; version: string } | undefined;
    return { ...c, still: p?.still ?? c.calmStill, clip: p?.clip, analysis: p ? { description: p.description, confidence: p.confidence, analyzedAt: p.analyzedAt, model: p.model, version: p.version } : null, incidentId: active.find((i) => i.correlationKeys.includes(c.id))?.incidentId ?? null };
  });
}

/* ── 사건 작업공간 (IA §7 · 초안 §4) ── */

export interface RelatedEventRow {
  event: EventEnvelope;
  /** 왜 이 사건·알림과 연결됐는가 — 알림의 연결 이유 또는 사건 공간 키 */
  linkReason: string;
  /** 담당자가 추가로 확인해야 하는가 — 열린 확인 요청의 대상 */
  needsReview: boolean;
  /** 사건에 직접 묶인 근거인가 (아니면 지구 전체 현황) */
  linked: boolean;
}

/**
 * 관련 이벤트 현황 — 사건에 연결된 근거를 최근 것이 위로. 관측 시계열은 대상별 마지막 값만 세우고
 * 파생·분석·특보·시설·예측은 전부 세운다. 사건에 안 묶인 같은 구역 이벤트는 `linked: false` 로 뒤에 붙는다.
 */
export function relatedEventsAt(incidentId: string, now: Date): RelatedEventRow[] {
  const view = incidentViewAt(incidentId, now);
  if (!view) return [];
  const alerts = alertsAt(now).filter((a) => a.incidentId === incidentId);
  const reasonOf = new Map<string, string>();
  /* 연결 이유는 그 근거를 처음 인용한 알림의 것이다. 목록 순서(열림·등급·갱신)로 훑으면 뒤에 온 영상 교차확인 알림이
     관로 급상승 줄의 이유까지 덮어써 관로·도로 줄이 같은 문장이 된다 (2026-09-17) */
  const byCreated = [...alerts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const a of byCreated) for (const id of a.evidenceEventIds) if (!reasonOf.has(id)) reasonOf.set(id, `${a.demoRole} · ${a.reason}`);
  const reviews = allOfType<{ targetEventId: string }>(view.events, "REVIEW_REQUESTED").map((r) => r.payload.targetEventId);
  const decided = new Set(decisionsAt(incidentId, now).flatMap((d) => d.references));
  /* 정정·갱신으로 대체된 것(호우주의보 → 호우경보)은 세우지 않는다 */
  const evidence = latestOnly(evidenceEventsAt(incidentId, now));
  const lastObs = new Map<string, EventEnvelope>();
  const rows: EventEnvelope[] = [];
  for (const e of evidence) {
    if (e.eventType === "OBSERVATION_RECORDED") lastObs.set(e.subjectId, e);
    else rows.push(e);
  }
  /* 관측 마지막 값은 그 주체가 파생·분석 줄로 이미 근거에 서 있으면 겹쳐 세우지 않는다 — 현재값은 좌측 관측 카드 몫이다.
     그래서 `지구의 다른 이벤트`에는 사건과 무관한 주체의 관측만 남는다 (2026-09-14 사용자 지적) */
  const linkedSubjects = new Set(rows.map((e) => e.subjectId));
  const keys = new Set(view.incident.correlationKeys);
  return [...rows, ...[...lastObs.values()].filter((e) => !linkedSubjects.has(e.subjectId))]
    .map((event) => ({
      event,
      linkReason: reasonOf.get(event.eventId) ?? (event.incidentId === incidentId ? "사건에 직접 기록" : `사건 공간 키 ${(event.correlationKeys ?? []).find((k) => keys.has(k)) ?? ""}`),
      needsReview: reviews.includes(event.eventId) && !decided.has(event.eventId),
      linked: event.incidentId === incidentId || Boolean(reasonOf.get(event.eventId)) || event.eventClass !== "원천" || event.eventType === "FACILITY_STATE_CHANGED",
    }))
    .sort((a, b) => Number(b.linked) - Number(a.linked) || b.event.observedAt.localeCompare(a.event.observedAt));
}

/** 시설 상태 — 최신 FACILITY_STATE_CHANGED (정정분 제외) */
export function facilityStateOf(subjectId: string, now: Date): { label: string; detail?: string; engaged: boolean } | null {
  const e = latestOnly(eventsUntil(now).filter((x) => x.eventType === "FACILITY_STATE_CHANGED" && x.subjectId === subjectId)).pop();
  if (!e) return null;
  const p = e.payload as { state: string; available?: number; total?: number; spareRatio?: number; cause?: string | null };
  if (p.available !== undefined) return { label: `${p.available}/${p.total} 가동`, detail: p.cause ?? undefined, engaged: p.available !== p.total };
  if (p.spareRatio !== undefined) return { label: `여유 ${Math.round(p.spareRatio * 100)} %`, engaged: p.spareRatio < 0.2 };
  return { label: p.state, engaged: false };
}

/** 주체의 최신 파생 판정 (변화율·기준 진입) — 핀을 이벤트 핀으로 세울지 정한다 */
export function derivedFlagOf(subjectId: string, now: Date): EventEnvelope | null {
  return eventsUntil(now).filter((e) => e.subjectId === subjectId && (e.eventType === "RATE_CHANGED" || e.eventType === "THRESHOLD_CROSSED")).pop() ?? null;
}

/** 주체의 최신 품질 상태 */
export function qualityOf(subjectId: string, now: Date): string {
  const q = latestOnly(eventsUntil(now).filter((e) => e.eventType === "DATA_QUALITY_CHANGED" && e.subjectId === subjectId)).pop();
  if (!q) return "정상";
  const state = (q.payload as { state: string }).state;
  return state === "복구" ? "정상" : state;
}

/* ── 종합상황 집계 (초안 §2·§3 · CSMS lib/derive.ts 문법) ── */

import { DISTRICTS } from "../demo/districts";
import { DEVICES } from "../demo/devices";
import { eventCategoryOf, EVENT_CATEGORY_ORDER, type DistrictStatus, type EventCategory } from "../lib/status-tone";
import type { RiskGrade } from "./risk-matrix";

const GRADE_RANK: Record<RiskGrade, number> = { 심각: 3, 경계: 2, 주의: 1, 관심: 0 };

/** 사건의 위험도 등급 — 판단 전은 null (배지를 그리지 않는다) */
export function gradeOf(view: IncidentView): RiskGrade | null {
  return view.assessment?.matrix.grade ?? null;
}

/** 지구별 대표 사건 — 진행 중인 것 중 등급 최고, 동률은 최근 갱신 */
export function topIncidentByDistrictAt(now: Date): Map<string, IncidentView> {
  const out = new Map<string, IncidentView>();
  for (const v of incidentsAt(now)) {
    if (!isActiveStatus(v.workflowStatus) || !v.incident.legacyDistrictId) continue;
    const prev = out.get(v.incident.legacyDistrictId);
    const rank = (x: IncidentView) => GRADE_RANK[gradeOf(x) ?? "관심"];
    if (!prev || rank(v) > rank(prev) || (rank(v) === rank(prev) && (v.lastUpdatedAt ?? "") > (prev.lastUpdatedAt ?? ""))) out.set(v.incident.legacyDistrictId, v);
  }
  return out;
}

/**
 * 아직 사건이 안 된 열린 알림과 그 지구. 실시간 주요 사건의 감지 카드와 지구 상태가 같은 목록을 읽는다.
 * 후보를 만든 알림은 빠진다. 그 뒤로는 사건이 같은 자리를 잇는다
 */
function preIncidentAlertsAt(now: Date): { alert: AlertView; districtId: string | null }[] {
  return alertsAt(now)
    .filter((a) => a.open && !(a.incidentId && incidentExistsAt(a.incidentId, now)))
    .map((alert) => ({ alert, districtId: incidentOfAlert(alert)?.legacyDistrictId ?? null }));
}

const DISTRICT_RANK: Record<DistrictStatus, number> = { 심각: 3, 경계: 2, 주의: 1, 정상: 0 };

/**
 * 지구 상태. 진행 중인 사건의 등급과 아직 사건이 안 된 열린 알림의 등급 중 높은 쪽이고, 둘 다 없으면 정상.
 * 알림 카드가 주의(노랑)면 그 지구 점도 노랑이다. 한 지구의 색이 목록·지도·지구 현황에서 갈리지 않는다(2026-09-16)
 */
export function districtStatusAt(now: Date): Map<string, DistrictStatus> {
  const top = topIncidentByDistrictAt(now);
  const byAlert = new Map<string, DistrictStatus>();
  for (const { alert, districtId } of preIncidentAlertsAt(now)) {
    if (districtId && DISTRICT_RANK[alert.grade] > DISTRICT_RANK[byAlert.get(districtId) ?? "정상"]) byAlert.set(districtId, alert.grade);
  }
  const out = new Map<string, DistrictStatus>();
  for (const d of DISTRICTS) {
    const v = top.get(d.id);
    /* 등급 램프 그대로. 판단 전(등급 없음)·관심은 사건이 서 있으니 주의로 둔다 */
    const g = v ? gradeOf(v) : null;
    const byIncident: DistrictStatus = !v ? "정상" : g === "심각" || g === "경계" ? g : "주의";
    const a = byAlert.get(d.id) ?? "정상";
    out.set(d.id, DISTRICT_RANK[a] > DISTRICT_RANK[byIncident] ? a : byIncident);
  }
  return out;
}

export interface DistrictSummary { total: number; onlineCctv: number; danger: number; warning: number }

export function districtSummaryAt(now: Date): DistrictSummary {
  const status = districtStatusAt(now);
  let danger = 0, warning = 0;
  /* 위험 지구 = 심각·경계, 주의 지구 = 주의 (지구 현황 두 칸) */
  for (const s of status.values()) { if (s === "심각" || s === "경계") danger++; else if (s === "주의") warning++; }
  return { total: DISTRICTS.length, onlineCctv: DEVICES.filter((d) => d.kind === "CV" && d.status === "정상").length, danger, warning };
}

export interface RiskCounts { severe: number; high: number; responding: number }

/** 위험 현황 — 심각·경계는 위험도 축, 대응중은 처리 축 (합이 맞지 않는 것이 정상) */
export function riskCountsAt(now: Date): RiskCounts {
  const active = incidentsAt(now).filter((v) => isActiveStatus(v.workflowStatus));
  return {
    severe: active.filter((v) => gradeOf(v) === "심각").length,
    high: active.filter((v) => gradeOf(v) === "경계").length,
    responding: active.filter((v) => v.workflowStatus === "대응중").length,
  };
}

export interface CategoryCount { category: EventCategory; count: number }

/** 이벤트 유형 현황 — 관측 낱개는 세지 않고 파생·분석·특보·시설·품질만 (정정분 제외) */
export function eventCategoryCountsAt(now: Date): CategoryCount[] {
  const counts = new Map<EventCategory, number>();
  for (const e of latestOnly(eventsUntil(now))) {
    const c = eventCategoryOf(e.eventType);
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return EVENT_CATEGORY_ORDER.map((category) => ({ category, count: counts.get(category) ?? 0 }));
}

export interface FeedItem {
  id: string;
  kind: "감지" | "사건";
  /** 무슨 일이 일어났나. 사건은 사건 제목, 감지는 알림 제목. 알림 역할명(사전 감시 등)이나 할 일은 싣지 않는다 */
  title: string;
  grade: RiskGrade | null;
  /** 지구명 · 장비 · 시각 */
  districtId: string | null;
  subjectLabel: string;
  at: string;
  /** 후보인데 아직 아무도 안 연 것 */
  needsAck: boolean;
  process: WorkflowStatus | null;
  /** SOP 진행률 — 조치가 배정된 사건만 */
  sop: { done: number; total: number } | null;
  incidentId: string | null;
  alertId: string | null;
  active: boolean;
}

/**
 * 실시간 주요 사건 — 사건 카드 + 사건 전 알림(감지 카드). 알림이 후보를 만들면 그 알림 카드는 사건 카드로
 * 이어진다(같은 자리). 정렬: 활성 우선 → 등급 → 최근. 종료·오탐·병합은 뒤에 남아 흐리게.
 */
/** 카드의 SOP 진행률 — 사건 작업공간 대응 탭과 같은 항목 계층을 읽는다(두 벌이 되지 않게). 권고 전은 null */
function sopOf(incidentId: string, now: Date): { done: number; total: number } | null {
  const items = sopItemsAt(incidentId, now);
  if (items.length === 0) return null;
  const { done, total } = sopProgress(items);
  return { done, total };
}

export function feedItemsAt(now: Date): FeedItem[] {
  const items: FeedItem[] = [];
  for (const v of incidentsAt(now)) {
    const firstEvidence = v.events.find((e) => e.eventType === "INCIDENT_CREATED");
    const subject = (firstEvidence?.derivedFrom ?? []).map(findEvent).find(Boolean)?.location?.label ?? v.incident.scope.label;
    items.push({
      id: v.incident.incidentId, kind: "사건", title: v.incident.title, grade: gradeOf(v),
      districtId: v.incident.legacyDistrictId ?? null, subjectLabel: subject, at: v.lastUpdatedAt ?? v.createdAt ?? "",
      needsAck: v.workflowStatus === "후보", process: v.workflowStatus,
      sop: sopOf(v.incident.incidentId, now),
      incidentId: v.incident.incidentId, alertId: null, active: isActiveStatus(v.workflowStatus),
    });
  }
  for (const { alert: a, districtId } of preIncidentAlertsAt(now)) {
    items.push({
      id: a.alertId, kind: "감지", title: a.title, grade: a.grade,
      districtId, subjectLabel: a.target.label, at: a.updatedAt,
      needsAck: false, process: null, sop: null, incidentId: null, alertId: a.alertId, active: true,
    });
  }
  return items.sort((x, y) => Number(y.active) - Number(x.active) || GRADE_RANK[y.grade ?? "관심"] - GRADE_RANK[x.grade ?? "관심"] || y.at.localeCompare(x.at));
}

/** 데이터 장애 — 지연·결측·의심 원천 */
export function dataFaultsAt(now: Date): DataStatusRow[] {
  return dataStatusAt(now).filter((r) => r.quality !== "정상");
}

/* ── SOP (초안 사건작업공간_화면상세 §3 대응 · CSMS sop-section 문법) ── */

import { SOP_CATALOG_BY_INCIDENT } from "../fixtures";
import { CHAIN_ACTOR, CHAIN_NOTE, CHAIN_STAGES, sopProgress, type ChainStage, type ChainStageView, type SopItem, type SopItemStatus, type SopRecipient } from "./sop";

const ACTION_TO_SOP: Record<ActionStatus, SopItemStatus> = { 대기: "진행 중", 진행중: "진행 중", 확인대기: "진행 중", 성공: "완료", 대체됨: "완료", 실패: "실패", 미응답: "실패", 취소: "대기" };

/**
 * SOP 항목 — 카탈로그(무엇이 서는가)에 권고·결정·조치·전파 이벤트(상태·시각·담당·결과)를 묶는다.
 * 사건 후보가 생기면 선다. 내부 자동은 후보 생성 시각에 완료(발생과 동시에 자동 대응), 대외 통보는 승인 시각에 완료.
 * 수동은 권고 전에는 대기, 배정 뒤 진행 중, 결과가 오면 완료·실패다.
 */
export function sopItemsAt(incidentId: string, now: Date): SopItem[] {
  const events = eventsOfIncident(incidentId, now);
  const created = events.find((e) => e.eventType === "INCIDENT_CREATED");
  if (!created) return [];
  const catalog = SOP_CATALOG_BY_INCIDENT[incidentId];
  if (!catalog) return [];
  const rec = lastOfType<Recommendation>(events, "RECOMMENDATION_UPDATED")?.payload ?? null;
  const approval = decisionsAt(incidentId, now).find((d) => d.kind === "대응 승인" && d.status === "승인") ?? null;
  const actions = actionsAt(incidentId, now);
  const diss = disseminationsAt(incidentId, now)[0] ?? null;
  /* 어떤 항목이 서는지는 위험등급이 정한다 — 세기를 사람이 고르지 않는다 (2026-09-14). 판단 전에는 주의 취급 */
  const grade = lastOfType<HazardAssessment>(events, "ASSESSMENT_UPDATED")?.payload.matrix.grade ?? "주의";
  const enabled = catalog.filter((c) => !c.minGrade || GRADE_RANK[grade] >= GRADE_RANK[c.minGrade]
    /* 등급이 내려가도 이미 배정된 조치는 남는다 — 목록에서 사라지면 완료 기록도 같이 사라진다 */
    || (c.binding.kind === "action" && (() => { const b = c.binding; return actions.some((a) => a.kind === b.actionKind && a.target === b.target); })()));

  return enabled.map<SopItem>((c) => {
    const head = { id: c.id, label: c.label, priority: c.priority, execMode: c.execMode, chain: c.chain };
    const b = c.binding;
    if (b.kind === "auto") {
      const at = b.completeOn === "candidate" ? created.observedAt : approval?.recordedAt;
      if (!at) return { ...head, status: "대기", detail: "승인 뒤 실행" };
      const recipients: SopRecipient[] | undefined = b.recipientsFrom === "actions"
        ? [...new Set(actions.filter((a) => rec?.proposedActions.some((d) => d.kind === a.kind && d.target === a.target)).map((a) => a.organization))].map((name) => ({ name, sent: "완료", at }))
        : undefined;
      return { ...head, status: "완료", at, detail: b.detail, recipients };
    }
    if (b.kind === "action") {
      const draft = rec?.proposedActions.find((a) => a.kind === b.actionKind && a.target === b.target);
      const live = actions.find((a) => a.kind === b.actionKind && a.target === b.target);
      const facility = b.facility ? facilityStateOf(b.facility, now) : null;
      const status: SopItemStatus = live ? ACTION_TO_SOP[live.status] : "대기";
      return {
        ...head, status, actionId: live?.actionId, organization: live?.organization ?? draft?.organization ?? c.organization, assignee: live?.assignee ?? draft?.organization ?? c.organization,
        at: live?.updatedAt, detail: live?.detail ?? draft?.summary ?? (rec ? undefined : "조치안 준비 중"), basis: live ? undefined : draft?.basis, failReason: status === "실패" ? live?.detail ?? undefined : undefined,
        facility: facility ? { label: `가동 ${facility.label}`, engaged: facility.engaged } : undefined,
      };
    }
    /* dissemination */
    if (!diss) return { ...head, status: "대기", detail: "승인 뒤 전파 · 알림톡 · 마을방송 · 전광판 · 기관 통보", confirm: "cap" };
    const recipients: SopRecipient[] = diss.channels.map((ch) => {
      const last = [...diss.results].reverse().find((r) => r.channel === ch);
      if (!last) return { name: ch, sent: "대기" };
      const fb = last.fallback;
      const fbAction = fb?.actionId ? actions.find((a) => a.actionId === fb.actionId) : undefined;
      return {
        name: ch, at: last.at, detail: last.detail,
        sent: last.status === "성공" ? "완료" : last.status === "실패" || last.status === "미응답" ? "실패" : last.status === "확인대기" ? "확인 대기" : "대기",
        fallback: fb && fbAction ? { channel: fb.channel, detail: fbAction.detail ?? fb.detail, at: fbAction.updatedAt, done: fbAction.status === "성공" || fbAction.status === "대체됨" } : undefined,
      };
    });
    const failedOpen = recipients.filter((r) => r.sent === "실패" && !r.fallback);
    const settled = recipients.every((r) => r.sent === "완료" || (r.sent === "실패" && r.fallback?.done));
    const status: SopItemStatus = failedOpen.length > 0 ? "실패" : settled ? "완료" : "진행 중";
    const lastAt = [...recipients, ...recipients.map((r) => r.fallback)].map((r) => r?.at).filter(Boolean).sort().pop();
    return {
      ...head, status, confirm: "cap", recipients, at: lastAt ?? diss.message.sent,
      detail: `전파문 · ${diss.message.areaDesc}`,
      failReason: failedOpen[0] ? `${failedOpen[0].name} ${failedOpen[0].detail ?? "실패"}` : undefined,
      fallbackAvailable: failedOpen.length > 0,
    };
  });
}

/** 태그가 같은 항목들의 합산 상태 · 실패 > 진행 > 완료 > 대기 (CSMS response-chain 과 같은 규칙) */
function chainStateOf(items: SopItem[], requireAllDone: boolean): SopItemStatus {
  if (items.length === 0) return "대기";
  if (items.some((i) => i.status === "실패")) return "실패";
  const done = items.filter((i) => i.status === "완료").length;
  if (requireAllDone ? done === items.length : done > 0) return "완료";
  if (items.some((i) => i.status === "진행 중" || i.status === "완료")) return "진행 중";
  return "대기";
}

/** 대응 흐름 4단계 — SOP 항목의 단계 태그와 처리상태에서 계산한다. 새 상태를 만들지 않는다 */
export function chainStagesAt(incidentId: string, now: Date): ChainStageView[] {
  const view = incidentViewAt(incidentId, now);
  const items = sopItemsAt(incidentId, now);
  const status = view?.workflowStatus ?? "후보";
  const closed = status === "종료";
  const byStage = (stage: ChainStage) => items.filter((i) => i.chain === stage);
  return CHAIN_STAGES.map((stage) => {
    let state: SopItemStatus;
    if (stage === "HQ") {
      state = closed || status === "대응중" || items.some((i) => i.status === "완료") ? "완료" : status === "확인중" ? "진행 중" : "대기";
    } else if (stage === "FIELD") {
      const mine = byStage(stage);
      const must = mine.filter((i) => i.priority === "MUST");
      state = closed ? "완료" : must.length > 0 && must.every((i) => i.status === "완료") ? "완료" : mine.some((i) => i.status === "완료" || i.status === "진행 중") ? "진행 중" : "대기";
    } else {
      state = closed && byStage(stage).length > 0 ? "완료" : chainStateOf(byStage(stage), true);
    }
    return { stage, actor: CHAIN_ACTOR[stage], state, note: CHAIN_NOTE[stage][state] };
  });
}

/* ── 사건 전 알림 (IA §7 "사건 생성 전에는 선택한 복합 알림을 구성한 이벤트를") ── */

export interface WatchView {
  /** 알림이 가리키는 구역의 사건 정의 — 아직 생성되지 않은 정적 정의. 지도 범위·주체·카메라를 준다 */
  incident: Incident;
  alert: AlertView;
  /** 알림을 구성한 이벤트 + 그 구역의 광역 맥락(특보·예측) */
  rows: RelatedEventRow[];
}

/**
 * 종합상황 감지 카드에서 넘어온 알림 — 사건이 아직 없을 때 사건 작업공간이 여는 것.
 * 알림이 이미 사건을 만들었으면 null 이다(그때는 사건을 연다). 사건을 만들어 내지 않는다(IA §5.2 예외).
 */
/** 알림이 가리키는 사건 정의 — 사건 ID, 범위 라벨, 근거 이벤트의 주체 순으로 찾는다 */
function incidentOfAlert(alert: AttentionAlert): Incident | undefined {
  if (alert.incidentId) { const byId = INCIDENTS.find((i) => i.incidentId === alert.incidentId); if (byId) return byId; }
  const byLabel = INCIDENTS.find((i) => i.scope.label === alert.target.label);
  if (byLabel) return byLabel;
  const subjects = alert.evidenceEventIds.map((id) => findEvent(id)?.subjectId).filter(Boolean) as string[];
  return INCIDENTS.find((i) => subjects.some((sid) => i.correlationKeys.includes(sid)));
}

export function watchViewAt(alertId: string, now: Date, districtId?: string): WatchView | null {
  const alert = findAlert(alertId, now);
  if (!alert) return null;
  if (alert.incidentId && incidentExistsAt(alert.incidentId, now)) return null;
  const incident = incidentOfAlert(alert) ?? (districtId ? INCIDENTS.find((i) => i.legacyDistrictId === districtId && !incidentExistsAt(i.incidentId, now)) : undefined);
  if (!incident) return null;
  const cut = now.getTime();
  const evidence = alert.evidenceEventIds.map(findEvent).filter((e): e is EventEnvelope => Boolean(e) && ms(e!.receivedAt) <= cut);
  const keys = new Set(incident.correlationKeys);
  const context = contextEventsAt(now).filter((e) => (e.correlationKeys ?? []).some((k) => keys.has(k)) && !evidence.some((x) => x.eventId === e.eventId));
  const rows: RelatedEventRow[] = [
    ...evidence.map((event) => ({ event, linkReason: `${alert.demoRole} · ${alert.reason}`, needsReview: false, linked: true })),
    ...context.map((event) => ({ event, linkReason: "같은 구역의 광역 맥락", needsReview: false, linked: false })),
  ];
  return { incident, alert, rows: rows.sort((a, b) => Number(b.linked) - Number(a.linked) || b.event.observedAt.localeCompare(a.event.observedAt)) };
}

/* ── 지구 현황 (04 §3 · 2026-09-14) — 사건도 알림도 없는 지구. 같은 골격에 관측·이벤트만 서고 판단·전망·대응은 잠긴다 ── */

export interface DistrictView {
  incident: Incident;
  rows: RelatedEventRow[];
  /** 최근 수신 시각 */
  lastReceivedAt: string | null;
}

/** 사건이 생기지 않은 지구의 정적 정의와 그 지구 이벤트(연결 없음). 정의가 없는 지구는 null */
export function districtViewAt(districtId: string, now: Date): DistrictView | null {
  const incident = INCIDENTS.find((i) => i.legacyDistrictId === districtId && !incidentExistsAt(i.incidentId, now));
  if (!incident) return null;
  const keys = new Set(incident.correlationKeys);
  const cut = now.getTime();
  const events = latestOnly(EVENTS.filter((e) => ms(e.receivedAt) <= cut && e.eventClass !== "업무" && !e.incidentId && (e.correlationKeys ?? []).some((k) => keys.has(k))));
  const lastObs = new Map<string, EventEnvelope>();
  const rows: EventEnvelope[] = [];
  for (const e of events) {
    if (e.eventType === "OBSERVATION_RECORDED") lastObs.set(e.subjectId, e);
    else rows.push(e);
  }
  const all = [...rows, ...lastObs.values()].sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  return {
    incident,
    rows: all.map((event) => ({ event, linkReason: "지구 상시 관측 · 사건·알림 없음", needsReview: false, linked: false })),
    lastReceivedAt: events.map((e) => e.receivedAt).sort().pop() ?? null,
  };
}

/** 범위 정의가 가진 카메라 — 사건·알림·지구 현황이 같은 함수로 도크를 채운다 */
export function channelsOfScope(scope: Incident, now: Date): CctvChannelView[] {
  const scenes = eventsUntil(now).filter((e) => e.eventType === "SCENE_ANALYZED");
  return CCTV_CHANNELS.filter((c) => scope.correlationKeys.includes(c.id)).map((c) => {
    const scene = [...scenes].reverse().find((e) => e.subjectId === c.id);
    const p = scene?.payload as { still?: string; clip?: string; description: string; confidence: number; analyzedAt: string; model: string; version: string } | undefined;
    return { ...c, still: p?.still ?? c.calmStill, clip: p?.clip, analysis: p ? { description: p.description, confidence: p.confidence, analyzedAt: p.analyzedAt, model: p.model, version: p.version } : null, incidentId: incidentExistsAt(scope.incidentId, now) ? scope.incidentId : null };
  });
}

/* ── 위험도 띠 — 점수를 숫자로 보이지 않고 등급 구간 안의 위치로 읽는다 (2026-09-14 결정) ──
   담당자는 등급으로 판단한다. 점수가 전하는 것은 "다음 문턱까지 얼마나 남았나"와 "지난 판단보다 올랐나"뿐이라
   그 둘만 말로 바꾼다. 숫자는 fixture 와 기록·검증에 남는다 */
export interface RiskBandView {
  /** 등급 구간 — 띠의 조각. 폭 = 문턱 사이 거리 */
  segments: { grade: RiskGrade; from: number; to: number }[];
  /** 현재 점수의 띠 위 위치 0~1 */
  position: number;
  /** 다음 등급과 그 문턱까지 거리. 최고 등급이면 null */
  next: { grade: RiskGrade; gap: number } | null;
  /** 지난 판단 대비 방향. 첫 판단이면 null */
  change: "상승" | "하락" | "같음" | null;
}
const NEAR_THRESHOLD = 0.05;
export function riskBandOf(matrix: RiskMatrixResult, previous: RiskMatrixResult | null): RiskBandView {
  const spec = RISK_MATRIX_SPECS[matrix.ruleId];
  const thresholds = [...(spec?.gradeThresholds ?? [])].sort((a, b) => a.minScore - b.minScore);
  const segments = thresholds.map((t, i) => ({ grade: t.grade, from: t.minScore, to: thresholds[i + 1]?.minScore ?? 1 }));
  const idx = segments.findIndex((s) => s.grade === matrix.grade);
  const nextSeg = idx >= 0 ? segments[idx + 1] : undefined;
  const change = previous ? (matrix.score > previous.score ? "상승" : matrix.score < previous.score ? "하락" : "같음") : null;
  return { segments, position: Math.min(1, Math.max(0, matrix.score)), next: nextSeg ? { grade: nextSeg.grade, gap: nextSeg.from - matrix.score } : null, change };
}
/** 띠 아래 한 줄 — `지난 판단보다 상승 · 심각 문턱 직전` */
export function riskBandSentence(band: RiskBandView): string {
  const move = band.change === null ? "첫 판단" : band.change === "같음" ? "지난 판단과 같음" : `지난 판단보다 ${band.change}`;
  const near = band.next ? (band.next.gap <= NEAR_THRESHOLD ? `${band.next.grade} 문턱 직전` : `${band.next.grade}까지 여유`) : "최고 등급";
  return `${move} · ${near}`;
}

/** 위험도 계산에 들어간 근거 이벤트 — 판단의 evidenceEventIds 와 지표별 근거의 합집합. 좌측 근거의 `위험도에 쓰인 것만` 토글이 쓴다 */
export function riskEvidenceIdsOf(assessment: HazardAssessment | null): Set<string> {
  if (!assessment) return new Set();
  return new Set([...assessment.evidenceEventIds, ...assessment.matrix.contributions.flatMap((c) => c.evidenceEventIds)]);
}

/** 지구에 열린 알림 — 링크에 alertId 가 없어도 사건 없는 지구는 이 알림으로 연다 (2026-09-14 검수 6번). 등급 높은 것 우선 */
const ALERT_GRADE_RANK: Record<string, number> = { 심각: 3, 경계: 2, 주의: 1 };
export function districtAlertAt(districtId: string, now: Date): AlertView | null {
  return alertsAt(now)
    .filter((a) => a.open && !(a.incidentId && incidentExistsAt(a.incidentId, now)) && incidentOfAlert(a)?.legacyDistrictId === districtId)
    .sort((a, b) => (ALERT_GRADE_RANK[b.grade] ?? 0) - (ALERT_GRADE_RANK[a.grade] ?? 0))[0] ?? null;
}

/* ── 예측 케이스 (IA §13.1) ────────────────────────────────────────────────
 * 사건이 끝나면 예측판 하나가 케이스 한 건이 된다. 원 객체를 고치지 않고 참조만 해 조립한다.
 * 점수를 매기지 않는다 — 예측과 실제를 나란히 두고 차이와 개선 항목만 남긴다.
 * ───────────────────────────────────────────────────────────────────────── */

/** 라벨 끝의 수 — "저지대 건물 12동" → 12 · "동" */
function countOfLabel(label: string): { n: number; unit: string } | null {
  const m = label.match(/(\d+)(\S*)$/);
  return m ? { n: Number(m[1]), unit: m[2] } : null;
}
const signed = (d: number, digits = 0): string => `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(digits)}`;

/**
 * 이 사건의 예측 케이스. 종료(D8)에서 실제 결과가 붙은 뒤에만 선다.
 * 실제 결과가 아직 없으면 빈 목록이다 — 사건 도중에는 검증할 것이 없다.
 */
export function predictionCasesAt(incidentId: string, now: Date): PredictionCase[] {
  const incident = findIncident(incidentId);
  const outcome = outcomesAt(incidentId, now).at(-1);
  if (!incident || !outcome) return [];
  const closedAt = allOfType<StatusChange>(eventsOfIncident(incidentId, now), "INCIDENT_STATUS_CHANGED").reverse().find((e) => e.payload.to === "종료")?.observedAt;

  const v = outcome.verification;
  const forecastId = v.available ? v.forecastId : forecastsOf(incidentId, now).find((f) => f.alternativeId === "baseline")?.forecastId ?? "";
  const forecast = findForecast(forecastId);
  if (!forecast) return [];
  /* 검증한 그 예측값의 눈금 — 검증이 든 최대 침수심과 같은 눈금이라야 지도의 예측 범위가 표의 값과 맞는다.
     검증이 없으면 가장 깊은 눈금을 쓴다 */
  const verifiedMark = v.available ? forecast.marks.find((m) => Math.abs(m.maxDepthM - v.predictedDepthM) < 0.005) : undefined;
  const peak = verifiedMark ?? [...forecast.marks].sort((a, b) => b.maxDepthM - a.maxDepthM)[0];

  /* ① 예측 대 실제 — 예측판이 든 값과 실측값만. 없는 값을 만들지 않는다 */
  const rows: CaseRow[] = [];
  const targets: CaseTargetRow[] = [];
  if (v.available) {
    const arrivalDelta = Math.round((new Date(v.observedArrivalAt).getTime() - new Date(v.predictedArrivalAt).getTime()) / 60000);
    rows.push({
      label: "침수 도달", predicted: clockOf(v.predictedArrivalAt), actual: clockOf(v.observedArrivalAt),
      error: arrivalDelta === 0 ? "0분" : `${signed(arrivalDelta)}분`,
      /* 실제가 더 늦으면 예측이 이르게 본 것 = 과대 */
      direction: arrivalDelta === 0 ? "일치" : arrivalDelta > 0 ? "과대" : "과소",
    });
    const depthDelta = Number((v.observedDepthM - v.predictedDepthM).toFixed(2));
    rows.push({
      label: "최대 침수심", predicted: `${v.predictedDepthM.toFixed(2)} m`, actual: `${v.observedDepthM.toFixed(2)} m`,
      error: depthDelta === 0 ? "0 m" : `${signed(depthDelta, 2)} m`,
      direction: depthDelta === 0 ? "일치" : depthDelta < 0 ? "과대" : "과소",
    });
    for (const t of forecast.targets) {
      const observed = v.observedTargets?.find((o) => o.id === t.id) ?? null;
      /* 수가 적힌 대상은 수를 한 줄로 올린다 — "영향 건물 12동 / 10동 / −2동".
         예측판은 2026-09-16부터 수를 적지 않으므로(README §2.3 기준 ③) 이 줄은 실측에만 수가 있는 지난 판본에서만 선다 */
      const cp = countOfLabel(t.label), ca = observed ? countOfLabel(observed.label) : null;
      if (cp && ca) {
        const d = ca.n - cp.n;
        rows.push({
          label: t.label.replace(/\s*\d+\S*$/, ""), predicted: `${cp.n}${cp.unit}`, actual: `${ca.n}${ca.unit}`,
          error: d === 0 ? `0${cp.unit}` : `${signed(d)}${cp.unit}`,
          direction: d === 0 ? "일치" : d < 0 ? "과대" : "과소",
        });
      }
      targets.push({
        id: t.id, kind: t.kind, predicted: t.exposure, actual: observed?.exposure ?? null,
        hit: observed ? observed.exposure === t.exposure : null,
        byResponse: observed?.exposure === "통제됨" && t.exposure !== "통제됨",
      });
    }
  }

  /* ② 실제 대응 — 성공으로 끝난 조치만. 결정은 그 위에 한 줄 */
  const approvals = decisionsAt(incidentId, now).filter((d) => d.kind === "대응 승인" && d.status === "승인");
  const done = actionsAt(incidentId, now).filter((a) => a.status === "성공");
  const actions: CaseAction[] = [
    ...approvals.map((d) => ({ at: d.recordedAt, text: `대응안 승인 · ${d.approver}` })),
    ...done.map((a) => ({ at: a.updatedAt, text: a.detail ?? `${a.kind} · ${a.target}` })),
  ].sort((x, y) => ms(x.at) - ms(y.at));

  const alternatives = forecastsOf(incidentId, now)
    .filter((f) => f.forecastId !== forecastId && f.alternativeId !== "baseline")
    .map((f) => ({ label: ALTERNATIVE_LABEL[f.alternativeId], headline: forecastHeadlineAt(f, now) }));

  return [{
    caseId: incidentId.replace(/^INC-/, "PC-"),
    sourceIncidentId: incidentId,
    incidentTitle: incident.title,
    hazardLabel: incident.hazardKind,
    twinFamily: incident.twinFamily,
    regionLabel: incident.scope.label,
    baseTime: forecast.basis.baseTime,
    confirmedAt: closedAt ?? outcome.milestones.at(-1)?.at ?? forecast.basis.generatedAt,
    forecastId,
    inputs: forecast.basis.inputs ?? [],
    modelName: forecast.basis.modelName,
    modelVersion: forecast.basis.modelVersion,
    inputQuality: forecast.basis.inputQuality,
    rows,
    targets,
    predictedGeometryId: peak?.extentGeometryId ?? "",
    actualGeometryId: v.available ? v.observedGeometryId ?? null : null,
    alternatives,
    actions,
    improvements: outcome.improvements,
    unavailableReason: v.available ? undefined : v.reason,
  }];
}

/* ── 디지털트윈 (03 §25 · §26 · 2026-09-16 확정) ─────────────────────────────
 * 사건의 시간·공간 상태를 탐색하는 분석 공간이다. 진행 중이면 기록 | 지금 | 전망, 종료면 기록 전체(재현)를 훑고,
 * 필요할 때만 조건을 바꿔 대안을 본다. 진행 중인지 종료인지는 원장이 정한다.
 * ───────────────────────────────────────────────────────────────────────── */

/** 사건의 지금 상태 — 원장에 없으면 준비물의 closedAt 으로 판단한다(과거 사건) */
export function whatIfStatusOf(c: WhatIfCase, now: Date): WhatIfStatus | null {
  if (c.closedAt) return "종료";
  const view = incidentViewAt(c.incidentId, now);
  if (!view) return null;
  return isActiveStatus(view.workflowStatus) ? "진행 중" : "종료";
}

/** 목록 — 지금 시계에 존재하는 사건만. 진행 중 사건은 준비물이 열린 뒤부터. 진행 중이 먼저, 그다음 종료(최근 순) */
export function whatIfCasesAt(now: Date): { item: WhatIfCase; status: WhatIfStatus }[] {
  return WHATIF_CASES
    .map((item) => ({ item, status: whatIfStatusOf(item, now) }))
    .filter((r): r is { item: WhatIfCase; status: WhatIfStatus } =>
      r.status !== null && (r.status === "종료" || !r.item.availableFrom || ms(r.item.availableFrom) <= now.getTime()))
    .sort((a, b) => (a.status === b.status ? ms(b.item.occurredAt) - ms(a.item.occurredAt) : a.status === "진행 중" ? -1 : 1));
}

/**
 * 모의훈련의 지난 사건 목록 — 끝난 사건만 (README §2.3 · 03 §26.1 · 2026-09-16).
 * 진행 중 사건은 여기 서지 않는다. "지금 대응하면?"은 사건 작업공간 전망 탭이 맡는다.
 * 대표 사건(서항)도 종료된 뒤에 이 목록에 들어온다.
 */
export function pastWhatIfCasesAt(now: Date): WhatIfCase[] {
  return WHATIF_CASES
    .filter((item) => whatIfStatusOf(item, now) === "종료")
    .sort((a, b) => ms(b.occurredAt) - ms(a.occurredAt));
}

export function findWhatIfCase(incidentId: string): WhatIfCase | undefined {
  return WHATIF_CASES.find((c) => c.incidentId === incidentId);
}

/** Phase 1 지구 링크(/scr-05/:districtId)가 가리키는 사건 트윈 — 그 지구에 사건 트윈이 없으면 없다(다른 사건으로 바꾸지 않는다 · IA §5.2) */
export function whatIfCaseOfDistrict(districtId: string): WhatIfCase | undefined {
  return WHATIF_CASES.find((c) => (c.legacyDistrictId ?? findIncident(c.incidentId)?.legacyDistrictId) === districtId);
}

/** 사건 진행 — 진행 중 사건은 지금까지만 보인다(아직 일어나지 않은 일은 기록이 아니다) */
export function whatIfRecordAt(c: WhatIfCase, status: WhatIfStatus, now: Date): RecordEntry[] {
  return status === "종료" ? c.record : c.record.filter((r) => ms(r.at) <= now.getTime());
}

/** 시간축의 멈춤 자리 — 지도 상태가 있는 시각. 진행 중은 기록(지금 이전) + 예측(지금 이후), 종료는 기준 재현 전체 */
export interface WhatIfStop {
  at: string;
  kind: "기록" | "예측";
  forecastId: string;
}
export function whatIfStopsAt(c: WhatIfCase, status: WhatIfStatus, now: Date): WhatIfStop[] {
  const recon = findForecast(c.reconstructionForecastId);
  if (!recon) return [];
  if (status === "종료") return recon.marks.map((m) => ({ at: m.validAt, kind: "기록" as const, forecastId: recon.forecastId }));
  const forecast = c.forecastId ? findForecast(c.forecastId) : undefined;
  /* 예측판을 지난 구간에 그리지 않는다 — 지금 이전은 기록, 지금 이후는 예측 */
  const past = recon.marks.filter((m) => ms(m.validAt) <= now.getTime()).map((m) => ({ at: m.validAt, kind: "기록" as const, forecastId: recon.forecastId }));
  const future = (forecast?.marks ?? []).filter((m) => ms(m.validAt) > now.getTime()).map((m) => ({ at: m.validAt, kind: "예측" as const, forecastId: forecast!.forecastId }));
  return [...past, ...future];
}

/** 비교의 기준 판 — 진행 중은 기준 전망, 종료는 기준 재현(실제 대응을 넣어 같은 방식으로 다시 계산한 것) */
export function whatIfBaselineIdOf(c: WhatIfCase, status: WhatIfStatus): string {
  return status === "종료" ? c.reconstructionForecastId : c.forecastId ?? c.reconstructionForecastId;
}

/**
 * 분석 기준(▲) — 진행 중 사건은 지금이고 옮기지 않는다. 종료 사건은 원장의 판단 시점(decision) 중 고른 것,
 * 고르지 않았으면 처음 판단할 수 있었던 시점이다. 보던 시각(커서)을 기준으로 삼지 않는다 — 최대 영향 시각에서 대안을 열면 선택지가 전부 닫힌다.
 */
export function whatIfBasisOf(c: WhatIfCase, status: WhatIfStatus, now: Date, requested?: string | null): { at: string; label: string } {
  if (status !== "종료") return { at: now.toISOString(), label: "지금" };
  const decisions = c.record.filter((r) => r.decision);
  const hit = requested ? decisions.find((r) => r.at === requested) : undefined;
  const pick = hit ?? decisions[0] ?? c.record[0];
  return pick ? { at: pick.at, label: pick.label } : { at: c.occurredAt, label: "사건 발생" };
}

/** 상황 조건의 판 — 진행 중은 지금부터 갈리는 판 하나, 종료는 분석 기준(▲)에 맞춰 사전 계산한 판. 없으면 그 기준에서 고를 수 없다 */
export function whatIfSituationForecastId(s: WhatIfSituation, status: WhatIfStatus, basisAt: string | null): string | null {
  if (status !== "종료") return s.forecastId ?? null;
  return s.byBasis?.find((b) => basisAt !== null && ms(b.at) === ms(basisAt))?.forecastId ?? null;
}

/** 상황 판 위에 대응 선택지를 얹은 조합 판 — 없으면 그 조합은 고를 수 없다 */
export function whatIfComboForecastId(c: WhatIfCase, situationForecastId: string, responseId: string, presetId: string): string | null {
  return c.combos?.find((x) => x.situationForecastId === situationForecastId && x.responseId === responseId && x.presetId === presetId)?.forecastId ?? null;
}

/**
 * 분석 기준보다 이른 선택지는 고를 수 없다 — 그 시각에 서서 "20분 일찍 했다면"을 물어도 이미 지난 일이다.
 * 시점을 바꾸는 대응에만 쓴다. 범위·수준을 바꾸는 선택지는 시각이 같다.
 */
export function whatIfPresetPassed(basisAt: string, preset: WhatIfPreset): boolean {
  return ms(preset.at) < ms(basisAt);
}

/**
 * 그 시각의 상태 줄. 과거 사건은 준비물의 복원값(그 시각 이전 마지막 것), 진행 중 사건은 원장에서 그 시각의 마지막 관측·시설 상태를 읽는다.
 * 네 줄까지 — 강우 · 수위 · 시설. 무엇을 보이는지는 사건 주체가 정한다.
 */
export function whatIfStateRowsAt(c: WhatIfCase, atIso: string): { at: string; rows: { label: string; value: string }[] } {
  if (c.stateByTime?.length) {
    const sorted = [...c.stateByTime].sort((a, b) => ms(a.at) - ms(b.at));
    const hit = [...sorted].reverse().find((s) => ms(s.at) <= ms(atIso)) ?? sorted[0];
    return { at: hit.at, rows: hit.rows };
  }
  const incident = findIncident(c.incidentId);
  if (!incident) return { at: atIso, rows: [] };
  const at = new Date(atIso);
  const rows: { label: string; value: string }[] = [];
  for (const id of incident.correlationKeys) {
    const series = observationSeriesAt(id, at);
    const last = series[series.length - 1];
    if (last) {
      rows.push({ label: subjectLabelOf(id), value: `${last.value} ${last.unit}` });
      continue;
    }
    const fac = facilityStateOf(id, at);
    if (fac && fac.engaged) rows.push({ label: subjectLabelOf(id), value: fac.label });
  }
  return { at: atIso, rows: rows.slice(0, 4) };
}

/** 주체 이름 — 주체 공간 표(SUBJECT_LOCATION)의 이름 */
export function subjectLabelOf(subjectId: string): string {
  return SUBJECT_LOCATION[subjectId]?.label ?? subjectId;
}


/* ── 모의훈련 (03 §26 · 2026-09-16 v2) ──────────────────────────────────
 * 화면은 여기 함수만 부른다. 사건 fixture 를 직접 뒤지지 않는다.
 * ───────────────────────────────────────────────────────────────────── */

/**
 * 훈련 목록에 서는 사건 — 끝난 사건은 훈련할 수 있고, **진행 중 사건은 근거만 볼 수 있다**.
 *
 * ★ 진행 중 사건을 훈련할 수는 없다. 훈련의 기준은 "실제와 같게 했을 때"인데 그 실제가 아직 없다.
 *   대신 **지금 서 있는 전망이 무엇으로 계산됐는지**는 여기서 재 볼 수 있어야 한다(2026-09-17 사용자) —
 *   예측을 믿고 대응을 정하는 화면(재난관제)과, 그 예측이 믿을 만한지 재는 화면(모의훈련)은 다른 자리다.
 * ★ 대응 판단 자체는 여전히 재난관제 전망 탭이 맡는다(README §2.3). 여기서는 근거만 연다.
 */
export function trainingCasesAt(now: Date): { c: WhatIfCase; ready: boolean; live: boolean; core: WhatIfResponse | null }[] {
  const live = WHATIF_CASES.filter((c) => whatIfStatusOf(c, now) === "진행 중").sort((a, b) => ms(b.occurredAt) - ms(a.occurredAt));
  return [...live, ...pastWhatIfCasesAt(now)].map((c) => {
    const running = whatIfStatusOf(c, now) === "진행 중";
    return {
      c,
      ready: !running && Boolean(c.training),
      live: running,
      /* 그 유형의 핵심 판단 = 현상 대응. 없으면 훈련 시나리오를 만들 수 없다(03 §26.3) */
      core: c.responses.find((r) => r.kind === "현상") ?? null,
    };
  });
}

/**
 * 진행 중 사건의 **지금 서 있는 전망** — 근거를 재려면 먼저 어느 판인지 정해야 한다.
 * 기준시각이 지금보다 이르면서 가장 최근인 판이고, 유효기간이 지난 판은 세지 않는다.
 */
export function livePrimaryForecast(c: WhatIfCase, now: Date): Forecast | null {
  const at = now.toISOString();
  /* 사건에 실제로 붙은 판만 본다 — 예측 갱신 이벤트가 가리킨 것들이다(고아 판을 끌어오지 않는다) */
  const mine = forecastsOf(c.incidentId, now).filter((f) => f.alternativeId === "baseline");
  const usable = mine.filter((f) => f.basis.baseTime <= at && (!f.validUntil || f.validUntil >= at));
  const pick = (usable.length > 0 ? usable : mine).sort((a, b) => ms(b.basis.baseTime) - ms(a.basis.baseTime))[0];
  return pick ?? null;
}

/**
 * 그 조건에서 **이 조치로 기준 초과를 막을 수 있는 마지막 판단 정지점** (03 §26.4 · 2026-09-17).
 *
 * 정지점 노트를 글자로 박아 두면 조건이 바뀔 때 거짓이 된다 — 창원천 14:55 "방류가 효과를 낼 수 있는
 * 마지막 시각"은 당시 조건에서만 반쯤 맞고(+20% 에선 건물이 노출되고 +50% 에선 어느 시각에도 못 막는다).
 * 그래서 노트가 아니라 **판**에서 읽는다: 그 조치 하나만 각 판단 정지점에 실행한 판을 차례로 보고,
 * 도달(기준 초과)이 사라지는 가장 늦은 정지점을 문턱으로 삼는다.
 *   none   기준 초과라는 개념이 없거나(도달 없는 유형) 조치 없이도 안 넘는다 → 문턱을 말하지 않는다
 *   until  그 시각까지 정하면 막는다
 *   never  이 조건에서는 어느 정지점에 해도 못 막는다 — 훈련이 찾아야 할 "규정의 한계"
 */
export function trainingDeadlineOf(c: WhatIfCase, conditionStepId: string, sopId: string): { kind: "none" | "until" | "never"; at?: string } {
  const t = c.training;
  if (!t) return { kind: "none" };
  const crossOf = (f: Forecast | null) => (f && f.targets.some((x) => x.arrivalAt) ? f.arrivalAt : null);
  const base = trainingResultOf(c, conditionStepId, {}).base;
  if (!crossOf(base)) return { kind: "none" };
  let last: string | undefined;
  for (const st of t.stops.filter((s) => s.phase === "판단")) {
    const mine = trainingResultOf(c, conditionStepId, { [sopId]: st.at }).mine;
    if (mine && crossOf(mine) === null) last = st.at;
  }
  return last ? { kind: "until", at: last } : { kind: "never" };
}

/** 그 정지점에서 고를 수 있는 조치 — 아직 안 했고, 그 시각 선택지가 있는 규정 */
export function trainingSopsAt(c: WhatIfCase, at: string, acts: Record<string, string>): { sop: WhatIfSopItem; response: WhatIfResponse | null; preset: WhatIfPreset | null; can: boolean }[] {
  const ids = c.training?.firedSopIds ?? [];
  return ids
    .map((id) => c.sop?.find((s) => s.id === id))
    .filter((s): s is WhatIfSopItem => Boolean(s))
    .map((sop) => {
      const response = c.responses.find((r) => r.responseId === sop.responseId) ?? null;
      /* 그 시각에 고를 수 있나.
         결과를 가르는 조치(resultSopIds)는 **조합 판이 정본이다** — 판이 있어야 결과를 낼 수 있다.
         결과를 안 가르는 조치(창원천 S1 둔치 통제)는 판이 없어도 **판단 국면이면 언제든 실행**한다.
         발동했는데 실행할 방법이 없으면 "규정 3건 발동"과 화면이 어긋난다(2026-09-16 사용자). */
      const gates = c.training?.resultSopIds ?? [];
      const can = gates.includes(sop.id)
        ? (c.training?.combos ?? []).some((x) => x.acts[sop.id] === at)
        : true;
      return { sop, response, preset: null as WhatIfPreset | null, can };
    })
    /* 이번 정지점에 실행한 것은 남긴다(되돌릴 수 있게). 앞서 확정한 것은 뺀다 */
    .filter(({ sop, can }) => (acts[sop.id] ? acts[sop.id] === at : can))
    /* 핵심(현상 대응)이 위로 */
    .sort((a, b) => Number(b.response?.kind === "현상") - Number(a.response?.kind === "현상"));
}

/**
 * 내 조치가 만든 판과 비교의 기준 판.
 * 기준은 **같은 조건에서 실제와 같은 시각에 했을 때**다(03 §26.7). 조건과 조치를 동시에 바꾼 비교를 하지 않는다.
 */
export function trainingResultOf(c: WhatIfCase, conditionStepId: string, acts: Record<string, string>): { mine: Forecast | null; base: Forecast | null } {
  const t = c.training;
  if (!t) return { mine: null, base: null };
  /* 결과를 가르는 조치만 조합 키가 된다 */
  const keys = t.resultSopIds;
  const same = (a: Record<string, string>) =>
    keys.every((k) => (a[k] ?? null) === (acts[k] ?? null));
  const hit = t.combos.find((x) => x.conditionStepId === conditionStepId && same(x.acts));
  const baseHit = t.combos.find((x) => x.conditionStepId === conditionStepId && keys.every((k) => !x.acts[k]));
  return {
    mine: hit ? findForecast(hit.forecastId) ?? null : null,
    base: baseHit ? findForecast(baseHit.forecastId) ?? null : null,
  };
}
