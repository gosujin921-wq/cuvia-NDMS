/* ─────────────────────────────────────────────
 * 지도 핀 — 장치 핀 · 이벤트 핀 (03 화면정의서 §0-5)
 *
 * 지도 위 핀은 두 가지 말을 한다. 섞으면 화면이 무엇을 알리는지 흐려지므로 모양부터 나눈다.
 *
 *   장치 핀  "여기 무엇이 설치돼 있다"  · 원형 글라스 칩 + 종류 색 보더 + 흰 아이콘. 펄스 없음
 *   이벤트 핀 "여기서 지금 무슨 일이 났다" · 단계 색 채움 타일 + 흰 아이콘 + 펄스. 더 크다
 *
 * 이벤트를 낸 장비 자리에는 이벤트 핀만 세운다. 같은 좌표에 두 핀을 겹치면 무엇을 눌러야
 * 하는지 알 수 없다. 장비 정보는 팝업이 이어서 말한다.
 *
 * 장비 상태(점검중·통신끊김)는 이벤트가 아니다. 핀을 흐리게 눕히고 배지로만 알린다.
 *
 * 장치 핀 호버 = 피커 팝오버(장비명·종류·상태·설치 지점). 클릭 팝업 전에 "이게 무슨
 * 장비인가"만 빠르게 확인하는 요약 층이라 측정값은 싣지 않는다(03 §0-5). DS picker prop
 * 하나로 붙어서 장치 핀을 쓰는 세 화면(SCR-02·03·05)에 같은 문법으로 적용된다.
 *
 * ▸ 이 파일은 DS MapMarker 를 도메인(장치/이벤트)으로 감싼 얇은 층이다 — 마커 렌더 자체는
 *   DS 정본을 쓴다. 대응하는 제품 정본은 cuvia_platform_web kits/gis-kit 의 MapPin /
 *   MapMarkerLayer(좌표고정 WebGL 판). 마커가 수백 개로 늘면 DOM 마커 대신 그쪽으로 간다.
 * ───────────────────────────────────────────── */

import { Button, MapMarker } from "@ds";
import { Icon } from "@iconify/react";
import { deviceKindSpec, type Device } from "../demo/devices";
import { facilityKindSpec, type Facility, type FacilityState } from "../demo/facilities";
import { levelSpec, type AlertLevel } from "../demo/levels";
import type { EventType } from "../demo/events";

/** 장치 핀 한 변(px) — DS facility 기본값 */
export const DEVICE_PIN_SIZE = 30;
/** 이벤트 핀 한 변(px) — DS event 기본값. 장치 핀보다 커서 먼저 눈에 든다 */
export const EVENT_PIN_SIZE = 38;

/** 이벤트 타입 아이콘 — 이벤트 핀은 "무슨 신호였는지"를 아이콘으로 남긴다 */
export const EVENT_TYPE_ICON: Record<EventType, string> = {
  수위: "mdi:waves-arrow-up",
  강우: "mdi:weather-pouring",
  변위: "mdi:arrow-expand-horizontal",
};

