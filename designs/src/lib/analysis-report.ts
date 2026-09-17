/* ─────────────────────────────────────────────
 * 모의훈련 분석 보고서 — 저장된 분석 결과 한 건에서 문서 한 장 (03 §26.10 · 2026-09-16)
 *
 * 담당자가 처음부터 쓰는 문서가 아니다. 저장된 분석 결과가 그대로 절이 된다. 절 순서는 화면을 읽는 순서와 같다 —
 * 무슨 사건의 어느 시점을 · 그때 어땠고 · 기준(그대로 두면 / 실제 재현)은 어땠고 · 무엇을 바꿨고 · 그래서 무엇이 달라졌나.
 * 상황과 대응을 함께 바꾼 분석은 효과 표가 세 칸이다(기준 → 상황 → 상황+대응).
 *   1 사건 개요 · 2 분석 기준 · 3 당시 관측·기상·시설 상태 · 4 기준 · 5 바꾼 조건과 설정값 · 6 기준 대비 효과 · 7 지도 결과 · 8 분석 의견
 * 종료 사건의 효과는 기준 재현과 대안을 같은 방식으로 계산한 차이다. 실제 기록은 4절의 참고값으로만 적는다.
 *
 * ★ 사건 보고서(demo/report.ts reportOf)와 같은 `Report` 모양이다. 화면(scr-07)과 모달이 문서 렌더러 한 벌로 둘을 다 찍는다.
 * ★ 여기서 숫자를 만들지 않는다. 저장 시점에 굳은 값을 절로 옮길 뿐이다.
 * ───────────────────────────────────────────── */

import type { Report, ReportSection } from "../demo/report";
import type { AnalysisResult } from "../model/whatif";
import { formatClock } from "./datetime";

/** 바꾼 조건 한 줄 — "강우 악화 + 방류 조정 10분 일찍" · "상황 · 강우 악화" · "방류 조정 · 10분 일찍" */
export function analysisConditionText(a: AnalysisResult): string {
  const r = a.response ? `${a.response.label} · ${a.response.presetLabel}` : null;
  return a.situation && r ? `${a.situation.label} + ${r}` : a.situation ? `상황 · ${a.situation.label}` : r ?? "";
}

