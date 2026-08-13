/* ─────────────────────────────────────────────
 * 트윈이 남기는 것 — 두 갈래 (02 §2 · 03 §5)
 *
 *   review   사건 연계 분석의 **검토 기록**. [영향 검토 완료 · 대응 판단으로]가 쓰고
 *            SCR-02 가 읽어 "검토 완료"와 그 근거를 세운다. 사건 하나에 최신 하나.
 *   drills   사전 모의분석의 결과. [모의분석 결과 저장]이 쌓는다. 목록으로 남고 끝이다.
 *
 * ★ 검토 기록은 사건의 값을 바꾸지 않는다. SOP 를 정하는 것은 재난유형(목록)·승인
 *   대응등급(활성 범위)·정본 데이터(대상 인원·수단·기관) 셋이고 셋 다 트윈 밖에 있다.
 *   사건 상태를 실제로 바꾸는 행위는 SCR-02 의 [대응등급 대피로 상향] 승인 하나뿐이다.
 *   여기 쌓이는 것은 "언제 누가 무엇을 근거로 검토했다"는 사실이다.
 *
 * ★ 두 갈래를 한 통에 담지 않는다. 훈련으로 만든 숫자와 실제 사건의 판단 근거가 같은
 *   자리에 있으면, 읽는 쪽이 실수 한 번으로 섞는다. 04 집계·사후 분석이 오염되는 사고는
 *   보통 그렇게 난다. drills 는 어떤 사건 id 도 들고 있지 않아 애초에 붙을 데가 없다.
 *
 * ★ 임시 거처다. 시연 중 변하는 값의 단일 source of truth 는 ScenarioProvider 이고
 *   (CLAUDE.md · 04 §0), 이 값도 결국 거기로 접혀 들어가야 한다. 접을 때 할 일: 아래 두
 *   state 를 Provider 의 useState 로 옮기고 훅을 useScenario() 필드로 바꾼다.
 *
 * 새로고침 = 리셋. 모듈 state 라 그냥 사라지고, 그것이 04 §0 의 리셋 규칙과 같다.
 * ───────────────────────────────────────────── */

import { useSyncExternalStore } from "react";
import type { AnalysisReview, DrillSnapshot } from "../demo/analysis";

let review: AnalysisReview | null = null;
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

/* ── 사건 연계 검토 기록 ─────────────────────────────── */

/** 검토를 사건에 붙인다. 같은 사건을 다시 검토하면 마지막 것이 남는다 */
export function recordReview(next: AnalysisReview) {
  review = next;
  emit();
}

/** 이 사건의 트윈 검토 기록. eventId 를 주면 그 사건 것일 때만 돌려준다 */
export function useAnalysisReview(eventId?: string): AnalysisReview | null {
  const current = useSyncExternalStore(
    subscribe,
    () => review,
    () => review,
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
