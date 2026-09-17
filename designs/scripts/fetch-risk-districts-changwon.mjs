/* ─────────────────────────────────────────────
 * 창원 지역재해위험지구 받기 — 재난안전데이터 공유플랫폼 DSSP-IF-10075 전체를 훑어 창원(주소·법정동 4812*)만 남긴다 (2026-09-17)
 * 실행: designs/ 에서 `SAFETYDATA_RISK_KEY=<키> node scripts/fetch-risk-districts-changwon.mjs`
 * 산출: public/data/지역재해위험지구.창원.json
 * ───────────────────────────────────────────── */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const KEY = process.env.SAFETYDATA_RISK_KEY; if (!KEY) { console.error("SAFETYDATA_RISK_KEY 가 없다"); process.exit(1); }
const ID = "DSSP-IF-10075", N = 1000;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = (p) => `https://www.safetydata.go.kr/V2/api/${ID}?serviceKey=${KEY}&pageNo=${p}&numOfRows=${N}&returnType=json`;
const first = await (await fetch(url(1))).json();
if (!first.body) { console.error("응답:", JSON.stringify(first).slice(0, 300)); process.exit(1); }
const total = first.totalCount, pages = Math.ceil(total / N);
console.log(`총 ${total}건 · ${pages}쪽 · 필드: ${Object.keys(first.body[0]).join(",")}`);
const all = [...first.body];
for (let p = 2; p <= pages; p += 1) { for (let t = 0; t < 3; t += 1) { try { const j = await (await fetch(url(p), { signal: AbortSignal.timeout(30000) })).json(); if (j.body) { all.push(...j.body); break; } } catch { await new Promise((r) => setTimeout(r, 1500)); } } }
const isCw = (r) => String(r.DADDR ?? "").includes("창원") || String(r.RONA_DADDR ?? "").includes("창원") || String(r.STDG_CD ?? "").startsWith("4812") || String(r.DST_RSK_DSTRCT_RGN_CD ?? "").startsWith("4812");
const rows = all.filter(isCw);
await writeFile(path.join(ROOT, "public", "data", "지역재해위험지구.창원.json"), JSON.stringify({ source: `재난안전데이터 공유플랫폼 ${ID} 지역재해위험지구`, fetchedAt: new Date().toISOString(), total, count: rows.length, rows }));
console.log(`창원 ${rows.length}건 → public/data/지역재해위험지구.창원.json`);
for (const r of rows.slice(0, 40)) console.log(" ", r.DST_RSK_DSTRCT_NM, "|", r.DST_RSK_DSTRCT_DTL_TYPE_CD, "| 등급", r.DST_RSK_DSTRCT_GRD_CD, "| 시간강우", r.DAM_HR_RNFL, "| 해제", r.RMV_YMD || "-", "|", (r.RONA_DADDR || r.DADDR || "").trim().slice(0, 40));
