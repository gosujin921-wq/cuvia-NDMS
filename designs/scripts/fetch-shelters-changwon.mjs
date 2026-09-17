/* ─────────────────────────────────────────────
 * 창원 무더위쉼터 받기 — 재난안전데이터 공유플랫폼 DSSP-IF-10942(행정안전부_무더위쉼터) 전체를 훑어 창원(ARCD 4812*)만 남긴다 (2026-09-17)
 *
 * 실행: designs/ 에서 `SAFETYDATA_SHELTER_KEY=<키> node scripts/fetch-shelters-changwon.mjs` (62쪽 · 1분 안팎)
 * 산출: public/data/무더위쉼터.창원.json — 화면이 필요한 열만 남긴다(이름 · 유형 · 주소 · 경위도 · 수용 · 운영시간 · 야간/주말 개방 · 냉방기)
 * 키는 API 마다 따로 발급된다(인계 문서 §2). 코드에 박지 않는다.
 * ───────────────────────────────────────────── */

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const KEY = process.env.SAFETYDATA_SHELTER_KEY;
if (!KEY) { console.error("SAFETYDATA_SHELTER_KEY 가 없다"); process.exit(1); }
const ID = "DSSP-IF-10942", N = 1000;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = (p) => `https://www.safetydata.go.kr/V2/api/${ID}?serviceKey=${KEY}&pageNo=${p}&numOfRows=${N}&returnType=json`;

const first = await (await fetch(url(1))).json();
const total = first.totalCount, pages = Math.ceil(total / N);
console.log(`총 ${total}건 · ${pages}쪽`);
const all = [...first.body];
for (let p = 2; p <= pages; p += 1) {
  for (let t = 0; t < 3; t += 1) {
    try { const j = await (await fetch(url(p), { signal: AbortSignal.timeout(30000) })).json(); if (j.body) { all.push(...j.body); break; } } catch { await new Promise((r) => setTimeout(r, 1500)); }
  }
}
const rows = all
  .filter((r) => String(r.ARCD ?? "").startsWith("4812") && r.LO && r.LA)
  .map((r) => ({
    id: String(r.RSTR_FCLTY_NO), name: r.RSTR_NM, type: r.FCLTY_TY, addr: r.RN_DTL_ADRES ?? r.DTL_ADRES ?? "", arcd: String(r.ARCD),
    lng: Number(r.LO), lat: Number(r.LA), capacity: Number(r.USE_PSBL_NMPR) || 0, areaM2: Number(r.AR) || 0,
    open: r.WKDAY_OPER_BEGIN_TIME ?? null, close: r.WKDAY_OPER_END_TIME ?? null,
    night: r.CHCK_MATTER_NIGHT_OPN_AT === "Y", weekend: r.CHCK_MATTER_WKEND_HDAY_OPN_AT === "Y", stay: r.CHCK_MATTER_STAYNG_PSBL_AT === "Y",
    ac: Number(r.COLR_HOLD_ARCNDTN) || 0, fan: Number(r.COLR_HOLD_ELEFN) || 0, year: r.YEAR,
  }));
const out = { source: `재난안전데이터 공유플랫폼 ${ID} 행정안전부_무더위쉼터`, fetchedAt: new Date().toISOString(), total, count: rows.length, rows };
await writeFile(path.join(ROOT, "public", "data", "무더위쉼터.창원.json"), JSON.stringify(out));
console.log(`창원 ${rows.length}건 → public/data/무더위쉼터.창원.json`);
