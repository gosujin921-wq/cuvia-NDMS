/* ─────────────────────────────────────────────
 * 기온 격자 읽기 — public/weather/temperature-field.json (미리 구운 자료)
 *
 * 창원 일대 1.5km 기온 격자다. 폭염일(2025-08-24)의 기상청 국지예보(KMA)를
 * scripts/fetch-temperature-field.mjs 로 구워 뒀다 — 시연 중 네트워크를 타지 않는다.
 *
 * 서항지구 17시 값이 04 §5 의 현재 기온(32.4℃)과 일치하도록 격자를 서항 기준점에
 * 앵커링해 구웠다. 굽기를 다시 할 때 이 값이 갈리면 안 된다(스크립트가 검사한다).
 * ───────────────────────────────────────────── */

export interface TemperatureField {
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
  /** ℃ — [시간][iy*nx+ix] · iy 남→북, ix 서→동 */
  temp: number[][];
}

let cache: Promise<TemperatureField> | null = null;

export function loadTemperatureField(): Promise<TemperatureField> {
  cache ??= fetch("/weather/temperature-field.json").then((res) => {
    if (!res.ok) throw new Error(`기온 격자를 받지 못했다 (HTTP ${res.status})`);
    return res.json() as Promise<TemperatureField>;
  });
  return cache;
}

/** 한 시각의 최소·최대 — 램프 양끝을 자료 범위에 맞춘다 */
export function temperatureRange(field: TemperatureField, hourIndex: number) {
  const values = field.temp[hourIndex];
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}
