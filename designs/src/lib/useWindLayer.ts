/* ─────────────────────────────────────────────
 * 바람 입자 붙이는 훅 — 격자 로드 → 레이어 생성 → 토글 반영
 *
 * 격자는 처음 켤 때 한 번만 받는다(모듈 캐시). 지도 인스턴스는 화면이 바뀌면
 * 사라지므로 레이어도 함께 버린다 — ref 규약은 useMapLibre 머리말 참고.
 * ───────────────────────────────────────────── */

import { useEffect, useRef, type RefObject } from "react";
import type maplibregl from "maplibre-gl";
import { loadWindField } from "./wind-field";
import { WindParticleLayer } from "./wind-layer";

export function useWindLayer(
  map: RefObject<maplibregl.Map | null>,
  ready: boolean,
  visible: boolean,
) {
  const layerRef = useRef<WindParticleLayer | null>(null);

  useEffect(() => {
    if (!ready || !visible) return;
    let cancelled = false;

    void (async () => {
      let field;
      try {
        field = await loadWindField();
      } catch (e) {
        /* 격자 파일이 없으면 입자만 안 뜬다. 지도는 그대로 두고 로그만 남긴다 */
        console.error("[wind] 바람 격자 로드 실패 — scripts/fetch-wind-field.mjs 를 돌렸나", e);
        return;
      }
      const instance = map.current;
      if (cancelled || !instance) return;
      layerRef.current ??= new WindParticleLayer(instance, field);
      layerRef.current.setVisible(true);
    })();

    return () => {
      cancelled = true;
      layerRef.current?.setVisible(false);
    };
  }, [map, ready, visible]);

  /* 화면을 떠날 때 캔버스까지 걷는다 */
  useEffect(
    () => () => {
      layerRef.current?.destroy();
      layerRef.current = null;
    },
    [],
  );
}
