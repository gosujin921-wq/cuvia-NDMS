/* ─────────────────────────────────────────────
 * 영향 분석 — 03 화면정의서 §2 판단·대응 · 04 §12
 *
 * 세 상태로 산다: **자동 추정 → 상세 분석 필요 → 검토 완료**.
 *
 * ★ 검토 완료는 시나리오 스텝이 아니라 **트윈이 남긴 검토 기록**에서 온다
 *   (state/analysis-results.ts · 02 §2). 트윈을 열었다는 사실이 아니라 대표 전망을 검토
 *   했다는 사실이 상태를 바꿔야, 화면이 말하는 "검토 완료"가 실제로 검토한 것과 같아진다.
 *   기록이 붙으면 검토자·검토 시각·전망 시각을 함께 세운다 — 나중에 "누가 무엇을 보고
 *   등급을 올렸나"를 묻는 자리가 SCR-04 이고, 그 답의 출처가 이 한 줄이다.
 * 트윈을 열기 전에도 시스템이 현재 계측(조건 시나리오가 생기면 그 조건 수위)으로
 * 즉시 추정한다 — 분석이 외부 화면에 종속되면 SCR-02 의 초동 대응이 막힌다.
 * 디지털트윈은 분석의 시작 버튼이 아니라 "정확히 어디가 영향을 받는가"를 지도에서
 * 확인하는 상세 검토 도구다(03 §2).
 *
 * 추정치는 04 §12 침수 영향 표의 보간(flood-impact)이라 트윈과 같은 원천이다 —
 * 자동 추정과 검토 완료의 숫자가 갈라질 수 없다. 검토 완료는 상세 행(해안도로·
 * 물양장 진입로)까지 펴고, 그 전에는 요약(침수 범위·대피 대상)까지만 편다.
 * ───────────────────────────────────────────── */

import { Button } from "@ds";
import { Icon } from "@iconify/react";
import { impactAt } from "../../../demo/analysis";
import { floodImpactAt } from "../../../demo/flood-impact";
import { drainageOf } from "../../../demo/drainage";
import type { TideScenario } from "../../../demo/forecast";
import { formatClock } from "../../../lib/datetime";
import { useAnalysisReview } from "../../../state/analysis-results";

interface ImpactPanelProps {
  districtId: string;
  /** 현재 계측값(EL.m) — 시나리오가 없을 때 자동 추정의 기준. 수위 사건이 아니면 null */
  measuredLevel: number | null;
  /** 만조 조건 시나리오 — 격상(17:22) 뒤 주인공 사건에만 있다 */
  scenario: TideScenario | null;
  /** 이 사건의 id — 트윈 검토 기록을 찾는 열쇠 */
  eventId: string | null;
  onOpenTwin: () => void;
}

