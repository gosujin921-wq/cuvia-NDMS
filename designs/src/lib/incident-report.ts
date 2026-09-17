/* ─────────────────────────────────────────────
 * 사건 보고서 — 원장에서 문서 한 벌을 엮는다 (IA §10.1 · 양식 정본 KISA 월간 운영 보고서 v0.5 · 2026-09-17)
 *
 * 원장의 REPORT_GENERATED 는 절 제목·본문 한 줄·근거 이벤트만 든다. 양식은 그 위에 요약 지표 타일과 절마다
 * 차트를 세운다(2026-09-17 사용자 "예시보다 부족함 · 그래프·다이어그램 활용"). 여기서 그 재료를 원장에서
 * 파생한다 — 관측 시계열 · 위험도 판단 · 예측판 대 실측 · 조치 · 전파 · 결과 기록 · 개선 항목.
 *
 * ★ 새 값을 만들지 않는다. 최대값·소요시간·건수처럼 원장 값을 세거나 고른 것뿐이고, 판정·점수는 없다.
 * ★ 절의 본문 한 줄(원장이 적은 말)은 그대로 표로 편다. 차트는 그 위에 서고, 구조가 있는 값(대상 적중·전파 결과·
 *   개선 항목)은 절을 따로 세운다 — 절이 사라지면 번호가 밀려 다른 판본과 대조가 안 된다.
 * ───────────────────────────────────────────── */

import type { Report as ReportDoc, ReportSection, ReportTable } from "../demo/report";
import type { ReportRecord } from "../model/records";
import type { ChartTone, ReportChart, ReportStat } from "../model/report-chart";
import type { HazardAssessment } from "../model/incident";
import type { ActionStatus } from "../model/response";
import type { RiskGrade } from "../model/risk-matrix";
import type { EventEnvelope } from "../model/event";
import {
  actionsAt, disseminationsAt, findEvent, findForecast, findIncident, forecastsOf, incidentViewAt,
  matrixSpecOf, observationSeriesAt, outcomesAt, predictionCasesAt, subjectLabelOf,
} from "../model/selectors";
import { formatClock, formatMinutes, formatStamp as stamp } from "../lib/datetime";

const GRADE_TONE: Record<RiskGrade, ChartTone> = { 관심: "neutral", 주의: "warning", 경계: "serious", 심각: "critical" };
const STATUS_TONE: Partial<Record<ActionStatus, ChartTone>> = { 성공: "good", 실패: "critical", 미응답: "critical", 진행중: "series-1", 확인대기: "warning", 대체됨: "neutral", 취소: "neutral", 대기: "neutral" };

const ms = (iso: string) => new Date(iso).getTime();
const minutesBetween = (from: string, to: string) => Math.round((ms(to) - ms(from)) / 60_000);

/** 축 눈금 자릿수 — 값의 크기에 맞춘다(2.48 m 는 둘째 자리, 27 cm · 18 mm/h 는 정수) */
const digitsFor = (max: number) => (max >= 10 ? 0 : 2);

/** 관측 단위 → 비교에 쓸 m 단위. 침수심 검증값(m)과 같은 눈금으로 맞춘다 */
function toMeters(value: number, unit: string): number | null {
  if (unit === "m") return value;
  if (unit === "cm") return value / 100;
  if (unit === "mm") return value / 1000;
  return null;
}

