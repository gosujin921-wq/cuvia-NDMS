/* ─────────────────────────────────────────────
 * 지난 사건 — 디지털트윈 대응 What-if 의 종료 사건 묶음 (03 §26 · 2026-09-16 사용자 "C~G 장면 … 지난 사건으로 넣으면 되잖아")
 *
 * 사건 없이 세웠던 C~G 개념 장면을 과거 종료 사건으로 옮겼다. 사건마다 원장의 주요 시점 · 실제 대응 · 실제 대응 기준 예측판 ·
 * 대응을 일찍 한 대안 예측판을 든다. 하천범람(B 창원천)은 지형 굽기가 있어 fixtures/changwoncheon 에 따로 있다.
 *
 *   C 해안월류     구항 방파제 월류        guhang.ts
 *   D 산불         무학산 산불             muhak.ts
 *   F 급경사지     교방동 급경사지 변위    gyobang.ts
 *   G 기반시설     서항 펌프장 정전 파급   pump-outage.ts
 *
 * E 폭염(heatwave.ts)은 목록에서 뺐다(2026-09-16 사용자 "대응조건이 필요없는 시뮬레이션이면 굳이 없어도 된다").
 * 폭염은 대응으로 현상이 바뀌지 않고, 쉼터 연장·순회는 일찍 할수록 그만큼 줄어드는 산수라 트윈이 계산할 것이 없다.
 * 파일은 유형 표현(격자 · 쉼터 접근권) 참고로만 남겨 두고 트윈 사건으로 싣지 않는다.
 *
 * 날짜·시각·수치는 전부 시나리오 편집값이다. 실제 사건 기록이 아니다.
 * ───────────────────────────────────────────── */

import type { Forecast } from "../../model/forecast";
import type { WhatIfCase } from "../../model/whatif";
import { GUHANG_FORECASTS, GUHANG_GEOMETRIES, GUHANG_WHATIF } from "./guhang";
import { MUHAK_FORECASTS, MUHAK_GEOMETRIES, MUHAK_WHATIF } from "./muhak";
import { GYOBANG_FORECASTS, GYOBANG_GEOMETRIES, GYOBANG_WHATIF } from "./gyobang";
import { PUMP_OUTAGE_FORECASTS, PUMP_OUTAGE_GEOMETRIES, PUMP_OUTAGE_WHATIF } from "./pump-outage";

export const PAST_WHATIF_CASES: WhatIfCase[] = [GUHANG_WHATIF, MUHAK_WHATIF, GYOBANG_WHATIF, PUMP_OUTAGE_WHATIF];
export const PAST_FORECASTS: Forecast[] = [...GUHANG_FORECASTS, ...MUHAK_FORECASTS, ...GYOBANG_FORECASTS, ...PUMP_OUTAGE_FORECASTS];
export const PAST_GEOMETRIES: Record<string, [number, number][]> = { ...GUHANG_GEOMETRIES, ...MUHAK_GEOMETRIES, ...GYOBANG_GEOMETRIES, ...PUMP_OUTAGE_GEOMETRIES };
