/* ─────────────────────────────────────────────
 * 지역재해위험지구 표본에서 피해 강우 분포를 뽑는다 — /scr-00 슬라이더 앵커 "위험지구 피해 강우" (2026-09-17)
 *
 * 입력: public/data/지역재해위험지구.csv — 행정안전부 지역재해위험지구 **표본 100행**(공공데이터포털 미리보기 · 창원 행 없음 · 좌표 없음).
 * 전체본이 오면 같은 스크립트가 창원 행을 따로 뽑도록 늘린다. 지금은 전국 분포만 쓴다.
 *   DAM_HR_RNFL   피해 당시 시간강우량(mm/h)
 *   DAM_YMD_RNFL  피해 당시 일강우량(mm)
 * 실행: designs/ 에서 `node scripts/derive-risk-districts.mjs`
 * 산출: src/fixtures/risk-districts.generated.ts
 * ───────────────────────────────────────────── */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const text = await readFile(path.join(ROOT, "public", "data", "지역재해위험지구.csv"), "utf8");
const parse = (line) => { const out = []; let cur = "", q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; };
const rows = text.replace(/^﻿/, "").split(/\r?\n/).filter(Boolean).map(parse);
const hdr = rows[0]; const ix = Object.fromEntries(hdr.map((h, i) => [h, i]));
const data = rows.slice(2); // 2행은 한글 헤더
const num = (col) => data.map((r) => Number(r[ix[col]])).filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
const median = (a) => (a.length ? a[Math.floor((a.length - 1) / 2)] : 0);
const q = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.round(p * (a.length - 1)))] : 0);
const hr = num("DAM_HR_RNFL"), day = num("DAM_YMD_RNFL");
const floodTypes = ["침수", "내수", "하천", "외수"];
const hrFlood = data.filter((r) => floodTypes.some((k) => (r[ix["DST_RSK_DSTRCT_DTL_TYPE_CD"]] ?? "").includes(k))).map((r) => Number(r[ix["DAM_HR_RNFL"]])).filter((v) => v > 0).sort((a, b) => a - b);

const out = {
  sampleRows: data.length,
  hourly: { n: hr.length, q25: q(hr, 0.25), median: median(hr), q75: q(hr, 0.75), max: hr[hr.length - 1] ?? 0 },
  daily: { n: day.length, q25: q(day, 0.25), median: median(day), q75: q(day, 0.75), max: day[day.length - 1] ?? 0 },
  hourlyFlood: { n: hrFlood.length, median: median(hrFlood) },
};
console.log(JSON.stringify(out));

const ts = `/* 자동 생성 — scripts/derive-risk-districts.mjs (${new Date().toISOString().slice(0, 10)}). 손으로 고치지 않는다.
 * 행정안전부 지역재해위험지구 **표본 ${out.sampleRows}행**에서 뽑은 피해 당시 강우 분포. 창원 행은 없다(전체본이 오면 창원 값으로 바꾼다). */

/** 피해 당시 시간강우량(mm/h) 분포 · n=${out.hourly.n} */
export const RISK_DISTRICT_HOURLY = ${JSON.stringify(out.hourly)};
/** 피해 당시 일강우량(mm) 분포 · n=${out.daily.n} */
export const RISK_DISTRICT_DAILY = ${JSON.stringify(out.daily)};
/** 침수·내수·하천·외수 유형만의 시간강우 중앙값 · n=${out.hourlyFlood.n} */
export const RISK_DISTRICT_FLOOD_HOURLY_MEDIAN = ${out.hourlyFlood.median};
/** 화면 앵커 — 전국 표본 중앙값. "위험지구는 대체로 이 세기에서 피해가 났다" */
export const RISK_DISTRICT_DAMAGE_MM_PER_H = ${out.hourly.median};
`;
await writeFile(path.join(ROOT, "src", "fixtures", "risk-districts.generated.ts"), ts);
console.log("완료 → src/fixtures/risk-districts.generated.ts");
