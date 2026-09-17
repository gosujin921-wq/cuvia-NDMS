/* ─────────────────────────────────────────────
 * SCR-04 통계 (IA-06) — 기간 동안 어떤 사건이 어디서 얼마나 났고, 대응은 어땠는가 (IA §10.2 · 2026-09-16)
 *
 * 사건 한 건의 경과는 보지 않는다. 그것은 이력(IA-05)이 한다. 여기는 여러 사건을 모아 센다.
 * 숫자는 이력과 같은 사건 원장(model/records)에서 센다 — 조건이 같으면 이력 [사건] 게시판의 건수와 같다
 * (2026-09-16 사용자 "통계와 이력의 숫자를 맞춰"). 모든 사건이 가진 값(상태·유형·지역·발생·첫 대응·종료)으로만 센다.
 * 일부 사건에만 있는 값(위험 등급·전파 건수)은 합계를 흐리므로 세우지 않는다.
 *
 * 읽는 순서 (사용자가 알고 싶은 순서)
 *   조회 조건     기간(기본 전체) · 지역 · 유형 · 상태 — 게시판과 같은 칩 한 줄(BoardToolbar)
 *   핵심 지표     몇 건인가(상태 구성) → 지금 진행 중인가 → 첫 대응까지 → 끝나기까지 → 무엇이 가장 많았나
 *   유형별 흐름   언제 · 무엇이 · 몇 건 — 유형마다 한 줄, 가로가 시간, 사건이 점이다. 점을 누르면 이력의 그 사건 기록
 *   지역별 비교   어디서 났나 — 줄을 누르면 그 지역으로 좁힌다
 *
 * ▸ 그림 규칙(dataviz 지침): 색은 뜻이 있을 때만 쓴다. 한 계열은 한 색(primary-text)이고, 강조가 필요한 것만
 *   강조색을 입힌다(진행 중). 유형은 줄 이름과 위치가 가르고 색으로 가르지 않는다 — 재난 유형 색 정본이 아직 없고,
 *   7종을 색으로 가르면 식별이 흐려진다. 큰 수는 비례 숫자, 표 칸만 고정폭 숫자다. 막대는 가늘게, 격자는 실선 머리카락이다.
 *   9건처럼 적은 원장에서 월별 막대는 거의 비어 휑했다(2026-09-16 사용자 "모양 왜 이렇게 안 예뻐짐") — 흐름 점그림으로 바꿨다.
 *
 * 앞서 있던 계측 곡선·열돔·수온 판, 사건 이력·예측 검증 탭, [보고서 생성]·[다운로드]는 걷었다(IA §10.2 · §17).
 * 사건 한 건은 이력에서, 계측은 사건 작업공간의 관측 근거에서 본다. 탭이 없는 한 화면이라 상단바가 머리다.
 * ───────────────────────────────────────────── */

import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChipFilter, DataTable, DateRangeChip, cn, type DataTableColumn } from "@ds";
import { FullWidthLayout } from "../../layout/FullWidthLayout";
import { BoardToolbar } from "../../components/BoardFrame";
import { formatDate, formatMinutes, formatStamp } from "../../lib/datetime";
import { useScenario } from "../../state/ScenarioProvider";
import {
  RECORD_STATUSES,
  incidentRecordsAt,
  recordClockOf,
  recordStatsOf,
  regionStatsOf,
  type IncidentRecord,
  type RecordStats,
  type RegionStat,
} from "../../model/records";

/** 기간 프리셋 — 기본은 전체다. 이력 게시판이 기간 없이 전부를 보이므로, 처음 열었을 때 두 화면의 건수가 같다 */
const RANGES = [
  { label: "전체", days: null },
  { label: "1년", days: 365 },
  { label: "6개월", days: 182 },
  { label: "3개월", days: 91 },
  { label: "1개월", days: 30 },
  { label: "1주일", days: 7 },
  { label: "직접 지정", days: 0 },
] as const;
const ALL = "전체";
const DEFAULT_RANGE = "전체";
const RANGE_LABELS: string[] = RANGES.map((r) => r.label);

const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * 86_400_000);

