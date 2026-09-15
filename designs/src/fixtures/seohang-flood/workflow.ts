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
/** 대응중 안의 국면 전환 — 상태는 그대로, phase 만 바뀐다 */
function phaseChange(id: string, at: string, phase: "통제", reason: string, references: string[]): EventEnvelope {
  return work<StatusChange>({ id, type: "INCIDENT_STATUS_CHANGED", at, actor: OFFICER, summary: `대응중 · ${phase} 국면`, payload: { from: "대응중", to: "대응중", phase, reason, recordedAt: at }, references });
}

/* D1 후보 생성 — 복합 징후 알림 AL-02 가 후보 기준 충족 */
export const W_CREATED = work({
  id: "EV-W-01", type: "INCIDENT_CREATED", producerRole: "CUVIA 규칙", at: t("17:14"), actor: "CUVIA",
  summary: "복합 징후 알림으로 사건 후보 생성", derivedFrom: ["EV-E4B-01", "EV-E8-01", "EV-E5A-03", "EV-E6A-01"],
  payload: {
    initialStatus: "후보" as WorkflowStatus, ruleId: "AR-COMPOSITE", ruleVersion: "0.1", sourceAlertIds: ["AL-02", "AL-04"],
    reasons: ["공간: 같은 배수권역(BASIN-SH-01)의 관로·도로수위계", "시간: 17:00~17:14 동일 시간창", "의미: 관로 급상승 뒤 도로수위 동반 상승은 내수침수 징후", "예측: 침수예측판이 후보 영향 기준(도로 도달 60분 이내)을 초과"],
  },
});

/* D2 교차확인 — 영상 확인 요청 → 검토 인수 → 확인 */
export const W_REVIEW = work({
  id: "EV-W-02", type: "REVIEW_REQUESTED", producerRole: "시스템", at: t("17:25"), actor: "CUVIA", subject: SUBJECTS.cctvPump,
  summary: "VLM 물고임 감지 · 영상 검토 권고", references: ["EV-E7-01"],
  payload: { reviewId: "RV-01", targetEventId: "EV-E7-01", reason: "차로 침수 추정 0.82 · 실제 영상 확인 필요", assignee: OFFICER, status: "요청", alertId: "AL-03" },
});
export const W_STATUS_REVIEWING = statusChange("EV-W-03", t("17:26"), "후보", "확인중", "담당자가 후보 검토를 인수", ["EV-W-01"]);
export const W_DECISION_CONFIRM = work<Decision>({
  id: "EV-W-04", type: "DECISION_RECORDED", at: t("17:30"), actor: OFFICER, summary: "사건 확인 · 실제 대응 사건으로 판단",
  references: ["EV-E7-01", "EV-E5B-01", "EV-E3B-03", "EV-E6A-01"],
  payload: { decisionId: "DC-01", incidentId: INCIDENT_ID, kind: "사건 확인", status: "승인", references: ["EV-E7-01", "EV-E5B-01", "EV-E3B-03", "EV-E6A-01"], approver: OFFICER, recordedAt: t("17:30"), reason: "관로·도로 상승과 영상 물고임이 일치. 조위 상승과 펌프 가용 저하로 자연배수 불리" },
});
export const W_STATUS_CONFIRMED = statusChange("EV-W-05", t("17:30"), "확인중", "대응중", "실제 사건으로 판단 · 대응 시작. 자동 조치는 즉시, 승인 항목은 대기", ["EV-W-04"]);

/* 위험도 매트릭스 — 이벤트가 결합될 때마다 갱신된다(README §2.1 · 01 §6.2 · 02 §5.2.2). 사건 확인은 사람의 판단이고
   매트릭스를 만드는 행위가 아니다(2026-09-14 사용자 지적). 세 번 갱신한다:
     17:13 후보 생성과 함께 첫 결과 — 영상 미확인·확실성 낮음
     17:24 VLM 물고임 반영 — 확실성 보통, 강우계 지연으로 품질↓
     17:33 강우 복구 전 마지막 갱신 — 대응 시작 뒤 D3 "왜 위험한가"를 읽는 장면
   점수 = 기여도 합. 등급 경계는 RM-FLOOD 데모 설정값(주의 0.35 · 경계 0.55 · 심각 0.80) */
