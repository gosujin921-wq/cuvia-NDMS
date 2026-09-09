/* ─────────────────────────────────────────────
 * 재난상황 보고서 — 사건 하나를 문서 한 장으로 세운다
 *
 * ★ **별도 보고서 원장을 만들지 않는다.** 타임라인(demo/timeline.ts)과 같은 원칙이다 —
 *   앞 절들이 이미 든 기록에서 파생 계산한다. 사건 원장 · 계측 · 위험도 판정 · 침수영향 ·
 *   SOP 결과 · 전파 원장 · 시나리오 상태가 재료고, 이 파일은 그것을 문서 순서로 엮을 뿐이다.
 *   같은 사건을 두 원장이 말하면 반드시 갈라진다.
 *
 * 항목 구성은 참고자료 두 곳에서 왔다:
 *   지오멕스 발표자료 p11 `관제사항 요약 보고서` — 발생일시 · 발생장소 · 관측상황 ·
 *     추정상황 · 위험상황 · 필요조치사항 · 특이사항 7항목
 *   KISA SCR-7100 보고서 생성
 *
 * ★ 시나리오 시계로 자른다. 아직 일어나지 않은 승인·실행·대체 조치는 절 자체가 비고,
 *   비었다는 것을 화면이 말한다. 사건이 끝나기 전에 보고서를 열면 그때까지의 문서가 나온다.
 * ───────────────────────────────────────────── */

import { assessRisk } from "./risk";
import { eventTimelineAt, type TimelineContext, type TimelineEntry } from "./timeline";
import { eventViewAt, hazardLabel, type AlertEvent } from "./events";
import { findDistrict } from "./districts";
import { levelSpec, WATER_THRESHOLDS } from "./levels";
import { devicesOf, deviceKindSpec, type Device } from "./devices";
import { latestValue } from "./measurements";
import { floodImpactAt } from "./flood-impact";
import { sopItemsFor, sopResultsFor, HERO_CONFIRMED_AT } from "./sop";
import { CHANNELS, type DispatchRecord } from "./dispatch";

/** 문서의 한 절 — 화면은 이 배열을 순서대로 찍는다 */
export interface ReportSection {
  id: string;
  title: string;
  /** 이름표 있는 값들. 없으면 비운다 */
  rows: { label: string; value: string }[];
  /** 줄글 한 문단. 없으면 비운다 */
  note?: string;
  /** 아직 일어나지 않아 비어 있는 절 */
  pending?: boolean;
}

export interface Report {
  title: string;
  /** 문서 머리 — 사건 식별 */
  head: { label: string; value: string }[];
  sections: ReportSection[];
  timeline: TimelineEntry[];
  /** 이 보고서를 뽑은 시각 */
  issuedAt: Date;
}

