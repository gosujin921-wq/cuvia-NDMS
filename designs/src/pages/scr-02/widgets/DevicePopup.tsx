/* ─────────────────────────────────────────────
 * 장비 팝업 — 03 화면정의서 §2 마커 팝업
 *
 * 이벤트 핀으로 열면 **사건이 본문이다**: 사건 띠(단계·값·시각) 아래 재난유형·처리상태·
 * 초과 기준·발생/격상이 서고, 장비 정보는 지점·상태로 압축된다 — 이벤트 핀은 감지한
 * 장비가 사건으로 바뀐 것이라(§0-5), 눌렀을 때 장비 대장이 아니라 사건이 나와야 한다.
 * 장치 핀(진행 사건 없음)은 장비 요약이다: 주소·지점·좌표·상태·현재값.
 * 둘 다 [상세 측정현황 보기](장비 층의 길 · SCR-04)로 닫는다.
 *
 * 추이 그래프·기준선·위험도 판정·[이 사건 대응하기]는 싣지 않는다 — 추이는 좌측 계측
 * 추이가, 판정·실행은 우측 판단·대응 레일이 이미 화면에 들고 있고, 팝업에 되풀이하면
 * 같은 값이 두 벌씩 서서 격상 순간 함께 갱신할 자리만 는다(03 §2).
 *
 * CCTV 는 현장 영상을 보여준다. 통신끊김 장비는 현재값 대신 마지막 수신 시각을
 * 세운다 — 끊긴 장비가 옛 값을 현재값처럼 보이면 안 된다.
 * ───────────────────────────────────────────── */

import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { Button, GlassPanel, StatusDotLabel, Tag } from "@ds";
import { cctvSceneOf, deviceKindSpec, type Device } from "../../../demo/devices";
import { CctvScene } from "../../../components/CctvScene";
import { latestValue } from "../../../demo/measurements";
import {
  activeEventOfDeviceAt,
  eventViewAt,
  hazardLabel,
  type AlertEvent,
  type EventView,
} from "../../../demo/events";
import {
  DISPLACEMENT_THRESHOLD,
  RAIN_THRESHOLD,
  WATER_THRESHOLDS,
  levelSpec,
} from "../../../demo/levels";
import { processStateAt } from "../../../demo/sop";
import { useScenario } from "../../../state/ScenarioProvider";
import { formatClock } from "../../../lib/datetime";

const STATUS_TONE = {
  정상: "success",
  점검중: "muted",
  통신끊김: "danger",
} as const;

export function DevicePopup({
  device,
  onClose,
  onRespond,
}: {
  device: Device;
  onClose: () => void;
  /** [이 사건 대응하기] — 대응 실행 집중 팝업을 연다(03 §2). 우측 [대응 실행]과 같은
   *  팝업의 두 번째 진입로. 판정할 거리가 생긴 주인공 진행 사건에서만 온다 */
  onRespond?: () => void;
}) {
  const { now } = useScenario();
  const spec = deviceKindSpec(device.kind);
  const event = activeEventOfDeviceAt(device.id, now);
  const view = event ? eventViewAt(event, now) : null;

  return (
    <GlassPanel className="w-[300px] overflow-hidden" borderStyle="none">
      <header className="flex items-start gap-2 border-b border-border px-3 py-2.5">
        <span
          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded"
          style={{ backgroundColor: spec.color ?? "var(--color-surface-raised)" }}
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

      {/* 사건 띠 — 이벤트 핀으로 연 팝업은 사건이 먼저다. 격상되면 색·라벨·값·시각이
          함께 바뀐다. 판정·실행은 여기 없다 — 우측 판단·대응 레일이 항상 보인다(03 §2) */}
      {event && view && (
        <div
          className="flex items-center gap-2 border-b border-border px-3 py-2"
          style={{ borderLeft: `3px solid ${levelSpec(view.level).color}` }}
        >
          <span
            className="shrink-0 text-caption font-medium"
            style={{ color: levelSpec(view.level).color }}
          >
            {levelSpec(view.level).label}
          </span>
          <span className="min-w-0 flex-1 truncate text-caption text-foreground-muted">
            {event.type} {view.value} {event.unit}
          </span>
          <span className="shrink-0 text-caption text-foreground-subtle">
            {formatClock(view.stageAt)} {view.escalated ? "격상" : "발생"}
          </span>
        </div>
      )}

      {device.kind === "CV" ? (
        <CctvBody device={device} />
      ) : event && view ? (
        <EventBody device={device} event={event} view={view} onRespond={onRespond} />
      ) : (
        <SensorBody device={device} />
      )}
    </GlassPanel>
  );
}

/* ── 이벤트 핀 본문 — 사건 정보가 장비 정보보다 먼저다 (03 §2 마커 팝업) ────── */

