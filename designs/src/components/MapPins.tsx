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

import { MapMarker } from "@ds";
import { deviceKindSpec, type Device } from "../demo/devices";
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
