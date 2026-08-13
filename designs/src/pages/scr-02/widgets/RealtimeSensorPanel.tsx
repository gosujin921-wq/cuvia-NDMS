/* ─────────────────────────────────────────────
 * 실시간 센서 수치 — 03 화면정의서 §2 우측
 *
 * 지구의 계측 장비를 한 줄씩 세우고, 선택한 장비의 최근 6시간 추이를 위에 크게 놓는다.
 * 마커를 누르지 않아도 이 패널에서 장비를 바꿀 수 있어야 한다. 지도 위 마커는 겹치고,
 * 시연 중 정확히 짚기 어렵다.
 * ───────────────────────────────────────────── */

import { EmptyState, StatusDotLabel, cn } from "@ds";
import { Icon } from "@iconify/react";
import { deviceKindSpec, type Device } from "../../../demo/devices";
import { latestValue, sensorSeries } from "../../../demo/measurements";
import {
  ALERT_LEVELS,
  DISPLACEMENT_THRESHOLD,
  RAIN_THRESHOLD,
  WATER_THRESHOLDS,
} from "../../../demo/levels";
import { TrendChart } from "../../../components/TrendChart";
import { formatClock } from "../../../lib/datetime";

interface RealtimeSensorPanelProps {
  /** 계측 장비만 (CCTV·마을방송 제외) */
  sensors: Device[];
  selected: Device | null;
  onSelect: (device: Device) => void;
}

export function RealtimeSensorPanel({ sensors, selected, onSelect }: RealtimeSensorPanelProps) {
  const focus = selected && selected.kind !== "CV" && selected.kind !== "BC" ? selected : sensors[0];

  return (
    /* 레일에서 남는 높이를 받는 패널 — 제목과 추이 그래프는 자리를 지키고 장비 목록만
       스크롤한다. 목록을 내리는 동안에도 고른 장비의 추이가 계속 보여야 한다 */
    <section className="flex min-h-0 flex-1 flex-col gap-2 p-3" aria-label="실시간 센서 수치">
      <h2 className="shrink-0 text-body font-semibold text-foreground">실시간 센서 수치</h2>

      {focus ? <FocusChart device={focus} /> : null}

      <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {sensors.map((sensor) => {
          const spec = deviceKindSpec(sensor.kind);
          const offline = sensor.status === "통신끊김";
          const sample = latestValue(sensor);
          const active = focus?.id === sensor.id;

          return (
            <li key={sensor.id}>
              <button
                type="button"
                onClick={() => onSelect(sensor)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-md border-none px-2 py-1.5 text-left transition-colors",
                  active ? "bg-surface-raised" : "bg-transparent hover:bg-surface-raised",
                )}
              >
                <Icon
                  icon={spec.icon}
                  className="size-4 shrink-0"
                  style={{ color: spec.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-caption text-foreground">
                  {sensor.name}
                </span>
                {offline ? (
                  <StatusDotLabel status="danger" label="통신끊김" className="shrink-0" />
                ) : (
                  <span className="shrink-0 font-mono text-caption text-foreground">
                    {sample.value}
                    <span className="ml-1 text-foreground-subtle">{spec.unit}</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function FocusChart({ device }: { device: Device }) {
  const spec = deviceKindSpec(device.kind);
  const offline = device.status === "통신끊김";
  const sample = latestValue(device);
  const base =
    device.kind === "WL"
      ? WATER_THRESHOLDS[device.districtId]
      : device.kind === "RN"
        ? RAIN_THRESHOLD
        : DISPLACEMENT_THRESHOLD;
  const thresholds = base
    ? ALERT_LEVELS.map((level) => ({
        value: base[level.id],
        color: level.color,
        label: level.label,
      }))
    : [];

  return (
    <div className="flex shrink-0 flex-col gap-1.5 border-b border-border pb-2">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 truncate text-caption text-foreground-muted">{device.name}</span>
        <span className="ml-auto shrink-0 text-caption text-foreground-subtle">
          {formatClock(sample.at)} 기준
        </span>
      </div>
      {offline ? (
        <div className="flex h-[88px] items-center justify-center rounded border border-dashed border-border">
          <EmptyState variant="inline" icon="mdi:lan-disconnect" message="계측 끊김" />
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-h4 font-semibold text-foreground">{sample.value}</span>
            <span className="text-caption text-foreground-muted">{spec.unit}</span>
          </div>
          <TrendChart
            samples={sensorSeries(device)}
            thresholds={thresholds}
            unit={spec.unit}
            height={88}
            ariaLabel={`${device.name} 최근 6시간 추이`}
          />
        </>
      )}
    </div>
  );
}