export const W_ASSESSMENT_CANDIDATE = work<HazardAssessment>({
  id: "EV-W-06A", type: "ASSESSMENT_UPDATED", eventClass: "분석", producerRole: "CUVIA 규칙", at: t("17:13"), actor: "CUVIA",
  summary: "위험도 첫 판단 · 경계",
  derivedFrom: ["EV-E0-05", "EV-E4A-06", "EV-E4B-01", "EV-E5A-03", "EV-E2-02", "EV-E6A-01", "EV-E8-01"],
  payload: {
    matrix: {
      ruleId: "RM-FLOOD", ruleVersion: "0.1", computedAt: t("17:13"), score: 0.67, grade: "경계",
      contributions: [
        { indicator: "수위·변화율", band: "급상승·기준 진입", bandScore: 0.85, weight: 0.3, contribution: 0.255, evidenceEventIds: ["EV-E4B-01", "EV-E4A-06"], degraded: false },
        { indicator: "강우·공식 상황", band: "경보", bandScore: 0.8, weight: 0.2, contribution: 0.16, evidenceEventIds: ["EV-E1-01", "EV-E2-02", "EV-E0-05"], degraded: false },
        { indicator: "영상·현장", band: "미확인", bandScore: 0.1, weight: 0.15, contribution: 0.015, evidenceEventIds: [], degraded: true },
        { indicator: "시설·배수 여건", band: "제약", bandScore: 0.6, weight: 0.15, contribution: 0.09, evidenceEventIds: ["EV-E6A-01", "EV-E3B-02"], degraded: false },
        { indicator: "디지털트윈 예측", band: "통행 불가·시설 영향", bandScore: 1, weight: 0.15, contribution: 0.15, evidenceEventIds: ["EV-E8-01"], degraded: false },
        { indicator: "품질", band: "정상", bandScore: 0, weight: 0.05, contribution: 0, evidenceEventIds: [], degraded: false },
      ],
    },
    severity: "높음", urgency: "즉시", certainty: "낮음", trend: "악화",
    narrative: [
      "관로수위가 10분에 64 cm 급상승하고 호우경보가 이어져 경계로 판단했습니다.",
      "침수예측은 17:52 해안도로 도달을 보이지만, 영상이 아직 없어 물고임 여부는 모릅니다.",
      "도로수위는 아직 1 cm이고 저류시설에 여유가 있습니다.",
    ],
    riskFactors: ["관로수위 10분간 64 cm 급상승", "호우경보 · 예측강우 19시 17.8 mm/h", "펌프 2호기 정지 · 가용 2/3", "침수예측판 17:52 해안도로 도달"],
    mitigatingFactors: ["도로수위 아직 1 cm", "저류시설 여유"],
    counterEvidence: [],
    uncertainties: ["영상 미확인 · 물고임 여부 모름", "침수예측판은 시나리오 결과 세트 · 불확실성 보통"],
    missingData: ["CCTV 장면 분석", "저류시설 수위"],
    evidenceEventIds: ["EV-E4B-01", "EV-E5A-03", "EV-E2-02", "EV-E6A-01", "EV-E8-01"],
  },
});
export const W_ASSESSMENT_SCENE = work<HazardAssessment>({
  id: "EV-W-06B", type: "ASSESSMENT_UPDATED", eventClass: "분석", producerRole: "CUVIA 규칙", at: t("17:24"), actor: "CUVIA",
  summary: "위험도 갱신 · 경계 유지 · 상승 · 영상 반영",
  derivedFrom: ["EV-E7-01", "EV-E5B-01", "EV-E10-01", "EV-W-06A"],
  payload: {
    matrix: {
      ruleId: "RM-FLOOD", ruleVersion: "0.1", computedAt: t("17:24"), score: 0.77, grade: "경계",
      contributions: [
        { indicator: "수위·변화율", band: "급상승·기준 진입", bandScore: 0.85, weight: 0.3, contribution: 0.255, evidenceEventIds: ["EV-E4B-01", "EV-E5B-01", "EV-E4A-08"], degraded: false },
        { indicator: "강우·공식 상황", band: "경보", bandScore: 0.8, weight: 0.2, contribution: 0.16, evidenceEventIds: ["EV-E1-01", "EV-E2-02"], degraded: true },
        { indicator: "영상·현장", band: "물고임 추정", bandScore: 0.6, weight: 0.15, contribution: 0.09, evidenceEventIds: ["EV-E7-01"], degraded: false },
        { indicator: "시설·배수 여건", band: "제약", bandScore: 0.6, weight: 0.15, contribution: 0.09, evidenceEventIds: ["EV-E6A-01", "EV-E3B-03"], degraded: false },
        { indicator: "디지털트윈 예측", band: "통행 불가·시설 영향", bandScore: 1, weight: 0.15, contribution: 0.15, evidenceEventIds: ["EV-E8-01"], degraded: false },
        { indicator: "품질", band: "일부 지연", bandScore: 0.5, weight: 0.05, contribution: 0.025, evidenceEventIds: ["EV-E10-01"], degraded: true },
      ],
    },
    severity: "높음", urgency: "즉시", certainty: "보통", trend: "악화",
    narrative: [
      "관로수위가 10분에 64 cm 급상승하고 호우경보가 이어져 경계로 판단했습니다.",
      "영상에서 물고임이 확인돼 지난 판단보다 확실해졌고, 심각 문턱 직전입니다.",
      "강우계가 6분째 지연돼 강우 추세는 예측값으로 봤습니다.",
    ],
    riskFactors: ["관로수위 2.0 m 상승 지속", "도로수위 경계 기준(8 cm) 진입", "VLM 차로 물고임 추정 0.82", "펌프 2호기 정지 · 가용 2/3"],
    mitigatingFactors: ["도로수위 아직 8 cm", "저류시설 여유 62 %", "펌프 1·3호기 정상"],
    counterEvidence: ["배수관리용 폴 CCTV(CV-SH-02)는 아직 물고임 미확인"],
    uncertainties: ["강우계 지연(17:16~) · 강우 추세 미확인 · 예측강우로 대체", "영상은 단일 컷 · 담당자 확인 전"],
    missingData: ["지하차도 수위계 없음", "펌프 2호기 복구 예상시각"],
    evidenceEventIds: ["EV-E4B-01", "EV-E5B-01", "EV-E7-01", "EV-E6A-01", "EV-E8-01", "EV-E10-01"],
  },
});

