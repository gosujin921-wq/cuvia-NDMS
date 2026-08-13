/* ─────────────────────────────────────────────
 * 방재시설 — 배수문 · 배수펌프장
 *
 * 계측 장비(demo/devices.ts)와 **다른 축이다.** 장비는 값을 재는 것이고 이쪽은 물을
 * 막고 퍼내는 운영 시설이다. 그래서 장비 종류(DeviceKind)에 끼우지 않는다 —
 * 끼우면 "계측 장비 289대" 집계에 센서 아닌 것이 섞이고, 장비 레이어를 끄면 시설까지
 * 같이 사라진다.
 *
 * ★ 상태는 **운영 로그**다. `demo/drainage.ts` 헤더가 못 박은 그대로 — 배수문 폐쇄와
 *   펌프 가동은 센서 이벤트가 아니다. "시스템이 수위 센서로 폐쇄를 감지했다"고 말하면
 *   거짓이다(봉암 대본 S3 주의). 그래서 이벤트 핀으로 서지 않고, 단계 색도 쓰지 않는다.
 *
 * 상태값은 원장이 아니라 파생이다 — 폐쇄 시각(08:47)·가동 시작(07:52)을 현재 시계로
 * 자른 것이다. 시계가 그 시각을 밟기 전에는 개방·정지로 선다.
 *
 * 좌표는 시연용이다. 봉암천 유로 축(지구 axisDeg)을 따라 하류 쪽에 배수문을 두고,
 * 그 안쪽에 펌프장을 붙였다 — 실제 배치 순서(문이 바깥, 펌프가 안쪽)만 지킨 근사값이라
 * 실제 시설 좌표를 받으면 아래 `PLACEMENT` 표만 좌표 표로 갈아끼운다.
 * ───────────────────────────────────────────── */

import { findDistrict } from "./districts";
import { devicesOf } from "./devices";
import { drainageOf } from "./drainage";
import { formatClock } from "../lib/datetime";

export type FacilityKind = "gate" | "pump";

export interface FacilityKindSpec {
  kind: FacilityKind;
  label: string;
  icon: string;
  /** CSS 색 값 — 핀·범례 공용. 장비 색(파랑·보라·초록·산호)과 겹치지 않는 정보색 */
  color: string;
}

export const FACILITY_KINDS: FacilityKindSpec[] = [
  { kind: "gate", label: "배수문", icon: "mdi:boom-gate", color: "var(--color-warning)" },
  { kind: "pump", label: "배수펌프장", icon: "mdi:pump", color: "var(--color-primary-text)" },
];

export function facilityKindSpec(kind: FacilityKind): FacilityKindSpec {
  return FACILITY_KINDS.find((k) => k.kind === kind) ?? FACILITY_KINDS[0];
}

export interface Facility {
  id: string;
  districtId: string;
  kind: FacilityKind;
  name: string;
  /** 설치 지점 설명 */
  spot: string;
  center: [number, number];
  /**
   * 같은 자리를 보는 장비의 설치 지점 이름 (devices.ts SPOTS 값).
   *
   * 시설 핀에서 그 지점 CCTV 로 건너뛰는 길이다 — 배수문이 닫혔다는 로그를 읽은 다음
   * "그래서 지금 어떤데"가 바로 오는데, 그 답은 같은 자리에 선 카메라가 든다.
   */
  deviceSpot: string;
}

/** 위도 1도당 거리 (m) — devices.ts 와 같은 근사 */
const M_PER_DEG_LAT = 111_320;

/**
 * 시설 자리 — **같은 설치 지점의 CCTV 좌표**에서 잡는다.
 *
 * 시설과 그 시설을 비추는 카메라는 같은 자리에 있다. 좌표를 따로 잡으면 피커의
 * [현장 영상]이 엉뚱한 데로 지도를 끌고 간다 — 장비 좌표는 지구 중심 둘레의 고정 배치
 * 규칙(devices.ts)에서 나오지 두 자리가 저절로 맞지 않는다.
 *
 * 핀이 정확히 겹치면 둘 다 못 읽으므로 유로 축에 직각으로 `nudge` 만큼만 비켜 세운다.
 */
function atDeviceSpot(
  districtId: string,
  deviceSpot: string,
  nudgeM: number,
): [number, number] | null {
  const district = findDistrict(districtId);
  const camera = devicesOf(districtId).find(
    (d) => d.kind === "CV" && d.spot === deviceSpot,
  );
  if (!district || !camera) return null;
  const theta = (district.axisDeg * Math.PI) / 180;
  const eastM = nudgeM * Math.cos(theta);
  const northM = -nudgeM * Math.sin(theta);
  const [lng, lat] = camera.center;
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  return [lng + eastM / mPerDegLng, lat + northM / M_PER_DEG_LAT];
}

