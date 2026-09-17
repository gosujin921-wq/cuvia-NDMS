/* 요소의 실제 픽셀 폭 — SVG 를 컨테이너 크기 그대로 그려 글자가 축소되지 않게 한다(최소 13px 규칙)
 *
 * ★ 요소가 **빠졌다 다시 붙어도** 따라간다. 종단도를 접었다 펴면 컨테이너 div 가 언마운트됐다 새로 붙는데,
 *   `[ref]` 만 보는 효과는 다시 서지 않아 새 요소를 관찰하지 못했고, 옛 요소가 빠질 때 ResizeObserver 가 0 을 보고해
 *   폭이 1px 로 굳어 그래프가 사라졌다(2026-09-17 사용자). 렌더마다 지금 요소가 관찰 중인 것과 다르면 다시 관찰하고, 0 은 버린다.
 */

import { useEffect, useRef, useState, type RefObject } from "react";

export function useElementWidth(ref: RefObject<HTMLElement | null>, fallback = 480): number {
  const [width, setWidth] = useState(fallback);
  const observed = useRef<{ el: HTMLElement; ro: ResizeObserver } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (observed.current?.el === el) return;
    observed.current?.ro.disconnect();
    observed.current = null;
    if (!el) return;
    const apply = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      /* 빠지는 요소는 0 을 보고한다 — 그 값으로 굳으면 다시 붙을 때 1px 그래프가 된다 */
      if (w > 0) setWidth(w);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    observed.current = { el, ro };
  });
  useEffect(() => () => { observed.current?.ro.disconnect(); observed.current = null; }, []);
  return width;
}