/* D3 현재 판단 — 대응 시작 뒤 마지막 갱신. 담당자가 "왜 위험한가"를 읽는 장면 */
export const W_ASSESSMENT = work<HazardAssessment>({
  id: "EV-W-06", type: "ASSESSMENT_UPDATED", eventClass: "분석", producerRole: "CUVIA 규칙", at: t("17:33"), actor: "CUVIA",
  summary: "위험도 갱신 · 경계 유지 · 확실성 높음",
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
    narrative: [
      "관로수위 2.2 m로 상승이 이어지고 만조 18:24가 겹쳐 경계를 유지합니다.",
      "영상·계측·시설 근거가 맞아떨어져 확실성이 높아졌고, 심각 문턱 직전입니다.",
      "펌프 2호기 복구 시각은 아직 모릅니다.",
    ],
    riskFactors: ["강우 지속 (18시 이후 정점 전망)", "관로수위 2.2 m 상승 지속", "조위 상승 · 만조 18:24", "펌프 2호기 정지 · 가용 2/3"],
    mitigatingFactors: ["도로수위 아직 12 cm", "저류시설 여유 62 %", "펌프 1·3호기 정상"],
    counterEvidence: ["배수관리용 폴 CCTV(CV-SH-02)는 아직 물고임 미확인"],
    uncertainties: ["강우계 지연 구간(17:16~17:34) 동안 강우 추세 미확인 · 예측강우로 대체", "침수예측판은 시나리오 결과 세트 · 불확실성 보통"],
    missingData: ["지하차도 수위계 없음", "펌프 2호기 복구 예상시각"],
    evidenceEventIds: ["EV-E0-06", "EV-E4A-10", "EV-E3B-03", "EV-E6A-01", "EV-E6B-01", "EV-E7-01", "EV-E8-01"],
  },
});

