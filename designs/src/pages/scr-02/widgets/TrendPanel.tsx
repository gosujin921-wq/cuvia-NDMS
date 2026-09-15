/* ─────────────────────────────────────────────
 * 관측 추이 — 사건 작업공간 좌측 (IA §7 관측 근거). Phase 1 계측 추이의 골격 그대로
 *
 * 사건 주체 목록에서 고르고, 그 주체의 관측 시계열을 그래프로 세우고(components/TrendChart), 아래에 파생
 * 규칙(변화율·기준 진입) 판정을 잇는다. 원천 관측과 파생 판정을 가른다(IA §7 "원천 관측과 임계치·변화율
 * 파생 결과 분리"). 값은 전부 selectors 에서 온다.
 *
 * 주체 목록 클릭 = 지도 핀·팝업과 같은 선택.
 * ───────────────────────────────────────────── */

import { EmptyState, StatusDotLabel, Tag, cn } from "@ds";
import { Icon } from "@iconify/react";
import { deviceKindSpec, type Device } from "../../../demo/devices";
import { TrendChart, chartRange, type ThresholdLine } from "../../../components/TrendChart";
import { derivedFlagOf, observationSeriesAt, qualityOf } from "../../../model/selectors";
import { levelSpec } from "../../../demo/levels";
import { formatClock } from "../../../lib/datetime";
import { useScenario } from "../../../state/ScenarioProvider";

interface TrendPanelProps {
  /** 관측 주체만 (CCTV 제외) */
  sensors: Device[];
  selected: Device | null;
  onSelect: (device: Device) => void;
}

export function TrendPanel({ sensors, selected, onSelect }: TrendPanelProps) {
  const { demoNow: now } = useScenario();
  const focus = selected && selected.kind !== "CV" ? selected : sensors[0];
  if (!focus) return null;

  return (
    <section className="flex flex-col gap-2 p-3" aria-label="관측">
      <h2 className="text-body font-semibold text-foreground">관측</h2>

      <ul className="flex max-h-28 shrink-0 flex-col overflow-y-auto">
        {sensors.map((sensor) => {
          const spec = deviceKindSpec(sensor.kind);
          const series = observationSeriesAt(sensor.id, now);
          const last = series[series.length - 1];
          const quality = qualityOf(sensor.id, now);
          const active = focus.id === sensor.id;
          return (
            <li key={sensor.id}>
              <button
                type="button"
                onClick={() => onSelect(sensor)}
                className={cn("flex w-full cursor-pointer items-center gap-1.5 rounded-md border-none px-2 py-1 text-left transition-colors", active ? "bg-surface-raised ring-1 ring-inset ring-primary/60" : "bg-transparent hover:bg-surface-raised")}
              >
                <Icon icon={spec.icon} className="size-3.5 shrink-0" style={{ color: spec.color }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-caption text-foreground">{sensor.name}</span>
                {quality !== "정상" ? (
                  <StatusDotLabel status={quality === "결측" ? "danger" : "pending"} label={quality} className="shrink-0" />
                ) : (
                  <span className="shrink-0 font-mono text-caption text-foreground">{last ? `${last.value} ${last.unit}` : "-"}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <FocusTrend device={focus} />
    </section>
  );
}

function FocusTrend({ device }: { device: Device }) {
  const { demoNow: now } = useScenario();
  const series = observationSeriesAt(device.id, now);
  const last = series[series.length - 1];
  const flag = derivedFlagOf(device.id, now);
  const quality = qualityOf(device.id, now);

  if (series.length === 0) {
    return <EmptyState variant="inline" icon="mdi:chart-line" message="관측값이 아직 없다" />;
  }

  /* 파생 규칙의 기준선 — 기준 진입 규칙이 있으면 그 임계값을 얹는다 */
  const thresholds: ThresholdLine[] = [];
  const p = flag?.payload as { thresholdCm?: number; level?: string } | undefined;
  if (flag?.eventType === "THRESHOLD_CROSSED" && p?.thresholdCm !== undefined) {
    thresholds.push({ value: p.thresholdCm, color: levelSpec("advisory").color, label: `${p.level ?? "기준"} ${p.thresholdCm}` });
  }
  const samples = series.map((s) => ({ at: new Date(s.at), value: s.value }));
  const range = chartRange(samples, thresholds);

  return (
    <>
      {/* 그래프 상자 — 목록·판정과 갈라 선다 (2026-09-14 사용자 지시). 근거 줄과 같은 카드 면 */}
      <div className="flex flex-col gap-1 rounded-lg border border-border bg-card px-2.5 py-2">
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 truncate text-caption text-foreground-muted">{device.name}</span>
          <span className="flex shrink-0 items-baseline gap-1">
            <span className="font-mono text-h5 font-semibold text-foreground">{last.value}</span>
            <span className="text-caption text-foreground-muted">{last.unit}</span>
          </span>
          <span className="ml-auto shrink-0 text-caption text-foreground-subtle">관측 {formatClock(last.at)}</span>
        </div>
        <TrendChart samples={samples} thresholds={thresholds} unit={last.unit} height={96} ariaLabel={`${device.name} 관측 추이`} />
        {thresholds.length > 0 && (
          <ul className="flex items-center gap-3 text-caption">
            {thresholds.map((t) => {
              const drawn = t.value >= range.min && t.value <= range.max;
              return (
                <li key={t.label} className="flex items-center gap-1">
                  <span className={cn("h-0 w-3 shrink-0 border-t border-dashed", !drawn && "opacity-45")} style={{ borderColor: t.color }} aria-hidden />
                  <span className="text-foreground-subtle">{t.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 파생 판정 — 원천 관측과 갈라 적는다 */}
      <dl className="flex flex-col gap-1.5 text-caption">
        <div className="flex items-baseline gap-2">
          <dt className="w-[72px] shrink-0 text-foreground-subtle">판정</dt>
          <dd className="flex min-w-0 flex-1 items-baseline gap-1.5">
            {flag ? (
              <>
                <Tag tone="warning">{flag.eventType === "RATE_CHANGED" ? "변화율" : "기준 진입"}</Tag>
                <span className="min-w-0 truncate text-foreground">{flag.summary}</span>
              </>
            ) : (
              <span className="text-foreground-subtle">기준 이내</span>
            )}
          </dd>
        </div>
        {quality !== "정상" && (
          <div className="flex items-baseline gap-2">
            <dt className="w-[72px] shrink-0 text-foreground-subtle">데이터 상태</dt>
            <dd className="text-warning">{quality} · 확실성에 반영</dd>
          </div>
        )}
      </dl>
    </>
  );
}
