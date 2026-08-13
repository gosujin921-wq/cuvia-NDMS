/* ─────────────────────────────────────────────
 * 데모 컨트롤 · 발표자 전용 발사 키 (숫자 0) · 정본: 04 §0-2 · IDC DemoControls 문법
 *
 * 구현된 편이 봉암(8/13) 하나뿐이라 고를 것이 없다. 조작판을 열고 한 줄짜리 목록에서
 * 그 한 줄을 누르는 동작은 발사를 한 박자 늦추기만 한다 — 0 을 누르면 곧바로 봉암
 * 트랙이 발사되고, 화면에는 유입 알람부터 나타난다.
 *
 * 서항 트랙은 앱이 열릴 때의 초기 상태라 돌아가는 길은 새로고침이다. 편이 둘 이상으로
 * 늘면 그때 목록을 되살린다(git log 에 조작판 판본이 있다).
 *
 * 시나리오 진행(격상 · 권고 · 승인 · 실행 · 시계 점프 · 에필로그)은 이 키가 아니라
 * 화면 조작이 맡는다 — 지구 클릭 · 팝업 열기 · 트윈 진입 · 승인 · 화면 이동이 엔진의
 * advanceTo 를 밟는다. 조작판에 같은 이벤트를 한 벌 더 두면 두 길이 갈라진다.
 * 같은 트랙 재발사(0 을 다시 누르기)가 곧 되감기라 리허설 복구 수단이 된다.
 *
 * 입력 중(input·textarea·contenteditable)에는 단축키가 먹지 않는다. 자연어 질의에
 * "0" 을 타이핑하다 트랙이 발사되면 안 된다.
 * ───────────────────────────────────────────── */

import { useEffect } from "react";
import { useScenario } from "../state/ScenarioProvider";

const LAUNCH_KEY = "0";

/** 이 키가 쏘는 편 (04 §15). 편이 늘면 목록 UI 로 되돌린다 */
const LAUNCH_TRACK = "bongam" as const;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

export function DemoControls() {
  const { launchTrack } = useScenario();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== LAUNCH_KEY) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      launchTrack(LAUNCH_TRACK);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [launchTrack]);

  /* 그릴 것이 없다 — 발사는 화면에 결과로만 나타난다 */
  return null;
}
