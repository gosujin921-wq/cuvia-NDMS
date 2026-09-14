/* ─────────────────────────────────────────────
 * CUVIA 내부 생성 이벤트 — D1~D8 의 업무·분석 기록
 * 정본: 02 §5.2 · §7, 01 §7.4 · §8.2 · §6.2, IA §13.1
 *
 * 상태 전환은 여기 기록된 INCIDENT_STATUS_CHANGED 가 전부다. 사건 객체에 상태 필드가 없고 화면은
 * 현재 시계까지의 마지막 전환을 읽는다. D2 의 [확인] 버튼은 상태를 쓰지 않고 시계를 그 전환 시각 너머로
 * 옮긴다 — 엔진이 전이를 소유한다(CLAUDE.md). 등록과 검토 인수는 구분한다(01 §7.4).
 * D3 의 위험판단은 매트릭스 결과(rules.ts RM-FLOOD 데모 설정값)를 payload 에 든다 — 4축은 그 설명이다.
 * ───────────────────────────────────────────── */

import type { EventClass, EventEnvelope, EventType, ProducerRole } from "../../model/event";
import type { HazardAssessment, StatusChange, WorkflowStatus } from "../../model/incident";
import type { Action, ActionStatus, CapMessage, Decision, Dissemination, DisseminationResult, Outcome, Recommendation, Report } from "../../model/response";
import { DRAINAGE_BASIN_ID, SUBJECTS } from "./subjects";
import { FIXTURE_GENERATED_AT, INCIDENT_ID, SCENARIO_RULE, t } from "./incident";
import { FORECAST_BASE_ID, FORECAST_DRAIN_ID, FORECAST_ROAD_ID } from "./forecasts";

const OFFICER = "김상황";
const APPROVER = "박실장";

function work<P>(args: { id: string; type: EventType; eventClass?: EventClass; producerRole?: ProducerRole; at: string; actor: string; subject?: string; summary: string; payload: P; references?: string[]; derivedFrom?: string[] }): EventEnvelope<P> {
  return {
    eventId: args.id, sourceSystem: "CUVIA", eventType: args.type, eventClass: args.eventClass ?? "업무", producerRole: args.producerRole ?? "담당자",
    subjectId: args.subject ?? INCIDENT_ID, observedAt: args.at, receivedAt: args.at, quality: "정상", sourceReadiness: "내부 생성", dataOrigin: "사용자 입력",
    payload: args.payload, schemaVersion: "ndms.event/0.1", correlationKeys: [DRAINAGE_BASIN_ID], incidentId: INCIDENT_ID,
    derivedFrom: args.derivedFrom, references: args.references, actor: args.actor, ingestionMode: "수동",
    scenario: { scenarioRuleId: SCENARIO_RULE.id, scenarioRuleVersion: SCENARIO_RULE.version, generatedAt: FIXTURE_GENERATED_AT, scenarioTime: args.at },
    summary: args.summary,
  };
}

function statusChange(id: string, at: string, from: WorkflowStatus, to: WorkflowStatus, reason: string, references: string[] = []): EventEnvelope<StatusChange> {
  return work<StatusChange>({ id, type: "INCIDENT_STATUS_CHANGED", at, actor: OFFICER, summary: `${from} → ${to}`, payload: { from, to, reason, recordedAt: at }, references });
}

/* D1 후보 생성 — 복합 징후 알림 AL-02 가 후보 기준 충족 */
export const W_CREATED = work({
  id: "EV-W-01", type: "INCIDENT_CREATED", producerRole: "CUVIA 규칙", at: t("17:14"), actor: "CUVIA 규칙",
  summary: "복합 징후 알림으로 사건 후보 생성", derivedFrom: ["EV-E4B-01", "EV-E8-01", "EV-E5A-03", "EV-E6A-01"],
  payload: {
    initialStatus: "후보" as WorkflowStatus, ruleId: "AR-COMPOSITE", ruleVersion: "0.1", sourceAlertIds: ["AL-02", "AL-04"],
    reasons: ["공간: 같은 배수권역(BASIN-SH-01)의 관로·도로수위계", "시간: 17:00~17:14 동일 시간창", "의미: 관로 급상승 뒤 도로수위 동반 상승은 내수침수 징후", "예측: 침수예측판이 후보 영향 기준(도로 도달 60분 이내)을 초과"],
  },
});