export function StatisticsPage() {
  const navigate = useNavigate();
  const { demoNow, falsePositiveIds } = useScenario();
  /* 이력과 같은 시계 — 원장 끝까지 읽는다(model/records.recordClockOf). 시계가 다르면 두 메뉴의 건수가 갈린다 */
  const now = useMemo(() => recordClockOf(demoNow), [demoNow]);
  const records = useMemo(() => incidentRecordsAt(now, { falsePositiveIds }), [now, falsePositiveIds]);

  const [rangeLabel, setRangeLabel] = useState(DEFAULT_RANGE);
  const [customFrom, setCustomFrom] = useState(() => daysBefore(now, 30));
  const [customTo, setCustomTo] = useState(now);
  const [region, setRegion] = useState(ALL);
  const [kind, setKind] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const filterActive = rangeLabel !== DEFAULT_RANGE || region !== ALL || kind !== ALL || status !== ALL;
  const resetFilters = () => { setRangeLabel(DEFAULT_RANGE); setRegion(ALL); setKind(ALL); setStatus(ALL); };

  /* 고르는 후보는 원장에 있는 것만 — 없는 값을 세우면 고를 수 있는데 결과가 없다 */
  const regions = useMemo(() => [ALL, ...new Set(records.map((r) => r.region))], [records]);
  const kinds = useMemo(() => [ALL, ...new Set(records.map((r) => r.hazardKind))], [records]);

  /* 기간 — 전체면 원장의 첫 사건이 든 달의 첫날부터 지금까지 */
  const custom = rangeLabel === "직접 지정";
  const preset = RANGES.find((r) => r.label === rangeLabel);
  const earliest = records.reduce((min, r) => (r.occurredAt < min ? r.occurredAt : min), now.toISOString());
  const earliestDate = new Date(earliest);
  const fromMs = (custom ? customFrom : preset?.days ? daysBefore(now, preset.days) : new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1)).getTime();
  const toMs = (custom ? customTo : now).getTime();

  const filtered = useMemo(
    () =>
      records.filter((r) => {
        const t = new Date(r.occurredAt).getTime();
        if (t < fromMs || t > toMs) return false;
        if (region !== ALL && r.region !== region) return false;
        if (kind !== ALL && r.hazardKind !== kind) return false;
        if (status !== ALL && r.status !== status) return false;
        return true;
      }),
    [records, fromMs, toMs, region, kind, status],
  );

  const stats = useMemo(() => recordStatsOf(filtered), [filtered]);
  const regionRows = useMemo(() => regionStatsOf(filtered), [filtered]);
  const topKind = stats.byKind[0];

  const regionColumns = useMemo<DataTableColumn<RegionStat>[]>(() => {
    const max = Math.max(1, ...regionRows.map((r) => r.count));
    return [
      { key: "region", label: "지역", sortable: true, getValue: (r) => r.region, render: (r) => <span className="block truncate text-foreground" title={r.region}>{r.region}</span> },
      {
        key: "count", label: "사건", width: "24%", sortable: true, getValue: (r) => r.count,
        render: (r) => <MeterCell ratio={r.count / max} text={`${r.count}`} />,
      },
      {
        key: "active", label: "진행 중", width: "88px", align: "right", sortable: true, getValue: (r) => r.active,
        cellClassName: "tabular-nums",
        render: (r) => (r.active > 0 ? <span className="font-medium text-primary-text">{r.active}</span> : <span className="text-foreground-subtle">0</span>),
      },
      {
        key: "lead", label: "첫 대응까지", width: "112px", align: "right", sortable: true,
        getValue: (r) => r.responseLeadMin ?? Number.MAX_SAFE_INTEGER,
        cellClassName: "tabular-nums text-foreground-muted",
        render: (r) => (r.responseLeadMin !== null ? formatMinutes(r.responseLeadMin) : <span className="text-foreground-subtle">-</span>),
      },
      {
        key: "duration", label: "종료까지", width: "120px", align: "right", sortable: true,
        getValue: (r) => r.durationMin ?? Number.MAX_SAFE_INTEGER,
        cellClassName: "tabular-nums text-foreground-muted",
        render: (r) => (r.durationMin !== null ? formatMinutes(r.durationMin) : <span className="text-foreground-subtle">-</span>),
      },
      {
        key: "kinds", label: "유형", width: "22%",
        render: (r) => <span className="block truncate text-foreground-muted">{r.kinds.join(" · ")}</span>,
      },
    ];
  }, [regionRows]);

  return (
    <FullWidthLayout bodyClassName="flex min-h-0 flex-col gap-3 p-3">
      {/* 조회 조건 — 이력 게시판과 같은 툴바. 오른쪽 끝은 지금 보는 기간 */}
      <div className="shrink-0 overflow-hidden rounded-md border border-border bg-card">
        <BoardToolbar
          className="pb-3"
          filters={
            <>
              <ChipFilter label="기간" options={RANGE_LABELS} value={rangeLabel} onChange={setRangeLabel} noDot />
              {custom && (
                <DateRangeChip
                  fromDate={customFrom}
                  toDate={customTo}
                  onChange={({ from: nextFrom, to: nextTo }) => { setCustomFrom(nextFrom); setCustomTo(nextTo); }}
                  isInvalid={customTo < customFrom}
                />
              )}
              <ChipFilter label="지역" options={regions} value={region} onChange={setRegion} noDot />
              <ChipFilter label="유형" options={kinds} value={kind} onChange={setKind} noDot />
              <ChipFilter label="상태" options={[ALL, ...RECORD_STATUSES]} value={status} onChange={setStatus} noDot />
            </>
          }
          onReset={resetFilters}
          resetDisabled={!filterActive}
          actions={
            <span className="ml-auto truncate font-mono text-caption text-foreground-subtle">
              {formatDate(new Date(fromMs))} ~ {formatDate(new Date(toMs))}
            </span>
          }
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {/* 핵심 지표 — 몇 건(상태 구성) → 진행 중 → 첫 대응까지 → 끝나기까지 → 무엇이 가장 많았나 */}
        <section aria-label="핵심 지표" className="grid shrink-0 grid-cols-5 gap-3">
          <StatTile label="사건" value={`${stats.total}`} unit="건">
            <StatusMix stats={stats} />
          </StatTile>
          <StatTile label="진행 중" value={`${stats.byStatus["진행 중"]}`} unit="건" accent={stats.byStatus["진행 중"] > 0}>
            <span className="text-caption text-foreground-subtle">지금 시계 기준 · 이력에서 연다</span>
          </StatTile>
          <StatTile label="첫 대응까지" value={stats.responseLeadMin !== null ? formatMinutes(stats.responseLeadMin) : "-"}>
            <span className="text-caption text-foreground-subtle">평균 · 발생에서 첫 조치·전파</span>
          </StatTile>
          <StatTile label="종료까지" value={stats.durationMin !== null ? formatMinutes(stats.durationMin) : "-"}>
            <span className="text-caption text-foreground-subtle">평균 · 발생에서 종료</span>
          </StatTile>
          <StatTile label="가장 많이 난 유형" value={topKind?.key ?? "-"} unit={topKind ? `${topKind.count}건` : undefined}>
            <span className="truncate text-caption text-foreground-subtle">
              {stats.byKind.length > 1 ? `유형 ${stats.byKind.length}종 중` : " "}
            </span>
          </StatTile>
        </section>

        {/* 유형별 흐름 — 언제 · 무엇이 · 몇 건. 점을 누르면 이력의 그 사건 기록 */}
        <section aria-label="유형별 사건 흐름" className="shrink-0 rounded-md border border-border bg-card">
          <div className="flex items-baseline gap-2 border-b border-border px-4 py-2.5">
            <h3 className="text-body font-semibold text-foreground">유형별 사건 흐름</h3>
            <span className="truncate text-caption text-foreground-subtle">점을 누르면 이력의 사건 기록이 열립니다</span>
            <span className="ml-auto flex shrink-0 items-center gap-3 text-caption text-foreground-subtle">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary-text" aria-hidden />사건</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full border border-foreground-subtle" aria-hidden />오탐</span>
            </span>
          </div>
          <div className="px-4 pb-3 pt-3">
            <IncidentStrip
              records={filtered}
              order={stats.byKind.map((k) => k.key)}
              from={new Date(fromMs)}
              to={new Date(toMs)}
              onOpen={(id) => navigate(`/scr-07?incident=${encodeURIComponent(id)}`)}
            />
          </div>
        </section>

        {/* 지역별 비교 — 어디서 났나. 게시판과 같은 표이고 줄을 누르면 그 지역으로 좁힌다 */}
        <section aria-label="지역별 비교" className="shrink-0 overflow-hidden rounded-md border border-border bg-card">
          <div className="flex items-baseline gap-2 border-b border-border px-4 py-2.5">
            <h3 className="text-body font-semibold text-foreground">지역별 비교</h3>
            <span className="truncate text-caption text-foreground-subtle">줄을 누르면 그 지역으로 좁힙니다</span>
          </div>
          <div className="px-4 py-3">
            <DataTable
              className="h-auto"
              data={regionRows}
              columns={regionColumns}
              rowKey={(r) => r.region}
              onRowClick={(r) => setRegion(r.region)}
              highlightedKey={region === ALL ? null : region}
              hidePagination
              emptyIcon="mdi:filter-off-outline"
              emptyMessage="조건에 해당하는 사건이 없습니다"
            />
          </div>
        </section>
      </div>
    </FullWidthLayout>
  );
}