/** 배치 — 같은 지점 CCTV 에서 축 직각으로 비켜 세우는 거리(m) */
const PLACEMENT: (Omit<Facility, "center"> & { nudge: number })[] = [
  /* 봉암천 하류 — 외수(마산만)와 만나는 자리. 외수위가 내수위보다 높아지면 여기가 닫힌다 */
  {
    id: "bongam-GT-001",
    districtId: "bongam",
    kind: "gate",
    name: "봉암 배수문",
    spot: "봉암천 하류 배수문",
    deviceSpot: "배수문",
    nudge: 45,
  },
  /* 문 안쪽 — 문이 닫힌 동안 안쪽 물이 나가는 유일한 길 */
  {
    id: "bongam-PM-001",
    districtId: "bongam",
    kind: "pump",
    name: "봉암 배수펌프장",
    spot: "봉암천 하류 · 배수문 안쪽",
    deviceSpot: "배수펌프장",
    nudge: 45,
  },
];

export const FACILITIES: Facility[] = PLACEMENT.flatMap(({ nudge, ...spec }) => {
  const center = atDeviceSpot(spec.districtId, spec.deviceSpot, nudge);
  return center ? [{ ...spec, center }] : [];
});

/** 등재된 지구에서만 노출한다 — 켤 수 없는 토글을 만들지 않는다(04 §9 원칙) */
export function facilitiesOf(districtId: string): Facility[] {
  return FACILITIES.filter((f) => f.districtId === districtId);
}

/* ── 운영 상태 (배경: 04 §15-6) ────────────────────────────
 * 원장은 `drainage.ts` 의 운영 로그 하나뿐이고, 여기서는 현재 시계로 자른다.
 *
 * 그 위에 **상황실 수동 조작**이 얹힌다. 조작이 있으면 그것이 이긴다 — 사람이 방금 내린
 * 명령보다 운영 로그가 이기면 눌러도 아무 일이 없는 화면이 된다. 조작 기록은 엔진이
 * 소유하고(ScenarioProvider), 여기서는 받아서 계산만 한다.
 * ───────────────────────────────────────────────────────── */

/** 상황실이 수동으로 내린 개폐 명령 — 엔진이 든다. 시각은 시나리오 시계다 */
export interface GateOverride {
  closed: boolean;
  at: string;
}

export interface FacilityState {
  /** 상태 한 단어 — 폐쇄 · 개방 · 가동 · 정지 */
  label: string;
  /** 부연 한 줄 — 언제부터인지. 로그가 없으면 비운다 */
  detail?: string;
  /** 평시와 다른 상태인가 — 핀 배지·색 강조 자리 */
  engaged: boolean;
  /** 상황실 수동 조작으로 정해진 상태인가 — 운영 로그와 갈리는 자리 */
  manual: boolean;
}

export function facilityStateAt(
  facility: Facility,
  now: Date,
  /** 이 시설에 내려진 수동 명령 — 있으면 운영 로그를 이긴다 */
  override?: GateOverride,
): FacilityState {
  const drainage = drainageOf(facility.districtId);
  if (!drainage) return { label: "운영 로그 없음", engaged: false, manual: false };

  if (facility.kind === "gate") {
    if (override) {
      return {
        label: override.closed ? "폐쇄" : "개방",
        detail: `${formatClock(override.at)} 상황실 수동 ${override.closed ? "폐쇄" : "개방"}`,
        engaged: override.closed,
        manual: true,
      };
    }
    const closedAt = new Date(drainage.gateClosedAt);
    return now >= closedAt
      ? {
          label: "폐쇄",
          detail: `${formatClock(closedAt)} 폐쇄 · 역류 방지`,
          engaged: true,
          manual: false,
        }
      : { label: "개방", detail: "자연배수 중", engaged: false, manual: false };
  }

  const from = new Date(drainage.pumpsFrom);
  return now >= from
    ? {
        label: `${drainage.pumpsRunning}대 가동`,
        detail: `${formatClock(from)}~ · 전량 ${drainage.pumpsTotal}대`,
        engaged: true,
        manual: false,
      }
    : {
        label: "정지",
        detail: `전량 ${drainage.pumpsTotal}대`,
        engaged: false,
        manual: false,
      };
}
