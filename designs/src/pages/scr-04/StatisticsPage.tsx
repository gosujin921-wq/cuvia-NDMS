/* ─────────────────────────────────────────────
 * SCR-04 통계 — 정본: docs/정본/03_화면정의서.md §4
 *
 * 쌓인 계측 기록을 기간·지구로 모아 본다. 수위와 강우량을 한 그래프에 겹쳐 "비가 얼마나
 * 왔을 때 물이 얼마나 올랐는지"를 눈으로 잇게 한다.
 *
 * SCR-02 센서 팝업의 [상세 측정현황 보기]로 들어오면 `?device=` 로 그 장비의 지구가 열린다.
 * ───────────────────────────────────────────── */

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { Button, DateRangeChip, FilterCapsuleGroup, GlassPanel } from "@ds";
import { FullWidthLayout } from "../../layout/FullWidthLayout";
import { DISTRICTS, findDistrict } from "../../demo/districts";
import { findDevice } from "../../demo/devices";
import { DEMO_NOW, EVENTS } from "../../demo/events";
import { ALERT_LEVELS, WATER_THRESHOLDS, levelSpec } from "../../demo/levels";
import { historySeries, sampleStepMinutes } from "../../demo/measurements";
import { DualAxisChart, type EventBand } from "../../components/DualAxisChart";
import { formatDate } from "../../lib/datetime";

/** 기간 프리셋 — 라벨과 일수 (03 §4) */
const RANGES = [
  { label: "1년", days: 365 },
  { label: "6개월", days: 182 },
  { label: "3개월", days: 91 },
  { label: "1개월", days: 30 },
  { label: "1주일", days: 7 },
  { label: "직접 지정", days: 0 },
] as const;

const RANGE_LABELS = RANGES.map((r) => r.label);

function daysBefore(days: number): Date {
  return new Date(DEMO_NOW.getTime() - days * 86_400_000);
}