/* D2 교차확인 — 영상 확인 요청 → 검토 인수 → 확인 */
export const W_REVIEW = work({
  id: "EV-W-02", type: "REVIEW_REQUESTED", producerRole: "시스템", at: t("17:25"), actor: "CUVIA", subject: SUBJECTS.cctvPump,
  summary: "VLM 물고임 영상 확인 요청", references: ["EV-E7-01"],
  payload: { reviewId: "RV-01", targetEventId: "EV-E7-01", reason: "차로 침수 추정 0.82 · 실제 영상 확인 필요", assignee: OFFICER, status: "요청", alertId: "AL-03" },
});
export const W_STATUS_REVIEWING = statusChange("EV-W-03", t("17:26"), "후보", "확인중", "담당자가 후보 검토를 인수", ["EV-W-01"]);
export const W_DECISION_CONFIRM = work<Decision>({
  id: "EV-W-04", type: "DECISION_RECORDED", at: t("17:30"), actor: OFFICER, summary: "사건 확인 · 실제 대응 사건으로 판단",
  references: ["EV-E7-01", "EV-E5B-01", "EV-E3B-03", "EV-E6A-01"],
  payload: { decisionId: "DC-01", incidentId: INCIDENT_ID, kind: "사건 확인", status: "승인", references: ["EV-E7-01", "EV-E5B-01", "EV-E3B-03", "EV-E6A-01"], approver: OFFICER, recordedAt: t("17:30"), reason: "관로·도로 상승과 영상 물고임이 일치. 조위 상승과 펌프 가용 저하로 자연배수 불리" },
});
export const W_STATUS_CONFIRMED = statusChange("EV-W-05", t("17:30"), "확인중", "확인됨", "영상·계측·시설 근거로 실제 대응 사건 확인", ["EV-W-04"]);

/* D3 현재 판단 — 매트릭스 결과 + 4축 설명 */
export const W_ASSESSMENT = work<HazardAssessment>({
  id: "EV-W-06", type: "ASSESSMENT_UPDATED", eventClass: "분석", producerRole: "CUVIA 규칙", at: t("17:33"), actor: "CUVIA 규칙",
  summary: "위험도 매트릭스 갱신 · 경계 0.77 · 심각도 높음 · 긴급도 즉시 · 확실성 높음 · 추세 악화",
  derivedFrom: ["EV-E0-06", "EV-E4A-10", "EV-E5A-07", "EV-E3B-03", "EV-E6A-01", "EV-E6B-01", "EV-E7-01", "EV-E8-01", "EV-E10-01"],
  payload: {
    matrix: {
      ruleId: "RM-FLOOD", ruleVersion: "0.1", computedAt: t("17:33"), score: 0.77, grade: "경계",
      contributions: [
        { indicator: "수위·변화율", band: "급상승·기준 진입", bandScore: 0.85, weight: 0.3, contribution: 0.255, evidenceEventIds: ["EV-E4B-01", "EV-E5B-01", "EV-E4A-10"], degraded: false },
        { indicator: "강우·공식 상황", band: "경보", bandScore: 0.8, weight: 0.2, contribution: 0.16, evidenceEventIds: ["EV-E1-01", "EV-E2-02"], degraded: true },
        { indicator: "영상·현장", band: "물고임 추정", bandScore: 0.6, weight: 0.15, contribution: 0.09, evidenceEventIds: ["EV-E7-01"], degraded: false },
        { indicator: "시설·배수 여건", band: "제약", bandScore: 0.6, weight: 0.15, contribution: 0.09, evidenceEventIds: ["EV-E6A-01", "EV-E3B-03"], degraded: false },
        { indicator: "디지털트윈 예측", band: "통행 불가·시설 영향", bandScore: 1, weight: 0.15, contribution: 0.15, evidenceEventIds: ["EV-E8-01"], degraded: false },
        { indicator: "품질", band: "일부 지연", bandScore: 0.5, weight: 0.05, contribution: 0.025, evidenceEventIds: ["EV-E10-01"], degraded: true },
      ],
    },
    severity: "높음", urgency: "즉시", certainty: "높음", trend: "악화",
    riskFactors: ["강우 지속 (18시 이후 정점 전망)", "관로수위 2.2 m 상승 지속", "조위 상승 · 만조 18:24", "펌프 2호기 정지 · 가용 2/3"],
    mitigatingFactors: ["도로수위 아직 12 cm", "저류시설 여유 62 %", "펌프 1·3호기 정상"],
    counterEvidence: ["배수관리용 폴 CCTV(CV-SH-02)는 아직 물고임 미확인"],
    uncertainties: ["강우계 지연 구간(17:16~17:34) 동안 강우 추세 미확인 · 예측강우로 대체", "침수예측판은 시나리오 결과 세트 · 불확실성 보통"],
    missingData: ["지하차도 수위계 없음", "펌프 2호기 복구 예상시각"],
    evidenceEventIds: ["EV-E0-06", "EV-E4A-10", "EV-E3B-03", "EV-E6A-01", "EV-E6B-01", "EV-E7-01", "EV-E8-01"],
  },
});

