/* ─────────────────────────────────────────────
 * 대표 사건 정의와 시연 시점 열 — 창원 검증 배수권역 복합침수 위험 (서항 가칭)
 * 정본: 02 §4 · §5.4 · §5.5 · §7
 *
 * 기준일은 2024-09-21 — E1 예측강우의 실제 Open-Meteo 응답이 확인된 날짜·좌표(02 §5.4).
 * ★ 시점 시각은 시나리오 편집값이다(02 §5.5). 실제 물리 지연·운영 임계치가 아니다.
 * ───────────────────────────────────────────── */

import type { Incident } from "../../model/incident";
import type { DemoTick } from "../../model/stage";
import { BASIN_SCOPE, DRAINAGE_BASIN_ID, SUBJECTS } from "./subjects";

export const INCIDENT_ID = "INC-2024-0921-SH01";
export const SCENARIO_DATE = "2024-09-21";

/** "17:14" → ISO (KST). fixture 안에서만 쓴다 */
export function t(hhmm: string): string {
  return `${SCENARIO_DATE}T${hhmm}:00+09:00`;
}

export const FIXTURE_GENERATED_AT = "2026-09-11T14:00:00+09:00";
export const SCENARIO_RULE = { id: "SCN-SH-FLOOD", version: "0.1.0" } as const;

/** 각 tick 의 시각은 그 조작이 남기는 업무 이벤트(workflow.ts)의 시각 이상이어야 한다 */
export const DEMO_TICKS: DemoTick[] = [
  { id: "d0", stage: 0, at: t("16:45"), label: "사전 감시 · 예측강우 상향 · 호우경보 · 사전 감시 알림", driver: "세계" },
  { id: "d1", stage: 1, at: t("17:14"), label: "관로 급상승 · 침수예측판 · 복합 징후 알림 · 후보 생성", driver: "세계" },
  { id: "d2-review", stage: 2, at: t("17:26"), label: "검토 인수 → 확인중", driver: "담당자" },
  { id: "d2-confirm", stage: 2, at: t("17:30"), label: "영상·근거 확인 → 확인됨", driver: "담당자" },
  { id: "d3", stage: 3, at: t("17:33"), label: "위험도 매트릭스·판단 갱신", driver: "세계" },
  { id: "d4", stage: 4, at: t("17:36"), label: "기준 전망 열기", driver: "담당자" },
  { id: "d5", stage: 5, at: t("17:39"), label: "대안 비교", driver: "담당자" },
  { id: "d6-review", stage: 6, at: t("17:44"), label: "이 전망으로 대응 검토 · 권고 생성", driver: "담당자" },
  { id: "d6-approve", stage: 6, at: t("17:47"), label: "대응안 승인 · 조치 배정 · 전파 → 대응중", driver: "담당자" },
  { id: "d7-failed", stage: 7, at: t("17:55"), label: "전파 결과 도착 · 마을방송 실패", driver: "세계" },
  { id: "d7-fallback", stage: 7, at: t("17:56"), label: "대체조치 기록 · 유선 연락", driver: "담당자" },
  { id: "d7-results", stage: 7, at: t("18:12"), label: "채널·현장 결과 도착", driver: "세계" },
  { id: "d7-control", stage: 7, at: t("18:40"), label: "확대 중단 · 통제로 전환", driver: "담당자" },
  { id: "d8-recede", stage: 8, at: t("20:55"), label: "수위 하강 · 물 빠짐 확인", driver: "세계" },
  { id: "d8-close", stage: 8, at: t("21:05"), label: "결과·보고서 · 종료", driver: "담당자" },
];

export const INCIDENT: Incident = {
  incidentId: INCIDENT_ID,
  title: "창원 검증 배수권역 복합침수 위험",
  hazardKind: "도시침수",
  twinFamily: "A",
  scopeKind: "구역",
  scope: BASIN_SCOPE,
  correlationKeys: [
    DRAINAGE_BASIN_ID, SUBJECTS.rainGauge, SUBJECTS.pipeLevel, SUBJECTS.roadLevel, SUBJECTS.pumpStation,
    SUBJECTS.retention, SUBJECTS.cctvPump, SUBJECTS.cctvPole, SUBJECTS.coastRoad, SUBJECTS.underpass,
  ],
  ownership: { organization: "재난안전 상황실", officer: "김상황", approver: "박실장", handover: "담당" },
  scenarioContext: { scenarioBaseTime: t("17:00"), scenarioMode: "혼합 데모", demoWindow: { from: t("16:00"), to: t("21:30") } },
  legacyDistrictId: "seohang",
};