interface DevicePinProps {
  device: Device;
  selected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export function DevicePin({ device, selected, onClick }: DevicePinProps) {
  const spec = deviceKindSpec(device.kind);
  const offline = device.status !== "정상";

  return (
    <MapMarker
      className="pointer-events-auto"
      variant="facility"
      icon={spec.icon}
      size={DEVICE_PIN_SIZE}
      color={offline ? "var(--color-foreground-subtle)" : spec.color}
      dimmed={offline}
      selected={selected}
      badge={
        device.status === "통신끊김"
          ? { icon: "mdi:lan-disconnect", tone: "var(--color-danger)", label: "통신끊김" }
          : device.status === "점검중"
            ? { icon: "mdi:wrench", tone: "var(--color-foreground-muted)", label: "점검중" }
            : undefined
      }
      picker={{
        title: device.name,
        rows: [
          { label: "종류", value: spec.label },
          {
            label: "상태",
            value: device.status,
            /* 통신끊김만 위험색 — 배지 톤과 같은 값. 점검중은 중립(§0-5 "장비 상태는 이벤트가 아니다") */
            tone: device.status === "통신끊김" ? "var(--color-danger)" : undefined,
          },
          { label: "설치 지점", value: device.spot },
        ],
      }}
      onClick={onClick}
      aria-label={`${spec.label} · ${device.name} · ${device.status}`}
    />
  );
}

interface FacilityPinProps {
  facility: Facility;
  /** 운영 상태 — 시계로 자른 파생값(demo/facilities.ts) */
  state: FacilityState;
  /** 같은 자리를 보는 CCTV — 주면 피커 자유 슬롯에 [현장 영상] 버튼이 선다 */
  cctv?: { name: string; onOpen: () => void };
  /** 수동 개폐 — 주면 [수동 폐쇄]·[수동 개방]이 선다. 확인 창은 호출부가 든다(KISA 문법) */
  onRequestGateToggle?: () => void;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * 방재시설 핀 — 배수문 · 배수펌프장.
 *
 * 장치 핀과 **같은 모양**(원형 글라스 칩)을 쓴다. §0-5 가 장치 핀에 준 뜻이 "여기 무엇이
 * 설치돼 있다"이고 방재시설도 같은 말을 하기 때문이다. 색과 아이콘으로만 갈린다.
 *
 * 팝오버는 DS `MapMarker` 의 `picker` 를 쓴다 — KISA·SK 의 출입문 호버 팝오버(관제
 * 대시보드 도어 핀)를 DS 가 공용화해 둔 그 부품이다. 제목 → 강조줄 → 라벨행 → 자유 슬롯 →
 * 안내문 순서와 150ms 닫힘 유예가 DS 소유라, 여기서는 **무엇을 담을지만** 넘긴다.
 * 라벨행 구성도 원본 문법 그대로다: 종류 · 위치 · **문 상태 / 가동 여부**(원본의
 * `문 상태 · 가동 여부` 두 줄) · 운영 로그.
 *
 * 원본이 자유 슬롯에 [차단] · [차단 해제] 를 세운 자리에 **[수동 폐쇄] · [수동 개방]** 과
 * **[현장 영상]** 이 선다. 개폐는 되돌릴 수 있지만 물길을 막는 조작이라 원본처럼 확인 창을
 * 한 번 거치고, 확인 창은 피커가 아니라 호출부가 든다 — 피커는 마우스가 떠나면 닫힌다.
 *
 * 평소 상태는 배수펌프장 운영 로그를 시계로 자른 값이고, 수동 조작이 있으면 그것이 이긴다.
 * 어느 쪽으로 정해진 상태인지는 `state.manual` 이 말하고 피커 안내문이 그대로 적는다 —
 * 사람이 내린 명령과 운영 기록이 화면에서 같은 얼굴을 하면 안 된다.
 *
 * 운영 중인 상태(배수문 폐쇄 · 펌프 가동)는 배지로 알린다. **이벤트 핀으로 세우지 않는다** —
 * 폐쇄·가동은 센서가 감지한 사건이 아니라 조작·운영의 결과다(demo/drainage.ts).
 */
export function FacilityPin({
  facility,
  state,
  cctv,
  onRequestGateToggle,
  onClick,
}: FacilityPinProps) {
  const spec = facilityKindSpec(facility.kind);
  const gate = facility.kind === "gate";
  const engagedTone = gate ? "var(--color-warning)" : "var(--color-success)";
  const closed = gate && state.engaged;

  return (
    <MapMarker
      className="pointer-events-auto"
      variant="facility"
      icon={spec.icon}
      size={DEVICE_PIN_SIZE}
      color={spec.color}
      badge={
        state.engaged
          ? {
              icon: gate ? "mdi:lock" : "mdi:play",
              tone: engagedTone,
              label: state.label,
            }
          : undefined
      }
      picker={{
        title: facility.name,
        rows: [
          { label: "시설물 종류", value: spec.label },
          { label: "위치", value: facility.spot },
          {
            label: gate ? "문 상태" : "가동 여부",
            value: state.label,
            tone: state.engaged ? engagedTone : undefined,
          },
          ...(state.detail ? [{ label: "운영 로그", value: state.detail }] : []),
        ],
        /* 자유 슬롯은 close 를 받는다 — 조작을 누르면 피커를 먼저 닫고 확인 창을 연다.
           피커가 열린 채로 다이얼로그가 뜨면 마우스가 떠나는 순간 뒤에서 닫히며 깜빡인다 */
        extra: (close) =>
          onRequestGateToggle || cctv ? (
            <div className="mt-2 flex flex-col gap-1.5">
              {onRequestGateToggle && (
                <Button
                  size="sm"
                  onClick={() => {
                    close();
                    onRequestGateToggle();
                  }}
                >
                  <Icon
                    icon={closed ? "mdi:lock-open-variant" : "mdi:lock"}
                    className="size-4 shrink-0"
                    aria-hidden
                  />
                  {closed ? "수동 개방" : "수동 폐쇄"}
                </Button>
              )}
              {cctv && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    close();
                    cctv.onOpen();
                  }}
                  aria-label={`${cctv.name} 팝업 열기`}
                >
                  <Icon icon="mdi:cctv" className="size-4 shrink-0" aria-hidden />
                  현장 영상
                </Button>
              )}
            </div>
          ) : undefined,
        hint: state.manual
          ? "상황실이 수동으로 정한 상태입니다."
          : "배수펌프장 운영 기록을 받아 표시합니다.",
      }}
      onClick={onClick}
      aria-label={`${spec.label} · ${facility.name} · ${state.label}`}
    />
  );
}

interface EventPinProps {
  type: EventType;
  level: AlertLevel;
  label: string;
  selected?: boolean;
  /** 진행 중이면 펄스. 해제된 이벤트는 자리만 표시하고 잔물결을 두르지 않는다 */
  pulse?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export function EventPin({ type, level, label, selected, pulse = true, onClick }: EventPinProps) {
  const spec = levelSpec(level);

  return (
    <MapMarker
      className="pointer-events-auto"
      variant="event"
      icon={EVENT_TYPE_ICON[type]}
      size={EVENT_PIN_SIZE}
      color={spec.color}
      pulse={pulse}
      selected={selected}
      onClick={onClick}
      aria-label={`${spec.label} · ${type} · ${label}`}
    />
  );
}
