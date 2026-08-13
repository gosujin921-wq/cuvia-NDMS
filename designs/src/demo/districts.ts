/* ─────────────────────────────────────────────
 * 위험지구 12 — 정본: docs/정본/04_데모_데이터.md §1
 *
 * 좌표는 시연용 근사값이다. 각 지명의 실제 위치 부근이지만 장비 설치 좌표가 아니므로,
 * 실제 설치 정보를 받으면 04 문서와 이 파일의 좌표만 교체한다.
 * ───────────────────────────────────────────── */

/** 지구 유형 — 무엇 때문에 위험한 자리인지 */
export type DistrictKind = "내수" | "하천" | "해일" | "저수지";

export interface District {
  id: string;
  name: string;
  kind: DistrictKind;
  /** 관측 대상 (하천·항만·저수지 등) */
  target: string;
  /** [경도, 위도] — MapLibre 순서 */
  center: [number, number];
  /** 장비 배치 주축 — 해안선·하천 유로 방위 (북 기준 시계방향, 04 §2-2) */
  axisDeg: number;
  /** 배치 띠 크기 [축 반길이 m, 폭 반경 m] — 하천은 좁고 길게, 내수·저수지는 넓게 */
  spread: [number, number];
}

export const DISTRICTS: District[] = [
  { id: "bongam", name: "봉암지구", kind: "내수", target: "봉암천 배수구역", center: [128.601, 35.219], axisDeg: 60, spread: [500, 350] },
  { id: "yangdeok", name: "양덕지구", kind: "내수", target: "양덕천 배수구역", center: [128.586, 35.226], axisDeg: 30, spread: [500, 350] },
  { id: "guhang", name: "구항지구", kind: "해일", target: "구항 방파제", center: [128.576, 35.202], axisDeg: 35, spread: [500, 200] },
  { id: "seohang", name: "서항지구", kind: "해일", target: "서항 물양장", center: [128.567, 35.197], axisDeg: 20, spread: [700, 220] },
  { id: "myeongdong", name: "명동항", kind: "해일", target: "명동항 선착장", center: [128.715, 35.089], axisDeg: 95, spread: [550, 200] },
  { id: "gwangryeo", name: "광려천", kind: "하천", target: "광려천 합류부", center: [128.517, 35.246], axisDeg: 10, spread: [800, 180] },
  { id: "yeojwa", name: "여좌천", kind: "하천", target: "여좌천 하류", center: [128.656, 35.153], axisDeg: 140, spread: [700, 160] },
  { id: "changwoncheon", name: "창원천", kind: "하천", target: "창원천 중류", center: [128.684, 35.244], axisDeg: 150, spread: [800, 170] },
  { id: "namcheon", name: "남천", kind: "하천", target: "남천 하류 보", center: [128.682, 35.218], axisDeg: 120, spread: [800, 170] },
  { id: "yongwon", name: "용원항", kind: "해일", target: "용원항 물양장", center: [128.818, 35.086], axisDeg: 80, spread: [550, 200] },
  { id: "junam", name: "주남저수지", kind: "저수지", target: "주남저수지 제방", center: [128.687, 35.316], axisDeg: 60, spread: [700, 400] },
  { id: "paryong", name: "팔용지구", kind: "내수", target: "팔용 배수구역", center: [128.627, 35.24], axisDeg: 45, spread: [500, 350] },
];

export function findDistrict(id: string): District | undefined {
  return DISTRICTS.find((d) => d.id === id);
}
