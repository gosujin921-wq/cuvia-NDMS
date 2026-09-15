/* 양덕 — 평시 지구 현황. 알림도 사건도 없이 관측만 정상 범위에서 움직인다 */
import type { DistrictFixture, SubjectSpec } from "./helpers";
import { districtIncident, districtSeries } from "./helpers";

const BASIN = "BASIN-YD-01";
const ADDR = "경남 창원시 마산회원구 양덕동";
const S: Record<string, SubjectSpec> = {
  "RN-YD-01": { loc: { kind: "지점", displayAnchor: [128.5852, 35.2272], label: "양덕 강우계" }, kind: "RN", spot: "양덕천 상류", address: ADDR },
  "PW-YD-02": { loc: { kind: "지점", displayAnchor: [128.5868, 35.2255], label: "양덕천 관로 수위계" }, kind: "WL", spot: "간선관로 맨홀", address: ADDR },
  "CV-YD-01": { loc: { kind: "지점", displayAnchor: [128.586, 35.2262], label: "양덕 배수구역 CCTV" }, kind: "CV", spot: "양덕천 교량", address: ADDR },
};
const KEYS = [BASIN];

export const YANGDEOK: DistrictFixture = {
  districtId: "yangdeok",
  incident: districtIncident({ incidentId: "INC-2024-0921-YD01", title: "양덕천 배수구역", hazardKind: "도시침수", twinFamily: "A", districtId: "yangdeok", organization: "재난안전 상황실", officer: "김상황",
    scope: { kind: "구역", displayAnchor: [128.586, 35.226], affectedGeometryId: "GEO-BASIN-YD-01", label: "양덕천 배수구역" }, keys: [BASIN, ...Object.keys(S)] }),
  subjects: S,
  events: [
    ...districtSeries(S, KEYS, { prefix: "EV-YD-E0", subject: "RN-YD-01", source: "창원 계측", unit: "mm/h", label: "강우강도", demoRef: "E0",
      rows: [["16:00", 1.5], ["17:00", 3.0], ["18:00", 5.5], ["19:00", 6.0], ["20:00", 4.0], ["21:00", 2.0]] }),
    ...districtSeries(S, KEYS, { prefix: "EV-YD-E4A", subject: "PW-YD-02", source: "창원 계측", unit: "m", label: "관로수위", demoRef: "E4a",
      rows: [["16:00", 0.38], ["17:00", 0.41], ["18:00", 0.49], ["19:00", 0.55], ["20:00", 0.5], ["21:00", 0.44]] }),
  ],
  alerts: [],
  cctv: [{ id: "CV-YD-01", label: "양덕 배수구역", scene: "양덕천 교량 · 배수구", calmStill: "/cctv/05_city_normal_03.jpg" }],
};
export const YANGDEOK_GEOMETRIES: Record<string, [number, number][]> = {
  "GEO-BASIN-YD-01": [[128.5835, 35.2285], [128.589, 35.2288], [128.5892, 35.2238], [128.5838, 35.2235]],
};
