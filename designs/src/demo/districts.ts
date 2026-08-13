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
}

export const DISTRICTS: District[] = [
  { id: "bongam", name: "봉암지구", kind: "내수", target: "봉암천 배수구역", center: [128.601, 35.219] },
  { id: "yangdeok", name: "양덕지구", kind: "내수", target: "양덕천 배수구역", center: [128.586, 35.226] },
  { id: "guhang", name: "구항지구", kind: "해일", target: "구항 방파제", center: [128.576, 35.202] },
  { id: "seohang", name: "서항지구", kind: "해일", target: "서항 물양장", center: [128.567, 35.197] },
  { id: "myeongdong", name: "명동항", kind: "해일", target: "명동항 선착장", center: [128.715, 35.089] },
  { id: "gwangryeo", name: "광려천", kind: "하천", target: "광려천 합류부", center: [128.517, 35.246] },
  { id: "yeojwa", name: "여좌천", kind: "하천", target: "여좌천 하류", center: [128.656, 35.153] },
  { id: "changwoncheon", name: "창원천", kind: "하천", target: "창원천 중류", center: [128.684, 35.244] },
  { id: "namcheon", name: "남천", kind: "하천", target: "남천 하류 보", center: [128.682, 35.218] },
  { id: "yongwon", name: "용원항", kind: "해일", target: "용원항 물양장", center: [128.818, 35.086] },
  { id: "junam", name: "주남저수지", kind: "저수지", target: "주남저수지 제방", center: [128.687, 35.316] },
  { id: "paryong", name: "팔용지구", kind: "내수", target: "팔용 배수구역", center: [128.627, 35.24] },
];

export function findDistrict(id: string): District | undefined {
  return DISTRICTS.find((d) => d.id === id);
}
