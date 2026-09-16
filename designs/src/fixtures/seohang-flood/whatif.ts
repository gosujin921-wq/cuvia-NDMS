/* ─────────────────────────────────────────────
 * 서항 복합침수 — 디지털트윈 준비물 (03 §26 · 진행 중 사건)
 *
 * 진행 중 사건은 시간축이 셋으로 갈린다 — 지금 이전은 기록(관측 재현), 지금, 지금 이후는 기준 전망(17:10 기준 · 17:13 생성).
 * 사건 진행(record)은 원장의 주요 사건을 한 줄씩 적은 것이고 지금까지만 보인다.
 *
 * 대안 분석은 필요할 때만 연다. 분석 기준은 지금이다(진행 중 사건은 옮기지 않는다).
 *   대응 조건   배수 대응(현상 감소 · 사전 계산 판) · 도로 통제(노출 감소 · 규칙). 시작 시점은 지금 기준 즉시 17:40 · 10분 뒤 17:50 · 20분 뒤 18:00
 *   상황 조건   강우 악화 · 예보 대비 +20% (예보 상위 시나리오 · 사전 계산 판)
 *   함께       강우 악화 판 위에 대응 선택지를 얹은 조합 판(RAIN120_COMBOS) — "비가 더 오면 지금 대응으로 버티나"
 * 이 준비물은 기준 전망을 확인한 시각(d4 17:36)부터 열린다. 그 전에는 사건 목록에 서지 않는다.
 * ───────────────────────────────────────────── */

import type { WhatIfCase, WhatIfResponse } from "../../model/whatif";
import { INCIDENT, INCIDENT_ID, t } from "./incident";
import {
  FORECAST_BASE, FORECAST_BASE_ID, FORECAST_SH_RECORD_ID, RAIN120_COMBOS,
  WHATIF_DRAIN_D10_ID, WHATIF_DRAIN_D20_ID, WHATIF_DRAIN_NOW_ID, WHATIF_RAIN120_ID, WHATIF_ROAD_D10_ID, WHATIF_ROAD_D20_ID, WHATIF_ROAD_NOW_ID,
} from "./forecasts";

/** 시작 시점 옆에 함께 읽는 사건 시각 — 해안도로 침수 예상 */
const ARRIVAL = { label: "침수 예상", at: FORECAST_BASE.arrivalAt };
const presets = (now: string, d10: string, d20: string): WhatIfResponse["presets"] => [
  { id: "now", label: "즉시", at: t("17:40"), forecastId: now },
  { id: "d10", label: "10분 뒤", at: t("17:50"), forecastId: d10 },
  { id: "d20", label: "20분 뒤", at: t("18:00"), forecastId: d20 },
];

export const SEOHANG_WHATIF: WhatIfCase = {
  incidentId: INCIDENT_ID,
  title: "서항 복합침수",
  hazardKind: INCIDENT.hazardKind,
  twinFamily: INCIDENT.twinFamily,
  scope: INCIDENT.scope,
  legacyDistrictId: INCIDENT.legacyDistrictId,
  occurredAt: t("17:14"),
  availableFrom: t("17:36"),
  record: [
    { at: t("16:40"), label: "호우경보 변경 · 창원시", kind: "관측" },
    { at: t("17:05"), label: "펌프 2호기 정지 · 가용 2/3", kind: "관측" },
    { at: t("17:10"), label: "10분간 관로수위 64 cm 상승", kind: "관측" },
    { at: t("17:13"), label: "침수예측판 생성 · 해안도로 17:52 도달", kind: "예측", decision: true },
    { at: t("17:14"), label: "복합 징후 알림 · 사건 후보", kind: "관측" },
    { at: t("17:24"), label: "영상 판독 · 차로 일부 침수 추정", kind: "관측" },
    { at: t("17:30"), label: "사건 대응 시작 · 자동 조치", kind: "대응" },
    { at: t("17:33"), label: "위험도 판단 갱신 · 경계", kind: "관측" },
    { at: t("17:47"), label: "대응안 승인 · 도로 통제 배정", kind: "대응" },
    { at: t("17:52"), label: "해안도로 저지대 침수", kind: "영향" },
    { at: t("18:06"), label: "해안도로 통제 완료", kind: "대응" },
    { at: t("18:08"), label: "지하차도 진입 통제 · 대피 권고", kind: "대응" },
    { at: t("18:15"), label: "실측 최대 침수 0.27 m", kind: "영향" },
    { at: t("18:36"), label: "펌프 2호기 재가동", kind: "대응" },
  ],
  reconstructionForecastId: FORECAST_SH_RECORD_ID,
  forecastId: FORECAST_BASE_ID,
  responses: [
    {
      responseId: "drainage", kind: "현상", target: "제2배수펌프장 2호기", level: "재가동 · 가용 3/3 · 저류시설 추가 유입", adjust: "when",
      anchor: ARRIVAL,
      presets: presets(WHATIF_DRAIN_NOW_ID, WHATIF_DRAIN_D10_ID, WHATIF_DRAIN_D20_ID),
      method: "사전 계산 · 재가동 시각별 침수 판",
    },
    {
      responseId: "road-control", kind: "노출", target: "해안도로 저지대 구간", level: "양방향 통제 · 우회 안내", adjust: "when",
      anchor: ARRIVAL,
      presets: presets(WHATIF_ROAD_NOW_ID, WHATIF_ROAD_D10_ID, WHATIF_ROAD_D20_ID),
      method: "사전 계산 · 통제 시각별 판. 결과는 통제 완료와 침수 도달 사이의 여유로 읽는다",
    },
  ],
  situations: [
    { situationId: "rain-plus20", label: "강우 악화", detail: "예보 대비 +20% · 19시 최대 17.8 → 21.4 mm/h", forecastId: WHATIF_RAIN120_ID, method: "사전 계산 · 예보 상위 시나리오" },
  ],
  combos: RAIN120_COMBOS.map((c) => ({ situationForecastId: WHATIF_RAIN120_ID, responseId: c.responseId, presetId: c.presetId, forecastId: c.forecast.forecastId })),
};
