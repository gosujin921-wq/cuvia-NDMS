/* 자동 생성 — scripts/derive-risk-districts.mjs (2026-09-17). 손으로 고치지 않는다.
 * 행정안전부 지역재해위험지구 **표본 101행**에서 뽑은 피해 당시 강우 분포. 창원 행은 없다(전체본이 오면 창원 값으로 바꾼다). */

/** 피해 당시 시간강우량(mm/h) 분포 · n=36 */
export const RISK_DISTRICT_HOURLY = {"n":36,"q25":50,"median":50,"q75":60,"max":100};
/** 피해 당시 일강우량(mm) 분포 · n=36 */
export const RISK_DISTRICT_DAILY = {"n":36,"q25":100,"median":200,"q75":210,"max":324};
/** 침수·내수·하천·외수 유형만의 시간강우 중앙값 · n=16 */
export const RISK_DISTRICT_FLOOD_HOURLY_MEDIAN = 50;
/** 화면 앵커 — 전국 표본 중앙값. "위험지구는 대체로 이 세기에서 피해가 났다" */
export const RISK_DISTRICT_DAMAGE_MM_PER_H = 50;
