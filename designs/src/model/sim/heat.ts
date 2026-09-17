/* ─────────────────────────────────────────────
 * 폭염 · 도시 열환경 시뮬레이션 — /scr-00 폭염 탭의 데이터 층 (2026-09-17)
 *
 * 침수와 같은 화면 논리, 다른 내용이다. 침수는 "물이 여기까지 온다 → 이 도로가 잠긴다"이고,
 * 폭염은 "고온이 언제·어디에 오래 남는가 → 위험 상태 지속"이다. 결과를 억지로 같은 모양으로 만들지 않는다.
 *
 * ★ 입력은 전부 실자료다. 기상청 국지예보모델(KMA · 1.5 km) 폭염일 2025-08-24 12~21시 기온·상대습도 격자
 *   (public/weather/temperature-field.json · Open-Meteo 로 받아 구웠다). 편집 숫자는 없다.
 * ★ 체감온도는 기상청 여름철 산식이다(습구온도 Stull 2011 → 체감온도). 특보 기준도 기상청 것이다:
 *   주의보 = 일 최고 체감온도 33°C 이상, 경보 = 35°C 이상 (둘 다 "2일 이상 지속 예상"이 조건인데 하루치 자료라 여기서는 도달만 본다).
 * ★ 시나리오 A 는 "예보 기온 +2°C 균일", B 는 "예보 습도 +10 %p 균일"이다. 조건 변경이지 결과가 아니다.
 *   "녹지 확대 · 고반사 포장 적용 후" 같은 저감 대책 비교는 **열환경 모델이 없어 만들지 않는다.** 모델이 오면 같은 자리에 선다.
 * ★ 열돔(상층 지위고도)은 원인 맥락이라 광역 인셋으로만 선다. 여기서 보여 주는 대상은 도시 열환경이다.
 * ───────────────────────────────────────────── */

import type { TemperatureField } from "../../lib/temperature-field";
import type { LngLat } from "../scene";
import { HEATWAVE_WHATIF } from "../../fixtures/past/heatwave";
import { CITY_CENTER } from "../../lib/map-config";
import { sopOfCase, type SimSiteBase, type SimSop, type StateRow } from "./flood";

/** 기상청 폭염특보 기준 (일 최고 체감온도 · °C) */
export const HEAT_ADVISORY = 33;
export const HEAT_WARNING = 35;
/** "고온 지속 지역" 판정 — 체감 33°C 이상이 이 시간 이상 이어지는 칸 */
export const HOT_HOURS = 3;

/** 습구온도 — Stull (2011). 입력: 기온(°C) · 상대습도(%) */
export function wetBulb(ta: number, rh: number): number {
  return ta * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) + Math.atan(ta + rh) - Math.atan(rh - 1.676331)
    + 0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) - 4.686035;
}
/** 여름철 체감온도 — 기상청 산식(2022 개정). 입력: 기온 · 상대습도 */
export function apparentTemp(ta: number, rh: number): number {
  const tw = wetBulb(ta, rh);
  return -0.2442 + 0.55399 * tw + 0.45535 * ta - 0.0022 * tw * tw + 0.00278 * tw * ta + 3.0;
}

export interface HeatSite extends SimSiteBase {
  date: string;
  anchor: LngLat;
  sop: SimSop[];
}

export function heatSite(field: TemperatureField | null): HeatSite {
  const date = field?.date ?? "2025-08-24";
  const firstHour = field?.hours[0] ?? 12;
  return {
    id: "changwon-heat",
    label: "창원 도심 열환경",
    status: "재현",
    now: `${date}T${String(firstHour).padStart(2, "0")}:00:00+09:00`,
    dateLabel: `${date.replace(/-/g, ".")} 재현 · ${firstHour}시 기준 · 기상청 국지예보`,
    conditions: [
      {
        id: "temp", label: "기온", kind: "조건",
        options: [
          { id: "fc", label: "예보대로", detail: "기상청 국지예보 기온 그대로" },
          { id: "p2", label: "+2°C", detail: "예보 기온에 2°C 균일 가정" },
        ],
      },
      {
        /* 둘째 축도 조건이다 — 체감온도는 습도에 크게 움직여 "같은 기온이라도 습하면 경보"가 보인다 */
        id: "rh", label: "습도", kind: "조건",
        options: [
          { id: "fc", label: "예보대로", detail: "기상청 국지예보 상대습도 그대로" },
          { id: "p10", label: "+10 %p", detail: "예보 습도에 10 %p 균일 가정(100 % 상한)" },
        ],
      },
    ],
    defaults: { temp: "fc", rh: "fc" },
    baselineTag: "예보",
    baselineLabel: "기상청 국지예보 그대로",
    describeChoice: (c) => { const o = offsetOf(c); return [o.t ? `기온 예보 +${o.t.toFixed(1)}°C` : null, o.rh ? `습도 +${o.rh} %p` : null].filter(Boolean).join(" · ") || "예보 그대로"; },
    /* 연속 축 — 기온 오프셋. 실자료 격자 위 계산이라 어디서든 값이 난다. 근거 앵커는 예보(0) 하나뿐이고 나머지는 가정이라 눈금을 더 세우지 않는다 */
    slider: {
      condId: "temp", min: 0, max: 4, step: 0.1,
      anchors: [{ value: 0, label: "예보" }, { value: 2, label: "+2°C" }],
      valueOf: (c) => offsetOf(c).t,
      encode: (v) => `d:${v}`,
      format: (v) => (v === 0 ? "예보 그대로" : `예보 +${v.toFixed(1)}°C`),
    },
    date,
    anchor: CITY_CENTER,
    sop: sopOfCase(HEATWAVE_WHATIF),
  };
}