function clock(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function hhmm(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 장비별 현재값 한 줄 — "서항 수위계 3.41 EL.m (경보 기준 3.35 초과)" */
function deviceLine(device: Device, now: Date, districtId: string): string {
  const sample = latestValue(device, now);
  const spec = deviceKindSpec(device.kind);
  const t = WATER_THRESHOLDS[districtId];
  let over = "";
  if (t && device.kind === "WL") {
    if (sample.value >= t.evacuate) over = ` (대피 기준 ${t.evacuate} 초과)`;
    else if (sample.value >= t.warning) over = ` (경보 기준 ${t.warning} 초과)`;
    else if (sample.value >= t.advisory) over = ` (주의보 기준 ${t.advisory} 초과)`;
  }
  return `${spec.label} ${sample.value}${spec.unit ?? ""}${over}`;
}

/**
 * 사건 하나의 보고서. 재료는 전부 앞 절의 기록이고 상태는 ctx 가 나른다.
 */
export function reportOf(event: AlertEvent, ctx: TimelineContext): Report {
  const { now, dispatches, approvedResponseLevel, approvedAt, sopExecutedItemIds } = ctx;
  const district = findDistrict(event.districtId);
  const view = eventViewAt(event, now);
  const risk = assessRisk(event, now);
  const placeName = district?.name ?? event.districtId;
  const hazard = hazardLabel(event.hazardType);

  /* ── 머리 ─────────────────────────────────────── */
  const head = [
    { label: "발생일시", value: clock(new Date(event.raisedAt)) },
    { label: "발생장소", value: `${placeName} · ${district?.target ?? ""}`.trim() },
    { label: "재난유형", value: hazard },
    { label: "계측 단계", value: levelSpec(view.level).label },
    {
      label: "승인 대응등급",
      value: approvedResponseLevel ? levelSpec(approvedResponseLevel).label : "미승인",
    },
  ];

  const sections: ReportSection[] = [];

  /* ── 1. 관측상황 ───────────────────────────────── */
  /* 재는 장비만 든다 — 단위가 있는 종류가 곧 계측 장비다(수위·강우·변위·조위).
     CCTV·마을방송은 단위가 없다. 종류 이름을 나열해 거르면 종류가 늘 때 여기가 뒤처진다 */
  const devices = devicesOf(event.districtId).filter((d) => deviceKindSpec(d.kind).unit);
  sections.push({
    id: "observed",
    title: "관측상황",
    rows: devices.map((d) => ({ label: d.name, value: deviceLine(d, now, event.districtId) })),
    note: `최초 확인 ${hhmm(HERO_CONFIRMED_AT)}. 이후 계측이 ${levelSpec(view.level).label} 구간에 들었다.`,
  });

  /* ── 2. 판단근거 ───────────────────────────────── */
  const judge: { label: string; value: string }[] = [
    { label: "계측 단계", value: `${levelSpec(risk.measured.level).label} (${risk.measured.value}${event.unit})` },
  ];
  if (risk.scenario && risk.scenarioLevel) {
    judge.push({
      label: "조건 시나리오",
      value: `${risk.scenario.conditionLabel} 도달 시 ${risk.scenario.peak} EL.m · ${levelSpec(risk.scenarioLevel).label} 구간`,
    });
  }
  judge.push({
    label: "권고 대응수준",
    value: `${levelSpec(risk.recommended).label}${risk.preemptive ? " (선제 대응 권고)" : ""}`,
  });
  if (approvedResponseLevel && approvedAt) {
    judge.push({
      label: "확정",
      value: `${hhmm(approvedAt)} 담당자 승인 · ${levelSpec(approvedResponseLevel).label}`,
    });
  }
  sections.push({
    id: "judge",
    title: "판단근거",
    rows: judge,
    note: risk.basis ?? risk.impactBasis ?? undefined,
  });

  /* ── 3. 영향 ──────────────────────────────────── */
  const peak = risk.scenario?.peak ?? risk.measured.value;
  const impact = floodImpactAt(event.districtId, peak);
  sections.push({
    id: "impact",
    title: "영향 범위",
    rows: impact
      ? [
          { label: "기준 수위", value: `${peak} EL.m` },
          { label: "영향 범위", value: `${impact.areaHa} ha` },
          { label: "영향 건물", value: `${impact.buildings} 동` },
          { label: "통제 도로", value: `${impact.roadM} m` },
          { label: "대피 대상", value: `${impact.evacuees} 명` },
        ]
      : [],
    pending: !impact,
    note: impact ? undefined : "이 지구·유형의 침수영향표가 아직 등재되지 않았다.",
  });

  /* ── 4. 조치사항 ───────────────────────────────── */
  const level = approvedResponseLevel ?? risk.recommended;
  const items = sopItemsFor(level, event.hazardType);
  const results = sopResultsFor(event.hazardType);
  const executed = sopExecutedItemIds ?? [];
  const actionRows = items.map((item) => {
    const done = executed.includes(item.id);
    const result = results.find((r) => r.itemId === item.id);
    const state = !done
      ? "미실행"
      : result
        ? result.ok
          ? "완료"
          : "실패"
        : "완료";
    return { label: `${item.label} (${item.target})`, value: state };
  });
  sections.push({
    id: "action",
    title: "조치사항",
    rows: actionRows,
    pending: executed.length === 0,
    note: executed.length === 0 ? "SOP 가 아직 실행되지 않았다." : undefined,
  });

  /* ── 5. 전파 ──────────────────────────────────── */
  const sent = dispatches.filter((d) => d.eventId === event.id);
  sections.push({
    id: "dispatch",
    title: "주민 전파",
    rows: sent.map((d: DispatchRecord) => ({
      label: hhmm(new Date(d.sentAt)),
      value: `${levelSpec(d.responseLevel).label} · ${CHANNELS.filter((c) => d.channels.includes(c.id))
        .map((c) => c.label)
        .join(" · ")} · ${d.recipients}명`,
    })),
    pending: sent.length === 0,
    note: sent.length === 0 ? "전파 내역이 없다." : undefined,
  });

  /* ── 6. 특이사항 ───────────────────────────────── */
  const timeline = eventTimelineAt(event, ctx);
  const odd = timeline.filter((e) => e.kind === "fail" || e.kind === "fallback");
  sections.push({
    id: "note",
    title: "특이사항",
    rows: odd.map((e) => ({ label: hhmm(e.at), value: `${e.label}${e.detail ? ` · ${e.detail}` : ""}` })),
    pending: odd.length === 0,
    note: odd.length === 0 ? "특이사항 없음." : undefined,
  });

  return {
    title: `${placeName} ${hazard} 상황보고서`,
    head,
    sections,
    timeline,
    issuedAt: now,
  };
}
