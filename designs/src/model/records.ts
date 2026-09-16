/* ─────────────────────────────────────────────
 * 사건 기록 — 이력(IA-05)과 통계(IA-06)가 같이 무는 사건 원장 (IA §10 · 2026-09-16)
 *
 * 두 메뉴가 다른 목록을 세면 숫자가 갈린다(2026-09-16 사용자 "통계와 이력의 숫자를 맞춰"). 사건 목록·상태·시각은
 * 여기 한 벌이 정하고, 이력 게시판과 통계 집계는 이것만 문다. 화면은 원장 배열을 직접 뒤지지 않는다.
 *
 * ★ 사건이 지금 두 곳에 적혀 있다.
 *     이벤트 원장이 있는 사건   fixtures INCIDENTS — 서항 대표 사건과 병합·오탐 사건, 지구 사건
 *     디지털트윈에만 있는 사건  fixtures WHATIF_CASES — 창원천·구항·무학산·폭염 같은 지난 사건
 *   incidentId 로 합치고, 둘 다 있으면 원장 쪽을 쓴다. 지난 사건은 원장이 없어서 발생·실제 대응·종료만 안다.
 *   그래서 두 쪽 모두 가진 값(상태·유형·지역·발생·첫 대응·종료)으로만 센다.
 *   TODO(data): 지난 사건도 INCIDENTS 와 이벤트 원장에 올리면 이 합치기가 사라진다.
 *
 * ★ 시계로 자른다. 아직 생기지 않은 사건은 목록에 서지 않고, 사건이 끝나기 전에는 종료 시각도 예측 검증도 없다.
 * ───────────────────────────────────────────── */

import { INCIDENTS, WHATIF_CASES } from "../fixtures";
import { findDistrict } from "../demo/districts";
import { ACTION_RESULT_BADGE, evidenceKindOf, RISK_GRADE_TONE, STATUS_TONE } from "../lib/status-tone";
import { formatClock, formatDate, formatElapsed } from "../lib/datetime";
import type { EventEnvelope } from "./event";
import type { HazardAssessment, HazardKind, StatusChange, WorkflowStatus } from "./incident";
import type { Action, Decision, DisseminationResult, Report } from "./response";
import { actionsAt, disseminationsAt, eventsOfIncident, findEvent, findForecast, forecastsOf, incidentViewAt, outcomesAt, predictionCasesAt, reportsAt } from "./selectors";
import type { CaseRow } from "./prediction-case";
import type { RiskGrade } from "./risk-matrix";
import type { RecordEntry, WhatIfCase } from "./whatif";

/* ── 사건 목록 ─────────────────────────────────── */

/** 이력·통계가 쓰는 상태 넷 — 처리상태 여섯(후보·확인중·대응중·종료·오탐·병합됨)을 읽는 사람 쪽으로 접었다 */
export type RecordStatus = "진행 중" | "종료" | "오탐" | "병합";
export const RECORD_STATUSES: RecordStatus[] = ["진행 중", "종료", "오탐", "병합"];

export function recordStatusOf(status: WorkflowStatus): RecordStatus {
  if (status === "종료") return "종료";
  if (status === "오탐") return "오탐";
  if (status === "병합됨") return "병합";
  return "진행 중";
}

export interface IncidentRecord {
  incidentId: string;
  title: string;
  /** 사건 범위 이름 — "서항 검증 배수권역" */
  scopeLabel: string;
  /** 지역 — Phase 1 지구가 있으면 지구 이름, 없으면 범위 이름. 통계의 지역 칸이 이것으로 묶는다 */
  region: string;
  hazardKind: HazardKind;
  status: RecordStatus;
  /** 원장 사건의 처리상태. 원장이 없는 사건은 null */
  workflowStatus: WorkflowStatus | null;
  /** 병합됐으면 기준 사건 */
  mergedInto: string | null;
  /** 원장 사건은 후보 생성 시각, 지난 사건은 발생 시각 */
  occurredAt: string;
  /** 종료·오탐·병합으로 닫힌 시각. 진행 중이면 null */
  closedAt: string | null;
  /** 첫 대응(조치 배정·전파 요청·시설 요청) 시각. 대응이 없으면 null */
  firstResponseAt: string | null;
  responseCount: number;
  /** 예측 케이스 수(IA §13.1) — 종료 뒤에만 생긴다 */
  caseCount: number;
  reports: Report[];
  /** 이벤트 원장이 있는가. 없으면 이벤트 이력은 발생·실제 대응·종료만 선다 */
  hasLedger: boolean;
  /** 사건 작업공간(`/scr-02/:districtId`)으로 가는 지구 */
  districtId: string | null;
}

