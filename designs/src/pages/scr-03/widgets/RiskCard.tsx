/* ─────────────────────────────────────────────
 * 위험도 판정 카드 — 03 화면정의서 §3 우측 1 · 04 §10
 *
 * 네 층을 위아래로 놓는다: 계측 단계 / 만조 조건 시나리오 / 권고 대응수준 / 승인 대응등급.
 * 계측과 시나리오가 나란히 서고 그 아래 권고·승인이 나오는 배치라야
 * "둘을 보고 시스템이 권하고 사람이 정했다"가 읽힌다.
 *
 * 승인 버튼 라벨은 [대응등급 {권고}로 상향] — 무엇으로 올리는지가 버튼에 적혀 있어야
 * 승인이 눈감고 누르는 확인창이 되지 않는다(03 §3).
 *
 * "예측"이라는 라벨을 쓰지 않는다. 이 카드가 보이는 것은 조건 시나리오와 산출 근거다(04 §10).
 * ───────────────────────────────────────────── */

import { Button, cn } from "@ds";
import { Icon } from "@iconify/react";
import { levelSpec, type AlertLevel } from "../../../demo/levels";
import type { RiskAssessment } from "../../../demo/risk";
import type { AlertEvent } from "../../../demo/events";
import { formatClock } from "../../../lib/datetime";

interface RiskCardProps {
  event: AlertEvent;
  risk: RiskAssessment;
  /** 승인 대응등급 — 엔진이 든다. null = 승인 전 */
  approved: AlertLevel | null;
  /** [대응등급 {권고}로 상향] — 주인공 사건 + 선제 권고에서만 온다 */
  onApprove?: (level: AlertLevel) => void;
}

export function RiskCard({ event, risk, approved, onApprove }: RiskCardProps) {
  const { measured, scenario, recommended, preemptive, basis } = risk;
  const measuredSpec = levelSpec(measured.level);
  const recommendedSpec = levelSpec(recommended);
  /* 승인이 필요한 자리 — 선제 권고인데 아직 승인 전 */
  const needsApproval = preemptive && !approved && onApprove;

  return (
    <section className="flex flex-col p-3" aria-label="위험도 판정">
      <h2 className="text-body font-semibold text-foreground">위험도 판정</h2>

      <dl className="mt-2 flex flex-col">
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

        {/* 2층 — 만조 조건 시나리오. 격상(17:22) 후 주인공 사건에만 있다 */}
        {scenario ? (
          <Row label="만조 조건 시나리오">
            <span className="min-w-0 flex-1 text-foreground-muted">
              <span className="font-mono text-foreground">{scenario.peak} EL.m</span> 도달 예상 ·{" "}
              {formatClock(scenario.peakAt)} 만조
              {preemptive && (
                <span className="ml-1 font-medium" style={{ color: recommendedSpec.color }}>
                  · {recommendedSpec.label} 기준 초과
                </span>
              )}
            </span>
          </Row>
        ) : (
          <Row label="만조 조건 시나리오">
            <span className="text-foreground-subtle">—</span>
          </Row>
        )}

        <div className="my-1.5 border-t border-border" aria-hidden />

        {/* 3층 — 권고 대응수준. 계측과 시나리오 중 높은 쪽을 시스템이 권고한다 */}
        <Row label="권고 대응수준">
          <span className="font-medium" style={{ color: recommendedSpec.color }}>
            {recommendedSpec.label}
          </span>
          {preemptive && (
            <span className="ml-1.5 text-caption text-foreground-muted">· 선제 대응 권고</span>
          )}
        </Row>

        {/* 4층 — 승인 대응등급. 확정은 담당자가 한다 */}
        <Row label="승인 대응등급">
          {approved ? (
            <>
              <span className="font-medium" style={{ color: levelSpec(approved).color }}>
                {levelSpec(approved).label}
              </span>
              <span className="ml-1.5 text-caption text-foreground-muted">
                · 17:37 · 상황실 담당
              </span>
            </>
          ) : (
            <span className="text-foreground-subtle">— (승인 전)</span>
          )}
        </Row>
      </dl>

      {/* 근거 한 줄 — 근거 없는 권고는 블랙박스고, 담당자는 블랙박스를 승인하지 않는다 */}
      {basis && (
        <p className="mt-1.5 border-t border-border pt-1.5 text-caption text-foreground-subtle">
          근거 <span className="text-foreground-muted">{basis}</span>
        </p>
      )}

      {needsApproval && (
        <Button
          size="sm"
          className={cn("mt-2 w-full")}
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
      <dt className="w-[104px] shrink-0 text-foreground-subtle">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-baseline">{children}</dd>
    </div>
  );
}
