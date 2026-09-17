/* ─────────────────────────────────────────────
 * SOP 자동 항목 순차 표시 (2026-09-17 사용자 지시 "이미 채워져있는게 아니라 하나씩 채워지게")
 *
 * 원장은 자동 조치를 한 시각에 전부 완료로 적는다(selectors sopItemsAt). 화면이 그 값을 그대로 그리면 팝업을
 * 여는 순간 이미 다 차 있어 "시스템이 방금 돌렸다"가 안 보인다. 이 훅은 값을 바꾸지 않고 **보이는 순서만** 늦춘다.
 * 완료로 막 바뀐 자동 항목을 줄 세워 맨 앞 하나는 진행 중, 나머지는 대기로 보이고 한 칸씩 완료로 넘긴다.
 *
 * 한 번 보인 완료는 세션 안에서 다시 돌지 않는다(모듈 상태 · 새로고침이 리셋). 팝업을 닫았다 열어도 되감지 않는다.
 * 수동 항목은 손대지 않는다. 그쪽 진행은 세계 tick 이 결과로 민다.
 * ───────────────────────────────────────────── */

import { useEffect, useState } from "react";
import type { SopItem } from "../../../model/sop";

const REVEAL_STEP_MS = 700;

/** 이미 완료로 보여 준 자동 항목 */
const revealed = new Set<string>();

export function useSopReveal(items: SopItem[]): SopItem[] {
  const [, bump] = useState(0);
  const queue = items.filter((i) => i.execMode === "자동" && i.status === "완료" && !revealed.has(i.id));
  const head = queue[0]?.id;

  useEffect(() => {
    if (!head) return;
    const id = window.setTimeout(() => {
      revealed.add(head);
      bump((n) => n + 1);
    }, REVEAL_STEP_MS);
    return () => window.clearTimeout(id);
  }, [head]);

  if (queue.length === 0) return items;
  return items.map((i) => {
    if (i.id === head) return { ...i, status: "진행 중", at: undefined };
    if (queue.some((q) => q.id === i.id)) return { ...i, status: "대기", at: undefined, recipients: undefined };
    return i;
  });
}
