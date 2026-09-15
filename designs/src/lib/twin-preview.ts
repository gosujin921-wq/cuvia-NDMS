/* ─────────────────────────────────────────────
 * 비교와 결정의 분리 — 대응 버튼은 "하면 어떻게 되나"의 미리보기이고, 결정 기록만이 "내가 선택했다"다 (2026-09-15 사용자)
 *
 * 예측판(fixture)은 대안이 실행된 세계를 적어 둔다("통제됨"). 결정 전에는 그 말을 그대로 쓰면 구경한 건지 결정한 건지 섞인다.
 * 그래서 화면에 올리기 전에 한 번 바꾼다 — 통제됨 → 통제 시 · 통제 가정. 결정을 기록한 대응부터 원래 말이 돌아온다.
 * 값은 안 바꾼다. 말만 바꾼다.
 * ───────────────────────────────────────────── */

import type { ImpactTarget } from "../model/forecast";
import type { SceneLayer } from "../model/scene";

/** 지도 장면 — 상태·라벨의 "통제됨/통제 중"을 가정 표현으로 */
export function previewScene(layers: SceneLayer[]): SceneLayer[] {
  return layers.map((l) => {
    if (l.kind === "line" && l.label) return { ...l, label: l.label.replace("통제됨", "통제 시") };
    if (l.kind === "point" && l.state) return { ...l, state: l.state.replace("통제됨", "통제 시").replace("통제 중", "통제 가정") };
    return l;
  });
}

/** 비교표 상태 — 결정 전 대응 열의 "통제됨"은 대상 종류에 맞는 가정 문구로 */
export function previewExposure(t: ImpactTarget): string {
  if (t.exposure !== "통제됨") return t.exposure;
  switch (t.kind) {
    case "중요시설": return "진입 통제 가정";
    case "대상자": return "노출 제거 가정";
    default: return "통제 가정";
  }
}
