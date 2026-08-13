/* ─────────────────────────────────────────────
 * 수온 곡선 읽기 — 화면과 답변이 같은 값을 본다
 *
 * 통계 4단의 곡선과 AI 패널의 답변이 같은 수를 써야 한다. 두 곳이 따로 읽으면 파일을
 * 두 번 받는 것보다 **두 곳이 다른 값을 셀 위험**이 더 크다 — 자료를 다시 굽는 사이에
 * 한쪽만 새로 받으면 화면과 답이 어긋난다.
 *
 * 그래서 받아 오는 약속(Promise)을 모듈에 한 번 걸어 두고 모두가 그것을 나눠 쓴다.
 * 상태 엔진에 얹지 않은 이유는 이 값이 **시연 중에 변하지 않기 때문**이다 — 엔진은
 * 변하는 것만 든다. 자르는 날짜만 시계에서 받는다.
 * ───────────────────────────────────────────── */

import { useEffect, useState } from "react";
import { readSeaTemp, seaDateOf, seaTempOnce, type SeaTempRaw, type SeaTempReading } from "../demo/sea-temp";

/**
 * 시연 시계까지 자른 곡선. 읽는 중이거나 못 읽으면 `null`.
 *
 * 둘을 가르지 않는 것은 어느 쪽이든 화면이 할 일이 같기 때문이다 — 없는 값을 지어내지
 * 않고 자리를 비운다.
 */
export function useSeaTemp(now: Date): SeaTempReading | null {
  const [raw, setRaw] = useState<SeaTempRaw | null>(null);

  useEffect(() => {
    let cancelled = false;
    void seaTempOnce().then((value) => {
      if (!cancelled) setRaw(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!raw) return null;
  return readSeaTemp(raw, seaDateOf(now));
}
