/* 봉암 — 감시 우선구역. 호우경보·배수취약으로 사전 감시 알림만 서고 사건은 생기지 않는다. 관측은 완만한 상승 */
import type { DistrictFixture, SubjectSpec } from "./helpers";
import { districtEvent, districtIncident, districtSeries, t } from "./helpers";

const BASIN = "BASIN-BA-01";
const ADDR = "경남 창원시 마산회원구 봉암동";
const S: Record<string, SubjectSpec> = {
  "RN-BA-01": { loc: { kind: "지점", displayAnchor: [128.6005, 35.2205], label: "봉암 강우계" }, kind: "RN", spot: "봉암천 배수구역 상류", address: ADDR },
  "PW-BA-02": { loc: { kind: "지점", displayAnchor: [128.6018, 35.2188], label: "봉암천 간선관로 수위계" }, kind: "WL", spot: "간선관로 맨홀", address: ADDR },
  "RW-BA-04": { loc: { kind: "지점", displayAnchor: [128.6026, 35.2178], label: "봉암 지하차도 도로수위계" }, kind: "WL", spot: "지하차도 진입부", address: ADDR },
  "CV-BA-01": { loc: { kind: "지점", displayAnchor: [128.6012, 35.2182], label: "봉암 배수문 CCTV" }, kind: "CV", spot: "배수문 상부", address: ADDR },
  "PS-BA-01": { loc: { kind: "시설", displayAnchor: [128.6022, 35.2172], label: "봉암 배수펌프장" }, facility: "pump", spot: "봉암천 하류", address: ADDR },
};
const KEYS = [BASIN, "KMA-AREA-CHANGWON"];

export const BONGAM: DistrictFixture = {
  districtId: "bongam",
  incident: districtIncident({ incidentId: "INC-2024-0921-BA01", title: "봉암천 배수구역 침수 감시", hazardKind: "도시침수", twinFamily: "A", districtId: "bongam", organization: "재난안전 상황실", officer: "김상황",
    scope: { kind: "구역", displayAnchor: [128.601, 35.219], affectedGeometryId: "GEO-BASIN-BA-01", label: "봉암천 배수구역" }, keys: [BASIN, ...Object.keys(S), "KMA-AREA-CHANGWON"] }),
  subjects: S,
  events: [
    ...districtSeries(S, KEYS, { prefix: "EV-BA-E0", subject: "RN-BA-01", source: "창원 계측", unit: "mm/h", label: "강우강도", demoRef: "E0",
      rows: [["16:00", 2.0], ["16:30", 3.5], ["17:00", 5.0], ["17:30", 7.5], ["18:00", 9.0], ["18:30", 11.0], ["19:00", 12.0], ["19:30", 10.5], ["20:00", 8.0], ["20:30", 5.5], ["21:00", 3.0]] }),
    ...districtSeries(S, KEYS, { prefix: "EV-BA-E4A", subject: "PW-BA-02", source: "창원 계측", unit: "m", label: "관로수위", demoRef: "E4a",
      rows: [["16:00", 0.42], ["16:30", 0.45], ["17:00", 0.52], ["17:30", 0.63], ["18:00", 0.78], ["18:30", 0.94], ["19:00", 1.08], ["19:30", 1.12], ["20:00", 1.02], ["20:30", 0.86], ["21:00", 0.7]] }),
    ...districtSeries(S, KEYS, { prefix: "EV-BA-E5A", subject: "RW-BA-04", source: "창원 계측", unit: "cm", label: "도로수위", demoRef: "E5a",
      rows: [["16:00", 0], ["17:00", 0], ["18:00", 0], ["19:00", 1], ["20:00", 0], ["21:00", 0]] }),
    districtEvent(S, KEYS, { id: "EV-BA-E6A-01", type: "FACILITY_STATE_CHANGED", eventClass: "원천", producerRole: "원천 기관", source: "시설물 시스템", subject: "PS-BA-01", observedAt: t("16:30"), demoRef: "E6a",
      summary: "봉암 배수펌프장 가동 3/3", payload: { unit: "전체", state: "가동", available: 3, total: 3, cause: null } }),
  ],
  alerts: [
    {
      alertId: "AL-B01", title: "호우경보 · 배수취약 구역", kind: "공식 상황", demoRole: "사전 감시 알림", grade: "주의", status: "생성", createdAt: t("16:40"), updatedAt: t("16:40"),
      target: { kind: "구역", displayAnchor: [128.601, 35.219], affectedGeometryId: "GEO-BASIN-BA-01", label: "봉암천 배수구역" }, task: "감시 우선구역 · 카메라 1 · 센서 3 우선 확인 · 지하차도 진입부 주시",
      evidenceEventIds: ["EV-E2-02", "EV-E1-01"], forecastIds: [], reason: "호우경보가 내려졌고 예측강우가 올라가는데, 지하차도 저지대가 있는 배수취약 권역이라 먼저 봐야 한다", ruleId: "AR-WATCH", ruleVersion: "0.1",
      suppression: { windowMin: 120, releaseCondition: "특보 해제 또는 예측강우 하향" },
      updates: [{ at: t("16:40"), status: "생성", eventIds: ["EV-E2-02"], note: "호우경보 변경으로 감시 조건 충족" }, { at: t("21:05"), status: "해제", eventIds: [], note: "예측강우 하향 · 감시 해제" }],
      createdIncident: false,
    },
  ],
  cctv: [{ id: "CV-BA-01", label: "봉암 배수문", scene: "배수문 · 봉암천 하류", calmStill: "/cctv/05_city_normal_02.jpg" }],
};
export const BONGAM_GEOMETRIES: Record<string, [number, number][]> = {
  "GEO-BASIN-BA-01": [[128.5985, 35.2215], [128.6045, 35.2218], [128.6048, 35.2165], [128.599, 35.2162]],
};
