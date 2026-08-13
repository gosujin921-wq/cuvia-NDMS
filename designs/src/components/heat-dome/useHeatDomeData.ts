/* ─────────────────────────────────────────────
 * 열돔 자료 읽기 — 두 기압면을 한 번 읽고 창원 판정까지 낸다
 *
 * 지도를 쓰는 쪽(HeatDomeGlobe)과 숫자만 쓰는 쪽(HeatDomeStatus)이 **같은 자료를 두 번 읽지
 * 않게** 갈라 둔 훅이다. 숫자만 필요하면 지도를 안 붙여도 된다 — 디지털트윈처럼 도시 배율인
 * 화면에서는 색면이 뜻을 갖지 못하므로 그쪽이 오히려 기본이다.
 *
 * 창원 값은 보간이 아니라 **격자점 원본값**이다. 굽는 스크립트가 격자 눈금을 창원 좌표에
 * 맞춰 뜨기 때문이다(scripts/fetch-upper-field.mjs).
 * ───────────────────────────────────────────── */

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { CITY_CENTER } from "../../lib/map-config";
import {
  loadWeatherField,
  sampleField,
  valuesOf,
  type WeatherField,
} from "../../lib/weather-field";
import { UPPER_200_FIELD, UPPER_500_FIELD, type UpperFieldSpec } from "../../lib/upper-fields";

/** 아래층이 먼저다 — 순서가 곧 화면의 위아래 순서다 */
export const LOWER = UPPER_500_FIELD;
export const UPPER = UPPER_200_FIELD;

/** 한 층의 판정 결과 */
export interface LayerReading {
  spec: UpperFieldSpec;
  /** 창원 지점 지위고도 (gpm) */
  value: number;
  /** 기준선을 넘었나 */
  inside: boolean;
  /** 기준선과의 차 (gpm) */
  margin: number;
  /** 지면부터 어디까지 잰 값인가 — 화면 문안에 그대로 쓴다 */
  reach: string;
}

export interface HeatDomeData {
  lower: WeatherField | null;
  upper: WeatherField | null;
  /**
   * 보고 있는 프레임 번호.
   *
   * 한때 시각(hour)으로 골랐다. 자료가 하루뿐일 때는 그것으로 됐지만 지금은 22일 × 2장이라
   * 시각만으로는 어느 날인지 못 가린다. 번호로 고른다.
   */
  index: number;
  /** 번호를 바로 주거나, 지금 번호로 다음 번호를 계산하는 함수를 준다(돌려보기가 쓴다) */
  setIndex: React.Dispatch<React.SetStateAction<number>>;
  /** 프레임 이름표 — "07-01 15시" 꼴 */
  labels: string[];
  /** 창원 판정 — 위층이 먼저 온다(화면에 그 순서로 선다) */
  readings: LayerReading[] | null;
  /** 두 층 모두 안쪽인가 = 깊은 돔 */
  deep: boolean;
  /** 자료 날짜 (YYYY-MM-DD) */
  date: string | null;
}

/**
 * @param enabled 자료를 읽을지. 끄면 한 바이트도 안 받는다 — 상층장 두 벌이 약 0.9MB 라,
 *   열돔을 안 쓰는 재난유형에서까지 받아 두면 트윈을 열 때마다 그만큼 헛일이다.
 */
export function useHeatDomeData(initialIndex?: number, enabled = true): HeatDomeData {
  const [lower, setLower] = useState<WeatherField | null>(null);
  const [upper, setUpper] = useState<WeatherField | null>(null);
  const [index, setIndex] = useState(initialIndex ?? 0);

  useEffect(() => {
    /* 이미 들고 있으면 다시 받지 않는다 — 폭염과 침수를 오갈 때마다 0.9MB 를 또 받으면
       오갈 때마다 지구본이 빈 채로 떴다가 채워진다 */
    if (!enabled || lower) return;
    let cancelled = false;
    void Promise.all([loadWeatherField(LOWER), loadWeatherField(UPPER)]).then(([lo, up]) => {
      if (cancelled) return;
      setLower(lo);
      setUpper(up);
      /* 번호를 안 받았으면 자료가 정한 기본 프레임을 쓴다 — 돔이 가장 깊은 날이다 */
      /* defaultIndex 는 상층장에만 있는 값이라 공용 WeatherField 타입에는 없다 —
         공용 타입을 상층 사정으로 넓히지 않고 여기서만 느슨하게 읽는다 */
      if (lo && initialIndex == null) {
        setIndex((lo.meta as { defaultIndex?: number }).defaultIndex ?? 0);
      }
    });
    return () => {
      cancelled = true;
    };
    /* enabled 가 켜지는 순간 한 번만 읽는다 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, lower]);

  const readings = useMemo<LayerReading[] | null>(() => {
    if (!lower || !upper) return null;

    const read = (field: WeatherField, spec: UpperFieldSpec, reach: string): LayerReading | null => {
      const frame = field.frames[Math.min(index, field.frames.length - 1)];
      if (!frame) return null;
      const value = sampleField(field, valuesOf(frame, spec), ...CITY_CENTER);
      if (value == null) return null;
      return {
        spec,
        value,
        inside: value >= spec.contour,
        margin: Math.round(value - spec.contour),
        reach,
      };
    };

    /* 위층부터 — 하늘에서 내려오는 순서로 읽힌다 */
    const list = [read(upper, UPPER, "12km 까지"), read(lower, LOWER, "5.5km 까지")];
    return list.every(Boolean) ? (list as LayerReading[]) : null;
  }, [lower, upper, index]);

  const labels = lower?.frames.map((f) => String(f.time)) ?? [];

  return {
    lower,
    upper,
    index: Math.min(index, Math.max(0, labels.length - 1)),
    setIndex,
    labels,
    readings,
    deep: !!readings && readings.every((r) => r.inside),
    /** 지금 보고 있는 프레임의 이름표 */
    date: labels[Math.min(index, labels.length - 1)] ?? null,
  };
}
