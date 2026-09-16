/* 주남저수지 — 단일 심각 알림. 제방 수위계 하나가 심각 임계치를 넘어 알림이 서고 담당자 확인을 기다린다(01 §6.1 단일 심각).
   시연 시작(16:45)에는 기준 아래에 있다가 서항 후보(17:14, 9 키) 뒤인 17:20 에 넘는다. 시작 화면에는 주의 이하만 두고
   9 를 눌렀을 때 새로 서는 경계 이상은 서항 하나여야 한다(2026-09-16) */
import type { DistrictFixture, SubjectSpec } from "./helpers";
import { districtEvent, districtIncident, districtSeries, t } from "./helpers";

const RES = "RES-JN-01";
const ADDR = "경남 창원시 의창구 대산면";
const S: Record<string, SubjectSpec> = {
  "WL-JN-01": { loc: { kind: "지점", displayAnchor: [128.6865, 35.3168], label: "주남저수지 제방 수위계" }, kind: "WL", spot: "제방 여수로 측", address: ADDR },
  "RN-JN-01": { loc: { kind: "지점", displayAnchor: [128.6882, 35.3152], label: "주남 강우계" }, kind: "RN", spot: "관리사무소 옥상", address: ADDR },
  "CV-JN-01": { loc: { kind: "지점", displayAnchor: [128.6872, 35.3162], label: "주남저수지 제방 CCTV" }, kind: "CV", spot: "제방 상부", address: ADDR },
};
const KEYS = [RES];

export const JUNAM: DistrictFixture = {
  districtId: "junam",
  incident: districtIncident({ incidentId: "INC-2024-0921-JN01", title: "주남저수지 제방 수위 상승", hazardKind: "하천범람", twinFamily: "B", districtId: "junam", organization: "재난안전 상황실", officer: "김상황",
    scope: { kind: "시설", displayAnchor: [128.687, 35.316], label: "주남저수지 제방" }, keys: [RES, ...Object.keys(S)] }),
  subjects: S,
  events: [
    ...districtSeries(S, KEYS, { prefix: "EV-JN-WL", subject: "WL-JN-01", source: "창원 계측", unit: "m", label: "저수지 수위", demoRef: "E4a",
      rows: [["16:00", 5.02], ["16:20", 5.14], ["16:40", 5.26], ["17:00", 5.4], ["17:20", 5.58], ["17:30", 5.64], ["18:00", 5.74], ["18:30", 5.8], ["19:00", 5.79], ["19:30", 5.7], ["20:30", 5.52]] }),
    ...districtSeries(S, KEYS, { prefix: "EV-JN-E0", subject: "RN-JN-01", source: "창원 계측", unit: "mm/h", label: "강우강도", demoRef: "E0",
      rows: [["16:00", 3.0], ["17:00", 8.0], ["18:00", 14.0], ["19:00", 15.5], ["20:00", 9.0], ["21:00", 4.0]] }),
    districtEvent(S, KEYS, { id: "EV-JN-THR-01", type: "THRESHOLD_CROSSED", eventClass: "파생", producerRole: "CUVIA 규칙", source: "CUVIA 규칙", subject: "WL-JN-01", observedAt: t("17:20"), demoRef: "E5b",
      summary: "저수지 수위 심각 기준(5.55 m) 진입", measurement: { value: 5.55, unit: "m" }, derivedFrom: ["EV-JN-WL-05"],
      payload: { ruleId: "RULE-THRESHOLD-RESERVOIR", ruleVersion: "0.1", level: "심각", thresholdCm: 5.55 } }),
  ],
  alerts: [
    {
      alertId: "AL-J01", title: "저수지 수위 기준 초과", kind: "단일 심각", demoRole: "단일 심각 알림", grade: "심각", status: "생성", createdAt: t("17:20"), updatedAt: t("17:20"),
      target: S["WL-JN-01"].loc, task: "제방 수위 심각 기준 초과 · 실제 수위·제방 상태 확인 · 사건 후보 여부 결정",
      evidenceEventIds: ["EV-JN-THR-01"], forecastIds: [], reason: "제방 수위계 하나가 심각 기준(5.55 m)을 넘었다. 다른 근거 없이도 바로 봐야 하는 값이다", ruleId: "AR-SINGLE", ruleVersion: "0.1",
      suppression: { windowMin: 30, releaseCondition: "수위 심각 기준 이하 30분 유지" },
      updates: [{ at: t("17:20"), status: "생성", eventIds: ["EV-JN-THR-01"], note: "심각 임계치 초과 단일 근거" }, { at: t("20:30"), status: "해제", eventIds: ["EV-JN-WL-11"], note: "수위 하강 · 기준 이하" }],
      createdIncident: false,
    },
  ],
  cctv: [{ id: "CV-JN-01", label: "주남저수지 제방", scene: "제방 · 여수로", calmStill: "/cctv/01_reservoir_calm_01.jpg" }],
};
