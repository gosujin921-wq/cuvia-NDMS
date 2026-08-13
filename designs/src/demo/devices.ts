/* ─────────────────────────────────────────────
 * 계측 장비 289대 — 배경: docs/레거시/정본/04_데모_데이터.md §2
 *
 * 지구별 대수는 04 §2-3 표를 그대로 따르고, 설치 좌표는 지구 중심 둘레에 고정 배치로
 * 만든다. 실제 설치 좌표를 받으면 이 생성 규칙 대신 좌표 표를 넣는다.
 *
 * 마커 색은 장비 종류를 뜻한다. 이벤트가 난 장비만 단계 색으로 바뀐다(03 §0-5).
 * ───────────────────────────────────────────── */

import { DISTRICTS, type District } from "./districts";
import { activeEventOfAt, eventViewAt } from "./events";
import { hashSeed, seededRandom } from "../lib/seed";

export type DeviceKind = "WL" | "RN" | "DP" | "CV" | "BC" | "TD";

export interface DeviceKindSpec {
  kind: DeviceKind;
  label: string;
  icon: string;
  /** CSS 색 값 — 마커·범례 공용. 비우면 DS 중립(흰 기본) — 색은 판정에 물리는 전용 센서 몫(04 §2-1) */
  color?: string;
  unit?: string;
}

export const DEVICE_KINDS: DeviceKindSpec[] = [
  {
    kind: "WL",
    label: "수위계",
    icon: "mdi:waves-arrow-up",
    color: "var(--color-primary)",
    unit: "EL.m",
  },
  {
    kind: "RN",
    label: "강우량계",
    icon: "mdi:weather-pouring",
    color: "var(--color-primary-text)",
    unit: "mm/h",
  },
  {
    kind: "DP",
    label: "변위계",
    icon: "mdi:arrow-expand-horizontal",
    color: "var(--color-success)",
    unit: "mm",
  },
  /* CCTV 는 색을 두지 않는다(04 §2-1) — 240대가 원색으로 서면 지도가 그 한 색으로 덮여
     전용 센서가 묻힌다. DS facility 기본(중립 흰 반투명)으로 눕힌다. KISA 선례와 같은 문법 */
  { kind: "CV", label: "CCTV", icon: "mdi:cctv" },
  { kind: "BC", label: "마을방송", icon: "mdi:bullhorn", color: "var(--color-foreground-muted)" },
  /* 조위계는 배열 끝에 둔다 — 설치 지점·좌표가 index 순서로 돌아서, 가운데 끼우면
     기존 장비의 지점명(서항 방파제 CCTV 등)과 좌표가 밀린다(04 §2-2) */
  {
    kind: "TD",
    label: "조위계",
    icon: "mdi:waves",
    color: "var(--cuvia-coral)",
    unit: "EL.m",
  },
];

export function deviceKindSpec(kind: DeviceKind): DeviceKindSpec {
  return DEVICE_KINDS.find((k) => k.kind === kind) ?? DEVICE_KINDS[0];
}

export type DeviceStatus = "정상" | "점검중" | "통신끊김";

export interface Device {
  id: string;
  districtId: string;
  kind: DeviceKind;
  /** 화면 표기명 */
  name: string;
  /** 설치 지점 (주소 뒤에 붙는 위치 설명) */
  spot: string;
  address: string;
  center: [number, number];
  status: DeviceStatus;
}

/** 지구별 대수 — 04 §2-3. CCTV 는 재난 전용 + 시 통합관제 연계분(04 §2-1)이라
    밀도를 만들고, 계측 센서는 판정·그래프에 물리는 전용 장비라 대수를 아낀다 */
const COUNTS: Record<string, Record<DeviceKind, number>> = {
  /* 봉암은 트랙 B 의 무대라 판정에 물리는 전용 센서를 늘렸다(04 §15-5).
     WL-001 외수위(봉암천) · WL-002 내수위(배수구역) · TD-001 하구 조위(만조가
     배수문을 언제까지 닫아 두는지의 출처). 교차검증 여덟 줄이 여기서 나온다 */
  bongam: { WL: 2, RN: 2, DP: 2, CV: 24, BC: 3, TD: 1 },
  yangdeok: { WL: 2, RN: 1, DP: 0, CV: 20, BC: 1, TD: 0 },
  guhang: { WL: 2, RN: 0, DP: 0, CV: 24, BC: 1, TD: 0 },
  /* 조위계는 시 전체 1대 — 마산항 서안(서항)이 실측 조위·해일 편차의 출처다(04 §2-1) */
  seohang: { WL: 2, RN: 0, DP: 1, CV: 28, BC: 2, TD: 1 },
  myeongdong: { WL: 2, RN: 0, DP: 0, CV: 24, BC: 1, TD: 0 },
  gwangryeo: { WL: 2, RN: 1, DP: 0, CV: 18, BC: 1, TD: 0 },
  yeojwa: { WL: 2, RN: 1, DP: 0, CV: 18, BC: 1, TD: 0 },
  changwoncheon: { WL: 2, RN: 1, DP: 0, CV: 18, BC: 1, TD: 0 },
  namcheon: { WL: 2, RN: 0, DP: 1, CV: 18, BC: 1, TD: 0 },
  yongwon: { WL: 2, RN: 0, DP: 0, CV: 18, BC: 1, TD: 0 },
  junam: { WL: 2, RN: 1, DP: 2, CV: 10, BC: 1, TD: 0 },
  paryong: { WL: 2, RN: 0, DP: 0, CV: 20, BC: 1, TD: 0 },
};

