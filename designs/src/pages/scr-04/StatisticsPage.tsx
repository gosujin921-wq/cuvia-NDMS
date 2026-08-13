/* ─────────────────────────────────────────────
 * SCR-04 통계·분석 — 배경: docs/레거시/정본/03_화면정의서.md §4
 *
 * 지난 기간에 무슨 재난이 어디서 얼마나 났고, 그래서 어떻게 대응했는지를 본다.
 * 계측 그래프는 이 화면의 마지막 단계다 — 시 전체 → 지구 순위 → 지구 상세로 좁혀 들어간다.
 *
 * [통계 분석] · [사건 이력] 두 탭이다(03 §4 · 차수 L). 조회 조건은 두 탭이 공유한다.
 *
 *   통계 분석 탭
 *     1단 핵심 지표   총 발생 · 경보 이상(계측 기준) · 선제 대응 · 최다 지구 · 전파 · 평균 소요
 *     2단 추이·분포   단계 색 누적 막대 + 도넛 둘(단계·재난유형 — SCR-01 과 같은 부품·색)
 *     3단 지구 비교   12행. 행을 누르면 4단·하단이 그 지구로 바뀐다 — 드릴다운의 입구
 *     4단 지구 상세   수위·강우 이중축 + 기준선 + 이벤트 띠 + **조건 시나리오 점선**
 *   사건 이력 탭     이벤트 한 건이 한 줄, 발생부터 전파까지. 주인공 사건은 단계 이력을,
 *                    전 사건이 전파·실패·대체 조치를 하위 행으로 편다 — SCR-02 가 내린
 *                    전파 원장의 조회처다. 시연은 좌측 메뉴로 들어와 탭을 눌러 연다
 *
 * 값은 04 §4(원장) · §7-3·§7-5(전파 원장) · §8(계측)에서 계산한다 — 집계 상수를 두지 않는다.
 * ───────────────────────────────────────────── */

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import {
  Button,
  DateRangeChip,
  EmptyState,
  FilterCapsuleGroup,
  GlassPanel,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
} from "@ds";
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
import { CHANNELS, type DispatchRecord } from "../../demo/dispatch";
import { HEAT_THRESHOLD, heatSpotLabel } from "../../demo/events";
import { HERO_SCENARIO, scenarioOfDistrictAt } from "../../demo/forecast";
import { ALERT_LEVELS, WATER_THRESHOLDS, levelSpec, type AlertLevel } from "../../demo/levels";
import { historySeries, sampleStepMinutes } from "../../demo/measurements";
import { DualAxisChart, type EventBand, type OverlayLine } from "../../components/DualAxisChart";
import { RingDonut } from "../../components/RingDonut";
import { LevelBadge } from "../../components/LevelBadge";
import { HAZARD_COLOR } from "../../lib/hazard-colors";
import { useScenario } from "../../state/ScenarioProvider";
import { eventTimelineAt, type TimelineContext, type TimelineEntry } from "../../demo/timeline";
import { formatClock, formatDate } from "../../lib/datetime";
import { SeaTempChart } from "../../components/SeaTempChart";
import { domeSummaryAt } from "../../demo/heat-dome";
import { useSeaTemp } from "../../lib/useSeaTemp";
import { SEA_STAGE_LABEL, formatShortDate, holdOutlook } from "../../demo/sea-temp";

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
  const {
    now,
    advanceTo,
    approvedResponseLevel,
    approvedAt,
    dispatches: ledger,
    sopExecutedItemIds,
    phoneReportedAt,
  } = useScenario();
  const fromDevice = findDevice(params.get("device") ?? "");
  const fromDistrict = params.get("district");
  /* URL 진입(?tab=history&event=) — 사건 이력 탭이 그 사건이 선택된 채 열린다(03 §4) */
  const eventParam = params.get("event");
  const fromEvent = eventParam ? EVENTS.find((e) => e.id === eventParam) : undefined;
  const [tab, setTab] = useState<"stats" | "history">(
    params.get("tab") === "history" ? "history" : "stats",
  );

  /* 상황 종료 후 검증 = S8 (04 §0). 엔진이 선행 스텝(S7)을 가드하므로 시연 초반에
     이 화면을 열어도 시계가 22:10 으로 뛰지 않는다 */
  useEffect(() => {
    advanceTo(8);
  }, [advanceTo]);

  /* 범위 — 전체가 기본이다. 화면 안의 길(?event·?device·?district)로 들어오면 그 사건의
     지구가 선택된 채 열린다(03 §4 동작) — 이미 볼 것이 정해져 있는데 시 전체를 거치게 하지 않는다 */
  const entryDistrict = fromEvent?.districtId ?? fromDevice?.districtId ?? fromDistrict ?? null;
  const [scope, setScope] = useState<string>(entryDistrict ?? "all");
  const [rangeLabel, setRangeLabel] = useState<string>("1개월");
  const [customFrom, setCustomFrom] = useState(() => daysBefore(now, 14));
  const [customTo, setCustomTo] = useState(now);
  const [fieldFilter, setFieldFilter] = useState<string>("전체");
  const [hazardFilter, setHazardFilter] = useState<string>("전체");
  const [levelFilter, setLevelFilter] = useState<string>("전체");

  /* 열돔 모드 — 유형을 폭염으로 좁혔거나 분야를 기상·기후로 좁혔을 때.
     "전체" 로 보는 중에는 갈아 끼우지 않는다. 다른 유형과 섞여 있는데 열돔만 그리면
     화면이 지금 무엇을 보고 있는지를 흐린다 */
  const heatMode = hazardFilter === hazardLabel("열돔") || fieldFilter === "기상·기후";

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

  /* 전파 원장 — 이벤트에 붙는다(04 §7-3). 조회 조건은 대상 이벤트를 따라 걸린다.
     원장은 상태 엔진 것이라(04 §7-5) 시연 중 SOP 실행·재전파가 여기에도 바로 선다 */
  const dispatches = useMemo(() => {
    const ids = new Set(filtered.map((e) => e.id));
    return ledger.filter((r) => ids.has(r.eventId));
  }, [filtered, ledger]);

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
    /* 소요는 최초 전파에만 있다(04 §7-5) — 재전파를 섞으면 평균이 거짓말한다 */
    const durations = dispatches.map((r) => r.durationMin ?? 0).filter((d) => d > 0);
    return {
      total: filtered.length,
      warning: byLevel.get("warning") ?? 0,
      evacuate: byLevel.get("evacuate") ?? 0,
      topDistrict: top ? findDistrict(top[0])?.name : null,
      topCount: top?.[1] ?? 0,
      /* 실행 횟수 · 대상 사건 수 · 재전파 횟수를 가른다(04 §7-5) —
         재전파까지 건수로 뭉뚱그리면 대응 건수가 부풀어 보인다 */
      dispatchCount: dispatches.length,
      dispatchEvents: new Set(dispatches.map((r) => r.eventId)).size,
      resendCount: dispatches.filter((r) => r.dispatchKind === "manual-resend").length,
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
        /* 폭염은 물을 재지 않는다 — 이 지구가 얼마나 뜨거웠나(체감온도 최고)를 센다.
           단계 이력의 값이 곧 그때 체감온도다 (demo/events.ts 폭염 원장) */
        const heatValues = events
          .filter((e) => e.hazardType === "열돔")
          .flatMap((e) => (e.stages?.map((st) => st.value) ?? [e.value]));
        const heatPeak = heatValues.length ? Math.max(...heatValues) : 0;

        return {
          district,
          count: events.length,
          warnPlus: events.filter((e) => confirmedLevelAt(e, now) !== "advisory").length,
          peak,
          peakLevel: levelOf(district.id, peak),
          heatPeak,
          rain,
          dispatchCount: sent.length,
          recipients: sent.reduce((sum, r) => sum + r.recipients, 0),
        };
      }).sort((a, b) => b.count - a.count),
    [filtered, dispatches, from, to, now],
  );
  const maxCount = Math.max(1, ...districtRows.map((r) => r.count));
  /* 폭염 막대의 눈금 — 경보선 위로 가장 많이 올라간 값. 0℃ 부터 채우면 열두 줄이
     다 꽉 차 차이가 안 보인다 */
  /* 폭염 요약 — 건수가 아니라 온도와 그 갈림을 센다 */
  const dome = domeSummaryAt(now);
  const heatKpi = useMemo(() => {
    const rows = districtRows
      .filter((r) => r.heatPeak > 0)
      .map((r) => ({ name: r.district.name, value: r.heatPeak }))
      .sort((a, b) => b.value - a.value);
    const heatEvents = filtered.filter((e) => e.hazardType === "열돔");
    const from = heatEvents.map((e) => e.raisedAt).sort()[0] ?? null;
    const to = heatEvents.map((e) => e.clearedAt ?? "").sort().at(-1) || null;
    const short = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
    return {
      districts: rows.length,
      hottest: rows[0] ?? null,
      coolest: rows[rows.length - 1] ?? null,
      spread: rows.length ? rows[0].value - rows[rows.length - 1].value : 0,
      stageLabel: rows.length ? levelSpec("warning").label : "—",
      period: from && to ? `${short(from)} ~ ${short(to)}` : from ? `${short(from)} ~ 진행 중` : "",
    };
  }, [districtRows, filtered]);

  const heatSpan = Math.max(
    0.1,
    ...districtRows.map((r) => (r.heatPeak > 0 ? r.heatPeak - HEAT_THRESHOLD.warning : 0)),
  );

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
        const sent =
          dispatches.find((r) => r.eventId === event.id && r.durationMin != null) ??
          dispatches.find((r) => r.eventId === event.id);
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

  /* 사건 이력의 하위 행(전파·실패·대체 조치)은 타임라인 파생을 그대로 쓴다(04 §4-6) —
     같은 사건을 두 화면이 다른 원장으로 말하지 않는다 */
  const timelineCtx = useMemo<TimelineContext>(
    () => ({
      now,
      dispatches: ledger,
      approvedResponseLevel,
      approvedAt,
      sopExecutedItemIds,
      phoneReportedAt,
    }),
    [now, ledger, approvedResponseLevel, approvedAt, sopExecutedItemIds, phoneReportedAt],
  );

  return (
    <FullWidthLayout bodyClassName="flex flex-col p-3">
      {/*
        ★ 스크롤은 패널이 아니라 **패널 안쪽**이 한다.

        GlassPanel 의 유리 테두리 효과는 `::before` 로 그려지는데, 높이가 패널의 보이는
        높이(client height)로 잡힌다. 패널 자신이 스크롤 컨테이너면 그 효과가 내용과 함께
        밀려 올라가고, **효과가 끝나는 자리가 표 한가운데 가로선으로 보인다.** 스크롤할
        때마다 선 위치가 달라지는 것이 그 증거다.

        패널은 제자리에 고정하고 안쪽 상자가 스크롤하면 효과가 늘 패널 전체를 덮는다.
      */}
      <GlassPanel
        data-slot="statistics-card"
        borderStyle="left-top"
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
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

        {/* 탭 — [통계 분석]은 1~4단, [사건 이력]은 전파 원장 상세(03 §4 · 차수 L).
            조회 조건은 두 탭이 공유한다 */}
        <Tabs
          value={tab}
          onValueChange={(next) => setTab(next as "stats" | "history")}
          className="flex shrink-0 flex-col"
        >
          <TabsList variant="panel" className="mx-4 mt-3 w-fit shrink-0 !gap-0.5 !p-0.5">
            <TabsTrigger value="stats" variant="panel" className="!px-3 !py-1 text-caption">
              통계 분석
            </TabsTrigger>
            <TabsTrigger value="history" variant="panel" className="!px-3 !py-1 text-caption">
              사건 이력
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stats">
        {/* 1단 — 핵심 지표. 계측 집계와 대응 지표는 다른 축이다(04 §4-3).
            폭염은 세는 축이 다르다 — 몇 건이 났나가 아니라 **얼마나 뜨거웠고 어디가
            갈렸나**다. 지구마다 한 건씩이라 건수를 세면 여섯 칸이 전부 12·12·0 이 된다 */}
        {heatMode ? (
          <section aria-label="핵심 지표" className="grid shrink-0 grid-cols-6 gap-3 px-4 pt-3">
            <KpiTile
              label="폭염특보"
              value={heatKpi.stageLabel}
              unit={heatKpi.period}
              tone="var(--color-risk-lv4)"
              text
            />
            <KpiTile label="경보 도달 지구" value={`${heatKpi.districts}`} unit="곳" />
            <KpiTile
              label="가장 뜨거웠던 곳"
              value={heatKpi.hottest?.name ?? "—"}
              unit={heatKpi.hottest ? `${heatKpi.hottest.value.toFixed(1)}℃` : ""}
              tone="var(--color-danger)"
              text
            />
            <KpiTile
              label="가장 덜한 곳"
              value={heatKpi.coolest?.name ?? "—"}
              unit={heatKpi.coolest ? `${heatKpi.coolest.value.toFixed(1)}℃` : ""}
              text
            />
            <KpiTile
              label="지구 간 차"
              value={heatKpi.spread.toFixed(1)}
              unit="℃ · 같은 뚜껑 아래"
            />
            <KpiTile
              label="열돔 — 두 층 모두 안쪽"
              value={`${dome.deepDays}`}
              unit={dome.peak ? `일 · 최고 ${dome.peak.lower.toLocaleString()}gpm` : "일"}
            />
          </section>
        ) : (
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
            unit={
              `회 · 사건 ${kpi.dispatchEvents}건 · ${kpi.recipients.toLocaleString()}명` +
              (kpi.resendCount > 0 ? ` · 재전파 ${kpi.resendCount}` : "")
            }
          />
          <KpiTile
            label="평균 전파 소요"
            value={kpi.avgMin !== null ? kpi.avgMin.toFixed(1) : "—"}
            unit="분 · 발생→최초 전파"
          />
        </section>
        )}

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
                  {/* 폭염은 지구마다 한 건씩이라 발생 수를 세면 열두 줄이 전부 1 이고
                      막대도 전부 꽉 찬다 — 아무것도 안 가른다. 그 자리에 체감온도를
                      세워 막대가 뜻을 갖게 한다 */}
                  <th className="px-3 py-2 text-left font-medium">
                    {heatMode ? "최고 체감온도" : "발생"}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {heatMode ? "자리" : "경보 이상"}
                  </th>
                  {/* 폭염은 물을 재지 않는다 — 같은 자리에 체감온도가 선다 */}
                  <th className="px-3 py-2 text-right font-medium">
                    {heatMode ? "특보" : "최고 수위"}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {heatMode ? `경보 기준 ${HEAT_THRESHOLD.warning}℃ 대비` : "누적 강우"}
                  </th>
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
                        {/* 막대 + 숫자 — 순위가 눈으로 잡힌다.
                            폭염은 경보선(35℃) 위로 얼마나 올라갔는지를 채운다. 0℃ 부터
                            채우면 열두 줄이 다 꽉 차 차이가 안 보인다 */}
                        <span className="h-2 flex-1 overflow-hidden rounded-sm bg-surface-raised">
                          <span
                            className="block h-full rounded-sm bg-primary-text/60"
                            style={{
                              width: heatMode
                                ? `${Math.max(0, ((row.heatPeak - HEAT_THRESHOLD.warning) / heatSpan) * 100)}%`
                                : `${(row.count / maxCount) * 100}%`,
                            }}
                            aria-hidden
                          />
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-right font-mono text-foreground",
                            heatMode ? "w-14" : "w-5",
                          )}
                        >
                          {heatMode
                            ? row.heatPeak > 0
                              ? `${row.heatPeak.toFixed(1)}℃`
                              : "-"
                            : row.count}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right text-foreground-muted">
                      {heatMode
                        ? row.heatPeak > 0
                          ? heatSpotLabel(row.heatPeak)
                          : "-"
                        : (
                          <span className="font-mono text-foreground">
                            {row.warnPlus > 0 ? row.warnPlus : "-"}
                          </span>
                        )}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {/* 지구마다 기준이 달라 숫자만으로는 위험도가 비교되지 않는다 —
                          그 값이 어느 단계 구간인지 색 점을 함께 세운다(03 §4).
                          폭염은 기준이 시 전역 한 벌이라 경보선을 넘었는지로 색을 가른다 */}
                      <span className="inline-flex items-center gap-1.5 font-mono text-foreground">
                        {heatMode ? (
                          row.heatPeak > 0 && (
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{
                                backgroundColor: levelSpec(
                                  row.heatPeak >= HEAT_THRESHOLD.warning ? "warning" : "advisory",
                                ).color,
                              }}
                              aria-hidden
                            />
                          )
                        ) : (
                          row.peakLevel && (
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: levelSpec(row.peakLevel).color }}
                              aria-hidden
                            />
                          )
                        )}
                        {heatMode
                          ? row.heatPeak > 0
                            ? levelSpec(
                                row.heatPeak >= HEAT_THRESHOLD.warning ? "warning" : "advisory",
                              ).label
                            : "-"
                          : row.peak.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-foreground-muted">
                      {heatMode ? (
                        <HeatDelta peak={row.heatPeak} />
                      ) : (
                        `${row.rain.toFixed(0)}mm`
                      )}
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

        {/* 4단 — 선택 지구 상세.
            **유형이 폭염이면 축을 갈아 끼운다.** 폭염 사건을 골라 놓고 수위·강우량을
            보이면 화면이 답하지 않는 것을 그린다 — 물이 안 넘쳐서 더운 게 아니다.
            그 자리에 서는 것은 **왜 더운가**, 곧 창원 상공의 열돔이다 */}
        <section aria-label="선택 지구 상세" className="shrink-0 px-4 py-3">
          {heatMode ? (
            <SeaTempPanel now={now} />
          ) : (
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
          )}
        </section>
          </TabsContent>

          <TabsContent value="history">
            {/* 사건 이력 — 이벤트 한 건이 한 줄 + 전파·실패·대체 조치 하위 행(03 §4 · 차수 L).
                SCR-03 이 내린 전파 원장의 조회처다 */}
            <section aria-label="이벤트·대응 이력" className="shrink-0 p-4 pt-3">
              <HistoryTable
                events={filtered}
                dispatches={dispatches}
                now={now}
                timelineCtx={timelineCtx}
                highlightId={fromEvent?.id ?? null}
              />
            </section>
          </TabsContent>
        </Tabs>
        </div>
      </GlassPanel>
    </FullWidthLayout>
  );
}

