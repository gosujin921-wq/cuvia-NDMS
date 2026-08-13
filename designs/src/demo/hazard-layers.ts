/* ─────────────────────────────────────────────
 * 위험요소·대피 레이어 — 배경: docs/레거시/정본/04_데모_데이터.md §1-1
 *
 * 서항지구 4종. 좌표는 시연용 근사값이고 실제 GIS 데이터를 받으면 04 §1-1 표만 교체한다.
 *
 * **등재된 지구에서만 노출한다** — 다른 11개 지구에 빈 레이어를 세우지 않는다
 * ("켤 수 없는 토글을 만들지 않는다" · 04 §9 원칙).
 *
 * 배치: 재난관제(SCR-02)는 3종(파도휩쓸림·침수취약도로·해안 저지대), 트윈(SCR-05)은
 * 대피소 1종. 트윈은 수면이 지형을 따라 차오르는 화면이라 저지대도 잠기는 도로도 씬이
 * 직접 보여준다 — 그 위에 미리 그은 선·면을 겹치면 어느 쪽이 이번 조건의 결과인지
 * 흐려진다(03 §5). 대피소만 남기는 것은 "어디로 뺄 것인가"를 씬이 대신 못 하기 때문이다.
 *
 * 색은 03 에 정의가 없어 시연용으로 정했다 — 단계 색(노랑·주황·빨강)·장비 색(파랑·보라·
 * 초록)과 겹치지 않는 정보색. MapLibre paint 는 CSS 변수를 못 받아 리터럴로 둔다.
 * ───────────────────────────────────────────── */

export type HazardKind = "surge" | "road" | "lowland" | "shelter";

export interface HazardLayerSpec {
  id: string;
  districtId: string;
  kind: HazardKind;
  label: string;
  color: string;
  icon: string;
  /** 지도에 그리는 형태 */
  geometry:
    | { type: "band"; center: [number, number][]; widthPx: number }
    | { type: "lines"; lines: [number, number][][] }
    | { type: "polygon"; ring: [number, number][] }
    | { type: "point"; at: [number, number] };
  /** 부가 정보 — 카드·마커 라벨 */
  note?: string;
}

export const HAZARD_LAYERS: HazardLayerSpec[] = [
  {
    id: "seohang-surge",
    districtId: "seohang",
    kind: "surge",
    label: "파도휩쓸림 위험지역",
    color: "#0ea5b7",
    icon: "mdi:waves",
    /* 방파제~물양장 해안선 띠 · 길이 약 480m · 폭 35m. 수위계·방파제 CCTV 가 이 안에 선다 */
    geometry: {
      type: "band",
      center: [
        [128.5681, 35.1951],
        [128.5691, 35.1972],
        [128.5687, 35.1993],
      ],
      widthPx: 16,
    },
  },
  {
    id: "seohang-road",
    districtId: "seohang",
    kind: "road",
    label: "침수취약도로",
    color: "#ec4899",
    icon: "mdi:road-variant",
    /* 해안도로 본선 약 700m + 물양장 진입로 약 180m. §12 침수 도로와 같은 도로다 —
       남단부터 120m(3.41) → 640m(4.24) → 700m(4.31)가 잠긴다 */
    geometry: {
      type: "lines",
      lines: [
        [
          [128.566, 35.1936],
          [128.5673, 35.1956],
          [128.5679, 35.1982],
          [128.5671, 35.1999],
        ],
        [
          [128.5668, 35.197],
          [128.5686, 35.1974],
        ],
      ],
    },
  },
  {
    id: "seohang-lowland",
    districtId: "seohang",
    kind: "lowland",
    label: "해안 저지대",
    color: "#94a3b8",
    icon: "mdi:terrain",
    /* 약 4.2 ha · 물양장 배후 주거지. §12 최대 침수 면적(3.4 ha)의 그릇이고
       대피 대상 412명(04 §7-4)이 이 안에 산다 */
    geometry: {
      type: "polygon",
      ring: [
        [128.5656, 35.1958],
        [128.5678, 35.1961],
        [128.5682, 35.1986],
        [128.5666, 35.1992],
        [128.5652, 35.1976],
      ],
    },
  },
  {
    id: "seohang-shelter",
    districtId: "seohang",
    kind: "shelter",
    label: "해일 대피소",
    color: "#10b981",
    icon: "mdi:home-flood",
    /* 지구 중심 북서쪽 약 550m 고지대 · 수용 520명(대상 412명 초과).
       SOP 의 대피소 개방 요청(04 §11-3)이 여는 곳. 침수 시뮬레이션(4.24)에서
       물 밖에 남는 자리로 브라우저 확인을 거쳤다(감사 D-1 확인 회차) */
    geometry: { type: "point", at: [128.5615, 35.2035] },
    note: "수용 520명",
  },
];

/** 레이어 목록 표식 모양 — 지도에 그린 문법 그대로(03 §2). geometry 에서 파생한다 */
export type HazardSwatch = "band" | "line" | "area" | "point";

export function hazardSwatchOf(spec: HazardLayerSpec): HazardSwatch {
  const type = spec.geometry.type;
  return type === "lines" ? "line" : type === "polygon" ? "area" : type;
}

/** 재난관제(SCR-02)에 서는 3종 */
const CONTROL_KINDS: HazardKind[] = ["surge", "road", "lowland"];
/**
 * 트윈(SCR-05)에 서는 것 — 대피소 하나다.
 *
 * 침수취약도로를 뺐다: 트윈은 수면이 지형을 따라 차오르는 화면이라 어느 도로가 잠기는지를
 * 씬 자체가 보여준다. 그 위에 "여기가 취약도로"라고 선을 한 겹 더 그으면, 물에 잠긴 도로와
 * 미리 그어 둔 선이 겹쳐 어느 쪽이 이번 조건의 결과인지 흐려진다. 해안 저지대를 트윈에서
 * 뺀 이유(03 §5)와 같은 판단이다.
 *
 * 대피소는 남는다. 물이 어디까지 오는가와 어디로 뺄 것인가는 다른 정보이고, 뒤쪽은 씬이
 * 대신 보여줄 수 없다. 그래서 트윈의 이 묶음은 **위험요소가 아니라 대피 시설**이다 —
 * 대피소를 위험요소라고 부르면 화면이 거짓말을 한다.
 */
const TWIN_KINDS: HazardKind[] = ["shelter"];

export function hazardLayersOf(districtId: string, screen: "control" | "twin"): HazardLayerSpec[] {
  const kinds = screen === "control" ? CONTROL_KINDS : TWIN_KINDS;
  return HAZARD_LAYERS.filter(
    (layer) => layer.districtId === districtId && kinds.includes(layer.kind),
  );
}