/** 설치 지점 이름 — 지구 유형에 따라 실제로 장비가 붙는 자리를 쓴다(04 §2-2).
    앞 4종의 순서를 바꾸면 기존 등재 장비명(여좌천 제방 CCTV 등)이 바뀐다 */
const SPOTS: Record<District["kind"], string[]> = {
  해일: ["방파제", "선착장", "해안도로", "물양장", "여객터미널", "어판장", "호안 산책로", "배후 주거지 입구"],
  하천: ["교량", "합류부", "하류 보", "제방", "세월교", "산책로 진입부", "배수펌프장", "둔치 주차장"],
  내수: ["배수문", "마을입구", "저지대 도로", "수로 합류부", "지하차도", "배수펌프장", "반지하 밀집구역", "상가 골목"],
  저수지: ["제방", "여수로", "취수탑", "하류 수로", "순환도로", "탐방로 입구", "관리사무소", "배후 농경지"],
};

/** 행정 주소 앞자리 — 시연 표기용. 실제 지번이 아니다 */
const ADDRESS_PREFIX: Record<string, string> = {
  bongam: "경남 창원시 마산회원구 봉암동",
  yangdeok: "경남 창원시 마산회원구 양덕동",
  guhang: "경남 창원시 마산합포구 남성동",
  seohang: "경남 창원시 마산합포구 신포동",
  myeongdong: "경남 창원시 진해구 명동",
  gwangryeo: "경남 창원시 마산회원구 내서읍 중리",
  yeojwa: "경남 창원시 진해구 여좌동",
  changwoncheon: "경남 창원시 성산구 사림동",
  namcheon: "경남 창원시 성산구 상남동",
  yongwon: "경남 창원시 진해구 용원동",
  junam: "경남 창원시 의창구 동읍 월잠리",
  paryong: "경남 창원시 의창구 팔용동",
};

/** 위도 1도당 거리 (m) */
const M_PER_DEG_LAT = 111_320;

/** 지구 중심에서 미터만큼 떨어진 좌표 */
function offset(center: [number, number], eastM: number, northM: number): [number, number] {
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((center[1] * Math.PI) / 180);
  return [center[0] + eastM / mPerDegLng, center[1] + northM / M_PER_DEG_LAT];
}

/** 점검중·통신끊김 장비 — 04 §2-4. 전부 정상이면 상태 표기가 있으나 마나 하다 */
const ABNORMAL: Record<string, DeviceStatus> = {
  "junam-RN-001": "점검중",
  "guhang-CV-003": "점검중",
  "yeojwa-CV-001": "통신끊김",
  "bongam-CV-004": "통신끊김",
};