/* 대응 시작과 동시에 CUVIA 가 기준 전망으로 권고를 먼저 만든다 (2026-09-14 검수 1번). 담당자가 전망 탭에서 대안을 고르면
   아래 EV-W-07 이 같은 권고를 갱신한다. 권고는 사람이 만들라고 기다리는 것이 아니라 시스템이 내놓고 사람이 승인하는 것이다 */
export const W_RECOMMENDATION_AUTO = work<Recommendation>({
  id: "EV-W-07A", type: "RECOMMENDATION_UPDATED", eventClass: "분석", producerRole: "CUVIA 규칙", at: t("17:30"), actor: "CUVIA",
  summary: "SOP 조치안 작성 · 기준 전망(18:00)", derivedFrom: ["EV-W-06B", "EV-E8-01"],
  payload: {
    recommendationId: "RC-01", incidentId: INCIDENT_ID, status: "제안", proposedLevel: "선제 통제",
    basis: { forecastId: FORECAST_BASE_ID, validAt: t("18:00"), alternativeId: "baseline" },
    reasons: ["18:00 해안도로 통행 불가 전망 (최대 0.32 m)", "17:52 도달 예상 · 통제 완료까지 남은 시간 20분 안팎", "지하차도 진입부 유입 전망"],
    counterReasons: ["도로수위 현재 8 cm · 통행 가능 수준", "펌프 2호기 복구 시 침수심 0.22 m 로 감소 전망"],
    proposedActions: [
      { kind: "도로 통제", target: "해안도로 저지대 구간", organization: "교통과", summary: "17:50 이전 양방향 통제 · 우회 안내", basis: "18:00 통행 불가 전망 · 최대 0.32 m · 17:52 도달" },
      { kind: "시설 점검", target: "제2배수펌프장 2호기", organization: "하수과", summary: "전기 계통 점검 · 재가동", basis: "펌프 복구 시 침수심 0.22 m 로 감소 전망" },
      { kind: "현장 확인", target: "신포 지하차도", organization: "안전총괄과", summary: "진입부 유입 여부 확인 · 필요 시 진입 통제", basis: "18:20 지하차도 진입부 유입 전망" },
    ],
    producer: "CUVIA",
  },
});

