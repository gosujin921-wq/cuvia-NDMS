/* ─────────────────────────────────────────────
 * 복합 알림 인스턴스 — 02 §5.2.1 시연 규칙 다섯 줄
 *
 * 알림은 이벤트가 아니라 이벤트·Forecast 를 규칙으로 평가한 내부 객체다(01 §6.1). 갱신 이력은
 * `updates` 에 누적되고 현재 시계의 상태는 selectors.alertsAt 이 이력을 잘라 만든다.
 * ───────────────────────────────────────────── */

import type { AttentionAlert } from "../../model/alert";
import { BASIN_SCOPE, SUBJECTS, SUBJECT_LOCATION } from "./subjects";
import { INCIDENT_ID, t } from "./incident";
import { FORECAST_BASE_ID, FORECAST_BASE_2_ID, FORECAST_DRAIN_ID, FORECAST_ROAD_ID } from "./forecasts";

export const ALERTS: AttentionAlert[] = [
  {
    alertId: "AL-01", kind: "공식 상황", demoRole: "사전 감시 알림", grade: "주의", status: "생성", createdAt: t("16:40"), updatedAt: t("16:40"),
    target: BASIN_SCOPE, task: "감시 우선구역 · 카메라 2 · 센서 3 우선 확인",
    evidenceEventIds: ["EV-E1-01", "EV-E2-02", "EV-E3A-01"], forecastIds: [],
    reason: "예측강우 19시 17.8 mm/h · 호우경보 발효 · 만조 18:24 가 강우 정점 ±3시간 안. 배수취약 권역",
    ruleId: "AR-WATCH", ruleVersion: "0.1", suppression: { windowMin: 120, releaseCondition: "특보 해제 또는 예측강우 하향" },
    updates: [
      { at: t("16:40"), status: "생성", eventIds: ["EV-E2-02"], note: "호우경보 변경으로 감시 조건 충족" },
      { at: t("17:14"), status: "갱신", eventIds: ["EV-W-01"], note: "감시 구역에 사건 후보 생성 · 사건 근거로 연결" },
      { at: t("21:05"), status: "해제", eventIds: ["EV-W-19"], note: "예측강우 하향 · 사건 종료" },
    ],
    incidentId: INCIDENT_ID, createdIncident: false,
  },
  {
    alertId: "AL-02", kind: "복합 징후", demoRole: "복합 징후 알림", grade: "경계", status: "생성", createdAt: t("17:13"), updatedAt: t("17:13"),
    target: BASIN_SCOPE, task: "사건 후보 검토 인수",
    evidenceEventIds: ["EV-E4B-01", "EV-E5A-03", "EV-E6A-01"], forecastIds: [FORECAST_BASE_ID],
    reason: "공간: 같은 배수권역 · 시간: 17:00~17:13 창 · 의미: 관로 급상승 64 cm/10분 뒤 도로수위 동반 상승, 침수 도달 ≤ 60분 · 펌프 가용 저하로 등급 상향",
    ruleId: "AR-COMPOSITE", ruleVersion: "0.1", suppression: { windowMin: 30, releaseCondition: "사건 후보 생성 시 이관" },
    updates: [
      { at: t("17:13"), status: "생성", eventIds: ["EV-E4B-01", "EV-E8-01"], note: "복합 조건 충족 · 후보 생성 기준 충족" },
      { at: t("17:14"), status: "갱신", eventIds: ["EV-W-01"], note: "사건 후보 INC-2024-0921-SH01 생성" },
      { at: t("17:26"), status: "확인", eventIds: ["EV-W-03"], note: "담당자 검토 인수" },
    ],
    incidentId: INCIDENT_ID, createdIncident: true, assignee: "김상황", acknowledgedAt: t("17:26"),
  },
  {
    alertId: "AL-03", kind: "복합 징후", demoRole: "영상 교차확인 알림", grade: "경계", status: "생성", createdAt: t("17:24"), updatedAt: t("17:24"),
    target: SUBJECT_LOCATION[SUBJECTS.cctvPump], task: "실제 영상 확인 · 확인/오탐/추가 확인 결정",
    evidenceEventIds: ["EV-E7-01", "EV-E4B-01", "EV-E5B-01"], forecastIds: [FORECAST_BASE_ID],
    reason: "VLM 물고임 추정 0.82 가 같은 공간·시각의 관로·도로 징후와 연결 · 확실성 상향 후보",
    ruleId: "AR-SCENE", ruleVersion: "0.1", suppression: { windowMin: 20, releaseCondition: "담당자 확인·오탐 결정" },
    updates: [
      { at: t("17:24"), status: "생성", eventIds: ["EV-E7-01"], note: "장면 분석 수신" },
      { at: t("17:25"), status: "갱신", eventIds: ["EV-W-02"], note: "확인 요청 RV-01 발행" },
      { at: t("17:30"), status: "해제", eventIds: ["EV-W-04"], note: "담당자 확인 · 사건 확인됨" },
    ],
    incidentId: INCIDENT_ID, createdIncident: false, assignee: "김상황", acknowledgedAt: t("17:30"),
  },
  {
    alertId: "AL-04", kind: "예측 영향", demoRole: "예측 영향 알림", grade: "경계", status: "생성", createdAt: t("17:13"), updatedAt: t("17:13"),
    target: { kind: "회랑", displayAnchor: [128.5663, 35.1961], affectedGeometryId: "GEO-ROAD-COAST", label: "해안도로 저지대 구간" }, task: "예측 유효시각·영향 공간 검토 · [디지털트윈 보기]",
    evidenceEventIds: ["EV-E8-01"], forecastIds: [FORECAST_BASE_ID, FORECAST_DRAIN_ID, FORECAST_ROAD_ID],
    reason: "18:00 최대 침수심 0.32 m ≥ 0.2 m · 해안도로 17:52 도달 ≤ 60분",
    ruleId: "AR-FORECAST", ruleVersion: "0.1", suppression: { windowMin: 30, releaseCondition: "예측판 만료·갱신" },
    updates: [
      { at: t("17:13"), status: "생성", eventIds: ["EV-E8-01"], note: "기준 전망 영향 기준 초과" },
      { at: t("18:10"), status: "갱신", eventIds: ["EV-E8-02"], note: "갱신판 · 축소 전망 · 20:30 물 빠짐" },
      { at: t("21:00"), status: "해제", eventIds: ["EV-E8-02"], note: "예측판 만료" },
    ],
    incidentId: INCIDENT_ID, createdIncident: false,
  },
  {
    alertId: "AL-05", kind: "품질·연계", demoRole: "품질·대체 확인 알림", grade: "주의", status: "생성", createdAt: t("17:16"), updatedAt: t("17:16"),
    target: SUBJECT_LOCATION[SUBJECTS.rainGauge], task: "강우 추세는 예측강우로 대체 확인",
    evidenceEventIds: ["EV-E10-01"], forecastIds: [],
    reason: "강우계 6분 미수신 · 현재 판단(강우 지속)에 영향 · 예측강우(E1)로 대체 확인",
    ruleId: "AR-QUALITY", ruleVersion: "0.1", suppression: { windowMin: 15, releaseCondition: "수신 복구" },
    updates: [
      { at: t("17:16"), status: "생성", eventIds: ["EV-E10-01"], note: "지연 판정" },
      { at: t("17:34"), status: "해제", eventIds: ["EV-E10-02"], note: "수신 복구" },
    ],
    incidentId: INCIDENT_ID, createdIncident: false,
  },
];

/** 갱신판 알림이 참조하는 Forecast — 표기용 */
export const ALERT_FORECAST_IDS = [FORECAST_BASE_ID, FORECAST_BASE_2_ID];
