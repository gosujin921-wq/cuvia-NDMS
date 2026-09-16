/* ─────────────────────────────────────────────
 * 지도 한 장 뜨기 — 저장 기록에 붙이는 그림 (2026-09-17)
 *
 * 훈련·분석을 나중에 다시 열었을 때 숫자만 남으면 "그때 어땠는지"가 안 보인다. 저장 시점의 지도를
 * 한 장 떠서 함께 든다. 그 그림은 **그때 화면 그대로**이고, 판을 고쳐도 다시 그리지 않는다.
 *
 * ★ 지도를 만들 때 `capture: true` 를 줘야 한다(`useMapLibre`) — WebGL 은 기본적으로 그린 뒤
 *   버퍼를 버려서, 그 옵션 없이 찍으면 빈 그림이 나온다.
 * ★ 원본 캔버스는 화면 크기(1000px 이상)라 dataURL 이 수 MB 가 된다. 기록에 들고 다닐 것이라
 *   폭을 줄이고 JPEG 로 굽는다. 지도는 사진에 가까워 PNG 보다 JPEG 가 훨씬 작다.
 * ───────────────────────────────────────────── */

/** 저장할 그림의 폭(px) — 보고서 종이 안쪽 폭(674)보다 조금 크게 잡아 인쇄에서 흐려지지 않게 */
const CAPTURE_WIDTH = 760;
const CAPTURE_QUALITY = 0.72;

/**
 * 지도 캔버스를 줄여서 dataURL 한 장으로. 못 뜨면 `undefined` —
 * 부르는 쪽은 그림 없이도 저장이 되게 둔다(그림은 있으면 좋은 것이지 없으면 막을 것이 아니다).
 */
export function captureMap(map: maplibregl.Map | null | undefined): string | undefined {
  if (!map) return undefined;
  try {
    const src = map.getCanvas();
    if (!src.width || !src.height) return undefined;
    const scale = Math.min(1, CAPTURE_WIDTH / src.width);
    const w = Math.round(src.width * scale), h = Math.round(src.height * scale);
    const out = document.createElement("canvas");
    out.width = w; out.height = h;
    const ctx = out.getContext("2d");
    if (!ctx) return undefined;
    /* 지도는 반투명한 면이 겹쳐 있어 흰 바탕에 얹으면 색이 뜬다 — 앱의 어두운 면을 먼저 깐다 */
    ctx.fillStyle = "#0b0d10";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(src, 0, 0, w, h);
    return out.toDataURL("image/jpeg", CAPTURE_QUALITY);
  } catch {
    /* 캔버스가 오염됐거나(외부 타일) 컨텍스트를 잃은 경우. 기록은 그림 없이 남는다 */
    return undefined;
  }
}
