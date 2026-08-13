/* ─────────────────────────────────────────────
 * 질의 진입 버튼 — 03 화면정의서 §1 · 04 §14
 *
 * 종합상황(SCR-01)에는 자연어 질의 바가 하단 중앙에 펼쳐져 서 있고, 나머지 화면에서는
 * 이 원형 버튼이 우측 하단에 떠서 같은 자리로 데려간다. 화면을 옮겨도 "말로 묻는 길"이
 * 늘 같은 자리에 있어야 담당자가 찾지 않는다.
 *
 * 예외는 좌우 레일이 선 지도·3D 화면(SCR-02·05)이다. 거기서는 우측 레일 왼쪽으로 비켜
 * 가운데 영역의 우하단에 서고, 하단 도크가 있으면(SCR-02) 그 위로 한 칸 더 올라간다 —
 * 자리를 옮긴 것이 아니라 가려서 못 읽히는 카드를 피한 것이고, 기하는 레일 기하와 함께
 * lib/layout.ts 가 들고 있다.
 *
 * 심볼과 브랜드 그라디언트는 DS 자산 그대로다 — 질의는 CUVIA 의 기능이라 화면마다
 * 다른 아이콘으로 부르지 않는다(03 §1 브랜드 글로우와 같은 원칙).
 * ───────────────────────────────────────────── */

import { useNavigate } from "react-router-dom";
import { cn } from "@ds";
import symbolUrl from "@cuvia/assets/symbol.svg";
import { FAB_SLOT, FAB_SLOT_DOCK, FAB_SLOT_RAIL } from "../lib/layout";

interface AgentFabProps {
  /** 좌우 레일이 선 지도·3D 화면 — 우측 레일 왼쪽으로 비켜 선다 */
  rails?: boolean;
  /** 하단 중앙 도크(현장영상)까지 선 화면 — 거기서 도크 위로 올라간다 */
  overDock?: boolean;
}

export function AgentFab({ rails = false, overDock = false }: AgentFabProps) {
  const navigate = useNavigate();
  const slot = overDock ? FAB_SLOT_DOCK : rails ? FAB_SLOT_RAIL : FAB_SLOT;

  return (
    <button
      type="button"
      onClick={() => navigate("/scr-06")}
      aria-label="AI 검색으로 이동"
      className={cn(
        "fixed z-40 flex size-12 cursor-pointer items-center justify-center",
        "rounded-full border-none shadow-lg transition-transform hover:scale-105 active:scale-95",
      )}
      style={{ background: "var(--gradient-brand)", right: slot.right, bottom: slot.bottom }}
    >
      <img src={symbolUrl} alt="" className="block size-6 shrink-0" />
    </button>
  );
}
