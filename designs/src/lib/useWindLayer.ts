/* ─────────────────────────────────────────────
 * 바람 입자 붙이는 훅 — 격자 로드 → 레이어 생성 → 토글 반영
 *
 * 격자는 처음 켤 때 한 번만 받는다(모듈 캐시). 지도 인스턴스는 화면이 바뀌면
 * 사라지므로 레이어도 함께 버린다 — ref 규약은 useMapLibre 머리말 참고.
 * ───────────────────────────────────────────── */

import { useEffect, useRef, type RefObject } from "react";
import type maplibregl from "maplibre-gl";
import { loadWindField, uniformWindField } from "./wind-field";
import { WindParticleLayer } from "./wind-layer";

export function useWindLayer(
  map: RefObject<maplibregl.Map | null>,
  ready: boolean,
  visible: boolean,
  /**
   * 그 사건이 아는 바람 — 있으면 광역 격자 대신 이 값으로 균일하게 흘린다.
   * 광역 격자는 태풍 솔릭 한 사건의 자료라 다른 사건 화면에 깔면 방향이 거짓이 된다(`uniformWindField`).
   */
  own?: { bearing: number; speed: number } | null,
) {
  const layerRef = useRef<WindParticleLayer | null>(null);

  useEffect(() => {
    if (!ready || !visible) return;
    let cancelled = false;

    void (async () => {
      let field;
      try {
        field = own ? uniformWindField(own.bearing, own.speed) : await loadWindField();
      } catch (e) {
        /* 격자 파일이 없으면 입자만 안 뜬다. 지도는 그대로 두고 로그만 남긴다 */
        console.error("[wind] 바람 격자 로드 실패 — scripts/fetch-wind-field.mjs 를 돌렸나", e);
        return;
      }
      const instance = map.current;
      if (cancelled || !instance) return;
      /* 바람이 바뀌면 층을 다시 세운다 — 격자를 들고 있는 객체라 갈아 끼워야 방향이 따라온다 */
      layerRef.current?.destroy();
      layerRef.current = new WindParticleLayer(instance, field);
      layerRef.current.setVisible(true);
    })();

    return () => {
      cancelled = true;
      layerRef.current?.setVisible(false);
    };
  }, [map, ready, visible, own?.bearing, own?.speed]);

  /* 화면을 떠날 때 캔버스까지 걷는다 */
  useEffect(
    () => () => {
      layerRef.current?.destroy();
      layerRef.current = null;
    },
    [],
  );
}
