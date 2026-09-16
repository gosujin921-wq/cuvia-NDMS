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

/** 각 tick 의 시각은 그 조작이 남기는 업무 이벤트(workflow.ts)의 시각 이상이어야 한다.
 *
 *  D7 은 승인 한 번이면 끝까지 알아서 돈다 (2026-09-16 사용자 지시 "순서가 너무 복잡하고 길다" ·
 *  "주민전파를 하기 전에 다른 대응들은 완료되고 있으면" · "승인하면 그냥 알아서 완료"). 승인 뒤 [안정으로 전환]까지
 *  발표자가 누르는 칸이 없다. 대체조치(17:56)와 추가 승인(18:08, 박실장)은 담당자 결정이지만 시나리오가 기록하고
 *  세계 tick 에 실려 온다. 화면의 [대체조치]·재승인 기능은 그대로고, 이 시연에서 설 자리가 없을 뿐이다.
 *    승인 → 전파·도로 통제 결과 · 마을방송 실패는 유선 대체 중 · 심각 상향과 추가 2건 착수
 *         → 전부 완료 · 경계 하향 → [안정으로 전환] → 물 빠짐 → [종료]
 *  첫 묶음을 추가 승인(18:08) 뒤에 두는 이유: 그 앞에 멈추면 승인 대기 체크박스와 [대체조치]가 1.8초 동안 떠서
 *  누르라는 버튼처럼 보인다. 마지막 묶음은 하향(18:38)까지 넣는다. 안정 전환의 근거라 누르기 전에 보여야 한다(02 D7) */
export const DEMO_TICKS: DemoTick[] = [
  { id: "d0", stage: 0, at: t("16:45"), label: "사전 감시 · 예측강우 상향 · 호우경보 · 사전 감시 알림", driver: "세계" },
  { id: "d1", stage: 1, at: t("17:14"), label: "관로 급상승 · 침수예측판 · 복합 징후 알림 · 후보 생성", driver: "세계" },
  { id: "d2-review", stage: 2, at: t("17:26"), label: "검토 인수 → 확인중", driver: "담당자" },
  { id: "d2-confirm", stage: 2, at: t("17:30"), label: "사건 대응 → 대응중 · 자동 조치 실행", driver: "담당자" },
  { id: "d3", stage: 3, at: t("17:33"), label: "위험도 매트릭스·판단 갱신", driver: "세계" },
  { id: "d4", stage: 4, at: t("17:36"), label: "기준 전망 열기", driver: "담당자" },
  { id: "d5", stage: 5, at: t("17:39"), label: "대안 비교", driver: "담당자" },
  { id: "d6-review", stage: 6, at: t("17:44"), label: "이 전망으로 대응 검토 · 조치안 갱신", driver: "담당자" },
  { id: "d6-approve", stage: 6, at: t("17:47"), label: "대응안 승인 · 조치 배정 · 전파", driver: "담당자" },
  { id: "d7-escalate", stage: 7, at: t("18:08"), label: "전파·해안도로 통제 결과 · 마을방송 실패 유선 대체 · 심각 상향 · 추가 2건 승인·착수", driver: "세계" },
  { id: "d7-results", stage: 7, at: t("18:38"), label: "지하차도 차단·대피 안내·유선 연락 완료 · 펌프 2호기 재가동 · 경계 하향", driver: "세계" },
  { id: "d7-control", stage: 7, at: t("18:40"), label: "확대 중단 · 상황 안정", driver: "담당자" },
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
