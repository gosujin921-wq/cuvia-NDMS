/* ─────────────────────────────────────────────
 * 훈련 보고서 — 저장된 훈련 한 회에서 문서 한 장 (03 §26.9 · 2026-09-17)
 *
 * 종이는 사건 보고서·분석 보고서와 같은 한 벌(`ReportDocument`)이다. 절만 훈련이 읽히는 순서로 짠다.
 *   1 훈련 개요   무슨 사건을 어떤 조건으로, 누가 언제
 *   2 훈련 구조   정지점 넷 · 무엇을 결정하는 자리였나
 *   3 내 조치     언제 무엇을 했나 · 발동에서 조치까지 · 실제와의 차이
 *   4 결과        같은 조건에서 실제와 같게 했을 때 ↔ 내 조치
 *   5 마친 시점 상태
 *   6 지도 결과   저장 시점 화면
 *   7 개선 항목   훈련이 남긴 것
 *
 * ★ v1 분석 보고서(9절)를 그대로 옮기지 않았다. `분석 기준`·`바꾼 조건과 설정값`·`분석 의견`은
 *   대안 분석의 개념이라 훈련에 자리가 없다. 훈련이 답하는 것은 "내가 한 조치가 무엇을 바꿨나" 하나다.
 * ★ **여기서 숫자를 만들지 않는다.** 저장 시점에 굳은 값을 절로 옮길 뿐이다 —
 *   시나리오를 고치거나 모델을 바꿔도 지난 보고서가 소급해서 달라지지 않는다.
 * ★ 규정 준수는 **양호·지연으로 판정하지 않는다**(목표 시간의 근거가 없다 · 03 §26.7).
 *   걸린 시간과 실제와의 차이만 적고 판단은 읽는 사람이 한다.
 * ───────────────────────────────────────────── */

import type { Report, ReportSection } from "../demo/report";
import type { TrainingRun } from "../model/whatif";
import { formatClock } from "./datetime";
import { formatLagMinutes } from "./forecast-twin";

/** 그 회에서 내가 실제로 실행한 규정만 — 목록·보고서가 같은 규칙을 읽는다(두 벌이 되면 수가 갈린다) */
export const myActionsOf = (run: TrainingRun) => run.sopRows.filter((s) => s.mineAt);

/** 목록 칸에 쓰는 한 줄 — "S2 14:35 · S3 14:55" · 안 했으면 빈 문자열 */
export const myActionsText = (run: TrainingRun): string =>
  myActionsOf(run).map((s) => `${s.id} ${formatClock(s.mineAt as string)}`).join(" · ");

/** 발동에서 조치까지 한 줄 — 실제와 견준다. 양호·지연으로 판정하지 않는다 */
const lagText = (s: TrainingRun["sopRows"][number]): string => {
  const real = s.realLagMin === null ? "원장 없음" : `실제 ${formatLagMinutes(s.realLagMin)}`;
  return s.mineLagMin === null ? `안 함 · 실제와 같게(${real})` : `${formatLagMinutes(s.mineLagMin)} · ${real}`;
};