/* D6 영향 기반 대응 — 권고 → 승인 → 조치 배정 → 전파 요청 → 대응중 */
export const W_RECOMMENDATION = work<Recommendation>({
  id: "EV-W-07", type: "RECOMMENDATION_UPDATED", eventClass: "분석", producerRole: "CUVIA 규칙", at: t("17:44"), actor: "CUVIA 규칙",
  summary: "취약도로 선제 통제 권고 · 18:00 전망 · 도로 통제 기준", derivedFrom: ["EV-W-06", "EV-E8-01"],
  payload: {
    recommendationId: "RC-01", incidentId: INCIDENT_ID, status: "제안", proposedLevel: "통제",
    basis: { forecastId: FORECAST_BASE_ID, validAt: t("18:00"), alternativeId: "road-control" },
    reasons: ["18:00 해안도로 통행 불가 전망 (최대 0.32 m)", "17:52 도달 예상 · 통제 완료까지 남은 시간 8분 미만", "지하차도 진입부 유입 전망"],
    counterReasons: ["도로수위 현재 17 cm · 통행 가능 수준", "펌프 2호기 복구 시 침수심 0.22 m 로 감소 전망"],
    proposedActions: [
      { kind: "도로 통제", target: "해안도로 저지대 구간", organization: "교통과", summary: "17:50 이전 양방향 통제 · 우회 안내" },
      { kind: "시설 점검", target: "제2배수펌프장 2호기", organization: "하수과", summary: "전기 계통 점검 · 재가동" },
      { kind: "현장 확인", target: "신포 지하차도", organization: "안전총괄과", summary: "진입부 유입 여부 확인 · 필요 시 진입 통제" },
    ],
    producer: "RULE-RECOMMEND-FLOOD 0.1",
  },
});
export const W_DECISION_APPROVE = work<Decision>({
  id: "EV-W-08", type: "DECISION_RECORDED", at: t("17:46"), actor: APPROVER, summary: "대응안 승인 · 통제", references: ["EV-W-07", "EV-E8-01"],
  payload: { decisionId: "DC-02", incidentId: INCIDENT_ID, kind: "대응 승인", status: "승인", level: "통제", references: ["EV-W-07", "EV-E8-01"], approver: APPROVER, recordedAt: t("17:46"), reason: "18:00 전망 기준 도로 통제 권고 채택. 배수 대응은 펌프 복구 시점 불확실로 병행" },
});

