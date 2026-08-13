/* ─────────────────────────────────────────────
 * 고정 시드 난수 — 04 데모 데이터 §8
 *
 * 화면 그래프는 새로고침해도 같은 모양이어야 한다. 시연에서 같은 화면을 두 번 보여줘야 하고,
 * "아까 그 그래프"를 다시 짚을 수 없으면 설명이 끊긴다. Math.random 은 쓰지 않는다.
 * ───────────────────────────────────────────── */

/** 문자열 → 32bit 시드 */
export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — 시드 하나로 같은 수열을 낸다 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