export function analysisReportOf(a: AnalysisResult): Report {
  const closed = a.incidentStatus === "종료";
  const sections: ReportSection[] = [
    {
      id: "incident", title: "사건 개요",
      rows: [
        { label: "사건", value: a.incidentTitle },
        { label: "재난 유형", value: a.hazardName },
        { label: "지역", value: a.regionLabel },
        { label: "상태", value: a.incidentStatus },
      ],
    },
    {
      id: "basis", title: "분석 기준",
      note: closed ? "종료 사건 · 원장의 판단 시점" : "진행 중 사건 · 분석한 시각",
      rows: [{ label: "분석 기준", value: `${formatClock(a.basisAt)} · ${a.basisLabel}` }],
    },
    a.stateRows.length > 0
      ? { id: "state", title: "당시 관측·기상·시설 상태", rows: a.stateRows }
      : { id: "state", title: "당시 관측·기상·시설 상태", rows: [], footnote: "이 시점에 복원한 상태 값이 없습니다.", pending: true },
    {
      id: "baseline", title: closed ? "기준 재현" : "기준 예측",
      note: closed ? "실제 대응을 넣어 같은 방식으로 다시 계산" : "추가 대응 없이 지금 상태 유지",
      rows: [
        { label: "보던 시각", value: formatClock(a.validAt) },
        ...a.baselineRows,
        ...(closed && a.actualResponses ? a.actualResponses.map((r) => ({ label: `실제 대응 ${formatClock(r.at)}`, value: r.label })) : []),
        ...(closed && a.observed ? a.observed.map((o) => ({ label: `실제 기록 · ${o.label}`, value: `${o.value} (참고)` })) : []),
      ],
      footnote: a.arrivalText,
    },
    {
      id: "response", title: a.kind === "상황" ? "바꾼 상황 조건" : a.kind === "대응" ? "바꾼 대응 조건과 설정값" : "바꾼 상황과 대응",
      note: a.response?.effect,
      rows: [
        ...(a.situation
          ? [
              { label: "상황", value: a.situation.label },
              { label: "내용", value: a.situation.detail },
              { label: "상황 산출", value: a.situation.method },
            ]
          : []),
        ...(a.response
          ? [
              { label: "대응", value: a.response.label },
              { label: "선택", value: `${a.response.presetLabel} · ${formatClock(a.response.at)} (${a.response.anchor} 기준)` },
              { label: "대상", value: a.response.level ? `${a.response.target} · ${a.response.level}` : a.response.target },
              { label: "대응 산출", value: a.response.method },
            ]
          : []),
      ],
    },
    {
      id: "effect", title: "기준 대비 효과",
      rows: [],
      /* 기준과 대안은 나란히 놓아야 읽힌다 — 달라진 지표만 */
      table: a.midLabel
        ? {
            head: ["지표", a.baseLabel, a.midLabel, a.altLabel],
            rows: a.compareRows.map((r) => [r.label, r.base, r.mid ?? "-", r.alt]),
            align: ["left", "right", "right", "right"],
            widths: [undefined, "112px", "112px", "112px"],
          }
        : {
            head: ["지표", a.baseLabel, a.altLabel],
            rows: a.compareRows.map((r) => [r.label, r.base, r.alt]),
            align: ["left", "right", "right"],
            widths: [undefined, "132px", "132px"],
          },
      footnote: `${a.headline}${a.unchanged.length ? ` · 그대로: ${a.unchanged.join(" · ")}` : ""}${closed ? " · 차이는 기준 재현과 대안을 같은 방식으로 계산한 차이" : ""}${a.midLabel ? " · 세 칸은 한 칸씩 한 가지만 다르다" : ""}`,
    },
    /* 7 개선 항목 — 훈련이 남긴 것. 없으면 없다고 적는다(03 §26.10) */
    (a.improvements ?? []).length > 0
      ? {
          id: "improve", title: "개선 항목",
          rows: [],
          table: {
            head: ["축", "내용"],
            rows: (a.improvements ?? []).map((x) => [x.axis, x.text]),
            align: ["left", "left"],
            widths: ["72px", undefined],
          },
          footnote: "승인 뒤에만 SOP·기준에 반영한다. 모델 축은 예측 검증에서만 나온다",
        }
      : { id: "improve", title: "개선 항목", rows: [], footnote: "이 분석에서 남긴 개선 항목이 없습니다.", pending: true },
    a.mapImage
      ? { id: "map", title: "지도 결과", rows: [], figure: { src: a.mapImage, alt: `${a.regionLabel} ${a.name} 지도`, caption: `${a.altLabel} · ${formatClock(a.validAt)} · 저장 시점 화면` } }
      : { id: "map", title: "지도 결과", rows: [], footnote: "저장 시점 지도를 남기지 못했습니다.", pending: true },
    a.memo
      ? { id: "memo", title: "분석 의견", rows: [], footnote: a.memo }
      : { id: "memo", title: "분석 의견", rows: [], footnote: "저장 시 작성한 메모가 없습니다.", pending: true },
  ];

  return {
    /* 문서 제목은 분석명 그대로다. 문서 종류는 머리 윗줄이 말한다 */
    title: a.name,
    /* 식별 블록 — 1절과 겹치지 않는 비교 축만 */
    head: [
      { label: "분석 기준", value: formatClock(a.basisAt) },
      { label: "보던 시각", value: formatClock(a.validAt) },
      { label: "바꾼 조건", value: analysisConditionText(a) },
      { label: "기준", value: closed ? "기준 재현(실제 대응)" : "기준 예측(그대로 두면)" },
    ],
    sections,
    /* 대안 분석에는 대응 경과가 없다 — 대안은 일어난 일이 아니라 가정이다 */
    timeline: [],
    issuedAt: new Date(),
  };
}