/* D6 영향 기반 대응 — 담당자가 고른 전망으로 권고 갱신 → 승인 → 조치 배정 → 전파 요청 */
export const W_RECOMMENDATION = work<Recommendation>({
  id: "EV-W-07", type: "RECOMMENDATION_UPDATED", eventClass: "분석", producerRole: "CUVIA 규칙", at: t("17:44"), actor: "CUVIA",
  summary: "SOP 조치안 갱신 · 담당자가 고른 18:00 도로 통제 전망 기준", derivedFrom: ["EV-W-06", "EV-E8-01"], references: ["EV-W-07A"],
  payload: {
    recommendationId: "RC-01", incidentId: INCIDENT_ID, status: "변경", proposedLevel: "선제 통제",
    basis: { forecastId: FORECAST_BASE_ID, validAt: t("18:00"), alternativeId: "road-control" },
    reasons: ["18:00 해안도로 통행 불가 전망 (최대 0.32 m)", "17:52 도달 예상 · 통제 완료까지 남은 시간 8분 미만", "지하차도 진입부 유입 전망"],
    counterReasons: ["도로수위 현재 17 cm · 통행 가능 수준", "펌프 2호기 복구 시 침수심 0.22 m 로 감소 전망"],
    proposedActions: [
      { kind: "도로 통제", target: "해안도로 저지대 구간", organization: "교통과", summary: "17:50 이전 양방향 통제 · 우회 안내", basis: "18:00 통행 불가 전망 · 최대 0.32 m · 17:52 도달" },
      { kind: "시설 점검", target: "제2배수펌프장 2호기", organization: "하수과", summary: "전기 계통 점검 · 재가동", basis: "펌프 복구 시 침수심 0.22 m 로 감소 전망" },
      { kind: "현장 확인", target: "신포 지하차도", organization: "안전총괄과", summary: "진입부 유입 여부 확인 · 필요 시 진입 통제", basis: "18:20 지하차도 진입부 유입 전망" },
    ],
    producer: "RULE-RECOMMEND-FLOOD 0.1",
  },
});
export const W_DECISION_APPROVE = work<Decision>({
  id: "EV-W-08", type: "DECISION_RECORDED", at: t("17:46"), actor: APPROVER, summary: "SOP 승인 · 도로 통제 대응안", references: ["EV-W-07", "EV-E8-01"],
  payload: { decisionId: "DC-02", incidentId: INCIDENT_ID, kind: "대응 승인", status: "승인", level: "선제 통제", references: ["EV-W-07", "EV-E8-01"], approver: APPROVER, recordedAt: t("17:46"), reason: "18:00 전망 기준 도로 통제 권고 채택. 배수 대응은 펌프 복구 시점 불확실로 병행" },
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
  const label = actionId === "AC-04" ? "대피 안내 · 유선 연락" : (() => { const a = [...ACTIONS, ...ACTIONS_ESCALATE].find((x) => x.actionId === actionId); return a ? `${a.kind} · ${a.target}` : actionId; })();
  return work({ id, type: "ACTION_STATUS_CHANGED", at, actor: OFFICER, subject: actionId, summary: `${label} ${status} · ${detail}`, references, payload: { actionId, status, detail, recordedAt: at } });
}
/* ── D7 대응 중 악화 (2026-09-14 결정 "아주 중요한 부분") ──
   18:00 도로수위가 침수 기준을 넘어 이어지고 만조(18:24)가 다가온다 → 18:02 위험도 심각 상향 → SOP 에 심각 항목 둘이 선다 →
   18:08 추가 승인 → 18:16·18:20 완료. 판단은 한 번으로 끝나지 않는다 · 시스템이 다시 판단하고 할 일을 늘린다 */
export const W_ASSESSMENT_SEVERE = work<HazardAssessment>({
  id: "EV-W-06C", type: "ASSESSMENT_UPDATED", eventClass: "분석", producerRole: "CUVIA 규칙", at: t("18:02"), actor: "CUVIA",
  summary: "위험도 갱신 · 심각 상향 · 도로수위 침수 기준 지속", derivedFrom: ["EV-E5B-02", "EV-E3B-04", "EV-E6A-01", "EV-E8-01"],
  payload: {
    matrix: {
      ruleId: "RM-FLOOD", ruleVersion: "0.1", computedAt: t("18:02"), score: 0.835, grade: "심각",
      contributions: [
        { indicator: "수위·변화율", band: "만관·침수", bandScore: 1, weight: 0.3, contribution: 0.3, evidenceEventIds: ["EV-E5B-02", "EV-E5A-10"], degraded: false },
        { indicator: "강우·공식 상황", band: "경보", bandScore: 0.8, weight: 0.2, contribution: 0.16, evidenceEventIds: ["EV-E1-01", "EV-E2-02"], degraded: false },
        { indicator: "영상·현장", band: "물고임 추정", bandScore: 0.6, weight: 0.15, contribution: 0.09, evidenceEventIds: ["EV-E7-01"], degraded: false },
        { indicator: "시설·배수 여건", band: "심각 제약", bandScore: 0.9, weight: 0.15, contribution: 0.135, evidenceEventIds: ["EV-E6A-01", "EV-E3B-04"], degraded: false },
        { indicator: "디지털트윈 예측", band: "통행 불가·시설 영향", bandScore: 1, weight: 0.15, contribution: 0.15, evidenceEventIds: ["EV-E8-01"], degraded: false },
        { indicator: "품질", band: "정상", bandScore: 0, weight: 0.05, contribution: 0, evidenceEventIds: [], degraded: false },
      ],
    },
    severity: "높음", urgency: "즉시", certainty: "높음", trend: "악화",
    narrative: [
      "도로수위가 26 cm로 침수 기준(20 cm)을 10분 넘게 넘어 심각으로 올렸습니다.",
      "만조 18:24까지 배수가 막혀 지하차도 진입부와 저지대 건물로 번질 전망입니다.",
      "해안도로 통제는 이미 진행 중이고, 지하차도 진입 통제와 저지대 대피 권고가 추가로 필요합니다.",
    ],
    riskFactors: ["도로수위 26 cm · 침수 기준 지속", "만조 18:24 · 조위 166 cm 상승 중", "펌프 2호기 정지 · 가용 2/3", "지하차도 진입부 18:20 유입 전망"],
    mitigatingFactors: ["해안도로 통제 진행 중", "저류시설 여유 62 %"],
    counterEvidence: [],
    uncertainties: ["펌프 2호기 복구 시각 미정"],
    missingData: ["지하차도 수위계 없음"],
    evidenceEventIds: ["EV-E5B-02", "EV-E5A-10", "EV-E3B-04", "EV-E6A-01", "EV-E7-01", "EV-E8-01"],
  },
});
export const W_RECOMMENDATION_ESCALATE = work<Recommendation>({
  id: "EV-W-07B", type: "RECOMMENDATION_UPDATED", eventClass: "분석", producerRole: "CUVIA 규칙", at: t("18:02"), actor: "CUVIA",
  summary: "SOP 조치안 추가 · 심각 상향 · 지하차도 진입 통제 · 저지대 대피 권고", derivedFrom: ["EV-W-06C", "EV-E8-01"], references: ["EV-W-07"],
  payload: {
    recommendationId: "RC-01", incidentId: INCIDENT_ID, status: "변경", proposedLevel: "선제 통제",
    basis: { forecastId: FORECAST_BASE_ID, validAt: t("18:00"), alternativeId: "road-control" },
    reasons: ["도로수위 침수 기준 지속 · 심각", "18:20 지하차도 진입부 유입 전망", "저지대 건물 12동 18:05 도달 전망"],
    counterReasons: ["펌프 2호기 복구 시 침수심 0.22 m 로 감소 전망"],
    proposedActions: [
      { kind: "도로 통제", target: "해안도로 저지대 구간", organization: "교통과", summary: "17:50 이전 양방향 통제 · 우회 안내", basis: "18:00 통행 불가 전망 · 최대 0.32 m · 17:52 도달" },
      { kind: "시설 점검", target: "제2배수펌프장 2호기", organization: "하수과", summary: "전기 계통 점검 · 재가동", basis: "펌프 복구 시 침수심 0.22 m 로 감소 전망" },
      { kind: "현장 확인", target: "신포 지하차도", organization: "안전총괄과", summary: "진입부 유입 여부 확인 · 필요 시 진입 통제", basis: "18:20 지하차도 진입부 유입 전망" },
      { kind: "도로 통제", target: "신포 지하차도", organization: "안전총괄과", summary: "진입부 차단 · 차량 우회 안내", basis: "도로수위 26 cm 지속 · 18:20 진입부 유입 전망" },
      { kind: "대피 안내", target: "저지대 건물 12동", organization: "재난안전 상황실", summary: "마을방송·통장 연락으로 상층 이동 권고", basis: "저지대 건물 12동 18:05 도달 전망 · 최대 0.32 m" },
    ],
    producer: "CUVIA",
  },
});
export const W_DECISION_APPROVE_2 = work<Decision>({
  id: "EV-W-08B", type: "DECISION_RECORDED", at: t("18:08"), actor: APPROVER, summary: "SOP 승인 · 추가 조치 2건", references: ["EV-W-07B"],
  payload: { decisionId: "DC-03", incidentId: INCIDENT_ID, kind: "대응 승인", status: "승인", level: "선제 통제", references: ["EV-W-07B"], approver: APPROVER, recordedAt: t("18:08"), reason: "심각 상향에 따른 지하차도 진입 통제·저지대 대피 권고 승인" },
});
export const ACTIONS_ESCALATE: Action[] = [
  { actionId: "AC-05", incidentId: INCIDENT_ID, kind: "도로 통제", target: "신포 지하차도", organization: "안전총괄과", assignee: "안전총괄과 순찰반", summary: "진입부 차단 · 차량 우회 안내", decisionId: "DC-03" },
  { actionId: "AC-06", incidentId: INCIDENT_ID, kind: "대피 안내", target: "저지대 건물 12동", organization: "재난안전 상황실", assignee: OFFICER, summary: "마을방송·통장 연락으로 상층 이동 권고", decisionId: "DC-03" },
];
export const W_ACTIONS_ASSIGNED_2 = ACTIONS_ESCALATE.map((a, i) => work<Action>({ id: `EV-W-09B-${i + 1}`, type: "ACTION_ASSIGNED", at: t("18:08"), actor: APPROVER, subject: a.target, summary: `${a.kind} 배정 · ${a.target} · ${a.organization}`, references: ["EV-W-08B"], payload: a }));

/* 18:38 하향 — 만조가 지나고 펌프가 돌아 경계로 내린다. 통제 국면 전환의 판단 근거 */
export const W_ASSESSMENT_CONTROL = work<HazardAssessment>({
  id: "EV-W-06D", type: "ASSESSMENT_UPDATED", eventClass: "분석", producerRole: "CUVIA 규칙", at: t("18:38"), actor: "CUVIA",
  summary: "위험도 갱신 · 경계 하향 · 만조 경과 · 배수 재개", derivedFrom: ["EV-E5A-13", "EV-E6A-02", "EV-E8-02"],
  payload: {
    matrix: {
      ruleId: "RM-FLOOD", ruleVersion: "0.1", computedAt: t("18:38"), score: 0.58, grade: "경계",
      contributions: [
        { indicator: "수위·변화율", band: "상승", bandScore: 0.5, weight: 0.3, contribution: 0.15, evidenceEventIds: ["EV-E5A-13"], degraded: false },
        { indicator: "강우·공식 상황", band: "경보", bandScore: 0.8, weight: 0.2, contribution: 0.16, evidenceEventIds: ["EV-E1-01", "EV-E2-02"], degraded: false },
        { indicator: "영상·현장", band: "물고임 추정", bandScore: 0.6, weight: 0.15, contribution: 0.09, evidenceEventIds: ["EV-E7-01"], degraded: false },
        { indicator: "시설·배수 여건", band: "제약", bandScore: 0.6, weight: 0.15, contribution: 0.09, evidenceEventIds: ["EV-E6A-02"], degraded: false },
        { indicator: "디지털트윈 예측", band: "통행 지장", bandScore: 0.6, weight: 0.15, contribution: 0.09, evidenceEventIds: ["EV-E8-02"], degraded: false },
        { indicator: "품질", band: "정상", bandScore: 0, weight: 0.05, contribution: 0, evidenceEventIds: [], degraded: false },
      ],
    },
    severity: "보통", urgency: "주의", certainty: "높음", trend: "완화",
    narrative: [
      "도로수위가 21 cm로 내려가고 만조가 지나 경계로 내렸습니다.",
      "펌프 2호기가 다시 돌아 배수가 재개됐고, 20:30 물 빠짐 전망입니다.",
      "통제·대피 조치는 유지하고 잔여 조치를 감시합니다.",
    ],
    riskFactors: ["도로수위 21 cm · 하강 중", "강우 지속"],
    mitigatingFactors: ["만조 경과 · 조위 하강", "펌프 2호기 재가동", "해안도로·지하차도 통제 유지"],
    counterEvidence: [],
    uncertainties: ["19시 강우 정점 전망"],
    missingData: [],
    evidenceEventIds: ["EV-E5A-13", "EV-E6A-02", "EV-E8-02", "EV-E3B-05"],
  },
});

export const W_ACTION_STATUSES = [
  actionStatus("EV-W-14-1", t("17:49"), "AC-01", "진행중", "교통과 현장반 출동"),
  actionStatus("EV-W-14-2", t("17:50"), "AC-02", "진행중", "하수과 설비반 점검 착수"),
  actionStatus("EV-W-14-3", t("17:58"), "AC-04", "성공", "통장 6명 연락 완료"),
  actionStatus("EV-W-14-4", t("18:06"), "AC-01", "성공", "양방향 통제 완료 · 현장 보고 확인", ["EV-E9-01"]),
  actionStatus("EV-W-14-5", t("18:15"), "AC-03", "성공", "지하차도 진입부 유입 없음 · 진입 통제 유지"),
  actionStatus("EV-W-14-6", t("18:36"), "AC-02", "성공", "펌프 2호기 재가동", ["EV-E6A-02"]),
  actionStatus("EV-W-14-7", t("18:09"), "AC-05", "진행중", "안전총괄과 순찰반 이동"),
  actionStatus("EV-W-14-8", t("18:09"), "AC-06", "진행중", "마을방송 대체 · 통장 연락 착수"),
  actionStatus("EV-W-14-9", t("18:16"), "AC-05", "성공", "지하차도 진입부 차단 · 우회 안내 완료"),
  actionStatus("EV-W-14-10", t("18:20"), "AC-06", "성공", "12동 안내 완료 · 6가구 상층 이동"),
];
export const W_STATUS_CONTROLLED = phaseChange("EV-W-15", t("18:40"), "통제", "도로 통제·펌프 재가동 완료 · 수위 정체 · 감시 유지", ["EV-W-14-4", "EV-W-14-6", "EV-E8-02"]);

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
export const W_STATUS_CLOSED = statusChange("EV-W-19", t("21:05"), "대응중", "종료", "종료 조건 충족 · 잔여사항 기록", ["EV-W-18"]);

export const WORKFLOW_EVENTS: EventEnvelope[] = [
  W_CREATED, W_ASSESSMENT_CANDIDATE, W_REVIEW, W_ASSESSMENT_SCENE, W_STATUS_REVIEWING, W_DECISION_CONFIRM, W_STATUS_CONFIRMED, W_RECOMMENDATION_AUTO, W_ASSESSMENT, W_RECOMMENDATION, W_DECISION_APPROVE,
  ...W_ACTIONS_ASSIGNED, W_DISSEMINATION, ...W_DISS_RESULTS, W_ACTION_FALLBACK, W_ASSESSMENT_SEVERE, W_RECOMMENDATION_ESCALATE, W_DECISION_APPROVE_2, ...W_ACTIONS_ASSIGNED_2, ...W_ACTION_STATUSES, W_ASSESSMENT_CONTROL, W_STATUS_CONTROLLED,
  W_OUTCOME, W_REPORT, W_DECISION_CLOSE, W_STATUS_CLOSED,
];

export const ALTERNATIVE_FORECAST_IDS = [FORECAST_DRAIN_ID, FORECAST_ROAD_ID];