const RESPONSE_TYPES = new Set(["ACTION_ASSIGNED", "DISSEMINATION_REQUESTED", "CONTROL_REQUESTED"]);
const CLOSE_STATUSES: WorkflowStatus[] = ["종료", "오탐", "병합됨"];

const regionOf = (districtId: string | undefined, scopeLabel: string): string =>
  (districtId && findDistrict(districtId)?.name) || scopeLabel;

function ledgerRecord(incidentId: string, now: Date, falsePositive: boolean): IncidentRecord | null {
  const raw = incidentViewAt(incidentId, now);
  if (!raw || !raw.createdAt) return null;
  const createdAt = raw.createdAt;
  /* 화면에서 담당자가 닫은 오탐은 원장 이벤트가 아니라 엔진 상태다. 사건 작업공간(scr-02)과 같은 규칙으로 뷰 위에 얹는다 */
  const view = falsePositive ? { ...raw, workflowStatus: "오탐" as const } : raw;
  const { incident, events } = view;
  const closing = [...events].reverse().find(
    (e) => e.eventType === "INCIDENT_STATUS_CHANGED" && CLOSE_STATUSES.includes((e.payload as StatusChange).to),
  );
  const responses = events.filter((e) => RESPONSE_TYPES.has(e.eventType));
  return {
    incidentId,
    title: incident.title,
    scopeLabel: incident.scope.label,
    region: regionOf(incident.legacyDistrictId, incident.scope.label),
    hazardKind: incident.hazardKind,
    status: recordStatusOf(view.workflowStatus),
    workflowStatus: view.workflowStatus,
    mergedInto: view.mergedInto,
    occurredAt: createdAt,
    closedAt: closing?.observedAt ?? null,
    firstResponseAt: responses[0]?.observedAt ?? null,
    responseCount: responses.length,
    caseCount: predictionCasesAt(incidentId, now).length,
    reports: reportsAt(incidentId, now),
    hasLedger: true,
    districtId: incident.legacyDistrictId ?? null,
  };
}

function pastRecord(c: WhatIfCase, now: Date): IncidentRecord | null {
  if (new Date(c.occurredAt) > now) return null;
  const closed = c.closedAt && new Date(c.closedAt) <= now ? c.closedAt : null;
  const responses = pastEntries(c, now).filter((r) => r.kind === "대응");
  return {
    incidentId: c.incidentId,
    title: c.title,
    scopeLabel: c.scope.label,
    region: regionOf(c.legacyDistrictId, c.scope.label),
    hazardKind: c.hazardKind,
    status: closed ? "종료" : "진행 중",
    workflowStatus: null,
    mergedInto: null,
    occurredAt: c.occurredAt,
    closedAt: closed,
    firstResponseAt: responses[0]?.at ?? null,
    responseCount: responses.length,
    caseCount: 0,
    reports: [],
    hasLedger: false,
    districtId: c.legacyDistrictId ?? null,
  };
}

/** 원장 밖에서 온 상태 — 엔진(ScenarioProvider)이 든다. 화면은 자기가 가진 값을 넣지 않고 엔진 값을 그대로 넘긴다 */
export interface RecordOverrides {
  /** 담당자가 사건 작업공간에서 [오탐 처리]로 닫은 사건 */
  falsePositiveIds?: string[];
}