export function StatisticsPage() {
  const [params] = useSearchParams();
  const fromDevice = findDevice(params.get("device") ?? "");

  const [districtId, setDistrictId] = useState(fromDevice?.districtId ?? DISTRICTS[0].id);
  const [rangeLabel, setRangeLabel] = useState<string>("1개월");
  const [customFrom, setCustomFrom] = useState(daysBefore(14));
  const [customTo, setCustomTo] = useState(DEMO_NOW);

  const custom = rangeLabel === "직접 지정";
  const preset = RANGES.find((r) => r.label === rangeLabel);
  const from = custom ? customFrom : daysBefore(preset?.days ?? 30);
  const to = custom ? customTo : DEMO_NOW;

  const district = findDistrict(districtId);
  const samples = useMemo(() => historySeries(districtId, from, to), [districtId, from, to]);

  const threshold = WATER_THRESHOLDS[districtId];
  const thresholdLines = ALERT_LEVELS.map((level) => ({
    value: threshold[level.id],
    color: level.color,
    label: level.label,
  }));

  /* 이 기간에 이 지구에서 났던 이벤트 — 그래프 띠와 요약에 쓴다 */
  const events = EVENTS.filter((event) => {
    if (event.districtId !== districtId) return false;
    const at = new Date(event.raisedAt).getTime();
    return at >= from.getTime() && at <= to.getTime();
  });

  const bands: EventBand[] = events.map((event) => ({
    from: new Date(event.raisedAt),
    to: new Date(event.clearedAt ?? DEMO_NOW.toISOString()),
    color: levelSpec(event.level).color,
    label: event.id,
  }));

  const peakWater = samples.length ? Math.max(...samples.map((s) => s.water)) : 0;
  const totalRain = samples.reduce((sum, s) => sum + s.rain, 0);

  const handleDownload = () => {
    const header = "일시,수위(EL.m),강우량(mm)\n";
    const body = samples
      .map((s) => `${s.at.toISOString()},${s.water},${s.rain}`)
      .join("\n");
    const blob = new Blob([`﻿${header}${body}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${district?.name}_계측_${formatDate(from)}_${formatDate(to)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <FullWidthLayout bodyClassName="flex flex-col p-3">
      <div className="flex min-h-0 flex-1">
        {/* 게시판형 골격 — 화면 전체가 패널 하나 안에 층으로 쌓인다(플랫폼 목록 화면 규칙) */}
        <GlassPanel
          data-slot="statistics-card"
          borderStyle="left-top"
          className="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          {/* 제목 밴드 — 화면명 + 조회 범위 + 화면 단위 액션 */}
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
            <div className="flex min-w-0 items-baseline gap-2">
              <h2 className="shrink-0 text-h6 font-semibold text-foreground">계측 통계</h2>
              <span className="truncate text-caption text-foreground-subtle">
                {formatDate(from)} ~ {formatDate(to)} · 표본{" "}
                {sampleStepMinutes((to.getTime() - from.getTime()) / 86_400_000) / 60}시간 간격
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownload} className="shrink-0">
              <Icon icon="mdi:download" className="size-4" aria-hidden />
              다운로드
            </Button>
          </header>

          {/* 1층 — 조회 조건. 라벨 폭을 맞춰 두 줄의 칩이 같은 x 에서 시작한다 */}
          <section
            aria-label="조회 조건"
            data-spec="1"
            className="flex shrink-0 flex-col gap-2 border-b border-border px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-8 shrink-0 text-caption font-semibold text-foreground">지구</span>
              {/* 지구 단일 선택 — DS FilterCapsuleGroup. 기간 프리셋과 같은 칩 어휘를 쓴다 */}
              <FilterCapsuleGroup
                options={DISTRICTS.map((item) => item.name)}
                value={district?.name ?? ""}
                onChange={(name) =>
                  setDistrictId(DISTRICTS.find((item) => item.name === name)?.id ?? districtId)
                }
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="w-8 shrink-0 text-caption font-semibold text-foreground">기간</span>
              <FilterCapsuleGroup
                options={RANGE_LABELS}
                value={rangeLabel}
                onChange={setRangeLabel}
              />
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
            </div>
          </section>

          {/* 2층 — 요약 */}
          <section
            aria-label="조회 요약"
            data-spec="2"
            className="grid shrink-0 grid-cols-4 gap-3 px-4 pt-3"
          >
            <SummaryTile label="최고 수위" value={`${peakWater.toFixed(2)}`} unit="EL.m" />
            <SummaryTile label="누적 강우량" value={`${totalRain.toFixed(0)}`} unit="mm" />
            <SummaryTile label="이벤트" value={`${events.length}`} unit="건" />
            <SummaryTile
              label="주의보 기준"
              value={`${threshold.advisory}`}
              unit="EL.m"
              tone="var(--color-risk-lv3)"
            />
          </section>

          {/* 3층 — 이중축 그래프. 패널 안이라 glass 를 겹치지 않고 카드면(bg-card)으로 내린다 */}
          <section data-spec="3" className="flex min-h-0 flex-1 flex-col px-4 pt-3 pb-4">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border bg-card">
              <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
                <h3 className="truncate text-body font-semibold text-foreground">
                  {district?.name} 수위·강우량
                </h3>
                {/* 범례 칩 모양은 차트 마크를 따른다 — 선은 얇은 막대, 막대는 사각 */}
                <div className="ml-auto flex shrink-0 items-center gap-3 text-caption text-foreground-subtle">
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-3 shrink-0 rounded-full bg-primary-text" aria-hidden />
                    수위 (EL.m)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-3 w-3 shrink-0 rounded-sm bg-primary-text opacity-50"
                      aria-hidden
                    />
                    강우량 (mm)
                  </span>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
                <div className="min-h-[220px] flex-1">
                  <DualAxisChart
                    samples={samples}
                    thresholds={thresholdLines}
                    bands={bands}
                    height="fill"
                  />
                </div>

                {events.length > 0 ? (
                  <ul className="flex shrink-0 flex-wrap gap-2 border-t border-border pt-2">
                    {events.map((event) => {
                      const spec = levelSpec(event.level);
                      return (
                        <li
                          key={event.id}
                          className="flex items-center gap-1.5 text-caption text-foreground-muted"
                        >
                          <span
                            className="size-3 shrink-0 rounded-sm"
                            style={{ backgroundColor: spec.color }}
                            aria-hidden
                          />
                          {formatDate(event.raisedAt)} {spec.label} · {event.value} {event.unit}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="shrink-0 border-t border-border pt-2 text-caption text-foreground-subtle">
                    이 기간에 발생한 이벤트가 없습니다.
                  </p>
                )}
              </div>
            </div>
          </section>
        </GlassPanel>
      </div>
    </FullWidthLayout>
  );
}

function SummaryTile({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  tone?: string;
}) {
  return (
    <div
      data-slot="statistics-summary-tile"
      className="flex flex-col gap-1 rounded-md border border-border bg-card p-3"
    >
      <span className="text-caption text-foreground-muted">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className="font-mono text-h4 font-semibold" style={{ color: tone }}>
          {value}
        </span>
        <span className="text-caption text-foreground-subtle">{unit}</span>
      </span>
    </div>
  );
}
