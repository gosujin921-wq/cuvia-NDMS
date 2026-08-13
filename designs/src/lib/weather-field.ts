/* ─────────────────────────────────────────────
 * 기상 격자장 — 미리 구워 둔 격자를 읽고 값을 집는다
 *
 * 기온·강수가 같은 모양의 파일을 쓴다(scripts/fetch-temperature-field.mjs ·
 * fetch-precipitation-field.mjs). 둘 다 같은 눈금·같은 범위라 한 칸도 어긋나지 않으므로,
 * 읽는 쪽도 한 벌이면 된다. 다른 것은 **어느 열을 읽나(valueKey)** 와 **색·단위**뿐이고
 * 그건 weather-fields.ts 의 정의로 넘긴다.
 *
 * 시연 중에는 네트워크를 타지 않고 이 정적 파일만 읽는다.
 * ───────────────────────────────────────────── */

/** 한 시각의 격자. 값 배열의 이름은 자료마다 다르다 — 기온 `t`, 강수 `p` */
export interface FieldFrame {
  hour: number;
  time: string;
  [values: string]: number | string | number[];
}

export interface WeatherField {
  meta: {
    source: string;
    license: string;
    /** 무슨 날이었나 — "폭염" · "유역 강우" */
    event: string;
    date: string;
    timezone: string;
    defaultHour: number;
    note: string;
  };
  /** [서, 남, 동, 북] */
  bbox: [number, number, number, number];
  cols: number;
  rows: number;
  step: number;
  range: { min: number; max: number };
  frames: FieldFrame[];
}

/** 색이 갈리는 자리 하나 */
export interface FieldStop {
  /** 이 값부터 아래 색 */
  value: number;
  /** 위험도 토큰 이름 — 색면(캔버스)과 범례(CSS)가 같은 값을 읽는다 */
  token: string;
  /** 이 눈금이 왜 눈금인지 — 있는 것만 범례 아래줄에 적는다 */
  note?: string;
  /**
   * 범례 띠 아래 숫자를 감춘다.
   * 강수의 0.1 처럼 "여기부터 색이 붙는다"는 뜻뿐인 자리는 띠 맨 끝에 붙어 안 읽힌다.
   * 색은 그대로 쓰고 숫자만 뺀다.
   */
  hideTick?: boolean;
}

/**
 * 자료 한 종류의 정의 — "무엇을 어떤 색으로, 어떤 단위로 보이나".
 *
 * 색을 임의 그라데이션으로 두지 않는다. 눈금은 전부 **정본이 정한 문턱**이다
 * (기온은 폭염특보 33·35℃, 강수는 04 §3 강우량계 발령 기준 30·50·70 mm/h).
 * 그래서 지도에서 붉게 물든 자리와 붉은 이벤트 핀이 같은 뜻으로 읽힌다.
 */
export interface WeatherFieldSpec {
  /** 지도 레이어·소스 id 이자 토글 id */
  id: string;
  /** 토글·범례에 뜨는 이름 */
  label: string;
  /** 구워 둔 파일 자리 */
  url: string;
  /** 프레임에서 값 배열이 든 열 이름 */
  valueKey: string;
  /** 표기 단위 — "℃" · "mm/h" */
  unit: string;
  stops: FieldStop[];
  /** 색 띠가 그려지는 폭 — 양 끝에 평평한 구간이 있어야 "여기서 더 안 변한다"가 읽힌다 */
  rampRange: { min: number; max: number };
  /**
   * 이 값 이하는 **투명**. 강수의 0 mm/h 처럼 "없음"이 뜻을 갖는 자료에 쓴다.
   * 없으면(기온) 격자 전체가 칠해진다.
   */
  transparentBelow?: number;
  /** 범례가 값을 밝히는 대조 지점 — 기상 카드·정본과 눈으로 맞춰 보는 자리 */
  probePoints: { label: string; lonLat: [number, number] }[];
  /** 색면 진하기 — 자료마다 덮는 면적이 달라 같은 값으로는 안 맞는다 */
  opacity: number;
  /** 범례에 붙는 한 줄. 왜 이 날인지 */
  caption: string;
  /**
   * 범례에 적는 출처 — 파일 meta.source 는 영문 정식 명칭이라 좁은 레일에서 세 줄을 먹는다.
   * 기록은 JSON 이 갖고, 화면에는 짧은 쪽을 세운다(저작자 표시는 유지).
   * 안 주면 meta.source 를 그대로 쓴다.
   */
  sourceLabel?: string;
}

/** 시각으로 프레임을 고른다. 없으면 기본 시각, 그것도 없으면 첫 장 */
export function frameAt(field: WeatherField, hour?: number): FieldFrame {
  const wanted = hour ?? field.meta.defaultHour;
  return field.frames.find((f) => f.hour === wanted) ?? field.frames[0];
}

/** 프레임에서 값 배열을 꺼낸다 — 열 이름이 자료마다 달라 한 자리에 모아 둔다 */
export function valuesOf(frame: FieldFrame, spec: WeatherFieldSpec): number[] {
  return frame[spec.valueKey] as number[];
}

/**
 * 격자 이중선형 보간 — 임의 지점의 값.
 *
 * 격자는 **북쪽 줄이 먼저**다(이미지처럼 위에서 아래로). 색면 자체는 지도가 확대해 그리므로
 * 여기를 쓰지 않지만, 지점값을 글자로 밝힐 때(범례) 필요하다.
 * 격자 밖이면 null — 없는 값을 0 으로 둘러대지 않는다.
 */
export function sampleField(
  field: WeatherField,
  values: number[],
  lon: number,
  lat: number,
): number | null {
  const [west, south, east, north] = field.bbox;
  if (lon < west || lon > east || lat < south || lat > north) return null;

  const fc = (lon - west) / field.step;
  const fr = (north - lat) / field.step;

  const c0 = Math.min(field.cols - 2, Math.max(0, Math.floor(fc)));
  const r0 = Math.min(field.rows - 2, Math.max(0, Math.floor(fr)));
  const tx = fc - c0;
  const ty = fr - r0;

  const i00 = r0 * field.cols + c0;
  const i01 = i00 + field.cols;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return lerp(lerp(values[i00], values[i00 + 1], tx), lerp(values[i01], values[i01 + 1], tx), ty);
}

/** 굽어 둔 격자를 읽는다. 실패하면 null — 화면은 그 레이어 없이 그대로 뜬다 */
export async function loadWeatherField(spec: WeatherFieldSpec): Promise<WeatherField | null> {
  try {
    const res = await fetch(spec.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as WeatherField;
  } catch (e) {
    /* 기상 격자는 배경 정보다. 못 읽어도 지도·마커·패널은 다 서야 한다 */
    console.warn(`[${spec.id}] 격자를 읽지 못했다. 이 레이어 없이 간다`, e);
    return null;
  }
}