export function trainingReportOf(run: TrainingRun): Report {
  const acted = myActionsOf(run);
  const sections: ReportSection[] = [
    {
      id: "overview", title: "훈련 개요",
      rows: [
        { label: "사건", value: run.incidentTitle },
        { label: "훈련 조건", value: run.conditionLabel },
        { label: "훈련자", value: run.author },
        /* 훈련한 날짜와 사건 시각은 다른 시간축이다. 한 줄에 섞으면 "02:18 ~ 02:18" 같은
           읽을 수 없는 값이 된다 — 사건 쪽 시각은 2절 훈련 구조가 든다(2026-09-17) */
        { label: "훈련 일시", value: stamp(run.finishedAt) },
        { label: "사건 구간", value: run.stops.length > 0 ? `${formatClock(run.stops[0].at)} ~ ${formatClock(run.stops[run.stops.length - 1].at)}` : "-" },
      ],
    },
    {
      id: "structure", title: "훈련 구조",
      note: `정지점 ${run.stops.length} · 발동 규정 ${run.sopRows.length}건`,
      rows: [],
      table: {
        head: ["시각", "국면", "그 자리에서 결정할 것"],
        rows: run.stops.map((s) => [formatClock(s.at), s.phase, s.note]),
        widths: ["64px", "64px", undefined],
      },
      footnote: "판단 국면에서 조치를 정하고, 결과 국면에서는 조치 창이 닫히고 결과가 나온다",
    },
    {
      id: "actions", title: "내 조치",
      note: acted.length > 0 ? `${acted.length}건 실행` : "실행한 조치 없음",
      rows: [],
      /* 판단 이유는 하나라도 적혔을 때만 칸을 세운다 — 빈 칸 열은 표를 넓히기만 한다 */
      table: run.sopRows.some((s) => s.reason)
        ? {
            head: ["규정", "발동", "내 조치", "발동에서 조치까지", "판단 이유"],
            rows: run.sopRows.map((s) => [`${s.id} ${s.label}`, formatClock(s.firedAt), s.mineAt ? formatClock(s.mineAt) : "안 함", lagText(s), s.reason ?? ""]),
            widths: [undefined, "56px", "60px", "130px", "170px"],
          }
        : {
            head: ["규정", "발동", "내 조치", "발동에서 조치까지"],
            rows: run.sopRows.map((s) => [`${s.id} ${s.label}`, formatClock(s.firedAt), s.mineAt ? formatClock(s.mineAt) : "안 함", lagText(s)]),
            widths: [undefined, "60px", "68px", "150px"],
          },
      footnote: acted.length === 0
        ? "아무 조치도 실행하지 않아 실제와 같은 훈련이 되었다. 안 한 조치는 실제와 같은 시각에 한 것으로 본다"
        : "목표 시간의 근거가 없어 양호·지연으로 판정하지 않는다. 안 한 조치는 실제와 같은 시각에 한 것으로 본다",
    },
    {
      id: "effect", title: "결과",
      note: `둘 다 ${run.conditionLabel}`,
      rows: [],
      /* 조건은 같고 조치만 다르다 — 그래야 차이의 원인을 조치라고 말할 수 있다(03 §26.7) */
      table: {
        head: ["지표", "실제와 같게", "내 훈련"],
        rows: run.rows.map((r) => [r.label, r.base, r.mine]),
        align: ["left", "right", "right"],
        widths: [undefined, "132px", "132px"],
      },
      footnote: run.headline,
    },
    run.stateRows.length > 0
      ? { id: "state", title: "마친 시점 상태", note: formatClock(run.stops[run.stops.length - 1]?.at ?? run.finishedAt), rows: run.stateRows }
      : { id: "state", title: "마친 시점 상태", rows: [], footnote: "저장 시점 상태 값을 남기지 못했습니다.", pending: true },
    run.mapImage
      ? {
          id: "map", title: "지도 결과", rows: [],
          figure: {
            src: run.mapImage,
            alt: `${run.incidentTitle} 훈련 결과 지도`,
            caption: `${run.conditionLabel} · ${acted.length > 0 ? myActionsText(run) : "조치 없음"} · 저장 시점 화면`,
          },
        }
      : { id: "map", title: "지도 결과", rows: [], footnote: "저장 시점 지도를 남기지 못했습니다.", pending: true },
    (run.improvements ?? []).length > 0
      ? {
          id: "improve", title: "개선 항목",
          rows: [],
          table: {
            head: ["축", "내용"],
            rows: (run.improvements ?? []).map((x) => [x.axis, x.text]),
            widths: ["72px", undefined],
          },
          footnote: "승인 뒤에만 SOP·기준에 반영한다. 모델 축은 예측 검증에서만 나온다",
        }
      : { id: "improve", title: "개선 항목", rows: [], footnote: "이 훈련에서 남긴 개선 항목이 없습니다.", pending: true },
  ];

  return {
    title: `${run.incidentTitle} 모의훈련`,
    /* 식별 블록 — 1절과 겹치지 않는 축만 */
    head: [
      { label: "회차", value: run.runId },
      { label: "조건", value: run.conditionLabel },
      { label: "내 조치", value: acted.length > 0 ? myActionsText(run) : "없음 · 실제와 같게" },
      { label: "기준", value: "같은 조건에서 실제와 같게 했을 때" },
    ],
    sections,
    /* 훈련에는 대응 경과 원장이 없다 — 일어난 일이 아니라 돌려 본 것이다 */
    timeline: [],
    issuedAt: new Date(run.finishedAt),
  };
}

const stamp = (iso: string): string => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
