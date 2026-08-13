/* ─────────────────────────────────────────────
 * 바람 격자 굽기 — Open-Meteo archive (ERA5 재분석) · 키 없음
 *
 * 남해안 광역의 시간대별 풍향·풍속 격자를 받아 public/weather/wind-field.json 으로
 * 굽는다. 실시간이 아니다 — 시연 당일(2026-08-12)은 재분석 자료가 없으므로, 한반도를
 * 관통한 태풍 솔릭(2018-08-23)의 실측 바람을 데모 배경으로 쓴다.
 *
 * 실행: designs/ 에서 `node scripts/fetch-wind-field.mjs` (수십 초)
 * 규격·근거: docs/작업/외부-API-인계.md §3-1
 * ───────────────────────────────────────────── */

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** 날짜·사건 — 태풍 솔릭 상륙일. 재분석(ERA5)이 있는 과거 날짜여야 한다 */
const DATE = "2018-08-23";
const EVENT = "태풍 솔릭";

/* 격자 범위 — 남해안 광역. 종합상황(SCR-01)은 시 전체 조망이라 바람은 더 넓은
   판에서 흐름이 보여야 한다 */
const WEST = 126.0;
const EAST = 131.5;
const SOUTH = 33.0;
const NORTH = 37.0;
/** 격자 간격 (°) — ERA5 원본 해상도(0.25° ≈ 25km). 더 좁혀도 새 정보가 없다 */
const STEP = 0.25;

/** 굽는 시각(그날의 시) 과 화면 기본 시각 */
const HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const DEFAULT_HOUR = 22;

const API = "https://archive-api.open-meteo.com/v1/archive";

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "weather",
  "wind-field.json",
);

/* 지점 목록 — 남→북 행, 서→동 열. index = iy * nx + ix */
const lngs = [];
for (let lng = WEST; lng <= EAST + 1e-9; lng += STEP) lngs.push(Number(lng.toFixed(4)));
const lats = [];
for (let lat = SOUTH; lat <= NORTH + 1e-9; lat += STEP) lats.push(Number(lat.toFixed(4)));

const points = [];
for (const lat of lats) for (const lng of lngs) points.push([lat, lng]);

console.log(`격자 ${lngs.length}×${lats.length} = ${points.length} 지점 · ${DATE} (${EVENT})`);

/* 전 지점을 한 요청에 넣는다 — 391 지점이면 URL 이 아직 짧아 나눌 필요가 없다 */
const url =
  `${API}?latitude=${points.map((p) => p[0]).join(",")}` +
  `&longitude=${points.map((p) => p[1]).join(",")}` +
  `&start_date=${DATE}&end_date=${DATE}` +
  `&hourly=wind_speed_10m,wind_direction_10m` +
  `&timezone=Asia%2FSeoul&wind_speed_unit=ms`;

const res = await fetch(url);
if (!res.ok) {
  console.error(`Open-Meteo 응답 ${res.status} — ${await res.text()}`);
  process.exit(1);
}
const body = await res.json();
const list = Array.isArray(body) ? body : [body];
if (list.length !== points.length) {
  console.error(`지점 수 불일치 — 요청 ${points.length} · 응답 ${list.length}`);
  process.exit(1);
}

/* 시간 우선 배열 — speed[h][i] · dir[h][i]. i 는 지점 index */
const speed = HOURS.map(() => new Array(points.length));
const dir = HOURS.map(() => new Array(points.length));

list.forEach((point, i) => {
  HOURS.forEach((hour, h) => {
    const s = point.hourly.wind_speed_10m[hour];
    const d = point.hourly.wind_direction_10m[hour];
    if (s == null || d == null) {
      console.error(`자료 없음 — 지점 ${i} ${hour}시. 날짜가 재분석 범위 밖인지 확인할 것`);
      process.exit(1);
    }
    speed[h][i] = Number(s.toFixed(1));
    dir[h][i] = Math.round(d);
  });
});

const out = {
  source: "Open-Meteo (CC BY 4.0) · ERA5 재분석 / Copernicus Climate Change Service",
  event: EVENT,
  date: DATE,
  bbox: [WEST, SOUTH, EAST, NORTH],
  step: STEP,
  nx: lngs.length,
  ny: lats.length,
  hours: HOURS,
  defaultHour: DEFAULT_HOUR,
  /** m/s · 도(바람이 불어오는 방위) — [시간][iy*nx+ix] */
  speed,
  dir,
};

await writeFile(OUT, JSON.stringify(out));
const kb = Math.round(JSON.stringify(out).length / 1024);
const h = HOURS.indexOf(DEFAULT_HOUR);
const max = Math.max(...speed[h]);
console.log(`완료 → public/weather/wind-field.json (${kb} KB)`);
console.log(`${DEFAULT_HOUR}시 최대 풍속 ${max} m/s`);