function buildDevices(): Device[] {
  const list: Device[] = [];

  for (const district of DISTRICTS) {
    const counts = COUNTS[district.id];
    if (!counts) continue;

    const spots = SPOTS[district.kind];
    const rand = seededRandom(hashSeed(district.id));
    let index = 0;
    /* 같은 지구·같은 지점의 CCTV 대수 — 두 대째부터 "2호" 를 붙인다(04 §2-2) */
    const spotUse = new Map<string, number>();

    /* 지구 주축(해안선·하천 유로)을 따라 띠 모양으로 흩는다(04 §2-2). 중심 둘레의 원으로
       뿌리면 화면에서 점 뭉치 하나로 보인다 — 실제 장비는 해안과 하천을 따라 늘어선다 */
    const theta = (district.axisDeg * Math.PI) / 180;
    const [along, across] = district.spread;

    for (const spec of DEVICE_KINDS) {
      const n = counts[spec.kind];
      for (let i = 0; i < n; i += 1) {
        /* 축 방향 자리는 황금비 수열로 고르게 — 종류가 순서대로 생성돼도 같은 종류가
           띠의 한쪽 끝에 몰리지 않는다. 폭 방향은 난수로 흩는다 */
        const frac = ((index * 0.618) % 1) - 0.5;
        const alongM = frac * 2 * along * (0.85 + rand() * 0.3);
        const acrossM = (rand() * 2 - 1) * across;
        const eastM = alongM * Math.sin(theta) + acrossM * Math.cos(theta);
        const northM = alongM * Math.cos(theta) - acrossM * Math.sin(theta);
        const id = `${district.id}-${spec.kind}-${String(i + 1).padStart(3, "0")}`;
        /* index 는 장비마다 1씩 는다 — 여기에 i 를 더하면 한 종류 안에서 두 칸씩 건너뛰어
           봉암 CCTV 1·3호가 같은 지점을 받았다(감사 B-9). index 만으로 순서대로 돈다 */
        const spot = spots[index % spots.length];
        const nth = (spotUse.get(`${spec.kind}-${spot}`) ?? 0) + 1;
        spotUse.set(`${spec.kind}-${spot}`, nth);

        list.push({
          id,
          districtId: district.id,
          kind: spec.kind,
          name:
            spec.kind === "CV"
              ? `${district.name} ${spot} CCTV${nth > 1 ? ` ${nth}호` : ""}`
              : `${district.name} ${spec.label} ${i + 1}호기`,
          spot,
          address: `${ADDRESS_PREFIX[district.id] ?? "경남 창원시"} 일원`,
          center: offset(district.center, eastM, northM),
          status: ABNORMAL[id] ?? "정상",
        });
        index += 1;
      }
    }
  }

  return list;
}

export const DEVICES: Device[] = buildDevices();

export function devicesOf(districtId: string): Device[] {
  return DEVICES.filter((d) => d.districtId === districtId);
}

export function findDevice(id: string): Device | undefined {
  return DEVICES.find((d) => d.id === id);
}

/* ── CCTV 스틸 (04 §2-5) ───────────────────────────────────
 * 스트림이 없다. `public/cctv` 의 실촬 스틸이 그 자리를 받고, 화면 라벨은 LIVE 다.
 *
 * 컷은 화각(view) 하나에 평시 다섯 · 위험 하나로 든다. 평시 다섯은 서로 다른
 * 지점이라 카메라마다 하나를 물면 타일이 겹치지 않고, 위험 컷은 그 지구 사건이
 * 경보에 닿는 순간 갈린다(cctvStillAt) — 스틸도 다른 화면 요소와 같은 프레임에서
 * 함께 바뀐다(CLAUDE.md · 03 §0-7).
 * ───────────────────────────────────────────────────────── */

/** 화각 — 지구 유형이 고르는 촬영 갈래 */
export type CctvView = "harbor" | "reservoir" | "city";

/** 지구 유형 → 화각. 하천은 보·제방이라 저수지 컷과 같은 갈래로 본다 */
const DISTRICT_VIEW: Record<District["kind"], CctvView> = {
  해일: "harbor",
  저수지: "reservoir",
  하천: "reservoir",
  내수: "city",
};

/** 평시 컷 — 화각마다 다섯 지점. 장면 미등재 카메라가 id 로 하나를 문다 */
const CALM_STILLS: Record<CctvView, string[]> = {
  reservoir: [
    "/cctv/01_reservoir_calm_01.jpg",
    "/cctv/01_reservoir_calm_02.jpg",
    "/cctv/01_reservoir_calm_03.jpg",
    "/cctv/01_reservoir_calm_04.jpg",
    "/cctv/01_reservoir_calm_05.jpg",
  ],
  harbor: [
    "/cctv/03_harbor_calm_01.jpg",
    "/cctv/03_harbor_calm_02.jpg",
    "/cctv/03_harbor_calm_03.jpg",
    "/cctv/03_harbor_calm_04.jpg",
    "/cctv/03_harbor_calm_05.jpg",
  ],
  city: [
    "/cctv/05_city_normal_01.jpg",
    "/cctv/05_city_normal_02.jpg",
    "/cctv/05_city_normal_03.jpg",
    "/cctv/05_city_normal_04.jpg",
    "/cctv/05_city_normal_05.jpg",
  ],
};

/** 위험 컷 — 등재 장면이 경보 이상에서 갈아타는 한 장 */
const ALERT_STILL: Record<CctvView, string> = {
  reservoir: "/cctv/02_reservoir_rising.jpg",
  harbor: "/cctv/04_harbor_tsunami.jpg",
  city: "/cctv/06_city_flood_start.jpg",
};

/* ── 주요 CCTV 장면 (04 §2-5) ──────────────────────────────
 * 현장영상 패널과 CCTV 팝업이 트는 대본 카메라. 장면은 위험의 묘사지 판정이 아니다:
 * "월파 위험 확인" 판단 문구는 교차검증 행(04 §10-4) 몫이다.
 * ───────────────────────────────────────────────────────── */

