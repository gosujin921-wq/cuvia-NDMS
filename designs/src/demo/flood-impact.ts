/* ─────────────────────────────────────────────
 * 침수 영향 — 배경: docs/레거시/정본/04_데모_데이터.md §12
 *
 * 슬라이더 수위에 따라 바뀌는 영향 규모. 서항지구 고정값이고 사이값은 선형 보간한다.
 * "지금은 6동, 만조 조건이면 47동"(3.41 행과 4.24 행)이 선제 대피 판단의 근거로
 * 소리 내어 말해지는 유일한 숫자다(05 §3 S4).
 *
 * 시연용 고정값이다. 실제 산정은 DEM·건물 데이터와 겨뤄야 하는 백엔드 항목이다(03 §7).
 * ───────────────────────────────────────────── */

export interface FloodImpactRow {
  /** 수위 (EL.m) */
  level: number;
  /** 침수 면적 (ha) */
  areaHa: number;
  /** 영향 건물 (동) */
  buildings: number;
  /** 침수 해안도로 (m) */
  roadM: number;
  /** 물양장 진입로 전 구간 침수 여부 */
  wharfRoad: boolean;
  /** 대피 대상 (명) — 물이 대피 기준을 넘으면 지구 전체(04 §7-4) */
  evacuees: number;
}

/** 04 §12 표 그대로 — 값이 정본과 다르면 정본이 먼저다 */
const SEOHANG_IMPACT: FloodImpactRow[] = [
  { level: 3.41, areaHa: 0.4, buildings: 6, roadM: 120, wharfRoad: false, evacuees: 0 },
  { level: 3.8, areaHa: 1.3, buildings: 19, roadM: 310, wharfRoad: false, evacuees: 0 },
  { level: 4.2, areaHa: 2.9, buildings: 44, roadM: 620, wharfRoad: true, evacuees: 412 },
  { level: 4.24, areaHa: 3.1, buildings: 47, roadM: 640, wharfRoad: true, evacuees: 412 },
  { level: 4.31, areaHa: 3.4, buildings: 52, roadM: 700, wharfRoad: true, evacuees: 412 },
];

/** 04 §15-8 표 그대로 — 봉암 배수구역. 대피 대상은 저지대 영향 시작(4.30)에서 뜬다 */
const BONGAM_IMPACT: FloodImpactRow[] = [
  { level: 4.02, areaHa: 0.6, buildings: 2, roadM: 150, wharfRoad: false, evacuees: 0 },
  { level: 4.3, areaHa: 1.4, buildings: 11, roadM: 240, wharfRoad: true, evacuees: 328 },
  { level: 4.68, areaHa: 2.9, buildings: 41, roadM: 470, wharfRoad: true, evacuees: 328 },
  { level: 5.83, areaHa: 5.1, buildings: 118, roadM: 890, wharfRoad: true, evacuees: 328 },
];

/**
 * 지구별 표와 그 지구의 임계값 (04 §12 · §15-8).
 *
 *   zeroLevel     — 이 아래로는 영향이 0 으로 잦아든다(표에 없는 구간의 보간 앵커)
 *   evacueeLevel  — 대피 대상이 뜨는 수위. 서항은 계측 대피 기준(4.2)과 같고,
 *                   봉암은 **계측 기준(5.83)이 아니라 저지대 영향 시작 조건(4.30)** 이다.
 *                   봉암에서 계측이 끝내 대피 기준에 닿지 않는데도 대피를 권고하는
 *                   근거가 이 한 줄이다(04 §15-9)
 *   evacuees      — 대피 대상 수. 사람 수는 "기준을 넘으면 전체"지 비례가 아니라 보간하지 않는다
 *   roadNote      — 도로 전 구간 통제 여부의 기준 수위
 */
const TABLES: Record<
  string,
  { rows: FloodImpactRow[]; zeroLevel: number; evacueeLevel: number; evacuees: number }
> = {
  seohang: { rows: SEOHANG_IMPACT, zeroLevel: 2.9, evacueeLevel: 4.2, evacuees: 412 },
  bongam: { rows: BONGAM_IMPACT, zeroLevel: 3.83, evacueeLevel: 4.3, evacuees: 328 },
};

/**
 * 영향표가 등재된 지구인가 (04 §12 · §15-8).
 *
 * 표가 없는 지구는 조건을 밀어도 영향 결과가 서지 않는다 — 트윈이 스스로 지구를 고를 때
 * (메뉴 진입 · demo/analysis.ts drillDistrictAt) 빈 화면을 열지 않기 위한 물음이다.
 */
export function hasFloodImpact(districtId: string): boolean {
  return districtId in TABLES;
}

function zeroAnchor(level: number): FloodImpactRow {
  return { level, areaHa: 0, buildings: 0, roadM: 0, wharfRoad: false, evacuees: 0 };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 수위에 따른 침수 영향 — 서항지구만 값이 있다. 다른 지구는 null (레이어·카드가 서지 않는다).
 * 대피 대상은 보간하지 않는다 — 사람 수는 "기준을 넘으면 전체"지 비례가 아니다.
 */
export function floodImpactAt(districtId: string, level: number): FloodImpactRow | null {
  const table = TABLES[districtId];
  if (!table) return null;
  const rows = [zeroAnchor(table.zeroLevel), ...table.rows];
  const evacuated = level >= table.evacueeLevel;

  if (level <= rows[0].level) return { ...rows[0], level };
  const last = rows[rows.length - 1];
  if (level >= last.level) return { ...last, level };

  for (let i = 0; i < rows.length - 1; i += 1) {
    const lo = rows[i];
    const hi = rows[i + 1];
    if (level < lo.level || level > hi.level) continue;
    const t = (level - lo.level) / (hi.level - lo.level);
    return {
      level,
      areaHa: Number(lerp(lo.areaHa, hi.areaHa, t).toFixed(1)),
      buildings: Math.round(lerp(lo.buildings, hi.buildings, t)),
      roadM: Math.round(lerp(lo.roadM, hi.roadM, t) / 10) * 10,
      wharfRoad: evacuated,
      evacuees: evacuated ? table.evacuees : 0,
    };
  }
  return null;
}
