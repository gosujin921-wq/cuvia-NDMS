/* ─────────────────────────────────────────────
 * SCR-04 통계·분석 — 정본: docs/정본/03_화면정의서.md §4
 *
 * 지난 기간에 무슨 재난이 어디서 얼마나 났고, 그래서 어떻게 대응했는지를 본다.
 * 계측 그래프는 이 화면의 마지막 단계다 — 시 전체 → 지구 순위 → 지구 상세로 좁혀 들어간다.
 *
 *   1단 핵심 지표   총 발생 · 경보 이상(계측 기준) · 선제 대응 · 최다 지구 · 전파 · 평균 소요
 *   2단 추이·분포   단계 색 누적 막대 + 도넛 둘(단계·재난유형 — SCR-01 과 같은 부품·색)
 *   3단 지구 비교   12행. 행을 누르면 4단·하단이 그 지구로 바뀐다 — 드릴다운의 입구
 *   4단 지구 상세   수위·강우 이중축 + 기준선 + 이벤트 띠 + **조건 시나리오 점선**
 *   하단 통합 이력  이벤트 한 건이 한 줄, 발생부터 전파까지. 주인공 사건은 단계 이력을 펼친다
 *
 * 값은 04 §4(원장) · §7-3(전파 원장) · §8(계측)에서 계산한다 — 집계 상수를 두지 않는다.
 * ───────────────────────────────────────────── */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { Button, DateRangeChip, EmptyState, FilterCapsuleGroup, GlassPanel, cn } from "@ds";
import { FullWidthLayout } from "../../layout/FullWidthLayout";
import { DISTRICTS, findDistrict } from "../../demo/districts";
import { findDevice } from "../../demo/devices";
import {
  EVENTS,
  HAZARD_FIELD,
  HAZARD_ORDER,
  confirmedLevelAt,
  eventViewAt,
  hazardLabel,
  type AlertEvent,
} from "../../demo/events";
import { CHANNELS, DISPATCH_HISTORY } from "../../demo/dispatch";
import { HERO_SCENARIO, scenarioOfDistrictAt } from "../../demo/forecast";
import { ALERT_LEVELS, WATER_THRESHOLDS, levelSpec, type AlertLevel } from "../../demo/levels";
import { historySeries, sampleStepMinutes } from "../../demo/measurements";
import { DualAxisChart, type EventBand, type OverlayLine } from "../../components/DualAxisChart";
import { RingDonut } from "../../components/RingDonut";
import { LevelBadge } from "../../components/LevelBadge";
import { HAZARD_COLOR } from "../../lib/hazard-colors";
import { useScenario } from "../../state/ScenarioProvider";
import { formatClock, formatDate } from "../../lib/datetime";

/** 기간 프리셋 (03 §4) */
const RANGES = [
  { label: "1년", days: 365 },
  { label: "6개월", days: 182 },
  { label: "3개월", days: 91 },
  { label: "1개월", days: 30 },
  { label: "1주일", days: 7 },
  { label: "직접 지정", days: 0 },
] as const;

const RANGE_LABELS = RANGES.map((r) => r.label);
const FIELD_OPTIONS = ["전체", "풍수해", "기상·기후", "수자원", "산지·지반"] as const;
const HERO_EVENT_ID = "EVT-260812-006";

function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

