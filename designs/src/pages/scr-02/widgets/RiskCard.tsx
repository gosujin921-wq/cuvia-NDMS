/* ─────────────────────────────────────────────
 * 위험도 판정 카드 — 03 화면정의서 §2 위험도 판정 · 04 §10
 *
 * 판단만 싣는다: 계측 단계 / 판단 근거 / 권고 대응(+사유) / 승인 대응등급.
 * 영향 분석(예상 수위·침수 범위)은 영향 분석 카드, 실행은 대응 절차 카드 몫이다(03 §2) —
 * 서로 다른 기능을 판정 카드 안에 섞지 않는다.
 *
 * 권고가 계측 단계와 같을 때는 단계명을 되풀이하지 않고 **"현 단계 유지"** 로 적고,
 * 사유(추가 영향 분석 필요)를 함께 단다. 진행 사건이 있으면 항상 서고, 승인 행은
 * 선제 권고가 서거나 승인이 있은 뒤에만 — 빈 `—` 자리 표시는 없다.
 *
 * 승인 버튼 라벨은 [대응등급 {권고}로 상향] — 무엇으로 올리는지가 버튼에 적혀 있어야
 * 승인이 눈감고 누르는 확인창이 되지 않는다(03 §2). 버튼은 집중 팝업에서만 온다(§0-9).
 * "예측"이라는 라벨을 쓰지 않는다 — 보이는 것은 조건 시나리오와 산출 근거다(04 §10).
 * ───────────────────────────────────────────── */

import { Button, cn } from "@ds";
import { Icon } from "@iconify/react";
import {
  DISPLACEMENT_THRESHOLD,
  RAIN_THRESHOLD,
  WATER_THRESHOLDS,
  levelSpec,
  type AlertLevel,
} from "../../../demo/levels";
import type { RiskAssessment } from "../../../demo/risk";
import type { AlertEvent } from "../../../demo/events";
import { formatClock } from "../../../lib/datetime";
import { useScenario } from "../../../state/ScenarioProvider";

interface RiskCardProps {
  event: AlertEvent;
  risk: RiskAssessment;
  /** 승인 대응등급 — 엔진이 든다. null = 승인 전 */
  approved: AlertLevel | null;
  /** [대응등급 {권고}로 상향] — 주인공 사건 + 선제 권고에서만 온다 */
  onApprove?: (level: AlertLevel) => void;
}

export function RiskCard({ event, risk, approved, onApprove }: RiskCardProps) {
  /* 승인 시각은 엔진이 든다 — 트랙마다 다르므로 화면이 리터럴로 들 수 없다 */
  const { approvedAt } = useScenario();
  const { measured, scenario, recommended, preemptive, basis } = risk;
  const measuredSpec = levelSpec(measured.level);
  const recommendedSpec = levelSpec(recommended);
  /* 승인이 필요한 자리 — 선제 권고인데 아직 승인 전 */
  const needsApproval = preemptive && !approved && onApprove;

  /* 계측 근거 — 현재 단계가 초과한 발령 기준값 (04 §3) */
  const base =
    event.type === "수위"
      ? WATER_THRESHOLDS[event.districtId]
      : event.type === "강우"
        ? RAIN_THRESHOLD
        : DISPLACEMENT_THRESHOLD;
  const exceeded = base?.[measured.level];

  return (
    <section className="flex flex-col px-3 py-2.5" aria-label="위험도 판정">
      <h2 className="text-body font-semibold text-foreground">위험도 판정</h2>

      <dl className="mt-1.5 flex flex-col">
        {/* 1층 — 계측 단계. 지금 값이 정한다 */}
        <Row label="계측 단계">
          <span className="font-medium" style={{ color: measuredSpec.color }}>
            {measuredSpec.label}
          </span>
          <span className="ml-auto font-mono text-foreground">
            {measured.value} {event.unit}
          </span>
          <span className="ml-2 shrink-0 font-mono text-foreground-subtle">
            {formatClock(measured.stageAt)}
          </span>
        </Row>

        {/* 2층 — 판단 근거. 시나리오가 생기면 산출 근거(04 §10), 그 전엔 계측 근거 */}
        <Row label="판단 근거">
          <span className="min-w-0 flex-1 text-foreground-muted">
            {basis ?? (
              <>
                {event.type} {measuredSpec.label} 기준
                {exceeded !== undefined && (
                  <>
                    (<span className="font-mono text-foreground">{exceeded}</span>)
                  </>
                )}{" "}
                초과
              </>
            )}
          </span>
        </Row>

        <div className="my-1.5 border-t border-border" aria-hidden />

        {/* 3층 — 권고 대응. 계측과 같으면 "현 단계 유지" — 단계명을 되풀이하지 않는다.
            사유 줄이 항상 따른다: 선제면 조건 시나리오, 아니면 다음 할 일(영향 분석) */}
        <Row label="권고 대응">
          {preemptive ? (
            <span className="font-medium" style={{ color: recommendedSpec.color }}>
              {recommendedSpec.label}
              <span className="ml-1.5 font-normal text-caption text-foreground-muted">
                · 선제 대응 권고
              </span>
            </span>
          ) : (
            <span className="font-medium text-foreground">현 단계 유지</span>
          )}
        </Row>
        <Row label="권고 사유">
          <span className="min-w-0 flex-1 text-foreground-muted">
            {scenario ? (
              <>
                {scenario.conditionLabel} <span className="font-mono text-foreground">{scenario.peak} EL.m</span>{" "}
                도달 예상 ({formatClock(new Date(scenario.peakAt))})
                {preemptive && (
                  <span className="ml-1 font-medium" style={{ color: recommendedSpec.color }}>
                    {/* 권고가 발령 기준표가 아니라 지역 영향에서 올라온 경우 그 근거를
                        적는다(04 §15-9). 봉암은 계측 대피 기준(5.83)에 닿지 않는데도
                        대피를 권고하므로, "기준 초과"라고만 적으면 거짓이 된다 */}
                    · {risk.impactBasis ?? `${recommendedSpec.label} 기준 초과`}
                  </span>
                )}
              </>
            ) : (
              "추가 영향 분석 필요"
            )}
          </span>
        </Row>

        {/* 4층 — 승인 대응등급. 확정은 담당자가 한다. 선제 권고가 서거나 승인이 있을
            때만 — 그 전의 "— (승인 전)"은 빈 자리 표시다(03 §위험도 판정) */}
        {(approved || preemptive) && (
          <Row label="승인 대응등급">
            {approved ? (
              <>
                <span className="font-medium" style={{ color: levelSpec(approved).color }}>
                  {levelSpec(approved).label}
                </span>
                {/* 승인 시각은 엔진이 든다 — 리터럴을 박으면 트랙마다 어긋난다 */}
                <span className="ml-1.5 text-caption text-foreground-muted">
                  {approvedAt ? ` · ${formatClock(approvedAt)}` : ""} · 상황실 담당
                </span>
              </>
            ) : (
              <span className="text-foreground-subtle">— (승인 전)</span>
            )}
          </Row>
        )}
      </dl>

      {needsApproval && (
        <Button
          size="sm"
          className={cn("mt-1.5 w-full")}
          onClick={() => onApprove(recommended)}
        >
          <Icon icon="mdi:arrow-up-bold-box-outline" className="size-4" aria-hidden />
          대응등급 {recommendedSpec.label}로 상향
        </Button>
      )}
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
