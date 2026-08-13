/* ─────────────────────────────────────────────
 * 영향 분석 — 03 화면정의서 §2 판단·대응 · 04 §12
 *
 * 세 상태로 산다: **자동 추정 → 상세 분석 필요 → 검토 완료**.
 * 트윈을 열기 전에도 시스템이 현재 계측(조건 시나리오가 생기면 그 조건 수위)으로
 * 즉시 추정한다 — 분석이 외부 화면에 종속되면 SCR-02 의 초동 대응이 막힌다.
 * 디지털트윈은 분석의 시작 버튼이 아니라 "정확히 어디가 영향을 받는가"를 지도에서
 * 확인하는 상세 검토 도구다(03 §2).
 *
 * 추정치는 04 §12 침수 영향 표의 보간(flood-impact)이라 트윈과 같은 원천이다 —
 * 자동 추정과 검토 완료의 숫자가 갈라질 수 없다. 검토 완료는 상세 행(해안도로·
 * 물양장 진입로)까지 펴고, 그 전에는 요약(침수 범위·대피 대상)까지만 편다.
 * ───────────────────────────────────────────── */

import { Button, cn } from "@ds";
import { Icon } from "@iconify/react";
import { impactAt } from "../../../demo/analysis";
import { floodImpactAt } from "../../../demo/flood-impact";
import { drainageOf } from "../../../demo/drainage";
import type { TideScenario } from "../../../demo/forecast";
import { formatClock } from "../../../lib/datetime";

interface ImpactPanelProps {
  districtId: string;
  /** 현재 계측값(EL.m) — 시나리오가 없을 때 자동 추정의 기준. 수위 사건이 아니면 null */
  measuredLevel: number | null;
  /** 만조 조건 시나리오 — 격상(17:22) 뒤 주인공 사건에만 있다 */
  scenario: TideScenario | null;
  /** 트윈을 다녀왔는가(S5~) — 엔진 스텝에서 파생 */
  analyzed: boolean;
  onOpenTwin: () => void;
}

export function ImpactPanel({
  districtId,
  measuredLevel,
  scenario,
  analyzed,
  onOpenTwin,
}: ImpactPanelProps) {
  /* 추정 기준 수위 — 조건 시나리오가 서면 그 조건, 아니면 지금 계측값 */
  const basisLevel = scenario?.peak ?? measuredLevel;
  const row = basisLevel !== null ? floodImpactAt(districtId, basisLevel) : null;
  /* 통제 도로의 이름·단서는 지구가 정한다(04 §12 · §15-8) — 같은 표를 읽되 내륙과
     해안이 다른 말을 쓴다. impactAt 이 그 분기를 이미 든다 */
  const impact = row ? impactAt(districtId, "폭풍해일", basisLevel!) : null;
  const inland = drainageOf(districtId) !== null;
  const status = analyzed ? "검토 완료" : scenario ? "상세 분석 필요" : "자동 추정";

  return (
    <section className="flex flex-col gap-1.5 p-3" aria-label="영향 분석">
      <header className="flex items-center gap-2">
        <h2 className="text-body font-semibold text-foreground">영향 분석</h2>
        <span
          className={cn(
            "ml-auto shrink-0 rounded-full border px-2 py-0.5 text-caption",
            analyzed
              ? "border-success font-medium text-success"
              : scenario
                ? "border-risk-lv4 font-medium text-risk-lv4"
                : "border-border text-foreground-muted",
          )}
        >
          {status}
        </span>
      </header>

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

      <Button variant="outline" size="sm" className="w-full" onClick={onOpenTwin}>
        <Icon icon="mdi:cube-scan" className="size-4" aria-hidden />
        {analyzed ? "상세 결과 다시 보기" : "디지털트윈으로 상세 분석"}
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
