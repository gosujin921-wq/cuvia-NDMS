/* 구항 — 수위계 결측. 17:08 부터 방파제 수위계가 끊겨 품질·대체 확인 알림이 서고 18:35 복구된다. 사건은 없다 */
import type { DistrictFixture, SubjectSpec } from "./helpers";
import { districtEvent, districtIncident, districtSeries, t } from "./helpers";

const HB = "HB-GH-01";
const ADDR = "경남 창원시 마산합포구 동성동";
const S: Record<string, SubjectSpec> = {
  "WL-GH-01": { loc: { kind: "지점", displayAnchor: [128.5752, 35.2028], label: "구항 방파제 수위계" }, kind: "WL", spot: "방파제 끝단", address: ADDR },
  "TD-GH-01": { loc: { kind: "지점", displayAnchor: [128.5768, 35.2012], label: "구항 조위계" }, kind: "TD", spot: "물양장", address: ADDR },
  "CV-GH-01": { loc: { kind: "지점", displayAnchor: [128.5758, 35.2022], label: "구항 방파제 CCTV" }, kind: "CV", spot: "방파제 등대", address: ADDR },
};
const KEYS = [HB];

export const GUHANG: DistrictFixture = {
  districtId: "guhang",
  incident: districtIncident({ incidentId: "INC-2024-0921-GH01", title: "구항 방파제 월류 감시", hazardKind: "해안월류", twinFamily: "C", districtId: "guhang", organization: "재난안전 상황실", officer: "김상황",
    scope: { kind: "시설", displayAnchor: [128.576, 35.202], label: "구항 방파제" }, keys: [HB, ...Object.keys(S)] }),
  subjects: S,
  events: [
    ...districtSeries(S, KEYS, { prefix: "EV-GH-WL", subject: "WL-GH-01", source: "창원 계측", unit: "EL.m", label: "수위", demoRef: "E4a",
      rows: [["16:00", 2.31], ["16:20", 2.4], ["18:40", 2.88], ["19:00", 2.84], ["19:30", 2.7], ["20:00", 2.52], ["21:00", 2.2]] }),
    ...districtSeries(S, KEYS, { prefix: "EV-GH-TD", subject: "TD-GH-01", source: "해양 데이터", unit: "cm", label: "실측조위", demoRef: "E3b",
      rows: [["16:20", 116], ["16:50", 130], ["17:20", 149], ["17:50", 164], ["18:20", 173], ["18:50", 170], ["19:20", 158], ["19:50", 141], ["20:20", 122], ["20:50", 104]] }),
    districtEvent(S, KEYS, { id: "EV-GH-Q-01", type: "DATA_QUALITY_CHANGED", eventClass: "파생", producerRole: "CUVIA 규칙", source: "CUVIA 품질 규칙", subject: "WL-GH-01", observedAt: t("16:38"), quality: "결측", demoRef: "E10",
      summary: "방파제 수위계 18분 미수신 · 결측", derivedFrom: ["EV-GH-WL-02"], payload: { ruleId: "RULE-QUALITY-GAP", ruleVersion: "0.1", state: "결측", gapMin: 18 } }),
    districtEvent(S, KEYS, { id: "EV-GH-Q-02", type: "DATA_QUALITY_CHANGED", eventClass: "파생", producerRole: "CUVIA 규칙", source: "CUVIA 품질 규칙", subject: "WL-GH-01", observedAt: t("18:40"), demoRef: "E10",
      summary: "방파제 수위계 수신 복구", supersedes: "EV-GH-Q-01", derivedFrom: ["EV-GH-WL-03"], payload: { ruleId: "RULE-QUALITY-GAP", ruleVersion: "0.1", state: "복구", gapMin: 0 } }),
  ],
  alerts: [
    {
      alertId: "AL-G01", kind: "품질·연계", demoRole: "품질·대체 확인 알림", grade: "주의", status: "생성", createdAt: t("16:38"), updatedAt: t("16:38"),
      target: S["WL-GH-01"].loc, task: "방파제 수위계 결측 · 조위계·CCTV 로 대체 확인 · 현장 점검 요청 검토",
      evidenceEventIds: ["EV-GH-Q-01"], forecastIds: [], reason: "만조(18:24) 전에 방파제 수위계가 끊겨 월류 감시를 판단할 수 없다. 조위계와 CCTV로 대신 본다", ruleId: "AR-QUALITY", ruleVersion: "0.1",
      suppression: { windowMin: 15, releaseCondition: "수신 복구" },
      updates: [{ at: t("16:38"), status: "생성", eventIds: ["EV-GH-Q-01"], note: "18분 미수신" }, { at: t("18:40"), status: "해제", eventIds: ["EV-GH-Q-02"], note: "수신 복구" }],
      createdIncident: false,
    },
  ],
  cctv: [{ id: "CV-GH-01", label: "구항 방파제", scene: "방파제 · 물양장", calmStill: "/cctv/03_harbor_calm_02.jpg" }],
};
