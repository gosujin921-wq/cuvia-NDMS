/* ─────────────────────────────────────────────
 * 예측 케이스 — 사건이 끝난 뒤 "예측 대 실제"를 본다 (IA §10 · §13.1 · 03 §25 · 2026-09-15 확정)
 *
 * 모의훈련 모드는 두지 않는다. 디지털트윈이 예측 시뮬레이션이고, 사건이 끝나면 여기 케이스가 쌓인다.
 * ★ 점수를 매기지 않는다. "잘했다·못했다"가 없다 — 예측과 실제를 나란히 두고 차이와 개선 항목만 남긴다.
 *
 * 읽는 순서는 넷이다.
 *   ① 무엇을 무슨 정보로 예측했나   케이스 머리 · 예측 기준
 *   ② 얼마나 맞았나                 예측 대 실제 표 + 예측 범위 vs 실제 범위 지도
 *   ③ 실제로 무엇을 했나            실제 대응
 *   ④ 다음에 무엇을 고칠까          개선 항목
 * 값은 전부 selectors.predictionCasesAt 이 원장에서 파생한다 — 이 화면은 숫자를 만들지 않는다.
 * ───────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { Badge, cn } from "@ds";
import type { CaseTargetRow, ErrorDirection, PredictionCase } from "../../../model/prediction-case";
import { GEOMETRIES } from "../../../fixtures";
import { cssColor, upsertPolygonLayer, type Ring } from "../../../lib/map-polygon";
import { useMapLibre } from "../../../lib/useMapLibre";
import { formatClock } from "../../../lib/datetime";
import { useScenario } from "../../../state/ScenarioProvider";
import maplibregl from "maplibre-gl";

/** 링의 면적(ha) — 지도가 그린 그 형상을 잰다. 경도는 위도에 따라 줄어드니 보정한다 */
function areaHa(ring?: Ring): number | null {
  if (!ring || ring.length < 3) return null;
  const lat0 = (ring.reduce((a, p) => a + p[1], 0) / ring.length) * (Math.PI / 180);
  const mx = 111_320 * Math.cos(lat0), my = 110_540;
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length];
    sum += (x1 * mx) * (y2 * my) - (x2 * mx) * (y1 * my);
  }
  return Math.abs(sum) / 2 / 10_000;
}

const PREDICTED_SOURCE = "case-extent-predicted";
const ACTUAL_SOURCE = "case-extent-actual";

/** 차이 칸의 색 — 좋고 나쁨이 아니라 방향이다. 일치만 다른 색을 쓴다 */
const DIRECTION_TONE: Record<ErrorDirection, string> = {
  과대: "text-primary-text",
  과소: "text-warning",
  일치: "text-foreground-muted",
};

export function PredictionCasePanel({ item }: { item: PredictionCase }) {
  return (
    <div className="flex flex-col gap-3 px-4 pb-6 pt-3">
      <CaseHeader item={item} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="flex flex-col gap-3">
          <CompareTable item={item} />
          <TargetHits targets={item.targets} />
        </div>
        <ExtentCompare item={item} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <ActualResponse item={item} />
        <Improvements item={item} />
      </div>
      <p className="text-caption text-foreground-subtle">
        점수를 매기지 않습니다. 오차와 개선 항목은 다음 예측·임계치·SOP에 반영할 학습 재료로 남깁니다.
      </p>
    </div>
  );
}