const ACTIONS: Action[] = [
  { actionId: "AC-01", incidentId: INCIDENT_ID, kind: "도로 통제", target: "해안도로 저지대 구간", organization: "교통과", assignee: "교통과 현장반", summary: "양방향 통제 · 우회 안내", decisionId: "DC-02" },
  { actionId: "AC-02", incidentId: INCIDENT_ID, kind: "시설 점검", target: "제2배수펌프장 2호기", organization: "하수과", assignee: "하수과 설비반", summary: "전기 계통 점검 · 재가동", decisionId: "DC-02" },
  { actionId: "AC-03", incidentId: INCIDENT_ID, kind: "현장 확인", target: "신포 지하차도", organization: "안전총괄과", assignee: "안전총괄과 순찰반", summary: "진입부 유입 확인", decisionId: "DC-02" },
];
export const W_ACTIONS_ASSIGNED = ACTIONS.map((a, i) => work<Action>({ id: `EV-W-09-${i + 1}`, type: "ACTION_ASSIGNED", at: t("17:46"), actor: APPROVER, subject: a.target, summary: `${a.kind} 배정 · ${a.target} · ${a.organization}`, references: ["EV-W-08"], payload: a }));

const CAP: CapMessage = {
  identifier: "CUVIA-CW-20240921-0001", sender: "changwon.safety@cuvia", sent: t("17:47"), msgType: "Alert", severity: "Severe", urgency: "Immediate", certainty: "Likely",
  areaDesc: "마산합포구 신포동 해안도로 저지대 및 인접 지역", headline: "해안도로 저지대 침수 예상 · 통행 통제",
  description: "18시경 해안도로 저지대 구간 침수가 예상되어 양방향 통행을 통제합니다.",
  instruction: "해안도로 및 신포 지하차도 이용을 피하고 우회 도로를 이용하십시오. 저지대 건물은 지하 공간 출입을 삼가십시오.",
};
export const W_DISSEMINATION = work<Dissemination>({
  id: "EV-W-10", type: "DISSEMINATION_REQUESTED", at: t("17:47"), actor: APPROVER, summary: "전파 요청 · 알림톡 · 마을방송 · 전광판 · 기관 통보", references: ["EV-W-08"],
  payload: { disseminationId: "DS-01", incidentId: INCIDENT_ID, decisionId: "DC-02", channels: ["알림톡", "마을방송", "전광판", "기관 통보"], recipients: "신포동 주민 알림톡 등록자 · 해안도로 전광판 2기 · 마산합포구청 · 경찰서 교통과", message: CAP },
});
export const W_STATUS_RESPONDING = statusChange("EV-W-11", t("17:47"), "확인됨", "대응중", "대응안 승인 · 도로 통제와 전파 시작", ["EV-W-08", "EV-W-10"]);

