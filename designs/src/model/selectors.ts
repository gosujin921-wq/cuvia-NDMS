/* ─────────────────────────────────────────────
 * 파생 함수 — 화면에 보이는 모든 값은 f(원장, 현재 시계) 다
 *
 * 화면은 fixtures 배열을 직접 뒤지지 않고 여기 함수를 문다(CLAUDE.md). 처리상태·근거·결정·조치·알림은
 * 이벤트·알림 원장을 `now` 로 잘라 만든다. 실서버로 가면 fixtures 가 API 응답으로 바뀌고 이 함수들의
 * 본문만 바뀐다. 시각 비교는 epoch 로 한다.
 * ───────────────────────────────────────────── */

import type { EventEnvelope, EventType } from "./event";
import type { Forecast, AlternativeId } from "./forecast";
import type { CityOperationalState, HazardAssessment, Incident, IncidentPhase, StatusChange, WorkflowStatus } from "./incident";
import { ACTIVE_WORKFLOW_STATUSES } from "./incident";
import type { AttentionAlert, AlertStatus } from "./alert";
import type { RiskMatrixResult } from "./risk-matrix";
import type { Action, ActionStatus, Decision, Dissemination, DisseminationResult, Outcome, Recommendation, Report } from "./response";
import type { TrainingConditionSet, TrainingScenario, TrainingScenarioRequest } from "./training";
import type { DemoStage, DemoTick } from "./stage";
import { ALL_FORECASTS, EVENTS, INCIDENTS, DEMO_TICKS_BY_INCIDENT, ALTERNATIVE_FORECAST_IDS, ALERTS, CCTV_CHANNELS, RISK_MATRIX_SPECS, TRAINING_CONDITION_SETS, type CctvChannel } from "../fixtures";

const ms = (iso: string): number => new Date(iso).getTime();

/* ── 원장 ── */

/** 현재 시계까지 수신된 이벤트. `receivedAt` 기준 */
export function eventsUntil(now: Date): EventEnvelope[] {
  const cut = now.getTime();
  return EVENTS.filter((e) => ms(e.receivedAt) <= cut);
}

export function eventsOfIncident(incidentId: string, now: Date): EventEnvelope[] {
  return eventsUntil(now).filter((e) => e.incidentId === incidentId);
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

/** 예측판 찾기 — 유효성은 보지 않는다. 훈련 스냅샷처럼 고정 참조를 읽을 때 쓴다(IA §13.1) */
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

export function alternativesOf(incidentId: string, now: Date): { id: AlternativeId; forecast: Forecast }[] {
  return currentForecastsOf(incidentId, now).map((f) => ({ id: f.alternativeId, forecast: f }));
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
    const p = scene?.payload as { still?: string; description: string; confidence: number; analyzedAt: string; model: string; version: string } | undefined;
    return { ...c, still: p?.still ?? c.calmStill, analysis: p ? { description: p.description, confidence: p.confidence, analyzedAt: p.analyzedAt, model: p.model, version: p.version } : null, incidentId: active.find((i) => i.correlationKeys.includes(c.id))?.incidentId ?? null };
  });
}

/* ── 훈련 스냅샷 (IA §13.1) ── */