/* ── 부품 ─────────────────────────────────────── */

/** 지표 한 칸 — 이름 · 값(비례 숫자, 모든 칸 같은 크기) · 한 줄 부연 */
function StatTile({ label, value, unit, accent, children }: { label: string; value: string; unit?: string; accent?: boolean; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border border-border bg-card px-4 py-3">
      <span className="text-caption text-foreground-muted">{label}</span>
      <span className="flex min-w-0 items-baseline gap-1">
        <span className={cn("truncate text-h4 font-semibold", accent ? "text-primary-text" : "text-foreground")}>{value}</span>
        {unit && <span className="shrink-0 text-body text-foreground-muted">{unit}</span>}
      </span>
      <div className="min-h-5">{children}</div>
    </div>
  );
}

/**
 * 상태 구성 — 가는 막대 한 줄. 진행 중만 강조색이고 나머지는 회색 단계다(강조 문법).
 * 칸 사이는 2px 바탕 틈이 가른다. 이름·수는 막대 아래 글자가 든다(색만으로 가르지 않는다).
 */
function StatusMix({ stats }: { stats: RecordStats }) {
  const parts = [
    { key: "진행 중", n: stats.byStatus["진행 중"], bar: "bg-primary-text" },
    { key: "종료", n: stats.byStatus["종료"], bar: "bg-foreground-subtle" },
    { key: "오탐", n: stats.byStatus["오탐"], bar: "bg-border" },
  ];
  const total = Math.max(1, stats.total);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {parts.filter((p) => p.n > 0).map((p) => (
          <span key={p.key} className={cn("h-full", p.bar)} style={{ width: `${(p.n / total) * 100}%` }} />
        ))}
      </div>
      <span className="flex flex-wrap gap-x-2 text-caption text-foreground-subtle">
        {parts.map((p) => <span key={p.key}>{p.key} <span className="tabular-nums text-foreground-muted">{p.n}</span></span>)}
      </span>
    </div>
  );
}