/** 시나리오가 예보에 더하는 값 — 기온(°C) · 상대습도(%p). 둘 다 조건 변경이지 결과가 아니다 */
export interface HeatOffset { t: number; rh: number }
/* 기온 선택은 앵커 id("fc" · "p2")이거나 슬라이더가 준 직접 값("d:2.5") */
export const offsetOf = (choice: Record<string, string>): HeatOffset => {
  const temp = choice.temp ?? "fc";
  const t = temp.startsWith("d:") ? Number(temp.slice(2)) : temp === "p2" ? 2 : 0;
  return { t, rh: choice.rh === "p10" ? 10 : 0 };
};
const OFFSETS_ALL: HeatOffset[] = [{ t: 0, rh: 0 }, { t: 2, rh: 0 }, { t: 0, rh: 10 }, { t: 2, rh: 10 }];

export const hourIso = (field: TemperatureField, h: number): string => `${field.date}T${String(field.hours[h]).padStart(2, "0")}:00:00+09:00`;

/** 격자에서 가장 가까운 칸 번호 */
export function cellIndexOf(field: TemperatureField, at: LngLat): number {
  const [west, south] = field.bbox;
  const ix = Math.min(field.nx - 1, Math.max(0, Math.round((at[0] - west) / field.step)));
  const iy = Math.min(field.ny - 1, Math.max(0, Math.round((at[1] - south) / field.step)));
  return iy * field.nx + ix;
}

/** 한 시각 · 한 칸의 값. 습도가 없으면 체감을 못 낸다(null) */
export function feelOf(field: TemperatureField, h: number, cell: number, off: HeatOffset): { ta: number; rh: number | null; feel: number | null } {
  const ta = field.temp[h][cell] + off.t;
  const raw = field.rh?.[h]?.[cell] ?? null;
  const rh = raw === null ? null : Math.min(100, raw + off.rh);
  return { ta, rh, feel: rh === null ? null : apparentTemp(ta, rh) };
}

/** 한 시각의 전체 칸 값 — 지도 색면 입력. 체감이 없으면 기온 */
export function fieldValuesAt(field: TemperatureField, h: number, off: HeatOffset): number[] {
  const n = field.nx * field.ny;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i += 1) out[i] = feelOf(field, h, i, off).feel ?? field.temp[h][i] + off.t;
  return out;
}

/** 색 램프 양끝 — 모든 시각·두 시나리오를 한 램프에 놓는다(비교가 뜻을 가지려면 색이 같은 값이어야 한다) */
export function fieldRange(field: TemperatureField): { min: number; max: number } {
  let min = Infinity, max = -Infinity;
  for (const off of OFFSETS_ALL) for (let h = 0; h < field.hours.length; h += 1) for (const v of fieldValuesAt(field, h, off)) { if (v < min) min = v; if (v > max) max = v; }
  return { min: Math.floor(min), max: Math.ceil(max) };
}

export interface HeatSummary {
  /** 기준 칸(도심)의 최고 체감온도와 그 시각 */
  maxFeel: number;
  maxFeelAt: string;
  /** 기준 칸이 33°C 이상 · 35°C 이상인 시간 수 */
  advisoryHours: number;
  warningHours: number;
  /** 처음 기준에 닿는 시각 */
  advisoryAt: string | null;
  warningAt: string | null;
  /** 고온 지속 지역 — 33°C 이상이 HOT_HOURS 이상 이어지는 칸 수와 비율 */
  hotCells: number;
  hotShare: number;
  /** 체감을 낼 수 있었나(습도 유무) */
  feelAvailable: boolean;
}

