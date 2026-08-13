/* ─────────────────────────────────────────────
 * 레이어 표식 — 지도에 그린 문법을 체크 항목 크기로 줄인 것
 *
 * 장비는 장치 핀 문법(원형 글라스 칩 + 종류 색 보더 + 흰 아이콘 · MapPins 참고),
 * 위험요소는 지도에 실제로 그린 모양대로 띠·점선·면·마커로 가른다(03 §2 · §0-5).
 * 목록 표식이 전부 색 사각이면 이벤트 핀(색 채움 타일)과 문법이 섞여 지도의 무엇을
 * 끄는 것인지 안 읽힌다 — 원형은 장치, 채움 타일은 이벤트, 선·면은 위험요소다.
 * 선례: CUVIA_IDC MapLegendControl — 장비는 색 링 원형, 범례는 shape("bar" | "box") 구분.
 *
 * 색·투명도는 HazardLayers 의 paint 값을 따른다 — 띠 0.35 · 면 채움 0.12 근사.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { cn } from "@ds";
import type { HazardSwatch } from "../demo/hazard-layers";

/** 목록 표식 모양 — 위험요소 4종 + 장치 핀 + 지구 이름표 */
export type LegendShape = HazardSwatch | "device" | "pill";

interface LayerSwatchProps {
  shape: LegendShape;
  /** 표식 색 — pill 은 없어도 된다(이름표는 평소 톤이 기본이다) */
  color?: string;
  /** device·point 가 쓰는 글리프 */
  icon?: string;
  /** 상자 크기 — 팝오버 size-5 · 트윈 패널 size-4 */
  className?: string;
}

export function LayerSwatch({ shape, color, icon, className }: LayerSwatchProps) {
  /* 장치 핀 문법 — 원형 글라스 칩 + 종류 색 보더 + 흰 글리프 (IDC MapLegendControl 과 동일) */
  if (shape === "device") {
    return (
      <span
        aria-hidden
        className={cn("flex shrink-0 items-center justify-center rounded-full", className)}
        style={{
          background: "rgba(28,28,30,.95)",
          border: `1.5px solid ${color ?? "rgba(255,255,255,.35)"}`,
        }}
      >
        {icon && <Icon icon={icon} className="size-[62%] text-white" />}
      </span>
    );
  }

  /* 지구 이름표 문법 — 글라스 알약 + 상태 점. 이름표는 평소 톤이 기본이고 색은 이벤트
     단계가 정하므로(03 §1), 표식 점은 색을 받았을 때만 그 색이다 */
  if (shape === "pill") {
    return (
      <span aria-hidden className={cn("flex shrink-0 items-center justify-center", className)}>
        <span
          className="flex h-[72%] w-full items-center gap-[3px] rounded-full px-[4px]"
          style={{
            background: "rgba(28,28,30,.95)",
            border: "1px solid rgba(255,255,255,.28)",
          }}
        >
          <span
            className="size-[5px] shrink-0 rounded-full"
            style={{ backgroundColor: color ?? "rgba(255,255,255,.45)" }}
          />
          <span className="h-[3px] flex-1 rounded-full bg-white/40" />
        </span>
      </span>
    );
  }
  /* 대피소 마커 문법 — 색 테두리 + 색 글리프 (HazardLayers 의 DOM 마커와 같은 결) */
  if (shape === "point") {
    return (
      <span
        aria-hidden
        className={cn("flex shrink-0 items-center justify-center rounded", className)}
        style={{ border: `1.5px solid ${color}` }}
      >
        {icon && <Icon icon={icon} className="size-[62%]" style={{ color }} />}
      </span>
    );
  }

  return (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center", className)}>
      {shape === "band" && (
        /* 해안 띠 — 넓은 반투명 선. 폭이 곧 위험 범위라는 그 문법 */
        <span className="h-[38%] w-full rounded-full" style={{ backgroundColor: `${color}66` }} />
      )}
      {shape === "line" && (
        /* 침수취약도로 — 점선 */
        <span className="w-full border-t-2 border-dashed" style={{ borderColor: color }} />
      )}
      {shape === "area" && (
        /* 저지대 — 옅은 채움 + 점선 외곽 */
        <span
          className="size-full rounded-[3px] border border-dashed"
          style={{ borderColor: color, backgroundColor: `${color}26` }}
        />
      )}
    </span>
  );
}
