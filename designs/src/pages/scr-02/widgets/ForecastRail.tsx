/* ─────────────────────────────────────────────
 * 예측 탭 우측 레일 (IA-03 · 02 D4 · 04 W3 · 03 §25, 2026-09-16 정리)
 * 화면 이름은 "예측"이다(2026-09-17 "전망"에서 바꿈). 시각·장소·수심이 정해진 값이고, 근거 줄·범례가 이미 "예측"이라 한 이름으로 맞췄다.
 * 화면 문구 전체를 같이 바꿨다. 예측판은 "예측", 날씨 흐름은 "예보", 문장 끝은 "…할 것으로 예측"이다.
 *
 * 이 탭이 답하는 질문은 "그대로 두면 언제 · 어디가 · 얼마나 위험해지나" 하나다(기준 전망). 대안을 나란히 세우지 않는다 —
 * "대응을 바꾸면?"은 디지털트윈이 답한다. 그래서 맨 위는 그대로 두면 카드(최대값 · 도달 · 영향 대상)이고, 그 끝에서
 * [디지털트윈에서 열기]로 넘긴다. 트윈은 이 사건의 기록·전망을 시간으로 훑고 필요하면 대안을 본다. 트윈의 기준은 이 전망과 같은 예측판이다.
 * 그 아래 고른 시각 한 줄, 근거 한 줄, 버튼 둘. 시각은 지도 하단 시간축 슬라이더가 고른다(디지털트윈과 같은 부품 · 2026-09-17).
 * 눈금 사이 값은 판단에 쓰지 않는다(IA §8). 예측판이 유효하지 않으면 다른 것으로 바꾸지 않고 목록에서 다시 고른다(IA §5.2).
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Button, GlassPanel, Notice, cn } from "@ds";
import type { Forecast, ForecastMark, ImpactTarget } from "../../../model/forecast";
import { ALTERNATIVE_LABEL } from "../../../model/forecast";
import type { resolveForecast } from "../../../model/selectors";
import { formatClock } from "../../../lib/datetime";
import { formatMarkMetric, markMetricLabel } from "../../../lib/forecast-twin";

const KIND_LABEL: Record<ImpactTarget["kind"], string> = { 도로: "도로", 중요시설: "중요시설", 건물: "건물", 대상자: "이용자" };
const KIND_ORDER: ImpactTarget["kind"][] = ["도로", "중요시설", "건물", "대상자"];
const EXPOSURE_TONE: Record<ImpactTarget["exposure"], string> = {
  "영향 없음": "text-foreground-subtle",
  통제됨: "text-success",
  "대피 권고": "text-success",
  노출: "text-warning",
  "부분 중단": "text-danger",
  중단: "text-danger",
};

export function ForecastRail({ resolution, forecast, mark, repick, onBack, onReview, onRepick, onCompare }: {
  resolution: ReturnType<typeof resolveForecast> | null;
  forecast: Forecast | null;
  mark: ForecastMark | null;
  /** 전망이 무효일 때 다시 고를 목록 — 이 사건의 현재 예측판 */
  repick: Forecast[];
  onBack: () => void;
  onReview: () => void;
  onRepick: (forecastId: string) => void;
  /** 디지털트윈에서 대응 비교 — 이 사건의 대응 분석이 준비되지 않았으면 null */
  onCompare: (() => void) | null;
}) {
  if (!forecast || !mark) {
    const reason = !resolution ? "예측판을 고르지 않았습니다." : resolution.kind === "not-found" ? "존재하지 않는 예측판입니다." : resolution.kind === "expired" ? `유효 종료 ${formatClock(resolution.forecast.validUntil)}가 지난 예측판입니다.` : "이 시각에는 아직 생성되지 않은 예측판입니다.";
    return (
      <GlassPanel className="pointer-events-auto flex flex-col gap-3 p-3">
        <Notice variant="warning" title="이 예측은 지금 쓸 수 없습니다" description={`${reason} 다른 예측으로 바꾸지 않습니다. 아래에서 다시 고르세요.`} />
        <ul className="flex flex-col gap-1.5">
          {repick.map((f) => (
            <li key={f.forecastId}>
              <Button size="sm" variant="secondary" className="w-full justify-start" onClick={() => onRepick(f.forecastId)}>
                {ALTERNATIVE_LABEL[f.alternativeId]} · {formatClock(f.basis.baseTime)} 기준 · ~{formatClock(f.validUntil)}
              </Button>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="ghost" onClick={onBack}>판단으로</Button>
      </GlassPanel>
    );
  }

  const peak = forecast.marks.reduce((best, m) => (m.maxDepthM > best.maxDepthM ? m : best), forecast.marks[0]);
  const reaches = forecast.targets.some((t) => t.arrivalAt);
  const targets = [...forecast.targets].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  const b = forecast.basis;
  const basisLine = `${formatClock(b.baseTime)} 기준 · ${b.assumptions.join(", ")} · 불확실성 ${b.uncertainty.grade}`;
  const basisTip = [`${b.modelName} ${b.modelVersion}`, `생성 ${formatClock(b.generatedAt)}`, `입력 데이터 ${b.inputQuality}`, b.uncertainty.sensitiveTo.length ? `민감 · ${b.uncertainty.sensitiveTo.join(" · ")}` : ""].filter(Boolean).join("\n");

  return (
    <>
      {/* 브라우저 높이에 맞춘다 — 표·시간축·고른 시각은 이 묶음 안에서 스크롤하고 버튼은 바닥 고정 (2026-09-15) */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
      {/* 그대로 두면 — 최대값 · 도달 · 영향 대상. 이 탭의 답은 여기서 끝나고, 대응을 바꾸는 질문은 트윈으로 넘긴다 */}
      <GlassPanel className="pointer-events-auto shrink-0 p-3">
        <header className="flex items-baseline justify-between gap-2">
          <h2 className="text-body font-semibold text-foreground">그대로 두면</h2>
          <span className="text-caption text-foreground-subtle">{formatClock(b.baseTime)} 기준 · 유효 ~{formatClock(forecast.validUntil)}</span>
        </header>
        <dl className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded bg-surface/60 px-2.5 py-1.5">
            <dt className="text-caption text-foreground-muted">{markMetricLabel(peak)} 최대</dt>
            <dd className="flex items-baseline gap-1.5">
              <span className="font-mono text-body font-semibold text-foreground">{formatMarkMetric(peak)}</span>
              <span className="font-mono text-caption text-foreground-subtle">{formatClock(peak.validAt)}</span>
            </dd>
          </div>
          <div className="rounded bg-surface/60 px-2.5 py-1.5">
            <dt className="text-caption text-foreground-muted">도달 예상</dt>
            <dd className={cn("font-mono text-body font-semibold", reaches ? "text-warning" : "text-foreground-muted")}>{reaches ? formatClock(forecast.arrivalAt) : "없음"}</dd>
          </div>
        </dl>
        {targets.length > 0 && (
          <ul className="mt-2 flex flex-col text-caption" aria-label="영향 대상">
            {targets.map((t, i) => (
              <li key={t.id} className={cn("grid grid-cols-[52px_1fr_auto] items-baseline gap-x-2 py-1", i < targets.length - 1 && "border-b border-border/60")}>
                <span className="text-foreground-muted">{KIND_LABEL[t.kind]}</span>
                <span className="min-w-0 truncate text-foreground" title={t.label}>{t.label}</span>
                <span className="flex items-baseline gap-1.5">
                  {t.arrivalAt && <span className="font-mono text-foreground-muted">{formatClock(t.arrivalAt)}</span>}
                  <span className={cn("font-medium", EXPOSURE_TONE[t.exposure])}>{t.exposure}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1.5 break-keep text-caption text-foreground-muted">{peak.impactSummary}</p>
        {/* 다음 질문 — 대응을 바꾸면? 트윈이 같은 예측판을 기준으로 받는다 */}
        <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
          <p className="min-w-0 flex-1 break-keep text-caption text-foreground-muted">
            {onCompare ? "사건 진행을 훑고, 조건을 바꾸면 무엇이 달라지나" : "이 사건은 디지털트윈 분석이 아직 준비되지 않았습니다"}
          </p>
          <Button size="sm" variant="secondary" className="shrink-0" onClick={onCompare ?? undefined} disabled={!onCompare}>
            <Icon icon="mdi:compare-horizontal" className="size-4" aria-hidden />
            디지털트윈에서 열기
          </Button>
        </div>
      </GlassPanel>

      {/* 고른 시각 — 지도가 그리고 있는 그 장면 한 줄 */}
      <GlassPanel className="pointer-events-auto shrink-0 px-3 py-2.5">
        <p className="text-caption text-foreground"><span className="font-mono font-medium">{formatClock(mark.validAt)}</span> · {markMetricLabel(mark)} {formatMarkMetric(mark)} · {mark.impactSummary}</p>
        {/* 근거는 접어 둔다 — 툴팁은 마우스가 없으면 못 읽는다. 열면 가정·불확실성과 자료별 수신 시각(데이터 최신성) */}
        <details className="group mt-1">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-caption text-foreground-subtle [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 flex-1 truncate">{basisLine}</span>
            <Icon icon="mdi:chevron-right" className="size-3.5 shrink-0 transition-transform group-open:rotate-90" aria-hidden />
          </summary>
          <div className="mt-1 flex flex-col gap-0.5 border-t border-border pt-1 text-caption text-foreground-muted">
            <p>{basisTip.split("\n").join(" · ")}</p>
            {(b.inputs ?? []).map((i) => (
              <p key={`${i.label}-${i.at}`} className="flex justify-between gap-2">
                <span>{i.label}</span>
                <span className="font-mono text-foreground-subtle">{formatClock(i.at)} {i.kind === "예보" ? "갱신" : "수신"}</span>
              </p>
            ))}
          </div>
        </details>
      </GlassPanel>
      </div>

      <GlassPanel className="pointer-events-auto flex shrink-0 gap-2 p-2">
        <Button variant="ghost" size="sm" className="flex-1" onClick={onBack}>판단으로</Button>
        <Button size="sm" className="flex-1" onClick={onReview}>이 예측으로 조치안 갱신</Button>
      </GlassPanel>
    </>
  );
}