export function buildTrainingScenario(req: TrainingScenarioRequest, now: Date): TrainingScenario | null {
  const view = incidentViewAt(req.sourceIncidentId, now);
  if (!view) return null;
  const forecast = ALL_FORECASTS.find((f) => f.forecastId === req.selectedForecastId);
  if (!forecast) return null;
  const evidence = evidenceEventsAt(req.sourceIncidentId, now);
  const decisions = decisionsAt(req.sourceIncidentId, now);
  const actions = actionsAt(req.sourceIncidentId, now);
  const outcomes = outcomesAt(req.sourceIncidentId, now);
  const alternatives = alternativesOf(req.sourceIncidentId, now).map((a) => a.forecast.forecastId);
  return {
    scenarioId: `TS-${view.incident.incidentId}-v1`, snapshotVersion: 1, createdAt: req.requestedAt, origin: "incident-snapshot",
    source: { sourceIncidentId: view.incident.incidentId, hazardKind: view.incident.hazardKind, twinFamily: view.incident.twinFamily, scopeKind: view.incident.scopeKind, scope: view.incident.scope },
    timing: { snapshotAt: now.toISOString(), originalStartAt: view.firstObservedAt ?? view.createdAt ?? now.toISOString(), trainingBaseTime: view.incident.scenarioContext.scenarioBaseTime },
    conditionEvents: evidence.map((e) => ({ eventId: e.eventId, demoRef: e.demoRef, schemaVersion: e.schemaVersion })),
    selectedForecast: { forecastId: forecast.forecastId, validAt: forecast.marks[0]?.validAt ?? forecast.basis.baseTime, alternativeId: forecast.alternativeId, affectedGeometryId: forecast.marks[forecast.marks.length - 1]?.extentGeometryId },
    history: { evidenceEventIds: view.assessment?.evidenceEventIds ?? [], decisionIds: decisions.map((d) => d.decisionId), actionIds: actions.map((a) => a.actionId), outcomeIds: outcomes.map((o) => o.outcomeId) },
    training: { changeableConditions: ["펌프 가용성", "통제 시작 시각", "전파 채널 구성"], alternativeForecastIds: alternatives.length ? alternatives : ALTERNATIVE_FORECAST_IDS, objectives: ["후보 확인까지의 판단 시간 단축", "실패 채널 대체조치 선택", "전망 기준 통제 시각 결정"] },
    provenance: { composition: view.incident.scenarioContext.scenarioMode, transformRules: [...new Set(evidence.map((e) => e.scenario?.scenarioRuleId).filter(Boolean) as string[])], calculationActor: forecast.basis.calculationActor, replacementTargets: [forecast.basis.replacementNote ?? ""].filter(Boolean) },
  };
}

/**
 * 사전 조건 세트 → 훈련 시나리오 (IA-T01 사전 조건분석). 사건 없이 조건을 골라 여는 길이다.
 * 범위·유형은 대표 사건에서 빌리고, 이력·조건 이벤트는 비어 있다. 예측판은 세트가 가리키는 사전 작성 결과다.
 */
export function conditionScenarioOf(set: TrainingConditionSet): TrainingScenario | null {
  const incident = set.incidentId ? findIncident(set.incidentId) : undefined;
  const forecast = set.baselineForecastId ? ALL_FORECASTS.find((f) => f.forecastId === set.baselineForecastId) : undefined;
  /* 개념 장면은 사건이 없다 — 세트가 든 범위·유형으로 세우고 기준시각은 예측판 기준시각이다 */
  const source = incident
    ? { sourceIncidentId: incident.incidentId, hazardKind: incident.hazardKind, twinFamily: incident.twinFamily, scopeKind: incident.scopeKind, scope: incident.scope }
    : set.source
      ? { sourceIncidentId: "", hazardKind: set.source.hazardKind, twinFamily: set.source.twinFamily, scopeKind: set.source.scope.kind, scope: set.source.scope }
      : null;
  if (!source) return null;
  const base = incident?.scenarioContext.scenarioBaseTime ?? forecast?.basis.baseTime ?? "";
  return {
    scenarioId: `TS-COND-${set.setId}`, snapshotVersion: 1, createdAt: base, origin: "condition-set", conditionSet: set,
    source,
    timing: { snapshotAt: base, originalStartAt: base, trainingBaseTime: base },
    conditionEvents: [],
    selectedForecast: forecast ? { forecastId: forecast.forecastId, validAt: forecast.marks[0]?.validAt ?? forecast.basis.baseTime, alternativeId: forecast.alternativeId, affectedGeometryId: forecast.marks[forecast.marks.length - 1]?.extentGeometryId } : null,
    history: { evidenceEventIds: [], decisionIds: [], actionIds: [], outcomeIds: [] },
    training: { changeableConditions: set.changeableConditions, alternativeForecastIds: set.alternativeForecastIds, objectives: set.objectives },
    provenance: { composition: "완전 모의", transformRules: [], calculationActor: forecast?.basis.calculationActor ?? "해당 없음", replacementTargets: ["모델 연계 시 같은 조건의 ModelRun 결과로 교체"] },
  };
}