/** 막대 + 숫자 — 크기가 눈으로 잡힌다(표 칸 안) */
function MeterCell({ ratio, text }: { ratio: number; text: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
        <span className="block h-full rounded-full bg-primary-text/70" style={{ width: `${Math.min(1, Math.max(0, ratio)) * 100}%` }} aria-hidden />
      </span>
      <span className="w-5 shrink-0 text-right tabular-nums text-foreground">{text}</span>
    </span>
  );
}

/**
 * 유형별 사건 흐름 — 유형마다 한 줄, 가로축이 시간, 사건이 점이다. 줄 끝에 건수.
 *
 * 같은 날 같은 유형의 사건은 점 하나로 겹치고 옆에 수를 단다 — 겹친 점이 하나로 보이면 건수를 잃는다.
 * 오탐은 속이 빈 점이다(사건이 되지 못한 것). 점은 버튼이고 누르면 이력의 사건 기록으로 간다.
 * 눈금은 달이다. 격자는 실선 머리카락이고 점은 바탕 테두리(2px)로 줄 선과 떨어진다.
 */
function IncidentStrip({ records, order, from, to, onOpen }: {
  records: IncidentRecord[];
  /** 줄 순서 — 사건이 많은 유형이 위(recordStatsOf.byKind) */
  order: string[];
  from: Date;
  to: Date;
  onOpen: (incidentId: string) => void;
}) {
  const span = Math.max(1, to.getTime() - from.getTime());
  const pos = (iso: string) => Math.min(100, Math.max(0, ((new Date(iso).getTime() - from.getTime()) / span) * 100));

  /* 달 눈금 — 기간 안의 매월 1일 */
  const ticks = useMemo(() => {
    const out: { at: Date; label: string }[] = [];
    let d = new Date(from.getFullYear(), from.getMonth(), 1);
    if (d < from) d = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    while (d <= to && out.length < 24) {
      out.push({ at: d, label: `${d.getFullYear() % 100}.${String(d.getMonth() + 1).padStart(2, "0")}` });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
    return out;
  }, [from, to]);

  const rows = useMemo(
    () =>
      order.map((kind) => {
        const list = records.filter((r) => r.hazardKind === kind).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
        /* 같은 날이면 한 점 — 정상 사건이 하나라도 있으면 채운 점 */
        const byDay = new Map<string, IncidentRecord[]>();
        for (const r of list) byDay.set(r.occurredAt.slice(0, 10), [...(byDay.get(r.occurredAt.slice(0, 10)) ?? []), r]);
        return { kind, count: list.length, dots: [...byDay.values()] };
      }),
    [records, order],
  );

  if (rows.length === 0) return <p className="py-6 text-center text-caption text-foreground-subtle">조건에 해당하는 사건이 없습니다.</p>;

  return (
    <div className="flex flex-col">
      {rows.map((row) => (
        <div key={row.kind} className="grid grid-cols-[104px_1fr_40px] items-center gap-3">
          <span className="truncate text-caption text-foreground-muted">{row.kind}</span>
          <div className="relative h-8">
            <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
            {ticks.map((t) => (
              <span key={t.at.getTime()} className="absolute top-1.5 bottom-1.5 w-px bg-border/60" style={{ left: `${pos(t.at.toISOString())}%` }} aria-hidden />
            ))}
            {row.dots.map((group) => {
              const first = group[0];
              const real = group.some((r) => r.status === "진행 중" || r.status === "종료");
              const active = group.some((r) => r.status === "진행 중");
              const label = group.map((r) => `${r.title} · ${formatStamp(r.occurredAt)} · ${r.status}`).join("\n");
              return (
                <button
                  key={first.incidentId}
                  type="button"
                  title={label}
                  aria-label={label}
                  onClick={() => onOpen(first.incidentId)}
                  className="group absolute top-1/2 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
                  style={{ left: `${pos(first.occurredAt)}%` }}
                >
                  <span
                    className={cn(
                      "size-3 rounded-full ring-2 ring-card transition-transform group-hover:scale-125",
                      real ? "bg-primary-text" : "border border-foreground-subtle bg-card",
                      active && "animate-pulse",
                    )}
                  />
                  {group.length > 1 && (
                    /* 같은 날 겹친 수 — 줄 끝 합계와 헷갈리지 않게 ×로 적는다 */
                    <span className="absolute left-full ml-0.5 font-mono text-caption text-foreground-muted">×{group.length}</span>
                  )}
                </button>
              );
            })}
          </div>
          <span className="text-right text-body font-semibold text-foreground">{row.count}</span>
        </div>
      ))}
      {/* 달 눈금 이름 */}
      <div className="grid grid-cols-[104px_1fr_40px] gap-3 pt-1">
        <span />
        <div className="relative h-4">
          {ticks.map((t) => (
            <span key={t.at.getTime()} className="absolute -translate-x-1/2 font-mono text-caption text-foreground-subtle" style={{ left: `${pos(t.at.toISOString())}%` }}>
              {t.label}
            </span>
          ))}
        </div>
        <span className="text-right text-caption text-foreground-subtle">건</span>
      </div>
    </div>
  );
}