/** 지금 시계에 존재하는 사건 전부 — 진행 중이 위, 그 안에서는 발생 최신순 */
export function incidentRecordsAt(now: Date, overrides: RecordOverrides = {}): IncidentRecord[] {
  const fp = new Set(overrides.falsePositiveIds ?? []);
  const ledger = INCIDENTS.map((i) => ledgerRecord(i.incidentId, now, fp.has(i.incidentId))).filter((r): r is IncidentRecord => r !== null);
  const known = new Set(INCIDENTS.map((i) => i.incidentId));
  const past = WHATIF_CASES.filter((c) => !known.has(c.incidentId))
    .map((c) => pastRecord(c, now))
    .filter((r): r is IncidentRecord => r !== null);
  return [...ledger, ...past].sort((a, b) => {
    const aa = a.status === "진행 중" ? 0 : 1;
    const bb = b.status === "진행 중" ? 0 : 1;
    return aa - bb || b.occurredAt.localeCompare(a.occurredAt);
  });
}

/** 사건 하나. 없거나 아직 생기지 않았으면 null — 다른 사건으로 바꾸지 않는다(IA §5.2 라우트 예외) */
export function findIncidentRecord(incidentId: string, now: Date, overrides: RecordOverrides = {}): IncidentRecord | null {
  return incidentRecordsAt(now, overrides).find((r) => r.incidentId === incidentId) ?? null;
}

/* ── 이벤트 이력 (타임라인) ────────────────────── */

/** 한 시간축의 세 갈래 — 무슨 일이 있었나 · 무엇을 했나 · 끝 (CSMS 통합 타임라인 문법) */
export type TimelineLane = "flow" | "action" | "close";
/** DS Badge 색 — 종류를 짧은 뱃지로 적는다 */
export type TimelineBadge = "outline" | "blue" | "green" | "cyan" | "yellow" | "orange" | "red" | "purple" | "gray";

export interface RecordTimelineEntry {
  key: string;
  at: string;
  lane: TimelineLane;
  /** 뱃지 글자 — "수위" · "위험 판단" · "승인" · "전파" */
  kind: string;
  badge: TimelineBadge;
  label: string;
  detail?: string;
  actor?: string;
  /** flow 줄의 점 색(등급·상태). 없으면 빈 점 */
  dot?: string;
  /** 실패 — 대체조치로 이어졌어도 실패는 실패로 남긴다(IA §9 승인 경계) */
  failed?: boolean;
  /** close 줄 — 정상 종료인가(체크) 오탐·병합인가 */
  closeKind?: "종료" | "오탐" | "병합";
}


