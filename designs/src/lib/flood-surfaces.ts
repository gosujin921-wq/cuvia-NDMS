/* ─────────────────────────────────────────────
 * 지형 수면 목록 — 침수면 이름 → 어느 지형 패치를 어떤 수위로 채우나
 *
 * 예측판 눈금은 침수면 이름(extentGeometryId)만 든다. 그 이름이 굽기 결과에 있으면 지형을 채운 3D 수면이 서고,
 * 없으면 예전처럼 평면 폴리곤이 선다. 화면은 유형(A·B)으로 가르지 않고 이 목록을 찾는다 — 새 지역을 구우면 여기 한 줄이 는다.
 *   서항(A 도시침수)   저지대 그릇 바닥에서 채운다. 해발 0 이하(바다)는 건너지 않는다
 *   창원천(B 하천범람) 하구 물길에서 채운다. 물길이 물이 오르는 통로라 물 칸을 건넌다
 * ───────────────────────────────────────────── */

import type { FloodSurfaceSpec } from "./flood-surface";
import { FLOOD_BOX, FLOOD_LEVELS, FLOOD_SEED } from "../fixtures/seohang-flood/geometry.generated";
import { CW_FLOOD_BOX, CW_FLOOD_LEVELS, CW_FLOOD_SEED, CW_PATCH_ID, CW_WATER_M } from "../fixtures/changwoncheon/geometry.generated";

export interface FloodSurfaceEntry {
  /** terrain-fine.json 의 패치 이름 */
  patchId: string;
  spec: FloodSurfaceSpec;
}

const SOURCES: { patchId: string; levels: Record<string, number>; seed: [number, number]; box: [number, number, number, number]; throughWaterM?: number }[] = [
  { patchId: "seohang", levels: FLOOD_LEVELS, seed: FLOOD_SEED, box: FLOOD_BOX },
  { patchId: CW_PATCH_ID, levels: CW_FLOOD_LEVELS, seed: CW_FLOOD_SEED, box: CW_FLOOD_BOX, throughWaterM: CW_WATER_M },
];

/** 침수면 이름으로 지형 수면을 찾는다. 굽지 않은 이름이면 null — 평면 폴리곤으로 그린다 */
export function floodSurfaceOf(geometryId: string | null | undefined): FloodSurfaceEntry | null {
  if (!geometryId) return null;
  for (const s of SOURCES) {
    const level = s.levels[geometryId];
    if (level !== undefined) return { patchId: s.patchId, spec: { level, seed: s.seed, box: s.box, throughWaterM: s.throughWaterM } };
  }
  return null;
}