export function StatisticsPage() {
  const [params] = useSearchParams();
  const { now, advanceTo, approvedResponseLevel, approvedAt } = useScenario();
  const fromDevice = findDevice(params.get("device") ?? "");
  const fromDistrict = params.get("district");

  /* 상황 종료 후 검증 = S8 (04 §0). 엔진이 선행 스텝(S7)을 가드하므로 시연 초반에
     이 화면을 열어도 시계가 22:10 으로 뛰지 않는다 */
  useEffect(() => {
    advanceTo(8);
  }, [advanceTo]);

  /* 범위 — 전체가 기본이다. 화면 안의 길(?device·?district)로 들어오면 그 지구가 선택된
     채 열린다(03 §4 동작) — 이미 볼 지구가 정해져 있는데 시 전체를 거치게 하지 않는다 */
  const entryDistrict = fromDevice?.districtId ?? fromDistrict ?? null;
  const [scope, setScope] = useState<string>(entryDistrict ?? "all");
  const [rangeLabel, setRangeLabel] = useState<string>("1개월");
  const [customFrom, setCustomFrom] = useState(() => daysBefore(now, 14));
  const [customTo, setCustomTo] = useState(now);
  const [fieldFilter, setFieldFilter] = useState<string>("전체");
  const [hazardFilter, setHazardFilter] = useState<string>("전체");
  const [levelFilter, setLevelFilter] = useState<string>("전체");

  const custom = rangeLabel === "직접 지정";
  const preset = RANGES.find((r) => r.label === rangeLabel);
  const from = custom ? customFrom : daysBefore(now, preset?.days ?? 30);
  const to = custom ? customTo : now;

  /* ── 조회 조건이 걸린 이벤트 (1·2·3단·하단 공통 · 03 §4) ── */
  const filtered = useMemo(
    () =>
      EVENTS.filter((event) => {
        const at = new Date(event.raisedAt).getTime();
        if (at < from.getTime() || at > to.getTime()) return false;
        if (scope !== "all" && event.districtId !== scope) return false;
        if (fieldFilter !== "전체" && HAZARD_FIELD[event.hazardType] !== fieldFilter) return false;
        if (hazardFilter !== "전체" && hazardLabel(event.hazardType) !== hazardFilter) return false;
        if (levelFilter !== "전체" && levelSpec(confirmedLevelAt(event, now)).label !== levelFilter)
          return false;
        return true;
      }),
    [from, to, scope, fieldFilter, hazardFilter, levelFilter, now],
  );

  /* 전파 원장 — 이벤트에 붙는다(04 §7-3). 조회 조건은 대상 이벤트를 따라 걸린다 */
  const dispatches = useMemo(() => {
    const ids = new Set(filtered.map((e) => e.id));
    return DISPATCH_HISTORY.filter((r) => r.eventId && ids.has(r.eventId));
  }, [filtered]);

  /* ── 1단 핵심 지표 — 계측 집계와 대응 지표를 섞지 않는다(04 §4-3) ── */
  const kpi = useMemo(() => {
    const byLevel = new Map<AlertLevel, number>();
    const byDistrict = new Map<string, number>();
    for (const event of filtered) {
      const level = confirmedLevelAt(event, now);
      byLevel.set(level, (byLevel.get(level) ?? 0) + 1);
      byDistrict.set(event.districtId, (byDistrict.get(event.districtId) ?? 0) + 1);
    }
    const top = [...byDistrict.entries()].sort((a, b) => b[1] - a[1])[0];
    const recipients = dispatches.reduce((sum, r) => sum + r.recipients, 0);
    const durations = dispatches.map((r) => r.durationMin ?? 0).filter((d) => d > 0);
    return {
      total: filtered.length,
      warning: byLevel.get("warning") ?? 0,
      evacuate: byLevel.get("evacuate") ?? 0,
      topDistrict: top ? findDistrict(top[0])?.name : null,
      topCount: top?.[1] ?? 0,
      dispatchCount: dispatches.length,
      recipients,
      avgMin: durations.length
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : null,
    };
  }, [filtered, dispatches, now]);

  /* 선제 대응(대응 지표) — 계측이 그 단계에 닿기 전에 상위 등급을 승인한 건.
     계측 KPI 와 다른 축이라 따로 센다(04 §4-3). 리드타임 = 계측 도달(19:22) − 승인(17:37) */
  const preemptive = useMemo(() => {
    if (!approvedAt || !approvedResponseLevel) return null;
    const hero = filtered.find((e) => e.id === HERO_EVENT_ID);
    const reachedAt = hero?.stages?.find((s) => s.level === approvedResponseLevel)?.at;
    if (!reachedAt) return null;
    const leadMin = Math.round((new Date(reachedAt).getTime() - approvedAt.getTime()) / 60_000);
    return { count: 1, leadMin };
  }, [filtered, approvedAt, approvedResponseLevel]);

  /* ── 3단 지구별 비교 — 계측 최고·누적 강우는 지구 안에서만 뜻이 있다(03 §4) ── */
  const districtRows = useMemo(
    () =>
      DISTRICTS.map((district) => {
        const events = filtered.filter((e) => e.districtId === district.id);
        const series = historySeries(district.id, from, to);
        const peak = series.length ? Math.max(...series.map((s) => s.water)) : 0;
        const rain = series.reduce((sum, s) => sum + s.rain, 0);
        const sent = dispatches.filter(
          (r) => EVENTS.find((e) => e.id === r.eventId)?.districtId === district.id,
        );
        return {
          district,
          count: events.length,
          warnPlus: events.filter((e) => confirmedLevelAt(e, now) !== "advisory").length,
          peak,
          peakLevel: levelOf(district.id, peak),
          rain,
          dispatchCount: sent.length,
          recipients: sent.reduce((sum, r) => sum + r.recipients, 0),
        };
      }).sort((a, b) => b.count - a.count),
    [filtered, dispatches, from, to, now],
  );
  const maxCount = Math.max(1, ...districtRows.map((r) => r.count));

  /* ── 4단 선택 지구 — 범위가 전체면 최다 발생 지구를 연다(빈 그래프로 시작하지 않는다) ── */
  const detailId = scope !== "all" ? scope : (districtRows[0]?.district.id ?? DISTRICTS[0].id);
  const detail = findDistrict(detailId);
  const samples = useMemo(() => historySeries(detailId, from, to), [detailId, from, to]);
  const threshold = WATER_THRESHOLDS[detailId];
  const thresholdLines = ALERT_LEVELS.map((level) => ({
    value: threshold[level.id],
    color: level.color,
    label: level.label,
  }));
  const detailEvents = useMemo(
    () =>
      EVENTS.filter((event) => {
        if (event.districtId !== detailId) return false;
        const at = new Date(event.raisedAt).getTime();
        return at >= from.getTime() && at <= to.getTime();
      }),
    [detailId, from, to],
  );
  const bands: EventBand[] = detailEvents.map((event) => ({
    from: new Date(event.raisedAt),
    to: new Date(event.clearedAt ?? now.toISOString()),
    color: levelSpec(confirmedLevelAt(event, now)).color,
    label: event.id,
  }));

  /* 조건 시나리오 점선(03 §4) — 17:22 에 세운 시나리오가 실측과 어디서 갈라졌는지.
     이 점선이 없으면 "왜 그때 대피시켰느냐"에 답할 그림이 없다 */
  const overlay: OverlayLine | undefined = useMemo(() => {
    if (!scenarioOfDistrictAt(detailId, now)) return undefined;
    const created = new Date(HERO_SCENARIO.createdAt);
    if (created < from || created > to) return undefined;
    const peakAt = new Date(HERO_SCENARIO.peakAt);
    const span = peakAt.getTime() - created.getTime();
    /* 17:22(3.41) → 19:10(4.24) — 완만히 오르는 시나리오 곡선. 값은 §10-3 의 두 끝점이다 */
    const points = Array.from({ length: 5 }, (_, i) => {
      const t = i / 4;
      const eased = t * t * (3 - 2 * t);
      return {
        at: new Date(created.getTime() + span * t),
        value: Number((3.41 + (HERO_SCENARIO.peak - 3.41) * eased).toFixed(2)),
      };
    });
    return { points, color: "var(--color-primary-text)", label: "만조 조건 시나리오" };
  }, [detailId, from, to, now]);

  const peakWater = samples.length ? Math.max(...samples.map((s) => s.water)) : 0;
  const totalRain = samples.reduce((sum, s) => sum + s.rain, 0);

  /* ── 다운로드 — 지금 조회 조건의 이벤트·대응 이력(03 §4). 판단의 증적이 붙는 CSV 다 ── */
  const handleDownload = () => {
    const header = "발생,지구,재난유형,확정단계,측정값,해제,전파수단,대상,소요(분)\n";
    const body = filtered
      .map((event) => {
        const sent = dispatches.find((r) => r.eventId === event.id);
        const channels = sent
          ? CHANNELS.filter((c) => sent.channels.includes(c.id))
              .map((c) => c.label)
              .join("·")
          : "미전파";
        return [
          event.raisedAt,
          findDistrict(event.districtId)?.name ?? event.districtId,
          hazardLabel(event.hazardType),
          levelSpec(confirmedLevelAt(event, now)).label,
          `${eventViewAt(event, now).value} ${event.unit}`,
          event.clearedAt ?? "진행중",
          channels,
          sent?.recipients ?? "",
          sent?.durationMin ?? "",
        ].join(",");
      })
      .join("\n");
    const blob = new Blob([`﻿${header}${body}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `이벤트_대응_이력_${formatDate(from)}_${formatDate(to)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const stepMin = sampleStepMinutes((to.getTime() - from.getTime()) / 86_400_000);

  return (
    <FullWidthLayout bodyClassName="flex flex-col p-3">
      <GlassPanel
        data-slot="statistics-card"
        borderStyle="left-top"
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto"
      >
        {/* 제목 밴드 */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <div className="flex min-w-0 items-baseline gap-2">
            <h2 className="shrink-0 text-h6 font-semibold text-foreground">통계·분석</h2>
            <span className="truncate text-caption text-foreground-subtle">
              {formatDate(from)} ~ {formatDate(to)} · 표본 {stepMin >= 60 ? `${stepMin / 60}시간` : `${stepMin}분`} 간격
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownload} className="shrink-0">
            <Icon icon="mdi:download" className="size-4" aria-hidden />
            다운로드
          </Button>
        </header>

        {/* 조회 조건 — 범위 · 기간 · 재난 분야 · 유형 · 단계 (03 §4) */}
        <section
          aria-label="조회 조건"
          className="flex shrink-0 flex-col gap-2 border-b border-border px-4 py-3"
        >
          <FilterRow label="범위">
            <FilterCapsuleGroup
              options={["전체", ...DISTRICTS.map((d) => d.name)]}
              value={scope === "all" ? "전체" : (findDistrict(scope)?.name ?? "전체")}
              onChange={(name) =>
                setScope(name === "전체" ? "all" : (DISTRICTS.find((d) => d.name === name)?.id ?? "all"))
              }
            />
          </FilterRow>
          <FilterRow label="기간">
            <FilterCapsuleGroup options={RANGE_LABELS} value={rangeLabel} onChange={setRangeLabel} />
            {custom && (
              <DateRangeChip
                fromDate={customFrom}
                toDate={customTo}
                onChange={({ from: nextFrom, to: nextTo }) => {
                  setCustomFrom(nextFrom);
                  setCustomTo(nextTo);
                }}
                isInvalid={customTo < customFrom}
              />
            )}
          </FilterRow>
          <FilterRow label="분야">
            <FilterCapsuleGroup
              options={[...FIELD_OPTIONS]}
              value={fieldFilter}
              onChange={setFieldFilter}
            />
          </FilterRow>
          <FilterRow label="유형">
            <FilterCapsuleGroup
              options={["전체", ...HAZARD_ORDER.map((t) => hazardLabel(t))]}
              value={hazardFilter}
              onChange={setHazardFilter}
            />
          </FilterRow>
          <FilterRow label="단계">
            <FilterCapsuleGroup
              options={["전체", ...ALERT_LEVELS.map((l) => l.label)]}
              value={levelFilter}
              onChange={setLevelFilter}
            />
          </FilterRow>
        </section>

        {/* 1단 — 핵심 지표. 계측 집계와 대응 지표는 다른 축이다(04 §4-3) */}
        <section aria-label="핵심 지표" className="grid shrink-0 grid-cols-6 gap-3 px-4 pt-3">
          <KpiTile label="총 발생" value={`${kpi.total}`} unit="건" />
          <KpiTile
            label="경보 이상 (계측)"
            value={`${kpi.warning + kpi.evacuate}`}
            unit={`건 · 경보 ${kpi.warning} 대피 ${kpi.evacuate}`}
            tone="var(--color-risk-lv4)"
          />
          <KpiTile
            label="선제 대응"
            value={preemptive ? `${preemptive.count}` : "0"}
            unit={
              preemptive
                ? `건 · 계측 도달 ${Math.floor(preemptive.leadMin / 60)}시간 ${preemptive.leadMin % 60}분 전 승인`
                : "건"
            }
            tone={preemptive ? "var(--color-risk-lv5)" : undefined}
          />
          <KpiTile label="최다 발생" value={kpi.topDistrict ?? "—"} unit={kpi.topDistrict ? `${kpi.topCount}건` : ""} text />
          <KpiTile
            label="전파"
            value={`${kpi.dispatchCount}`}
            unit={`건 · ${kpi.recipients.toLocaleString()}명`}
          />
          <KpiTile
            label="평균 전파 소요"
            value={kpi.avgMin !== null ? kpi.avgMin.toFixed(1) : "—"}
            unit="분 · 발생→전파"
          />
        </section>

        {/* 2단 — 발생 추이 + 분포 도넛 (SCR-01 과 같은 부품·같은 색) */}
        <section aria-label="발생 추이와 분포" className="grid shrink-0 grid-cols-[1fr_320px] gap-3 px-4 pt-3">
          <div className="rounded-md border border-border bg-card p-3">
            <TrendBars events={filtered} from={from} to={to} now={now} />
          </div>
          <div className="flex items-center justify-around rounded-md border border-border bg-card p-3">
            <DistributionDonut
              caption="단계별"
              segments={ALERT_LEVELS.map((l) => ({
                value: filtered.filter((e) => confirmedLevelAt(e, now) === l.id).length,
                color: l.color,
                label: l.label,
              }))}
              total={filtered.length}
            />
            <DistributionDonut
              caption="유형별"
              segments={HAZARD_ORDER.map((t) => ({
                value: filtered.filter((e) => e.hazardType === t).length,
                color: HAZARD_COLOR[t],
                label: hazardLabel(t),
              }))}
              total={filtered.length}
            />
          </div>
        </section>

        {/* 3단 — 지구별 비교. 행을 누르면 4단·하단이 그 지구로 바뀐다 */}
        <section aria-label="지구별 비교" className="shrink-0 px-4 pt-3">
          <div className="overflow-hidden rounded-md border border-border bg-card">
            <table className="w-full text-caption">
              <thead>
                <tr className="border-b border-border text-foreground-subtle">
                  <th className="px-3 py-2 text-left font-medium">지구</th>
                  <th className="px-3 py-2 text-left font-medium">발생</th>
                  <th className="px-3 py-2 text-right font-medium">경보 이상</th>
                  <th className="px-3 py-2 text-right font-medium">최고 수위</th>
                  <th className="px-3 py-2 text-right font-medium">누적 강우</th>
                  <th className="px-3 py-2 text-right font-medium">전파</th>
                </tr>
              </thead>
              <tbody>
                {districtRows.map((row) => (
                  <tr
                    key={row.district.id}
                    onClick={() => setScope(row.district.id)}
                    className={cn(
                      "cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-surface-raised",
                      row.district.id === detailId && "bg-surface-raised",
                    )}
                  >
                    <td className="px-3 py-1.5 text-foreground">
                      {row.district.name}
                      <span className="ml-1.5 text-foreground-subtle">{row.district.kind}</span>
                    </td>
                    <td className="w-[26%] px-3 py-1.5">
                      <span className="flex items-center gap-2">
                        {/* 막대 + 숫자 — 순위가 눈으로 잡힌다 */}
                        <span className="h-2 flex-1 overflow-hidden rounded-sm bg-surface-raised">
                          <span
                            className="block h-full rounded-sm bg-primary-text/60"
                            style={{ width: `${(row.count / maxCount) * 100}%` }}
                            aria-hidden
                          />
                        </span>
                        <span className="w-5 shrink-0 text-right font-mono text-foreground">
                          {row.count}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-foreground">
                      {row.warnPlus > 0 ? row.warnPlus : "-"}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {/* 지구마다 기준이 달라 숫자만으로는 위험도가 비교되지 않는다 —
                          그 값이 어느 단계 구간인지 색 점을 함께 세운다(03 §4) */}
                      <span className="inline-flex items-center gap-1.5 font-mono text-foreground">
                        {row.peakLevel && (
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: levelSpec(row.peakLevel).color }}
                            aria-hidden
                          />
                        )}
                        {row.peak.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-foreground-muted">
                      {row.rain.toFixed(0)}mm
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-foreground-muted">
                      {row.dispatchCount > 0
                        ? `${row.dispatchCount}건 · ${row.recipients.toLocaleString()}명`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 4단 — 선택 지구 상세 */}
        <section aria-label="선택 지구 상세" className="shrink-0 px-4 pt-3">
          <div className="overflow-hidden rounded-md border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
              <h3 className="truncate text-body font-semibold text-foreground">
                {detail?.name} 수위·강우량
              </h3>
              <div className="ml-auto flex shrink-0 items-center gap-3 text-caption text-foreground-subtle">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3 rounded-full bg-primary-text" aria-hidden />
                  수위
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm bg-primary-text opacity-50" aria-hidden />
                  강우량
                </span>
                {overlay && (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-0 w-4 border-t-2 border-dashed border-primary-text"
                      aria-hidden
                    />
                    시나리오 (17:22 수립)
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 px-4 pt-3">
              <KpiTile label="최고 수위" value={peakWater.toFixed(2)} unit="EL.m" />
              <KpiTile label="누적 강우량" value={totalRain.toFixed(0)} unit="mm" />
              <KpiTile label="이벤트" value={`${detailEvents.length}`} unit="건" />
              <KpiTile
                label="주의보 기준"
                value={`${threshold.advisory}`}
                unit="EL.m"
                tone="var(--color-risk-lv3)"
              />
            </div>
            <div className="h-[260px] p-3">
              <DualAxisChart
                samples={samples}
                thresholds={thresholdLines}
                bands={bands}
                overlay={overlay}
                height="fill"
              />
            </div>
          </div>
        </section>

        {/* 하단 — 이벤트·대응 통합 이력. 발생부터 전파 결과까지 같은 줄에(03 §4) */}
        <section aria-label="이벤트·대응 이력" className="shrink-0 p-4">
          <HistoryTable events={filtered} dispatches={dispatches} now={now} />
        </section>
      </GlassPanel>
    </FullWidthLayout>
  );
}

/* ── 부품 ─────────────────────────────────────── */

function levelOf(districtId: string, value: number): AlertLevel | null {
  const threshold = WATER_THRESHOLDS[districtId];
  if (!threshold) return null;
  if (value >= threshold.evacuate) return "evacuate";
  if (value >= threshold.warning) return "warning";
  if (value >= threshold.advisory) return "advisory";
  return null;
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-8 shrink-0 text-caption font-semibold text-foreground">{label}</span>
      {children}
    </div>
  );
}

function KpiTile({
  label,
  value,
  unit,
  tone,
  text,
}: {
  label: string;
  value: string;
  unit: string;
  tone?: string;
  text?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-card p-3">
      <span className="text-caption text-foreground-muted">{label}</span>
      <span className="flex items-baseline gap-1">
        <span
          className={cn("font-semibold", text ? "truncate text-h6" : "font-mono text-h4")}
          style={{ color: tone }}
        >
          {value}
        </span>
        <span className="min-w-0 truncate text-caption text-foreground-subtle">{unit}</span>
      </span>
    </div>
  );
}

/** 발생 추이 — 단계 색 누적 막대. 눈금은 기간을 따른다(31일 이하 일별 · 91일 이하 주별 · 월별) */
function TrendBars({
  events,
  from,
  to,
  now,
}: {
  events: AlertEvent[];
  from: Date;
  to: Date;
  now: Date;
}) {
  const spanDays = (to.getTime() - from.getTime()) / 86_400_000;
  const bucketMs = spanDays <= 31 ? 86_400_000 : spanDays <= 91 ? 7 * 86_400_000 : 30 * 86_400_000;
  const bucketCount = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / bucketMs));

  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const start = new Date(from.getTime() + i * bucketMs);
    const counts: Record<AlertLevel, number> = { advisory: 0, warning: 0, evacuate: 0 };
    for (const event of events) {
      const at = new Date(event.raisedAt).getTime();
      if (at >= start.getTime() && at < start.getTime() + bucketMs)
        counts[confirmedLevelAt(event, now)] += 1;
    }
    return { start, counts, total: counts.advisory + counts.warning + counts.evacuate };
  });
  const maxTotal = Math.max(1, ...buckets.map((b) => b.total));

  return (
    <div className="flex h-full min-h-[160px] flex-col gap-1.5">
      <span className="text-caption font-semibold text-foreground">발생 추이</span>
      <div className="flex min-h-0 flex-1 items-end gap-px">
        {buckets.map((bucket) => (
          <div
            key={bucket.start.getTime()}
            className="flex h-full flex-1 flex-col justify-end gap-px"
            title={`${formatDate(bucket.start)} · ${bucket.total}건`}
          >
            {ALERT_LEVELS.slice()
              .reverse()
              .map((level) =>
                bucket.counts[level.id] > 0 ? (
                  <div
                    key={level.id}
                    style={{
                      height: `${(bucket.counts[level.id] / maxTotal) * 100}%`,
                      backgroundColor: level.color,
                    }}
                    className="w-full rounded-[1px] opacity-80"
                  />
                ) : null,
              )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-caption text-foreground-subtle">
        <span>{formatDate(from)}</span>
        <span>{formatDate(to)}</span>
      </div>
    </div>
  );
}

function DistributionDonut({
  caption,
  segments,
  total,
}: {
  caption: string;
  segments: { value: number; color: string; label: string }[];
  total: number;
}) {
  const present = segments.filter((s) => s.value > 0);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <RingDonut
        segments={present.length ? present : [{ value: 1, color: "var(--color-border)", label: "없음" }]}
        size={92}
        thickness={9}
        ariaLabel={`${caption} 분포. ${present.map((s) => `${s.label} ${s.value}건`).join(", ")}`}
      >
        <span className="font-mono text-h6 font-semibold leading-none text-foreground">{total}</span>
        <span className="mt-0.5 text-caption text-foreground-subtle">{caption}</span>
      </RingDonut>
      <ul className="flex flex-col gap-0.5">
        {present.map((seg) => (
          <li key={seg.label} className="flex items-center gap-1.5 text-caption">
            <span className="size-2 rounded-sm" style={{ backgroundColor: seg.color }} aria-hidden />
            <span className="text-foreground-muted">{seg.label}</span>
            <span className="font-mono text-foreground">{seg.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 이벤트·대응 통합 이력 — 주인공 사건은 단계 이력을 펼친다(04 §4-2 · 03 §4).
 *  마지막 단계 하나로 접으면 "계측 도달 1시간 45분 전에 승인했다"를 뒷받침할 화면이 없다 */
function HistoryTable({
  events,
  dispatches,
  now,
}: {
  events: AlertEvent[];
  dispatches: typeof DISPATCH_HISTORY;
  now: Date;
}) {
  if (events.length === 0)
    return <EmptyState icon="mdi:calendar-blank-outline" message="이 조건에 해당하는 이벤트가 없습니다" />;

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="border-b border-border px-4 py-2.5">
        <h3 className="text-body font-semibold text-foreground">이벤트·대응 이력</h3>
      </div>
      <table className="w-full text-caption">
        <thead>
          <tr className="border-b border-border text-foreground-subtle">
            <th className="px-3 py-2 text-left font-medium">발생</th>
            <th className="px-3 py-2 text-left font-medium">지구 · 재난유형</th>
            <th className="px-3 py-2 text-left font-medium">단계</th>
            <th className="px-3 py-2 text-right font-medium">측정값</th>
            <th className="px-3 py-2 text-right font-medium">해제</th>
            <th className="px-3 py-2 text-left font-medium">전파</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const district = findDistrict(event.districtId);
            const sent = dispatches.find((r) => r.eventId === event.id);
            const view = eventViewAt(event, now);
            const hero = event.id === HERO_EVENT_ID && (event.stages?.length ?? 0) > 1;
            return (
              <HistoryRowGroup
                key={event.id}
                event={event}
                districtName={district?.name ?? "-"}
                view={view}
                hero={hero}
                now={now}
                dispatch={
                  sent
                    ? {
                        channels: CHANNELS.filter((c) => sent.channels.includes(c.id))
                          .map((c) => c.label)
                          .join(" · "),
                        recipients: sent.recipients,
                        durationMin: sent.durationMin,
                      }
                    : null
                }
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HistoryRowGroup({
  event,
  districtName,
  view,
  hero,
  now,
  dispatch,
}: {
  event: AlertEvent;
  districtName: string;
  view: ReturnType<typeof eventViewAt>;
  hero: boolean;
  now: Date;
  dispatch: { channels: string; recipients: number; durationMin?: number } | null;
}) {
  const confirmed = confirmedLevelAt(event, now);
  return (
    <>
      <tr className="border-b border-border last:border-b-0">
        <td className="px-3 py-1.5 font-mono text-foreground-muted">
          {formatDate(event.raisedAt)} {formatClock(event.raisedAt)}
        </td>
        <td className="px-3 py-1.5 text-foreground">
          {districtName} <span className="text-foreground-muted">{hazardLabel(event.hazardType)}</span>
        </td>
        <td className="px-3 py-1.5">
          <LevelBadge level={confirmed} />
        </td>
        <td className="px-3 py-1.5 text-right font-mono text-foreground">
          {view.value} {event.unit}
        </td>
        <td className="px-3 py-1.5 text-right font-mono text-foreground-muted">
          {event.clearedAt && new Date(event.clearedAt) <= now ? formatClock(event.clearedAt) : "진행중"}
        </td>
        <td className="px-3 py-1.5">
          {/* 미전파는 흐리게 — 빈칸이면 "없는 것"인지 "안 보낸 것"인지 갈리지 않는다(03 §4) */}
          {dispatch ? (
            <span className="text-foreground-muted">
              {dispatch.channels} · {dispatch.recipients.toLocaleString()}명
              {dispatch.durationMin ? ` · ${dispatch.durationMin}분` : ""}
            </span>
          ) : (
            <span className="text-foreground-subtle opacity-60">미전파</span>
          )}
        </td>
      </tr>
      {/* 주인공 사건 — 단계 이력 4행 펼침. 언제 무엇이 됐는지가 판단 검증의 재료다 */}
      {hero &&
        (event.stages ?? [])
          .filter((stage) => new Date(stage.at) <= now)
          .map((stage, index) => (
            <tr key={stage.at} className="border-b border-border bg-surface-raised/40 last:border-b-0">
              <td className="py-1 pl-8 pr-3 font-mono text-foreground-subtle">
                └ {formatClock(stage.at)}
              </td>
              <td className="px-3 py-1 text-foreground-subtle" colSpan={2}>
                {index === 0 ? "발생" : stage.level === "evacuate" ? "계측 대피 도달" : "경보 격상"} ·{" "}
                {levelSpec(stage.level).label}
              </td>
              <td className="px-3 py-1 text-right font-mono text-foreground-subtle">
                {stage.value} {event.unit}
              </td>
              <td colSpan={2} />
            </tr>
          ))}
      {hero && event.clearedAt && new Date(event.clearedAt) <= now && (
        <tr className="border-b border-border bg-surface-raised/40 last:border-b-0">
          <td className="py-1 pl-8 pr-3 font-mono text-foreground-subtle">
            └ {formatClock(event.clearedAt)}
          </td>
          <td className="px-3 py-1 text-foreground-subtle" colSpan={5}>
            해제 · 주의보 기준 아래로 내려옴
          </td>
        </tr>
      )}
    </>
  );
}