function entryOf(e: EventEnvelope): RecordTimelineEntry {
  const base = { key: e.eventId, at: e.observedAt, label: e.summary, actor: e.actor };
  switch (e.eventType) {
    case "INCIDENT_CREATED":
      return { ...base, lane: "flow", kind: "사건", badge: "outline", dot: STATUS_TONE.후보.dot };
    case "INCIDENT_STATUS_CHANGED": {
      const p = e.payload as StatusChange;
      if (p.to === "종료" || p.to === "오탐" || p.to === "병합됨") {
        return { ...base, lane: "close", kind: "상태", badge: "gray", closeKind: recordStatusOf(p.to) as "종료" | "오탐" | "병합", detail: p.reason };
      }
      return { ...base, lane: "flow", kind: "상태", badge: "outline", dot: STATUS_TONE[p.to].dot, detail: p.reason };
    }
    case "INCIDENT_RELATION_CHANGED":
      return { ...base, lane: "flow", kind: "관계", badge: "outline" };
    case "ASSESSMENT_UPDATED": {
      const grade = (e.payload as HazardAssessment).matrix.grade;
      return { ...base, lane: "flow", kind: `위험 ${grade}`, badge: RISK_GRADE_TONE[grade].badge, dot: RISK_GRADE_TONE[grade].dot };
    }
    case "RECOMMENDATION_UPDATED":
      return { ...base, lane: "flow", kind: "권고", badge: "blue" };
    case "REVIEW_REQUESTED":
      return { ...base, lane: "action", kind: "확인 요청", badge: "cyan" };
    case "DECISION_RECORDED": {
      const d = e.payload as Decision;
      return { ...base, lane: "action", kind: d.kind === "대응 승인" ? "승인" : d.kind, badge: d.status === "기각" || d.status === "취소" ? "gray" : "green", actor: d.approver, detail: d.reason };
    }
    case "ACTION_ASSIGNED": {
      const a = e.payload as Action;
      return { ...base, lane: "action", kind: "조치", badge: "blue", detail: `${a.organization} · ${a.assignee}` };
    }
    case "ACTION_STATUS_CHANGED": {
      const status = (e.payload as { status: DisseminationResult["status"] }).status;
      return { ...base, lane: "action", kind: `조치 ${status}`, badge: ACTION_RESULT_BADGE[status] ?? "blue", failed: status === "실패" || status === "미응답" };
    }
    case "DISSEMINATION_REQUESTED":
      return { ...base, lane: "action", kind: "전파", badge: "purple" };
    case "DISSEMINATION_RESULT_RECORDED": {
      const r = e.payload as DisseminationResult;
      return { ...base, lane: "action", kind: `전파 ${r.status}`, badge: ACTION_RESULT_BADGE[r.status] ?? "purple", detail: r.fallback ? `${r.detail} · 대체 ${r.fallback.channel}` : r.detail, failed: r.status === "실패" || r.status === "미응답" };
    }
    case "CONTROL_REQUESTED":
    case "CONTROL_RESULT_RECORDED":
      return { ...base, lane: "action", kind: "시설 요청", badge: "blue" };
    case "OUTCOME_RECORDED":
      return { ...base, lane: "action", kind: "결과", badge: "orange" };
    case "REPORT_GENERATED":
      return { ...base, lane: "action", kind: "보고서", badge: "outline" };
    case "CITY_STAGE_CHANGED":
      return { ...base, lane: "flow", kind: "도시 대응단계", badge: "orange" };
    default:
      /* 관측·특보·영상·시설·예측·데이터 상태 — 근거 종류로 적는다(담당자 질문은 "무슨 근거인가") */
      return { ...base, lane: "flow", kind: evidenceKindOf(e), badge: "outline", actor: undefined };
  }
}

/**
 * 사건 하나의 이벤트 이력 — 시간순(오래된 것이 위).
 *
 * 수집 이벤트를 전부 늘어놓지 않는다. 사건에 붙은 업무·판단 이벤트와, 그것들이 만들어지거나 참조할 때 쓴 원천 이벤트만 선다.
 * 원장이 없는 지난 사건은 발생 · 실제 대응 · 종료 셋만 안다. 원장에 없는 시각은 지어내지 않는다.
 */
export function incidentTimelineAt(record: IncidentRecord, now: Date): RecordTimelineEntry[] {
  if (!record.hasLedger) {
    const c = WHATIF_CASES.find((w) => w.incidentId === record.incidentId);
    const occurred: RecordTimelineEntry = { key: "occurred", at: record.occurredAt, lane: "flow", kind: "사건", badge: "outline", label: "사건 발생", detail: record.scopeLabel };
    const rows: RecordTimelineEntry[] = [
      occurred,
      ...(c ? pastEntries(c, now) : []).map((r, i): RecordTimelineEntry =>
        r.kind === "대응"
          ? { key: `r${i}`, at: r.at, lane: "action", kind: "조치", badge: "blue", label: r.label }
          : { key: `r${i}`, at: r.at, lane: "flow", kind: r.kind, badge: r.kind === "예측" ? "cyan" : r.kind === "영향" ? "orange" : "outline", label: r.label },
      ),
    ];
    rows.sort((a, b) => a.at.localeCompare(b.at));
    if (record.closedAt) rows.push({ key: "closed", at: record.closedAt, lane: "close", kind: "상태", badge: "gray", label: "사건 종료", closeKind: "종료" });
    return rows;
  }

  const own = eventsOfIncident(record.incidentId, now);
  const ownIds = new Set(own.map((e) => e.eventId));
  const cut = now.getTime();
  const sources = [...new Set(own.flatMap((e) => [...(e.derivedFrom ?? []), ...(e.references ?? [])]))]
    .filter((id) => !ownIds.has(id))
    .map(findEvent)
    .filter((e): e is EventEnvelope => Boolean(e) && new Date(e!.receivedAt).getTime() <= cut && (e!.eventClass === "원천" || e!.eventClass === "파생"));
  return [...sources, ...own]
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
    .map(entryOf);
}