/* ── 부품 ─────────────────────────────────────── */

/**
 * 수온 패널 — 폭염을 골랐을 때 4단이 되는 것.
 *
 * 지구별 상세가 아니다. 폭염은 지구 하나가 아니라 **하늘이 지역을 통째로 덮은** 것이고,
 * 바다는 아예 지구로 안 갈린다(격자가 약 5km 라 진해만·마산만을 못 가른다). 그래서 지구
 * 선택과 무관하게 같은 곡선이 선다.
 *
 * ── 왜 지위고도가 아니라 수온인가
 *
 * 묻는 문장이 "수온이 왜 이렇게 높아?" 다. 물음이 온도를 가리키는데 화면이 지위고도(gpm)를
 * 그리면 보는 사람이 답을 그림에서 못 찾는다. **그래프는 물음과 같은 것을 재야 한다.**
 *
 * 열돔은 그래서 곡선이 아니라 **요약 한 칸**으로 내려간다 — 그것은 물음이 아니라 답이고,
 * 답이 펼쳐지는 자리는 AI 패널이다.
 *
 * ── 이 편이 세는 것은 값이 아니라 날수다
 *
 * 하루 30℃ 는 아무 일도 아니고, 28℃ 를 넘긴 채 보름을 가면 어가가 죽는다. 그래서 요약
 * 넉 장의 둘째가 머문 날수고, 곡선은 28℃ 위에 있던 자리마다 띠를 깐다.
 */
