/* ─────────────────────────────────────────────
 * 계측 추이 — 03 화면정의서 §2 좌측 · 04 §8
 *
 * 계측 장비를 목록에서 고르고, 최근 6시간 그래프에 발령 기준선을 얹고, 아래에 추세
 * 요약(최근 30분 변화량 · 초과 기준 · 다음 기준까지)을 세운다. 숫자와 그래프가 같이
 * 서야 격상이 "그래프가 오르는 중"이 아니라 "기준을 넘었고 다음까지 얼마 남았다"로
 * 읽힌다. 요약은 그래프와 같은 시계열의 파생이다 — 다른 원천을 읽으면 둘이 갈라진다.
 *
 * 좌측 열(머리말·지구 전환 아래)에 서는 이유(03 §2): 지구 신원·장비 대수와 같은
 * 장비·계측 층이다(03 §0-9). 우측은 사건·판단·대응 층이라 여기까지 몰면 레일 수요가
 * 높이를 넘고, 하단에 두면 격상 순간 같은 그래프가 팝업과 두 벌로 선다 — 하단은
 * 현장영상이 쓴다.
 *
 * 장비 목록 클릭 = 지도 팝업과 같은 장비 선택. 마커는 겹쳐서 시연 중 정확히 짚기
 * 어렵다 — S2 의 대체 경로가 이 목록이다(05 S2).
 * ───────────────────────────────────────────── */

import { EmptyState, StatusDotLabel, cn } from "@ds";
import { Icon } from "@iconify/react";
import { deviceKindSpec, type Device } from "../../../demo/devices";
import { latestValue, sensorSeries, trendSummaryAt } from "../../../demo/measurements";
import {
  ALERT_LEVELS,
  DISPLACEMENT_THRESHOLD,
  RAIN_THRESHOLD,
  WATER_THRESHOLDS,
} from "../../../demo/levels";
import { TIDE_REFERENCE } from "../../../demo/weather";
import { TrendChart, chartRange } from "../../../components/TrendChart";
import { formatClock } from "../../../lib/datetime";
import { useScenario } from "../../../state/ScenarioProvider";

interface TrendPanelProps {
  /** 계측 장비만 (CCTV·마을방송 제외) */
  sensors: Device[];
  /** 목록 표기에서 걷어낼 지구명 접두 — 좁은 목록에 "서항지구" 반복은 자리만 먹는다 */
  districtName: string;
  selected: Device | null;
  onSelect: (device: Device) => void;
}

