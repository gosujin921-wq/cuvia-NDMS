/* 요소의 실제 픽셀 폭 — SVG 를 컨테이너 크기 그대로 그려 글자가 축소되지 않게 한다(최소 13px 규칙) */

import { useLayoutEffect, useState, type RefObject } from "react";

export function useElementWidth(ref: RefObject<HTMLElement | null>, fallback = 480): number {
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => setWidth(Math.max(1, Math.round(el.getBoundingClientRect().width)));
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}
