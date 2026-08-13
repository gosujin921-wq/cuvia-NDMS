/* ─────────────────────────────────────────────
 * 기온 격자 굽기 — Open-Meteo historical-forecast (기상청 KMA 국지예보 1.5km) · 키 없음
 *
 * 창원 일대의 시간대별 기온 격자를 받아 public/weather/temperature-field.json 으로
 * 굽는다. 폭염일(2025-08-24)을 쓴다 — 시연 당일(2026-08-12)은 자료가 전부 null 이다.
 *
 * ⚠ 격자를 어림값으로 바꾸지 말 것. 모든 좌표가 서항 기준점 ± STEP 의 정수배다.
 *   128.3 같은 값에서 시작하면 서항이 격자 사이에 떨어져 옆 칸 값을 물고,
 *   04 §5 의 32.4℃ 와 어긋난다 — 이 날짜를 고른 이유가 사라진다.
 *
 * 실행: designs/ 에서 `node scripts/fetch-temperature-field.mjs` (429 대기 포함 약 5분)
 * 규격·근거: docs/작업/외부-API-인계.md §3-2 · §3-3
 * ───────────────────────────────────────────── */

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** 날짜·사건 — 폭염일. KMA 모델 보관 범위(2024~) 안이어야 한다 */
const DATE = "2025-08-24";
const EVENT = "폭염";

/** 기준점 — 서항지구. 격자의 모든 좌표가 여기서 STEP 의 정수배로 뻗는다. 고정 */
const SEOHANG = { lat: 35.197, lng: 128.567 };
/** 격자 간격 (°) — KMA 국지예보 원본 해상도(0.015° ≈ 1.5km). 고정 */
const STEP = 0.015;
/** 기준점에서 몇 칸씩 뻗나 — 창원 시역 + 여백. 키워도 되는 건 이것뿐 */
const REACH = { west: 18, east: 32, south: 20, north: 20 };

const HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const DEFAULT_HOUR = 17;
/** 04 §5 의 현재 기온 — 서항 17시 값이 이것과 갈리면 굽기가 잘못된 것 */
const DOC_TEMP = 32.4;

/** 무료 한도는 지점 수로 센다(250 지점 한 번 = 250 콜). 더 넣으면 URL 이 길어 거절 */
const BATCH = 250;
const COOLDOWN_MS = 65_000;

const API = "https://historical-forecast-api.open-meteo.com/v1/forecast";

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "weather",
  "temperature-field.json",
);

const lngs = [];
for (let i = -REACH.west; i <= REACH.east; i += 1)
  lngs.push(Number((SEOHANG.lng + i * STEP).toFixed(4)));
const lats = [];
for (let i = -REACH.south; i <= REACH.north; i += 1)
  lats.push(Number((SEOHANG.lat + i * STEP).toFixed(4)));

/* 남→북 행, 서→동 열. index = iy * nx + ix */
const points = [];
for (const lat of lats) for (const lng of lngs) points.push([lat, lng]);

console.log(`격자 ${lngs.length}×${lats.length} = ${points.length} 지점 · ${DATE} (${EVENT})`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 한 묶음을 받는다. 429 면 식힌 뒤 같은 묶음부터 다시 */
async function fetchBatch(batch, label) {
  for (;;) {
    const url =
      `${API}?latitude=${batch.map((p) => p[0]).join(",")}` +
      `&longitude=${batch.map((p) => p[1]).join(",")}` +
      `&start_date=${DATE}&end_date=${DATE}` +
      `&hourly=temperature_2m&models=kma_seamless&timezone=Asia%2FSeoul`;
    const res = await fetch(url);
    if (res.status === 429) {
      console.log(`${label} 429 — ${COOLDOWN_MS / 1000}초 쉬고 다시`);
      await sleep(COOLDOWN_MS);
      continue;
    }
    if (!res.ok) throw new Error(`Open-Meteo 응답 ${res.status} — ${await res.text()}`);
    const body = await res.json();
    return Array.isArray(body) ? body : [body];
  }
}

/* 시간 우선 배열 — temp[h][iy*nx+ix] (℃, 소수 1자리) */
const temp = HOURS.map(() => new Array(points.length));

for (let start = 0; start < points.length; start += BATCH) {
  const batch = points.slice(start, start + BATCH);
  const label = `${start + 1}~${start + batch.length}/${points.length}`;
  const list = await fetchBatch(batch, label);
  if (list.length !== batch.length)
    throw new Error(`지점 수 불일치 — 요청 ${batch.length} · 응답 ${list.length}`);

  list.forEach((point, offset) => {
    HOURS.forEach((hour, h) => {
      const value = point.hourly.temperature_2m[hour];
      if (value == null)
        throw new Error(
          `자료 없음 — 지점 ${start + offset} ${hour}시. 날짜가 KMA 보관 범위(2024~) 밖인지 확인할 것`,
        );
      temp[h][start + offset] = Number(value.toFixed(1));
    });
  });
  console.log(`${label} 수신`);
}

const out = {
  source: "Open-Meteo (CC BY 4.0) · 기상청(KMA) 국지예보모델",
  event: EVENT,
  date: DATE,
  bbox: [lngs[0], lats[0], lngs[lngs.length - 1], lats[lats.length - 1]],
  step: STEP,
  nx: lngs.length,
  ny: lats.length,
  hours: HOURS,
  defaultHour: DEFAULT_HOUR,
  /** ℃ — [시간][iy*nx+ix] */
  temp,
};

await writeFile(OUT, JSON.stringify(out));
const kb = Math.round(JSON.stringify(out).length / 1024);

const all = temp.flat();
const h = HOURS.indexOf(DEFAULT_HOUR);
const seohangIndex = REACH.south * lngs.length + REACH.west;
const seohang = temp[h][seohangIndex];
console.log(`완료 → public/weather/temperature-field.json (${kb} KB)`);
console.log(`범위 ${Math.min(...all)}~${Math.max(...all)}℃`);
console.log(`서항지구 ${DEFAULT_HOUR}:00 → ${seohang}℃ (04 §5 문서값: ${DOC_TEMP}℃)`);
if (seohang !== DOC_TEMP)
  console.log("⚠ 두 값이 갈린다 — 격자 앵커가 흔들린 것이니 그대로 커밋하지 말 것");
