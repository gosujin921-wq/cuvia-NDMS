/* ─────────────────────────────────────────────
 * 창원 무더위쉼터 — 실자료(행정안전부 · 재난안전데이터 공유플랫폼 DSSP-IF-10942 · 2026) (2026-09-17)
 *
 * public/data/무더위쉼터.창원.json 을 읽는다(scripts/fetch-shelters-changwon.mjs 가 굽는다). 967곳 전부 경위도가 있다.
 * 화면이 셈하는 것은 셋뿐이고 전부 원장값에서 나온다:
 *   그 시각 운영 중   운영시간(평일 시작·종료)이 등록된 곳(132곳) 가운데 그 시각이 시간 안인 곳. 등록 없는 곳은 세지 않는다(지어내지 않는다)
 *   야간 개방 표시    원장의 야간개방 Y (15곳)
 *   수용 인원 합계    원장의 이용가능인원 합
 * "쉼터가 몇 명을 덮는다"는 산수는 하지 않는다(README §2.3 기준 ③).
 * ───────────────────────────────────────────── */

export interface Shelter {
  id: string; name: string; type: string; addr: string; arcd: string;
  lng: number; lat: number; capacity: number; areaM2: number;
  /** "0900" 꼴 · 등록 없으면 null */
  open: string | null; close: string | null;
  night: boolean; weekend: boolean; stay: boolean; ac: number; fan: number; year: string;
}
export interface ShelterFile { source: string; fetchedAt: string; total: number; count: number; rows: Shelter[] }

let cache: Promise<ShelterFile> | null = null;
export function loadShelters(): Promise<ShelterFile> {
  cache ??= fetch("/data/무더위쉼터.창원.json").then((r) => { if (!r.ok) throw new Error(`쉼터 자료 ${r.status}`); return r.json() as Promise<ShelterFile>; });
  return cache;
}

const hhmm = (s: string | null): number | null => (s && /^\d{4}$/.test(s) ? Number(s.slice(0, 2)) * 60 + Number(s.slice(2)) : null);

/** 그 시각(분) 운영 중인가 — 운영시간이 등록된 곳만 판정한다. 등록 없으면 null(모름) */
export function isOpenAt(s: Shelter, minuteOfDay: number): boolean | null {
  const o = hhmm(s.open), c = hhmm(s.close);
  if (o === null || c === null) return null;
  return minuteOfDay >= o && minuteOfDay < c;
}

/** 그 시각 갈 수 있는가 — 운영시간 안이거나, 운영시간이 끝났어도 원장에 야간 개방 Y 인 곳. 등록 없으면 null(모름) */
export function isAvailableAt(s: Shelter, minuteOfDay: number): boolean | null {
  const open = isOpenAt(s, minuteOfDay);
  if (open === null) return s.night ? true : null;
  return open || (s.night && minuteOfDay >= (hhmm(s.close) ?? 0));
}

export interface ShelterSummary { total: number; capacity: number; night: number; withHours: number; openNow: number; closedNow: number }
export function summarizeShelters(rows: Shelter[], minuteOfDay: number): ShelterSummary {
  let openNow = 0, withHours = 0, closedNow = 0;
  for (const s of rows) {
    const v = isOpenAt(s, minuteOfDay);
    if (v !== null) { withHours += 1; if (v) openNow += 1; else if (!s.night) closedNow += 1; }
  }
  return { total: rows.length, capacity: rows.reduce((a, s) => a + s.capacity, 0), night: rows.filter((s) => s.night).length, withHours, openNow, closedNow };
}

/** 지도 층용 GeoJSON — 점마다 야간 개방·그 시각 갈 수 있는지(1 · 0 · 모름 -1)를 실어 색과 농도를 가른다 */
export function sheltersGeoJson(rows: Shelter[], minuteOfDay: number): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: rows.map((s) => {
      const a = isAvailableAt(s, minuteOfDay);
      return {
        type: "Feature", geometry: { type: "Point", coordinates: [s.lng, s.lat] },
        properties: { id: s.id, name: s.name, night: s.night ? 1 : 0, open: a === true ? 1 : a === false ? 0 : -1, capacity: s.capacity },
      };
    }),
  };
}
