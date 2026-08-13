/* ─────────────────────────────────────────────
 * 관제 팝업 이벤트 정보 탭 — KISA 관제 팝업 이식분
 *
 * 원본: cuvia_platform_web `kits/event-kit/src/control-popup/event-info-tab.tsx`
 *
 * 원본의 라벨·값 행(`Row`) 문법을 그대로 옮겼다 — 24px 라벨 열 + 밑줄, 값은 본문 크기,
 * 식별자·시각·수치는 mono. **소비처가 채운 것만 렌더**하는 규칙도 그대로다: KISA 전용
 * 값(구역 담당자 · Re-ID · 공간 중요도 · 경로 CCTV)은 DSMS 에 대응물이 없어 행 자체가 없다.
 *
 * 원본 맨 위의 `AI 상황요약` 블록 자리를 **위험도 판정**이 받는다. 계측 단계 · 판단 근거 ·
 * 권고 · 승인 등급과 [대응등급 {권고}로 상향] 버튼이 값 나열보다 먼저 읽혀야 하는 것은
 * 같은 이유이고, 판정 렌더는 레일과 같은 `RiskCard` 하나가 든다 — 두 벌로 만들면
 * 승인 순간 두 자리가 갈린다(CLAUDE.md 상태 엔진).
 * ───────────────────────────────────────────── */

import { cn } from "@ds";
import type { District } from "../../../demo/districts";
import { hazardLabel, type AlertEvent, type EventView } from "../../../demo/events";
import { levelSpec, type AlertLevel } from "../../../demo/levels";
import type { RiskAssessment } from "../../../demo/risk";
import type { ProcessState } from "../../../demo/sop";
import { formatDateTime, formatElapsed } from "../../../lib/datetime";
import { RiskCard } from "../widgets/RiskCard";

interface EventInfoTabProps {
  event: AlertEvent;
  view: EventView;
  district: District;
  risk: RiskAssessment;
  approved: AlertLevel | null;
  processState: ProcessState;
  /** 같은 시각 진행 중인 다른 사건 id — 영상 영역 카드 줄과 같은 목록이다 */
  relatedIds: string[];
  /** 시나리오 시계 — 경과시간 산출 기준 */
  now: Date;
}

export function EventInfoTab({
  event,
  view,
  district,
  risk,
  approved,
  processState,
  relatedIds,
  now,
}: EventInfoTabProps) {
  return (
    <>
      {/* 위험도 판정 — 원본의 상황 요약 블록 자리. 판정을 보이기만 하고 승인은
          SOP 탭의 [승인 · 실행]이 든다(KISA · SK 기준) */}
      <section className="mb-3 overflow-hidden rounded-md border border-border bg-surface-raised/60">
        <RiskCard event={event} risk={risk} approved={approved} />
      </section>

      <dl className="flex flex-col">
        <Row label="이벤트 ID" mono>
          {event.id}
        </Row>
        <Row label="발생시각" mono>
          {formatDateTime(event.raisedAt)}
        </Row>
        <Row label="경과시간" mono>
          {formatElapsed(event.raisedAt, now)}
        </Row>
        <Row label="재난유형">{hazardLabel(event.hazardType)}</Row>
        <Row label="계측 항목">{event.type}</Row>
        <Row label="현재 계측">
          <span className="flex items-center gap-1.5">
            <span className="font-medium" style={{ color: levelSpec(view.level).color }}>
              {levelSpec(view.level).label}
            </span>
            <span className="font-mono">
              {view.value} {event.unit}
            </span>
            {/* 발생 이후 단계가 움직인 사건만 격상 시각을 단다 */}
            {view.escalated && (
              <span className="font-mono text-caption text-foreground-muted">
                {formatDateTime(view.stageAt)} 격상
              </span>
            )}
          </span>
        </Row>
        <Row label="위치">
          {district.name} · {district.kind} 지구
        </Row>
        <Row label="관측 대상">{district.target}</Row>
        <Row label="탐지 장비">{event.device}</Row>
        <Row label="처리 상태">{processState}</Row>
        {/* 대응 담당자는 승인이 정한다 — 승인 전에는 지어내지 않는다 */}
        <Row label="대응 담당자">
          <span className={cn(!approved && "text-foreground-muted")}>
            {approved ? "상황실 담당" : "미지정"}
          </span>
        </Row>
        {/* 원본의 `관련 이벤트`(묶음) 자리 — DSMS 에는 묶는 조작이 없어 같은 시각
            진행 중인 사건을 그대로 나열한다. 영상 영역 카드 줄과 같은 목록이다 */}
        <Row label="동시 진행 사건" mono>
          {relatedIds.length === 0 ? (
            <span className="font-sans text-foreground-muted">-</span>
          ) : (
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              {relatedIds.map((id) => (
                <span key={id}>{id}</span>
              ))}
            </span>
          )}
        </Row>
      </dl>
    </>
  );
}

function Row({
  label,
  mono,
  children,
}: {
  label: string;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border/60 py-2 last:border-b-0">
      <dt className="w-24 shrink-0 text-caption text-foreground-muted">{label}</dt>
      <dd className={cn("min-w-0 flex-1 text-body text-foreground", mono && "font-mono")}>
        {children}
      </dd>
    </div>
  );
}