export function summarizeHeat(field: TemperatureField, off: HeatOffset, anchorCell: number): HeatSummary {
  const n = field.nx * field.ny;
  const H = field.hours.length;
  const feelAvailable = Boolean(field.rh);
  const valueAt = (h: number, c: number) => feelOf(field, h, c, off).feel ?? field.temp[h][c] + off.t;
  let maxFeel = -Infinity, maxH = 0, advisoryHours = 0, warningHours = 0;
  let advisoryAt: string | null = null, warningAt: string | null = null;
  for (let h = 0; h < H; h += 1) {
    const v = valueAt(h, anchorCell);
    if (v > maxFeel) { maxFeel = v; maxH = h; }
    if (v >= HEAT_ADVISORY) { advisoryHours += 1; advisoryAt ??= hourIso(field, h); }
    if (v >= HEAT_WARNING) { warningHours += 1; warningAt ??= hourIso(field, h); }
  }
  let hotCells = 0;
  for (let c = 0; c < n; c += 1) {
    let run = 0, best = 0;
    for (let h = 0; h < H; h += 1) { run = valueAt(h, c) >= HEAT_ADVISORY ? run + 1 : 0; if (run > best) best = run; }
    if (best >= HOT_HOURS) hotCells += 1;
  }
  return { maxFeel, maxFeelAt: hourIso(field, maxH), advisoryHours, warningHours, advisoryAt, warningAt, hotCells, hotShare: hotCells / n, feelAvailable };
}

/** 고온 지속 지역의 칸 링 — 지도에 면으로 세운다. 판정은 `summarizeHeat` 와 같은 규칙(33°C↑ 가 HOT_HOURS 이상 연속) */
export function hotCellRings(field: TemperatureField, off: HeatOffset): LngLat[][] {
  const [west, south] = field.bbox;
  const half = field.step / 2;
  const H = field.hours.length;
  const out: LngLat[][] = [];
  for (let iy = 0; iy < field.ny; iy += 1) {
    for (let ix = 0; ix < field.nx; ix += 1) {
      const c = iy * field.nx + ix;
      let run = 0, best = 0;
      for (let h = 0; h < H; h += 1) { const v = feelOf(field, h, c, off).feel ?? field.temp[h][c] + off.t; run = v >= HEAT_ADVISORY ? run + 1 : 0; if (run > best) best = run; }
      if (best < HOT_HOURS) continue;
      const x0 = west + ix * field.step - half, y0 = south + iy * field.step - half;
      out.push([[x0, y0], [x0 + field.step, y0], [x0 + field.step, y0 + field.step], [x0, y0 + field.step]]);
    }
  }
  return out;
}

/** 그 시각(분 단위) 기준 칸의 상태 줄 — 시각 사이는 직선 보간 */
export function heatStateAt(field: TemperatureField, off: HeatOffset, anchorCell: number, minutesFromStart: number): { rows: StateRow[]; feel: number | null; hourIndex: number } {
  const H = field.hours.length;
  const pos = Math.min(H - 1, Math.max(0, minutesFromStart / 60));
  const h0 = Math.floor(pos), h1 = Math.min(H - 1, h0 + 1), p = pos - h0;
  const a = feelOf(field, h0, anchorCell, off), b = feelOf(field, h1, anchorCell, off);
  const lerp = (x: number | null, y: number | null) => (x === null || y === null ? x ?? y : x + (y - x) * p);
  const ta = lerp(a.ta, b.ta) as number, rh = lerp(a.rh, b.rh), feel = lerp(a.feel, b.feel);
  const rows: StateRow[] = [
    { label: "기온", value: `${ta.toFixed(1)}°C`, note: off.t ? `예보 +${off.t}°C` : "예보" },
    { label: "상대습도", value: rh === null ? "자료 없음" : `${Math.round(rh)} %`, note: off.rh ? `예보 +${off.rh} %p` : undefined },
    { label: "체감온도", value: feel === null ? "습도 없어 계산 못 함" : `${feel.toFixed(1)}°C`, note: feel === null ? undefined : feel >= HEAT_WARNING ? "경보 기준" : feel >= HEAT_ADVISORY ? "주의보 기준" : undefined },
  ];
  return { rows, feel, hourIndex: p >= 0.5 ? h1 : h0 };
}

/** 그 시각의 고온 칸 비율 — 지도 색면이 말하는 "어디가" 를 숫자로 */
export function hotShareAt(field: TemperatureField, off: HeatOffset, h: number): number {
  const vals = fieldValuesAt(field, h, off);
  return vals.filter((v) => v >= HEAT_ADVISORY).length / vals.length;
}