function EventBody({
  device,
  event,
  view,
  onRespond,
}: {
  device: Device;
  event: AlertEvent;
  view: EventView;
  onRespond?: () => void;
}) {
  const { now, approvedResponseLevel } = useScenario();
  const navigate = useNavigate();
  const spec = deviceKindSpec(device.kind);
  const sample = latestValue(device, now);
  const levelColor = levelSpec(view.level).color;

  /* 초과한 발령 기준 — 단계 판정의 근거를 값 옆에 세운다 (04 §3) */
  const base =
    event.type === "수위"
      ? WATER_THRESHOLDS[event.districtId]
      : event.type === "강우"
        ? RAIN_THRESHOLD
        : DISPLACEMENT_THRESHOLD;
  const threshold = base?.[view.level];

  return (
    <div className="flex flex-col gap-3 p-3">
      <dl className="flex flex-col gap-1 text-caption">
        <div className="flex items-center gap-2">
          <dt className="w-14 shrink-0 text-foreground-subtle">재난유형</dt>
          <dd className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="font-medium text-foreground">{hazardLabel(event.hazardType)}</span>
            <Tag className="shrink-0">{processStateAt(event, now, approvedResponseLevel)}</Tag>
          </dd>
        </div>
        {threshold !== undefined && (
          <div className="flex items-baseline gap-2">
            <dt className="w-14 shrink-0 text-foreground-subtle">초과 기준</dt>
            <dd className="text-foreground-muted">
              <span style={{ color: levelColor }}>{levelSpec(view.level).label}</span>{" "}
              <span className="font-mono text-foreground">{threshold}</span> {event.unit}
            </dd>
          </div>
        )}
        <div className="flex items-baseline gap-2">
          <dt className="w-14 shrink-0 text-foreground-subtle">발생</dt>
          <dd className="font-mono text-foreground-muted">
            {formatClock(new Date(event.raisedAt))}
          </dd>
          {view.escalated && (
            <>
              <dt className="shrink-0 text-foreground-subtle">격상</dt>
              <dd className="font-mono" style={{ color: levelColor }}>
                {formatClock(new Date(view.stageAt))}
              </dd>
            </>
          )}
        </div>
        {/* 장비는 지점·상태로 압축 — 대장(주소·좌표)은 장치 핀 팝업·SCR-04 몫 */}
        <div className="flex items-center gap-2">
          <dt className="w-14 shrink-0 text-foreground-subtle">탐지 장비</dt>
          <dd className="flex min-w-0 flex-1 items-center gap-1.5 text-foreground-muted">
            <span className="truncate">지점 {device.spot}</span>
            <StatusDotLabel
              status={STATUS_TONE[device.status]}
              label={device.status}
              className="shrink-0"
            />
          </dd>
        </div>
      </dl>

      <div className="flex items-baseline gap-2">
        <span className="font-mono text-h4 font-semibold text-foreground">{sample.value}</span>
        <span className="text-caption text-foreground-muted">{spec.unit}</span>
        <span className="ml-auto text-caption text-foreground-subtle">
          {formatClock(sample.at)} 기준
        </span>
      </div>

      {/* 사건 층의 길과 장비 층의 길이 나란히 — [이 사건 대응하기]는 우측 [대응 실행]과
          같은 집중 팝업을 연다. 대응할 판정이 없으면(격상 전) 서지 않는다 */}
      <div className="flex gap-1.5">
        {onRespond && (
          <Button size="sm" onClick={onRespond} className="flex-1">
            이 사건 대응하기
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/scr-04?device=${device.id}`)}
          className="flex-1"
        >
          상세 측정현황 보기
        </Button>
      </div>
    </div>
  );
}

function SensorBody({ device }: { device: Device }) {
  const { now } = useScenario();
  const navigate = useNavigate();
  const spec = deviceKindSpec(device.kind);
  const offline = device.status === "통신끊김";
  const sample = latestValue(device, now);

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
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-h4 font-semibold text-foreground">{sample.value}</span>
          <span className="text-caption text-foreground-muted">{spec.unit}</span>
          <span className="ml-auto text-caption text-foreground-subtle">
            {formatClock(sample.at)} 기준
          </span>
        </div>
      )}

      {/* 장비 층의 길 — 이 장비의 측정 상세(SCR-04). 사건 층의 길([대응 실행])은
          우측 레일이 항상 들고 있어 팝업에 싣지 않는다 */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate(`/scr-04?device=${device.id}`)}
        className="w-full"
      >
        상세 측정현황 보기
      </Button>
    </div>
  );
}

function CctvBody({ device }: { device: Device }) {
  const { now } = useScenario();
  const offline = device.status !== "정상";
  /* 장면이 등재된 주요 CCTV(04 §2-5)는 시연 영상을 튼다. 연출임을 라벨로 밝힌다 —
     실황처럼 팔면 "그 영상 실제냐" 한 마디에 시연이 무너진다(05 S3) */
  const scene = cctvSceneOf(device);

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded bg-black">
        {offline ? (
          <div className="flex flex-col items-center gap-1">
            <Icon icon="mdi:video-off" className="size-6 text-foreground-subtle" aria-hidden />
            <span className="text-caption text-foreground-subtle">{device.status}</span>
          </div>
        ) : scene ? (
          <>
            <CctvScene kind={scene.kind} className="absolute inset-0" />
            <span className="absolute left-2 top-2 rounded bg-surface px-1.5 py-0.5 text-caption text-foreground">
              시연 영상
            </span>
            <span className="absolute bottom-1.5 right-2 font-mono text-caption text-foreground">
              {formatClock(now)}
            </span>
          </>
        ) : (
          <>
            {/* 장면 미등재 CCTV — 채널이 살아 있다는 것만 보인다 */}
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
      <p className="text-caption text-foreground-muted">
        {device.address}
        {scene && <span className="text-foreground-subtle"> · {scene.bearing}</span>}
      </p>
    </div>
  );
}