/** 준비된 조건 세트 전부 — 예측판이 없는 조합도 세운다(정직한 빈 자리) */
export function conditionScenarios(): TrainingScenario[] {
  return TRAINING_CONDITION_SETS.map(conditionScenarioOf).filter((s): s is TrainingScenario => Boolean(s));
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
  for (const a of alerts) for (const id of a.evidenceEventIds) if (!reasonOf.has(id)) reasonOf.set(id, `${a.demoRole} · ${a.reason}`);
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
import { alertRoleLabel, eventCategoryOf, EVENT_CATEGORY_ORDER, type DistrictStatus, type EventCategory } from "../lib/status-tone";
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

/** 지구 상태 — 심각 = 위험, 그 외 활성 사건·후보 = 주의, 없음 = 정상 */
export function districtStatusAt(now: Date): Map<string, DistrictStatus> {
  const top = topIncidentByDistrictAt(now);
  const out = new Map<string, DistrictStatus>();
  for (const d of DISTRICTS) {
    const v = top.get(d.id);
    /* 등급 램프 그대로. 판단 전(등급 없음)·관심은 사건이 서 있으니 주의로 둔다 */
    const g = v ? gradeOf(v) : null;
    out.set(d.id, !v ? "정상" : g === "심각" || g === "경계" ? g : "주의");
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
  /** 조치 전 상태 문구 */
  statusText: string | null;
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
  const alerts = alertsAt(now);
  const items: FeedItem[] = [];
  for (const v of incidentsAt(now)) {
    const acts = actionsAt(v.incident.incidentId, now);
    const grade = gradeOf(v);
    const firstEvidence = v.events.find((e) => e.eventType === "INCIDENT_CREATED");
    const subject = (firstEvidence?.derivedFrom ?? []).map(findEvent).find(Boolean)?.location?.label ?? v.incident.scope.label;
    items.push({
      id: v.incident.incidentId, kind: "사건", title: v.incident.title, grade,
      districtId: v.incident.legacyDistrictId ?? null, subjectLabel: subject, at: v.lastUpdatedAt ?? v.createdAt ?? "",
      needsAck: v.workflowStatus === "후보", process: v.workflowStatus,
      sop: sopOf(v.incident.incidentId, now),
      statusText: acts.length ? null
        : v.workflowStatus === "오탐" ? "오탐 종결 · 원천 이벤트 보존"
        : v.workflowStatus === "병합됨" ? `${(v.mergedInto && findIncident(v.mergedInto)?.title) ?? v.mergedInto ?? "기준 사건"}에 병합`
        : v.workflowStatus === "종료" ? "종료"
        : v.workflowStatus === "후보" ? "검토 인수 대기"
        : v.workflowStatus === "확인중" ? "근거 확인 중"
        : !grade ? "위험도 판단 전"
        : v.forecastHeadline,
      incidentId: v.incident.incidentId, alertId: null, active: isActiveStatus(v.workflowStatus),
    });
  }
  for (const a of alerts) {
    if (a.incidentId && incidentExistsAt(a.incidentId, now)) continue; // 사건이 된 알림은 사건 카드가 잇는다
    if (!a.open) continue;
    items.push({
      id: a.alertId, kind: "감지", title: alertRoleLabel(a.demoRole).replace(" 알림", ""), grade: a.grade === "심각" ? "심각" : a.grade === "경계" ? "경계" : "주의",
      districtId: incidentOfAlert(a)?.legacyDistrictId ?? null, subjectLabel: a.target.label, at: a.updatedAt,
      needsAck: false, process: null, sop: null, statusText: a.task, incidentId: null, alertId: a.alertId, active: true,
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
    const p = scene?.payload as { still?: string; description: string; confidence: number; analyzedAt: string; model: string; version: string } | undefined;
    return { ...c, still: p?.still ?? c.calmStill, analysis: p ? { description: p.description, confidence: p.confidence, analyzedAt: p.analyzedAt, model: p.model, version: p.version } : null, incidentId: incidentExistsAt(scope.incidentId, now) ? scope.incidentId : null };
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
