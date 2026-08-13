/* ─────────────────────────────────────────────
 * 장비 팝업 — 03 화면정의서 §2 마커 팝업
 *
 * 계측 장비는 위치·상태·최근 측정값·추이를, CCTV 는 현장 영상을 보여준다.
 * 통신끊김 장비는 마지막 수신 시각만 세우고 그래프 자리를 비운다. 끊긴 장비가 옛 값을
 * 현재값처럼 보이면 안 된다.
 * ───────────────────────────────────────────── */

import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { Button, GlassPanel, StatusDotLabel, cn } from "@ds";
import { deviceKindSpec, type Device } from "../../../demo/devices";
import { latestValue, sensorSeries } from "../../../demo/measurements";
import {
  DISPLACEMENT_THRESHOLD,
  RAIN_THRESHOLD,
  WATER_THRESHOLDS,
  ALERT_LEVELS,
  levelSpec,
} from "../../../demo/levels";
import { activeEventOfDevice } from "../../../demo/events";
import { TrendChart, chartRange } from "../../../components/TrendChart";
import { formatClock } from "../../../lib/datetime";

const STATUS_TONE = {
  정상: "success",
  점검중: "muted",
  통신끊김: "danger",
} as const;

export function DevicePopup({ device, onClose }: { device: Device; onClose: () => void }) {
  const spec = deviceKindSpec(device.kind);
  const event = activeEventOfDevice(device.id);

  return (
    <GlassPanel className="w-[320px] overflow-hidden" borderStyle="none">
      <header className="flex items-start gap-2 border-b border-border px-3 py-2.5">
        <span
          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded"
          style={{ backgroundColor: spec.color }}
        >
          <Icon icon={spec.icon} className="size-3.5 text-white" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="truncate text-body font-semibold text-foreground">{device.name}</h3>
          <span className="text-caption text-foreground-subtle">{spec.label}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="팝업 닫기"
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent text-foreground-subtle transition-colors hover:bg-surface-raised hover:text-foreground"
        >
          <Icon icon="mdi:close" className="size-4" aria-hidden />
        </button>
      </header>

      {/* 이벤트 핀을 눌러 연 팝업 — 무슨 일이 났는지가 장비 정보보다 먼저다 */}
      {event && (
        <div
          className="flex items-center gap-2 border-b border-border px-3 py-2"
          style={{ borderLeft: `3px solid ${levelSpec(event.level).color}` }}
        >
          <span
            className="shrink-0 text-caption font-medium"
            style={{ color: levelSpec(event.level).color }}
          >
            {levelSpec(event.level).label}
          </span>
          <span className="min-w-0 flex-1 truncate text-caption text-foreground-muted">
            {event.type} {event.value} {event.unit}
          </span>
          <span className="shrink-0 text-caption text-foreground-subtle">
            {formatClock(event.raisedAt)} 발생
          </span>
        </div>
      )}

      {device.kind === "CV" ? <CctvBody device={device} /> : <SensorBody device={device} />}
    </GlassPanel>
  );
}

function SensorBody({ device }: { device: Device }) {
  const navigate = useNavigate();
  const spec = deviceKindSpec(device.kind);
  const offline = device.status === "통신끊김";
  const sample = latestValue(device);
  const series = offline ? [] : sensorSeries(device);

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
  const range = chartRange(series.length ? series : [{ at: sample.at, value: sample.value }], thresholds);

  return (
    <div className="flex flex-col gap-3 p-3">
      <dl className="flex flex-col gap-1 text-caption">
        <div className="flex gap-2">
          <dt className="w-12 shrink-0 text-foreground-subtle">주소</dt>
          <dd className="min-w-0 flex-1 text-foreground-muted">{device.address}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-12 shrink-0 text-foreground-subtle">지점</dt>
          <dd className="min-w-0 flex-1 text-foreground-muted">{device.spot}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-12 shrink-0 text-foreground-subtle">좌표</dt>
          <dd className="min-w-0 flex-1 font-mono text-foreground-muted">
            {device.center[1].toFixed(5)}, {device.center[0].toFixed(5)}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="w-12 shrink-0 text-foreground-subtle">상태</dt>
          <dd className="min-w-0 flex-1">
            <StatusDotLabel status={STATUS_TONE[device.status]} label={device.status} />
          </dd>
        </div>
      </dl>

      {offline ? (
        <div className="flex flex-col items-center gap-1 rounded border border-dashed border-border py-4">
          <Icon icon="mdi:lan-disconnect" className="size-5 text-danger" aria-hidden />
          <span className="text-caption text-foreground-muted">
            마지막 수신 {formatClock(sample.at)}
          </span>
          <span className="text-caption text-foreground-subtle">계측이 끊겨 현재값이 없습니다</span>
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-h4 font-semibold text-foreground">{sample.value}</span>
            <span className="text-caption text-foreground-muted">{spec.unit}</span>
            <span className="ml-auto text-caption text-foreground-subtle">
              {formatClock(sample.at)} 기준
            </span>
          </div>

          <TrendChart
            samples={series}
            thresholds={thresholds}
            unit={spec.unit}
            ariaLabel={`${device.name} 최근 6시간 추이`}
          />

          {/* 그래프에 그려지지 않은 기준선은 흐리게 둔다. 값이 아직 그만큼 오르지 않아
              축 범위 밖이라는 뜻이고, 선이 안 보이는 것이 오류로 읽히면 안 된다 */}
          <ul className="flex items-center justify-between gap-1 text-caption">
            {thresholds.map((t) => {
              const drawn = t.value >= range.min && t.value <= range.max;
              return (
                <li key={t.label} className={cn("flex items-center gap-1", !drawn && "opacity-45")}>
                  <span
                    className="h-0 w-3 shrink-0 border-t border-dashed"
                    style={{ borderColor: t.color }}
                    aria-hidden
                  />
                  <span className="text-foreground-subtle">{t.label}</span>
                  <span className="font-mono text-foreground-muted">{t.value}</span>
                </li>
              );
            })}
          </ul>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/scr-04?device=${device.id}`)}
            className="w-full"
          >
            상세 측정현황 보기
          </Button>
        </>
      )}
    </div>
  );
}

function CctvBody({ device }: { device: Device }) {
  const offline = device.status !== "정상";

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded bg-black">
        {offline ? (
          <div className="flex flex-col items-center gap-1">
            <Icon icon="mdi:video-off" className="size-6 text-foreground-subtle" aria-hidden />
            <span className="text-caption text-foreground-subtle">{device.status}</span>
          </div>
        ) : (
          <>
            {/* 데모에는 실제 스트림이 없다. 채널이 살아 있다는 것만 보인다 */}
            <div className="flex flex-col items-center gap-1">
              <Icon icon="mdi:cctv" className="size-7 text-foreground-subtle" aria-hidden />
              <span className="text-caption text-foreground-subtle">실시간 영상</span>
            </div>
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-surface px-1.5 py-0.5 text-caption text-foreground">
              <span className="size-1.5 animate-pulse rounded-full bg-danger" aria-hidden />
              LIVE
            </span>
          </>
        )}
      </div>
      <p className="text-caption text-foreground-muted">{device.address}</p>
    </div>
  );
}