/** 이벤트 이력 머리 한 줄 — 조치·전파·실패 수 */
export function timelineSummaryOf(entries: RecordTimelineEntry[]): { actions: number; disseminations: number; failures: number } {
  return {
    actions: entries.filter((e) => e.lane === "action" && (e.kind === "조치" || e.kind === "시설 요청")).length,
    disseminations: entries.filter((e) => e.kind === "전파").length,
    failures: entries.filter((e) => e.failed).length,
  };
}

/* ── 보고서 ─────────────────────────────────────── */

export interface ReportRecord {
  report: Report;
  incident: IncidentRecord;
  /** 보고서명 — "{사건명} 상황보고서" */
  title: string;
}

/** 지금 시계까지 생성된 사건 보고서 전부 — 생성 최신순. 분석 보고서는 여기 서지 않는다(IA §10 · 디지털트윈 소유) */
export function reportRecordsAt(now: Date, overrides: RecordOverrides = {}): ReportRecord[] {
  return incidentRecordsAt(now, overrides)
    .flatMap((incident) => incident.reports.map((report) => ({ report, incident, title: `${incident.title} 상황보고서` })))
    .sort((a, b) => b.report.generatedAt.localeCompare(a.report.generatedAt));
}

/* ── 통계 (IA-06) ───────────────────────────────── */

const minutesBetween = (from: string, to: string) => (new Date(to).getTime() - new Date(from).getTime()) / 60_000;
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/** 모은 값 — 두 쪽 사건이 모두 가진 값으로만 센다(머리 주석) */
export interface RecordStats {
  total: number;
  byStatus: Record<RecordStatus, number>;
  /** 발생 → 첫 대응 평균(분). 대응이 있었던 사건만 */
  responseLeadMin: number | null;
  /** 발생 → 종료 평균(분). 정상 종료한 사건만 */
  durationMin: number | null;
  byKind: { key: HazardKind; count: number }[];
  byRegion: { key: string; count: number }[];
}

export function recordStatsOf(records: IncidentRecord[]): RecordStats {
  const count = <K extends string>(pick: (r: IncidentRecord) => K) => {
    const acc = new Map<K, number>();
    for (const r of records) acc.set(pick(r), (acc.get(pick(r)) ?? 0) + 1);
    return [...acc.entries()].map(([key, n]) => ({ key, count: n })).sort((a, b) => b.count - a.count);
  };
  return {
    total: records.length,
    byStatus: Object.fromEntries(RECORD_STATUSES.map((s) => [s, records.filter((r) => r.status === s).length])) as Record<RecordStatus, number>,
    responseLeadMin: mean(records.filter((r) => r.firstResponseAt).map((r) => minutesBetween(r.occurredAt, r.firstResponseAt!))),
    durationMin: mean(records.filter((r) => r.status === "종료" && r.closedAt).map((r) => minutesBetween(r.occurredAt, r.closedAt!))),
    byKind: count((r) => r.hazardKind),
    byRegion: count((r) => r.region),
  };
}

/** 지역별 비교 줄 — 사건 수가 많은 지역이 위 */
export interface RegionStat {
  region: string;
  count: number;
  active: number;
  /** 발생 → 첫 대응 평균(분). 대응이 있었던 사건만 */
  responseLeadMin: number | null;
  /** 발생 → 종료 평균(분). 정상 종료한 사건만 */
  durationMin: number | null;
  kinds: HazardKind[];
}