function SeaTempPanel({ now }: { now: Date }) {
  const sea = useSeaTemp(now);
  const dome = domeSummaryAt(now);

  if (!sea) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 rounded-md border border-border bg-card text-body text-foreground-muted">
        <Icon icon="mdi:loading" className="size-5 animate-spin" aria-hidden />
        수온 자료를 읽는 중
      </div>
    );
  }

  const outlook = holdOutlook(sea);
  const watch = sea.threshold.watch;

  /*
   * 기준선을 **한 배열로 두고 차트와 범례가 같이 먹는다.**
   *
   * 한때 범례에 `발령 기준선` 한 칸을 빨간 점선으로 그려 놓고, 차트에는 주황(주의보)·
   * 노랑(예비특보) 두 줄을 그렸다. 범례가 화면에 없는 색을 가리키니 무엇이 무엇인지
   * 짚을 수 없었다. 한 곳에서 나오면 다시 어긋날 수 없다.
   */
  const thresholds = [
    { value: watch, label: `${watch}℃ 주의보`, color: "var(--color-risk-lv4)" },
    {
      value: sea.threshold.advisory,
      label: `${sea.threshold.advisory}℃ 예비특보`,
      color: "var(--color-risk-lv3)",
    },
  ];

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
        <h3 className="truncate text-body font-semibold text-foreground">창원 앞바다 표층수온</h3>
        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-3 text-caption text-foreground-subtle">
          <span className="flex items-center gap-1.5">
            <span
              className="h-0.5 w-3 rounded-full"
              style={{ background: "var(--color-risk-lv5)" }}
              aria-hidden
            />
            실측 수온
          </span>
          {/* 기준선은 줄마다 색이 달라 한 칸으로 묶지 않는다 — 묶으면 어느 색이 어느
              기준인지 화면에서 못 짚는다 */}
          {thresholds.map((line) => (
            <span key={line.label} className="flex items-center gap-1.5">
              <span
                className="h-0 w-4 border-t-2 border-dashed"
                style={{ borderColor: line.color }}
                aria-hidden
              />
              {line.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-sm"
              style={{ background: "var(--color-risk-lv5)", opacity: 0.25 }}
              aria-hidden
            />
            {watch}℃ 위에 머문 자리
          </span>
        </div>
      </div>

      {/* 요약 넉 장 — 둘째가 이 편의 값이다(머문 날수). 넷째는 온도가 아니라 그 온도의 이유 */}
      <div className="grid grid-cols-4 gap-3 px-4 pt-3">
        <KpiTile label="최고 수온" value={`${sea.peak}`} unit={`℃ · ${formatShortDate(sea.peakDate)}`} />
        <KpiTile
          label={`${watch}℃ 위에 머문 날`}
          value={`${sea.hotDays}`}
          unit="일"
          tone="var(--color-risk-lv5)"
        />
        <KpiTile
          label="현재 수온"
          value={`${sea.current}`}
          unit={`℃ · 고수온 ${SEA_STAGE_LABEL[sea.stage]}`}
        />
        <KpiTile
          label="열돔 — 두 층 모두 안쪽"
          value={`${dome.deepDays}`}
          unit={dome.peak ? `일 · 최고 ${dome.peak.lower.toLocaleString()}gpm` : "일"}
          tone="var(--color-risk-lv5)"
        />
      </div>

      {/* 좌우 여백을 머리말·요약과 같은 px-4 로 맞춘다 — 범례(머리말 오른쪽)와 곡선의
          오른쪽 끝이 한 줄에 서야 범례가 무엇을 가리키는지가 눈으로 붙는다 */}
      <div className="px-4 pb-4 pt-3">
        <SeaTempChart
          points={sea.points}
          thresholds={thresholds}
          shadeAbove={watch}
          hold={
            outlook
              ? { days: outlook.floorDays, label: `조건이 유지되면 ${formatShortDate(outlook.floorDate)}` }
              : null
          }
          height={280}
          ariaLabel={`창원 앞바다 표층수온 ${sea.points[0].date}부터 ${sea.today}까지`}
        />
      </div>

    </div>
  );
}

function levelOf(districtId: string, value: number): AlertLevel | null {
  const threshold = WATER_THRESHOLDS[districtId];
  if (!threshold) return null;
  if (value >= threshold.evacuate) return "evacuate";
  if (value >= threshold.warning) return "warning";
  if (value >= threshold.advisory) return "advisory";
  return null;
}

/**
 * 경보 기준에서 얼마나 벗어났나 — 삼각형과 색으로 방향을 말한다.
 *
 * `+2.4` 처럼 부호만 붙이면 눈이 숫자를 읽어야 방향을 안다. 삼각형은 읽기 전에 보인다.
 *
 * 색은 **넘었을 때만** 준다. 기준에 딱 닿았거나(0.0) 아래인 값까지 붉히면 열두 줄이
 * 통째로 붉어져 어디가 심한지를 못 가린다. 단계 색(노랑·주황·빨강)이 아니라 위험색을
 * 쓰는 것은 이 값이 계측 단계가 아니라 **기준선과의 거리**이기 때문이다.
 */
function HeatDelta({ peak }: { peak: number }) {
  if (peak <= 0) return <span className="text-foreground-subtle">-</span>;

  const delta = peak - HEAT_THRESHOLD.warning;
  const over = delta > 0;
  const under = delta < 0;

  return (
    <span
      className="inline-flex items-center justify-end gap-1 tabular-nums"
      style={over ? { color: "var(--color-danger)" } : undefined}
    >
      {(over || under) && (
        <Icon
          icon={over ? "mdi:menu-up" : "mdi:menu-down"}
          className="size-4 shrink-0"
          aria-hidden
        />
      )}
      {Math.abs(delta).toFixed(1)}℃
      <span className="sr-only">{over ? "기준 초과" : under ? "기준 미만" : "기준과 같음"}</span>
    </span>
  );
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

/** 이벤트·대응 통합 이력 — 주인공 사건은 단계 이력을 펼치고(04 §4-2 · 03 §4), 전 사건이
 *  전파·실패·대체 조치를 하위 행으로 편다(차수 L). 하위 행은 타임라인 파생(04 §4-6)에서
 *  온다. 마지막 단계 하나로 접으면 "계측 도달 1시간 45분 전에 승인했다"를 뒷받침할 화면이 없다 */
function HistoryTable({
  events,
  dispatches,
  now,
  timelineCtx,
  highlightId,
}: {
  events: AlertEvent[];
  dispatches: DispatchRecord[];
  now: Date;
  timelineCtx: TimelineContext;
  highlightId: string | null;
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
            /* 이력 행에는 최초 전파를 단다(04 §7-5) — 재전파가 앞에 쌓여도 소요(분)가
               있는 첫 전파가 그 사건의 대응 기록이다 */
            const sent =
              dispatches.find((r) => r.eventId === event.id && r.durationMin != null) ??
              dispatches.find((r) => r.eventId === event.id);
            const view = eventViewAt(event, now);
            const hero = event.id === HERO_EVENT_ID && (event.stages?.length ?? 0) > 1;
            return (
              <HistoryRowGroup
                key={event.id}
                event={event}
                districtName={district?.name ?? "-"}
                view={view}
                now={now}
                highlight={event.id === highlightId}
                /* 주인공 사건은 파생 타임라인 전체(발생~해제)를 시간순 그대로 편다(04 §4-2·§4-6).
                   다른 사건은 발생·해제가 본 행과 겹치므로 전파·실패·대체 조치만 */
                detailEntries={eventTimelineAt(event, timelineCtx).filter(
                  (entry) =>
                    hero ||
                    entry.kind === "dispatch" ||
                    entry.kind === "fail" ||
                    entry.kind === "fallback",
                )}
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
  now,
  highlight,
  detailEntries,
  dispatch,
}: {
  event: AlertEvent;
  districtName: string;
  view: ReturnType<typeof eventViewAt>;
  now: Date;
  highlight: boolean;
  detailEntries: TimelineEntry[];
  dispatch: { channels: string; recipients: number; durationMin?: number } | null;
}) {
  const confirmed = confirmedLevelAt(event, now);

  /* ?event= 로 지정돼 들어온 그 사건 — 강조하고 화면 안으로 끌어온다(03 §4) */
  const rowRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (highlight) rowRef.current?.scrollIntoView({ block: "center" });
  }, [highlight]);

  return (
    <>
      <tr
        ref={rowRef}
        className={cn("border-b border-border last:border-b-0", highlight && "bg-surface-raised")}
      >
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
      {/* 하위 행 — 타임라인 파생(04 §4-6)이 시간순 그대로 선다(차수 L). 주인공 사건은
          발생부터 해제까지 전부, 다른 사건은 전파·실패·대체 조치만. 재전파는 최초 전파와
          유형이 갈려 적히므로 대응 건수로 오독되지 않는다 */}
      {detailEntries.map((entry, index) => (
        <tr
          key={`${entry.at.toISOString()}-${entry.kind}-${index}`}
          className="border-b border-border bg-surface-raised/40 last:border-b-0"
        >
          <td className="py-1 pl-8 pr-3 font-mono text-foreground-subtle">
            └ {formatClock(entry.at)}
          </td>
          <td
            className={cn("px-3 py-1", entry.kind === "fail" ? "text-danger" : "text-foreground-subtle")}
            colSpan={5}
          >
            {entry.label}
            {entry.detail ? ` · ${entry.detail}` : ""}
          </td>
        </tr>
      ))}
    </>
  );
}