/* D7 실행 결과 — 채널별 결과, 한 채널 실패와 대체조치, 조치 결과, 통제 전환 */
function dissResult(id: string, at: string, r: DisseminationResult): EventEnvelope<DisseminationResult> {
  return work<DisseminationResult>({ id, type: "DISSEMINATION_RESULT_RECORDED", producerRole: "시스템", at, actor: "CUVIA", summary: `${r.channel} ${r.status}${r.fallback ? ` · 대체 ${r.fallback.channel}` : ""}`, references: ["EV-W-10"], payload: r });
}
export const W_DISS_RESULTS = [
  dissResult("EV-W-12-1", t("17:52"), { disseminationId: "DS-01", channel: "알림톡", status: "성공", detail: "1,284명 발송 · 1,201명 수신" }),
  dissResult("EV-W-12-2", t("17:53"), { disseminationId: "DS-01", channel: "전광판", status: "성공", detail: "해안도로 전광판 2기 표출" }),
  dissResult("EV-W-12-3", t("17:55"), { disseminationId: "DS-01", channel: "마을방송", status: "실패", detail: "신포동 방송 장비 응답 없음 (2회 재시도)", fallback: { channel: "유선 연락", actionId: "AC-04", detail: "통장 6명 유선 연락으로 대체" } }),
  dissResult("EV-W-12-4", t("17:58"), { disseminationId: "DS-01", channel: "기관 통보", status: "확인대기", detail: "마산합포구청 접수 · 경찰서 확인 대기" }),
  dissResult("EV-W-12-5", t("18:04"), { disseminationId: "DS-01", channel: "기관 통보", status: "성공", detail: "경찰서 교통과 수신 확인" }),
];
export const W_ACTION_FALLBACK = work<Action>({
  id: "EV-W-13", type: "ACTION_ASSIGNED", at: t("17:56"), actor: OFFICER, subject: "신포동 통장", summary: "대체 조치 배정 · 유선 연락 (마을방송 실패)", references: ["EV-W-12-3"],
  payload: { actionId: "AC-04", incidentId: INCIDENT_ID, kind: "대피 안내", target: "신포동 통장 6명", organization: "재난안전 상황실", assignee: OFFICER, summary: "유선 연락으로 저지대 주민 안내", decisionId: "DC-02" },
});
function actionStatus(id: string, at: string, actionId: string, status: ActionStatus, detail: string, references: string[] = []): EventEnvelope {
  return work({ id, type: "ACTION_STATUS_CHANGED", at, actor: OFFICER, subject: actionId, summary: `${actionId} ${status} · ${detail}`, references, payload: { actionId, status, detail, recordedAt: at } });
}
export const W_ACTION_STATUSES = [
  actionStatus("EV-W-14-1", t("17:49"), "AC-01", "진행중", "교통과 현장반 출동"),
  actionStatus("EV-W-14-2", t("17:50"), "AC-02", "진행중", "하수과 설비반 점검 착수"),
  actionStatus("EV-W-14-3", t("17:58"), "AC-04", "성공", "통장 6명 연락 완료"),
  actionStatus("EV-W-14-4", t("18:06"), "AC-01", "성공", "양방향 통제 완료 · 현장 보고 확인", ["EV-E9-01"]),
  actionStatus("EV-W-14-5", t("18:15"), "AC-03", "성공", "지하차도 진입부 유입 없음 · 진입 통제 유지"),
  actionStatus("EV-W-14-6", t("18:36"), "AC-02", "성공", "펌프 2호기 재가동", ["EV-E6A-02"]),
];
export const W_STATUS_CONTROLLED = statusChange("EV-W-15", t("18:40"), "대응중", "통제", "도로 통제·펌프 재가동 완료 · 수위 정체 · 감시 유지", ["EV-W-14-4", "EV-W-14-6", "EV-E8-02"]);

