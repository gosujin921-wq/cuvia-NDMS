/* ─────────────────────────────────────────────
 * fixture 레지스트리 — 화면이 이벤트·사건·Forecast·알림·규칙을 얻는 유일한 입구
 *
 * 화면은 여기 배열을 직접 뒤지지 않는다. model/selectors.ts 의 파생 함수를 통해 현재 시계로 자른 값을
 * 읽는다. 실서버로 갈 때 이 파일과 adapters/ 만 바뀐다.
 * 예외 경로 검증용 사건 두 건(병합됨 · 오탐)은 IA §5.2 라우트 예외 처리를 확인하려고 둔다.
 * ───────────────────────────────────────────── */

import type { EventEnvelope } from "../model/event";
import type { Forecast } from "../model/forecast";
import type { Incident, WorkflowStatus } from "../model/incident";
import type { DemoTick } from "../model/stage";
import type { SopCatalogItem } from "./seohang-flood/sop";
import { INCIDENT, INCIDENT_ID, DEMO_TICKS, t } from "./seohang-flood/incident";
import { SOURCE_EVENTS } from "./seohang-flood/events";
import { FORECASTS, FORECAST_EVENTS } from "./seohang-flood/forecasts";
import { WORKFLOW_EVENTS } from "./seohang-flood/workflow";
import { SEOHANG_CENTER } from "./seohang-flood/subjects";

export { INCIDENT_ID, DEMO_TICKS };
export { SUBJECTS, SCOPE_ZOOM, type CctvChannel } from "./seohang-flood/subjects";
import { CCTV_CHANNELS as SEOHANG_CCTV, GEOMETRIES as SEOHANG_GEOMETRIES, SUBJECT_LOCATION as SEOHANG_LOCATION, deviceOfSubject as seohangDevice, facilityOfSubject as seohangFacility, isFacilitySubject as isSeohangFacility, isSensorSubject as isSeohangSensor, type CctvChannel as CctvChannelT } from "./seohang-flood/subjects";
import type { Device } from "../demo/devices";
import type { Facility } from "../demo/facilities";
import type { SpatialRef } from "../model/event";
import type { AttentionAlert } from "../model/alert";
import { ALERTS as SEOHANG_ALERTS } from "./seohang-flood/alerts";
import { RISK_MATRIX_SPEC as SEOHANG_MATRIX } from "./seohang-flood/rules";
import type { RiskMatrixSpec } from "../model/risk-matrix";
import { BONGAM, BONGAM_GEOMETRIES } from "./districts/bongam";
import { JUNAM } from "./districts/junam";
import { GUHANG } from "./districts/guhang";
import { YANGDEOK, YANGDEOK_GEOMETRIES } from "./districts/yangdeok";
import type { DistrictFixture, SubjectSpec } from "./districts/helpers";

/* ── 구역별 상태 배정 (2026-09-14 결정) — 서항 사건 · 봉암 감시 · 주남 단일 심각 · 구항 결측 · 양덕 평시 · 팔용 오탐 ── */
export const DISTRICT_FIXTURES: DistrictFixture[] = [BONGAM, JUNAM, GUHANG, YANGDEOK];
const DISTRICT_SUBJECTS: Record<string, SubjectSpec> = Object.assign({}, ...DISTRICT_FIXTURES.map((d) => d.subjects));

export const SUBJECT_LOCATION: Record<string, SpatialRef> = { ...SEOHANG_LOCATION, ...Object.fromEntries(Object.entries(DISTRICT_SUBJECTS).map(([id, s]) => [id, s.loc])) };
export const GEOMETRIES: Record<string, [number, number][]> = { ...SEOHANG_GEOMETRIES, ...BONGAM_GEOMETRIES, ...YANGDEOK_GEOMETRIES, ...TRAINING_GEOMETRIES };
export const CCTV_CHANNELS: CctvChannelT[] = [...SEOHANG_CCTV, ...DISTRICT_FIXTURES.flatMap((d) => d.cctv)];
export const ALERTS: AttentionAlert[] = [...SEOHANG_ALERTS, ...DISTRICT_FIXTURES.flatMap((d) => d.alerts)];

/** 주체 → Phase 1 핀 부품 모양. 서항은 자체 어댑터, 다른 구역은 SubjectSpec 에서 */
export function isSensorSubject(id: string): boolean {
  return isSeohangSensor(id) || Boolean(DISTRICT_SUBJECTS[id]?.kind);
}
export function isFacilitySubject(id: string): boolean {
  return isSeohangFacility(id) || Boolean(DISTRICT_SUBJECTS[id]?.facility);
}
export function deviceOfSubject(id: string, districtId: string): Device {
  if (isSeohangSensor(id)) return seohangDevice(id, districtId);
  const s = DISTRICT_SUBJECTS[id];
  return { id, districtId, kind: s.kind ?? "WL", name: s.loc.label, spot: s.spot, address: s.address, center: s.loc.displayAnchor, status: "정상" };
}
export function facilityOfSubject(id: string, districtId: string): Facility {
  if (isSeohangFacility(id)) return seohangFacility(id, districtId);
  const s = DISTRICT_SUBJECTS[id];
  return { id, districtId, kind: s.facility ?? "pump", name: s.loc.label, spot: s.spot, center: s.loc.displayAnchor, deviceSpot: s.spot };
}
export { ALTERNATIVE_FORECAST_IDS } from "./seohang-flood/workflow";
export { ALERT_RULES, RISK_MATRIX_SPEC } from "./seohang-flood/rules";
export { type SopCatalogItem, type SopBinding } from "./seohang-flood/sop";
import { SOP_CATALOG as SEOHANG_SOP } from "./seohang-flood/sop";
import { CONDITION_FORECASTS, TRAINING_CONDITION_SETS, TRAINING_GEOMETRIES, TRAINING_REGIONS } from "./training";