export function TrendPanel({ sensors, districtName, selected, onSelect }: TrendPanelProps) {
  const { now } = useScenario();
  const focus = selected && selected.kind !== "CV" && selected.kind !== "BC" ? selected : sensors[0];
  if (!focus) return null;

  return (
    <section className="flex flex-col gap-2 p-3" aria-label="계측 추이">
      <h2 className="text-body font-semibold text-foreground">계측 추이</h2>

      {/* 장비 목록 — 팝업과 같은 선택을 만든다 (03 §2 동작). 지구당 계측 장비는
          4대 안팎이라 보통 다 보이고, 넘치면 목록만 자기 안에서 스크롤한다 */}
      <ul className="flex max-h-28 shrink-0 flex-col overflow-y-auto">
        {sensors.map((sensor) => {
          const spec = deviceKindSpec(sensor.kind);
          const offline = sensor.status === "통신끊김";
          const sample = latestValue(sensor, now);
          const active = focus.id === sensor.id;
          return (
            <li key={sensor.id}>
              <button
                type="button"
                onClick={() => onSelect(sensor)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-1.5 rounded-md border-none px-2 py-1 text-left transition-colors",
                  /* 선택 강조 — 지도 핀·팝업과 같은 선택을 같은 강조(primary ring)로 잇는다(03 §2) */
                  active
                    ? "bg-surface-raised ring-1 ring-inset ring-primary/60"
                    : "bg-transparent hover:bg-surface-raised",
                )}
              >
                <Icon
                  icon={spec.icon}
                  className="size-3.5 shrink-0"
                  style={{ color: spec.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-caption text-foreground">
                  {sensor.name.replace(`${districtName} `, "")}
                </span>
                {offline ? (
                  <StatusDotLabel status="danger" label="끊김" className="shrink-0" />
                ) : (
                  <span className="shrink-0 font-mono text-caption text-foreground">
                    {sample.value}
                  </span>
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
  const { now } = useScenario();
  const spec = deviceKindSpec(device.kind);
  const offline = device.status === "통신끊김";
  const sample = latestValue(device, now);
  const summary = trendSummaryAt(device, now);

  /* 조위계는 발령 기준에 물리지 않는다(04 §3) — 천문조 만조 한 줄만 기준선으로 얹는다 */
  const base =
    device.kind === "WL"
      ? WATER_THRESHOLDS[device.districtId]
      : device.kind === "RN"
        ? RAIN_THRESHOLD
        : device.kind === "TD"
          ? null
          : DISPLACEMENT_THRESHOLD;
  const thresholds = base
    ? ALERT_LEVELS.map((level) => ({ value: base[level.id], color: level.color, label: level.label }))
    : device.kind === "TD"
      ? [TIDE_REFERENCE]
      : [];

  if (offline) {
    return (
      <div className="flex h-28 flex-col items-center justify-center gap-1 rounded border border-dashed border-border">
        <EmptyState variant="inline" icon="mdi:lan-disconnect" message="계측 끊김" />
        <span className="text-caption text-foreground-subtle">마지막 수신 {formatClock(sample.at)}</span>
      </div>
    );
  }

  /* 변화량 단위 — 수위·조위(EL.m)의 변화량은 m 로 적고 소수 둘째 자리를 고정한다.
     "+0.2" 와 "+0.28" 이 번갈아 서면 자리가 흔들려 읽는 눈이 튄다 */
  const deltaUnit = spec.unit === "EL.m" ? "m" : spec.unit;
  const fmt = (v: number) => (deltaUnit === "m" ? v.toFixed(2) : String(v));

  const series = sensorSeries(device, now);
  const range = chartRange(series, thresholds);

  return (
    <>
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 truncate text-caption text-foreground-muted">{device.name}</span>
          <span className="flex shrink-0 items-baseline gap-1">
            <span className="font-mono text-h5 font-semibold text-foreground">{sample.value}</span>
            <span className="text-caption text-foreground-muted">{spec.unit}</span>
          </span>
          <span className="ml-auto shrink-0 text-caption text-foreground-subtle">
            {formatClock(sample.at)} 기준
          </span>
        </div>
        <TrendChart
          samples={series}
          thresholds={thresholds}
          unit={spec.unit}
          height={96}
          ariaLabel={`${device.name} 최근 6시간 추이`}
        />
        {/* 기준값 목록 — 단계별 색 표가 이 화면의 범례를 겸한다(03 §0-2). 그래프에
            그려지지 않은(축 밖) 기준선은 스와치만 흐리게 둔다 — 값이 아직 그만큼
            오르지 않았다는 뜻이고, 선이 없는 것이 오류로 읽히면 안 된다 */}
        {thresholds.length > 0 && (
          <ul className="flex items-center justify-between gap-1 text-caption">
            {thresholds.map((t) => {
              const drawn = t.value >= range.min && t.value <= range.max;
              return (
                <li key={t.label} className="flex items-center gap-1">
                  <span
                    className={cn("h-0 w-3 shrink-0 border-t border-dashed", !drawn && "opacity-45")}
                    style={{ borderColor: t.color }}
                    aria-hidden
                  />
                  <span className="text-foreground-subtle">{t.label}</span>
                  <span className="font-mono text-foreground-muted">{t.value}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 추세 요약 (04 §8) — 그래프와 같은 시계열의 파생값 */}
      {summary && (
        <dl className="flex flex-col gap-1.5 border-t border-border pt-2 text-caption">
          <div className="flex items-baseline gap-2">
            <dt className="w-[72px] shrink-0 text-foreground-subtle">최근 30분</dt>
            <dd className="flex items-baseline gap-1.5">
              <span className="font-mono font-semibold text-foreground">
                {summary.delta30 > 0 ? "+" : ""}
                {fmt(summary.delta30)} {deltaUnit}
              </span>
              <span
                className={cn(
                  "font-medium",
                  summary.direction === "상승"
                    ? "text-risk-lv4"
                    : summary.direction === "하강"
                      ? "text-primary-text"
                      : "text-foreground-subtle",
                )}
              >
                {summary.direction === "유지" ? "유지" : `${summary.direction}세`}
              </span>
            </dd>
          </div>
          {summary.exceeded && (
            <div className="flex items-baseline gap-2">
              <dt className="w-[72px] shrink-0 text-foreground-subtle">초과 기준</dt>
              <dd>
                <span className="font-medium" style={{ color: summary.exceeded.color }}>
                  {summary.exceeded.label}
                </span>{" "}
                <span className="font-mono text-foreground">{summary.exceeded.value}</span>
              </dd>
            </div>
          )}
          {summary.next && (
            <div className="flex items-baseline gap-2">
              {/* "주의보 기준까지"는 72px 에서 꺾인다 — 다음 기준의 이름만 세운다 */}
              <dt className="w-[72px] shrink-0 text-foreground-subtle">{summary.next.label}까지</dt>
              <dd className="font-mono text-foreground">
                {fmt(summary.next.gap)} {deltaUnit}
              </dd>
            </div>
          )}
          {summary.surge !== null && (
            <div className="flex items-baseline gap-2">
              <dt className="w-[72px] shrink-0 text-foreground-subtle">천문조 대비</dt>
              <dd className="font-mono text-foreground">+{summary.surge} m</dd>
            </div>
          )}
        </dl>
      )}
    </>
  );
}