export function regionStatsOf(records: IncidentRecord[]): RegionStat[] {
  const groups = new Map<string, IncidentRecord[]>();
  for (const r of records) groups.set(r.region, [...(groups.get(r.region) ?? []), r]);
  return [...groups.entries()]
    .map(([region, list]) => ({
      region,
      count: list.length,
      active: list.filter((r) => r.status === "진행 중").length,
      responseLeadMin: mean(list.filter((r) => r.firstResponseAt).map((r) => minutesBetween(r.occurredAt, r.firstResponseAt!))),
      durationMin: mean(list.filter((r) => r.status === "종료" && r.closedAt).map((r) => minutesBetween(r.occurredAt, r.closedAt!))),
      kinds: [...new Set(list.map((r) => r.hazardKind))],
    }))
    .sort((a, b) => b.count - a.count || a.region.localeCompare(b.region));
}

/* ── 사건 기록 (이력 사건 기록 창 · IA §10.1 · 2026-09-16) ──────
 * 사건 기록 창의 여섯 절 중 ①~④ 의 재료다. ⑤ 예측 검증은 selectors.predictionCasesAt, ⑥ 경과는 incidentTimelineAt 이 든다.
 * 원장에서 모으기만 하고 새 값을 만들지 않는다. 원장이 없는 지난 사건은 당시 상태 값 · 예측판 · 실제 대응만 안다.
 */

export interface DossierForecast {
  /** 예측판이 들어온 시각 */
  at: string;
  baseTime: string;
  model: string;
  /** 첫 영향 도달 시각 */
  arrivalAt: string;
  /** 보일 눈금 — "18:00 최대 0.32 m" */
  peak: string;
  /** 그 눈금의 이름 — 검증한 전망인가, 가장 큰 영향인가 */
  peakLabel: string;
  impact: string;
  targets: string[];
  /** 이 예측이 실제와 어땠나 — 예측 케이스가 확정됐을 때만(§13.1). 도달·최대값 같은 머리 줄 */
  check: CaseRow[];
}

export interface IncidentDossier {
  /** ① 무엇이었나 */
  summary: { label: string; value: string }[];
  /** 결과 한 줄 — 원장의 결과 기록·종료 판단 */
  outcome: string | null;
  /** ② 왜 사건이 되었나 — 사건을 만든 알림 */
  alerts: { at: string; title: string; grade: string; reason: string }[];
  /** 근거 관측 — 사건 생성이 딛고 선 원천 이벤트, 지난 사건은 당시 상태 값 */
  evidence: { at: string; kind: string; label: string }[];
  /** 근거가 된 예측판 — 원장 사건 */
  forecast: DossierForecast | null;
  /** 당시 예측 기록 줄 — 예측판 객체가 없는 지난 사건 */
  forecastNotes: { at: string; label: string }[];
  /** 실제 기록 값 — 지난 사건의 관측·사후 조사 값(예측 카드의 "실제는") */
  observed: { label: string; value: string }[];
  /** ③ 어떻게 판단했나 */
  assessments: { at: string; grade: RiskGrade; label: string }[];
  /** 가장 높았던 판단의 요약 줄 */
  judgement: string[];
  /** ④ 무엇을 했나 */
  decisions: { at: string; kind: string; actor: string; reason: string }[];
  actions: { key: string; kind: string; target: string; organization: string | null; status: string | null; at: string; detail: string | null }[];
  disseminations: { key: string; channel: string; status: string; at: string; detail: string; fallback: string | null }[];
}

const GRADE_ORDER: RiskGrade[] = ["관심", "주의", "경계", "심각"];

/**
 * 근거가 된 예측판 한 장. 보일 눈금은 검증한 그 전망이다(결과 기록이 견준 예측값과 같은 눈금 · selectors.predictionCasesAt 과 같은 규칙).
 * 검증이 없으면 가장 큰 영향 눈금을 쓴다. 알림·승인이 "18:00 전망"을 말하는데 카드가 다른 눈금을 보이면 같은 사건이 두 값을 갖는다.
 */
