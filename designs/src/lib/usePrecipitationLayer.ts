/* ─────────────────────────────────────────────
 * 강수 색면 붙이는 훅 — 격자 로드 → 레이어 생성 → 토글 반영
 *
 * 바람(useWindLayer)과 같은 결이다. 레이어는 지도 스타일 안에 살므로 별도 해제가
 * 필요 없다 — 지도가 사라질 때 함께 사라진다.
 * ───────────────────────────────────────────── */

import { useEffect, type RefObject } from "react";
import type maplibregl from "maplibre-gl";
import { loadPrecipitationField } from "./precipitation-field";
import {
  ensurePrecipitationLayer,
  setPrecipitationHour,
  setPrecipitationVisible,
} from "./precipitation-layer";

export function usePrecipitationLayer(
  map: RefObject<maplibregl.Map | null>,
  ready: boolean,
  visible: boolean,
  /** 그릴 시각(시). 시간축이 옮기면 그 시각의 비로 다시 칠한다 */
  hour: number,
) {
  useEffect(() => {
    if (!ready || !visible) return;
    let cancelled = false;

    void (async () => {
      let field;
      try {
        field = await loadPrecipitationField();
      } catch (e) {
        console.error(
          "[precipitation] 강수 격자 로드 실패 — scripts/fetch-precipitation-field.mjs 를 돌렸나",
          e,
        );
        return;
      }
      const instance = map.current;
      if (cancelled || !instance) return;
      ensurePrecipitationLayer(instance, field);
      setPrecipitationHour(instance, field, hour);
      setPrecipitationVisible(instance, true);
    })();

    return () => {
      cancelled = true;
      if (map.current) setPrecipitationVisible(map.current, false);
    };
  }, [map, ready, visible, hour]);
}
