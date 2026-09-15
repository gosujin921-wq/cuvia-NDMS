/* ─────────────────────────────────────────────
 * 구역 fixture 공통 — 서항 이외 지구의 주체·관측 이벤트·알림을 같은 이벤트 계약으로 만든다
 *
 * 대표 사건(서항)과 같은 시나리오 날짜·규칙을 쓴다. 값은 시나리오 편집값이며 실제 계측·운영 임계치가 아니다(02 §5.5).
 * 구역마다 보여줄 상태가 다르다(2026-09-14 결정):
 *   서항   사건 진행(D1~D8) · D0 사전 감시 알림     seohang-flood/
 *   봉암   감시 우선구역(사전 감시 알림)만 · 사건 없음   bongam.ts
 *   주남   단일 심각 알림 · 담당자 확인 대기          junam.ts
 *   구항   수위계 결측 · 품질·대체 확인 알림          guhang.ts
 *   양덕   평시 지구 현황 · 관측만                   yangdeok.ts
 *   팔용   오탐 사건(기록)                          fixtures/index.ts 예외 사건
 * ───────────────────────────────────────────── */

import type { DataQuality, EventEnvelope, EventType, SpatialRef } from "../../model/event";
import type { Incident } from "../../model/incident";
import type { AttentionAlert } from "../../model/alert";
import type { Device } from "../../demo/devices";
import type { Facility } from "../../demo/facilities";
import type { CctvChannel } from "../seohang-flood/subjects";
import { FIXTURE_GENERATED_AT, SCENARIO_RULE, t } from "../seohang-flood/incident";

export { t };

/** 주체 한 개 — 위치와 Phase 1 핀 부품이 받는 모양 */
export interface SubjectSpec {
  loc: SpatialRef;
  /** 센서·CCTV 종류. 시설이면 비운다 */
  kind?: Device["kind"];
  facility?: Facility["kind"];
  spot: string;
  address: string;
}

export interface DistrictFixture {
  districtId: string;
  /** 사건이 생기기 전의 정적 정의 — 지도 범위·주체·카메라의 기준. INCIDENT_CREATED 가 없으면 사건이 아니다 */
  incident: Incident;
  subjects: Record<string, SubjectSpec>;
  events: EventEnvelope[];
  alerts: AttentionAlert[];
  cctv: CctvChannel[];
}

export function districtEvent<P>(subjects: Record<string, SubjectSpec>, keys: string[], args: {
  id: string; type: EventType; eventClass: EventEnvelope["eventClass"]; producerRole: EventEnvelope["producerRole"]; source: string;
  subject: string; observedAt: string; receivedAt?: string; quality?: DataQuality; demoRef: string; summary: string; payload: P;
  measurement?: { value: number; unit: string }; derivedFrom?: string[]; supersedes?: string; validFrom?: string; validTo?: string;
}): EventEnvelope<P> {
  return {
    eventId: args.id, sourceSystem: args.source, eventType: args.type, eventClass: args.eventClass, producerRole: args.producerRole,
    subjectId: args.subject, observedAt: args.observedAt, receivedAt: args.receivedAt ?? args.observedAt, validFrom: args.validFrom, validTo: args.validTo,
    location: subjects[args.subject]?.loc, measurement: args.measurement, quality: args.quality ?? "정상",
    sourceReadiness: args.eventClass === "파생" ? "내부 생성" : "연계 가능", dataOrigin: "합성 데이터", ingestionMode: "모의",
    payload: args.payload, schemaVersion: "ndms.event/0.1", correlationKeys: [...keys, args.subject], supersedes: args.supersedes, derivedFrom: args.derivedFrom,
    scenario: { scenarioRuleId: SCENARIO_RULE.id, scenarioRuleVersion: SCENARIO_RULE.version, generatedAt: FIXTURE_GENERATED_AT, scenarioTime: args.observedAt },
    demoRef: args.demoRef, summary: args.summary,
  };
}

/** 관측 시계열 → OBSERVATION_RECORDED 낱개. [시각, 값, 품질?] */
export function districtSeries(subjects: Record<string, SubjectSpec>, keys: string[], args: {
  prefix: string; subject: string; source: string; unit: string; label: string; demoRef: string; rows: [string, number, DataQuality?][];
}): EventEnvelope<{ label: string }>[] {
  return args.rows.map(([hhmm, value, quality], i) =>
    districtEvent(subjects, keys, {
      id: `${args.prefix}-${String(i + 1).padStart(2, "0")}`, type: "OBSERVATION_RECORDED", eventClass: "원천", producerRole: "장비",
      source: args.source, subject: args.subject, observedAt: t(hhmm), quality, demoRef: args.demoRef,
      summary: `${args.label} ${value} ${args.unit}`, measurement: { value, unit: args.unit }, payload: { label: args.label },
    }),
  );
}

export function districtIncident(args: { incidentId: string; title: string; hazardKind: Incident["hazardKind"]; twinFamily: Incident["twinFamily"]; scope: SpatialRef; keys: string[]; districtId: string; organization: string; officer: string }): Incident {
  return {
    incidentId: args.incidentId, title: args.title, hazardKind: args.hazardKind, twinFamily: args.twinFamily, scopeKind: args.scope.kind, scope: args.scope,
    correlationKeys: args.keys, ownership: { organization: args.organization, officer: args.officer, approver: "박실장", handover: "담당" },
    scenarioContext: { scenarioBaseTime: t("17:00"), scenarioMode: "혼합 데모", demoWindow: { from: t("16:00"), to: t("21:30") } },
    legacyDistrictId: args.districtId,
  };
}
