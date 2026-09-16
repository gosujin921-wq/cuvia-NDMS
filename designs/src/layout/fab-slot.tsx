/* ─────────────────────────────────────────────
 * CUVIA 질의 버튼 자리 — 화면이 자기 자리를 알린다
 *
 * 버튼 자리는 원래 경로(nav.ts 의 fullBleed · bottomDock)로 정했다. 그런데 한 경로 안에서도 탭에 따라
 * 우측 레일이 서기도 하고 안 서기도 한다 — 디지털트윈의 사건 분석 화면은 레일이 있고 `사건` 목록·`저장된 분석`은 없다.
 * 경로만 보면 레일 없는 탭에서도 버튼이 레일 왼쪽(가운데 아래)에 떠서 페이지네이션을 가린다(2026-09-15 사용자).
 *
 * 그래서 화면이 지금 모양을 셸에 알린다. 알리지 않은 화면은 예전처럼 경로 기본값을 쓴다.
 * 셸이 화면을 들여다보고 탭 이름으로 갈래를 치지 않는다(CLAUDE.md "시연 트랙으로 갈래를 만들지 않는다"와 같은 이유).
 * ───────────────────────────────────────────── */

import { createContext, useContext, useEffect } from "react";

/** 화면 우하단 · 가운데 영역 우하단(우측 레일 왼쪽) · 도크 위 · 훈련 시계 위 */
export type FabSlotKind = "screen" | "rail" | "dock" | "clock";

const FabSlotContext = createContext<(kind: FabSlotKind | null) => void>(() => {});

/** 셸이 화면 트리를 이것으로 감싼다 */
export const FabSlotProvider = FabSlotContext.Provider;

/** 화면이 부른다. 떠나면 경로 기본값으로 돌아간다 */
export function useFabSlot(kind: FabSlotKind | null) {
  const set = useContext(FabSlotContext);
  useEffect(() => {
    set(kind);
    return () => set(null);
  }, [set, kind]);
}