export function ImpactPanel({
  districtId,
  measuredLevel,
  scenario,
  eventId,
  onOpenTwin,
}: ImpactPanelProps) {
  /* 트윈이 남긴 검토 기록 — 없으면 아직 검토 전이다 */
  const review = useAnalysisReview(eventId ?? undefined);
  const analyzed = review !== null;
  /* 추정 기준 수위 — 조건 시나리오가 서면 그 조건, 아니면 지금 계측값 */
  const basisLevel = scenario?.peak ?? measuredLevel;
  const row = basisLevel !== null ? floodImpactAt(districtId, basisLevel) : null;
  /* 통제 도로의 이름·단서는 지구가 정한다(04 §12 · §15-8) — 같은 표를 읽되 내륙과
     해안이 다른 말을 쓴다. impactAt 이 그 분기를 이미 든다 */
  const impact = row ? impactAt(districtId, "폭풍해일", basisLevel!) : null;
  const inland = drainageOf(districtId) !== null;

  return (
    <section className="flex flex-col gap-1.5 p-3" aria-label="영향 분석">
      {/* 상태 뱃지(자동 추정 · 상세 분석 필요 · 검토 완료)를 두지 않는다 — 같은 말을
          본문이 이미 한다. 검토 전에는 하단 `자동 추정` 한 줄이, 검토 뒤에는 검토 근거
          줄(누가 · 언제 · 무엇을 보고)이 선다. 뱃지는 그 위에 한 겹 더 얹은 요약이라
          카드 머리에서 눈을 먼저 끌고는 아무것도 더 말해 주지 않았다 */}
      <h2 className="text-body font-semibold text-foreground">영향 분석</h2>

      {impact ? (
        <dl className="flex flex-col">
          <Row label={scenario ? "조건 수위" : "기준 수위"}>
            <span className="min-w-0 flex-1 text-foreground-muted">
              {scenario ? (
                <>
                  {scenario.conditionLabel} <span className="font-mono text-foreground">{scenario.peak} EL.m</span>{" "}
                  도달 예상 ({formatClock(new Date(scenario.peakAt))})
                </>
              ) : (
                <>
                  현재 수위 <span className="font-mono text-foreground">{basisLevel} EL.m</span>
                </>
              )}
            </span>
          </Row>
          <Row label="침수 범위">
            <span className="text-foreground-muted">
              저지대 <span className="font-mono text-foreground">{impact.areaHa} ha</span> · 건물{" "}
              <span className="font-mono text-foreground">{impact.buildings}동</span>
            </span>
          </Row>
          {/* 상세 행 — 어디가 얼마나: 트윈에서 지도로 확인한 뒤에만 편다.
              도로 이름은 지구가 정한다 — 내륙 배수구역에 해안도로가 서면 안 되고,
              전 구간 통제 문구도 영향표가 든 notes 를 그대로 쓴다(04 §12 · §15-8) */}
          {analyzed && (
            <Row label={inland ? "저지대 도로" : "해안도로"}>
              <span className="text-foreground-muted">
                <span className="font-mono text-foreground">{impact.roadM} m</span> 침수
                {impact.notes.length > 0 && ` · ${impact.notes[0]}`}
              </span>
            </Row>
          )}
          <Row label="대피 대상">
            {impact.evacuees > 0 ? (
              <span className="font-mono text-foreground">{impact.evacuees}명</span>
            ) : (
              <span className="text-foreground-subtle">대피 기준 도달 전</span>
            )}
          </Row>
        </dl>
      ) : (
        <p className="text-caption text-foreground-muted">
          등재된 침수 영향 자료가 없습니다 — 디지털트윈에서 확인합니다
        </p>
      )}

      {/* 자동 추정임을 밝힌다 — 판독처럼 팔지 않는다(04 §2-5 와 같은 원칙) */}
      {impact && !analyzed && (
        <p className="text-caption text-foreground-subtle">계측·침수 영향 자료 기반 자동 추정</p>
      )}

      {/* 검토 근거 — 누가 언제 무엇을 보고 검토했나. 트윈이 사건에 남기는 것은 값이 아니라
          이 한 줄이고(02 §2), 뒤따르는 [대응등급 상향] 승인의 근거가 된다 */}
      {review && (
        <p className="flex items-start gap-1 text-caption text-foreground-subtle">
          <Icon icon="mdi:cube-scan" className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            <span className="font-mono">{formatClock(review.scenarioAt)}</span>{" "}
            {review.scenarioLabel} 전망 검토 · {formatClock(review.reviewedAt)} {review.reviewer}
          </span>
        </p>
      )}

      {/* 버튼 이름은 **가는 곳**을 말한다. `상세 분석`은 여기서 분석이 시작되는 것처럼
          읽히는데, 추정은 이 카드가 이미 끝냈고 트윈이 하는 일은 그 결과를 지도에서
          눈으로 확인하는 것이다(03 §2) */}
      <Button variant="outline" size="sm" className="w-full" onClick={onOpenTwin}>
        <Icon icon="mdi:cube-scan" className="size-4" aria-hidden />
        {analyzed ? "디지털트윈으로 다시 확인하기" : "디지털트윈으로 확인하기"}
      </Button>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 py-0.5 text-caption">
      <dt className="w-[72px] shrink-0 text-foreground-subtle">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-baseline">{children}</dd>
    </div>
  );
}
