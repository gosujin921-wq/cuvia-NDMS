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
export { CCTV_CHANNELS, GEOMETRIES, SUBJECT_LOCATION, SUBJECTS, SCOPE_ZOOM, deviceOfSubject, facilityOfSubject, isFacilitySubject, isSensorSubject, type CctvChannel } from "./seohang-flood/subjects";
export { ALTERNATIVE_FORECAST_IDS } from "./seohang-flood/workflow";
export { ALERTS } from "./seohang-flood/alerts";
export { ALERT_RULES, RISK_MATRIX_SPEC } from "./seohang-flood/rules";
export { type SopCatalogItem, type SopBinding } from "./seohang-flood/sop";
import { SOP_CATALOG as SEOHANG_SOP } from "./seohang-flood/sop";

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

export const INCIDENTS: Incident[] = [INCIDENT, MERGED_INCIDENT, FALSE_INCIDENT];

const CLASS_ORDER = { 원천: 0, 파생: 1, 분석: 2, 업무: 3 } as const;
/** 이벤트 원장 — 관측시각 오름차순. 같은 시각이면 원천 → 파생 → 분석 → 업무 */
export const EVENTS: EventEnvelope[] = [...SOURCE_EVENTS, ...FORECAST_EVENTS, ...WORKFLOW_EVENTS, ...EXCEPTION_EVENTS].sort(
  (a, b) => a.observedAt.localeCompare(b.observedAt) || CLASS_ORDER[a.eventClass] - CLASS_ORDER[b.eventClass],
);

export const ALL_FORECASTS: Forecast[] = FORECASTS;
export const DEMO_TICKS_BY_INCIDENT: Record<string, DemoTick[]> = { [INCIDENT_ID]: DEMO_TICKS };
/** 사건별 SOP 카탈로그 — 권고가 만드는 항목 목록. 카탈로그가 없는 사건(예외 경로 검증용)은 SOP 가 없다 */
export const SOP_CATALOG_BY_INCIDENT: Record<string, SopCatalogItem[]> = { [INCIDENT_ID]: SEOHANG_SOP };
export const HERO_INCIDENT_ID = INCIDENT_ID;
export const MAP_HOME: [number, number] = SEOHANG_CENTER;
