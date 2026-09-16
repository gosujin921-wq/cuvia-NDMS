/* ─────────────────────────────────────────────
 * 바람 격자 읽기 — public/weather/wind-field.json (미리 구운 자료)
 *
 * 남해안 광역의 시간대별 풍향·풍속 격자다. 태풍 솔릭(2018-08-23)의 ERA5 재분석을
 * scripts/fetch-wind-field.mjs 로 구워 뒀다 — 시연 중 네트워크를 타지 않는다.
 *
 * 방위는 기상 관례(바람이 불어오는 쪽)라 입자 이동은 u·v 성분으로 바꿔 쓴다.
 * 보간도 u·v 로 한다 — 각도를 직접 보간하면 350°↔10° 사이에서 반대로 돈다.
 * ───────────────────────────────────────────── */

export interface WindField {
  source: string;
  event: string;
  date: string;
  /** [서, 남, 동, 북] (°) */
  bbox: [number, number, number, number];
  step: number;
  nx: number;
  ny: number;
  hours: number[];
  defaultHour: number;
  /** m/s — [시간][iy*nx+ix] */
  speed: number[][];
  /** 도(불어오는 방위) — [시간][iy*nx+ix] */
  dir: number[][];
}

let cache: Promise<WindField> | null = null;

export function loadWindField(): Promise<WindField> {
  cache ??= fetch("/weather/wind-field.json").then((res) => {
    if (!res.ok) throw new Error(`바람 격자를 받지 못했다 (HTTP ${res.status})`);
    return res.json() as Promise<WindField>;
  });
  return cache;
}

export interface WindSample {
  /** 동쪽(+) 성분 m/s */
  u: number;
  /** 북쪽(+) 성분 m/s */
  v: number;
  speed: number;
}

/** 격자 한 점의 u·v — 기상 방위(불어오는 쪽)를 이동 벡터로 뒤집는다 */
function uvAt(field: WindField, hour: number, index: number): [number, number] {
  const s = field.speed[hour][index];
  const rad = (field.dir[hour][index] * Math.PI) / 180;
  return [-Math.sin(rad) * s, -Math.cos(rad) * s];
}

/** 좌표의 바람 — 사방 4칸 쌍선형 보간. 격자 밖이면 null */
export function sampleWind(
  field: WindField,
  hourIndex: number,
  lng: number,
  lat: number,
): WindSample | null {
  const fx = (lng - field.bbox[0]) / field.step;
  const fy = (lat - field.bbox[1]) / field.step;
  if (fx < 0 || fy < 0 || fx > field.nx - 1 || fy > field.ny - 1) return null;

  const x0 = Math.min(Math.floor(fx), field.nx - 2);
  const y0 = Math.min(Math.floor(fy), field.ny - 2);
  const tx = fx - x0;
  const ty = fy - y0;

  const i00 = y0 * field.nx + x0;
  const [u00, v00] = uvAt(field, hourIndex, i00);
  const [u10, v10] = uvAt(field, hourIndex, i00 + 1);
  const [u01, v01] = uvAt(field, hourIndex, i00 + field.nx);
  const [u11, v11] = uvAt(field, hourIndex, i00 + field.nx + 1);

  const u = (u00 * (1 - tx) + u10 * tx) * (1 - ty) + (u01 * (1 - tx) + u11 * tx) * ty;
  const v = (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
  return { u, v, speed: Math.hypot(u, v) };
}

/**
 * 사건이 든 바람으로 만든 **균일 격자** (2026-09-17).
 *
 * `wind-field.json` 은 태풍 솔릭(2018-08-23) 한 사건의 광역 재분석이다. 그것을 다른 사건의 화면에
 * 깔면 **지도가 거짓말을 한다** — 무학산 산불(2024-04-02)의 화선은 동북동으로 번지는데 광역 인셋의
 * 입자는 북서로 흘렀다(2026-09-17 실측 · 화살표 80° ↔ 입자 309°).
 *
 * 그 사건의 광역 자료가 없을 때는 사건이 아는 값(풍향·풍속) 하나로 균일장을 만들어 쓴다.
 * 분포는 잃지만 **방향이 맞는다.** 실개발에서 그 시각의 실제 격자가 붙으면 이 함수를 지운다.
 *
 * @param bearing 바람이 **가는** 방향(도). `SceneVector.bearing` 과 같은 규약이다
 */
export function uniformWindField(bearing: number, speed: number): WindField {
  /* 기상 관례의 `dir` 은 불어오는 방위라 반대로 돌린다 */
  const dir = (bearing + 180) % 360;
  const nx = 2, ny = 2;
  const cells = new Array(nx * ny);
  return {
    source: "사건 관측값(균일)", event: "사건 바람", date: "",
    bbox: [124, 32, 132, 39], step: 8, nx, ny, hours: [0], defaultHour: 0,
    speed: [cells.fill(speed).slice()],
    dir: [new Array(nx * ny).fill(dir)],
  };
}
