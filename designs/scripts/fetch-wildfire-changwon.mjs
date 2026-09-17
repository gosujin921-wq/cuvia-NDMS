/* ─────────────────────────────────────────────
 * 창원 산불정보 받기 — 재난안전데이터 공유플랫폼 DSSP-IF-10346(산불정보) 전체를 훑어 창원(신고주소에 "창원")만 남긴다 (2026-09-17)
 * 실행: designs/ 에서 `SAFETYDATA_WILDFIRE_KEY=<키> node scripts/fetch-wildfire-changwon.mjs`
 * 산출: public/data/산불정보.창원.json — 발화 일시 · 진화 완료 · 주소 · 경위도 · 원인 · 피해액
 * ───────────────────────────────────────────── */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const KEY = process.env.SAFETYDATA_WILDFIRE_KEY; if (!KEY) { console.error("SAFETYDATA_WILDFIRE_KEY 가 없다"); process.exit(1); }
const ID = "DSSP-IF-10346", N = 1000;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = (p) => `https://www.safetydata.go.kr/V2/api/${ID}?serviceKey=${KEY}&pageNo=${p}&numOfRows=${N}&returnType=json`;
const first = await (await fetch(url(1))).json();
if (!first.body) { console.error("응답:", JSON.stringify(first).slice(0, 300)); process.exit(1); }
const total = first.totalCount, pages = Math.ceil(total / N);
console.log(`총 ${total}건 · ${pages}쪽 · 필드: ${Object.keys(first.body[0]).join(",")}`);
const all = [...first.body];
for (let p = 2; p <= pages; p += 1) {
  for (let t = 0; t < 3; t += 1) { try { const j = await (await fetch(url(p), { signal: AbortSignal.timeout(30000) })).json(); if (j.body) { all.push(...j.body); break; } } catch { await new Promise((r) => setTimeout(r, 1500)); } }
  if (p % 20 === 0) console.log("…", p, "/", pages);
}
const rows = all.filter((r) => String(r.FRSTFR_DCLR_ADDR ?? "").includes("창원")).map((r) => ({
  id: String(r.FRSTFR_INFO_ID), at: r.FRSTFR_GNT_DT, extinguishedAt: r.EXTNGS_CMPTN_DT ?? null, endAt: r.EXTNGS_END_DT ?? null,
  addr: r.FRSTFR_DCLR_ADDR, lng: Number(r.FRSTFR_PSTN_XCRD), lat: Number(r.FRSTFR_PSTN_YCRD), place: r.FRSTFR_GNT_PLC ?? null,
  cause: r.FRSTFR_OCRN_CS_DTL_CN ?? null, causeCode: r.FRSTFR_OCRN_CS_CLSF_CD ?? null, damageKrw: Number(r.FRSTFR_GRS_DAM_AMT) || null,
})).filter((r) => Number.isFinite(r.lng) && Number.isFinite(r.lat));
const out = { source: `재난안전데이터 공유플랫폼 ${ID} 산불정보`, fetchedAt: new Date().toISOString(), total, count: rows.length, rows };
await writeFile(path.join(ROOT, "public", "data", "산불정보.창원.json"), JSON.stringify(out));
const years = rows.reduce((a, r) => { const y = String(r.at).slice(0, 4); a[y] = (a[y] || 0) + 1; return a; }, {});
console.log(`창원 ${rows.length}건 → public/data/산불정보.창원.json · 연도별 ${JSON.stringify(years)}`);
