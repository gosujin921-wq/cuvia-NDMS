/* ─────────────────────────────────────────────
 * 대응 모의훈련 조건 세트 — 유형군별 묶음 (03 §5 · §16)
 *
 *   A 도시 배수·침수   서항 배수권역   seohang-flood/training.ts (대표 데모 예측판 재사용)
 *   B 하천 흐름·범람   주남저수지     junam.ts
 *   C 해안 경계·월류   구항 방파제     guhang.ts
 *   D·F·G             정적 개념 장면 한 벌씩   concepts.ts (사건 없음 · 03 §16 "정적 개념 예시")
 *   E 대기·면 노출     창원 도심 생활권 격자   heat.ts (열돔 지구본은 광역 인셋으로 내려갔다)
 *
 * 예측판은 전부 사전 작성 시나리오 결과 세트다. 조건에서 값을 계산하는 코드는 없다.
 * ───────────────────────────────────────────── */

import type { Forecast } from "../../model/forecast";
import type { TrainingConditionSet, TrainingRegion } from "../../model/training";
import { CONDITION_FORECASTS as SEOHANG_CONDITION_FORECASTS, TRAINING_CONDITION_SETS as SEOHANG_CONDITION_SETS } from "../seohang-flood/training";
import { JUNAM_CONDITION_FORECASTS, JUNAM_CONDITION_SETS, JUNAM_GEOMETRIES } from "./junam";
import { GUHANG_CONDITION_FORECASTS, GUHANG_CONDITION_SETS, GUHANG_GEOMETRIES } from "./guhang";
import { CONCEPT_FORECASTS, CONCEPT_GEOMETRIES, CONCEPT_SETS } from "./concepts";
import { HEAT_CONDITION_FORECASTS, HEAT_CONDITION_SETS, HEAT_GEOMETRIES } from "./heat";

export const CONDITION_FORECASTS: Forecast[] = [...SEOHANG_CONDITION_FORECASTS, ...JUNAM_CONDITION_FORECASTS, ...GUHANG_CONDITION_FORECASTS, ...CONCEPT_FORECASTS, ...HEAT_CONDITION_FORECASTS];
export const TRAINING_CONDITION_SETS: TrainingConditionSet[] = [...SEOHANG_CONDITION_SETS, ...JUNAM_CONDITION_SETS, ...GUHANG_CONDITION_SETS, ...CONCEPT_SETS, ...HEAT_CONDITION_SETS];
export const TRAINING_GEOMETRIES: Record<string, [number, number][]> = { ...JUNAM_GEOMETRIES, ...GUHANG_GEOMETRIES, ...CONCEPT_GEOMETRIES, ...HEAT_GEOMETRIES };

/**
 * 훈련 지역 후보 — 유형별 대상지. 예측판이 있는 지역은 조건 세트가 붙고, 나머지는 이름만 선다(셀렉트에서 disabled).
 * 실개발에서는 배수권역·하천 구간·해안 구간·산림·급경사지·시설 기준 데이터가 이 목록이 된다.
 * 사건이 있는 후보(봉암천·양덕천)는 fixture 사건의 범위를, 없는 후보는 이름만 든다 — 데모 후보명이며 확정 대상지가 아니다.
 */
export const TRAINING_REGIONS: TrainingRegion[] = [
  { regionId: "seohang", twinFamily: "A", label: "서항 검증 배수권역", incidentId: "INC-2024-0921-SH01" },
  { regionId: "bongam", twinFamily: "A", label: "봉암천 배수구역", incidentId: "INC-2024-0921-BA01" },
  { regionId: "yangdeok", twinFamily: "A", label: "양덕천 배수구역", incidentId: "INC-2024-0921-YD01" },
  { regionId: "junam", twinFamily: "B", label: "주남저수지 제방", incidentId: "INC-2024-0921-JN01" },
  { regionId: "changwoncheon", twinFamily: "B", label: "창원천 하류 구간" },
  { regionId: "guhang", twinFamily: "C", label: "구항 방파제", incidentId: "INC-2024-0921-GH01" },
  { regionId: "seohang-coast", twinFamily: "C", label: "서항 해안도로 저지대" },
  { regionId: "muhak", twinFamily: "D", label: "무학산 산자락" },
  { regionId: "palyong", twinFamily: "D", label: "팔용산 산림" },
  { regionId: "changwon-city", twinFamily: "E", label: "창원 도심 생활권" },
  { regionId: "masan-old", twinFamily: "E", label: "마산 원도심 생활권" },
  { regionId: "gyobang", twinFamily: "F", label: "교방동 급경사지" },
  { regionId: "jangbok", twinFamily: "F", label: "장복산 급경사지" },
  { regionId: "seohang-pump", twinFamily: "G", label: "서항 펌프장 전력·통신 계통" },
  { regionId: "bongam-pump", twinFamily: "G", label: "봉암 배수펌프장 계통" },
];
