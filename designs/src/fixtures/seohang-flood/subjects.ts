/* ─────────────────────────────────────────────
 * 대표 사건 공간 주체 — 서항 검증 배수권역의 센서·CCTV·시설·도로·영향 폴리곤
 * 정본: 02 §4 · §5.3, IA §8
 *
 * 창원 GIS 원본과 시설 제원은 미확보다(02 §5.3). 좌표·식별자는 **시나리오 공간 데이터**이며 P0 매핑이
 * 오면 이 파일만 교체한다. 지구 중심은 Phase 1 demo/districts.ts 의 서항 근사값이다.
 * 완료보고 p.29 가 확인한 것: 서항 CCTV 1개소는 제2배수펌프장 옥상, 인접 1개소는 배수관리용 폴.
 * ───────────────────────────────────────────── */

import type { SpatialRef } from "../../model/event";
import type { Device } from "../../demo/devices";
import type { Facility } from "../../demo/facilities";

export const DRAINAGE_BASIN_ID = "BASIN-SH-01";

export const SUBJECTS = {
  rainGauge: "RN-SH-01",
  pipeLevel: "PW-SH-03",
  roadLevel: "RW-SH-07",
  tide: "TD-MS-01",
  pumpStation: "PS-SH-02",
  retention: "RT-SH-01",
  cctvPump: "CV-SH-01",
  cctvPole: "CV-SH-02",
  coastRoad: "RD-SH-COAST",
  underpass: "RD-SH-UNDER",
  alertArea: "KMA-AREA-CHANGWON",
  forecastGrid: "OM-GRID-SH",
} as const;

export type SubjectId = (typeof SUBJECTS)[keyof typeof SUBJECTS];

export const SEOHANG_CENTER: [number, number] = [128.567, 35.197];

export const SUBJECT_LOCATION: Record<SubjectId, SpatialRef> = {
  "RN-SH-01": { kind: "지점", displayAnchor: [128.5655, 35.1985], label: "서항 강우계" },
  "PW-SH-03": { kind: "지점", displayAnchor: [128.5672, 35.1972], label: "서항 간선관로 수위계" },
  "RW-SH-07": { kind: "지점", displayAnchor: [128.5661, 35.1963], label: "해안도로 저지대 도로수위계" },
  "TD-MS-01": { kind: "지점", displayAnchor: [128.5735, 35.1948], label: "마산항 서안 조위관측소" },
  "PS-SH-02": { kind: "시설", displayAnchor: [128.5678, 35.1958], label: "제2배수펌프장" },
  "RT-SH-01": { kind: "시설", displayAnchor: [128.5648, 35.1979], label: "서항 우수저류시설" },
  "CV-SH-01": { kind: "지점", displayAnchor: [128.5679, 35.1959], label: "제2배수펌프장 옥상 CCTV" },
  "CV-SH-02": { kind: "지점", displayAnchor: [128.5669, 35.1965], label: "배수관리용 폴 CCTV" },
  "RD-SH-COAST": { kind: "회랑", displayAnchor: [128.5663, 35.1961], affectedGeometryId: "GEO-ROAD-COAST", label: "해안도로 저지대 구간" },
  "RD-SH-UNDER": { kind: "시설", displayAnchor: [128.5641, 35.1968], affectedGeometryId: "GEO-UNDERPASS", label: "신포 지하차도" },
  "KMA-AREA-CHANGWON": { kind: "전역", displayAnchor: [128.6811, 35.2281], label: "창원시" },
  "OM-GRID-SH": { kind: "구역", displayAnchor: SEOHANG_CENTER, label: "서항 예측 격자" },
};

/** 사건 공간 — 적용 배수권역 (02 §4). 가칭이며 실제 배수권역 매핑 확인 전이다 */
export const BASIN_SCOPE: SpatialRef = {
  kind: "구역",
  displayAnchor: SEOHANG_CENTER,
  affectedGeometryId: "GEO-BASIN-SH-01",
  label: "서항 검증 배수권역 (가칭)",
};

