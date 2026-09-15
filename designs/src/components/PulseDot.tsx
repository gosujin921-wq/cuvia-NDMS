/* ─────────────────────────────────────────────
 * 잔물결 상태 점 — 8px 상태 점에 지도 이벤트 마커와 같은 펄스를 준다 (CSMS PulseDot 을 그대로 잇는다)
 *
 * DS MapMarker(variant="event", pulse) 의 두 겹 시차 잔물결(animate-ping · 2.4s · 1.2s 지연)을
 * 점 크기로 옮긴 것이다. 점 자체의 opacity 를 흔드는 animate-pulse(DS StatusDotLabel)는 8px 에선
 * 거의 안 보인다. DS 에 점+잔물결 부품이 없고 MapMarker 는 잔물결을 따로 내보내지 않는다.
 * // TODO(ds): DS MapMarker 의 잔물결을 독립 부품으로 승격하면 이 파일을 지운다
 *
 * 쓰는 곳은 지도 지구 이름표(IncidentMarkers)뿐이다. 좌우 패널(목록·사건 카드)에는 펄스를 두지
 * 않는다 — 지도가 같은 지구에 같은 잔물결을 치고 있어 중복 알람이다(CSMS 2026-08-27 결정).
 *
 * 레이아웃 크기는 점(8px)뿐이다 · 잔물결은 absolute 라 높이·간격을 안 바꾼다.
 * 잔물결 최대 지름은 ping 2배 = 기준 지름(rippleSize) × 2. 쓰는 자리의 여백에 맞춰 잡는다.
 * overflow 가 있는 컨테이너 안에서는 점 중심에서 가장자리까지의 거리를 넘지 않게 잡는다.
 * ───────────────────────────────────────────── */

import { cn } from "@ds";

/** 잔물결 기준 지름(px) 기본값 · ping 이 2배로 키운다 */
const DEFAULT_RIPPLE_SIZE = 14;
/** 안 겹은 바깥 겹의 8할 · DS MapMarker(78/62px) 비율 */
const INNER_RATIO = 0.8;
/** DS MapMarker 와 같은 주기. 바깥 겹이 먼저, 안 겹이 반 주기 뒤에 */
const RIPPLE_PERIOD = "2.4s";
const RIPPLE_STAGGER = "1.2s";

export function PulseDot({
  dotClass,
  rippleClass = dotClass,
  ripple,
  rippleSize = DEFAULT_RIPPLE_SIZE,
  className,
}: {
  /** 점 색 · `bg-*` 토큰 클래스 (status-tone 의 `dot`) */
  dotClass: string;
  /** 잔물결 색 · 기본은 점과 같다. 점은 지구 상태, 잔물결은 사건 위험도처럼 둘의 뜻이 다를 때만 따로 준다 */
  rippleClass?: string;
  /** 잔물결을 돌릴지 · false 면 그냥 점이다 */
  ripple: boolean;
  /** 바깥 잔물결 기준 지름(px) · 최대 지름은 이 값의 2배. 옆 글자까지 퍼지는 크기면 쓰는 쪽에서 글자를
      `relative z-[1]` 로 올린다. 음수 z-index 로 뒤로 보내면 backdrop-filter 버튼 안에서 글라스 배경 뒤로
      통째로 숨는다 */
  rippleSize?: number;
  className?: string;
}) {
  const outer = rippleSize;
  const inner = Math.round(rippleSize * INNER_RATIO);
  const ringClass = cn(
    "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full animate-ping",
    rippleClass,
  );

  return (
    <span className={cn("relative inline-flex size-2 shrink-0 items-center justify-center", className)} aria-hidden>
      {ripple && (
        <>
          <span className={ringClass} style={{ width: outer, height: outer, opacity: 0.55, animationDuration: RIPPLE_PERIOD }} />
          <span
            className={ringClass}
            style={{ width: inner, height: inner, opacity: 0.7, animationDuration: RIPPLE_PERIOD, animationDelay: RIPPLE_STAGGER }}
          />
        </>
      )}
      <span className={cn("relative size-2 rounded-full", dotClass)} />
    </span>
  );
}