function forecastOf(forecastId: string | undefined, at: string | undefined, check: CaseRow[], verifiedDepthM?: number): DossierForecast | null {
  const f = forecastId ? findForecast(forecastId) : undefined;
  if (!f) return null;
  const verified = verifiedDepthM !== undefined ? f.marks.find((m) => Math.abs(m.maxDepthM - verifiedDepthM) < 0.005) : undefined;
  const top = verified ?? [...f.marks].sort((a, b) => b.maxDepthM - a.maxDepthM || (b.metric?.value ?? 0) - (a.metric?.value ?? 0))[0];
  const peakValue = top ? (top.metric ? `${top.metric.label} ${top.metric.value}${top.metric.unit}` : `최대 ${top.maxDepthM.toFixed(2)} m`) : "";
  return {
    at: at ?? f.basis.generatedAt,
    baseTime: f.basis.baseTime,
    model: `${f.basis.modelName} ${f.basis.modelVersion}`.trim(),
    arrivalAt: f.arrivalAt,
    peak: top ? `${formatClock(top.validAt)} ${peakValue}` : "",
    peakLabel: verified ? "검증한 전망" : "가장 큰 영향",
    impact: top?.impactSummary ?? "",
    targets: f.targets.map((t) => t.label),
    check,
  };
}

