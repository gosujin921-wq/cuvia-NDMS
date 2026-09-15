/* ─────────────────────────────────────────────
 * 지구 호버 공유 — 목록 줄에 마우스를 올리면 지도 이름표가 같이 선다 (CSMS lib/site-hover 를 잇는다)
 *
 * ★ ScenarioProvider 에 넣지 않는다.
 *   호버는 초당 수십 번 바뀌는 값이라 엔진에 두면 useScenario 를 보는 모든 위젯이 마우스를 따라
 *   다시 그린다. 종합상황(scr-01) 한 화면 안에서 목록 ↔ 이름표만 공유하면 되므로 그 화면 루트에서만
 *   감싼다. Provider 밖에서는 항상 null 이라 아무 일도 안 일어난다.
 *
 * ★ 이름표는 정상 지구면 점만 남는다(IncidentMarkers). 목록에서 어느 줄을 가리키는지 지도에서 찾을
 *   길이 없어지므로, 목록 호버가 그 이름표를 "가리킨 것" 과 같은 상태(이름 표시 · 맨 위 층서 · 확대)로
 *   세운다.
 * ───────────────────────────────────────────── */

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface DistrictHover {
  hoveredDistrictId: string | null;
  setHoveredDistrictId: (districtId: string | null) => void;
}

const DistrictHoverContext = createContext<DistrictHover>({
  hoveredDistrictId: null,
  setHoveredDistrictId: () => {},
});

export function DistrictHoverProvider({ children }: { children: ReactNode }) {
  const [hoveredDistrictId, setHoveredDistrictId] = useState<string | null>(null);
  const value = useMemo(() => ({ hoveredDistrictId, setHoveredDistrictId }), [hoveredDistrictId]);
  return <DistrictHoverContext.Provider value={value}>{children}</DistrictHoverContext.Provider>;
}

export function useDistrictHover(): DistrictHover {
  return useContext(DistrictHoverContext);
}