/** 영향 폴리곤 [경도, 위도] 링 — 시연 표현용 시나리오 형상이며 모형 결과가 아니다 */
export const GEOMETRIES: Record<string, [number, number][]> = {
  "GEO-BASIN-SH-01": [[128.5625, 35.1995], [128.57, 35.1998], [128.5712, 35.195], [128.564, 35.194]],
  "GEO-ROAD-COAST": [[128.564, 35.1958], [128.569, 35.1966], [128.569, 35.1962], [128.564, 35.1954]],
  "GEO-UNDERPASS": [[128.5636, 35.1972], [128.5646, 35.1972], [128.5646, 35.1964], [128.5636, 35.1964]],
  "GEO-FLOOD-T10": [[128.5655, 35.1959], [128.567, 35.1962], [128.567, 35.1958], [128.5655, 35.1956]],
  "GEO-FLOOD-T30": [[128.5648, 35.1957], [128.568, 35.1965], [128.5681, 35.1957], [128.5648, 35.1953]],
  "GEO-FLOOD-T50": [[128.564, 35.1956], [128.5688, 35.1968], [128.569, 35.1955], [128.564, 35.1949]],
  "GEO-FLOOD-T80": [[128.5636, 35.1955], [128.5692, 35.197], [128.5694, 35.1953], [128.5636, 35.1947]],
  "GEO-FLOOD-DRAIN-T50": [[128.5648, 35.1957], [128.5678, 35.1964], [128.5679, 35.1957], [128.5648, 35.1953]],
  "GEO-FLOOD-DRAIN-T80": [[128.565, 35.1958], [128.5674, 35.1963], [128.5674, 35.1958], [128.565, 35.1955]],
};

/** CCTV 채널 — 스트립·영상 자리가 문다. 평시 컷은 Phase 1 실촬 자산 */
export interface CctvChannel {
  id: SubjectId;
  label: string;
  scene: string;
  calmStill: string;
}

export const CCTV_CHANNELS: CctvChannel[] = [
  { id: SUBJECTS.cctvPump, label: "제2배수펌프장 옥상", scene: "해안도로 방향 차로", calmStill: "/cctv/05_city_normal_01.jpg" },
  { id: SUBJECTS.cctvPole, label: "배수관리용 폴", scene: "펌프장 진입로·물양장", calmStill: "/cctv/03_harbor_calm_01.jpg" },
];

/* ── Phase 1 핀·팝업 부품 어댑터 ──
   DevicePin·EventPin·CctvBigView 는 Phase 1 `Device` 를 받는다. 부품을 복제하지 않고 주체를 그 모양으로
   옮겨 준다(CLAUDE.md "살짝 안 맞으면 감싼다"). 주소는 지구 단위까지만 쓴다 */
const ADDRESS = "경남 창원시 마산합포구 신포동";

export type SensorSubjectId = typeof SUBJECTS.rainGauge | typeof SUBJECTS.pipeLevel | typeof SUBJECTS.roadLevel | typeof SUBJECTS.tide | typeof SUBJECTS.cctvPump | typeof SUBJECTS.cctvPole;
export type FacilitySubjectId = typeof SUBJECTS.pumpStation | typeof SUBJECTS.retention;

const DEVICE_KIND: Record<SensorSubjectId, Device["kind"]> = {
  "RN-SH-01": "RN", "PW-SH-03": "WL", "RW-SH-07": "WL", "TD-MS-01": "TD", "CV-SH-01": "CV", "CV-SH-02": "CV",
};
const DEVICE_SPOT: Record<SensorSubjectId, string> = {
  "RN-SH-01": "펌프장 옥상", "PW-SH-03": "간선관로 맨홀", "RW-SH-07": "해안도로 저지대", "TD-MS-01": "마산항 서안", "CV-SH-01": "제2배수펌프장 옥상", "CV-SH-02": "배수관리용 폴",
};

export function isSensorSubject(id: string): id is SensorSubjectId {
  return id in DEVICE_KIND;
}
export function isFacilitySubject(id: string): id is FacilitySubjectId {
  return id === SUBJECTS.pumpStation || id === SUBJECTS.retention;
}

export function deviceOfSubject(id: SensorSubjectId, legacyDistrictId = "seohang"): Device {
  return { id, districtId: legacyDistrictId, kind: DEVICE_KIND[id], name: SUBJECT_LOCATION[id].label, spot: DEVICE_SPOT[id], address: ADDRESS, center: SUBJECT_LOCATION[id].displayAnchor, status: "정상" };
}

export function facilityOfSubject(id: FacilitySubjectId, legacyDistrictId = "seohang"): Facility {
  const pump = id === SUBJECTS.pumpStation;
  return { id, districtId: legacyDistrictId, kind: pump ? "pump" : "retention", name: SUBJECT_LOCATION[id].label, spot: pump ? "해안도로 배후" : "저지대 상류", center: SUBJECT_LOCATION[id].displayAnchor, deviceSpot: pump ? "제2배수펌프장 옥상" : "저지대 상류" };
}

/** 지도 맞춤 상한 — 사건 범위 종류별 (지점·시설은 더 들어가고, 전역은 시 전체) */
export const SCOPE_ZOOM: Record<SpatialRef["kind"], number> = { 지점: 16.5, 시설: 16.5, 회랑: 15.5, 구역: 15, 전역: 11 };