export function incidentDossierAt(record: IncidentRecord, now: Date, all: IncidentRecord[]): IncidentDossier {
  const period = record.closedAt ? formatElapsed(record.occurredAt, record.closedAt) : "진행 중";

  if (!record.hasLedger) {
    const c = WHATIF_CASES.find((w) => w.incidentId === record.incidentId);
    const entries = c ? pastEntries(c, now) : [];
    const pick = (kind: RecordEntry["kind"]) => entries.filter((e) => e.kind === kind);
    return {
      summary: [
        { label: "사건 번호", value: record.incidentId },
        { label: "유형", value: record.hazardKind },
        { label: "범위", value: record.scopeLabel },
        { label: "발생", value: stampOf(record.occurredAt) },
        { label: "종료", value: record.closedAt ? stampOf(record.closedAt) : "진행 중" },
        { label: "지속", value: period },
      ],
      /* 영향 기록 줄이 곧 결과다 — "침수 12동 · 차량 3대 고립" */
      outcome: pick("영향").map((e) => e.label).join(" · ") || null,
      alerts: [],
      evidence: pick("관측").map((e) => ({ at: e.at, kind: "관측", label: e.label })),
      forecast: null,
      forecastNotes: pick("예측").map((e) => ({ at: e.at, label: e.label })),
      /* 실제 기록(관측·사후 조사 값) — 예측 카드의 "실제는" 자리. 예측값과 짝지은 오차는 원장이 없어 세우지 않는다 */
      observed: c?.observed ?? [],
      assessments: [],
      judgement: [],
      decisions: [],
      actions: pick("대응").map((e, i) => ({ key: `r${i}`, kind: "조치", target: e.label, organization: null, status: null, at: e.at, detail: null })),
      disseminations: [],
    };
  }

  const view = incidentViewAt(record.incidentId, now);
  const events = view?.events ?? [];
  const created = events.find((e) => e.eventType === "INCIDENT_CREATED");
  const assessments = events
    .filter((e) => e.eventType === "ASSESSMENT_UPDATED")
    .map((e) => ({ at: e.observedAt, grade: (e.payload as HazardAssessment).matrix.grade, label: e.summary, payload: e.payload as HazardAssessment }));
  const peak = [...assessments].sort((a, b) => GRADE_ORDER.indexOf(b.grade) - GRADE_ORDER.indexOf(a.grade) || a.at.localeCompare(b.at))[0];
  const outcome = [...events].reverse().find((e) => e.eventType === "OUTCOME_RECORDED");
  const closing = allDecisions(events).reverse().find((d) => d.payload.kind === "종료 판단");
  const merged = all.filter((r) => r.mergedInto === record.incidentId).map((r) => r.title);
  const caseRows = predictionCasesAt(record.incidentId, now)[0]?.rows ?? [];
  const verification = outcomesAt(record.incidentId, now).at(-1)?.verification;
  const baseline = forecastsOf(record.incidentId, now).find((f) => f.alternativeId === "baseline");
  const baselineAt = baseline?.sourceEventId ? findEvent(baseline.sourceEventId)?.observedAt : undefined;
  const incident = view!.incident;

  return {
    summary: [
      { label: "사건 번호", value: record.incidentId },
      { label: "유형", value: record.hazardKind },
      { label: "범위", value: `${incident.scope.label} (${incident.scopeKind})` },
      { label: "최초 징후", value: view?.firstObservedAt ? stampOf(view.firstObservedAt) : "-" },
      { label: "사건 생성", value: stampOf(record.occurredAt) },
      { label: "종료", value: record.closedAt ? `${stampOf(record.closedAt)} · ${period}` : "진행 중" },
      { label: "최고 위험", value: peak ? `${peak.grade} · ${peak.payload.matrix.score.toFixed(2)}` : "-" },
      { label: "담당 · 승인", value: [incident.ownership.officer, incident.ownership.approver].filter(Boolean).join(" · ") + ` (${incident.ownership.organization})` },
      ...(merged.length ? [{ label: "병합된 사건", value: merged.join(" · ") }] : []),
    ],
    outcome: [outcome?.summary.replace(/^사건 결과 기록 · /, ""), closing?.payload.reason].filter(Boolean).join(" · ") || null,
    alerts: (view?.sourceAlerts ?? [])
      .map((a) => ({ at: a.createdAt, title: a.title, grade: a.grade, reason: a.reason }))
      .sort((a, b) => a.at.localeCompare(b.at)),
    evidence: (created?.derivedFrom ?? [])
      .map(findEvent)
      .filter((e): e is EventEnvelope => Boolean(e))
      .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
      .map((e) => ({ at: e.observedAt, kind: evidenceKindOf(e), label: e.summary })),
    forecast: forecastOf(baseline?.forecastId, baselineAt, caseRows.slice(0, 2), verification?.available ? verification.predictedDepthM : undefined),
    forecastNotes: [],
    observed: [],
    assessments: assessments.map(({ at, grade, label }) => ({ at, grade, label })),
    judgement: peak?.payload.narrative ?? [],
    decisions: allDecisions(events).map((e) => ({
      at: e.observedAt,
      kind: e.payload.level ? `${e.payload.kind} · ${e.payload.level}` : e.payload.kind,
      actor: e.payload.approver,
      reason: e.payload.reason,
    })),
    actions: actionsAt(record.incidentId, now).map((a) => ({
      key: a.actionId, kind: a.kind, target: a.target, organization: `${a.organization} · ${a.assignee}`, status: a.status, at: a.updatedAt, detail: a.detail,
    })),
    disseminations: disseminationsAt(record.incidentId, now).flatMap((d) =>
      d.results.map((r, i) => ({
        key: `${d.disseminationId}-${i}`, channel: r.channel, status: r.status, at: r.at, detail: r.detail,
        fallback: r.fallback ? `${r.fallback.channel} · ${r.fallback.detail}` : null,
      })),
    ),
  };
}

function allDecisions(events: EventEnvelope[]): EventEnvelope<Decision>[] {
  return events.filter((e) => e.eventType === "DECISION_RECORDED") as EventEnvelope<Decision>[];
}
/** 기록 일시 — "2024-09-21 17:14" */
const stampOf = (iso: string) => `${formatDate(iso)} ${formatClock(iso)}`;

/** 지난 사건의 기록 줄 — 지금 시계까지만 */
function pastEntries(c: WhatIfCase, now: Date): RecordEntry[] {
  return (c.record ?? []).filter((r) => new Date(r.at) <= now);
}