/** 원장 보고서 한 건 → 문서. `now` 는 이력이 넘긴 시계다(원장 끝까지 읽는다) */
export function incidentReportOf(rec: ReportRecord, now: Date): ReportDoc {
  const { report: r, incident: record } = rec;
  const id = record.incidentId;
  const incident = findIncident(id);
  const view = incidentViewAt(id, now);
  const events = view?.events ?? [];
  const assessments = events
    .filter((e) => e.eventType === "ASSESSMENT_UPDATED")
    .map((e) => ({ at: e.observedAt, a: e.payload as HazardAssessment }));
  const peak = [...assessments].sort((x, y) => y.a.matrix.score - x.a.matrix.score || ms(x.at) - ms(y.at))[0];
  const outcome = outcomesAt(id, now).at(-1);
  const verification = outcome?.verification.available ? outcome.verification : null;
  const actions = actionsAt(id, now);
  const disseminations = disseminationsAt(id, now);
  const results = disseminations.flatMap((d) => d.results);
  const cases = predictionCasesAt(id, now);
  const baseline = forecastsOf(id, now).find((f) => f.alternativeId === "baseline") ?? (verification ? findForecast(verification.forecastId) : undefined);

  /* 관측 계열 — 사건 범위의 계측기 중 관측이 쌓인 것만. 순서는 사건의 상관 키 순서 */
  const seriesOf = (incident?.correlationKeys ?? [])
    .map((key) => ({ key, points: observationSeriesAt(key, now) }))
    .filter((s) => s.points.length >= 3);

  /* ── 요약 지표 타일 ── */
  const firstDone = [...actions].filter((a) => a.status === "성공").sort((a, b) => ms(a.updatedAt) - ms(b.updatedAt))[0];
  const stats: ReportStat[] = [];
  if (peak) stats.push({ label: "최고 위험", value: `${peak.a.matrix.grade} ${peak.a.matrix.score.toFixed(2)}`, note: `${formatClock(peak.at)} 판단` });
  /* 출발점은 결과 기록의 첫 마일스톤이다 — 같은 문서의 경과 다이어그램과 같은 시각이어야 한다. 결과 기록이 없으면 첫 관측 */
  const onset = outcome?.milestones[0]?.at ?? view?.firstObservedAt;
  if (onset && firstDone) {
    stats.push({ label: `${outcome?.milestones[0]?.label ?? "최초 징후"} → 첫 조치 완료`, value: formatMinutes(minutesBetween(onset, firstDone.updatedAt)), note: `${formatClock(onset)} → ${formatClock(firstDone.updatedAt)}` });
  }
  if (verification) {
    const d = verification.observedDepthM - verification.predictedDepthM;
    stats.push({ label: "최대 침수심 예측 → 실측", value: `${verification.predictedDepthM.toFixed(2)} → ${verification.observedDepthM.toFixed(2)}`, unit: "m", note: `${verification.verdict} · ${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(2)} m` });
  }
  if (actions.length || results.length) {
    const done = actions.filter((a) => a.status === "성공").length;
    /* 채널 단위로 센다 — 확인대기 뒤 성공처럼 한 채널에 결과가 여럿이면 마지막 것이 그 채널의 결과다 */
    const lastByChannel = new Map(results.map((x) => [x.channel, x.status]));
    const ok = [...lastByChannel.values()].filter((st) => st === "성공").length;
    const failed = [...lastByChannel.values()].filter((st) => st === "실패" || st === "미응답").length;
    stats.push({ label: "조치 · 전파", value: `${done}/${actions.length}`, unit: "건 완료", note: `전파 ${ok}/${lastByChannel.size} 채널 성공${failed ? ` · 실패 ${failed} (대체)` : ""}` });
  }

  /* ── 절별 차트 ── */
  const milestones: ReportChart | null = outcome
    ? { kind: "milestones", items: [...outcome.milestones.map((m) => ({ label: m.label, at: m.at })), ...(record.closedAt ? [{ label: "종료", at: record.closedAt }] : [])] }
    : null;

  const series: ReportChart | null = seriesOf.length
    ? {
        kind: "series",
        panels: seriesOf.slice(0, 4).map((s) => ({
          title: subjectLabelOf(s.key),
          unit: s.points[0].unit,
          digits: digitsFor(Math.max(...s.points.map((p) => p.value))),
          points: s.points.map((p) => ({ at: p.at, value: p.value, quality: p.quality })),
        })),
        markers: verification ? [{ at: verification.observedArrivalAt, label: `침수 도달 ${formatClock(verification.observedArrivalAt)}` }] : [],
      }
    : null;

  const spec = peak ? matrixSpecOf(peak.a.matrix.ruleId) : undefined;
  const scoreTrend: ReportChart | null = assessments.length && spec
    ? {
        kind: "score-trend",
        points: assessments.map(({ at, a }) => ({ at, score: a.matrix.score, grade: a.matrix.grade, tone: GRADE_TONE[a.matrix.grade] })),
        thresholds: spec.gradeThresholds.map((t) => ({ grade: t.grade, minScore: t.minScore, tone: GRADE_TONE[t.grade] })),
      }
    : null;
  const meters: ReportChart | null = peak
    ? { kind: "meters", digits: 2, rows: peak.a.matrix.contributions.map((c) => ({ label: c.indicator, band: c.band, value: c.contribution, max: c.weight, degraded: c.degraded })) }
    : null;

  /* 예측 곡선 대 실측 — 검증이 견준 최대값과 같은 눈금을 가진 수위 계열이 실측이다 */
  let compare: ReportChart | null = null;
  if (verification && baseline) {
    const observed = seriesOf
      .map((s) => ({ ...s, m: s.points.map((p) => ({ at: p.at, value: toMeters(p.value, p.unit), quality: p.quality })) }))
      .find((s) => s.m.every((p) => p.value !== null) && Math.abs(Math.max(...s.m.map((p) => p.value!)) - verification.observedDepthM) < 0.005);
    if (observed) {
      const mark = baseline.marks.find((m) => Math.abs(m.maxDepthM - verification.predictedDepthM) < 0.005);
      /* 예측선은 검증한 눈금에서 끊는다. 그 뒤 눈금은 조치가 없을 때의 전망이라 검증 대상이 아니고,
         그리면 "예측 0.32"보다 높은 선이 같은 칸에 서서 검증 문장과 어긋난다 */
      const predicted = baseline.marks.filter((m) => !mark || ms(m.validAt) <= ms(mark.validAt));
      compare = {
        kind: "compare", unit: "m", digits: 2,
        series: [
          { label: "예측 침수심", tone: "series-1", points: predicted.map((m) => ({ at: m.validAt, value: m.maxDepthM })) },
          { label: subjectLabelOf(observed.key), tone: "series-2", points: observed.m.map((p) => ({ at: p.at, value: p.value!, quality: p.quality })) },
        ],
        verify: mark ? { at: mark.validAt, label: `${formatClock(mark.validAt)} 예측 ${verification.predictedDepthM.toFixed(2)} · 실측 ${verification.observedDepthM.toFixed(2)} m` } : undefined,
      };
    }
  }

  const assignedAt = new Map<string, string>();
  for (const e of events) if (e.eventType === "ACTION_ASSIGNED") assignedAt.set((e.payload as { actionId: string }).actionId, e.observedAt);
  const gantt: ReportChart | null = actions.length
    ? {
        kind: "gantt",
        rows: [...actions]
          .map((a) => ({ label: `${a.kind} · ${a.target}`, sub: a.organization, from: assignedAt.get(a.actionId) ?? a.updatedAt, to: a.updatedAt, status: a.status, tone: STATUS_TONE[a.status] ?? "neutral" }))
          .sort((x, y) => ms(x.from) - ms(y.from) || ms(x.to) - ms(y.to)),
      }
    : null;

  /* ── 절 — 원장의 절은 그대로, 차트는 제목으로 맞춰 얹는다 ── */
  const chartsFor = (title: string): ReportChart[] => {
    if (title.includes("개요")) return milestones ? [milestones] : [];
    if (title.includes("관측")) return series ? [series] : [];
    if (title.includes("위험")) return [scoreTrend, meters].filter((c) => c !== null);
    if (title.includes("예측")) return compare ? [compare] : [];
    if (title.includes("대응")) return gantt ? [gantt] : [];
    return [];
  };
  const noteFor = (title: string): string | undefined => {
    if (title.includes("관측")) return seriesOf.some((s) => s.points.some((p) => p.quality !== "정상")) ? "속이 빈 점은 지연·대체 관측값" : undefined;
    if (title.includes("위험") && peak) return `${formatClock(peak.at)} 판단 기준 · 트랙은 가중치, 채움은 기여도`;
    if (title.includes("대응") && actions.length) return "배정부터 완료까지";
    return undefined;
  };
  const evidenceOf = (ids: string[]) =>
    ids.map(findEvent).filter((e): e is EventEnvelope => Boolean(e)).map((e) => `${formatClock(e.observedAt)} ${e.summary}`);

  const sections: ReportSection[] = r.sections.map((s, i) => {
    const evidence = evidenceOf(s.evidenceEventIds);
    return {
      id: `s${i + 1}`,
      title: s.title,
      note: noteFor(s.title),
      rows: [],
      charts: chartsFor(s.title),
      table: { head: ["내용"], rows: s.body.split(" · ").map((line) => [line]) },
      footnote: evidence.length ? `근거 · ${evidence.join(" · ")}` : undefined,
    };
  });

  /* 구조가 있는 값은 절을 따로 세운다 */
  const c0 = cases[0];
  if (c0 && c0.targets.length && baseline) {
    const labelOf = new Map(baseline.targets.map((t) => [t.id, t.label]));
    const table: ReportTable = {
      head: ["대상", "구분", "예측", "실제", "판정"],
      widths: [undefined, "88px", "96px", "96px", "120px"],
      rows: c0.targets.map((t) => [
        labelOf.get(t.id) ?? t.id, t.kind, t.predicted, t.actual ?? "확인 못 함",
        t.hit === null ? "확인 못 함" : t.byResponse ? "대응으로 차단" : t.hit ? "적중" : "빗나감",
      ]),
    };
    sections.push({ id: "targets", title: "영향 대상 적중", note: "예측판의 대상별 노출 상태 대 실제", rows: [], table });
  }
  if (results.length) {
    const table: ReportTable = {
      head: ["채널", "결과", "시각", "내용"],
      widths: ["96px", "80px", "64px", undefined],
      rows: results.map((x) => [x.channel, x.status, formatClock(x.at), x.fallback ? `${x.detail} · 대체 ${x.fallback.channel}` : x.detail]),
    };
    sections.push({ id: "dissemination", title: "전파 결과", note: "채널별 결과 · 실패는 대체 채널로", rows: [], table });
  }
  if (outcome?.improvements.length) {
    const table: ReportTable = { head: ["축", "내용"], widths: ["72px", undefined], rows: outcome.improvements.map((x) => [x.area, x.text]) };
    sections.push({ id: "improvements", title: "개선 항목", note: "예측 검증에서 남긴 것 · 점수를 매기지 않는다", rows: [], table });
  }

  const closed = record.closedAt ? formatClock(record.closedAt) : "진행 중";
  return {
    title: rec.title,
    head: [
      { label: "사건", value: record.title },
      { label: "범위", value: record.scopeLabel },
      { label: "재난유형", value: record.hazardKind },
      { label: "기간", value: `${stamp(record.occurredAt)} ~ ${closed}` },
      { label: "상태", value: `${r.status} · ${r.version}판` },
    ],
    stats,
    sections,
    timeline: [],
    issuedAt: new Date(r.generatedAt),
  };
}