const MERGED_ID = "INC-2024-0921-SH02";
const FALSE_ID = "INC-2024-0921-SH03";

const MERGED_INCIDENT: Incident = { ...INCIDENT, incidentId: MERGED_ID, title: "해안도로 도로수위 단독 알람 (중복 후보)", scope: { kind: "지점", displayAnchor: [128.5661, 35.1963], label: "해안도로 저지대 도로수위계" }, scopeKind: "지점", correlationKeys: ["RW-SH-07"] };
const FALSE_INCIDENT: Incident = { ...INCIDENT, incidentId: FALSE_ID, title: "팔용 배수구역 수위 시험 알람", scope: { kind: "지점", displayAnchor: [128.627, 35.24], label: "팔용 배수구역 시험 수위계" }, scopeKind: "지점", correlationKeys: ["WL-PY-TEST"], legacyDistrictId: "paryong" };

function sys(id: string, incidentId: string, type: EventEnvelope["eventType"], at: string, summary: string, payload: unknown, references: string[] = []): EventEnvelope {
  return { eventId: id, sourceSystem: "CUVIA", eventType: type, eventClass: "업무", producerRole: "담당자", subjectId: incidentId, observedAt: at, receivedAt: at, quality: "정상", sourceReadiness: "내부 생성", dataOrigin: "사용자 입력", payload, schemaVersion: "ndms.event/0.1", incidentId, references, actor: "김상황", ingestionMode: "수동", scenario: { scenarioRuleId: "SCN-SH-FLOOD", scenarioRuleVersion: "0.1.0", generatedAt: "2026-09-11T14:00:00+09:00", scenarioTime: at }, summary };
}

const EXCEPTION_EVENTS: EventEnvelope[] = [
  sys("EV-X-01", MERGED_ID, "INCIDENT_CREATED", t("17:23"), "도로수위 단독 알람으로 후보 생성", { initialStatus: "후보" as WorkflowStatus, ruleId: "RULE-CANDIDATE-SINGLE", ruleVersion: "0.1", reasons: ["도로수위 경계 기준 진입"] }),
  sys("EV-X-02", MERGED_ID, "INCIDENT_RELATION_CHANGED", t("17:28"), `병합 → ${INCIDENT_ID}`, { fromIncidentId: MERGED_ID, toIncidentId: INCIDENT_ID, kind: "병합", reason: "같은 배수권역·시간창·위험현상" }),
  sys("EV-X-03", MERGED_ID, "INCIDENT_STATUS_CHANGED", t("17:28"), "후보 → 병합됨", { from: "후보", to: "병합됨", reason: `기준 사건 ${INCIDENT_ID} 에 흡수`, recordedAt: t("17:28"), mergedInto: INCIDENT_ID }, ["EV-X-02"]),
  sys("EV-X-04", FALSE_ID, "INCIDENT_CREATED", t("16:20"), "시험 수위계 임계치 통과로 후보 생성", { initialStatus: "후보" as WorkflowStatus, ruleId: "RULE-CANDIDATE-THRESHOLD", ruleVersion: "0.1", reasons: ["심각 임계치 통과"] }),
  sys("EV-X-05", FALSE_ID, "INCIDENT_STATUS_CHANGED", t("16:35"), "후보 → 오탐", { from: "후보", to: "오탐", reason: "점검용 시험 데이터 · 원천 이벤트 보존", recordedAt: t("16:35") }),
];

export const INCIDENTS: Incident[] = [INCIDENT, MERGED_INCIDENT, FALSE_INCIDENT, ...DISTRICT_FIXTURES.map((d) => d.incident)];

const CLASS_ORDER = { 원천: 0, 파생: 1, 분석: 2, 업무: 3 } as const;
/** 이벤트 원장 — 관측시각 오름차순. 같은 시각이면 원천 → 파생 → 분석 → 업무 */
export const EVENTS: EventEnvelope[] = [...SOURCE_EVENTS, ...FORECAST_EVENTS, ...WORKFLOW_EVENTS, ...EXCEPTION_EVENTS, ...DISTRICT_FIXTURES.flatMap((d) => d.events)].sort(
  (a, b) => a.observedAt.localeCompare(b.observedAt) || CLASS_ORDER[a.eventClass] - CLASS_ORDER[b.eventClass],
);

export const ALL_FORECASTS: Forecast[] = [...FORECASTS, ...CONDITION_FORECASTS];
export { TRAINING_CONDITION_SETS, TRAINING_REGIONS };
export const DEMO_TICKS_BY_INCIDENT: Record<string, DemoTick[]> = { [INCIDENT_ID]: DEMO_TICKS };
/** 사건별 SOP 카탈로그 — 권고가 만드는 항목 목록. 카탈로그가 없는 사건(예외 경로 검증용)은 SOP 가 없다 */
export const SOP_CATALOG_BY_INCIDENT: Record<string, SopCatalogItem[]> = { [INCIDENT_ID]: SEOHANG_SOP };
export const HERO_INCIDENT_ID = INCIDENT_ID;
export const MAP_HOME: [number, number] = SEOHANG_CENTER;

/** 위험도 매트릭스 스펙 — 결과의 ruleId 로 찾는다. 등급 문턱(띠)과 구간 기준(툴팁)의 정본 */
export const RISK_MATRIX_SPECS: Record<string, RiskMatrixSpec> = { [SEOHANG_MATRIX.ruleId]: SEOHANG_MATRIX };