/* D8 종료와 검증 */
export const W_OUTCOME = work<Outcome>({
  id: "EV-W-16", type: "OUTCOME_RECORDED", at: t("21:00"), actor: OFFICER, summary: "사건 결과 기록 · 예측 0.32 m 대 실측 도로수위 최대 27 cm",
  references: ["EV-E5A-11", "EV-E9-01", "EV-E9-02", "EV-W-14-4", "EV-W-14-6", "EV-E8-01"],
  payload: {
    outcomeId: "OC-01", incidentId: INCIDENT_ID,
    verification: { available: true, forecastId: FORECAST_BASE_ID, predictedDepthM: 0.32, observedDepthM: 0.27, predictedArrivalAt: t("17:52"), observedArrivalAt: t("17:50"), verdict: "과대예측" },
    milestones: [
      { label: "최초 징후", at: t("17:10"), eventId: "EV-E4B-01" }, { label: "복합 알림", at: t("17:13"), eventId: "EV-E8-01" }, { label: "후보 생성", at: t("17:14"), eventId: "EV-W-01" },
      { label: "확인", at: t("17:30"), eventId: "EV-W-05" }, { label: "승인", at: t("17:46"), eventId: "EV-W-08" }, { label: "전파", at: t("17:47"), eventId: "EV-W-10" },
      { label: "통제 완료", at: t("18:06"), eventId: "EV-W-14-4" }, { label: "통제 상태", at: t("18:40"), eventId: "EV-W-15" }, { label: "물 빠짐 확인", at: t("20:50"), eventId: "EV-E9-02" },
    ],
    referencedEventIds: ["EV-E5A-11", "EV-E9-01", "EV-E9-02", "EV-W-12-3", "EV-W-14-6"],
    improvements: ["관로 변화율 기준 30 cm/10분의 조기 감지 여부 검토", "마을방송 장비 응답 실패 원인 점검", "침수예측판 과대예측 5 cm 원인 검토 (펌프 재가동 반영 여부)", "매트릭스 강우 지표의 지연 대체 규칙 검토"],
  },
});
export const W_REPORT = work<Report>({
  id: "EV-W-17", type: "REPORT_GENERATED", producerRole: "시스템", at: t("21:03"), actor: "CUVIA", summary: "상황보고서 초안 생성", references: ["EV-W-16"],
  payload: {
    reportId: "RP-01", incidentId: INCIDENT_ID, status: "초안", version: 1, generatedAt: t("21:03"),
    sections: [
      { title: "사건 개요", body: "창원 검증 배수권역 복합침수 위험 · 17:13 복합 알림 · 17:14 후보 생성 · 21:05 종료", evidenceEventIds: ["EV-W-01", "EV-W-05"] },
      { title: "관측 근거", body: "관로수위 최대 2.48 m(18:00) · 도로수위 최대 27 cm(18:10) · 만조 175 cm(18:20)", evidenceEventIds: ["EV-E4A-12", "EV-E5A-11", "EV-E3B-05"] },
      { title: "위험판단", body: "매트릭스 경계 0.77 · 수위·변화율 기여 0.26 · 예측 0.15 · 강우 0.16(지연 대체)", evidenceEventIds: ["EV-W-06"] },
      { title: "예측과 검증", body: "18:00 전망 최대 0.32 m 대 실측 0.27 m · 과대예측", evidenceEventIds: ["EV-E8-01", "EV-W-16"] },
      { title: "대응과 실행", body: "도로 통제 18:06 완료 · 마을방송 실패 후 유선 대체 · 펌프 2호기 18:35 재가동", evidenceEventIds: ["EV-W-14-4", "EV-W-12-3", "EV-W-14-6"] },
    ],
  },
});
export const W_DECISION_CLOSE = work<Decision>({
  id: "EV-W-18", type: "DECISION_RECORDED", at: t("21:05"), actor: OFFICER, summary: "종료 판단 · 잔여사항: 잔류 토사 정리 후 통제 해제", references: ["EV-W-16", "EV-E9-02"],
  payload: { decisionId: "DC-03", incidentId: INCIDENT_ID, kind: "종료 판단", status: "승인", references: ["EV-W-16", "EV-E9-02"], approver: OFFICER, recordedAt: t("21:05"), reason: "강우 약화 · 관로·도로수위 하강 · 물 빠짐 확인. 잔여: 잔류 토사 정리 후 통제 해제" },
});
export const W_STATUS_CLOSED = statusChange("EV-W-19", t("21:05"), "통제", "종료", "종료 조건 충족 · 잔여사항 기록", ["EV-W-18"]);

export const WORKFLOW_EVENTS: EventEnvelope[] = [
  W_CREATED, W_REVIEW, W_STATUS_REVIEWING, W_DECISION_CONFIRM, W_STATUS_CONFIRMED, W_ASSESSMENT, W_RECOMMENDATION, W_DECISION_APPROVE,
  ...W_ACTIONS_ASSIGNED, W_DISSEMINATION, W_STATUS_RESPONDING, ...W_DISS_RESULTS, W_ACTION_FALLBACK, ...W_ACTION_STATUSES, W_STATUS_CONTROLLED,
  W_OUTCOME, W_REPORT, W_DECISION_CLOSE, W_STATUS_CLOSED,
];

export const ALTERNATIVE_FORECAST_IDS = [FORECAST_DRAIN_ID, FORECAST_ROAD_ID];
