/* ─────────────────────────────────────────────
 * 기온 색면 붙이는 훅 — 격자 로드 → 레이어 생성 → 토글 반영
 *
 * 바람(useWindLayer)과 같은 결이다. 레이어는 지도 스타일 안에 살므로 별도 해제가
 * 필요 없다 — 지도가 사라질 때 함께 사라진다.
 * ───────────────────────────────────────────── */

import { useEffect, type RefObject } from "react";
import type maplibregl from "maplibre-gl";
import { loadTemperatureField } from "./temperature-field";
import { ensureTemperatureLayer, setTemperatureVisible } from "./temperature-layer";

export function useTemperatureLayer(
  map: RefObject<maplibregl.Map | null>,
  ready: boolean,
  visible: boolean,
) {
  useEffect(() => {
    if (!ready || !visible) return;
    let cancelled = false;

    void (async () => {
      let field;
      try {
        field = await loadTemperatureField();
      } catch (e) {
        console.error(
          "[temperature] 기온 격자 로드 실패 — scripts/fetch-temperature-field.mjs 를 돌렸나",
          e,
        );
        return;
      }
      const instance = map.current;
      if (cancelled || !instance) return;
      ensureTemperatureLayer(instance, field);
      setTemperatureVisible(instance, true);
    })();

    return () => {
      cancelled = true;
      if (map.current) setTemperatureVisible(map.current, false);
    };
  }, [map, ready, visible]);
}
