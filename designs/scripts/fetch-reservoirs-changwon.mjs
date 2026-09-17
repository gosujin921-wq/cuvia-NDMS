/* ─────────────────────────────────────────────
 * 창원 저수지 최근 수위 받기 — 재난안전데이터 공유플랫폼 DSSP-IF-20287(시간저수지수위) (2026-09-17)
 * 3,057만 건(전국 · 시간별 · 2024-11~)이 시각순으로 쪽에 실려 있고 필터 파라미터는 먹지 않는다. 그래서 마지막 N쪽만 훑어
 * 창원(코드 4812*·4813*) 저수지의 가장 최근 관측 한 줄씩을 남긴다. 2024-09-21 서항 사건 시각은 자료 범위 밖이다.
 * 실행: designs/ 에서 `SAFETYDATA_RESERVOIR_KEY=<키> node scripts/fetch-reservoirs-changwon.mjs [쪽수=120]`
 * 산출: public/data/저수지수위.창원.json
 * ───────────────────────────────────────────── */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const KEY = process.env.SAFETYDATA_RESERVOIR_KEY; if (!KEY) { console.error("SAFETYDATA_RESERVOIR_KEY 가 없다"); process.exit(1); }
const ID = "DSSP-IF-20287", N = 1000, TAIL = Number(process.argv[2] ?? 120);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = (p) => `https://www.safetydata.go.kr/V2/api/${ID}?serviceKey=${KEY}&pageNo=${p}&numOfRows=${N}&returnType=json`;
const first = await (await fetch(url(1))).json();
const total = first.totalCount, last = Math.ceil(total / N);
console.log(`총 ${total}건 · ${last}쪽 · 마지막 ${TAIL}쪽만`);
const latest = new Map(); let seen = 0;
for (let p = last; p > last - TAIL && p >= 1; p -= 1) {
  let body = null;
  for (let t = 0; t < 3 && !body; t += 1) { try { const j = await (await fetch(url(p), { signal: AbortSignal.timeout(90000) })).json(); body = j.body ?? null; } catch { await new Promise((r) => setTimeout(r, 1500)); } }
  if (!body) continue;
  for (const r of body) {
    const cd = String(r.RSRVR_CD ?? "");
    if (!cd.startsWith("4812") && !cd.startsWith("4813")) continue;
    seen += 1;
    const cur = latest.get(cd);
    if (!cur || String(r.MSRN_DT) > String(cur.MSRN_DT)) latest.set(cd, r);
  }
  if ((last - p) % 20 === 0) console.log(`… ${last - p}/${TAIL} · 창원 코드 ${latest.size}`);
}
const rows = [...latest.values()].sort((a, b) => String(a.RSRVR_CD).localeCompare(String(b.RSRVR_CD))).map((r) => ({
  code: String(r.RSRVR_CD), at: String(r.MSRN_DT), level: r.LOLE == null ? null : Number(r.LOLE), storage: r.PONDAGE == null ? null : Number(r.PONDAGE),
  rate: r.WRERATES == null ? null : Number(r.WRERATES), inflow: r.INFLOW == null ? null : Number(r.INFLOW), outflow: r.GRS_OTFL == null ? null : Number(r.GRS_OTFL), gate: r.GTE_OTFL == null ? null : Number(r.GTE_OTFL),
}));
await writeFile(path.join(ROOT, "public", "data", "저수지수위.창원.json"), JSON.stringify({ source: `재난안전데이터 공유플랫폼 ${ID} 시간저수지수위`, fetchedAt: new Date().toISOString(), note: "코드 4812·4813 저수지의 가장 최근 관측 한 줄씩. 이름·위치는 이 API 에 없다", pagesScanned: TAIL, rowsSeen: seen, count: rows.length, rows }));
console.log(`창원 저수지 ${rows.length}곳(관측 ${seen}줄) → public/data/저수지수위.창원.json`);
for (const r of rows.slice(0, 12)) console.log(" ", r.code, r.at, "수위", r.level, "저수율", r.rate);
