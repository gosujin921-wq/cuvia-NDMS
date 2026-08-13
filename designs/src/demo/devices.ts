/* ─────────────────────────────────────────────
 * 계측 장비 50대 — 정본: docs/정본/04_데모_데이터.md §2
 *
 * 지구별 대수는 04 §2-3 표를 그대로 따르고, 설치 좌표는 지구 중심 둘레에 고정 배치로
 * 만든다. 실제 설치 좌표를 받으면 이 생성 규칙 대신 좌표 표를 넣는다.
 *
 * 마커 색은 장비 종류를 뜻한다. 이벤트가 난 장비만 단계 색으로 바뀐다(03 §0-5).
 * ───────────────────────────────────────────── */

import { DISTRICTS, type District } from "./districts";
import { hashSeed, seededRandom } from "../lib/seed";

export type DeviceKind = "WL" | "RN" | "DP" | "CV" | "BC";

export interface DeviceKindSpec {
  kind: DeviceKind;
  label: string;
  icon: string;
  /** CSS 색 값 — 마커·범례 공용 */
  color: string;
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
  /* CCTV 보라 — DS semantic 층에 장비 종류 색이 없어 primitive 토큰을 직접 참조한다.
     원칙은 semantic 토큰만 쓰는 것이므로, DS 에 장비 팔레트가 생기면 그 이름으로 교체한다. */
  { kind: "CV", label: "CCTV", icon: "mdi:cctv", color: "var(--cuvia-purple)" },
  { kind: "BC", label: "마을방송", icon: "mdi:bullhorn", color: "var(--color-foreground-muted)" },
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

/** 지구별 대수 — 04 §2-3 */
const COUNTS: Record<string, Record<DeviceKind, number>> = {
  bongam: { WL: 2, RN: 1, DP: 0, CV: 3, BC: 1 },
  yangdeok: { WL: 1, RN: 1, DP: 0, CV: 1, BC: 1 },
  guhang: { WL: 1, RN: 0, DP: 0, CV: 2, BC: 1 },
  seohang: { WL: 1, RN: 0, DP: 1, CV: 2, BC: 1 },
  myeongdong: { WL: 1, RN: 0, DP: 0, CV: 2, BC: 1 },
  gwangryeo: { WL: 1, RN: 1, DP: 0, CV: 1, BC: 0 },
  yeojwa: { WL: 1, RN: 1, DP: 0, CV: 1, BC: 0 },
  changwoncheon: { WL: 1, RN: 1, DP: 0, CV: 1, BC: 1 },
  namcheon: { WL: 1, RN: 0, DP: 1, CV: 2, BC: 1 },
  yongwon: { WL: 1, RN: 0, DP: 0, CV: 1, BC: 1 },
  junam: { WL: 2, RN: 1, DP: 1, CV: 1, BC: 0 },
  paryong: { WL: 1, RN: 0, DP: 0, CV: 1, BC: 1 },
};

/** 설치 지점 이름 — 지구 유형에 따라 실제로 장비가 붙는 자리를 쓴다 */
const SPOTS: Record<District["kind"], string[]> = {
  해일: ["방파제", "선착장", "해안도로", "물양장"],
  하천: ["교량", "합류부", "하류 보", "제방"],
  내수: ["배수문", "마을입구", "저지대 도로", "수로 합류부"],
  저수지: ["제방", "여수로", "취수탑", "하류 수로"],
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
  "yeojwa-CV-001": "통신끊김",
};

function buildDevices(): Device[] {
  const list: Device[] = [];

  for (const district of DISTRICTS) {
    const counts = COUNTS[district.id];
    if (!counts) continue;

    const spots = SPOTS[district.kind];
    const rand = seededRandom(hashSeed(district.id));
    let index = 0;

    for (const spec of DEVICE_KINDS) {
      const n = counts[spec.kind];
      for (let i = 0; i < n; i += 1) {
        /* 중심 둘레에 흩는다. 각도는 황금각으로 돌려 겹치지 않게, 거리는 120~340m */
        const angle = index * 2.399 + rand() * 0.6;
        const radius = 120 + rand() * 220;
        const id = `${district.id}-${spec.kind}-${String(i + 1).padStart(3, "0")}`;
        /* index 는 장비마다 1씩 는다 — 여기에 i 를 더하면 한 종류 안에서 두 칸씩 건너뛰어
           봉암 CCTV 1·3호가 같은 지점을 받았다(감사 B-9). index 만으로 순서대로 돈다 */
        const spot = spots[index % spots.length];

        list.push({
          id,
          districtId: district.id,
          kind: spec.kind,
          name:
            spec.kind === "CV"
              ? `${district.name} ${spot} CCTV`
              : `${district.name} ${spec.label} ${i + 1}호기`,
          spot,
          address: `${ADDRESS_PREFIX[district.id] ?? "경남 창원시"} 일원`,
          center: offset(district.center, Math.cos(angle) * radius, Math.sin(angle) * radius),
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
