/* ─────────────────────────────────────────────
 * 주체 팝업 — 사건 작업공간 지도 마커 팝업 (IA §7 관측 근거). Phase 1 장비 팝업의 문법 그대로
 *
 * 판정이 선 주체는 **판정이 본문이다**: 파생 규칙(변화율·기준 진입) 띠 아래 현재값·품질·관측시각이 서고,
 * 주체 정보는 지점·상태로 압축된다. 판정 없는 주체는 요약이다: 주소·지점·좌표·품질·현재값.
 * 둘 다 [근거에서 보기]로 닫는다 — 좌측 근거에서 그 주체 줄을 강조한다. 진행 중 사건이면 [이 사건 대응하기]가 같이 서서
 * 대응 실행 집중 팝업을 연다(진입 경로가 달라도 실행 화면은 하나).
 *
 * 추이 그래프·위험도·대응은 싣지 않는다. 좌측 추이와 우측 레일이 이미 들고 있다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Button, GlassPanel, StatusDotLabel, Tag } from "@ds";
import { deviceKindSpec, type Device } from "../../../demo/devices";
import { derivedFlagOf, observationSeriesAt, qualityOf } from "../../../model/selectors";
import { levelSpec } from "../../../demo/levels";
import { useScenario } from "../../../state/ScenarioProvider";
import { formatClock } from "../../../lib/datetime";

export function DevicePopup({ device, onClose, onShowEvents, onRespond }: { device: Device; onClose: () => void; onShowEvents: () => void; /** 진행 중 사건이면 선다 — 대응 실행 집중 팝업의 두 번째 진입로 (레거시 03 §2) */ onRespond?: () => void }) {
  const { demoNow: now } = useScenario();
  const spec = deviceKindSpec(device.kind);
  const series = observationSeriesAt(device.id, now);
  const sample = series[series.length - 1] ?? null;
  const flag = derivedFlagOf(device.id, now);
  const quality = qualityOf(device.id, now);
  const flagColor = levelSpec(flag?.eventType === "RATE_CHANGED" ? "warning" : "advisory").color;

  return (
    <GlassPanel className="w-[300px] overflow-hidden" borderStyle="none">
      <header className="flex items-start gap-2 border-b border-border px-3 py-2.5">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded" style={{ backgroundColor: spec.color ?? "var(--color-surface-raised)" }}>
          <Icon icon={spec.icon} className="size-3.5 text-white" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="truncate text-body font-semibold text-foreground">{device.name}</h3>
          <span className="text-caption text-foreground-subtle">{spec.label}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="팝업 닫기" className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent text-foreground-subtle transition-colors hover:bg-surface-raised hover:text-foreground">
          <Icon icon="mdi:close" className="size-4" aria-hidden />
        </button>
      </header>

      {/* 판정 띠 — 파생 규칙이 선 주체는 판정이 먼저다 */}
      {flag && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2" style={{ borderLeft: `3px solid ${flagColor}` }}>
          <span className="shrink-0 text-caption font-medium" style={{ color: flagColor }}>{flag.eventType === "RATE_CHANGED" ? "급상승" : "기준 진입"}</span>
          <span className="min-w-0 flex-1 truncate text-caption text-foreground-muted">{flag.summary}</span>
          <span className="shrink-0 text-caption text-foreground-subtle">{formatClock(flag.observedAt)}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 p-3">
        <dl className="flex flex-col gap-1 text-caption">
          {flag && (
            <div className="flex items-center gap-2">
              <dt className="w-14 shrink-0 text-foreground-subtle">규칙</dt>
              <dd className="flex min-w-0 flex-1 items-center gap-1.5 text-foreground-muted">
                <span className="truncate font-mono">{(flag.payload as { ruleId: string; ruleVersion: string }).ruleId} {(flag.payload as { ruleVersion: string }).ruleVersion}</span>
                <Tag className="shrink-0">CUVIA 규칙</Tag>
              </dd>
            </div>
          )}
          {!flag && (
            <div className="flex gap-2">
              <dt className="w-14 shrink-0 text-foreground-subtle">주소</dt>
              <dd className="min-w-0 flex-1 text-foreground-muted">{device.address}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-foreground-subtle">지점</dt>
            <dd className="min-w-0 flex-1 text-foreground-muted">{device.spot}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="w-14 shrink-0 text-foreground-subtle">품질</dt>
            <dd className="min-w-0 flex-1">
              <StatusDotLabel status={quality === "정상" ? "success" : quality === "결측" ? "danger" : "pending"} label={quality} />
            </dd>
          </div>
        </dl>

        {sample ? (
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-h4 font-semibold text-foreground">{sample.value}</span>
            <span className="text-caption text-foreground-muted">{sample.unit}</span>
            <span className="ml-auto text-caption text-foreground-subtle">관측 {formatClock(sample.at)}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 rounded border border-dashed border-border py-4">
            <Icon icon="mdi:cctv" className="size-5 text-foreground-subtle" aria-hidden />
            <span className="text-caption text-foreground-subtle">관측값이 없는 주체 (영상)</span>
          </div>
        )}

        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={onShowEvents} className="flex-1">
            근거에서 보기
          </Button>
          {onRespond && (
            <Button size="sm" onClick={onRespond} className="flex-1">
              이 사건 대응하기
            </Button>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}
