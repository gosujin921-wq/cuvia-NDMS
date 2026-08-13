/* ─────────────────────────────────────────────
 * 표출 기준표 — 03 화면정의서 §2 하단
 *
 * 지도 위 색이 무슨 장비인지 알려준다. 종류를 눌러 끄면 그 장비만 지도에서 내려간다.
 * 마커가 50대까지 올라가는 지구가 있어, 볼 것만 남기는 길이 없으면 화면이 막힌다.
 *
 * DS FilterCapsule(토글 칩) 을 쓴다. colorDot 에 장비 색을 주면 켜져 있을 때 칩이 그
 * 색으로 차서, 지도 마커 색과 기준표가 같은 색 문법으로 읽힌다.
 * ───────────────────────────────────────────── */

import { Badge, FilterCapsule } from "@ds";
import { Icon } from "@iconify/react";
import { DEVICE_KINDS, type DeviceKind } from "../../../demo/devices";

interface DeviceLegendProps {
  /** 종류별 대수 */
  counts: Record<DeviceKind, number>;
  hidden: DeviceKind[];
  onToggle: (kind: DeviceKind) => void;
}

export function DeviceLegend({ counts, hidden, onToggle }: DeviceLegendProps) {
  return (
    <section className="flex items-center gap-1 p-2" aria-label="장비 표출 기준">
      {DEVICE_KINDS.map((spec) => {
        const count = counts[spec.kind] ?? 0;
        const on = !hidden.includes(spec.kind);
        return (
          <FilterCapsule
            key={spec.kind}
            selected={on}
            colorDot={spec.color}
            disabled={count === 0}
            aria-pressed={on}
            onClick={() => onToggle(spec.kind)}
            className="disabled:cursor-default disabled:opacity-40"
          >
            <Icon icon={spec.icon} className="size-3.5 shrink-0" aria-hidden />
            {spec.label}
            <span className="font-mono opacity-70">{count}</span>
          </FilterCapsule>
        );
      })}

      {/* 이벤트 핀은 켜고 끄는 대상이 아니다. 모양이 다르다는 것만 알린다 (03 §0-5) */}
      <span className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden />
      <Badge variant="orange" className="gap-1.5">
        <Icon icon="mdi:waves-arrow-up" className="size-3.5 shrink-0" aria-hidden />
        이벤트 발생 장비
      </Badge>
    </section>
  );
}
