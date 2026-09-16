/* ─────────────────────────────────────────────
 * 데모 컨트롤 · 발표자 전용 시간 경과 키 (숫자 9) · IDC DemoControls 문법
 *
 * 시간 경과 한 칸이다. 관측·결과가 도착하는 "세계" tick 만 밟고, 담당자 조작(검토 인수·확인·승인·
 * 통제·종료)이 다음 칸이면 아무 일도 없다 — 그건 화면 버튼이 밟는다(CLAUDE.md 상태 엔진).
 * 담당자 조작 뒤에 이어지는 세계 tick 은 엔진 타이머가 자동으로 민다(ScenarioProvider WORLD_TICK_MS, 2026-09-14).
 * 그래서 시연에서 9 를 누르는 자리는 시작(d0→d1) 하나뿐이고, 나머지는 리허설 복구용이다.
 * 되감기는 새로고침이다.
 *
 * 숫자 0(Phase 1 봉암 트랙 발사)은 2026-09-16 걷었다. Phase 2 화면 위에 Phase 1 유입 알람이 떴다.
 * 시연 시작은 9 하나다.
 *
 * 입력 중(input·textarea·contenteditable)에는 단축키가 먹지 않는다. 자연어 질의에
 * "9" 를 타이핑하다 시계가 넘어가면 안 된다.
 * ───────────────────────────────────────────── */

import { useEffect } from "react";
import { useScenario } from "../state/ScenarioProvider";

/** Phase 2 시간 경과 한 칸 */
const TICK_KEY = "9";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

export function DemoControls() {
  const { nextTick, nextIsWorld } = useScenario();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== TICK_KEY) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      if (nextIsWorld) nextTick();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nextTick, nextIsWorld]);

  /* 그릴 것이 없다. 시간 경과는 화면에 결과로만 나타난다 */
  return null;
}
