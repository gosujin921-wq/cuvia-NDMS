/* ─────────────────────────────────────────────
 * 강수 격자 읽기 — public/weather/precipitation-field.json (미리 구운 자료)
 *
 * 창원 일대 1.5km 강수 격자다. 호우일(2024-09-21)을 scripts/fetch-precipitation-field.mjs
 * 로 구워 뒀다 — 시연 중 네트워크를 타지 않는다.
 *
 * 그 날짜를 고른 이유는 서항 19시 값이 17.8 mm/h 라서다. 04 §10-3 의 산정 조건
 * "유역 강우 유입 +0.38 m · 시간당 18 mm 지속" 과 맞물린다 — 트윈 근거 카드가 말하는
 * 강우가 지도 위 강수 격자와 같은 세기여야 두 화면이 같은 비를 말한다.
 *
 * 기온 격자와 달리 모델을 지정하지 않고 구웠다(KMA 국지예보가 이 날짜 강수를 싣지 않는다).
 * 출처 모델이 기온과 다르다는 뜻이므로, 두 격자를 같은 관측이라고 부르지 않는다.
 * ───────────────────────────────────────────── */

export interface PrecipitationField {
  source: string;
  event: string;
  date: string;
  /** [서, 남, 동, 북] (°) — 격자점(칸 중심) 기준 */
  bbox: [number, number, number, number];
  step: number;
  nx: number;
  ny: number;
  hours: number[];
  defaultHour: number;
  /** mm/h — [시간][iy*nx+ix] · iy 남→북, ix 서→동 */
  rain: number[][];
}

let cache: Promise<PrecipitationField> | null = null;

export function loadPrecipitationField(): Promise<PrecipitationField> {
  cache ??= fetch("/weather/precipitation-field.json").then((res) => {
    if (!res.ok) throw new Error(`강수 격자를 받지 못했다 (HTTP ${res.status})`);
    return res.json() as Promise<PrecipitationField>;
  });
  return cache;
}
