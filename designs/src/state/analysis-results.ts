/* ─────────────────────────────────────────────
 * 트윈 분석 결과 보관 — 두 갈래 (02 §2 · 03 §5)
 *
 *   appliedAnalysis  사건 연계 분석의 결과. [분석 결과를 사건에 반영]이 쓰고 SCR-02 가
 *                    읽어 권고 대응·SOP 대상을 구체화한다. 사건 하나에 최신 하나.
 *   drills           사전 모의분석의 결과. [모의분석 결과 저장]이 쌓는다. 목록으로 남고
 *                    끝이다.
 *
 * ★ 두 갈래를 한 통에 담지 않는다. 훈련으로 만든 숫자와 실제 사건의 판단 근거가 같은
 *   자리에 있으면, 읽는 쪽이 실수 한 번으로 섞는다. 04 집계·사후 분석이 오염되는 사고는
 *   보통 그렇게 난다. drills 는 어떤 사건 id 도 들고 있지 않아 애초에 붙을 데가 없다.
 *
 * ★ 임시 거처다. 시연 중 변하는 값의 단일 source of truth 는 ScenarioProvider 이고
 *   (CLAUDE.md · 04 §0), 이 값도 결국 거기로 접혀 들어가야 한다. 지금 분리해 둔 것은
 *   ScenarioProvider 가 다른 작업으로 열려 있어 같은 파일을 동시에 고칠 수 없어서다.
 *   접을 때 할 일: 아래 두 state 를 Provider 의 useState 로 옮기고 훅을 useScenario()
 *   필드로 바꾼다. 호출부는 SCR-05 한 곳과 앞으로의 SCR-02 한 곳뿐이다.
 *
 * 새로고침 = 리셋. 모듈 state 라 그냥 사라지고, 그것이 04 §0 의 리셋 규칙과 같다.
 * ───────────────────────────────────────────── */

import { useSyncExternalStore } from "react";
import type { AnalysisSnapshot, DrillSnapshot } from "../demo/analysis";

let applied: AnalysisSnapshot | null = null;
let drills: DrillSnapshot[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* ── 사건 연계 ───────────────────────────────────────── */

/** 분석 결과를 사건에 붙인다. 같은 사건을 다시 분석하면 마지막 것이 남는다 */
export function applyAnalysis(next: AnalysisSnapshot) {
  applied = next;
  emit();
}

/** 이 사건에 반영된 분석 결과. eventId 를 주면 그 사건 것일 때만 돌려준다 */
export function useAppliedAnalysis(eventId?: string): AnalysisSnapshot | null {
  const current = useSyncExternalStore(
    subscribe,
    () => applied,
    () => applied,
  );
  if (!current) return null;
  if (eventId && current.eventId !== eventId) return null;
  return current;
}

/* ── 사전 모의분석 ───────────────────────────────────── */

/** 모의분석안을 쌓는다. 최신이 앞에 선다 — 사건 원장에는 닿지 않는다 */
export function saveDrill(next: DrillSnapshot) {
  drills = [next, ...drills];
  emit();
}

/** 이번 시연에서 저장한 모의분석안. 지구를 주면 그 지구 것만 */
export function useDrills(districtId?: string): DrillSnapshot[] {
  const current = useSyncExternalStore(
    subscribe,
    () => drills,
    () => drills,
  );
  return districtId ? current.filter((drill) => drill.districtId === districtId) : current;
}