export interface CctvSceneSpec {
  districtId: string;
  /** 설치 지점 — 그 지점의 첫 CCTV(무번호)가 대상이다 */
  spot: string;
  /** 장면 설명 — 타일 캡션 */
  scene: string;
  /** 카메라 방향 */
  bearing: string;
  /** 이 카메라의 화각 — 같은 지구 두 대가 같은 컷으로 갈리지 않게 장면마다 정한다.
   *  서항 해안도로·봉암 수로 합류부는 도로를 보므로 지구 유형(해일·내수)과 어긋난다 */
  view: CctvView;
  /** 평시 컷 — 지정하지 않으면 두 대가 같은 풀에서 같은 장을 물 수 있다 */
  calm: string;
}

export const CCTV_SCENES: CctvSceneSpec[] = [
  { districtId: "seohang", spot: "방파제", scene: "물양장 수위 상승", bearing: "남동 (외해·물양장)", view: "harbor", calm: "/cctv/03_harbor_calm_01.jpg" },
  { districtId: "seohang", spot: "해안도로", scene: "해안도로 월파", bearing: "남서 (해안도로 축)", view: "city", calm: "/cctv/05_city_normal_01.jpg" },
  /* 트랙 B (04 §15-6) — 배수문은 이 시연의 결정적 컷이다. 영상이 없으면 옆 칸의
     외수위·내수위 두 값과 08:47 폐쇄 로그로 대체해 말한다(봉암 대본 시연 실패 대비) */
  { districtId: "bongam", spot: "배수문", scene: "배수문 폐쇄 · 외수위 상승", bearing: "북 (봉암천 하류)", view: "reservoir", calm: "/cctv/01_reservoir_calm_03.jpg" },
  { districtId: "bongam", spot: "수로 합류부", scene: "수로 합류부 수위 상승", bearing: "북동 (배수구역 수로)", view: "city", calm: "/cctv/05_city_normal_02.jpg" },
];

/** 이 CCTV 에 등재된 장면 — 같은 지점의 2호부터는 장면이 없다(이름이 `CCTV` 로 끝나는 첫 대만) */
export function cctvSceneOf(device: Device): CctvSceneSpec | undefined {
  if (device.kind !== "CV" || !device.name.endsWith("CCTV")) return undefined;
  return CCTV_SCENES.find((s) => s.districtId === device.districtId && s.spot === device.spot);
}

/**
 * now 시점에 이 카메라가 트는 스틸 경로.
 *
 * 등재 장면은 지정 평시 컷으로 서 있다가 **그 지구 대표 사건이 경보 이상**이면 위험
 * 컷으로 갈린다 — 격상 프레임에서 토스트·핀·그래프와 함께 바뀐다. 미등재 카메라는
 * 지구 화각의 평시 풀에서 id 로 한 장을 물고 시연 내내 그대로다: 지구의 CCTV 스무 대가
 * 한꺼번에 침수 컷으로 바뀌면 계측이 짚은 한 지점이 묻힌다(04 §2-1 과 같은 이유).
 */
export function cctvStillAt(device: Device, now: Date): string {
  const scene = cctvSceneOf(device);
  if (scene) {
    const event = activeEventOfAt(device.districtId, now);
    const level = event ? eventViewAt(event, now).level : null;
    return level === "warning" || level === "evacuate" ? ALERT_STILL[scene.view] : scene.calm;
  }
  const districtIndex = DISTRICTS.findIndex((d) => d.id === device.districtId);
  const kind = DISTRICTS[districtIndex]?.kind ?? "내수";
  const pool = CALM_STILLS[DISTRICT_VIEW[kind]];
  /* 지구 순번 × 4 + 이 지구의 CCTV 번호. 무작위 해시로 고르면 한 스트립에 같은 컷이
     두 장 선다(주요 CCTV 6칸은 지구 셋에서 두 대씩 온다). 4 는 풀 크기 5 와 서로소라
     지구를 건너도 컷이 겹치지 않고, 같은 지구의 1·2호는 이웃한 컷을 문다 */
  const nth = Number(device.id.slice(-3)) - 1;
  return pool[(districtIndex * 4 + nth) % pool.length];
}

/** 현장영상 패널이 세우는 지구의 주요 CCTV — 장면 등재분 우선, 없으면 앞 2대 (04 §2-5) */
export function featuredCctvOf(districtId: string): Device[] {
  const cctvs = devicesOf(districtId).filter((d) => d.kind === "CV");
  const featured = cctvs.filter((d) => cctvSceneOf(d));
  return (featured.length > 0 ? featured : cctvs).slice(0, 2);
}