/* ── ① 무엇을 무슨 정보로 예측했나 ── */
function CaseHeader({ item }: { item: PredictionCase }) {
  return (
    <section className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-3" aria-label="예측 케이스">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex min-w-0 items-baseline gap-2">
          <span className="font-mono text-body font-semibold text-foreground">{item.caseId}</span>
          <span className="min-w-0 truncate text-caption text-foreground-muted">{item.incidentTitle}</span>
        </h2>
        <span className="shrink-0 text-caption text-foreground-subtle">확정 <span className="font-mono">{formatClock(item.confirmedAt)}</span></span>
      </div>
      <p className="text-caption text-foreground-muted">
        {item.hazardLabel} · {item.regionLabel} · 예측 기준 <span className="font-mono text-foreground">{formatClock(item.baseTime)}</span>
      </p>
      <details className="group mt-0.5">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-caption text-foreground-subtle hover:text-foreground [&::-webkit-details-marker]:hidden">
          <Icon icon="mdi:chevron-right" className="size-4 shrink-0 transition-transform group-open:rotate-90" aria-hidden />
          무슨 정보로 예측했나 <span className="font-mono">{item.inputs.length}건</span>
        </summary>
        <dl className="mt-1 flex flex-col gap-0.5 border-t border-border pt-1.5 text-caption">
          {item.inputs.map((input) => (
            <div key={input.label} className="flex items-baseline gap-2">
              <dt className="w-24 shrink-0 text-foreground-muted">{input.label}</dt>
              <dd className="font-mono text-foreground-subtle">{formatClock(input.at)} 수신</dd>
              <dd className="text-foreground-subtle">{input.kind}</dd>
            </div>
          ))}
          <div className="flex items-baseline gap-2 pt-1 text-foreground-subtle">
            <dt className="w-24 shrink-0 text-foreground-muted">모델</dt>
            <dd>{item.modelName} {item.modelVersion} · 입력 품질 {item.inputQuality}</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}

/* ── ② 얼마나 맞았나 ── */
function CompareTable({ item }: { item: PredictionCase }) {
  if (item.rows.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-surface p-3 text-caption text-foreground-muted" aria-label="예측 대 실제">
        {item.unavailableReason ?? "실제 관측이 없어 비교할 수 없습니다."}
      </section>
    );
  }
  return (
    <section className="flex flex-col rounded-lg border border-border bg-surface" aria-label="예측 대 실제">
      <h3 className="px-3 pb-1 pt-2.5 text-caption font-semibold text-foreground">예측 대 실제</h3>
      <table className="w-full text-body">
        <thead>
          <tr className="text-caption text-foreground-subtle">
            <th className="px-3 py-1 text-left font-normal" />
            <th className="px-3 py-1 text-right font-normal">예측</th>
            <th className="px-3 py-1 text-right font-normal">실제</th>
            <th className="px-3 py-1 text-right font-normal">차이</th>
          </tr>
        </thead>
        <tbody>
          {item.rows.map((row) => (
            <tr key={row.label} className="border-t border-border">
              <th scope="row" className="px-3 py-1.5 text-left font-normal text-foreground-muted">{row.label}</th>
              <td className="px-3 py-1.5 text-right font-mono text-foreground">{row.predicted}</td>
              <td className="px-3 py-1.5 text-right font-mono text-foreground">{row.actual}</td>
              <td className={cn("px-3 py-1.5 text-right font-mono font-semibold", DIRECTION_TONE[row.direction])}>
                {row.error ?? "비교 불가"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 pb-2.5 pt-1.5 text-caption text-foreground-subtle">
        차이는 실제에서 예측을 뺀 값입니다. 위험을 크게 본 쪽이 <span className="text-primary-text">과대</span>, 작게 본 쪽이 <span className="text-warning">과소</span>입니다.
      </p>
    </section>
  );
}

/** 영향 대상 적중 — 통제된 대상은 예측이 빗나간 것이 아니라 대응이 들어간 것이다 */
function TargetHits({ targets }: { targets: CaseTargetRow[] }) {
  if (targets.length === 0) return null;
  return (
    <section className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-3" aria-label="영향 대상 적중">
      <h3 className="text-caption font-semibold text-foreground">영향 대상</h3>
      <ul className="flex flex-col gap-1">
        {targets.map((t) => (
          <li key={t.id} className="flex items-baseline gap-2 text-caption">
            <span className="w-16 shrink-0 text-foreground-muted">{t.kind}</span>
            <span className="text-foreground-subtle">{t.predicted}</span>
            <Icon icon="mdi:arrow-right" className="size-3.5 shrink-0 self-center text-foreground-subtle" aria-hidden />
            <span className="text-foreground">{t.actual ?? "확인 못 함"}</span>
            <span className="min-w-0 flex-1 text-right">
              {t.byResponse ? (
                <span className="text-foreground-muted">대응으로 차단</span>
              ) : t.hit === null ? (
                <span className="text-foreground-subtle">—</span>
              ) : t.hit ? (
                <span className="text-success">적중</span>
              ) : (
                <span className="text-warning">어긋남</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 예측 범위 vs 실제 범위 — 숫자로는 "어디가" 달랐는지 안 보인다 */
function ExtentCompare({ item }: { item: PredictionCase }) {
  const container = useRef<HTMLDivElement>(null);
  const { map, ready } = useMapLibre(container, { pitch: 0 });
  const predicted = GEOMETRIES[item.predictedGeometryId] as Ring | undefined;
  const actual = item.actualGeometryId ? (GEOMETRIES[item.actualGeometryId] as Ring | undefined) : undefined;
  const predictedHa = areaHa(predicted);
  const actualHa = areaHa(actual);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    instance.scrollZoom.disable(); instance.dragRotate.disable(); instance.keyboard.disable();
    instance.resize();
    /* 예측 면을 먼저 깔고 실제 외곽선을 그 위에 올린다 — 겹치는 곳과 남는 곳이 같은 자리에서 읽힌다 */
    upsertPolygonLayer(instance, PREDICTED_SOURCE, predicted ?? null, {
      fill: cssColor("--color-primary-text", "#60a5fa"), line: cssColor("--color-primary-text", "#60a5fa"), opacity: 0.3,
    });
    upsertPolygonLayer(instance, ACTUAL_SOURCE, actual ?? null, {
      fill: cssColor("--color-foreground", "#e5e7eb"), line: cssColor("--color-foreground", "#e5e7eb"), opacity: 0.08,
    });
    const ring = predicted ?? actual;
    if (ring && ring.length > 0) {
      const bounds = ring.reduce((acc, p) => acc.extend(p), new maplibregl.LngLatBounds(ring[0], ring[0]));
      instance.fitBounds(bounds, { padding: 28, maxZoom: 16, duration: 0 });
    }
  }, [map, ready, predicted, actual]);

  return (
    <section className="flex min-h-64 flex-col overflow-hidden rounded-lg border border-border bg-surface" aria-label="예측 범위 vs 실제 범위">
      <h3 className="px-3 pb-1 pt-2.5 text-caption font-semibold text-foreground">예측 범위 vs 실제 범위</h3>
      <div className="relative min-h-56 flex-1">
        <div ref={container} className="h-full w-full" />
      </div>
      <ul className="flex flex-wrap items-center gap-3 px-3 py-2 text-caption">
        <li className="flex items-center gap-1.5 text-foreground-muted">
          <span className="size-2.5 rounded-sm" style={{ background: "var(--color-primary-text)", opacity: 0.6 }} aria-hidden />
          예측 범위 {predictedHa !== null && <span className="font-mono text-foreground">{predictedHa.toFixed(1)} ha</span>}
        </li>
        <li className="flex items-center gap-1.5 text-foreground-muted">
          <span className="size-2.5 rounded-sm border border-dashed" style={{ borderColor: "var(--color-foreground)" }} aria-hidden />
          실제 범위 {actualHa !== null ? <span className="font-mono text-foreground">{actualHa.toFixed(1)} ha</span> : <span className="text-foreground-subtle">미확정</span>}
        </li>
      </ul>
    </section>
  );
}

/* ── ③ 실제로 무엇을 했나 ── */
function ActualResponse({ item }: { item: PredictionCase }) {
  return (
    <section className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-3" aria-label="실제 대응">
      <h3 className="text-caption font-semibold text-foreground">실제 대응</h3>
      {item.actions.length === 0 ? (
        <p className="text-caption text-foreground-subtle">기록된 조치가 없습니다.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {item.actions.map((a, i) => (
            <li key={`${a.at}-${i}`} className="flex gap-2 text-caption">
              <span className="shrink-0 font-mono text-foreground-subtle">{formatClock(a.at)}</span>
              <span className="min-w-0 flex-1 break-keep leading-tight text-foreground">{a.text}</span>
            </li>
          ))}
        </ol>
      )}
      {item.alternatives.length > 0 && (
        <div className="mt-1 flex flex-col gap-0.5 border-t border-border pt-1.5">
          <p className="text-caption text-foreground-muted">같이 만들었던 대안 전망</p>
          {item.alternatives.map((alt) => (
            <p key={alt.label} className="flex gap-2 text-caption">
              <span className="w-16 shrink-0 text-foreground-subtle">{alt.label}</span>
              <span className="min-w-0 flex-1 break-keep leading-tight text-foreground-muted">{alt.headline}</span>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── ④ 다음에 무엇을 고칠까 ── */
function Improvements({ item }: { item: PredictionCase }) {
  return <ImprovementList incidentId={item.sourceIncidentId} verified={item.improvements} />;
}

/**
 * 학습 · 개선 항목 — 개선 항목은 **한 목록**이다(README §2.3). 예측 검증이 남긴 것(`검증`)과 모의훈련이 남긴 것(`훈련`)이
 * 같은 사건 아래 함께 선다. 훈련 것이 지난 훈련에만 남아 있으면 SOP·기준을 고치는 사람이 못 본다(2026-09-17).
 * ★ 케이스에 매달지 않는다. 지난 사건은 대부분 예측 케이스가 없는데(창원천·구항·산불·펌프장·폭염은 사전 작성 예측판이다)
 *   그때도 훈련이 남긴 항목은 사건 기록 창 ⑤에 서야 한다. 그래서 사건 ID 로 받고, 케이스는 검증 항목만 얹는다.
 */
export function ImprovementList({ incidentId, verified, hideWhenEmpty }: {
  incidentId: string;
  verified: PredictionCase["improvements"];
  /** 케이스 없는 사건 — 남긴 것이 없으면 절 자체를 세우지 않는다(빈 상자가 "기록이 없습니다" 옆에 또 선다) */
  hideWhenEmpty?: boolean;
}) {
  const { improvements } = useScenario();
  const trained = improvements.filter((x) => x.incidentId === incidentId && x.source === "훈련");
  const rows = [
    ...verified.map((imp) => ({ key: `v-${imp.text}`, area: imp.area, text: imp.text, source: "검증" as const, context: null as string | null })),
    ...trained.map((imp) => ({ key: imp.id, area: imp.axis, text: imp.text, source: "훈련" as const, context: imp.context })),
  ];
  if (hideWhenEmpty && rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-3" aria-label="학습 · 개선 항목">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="text-caption font-semibold text-foreground">학습 · 개선 항목</h3>
        <span className="shrink-0 text-caption text-foreground-subtle">검증 {verified.length} · 훈련 {trained.length}</span>
      </header>
      {rows.length === 0 ? (
        <p className="text-caption text-foreground-subtle">남긴 개선 항목이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((imp) => (
            <li key={imp.key} className="flex gap-2 text-caption">
              <Badge variant="outline" className="h-fit shrink-0 text-caption">{imp.area}</Badge>
              <span className="min-w-0 flex-1 break-keep leading-tight text-foreground">
                {imp.text}
                {imp.source === "훈련" && <span className="ml-1 text-foreground-subtle">· 훈련{imp.context ? ` · ${imp.context}` : ""}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 케이스가 없을 때 — 아직 끝난 사건이 없다는 뜻이다 */
export function PredictionCaseEmpty() {
  const [hint] = useState("사건이 종료되면 그 사건의 예측판이 케이스로 확정됩니다.");
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-16 text-center">
      <Icon icon="mdi:chart-timeline-variant" className="size-8 text-foreground-subtle" aria-hidden />
      <p className="text-body text-foreground-muted">확정된 예측 케이스가 없습니다.</p>
      <p className="text-caption text-foreground-subtle">{hint}</p>
    </div>
  );
}
