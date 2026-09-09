/* ─────────────────────────────────────────────
 * SCR-07 재난상황 보고서 — 흐름이 문서로 끝나는 자리
 *
 * 시연 흐름은 S8 통계에서 "판단이 맞았나"를 확인하고 멈춰 있었다. 이 화면이 그 결론을
 * **문서 한 장으로 남긴다.** pptx 8단계의 7번(자동 기록)과 특장점 ⑥(자동 보고서)의 실물이다.
 *
 * ★ 담당자가 쓰는 화면이 아니다. 이미 있는 기록에서 **자동으로 엮인 것**을 보여준다.
 *   그것이 경쟁사와 갈리는 자리다 — 자료 속 경쟁사 보고서는 사람이 항목을 채운다
 *   (지오멕스 복합재난 p9 피해사례 등록 · 엑셀 업로드). 우리는 사건을 고르면 문서가 선다.
 *
 * ★ 문서 내용은 여기서 만들지 않는다. demo/report.ts 의 reportOf(사건, 상태) 하나가
 *   정적 기록과 시나리오 상태를 엮고, 이 화면은 그 결과를 순서대로 찍기만 한다.
 *   화면이 값을 만들면 같은 사건이 화면마다 다른 보고서를 갖는다.
 *
 * 들어오는 길은 둘이다:
 *   SCR-04 통계 [보고서 생성]   시연이 밟는 길. 그 사건을 들고 온다
 *   좌측 레일                  평시에 열어 사건을 고른다
 * ───────────────────────────────────────────── */

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import {
  Button,
  Card,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
} from "@ds";
import { useScenario } from "../../state/ScenarioProvider";
import { EVENTS, activeEventsAt, hazardLabel } from "../../demo/events";
import { findDistrict } from "../../demo/districts";
import { reportOf, type ReportSection } from "../../demo/report";

function hhmm(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function ReportPage() {
  const [params] = useSearchParams();
  const {
    now,
    dispatches,
    approvedResponseLevel,
    approvedAt,
    sopExecutedItemIds,
    phoneReportedAt,
  } = useScenario();

  /* 사건 후보 — 현재 시계에 진행 중인 것이 위, 그 밖은 원장 순서.
     트랙 이름을 보지 않는다(CLAUDE.md 이관 규칙) */
  const candidates = useMemo(() => {
    const active = activeEventsAt(now).map((e) => e.id);
    return [...EVENTS]
      .filter((e) => new Date(e.raisedAt) <= now)
      .sort((a, b) => {
        const aa = active.includes(a.id) ? 0 : 1;
        const bb = active.includes(b.id) ? 0 : 1;
        if (aa !== bb) return aa - bb;
        return b.raisedAt.localeCompare(a.raisedAt);
      });
  }, [now]);

  const requested = params.get("event");
  const [picked, setPicked] = useState<string | null>(null);
  const eventId = picked ?? requested ?? candidates[0]?.id ?? null;
  const event = candidates.find((e) => e.id === eventId) ?? null;

  const report = useMemo(
    () =>
      event
        ? reportOf(event, {
            now,
            dispatches,
            approvedResponseLevel,
            approvedAt,
            sopExecutedItemIds,
            phoneReportedAt,
          })
        : null,
    [event, now, dispatches, approvedResponseLevel, approvedAt, sopExecutedItemIds, phoneReportedAt],
  );

  const options = candidates.map((e) => {
    const d = findDistrict(e.districtId);
    return `${d?.name ?? e.districtId} ${hazardLabel(e.hazardType)} · ${e.raisedAt.slice(5, 10)}`;
  });

  if (!event || !report) {
    return (
      <div className="p-4">
        <EmptyState
          icon="mdi:file-document-outline"
          message="보고서를 만들 사건이 없다"
          description="현재 시계 이전에 발생한 사건이 원장에 없습니다."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      {/* 사건 선택 + 내보내기 */}
      <div className="flex items-center gap-3">
        <span className="text-caption text-foreground-muted">사건</span>
        {/* 사건 고르기 — 원장이 32건이라 캡슐로 늘어놓으면 화면 절반을 먹는다.
            드롭다운 하나로 접고, 진행 중인 사건이 맨 위에 선다 */}
        <Select value={eventId ?? undefined} onValueChange={setPicked}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="사건 선택" />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((e, i) => (
              <SelectItem key={e.id} value={e.id}>
                {options[i]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="sm">
            <Icon icon="mdi:file-pdf-box" className="size-4" />
            PDF 내보내기
          </Button>
          <Button variant="secondary" size="sm">
            <Icon icon="mdi:send-outline" className="size-4" />
            상급기관 보고
          </Button>
        </div>
      </div>

      {/* 문서 */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Card className="mx-auto max-w-[900px] p-8">
          {/* 제목 */}
          <header className="border-border-subtle mb-6 border-b pb-4">
            <div className="text-caption text-foreground-muted">창원특례시 재난안전관제시스템</div>
            <h1 className="text-title mt-1 font-semibold">{report.title}</h1>
            <div className="text-caption text-foreground-muted mt-2">
              작성 {hhmm(report.issuedAt)} · 자동 생성
            </div>
          </header>

          {/* 개요 */}
          <dl className="mb-6 grid grid-cols-2 gap-x-8 gap-y-2">
            {report.head.map((r) => (
              <div key={r.label} className="flex gap-3">
                <dt className="text-body text-foreground-muted w-[92px] shrink-0">{r.label}</dt>
                <dd className="text-body font-medium">{r.value}</dd>
              </div>
            ))}
          </dl>

          {/* 절 */}
          {report.sections.map((s, i) => (
            <Section key={s.id} index={i + 1} section={s} />
          ))}

          {/* 타임라인 */}
          <section className="mt-6">
            <h2 className="text-body border-border-subtle mb-3 border-b pb-2 font-semibold">
              {report.sections.length + 1}. 대응 경과
            </h2>
            <ol className="flex flex-col gap-2">
              {report.timeline.map((e, i) => (
                <li key={`${e.at.toISOString()}-${i}`} className="flex gap-3">
                  <span className="text-body text-foreground-muted w-[52px] shrink-0 tabular-nums">
                    {hhmm(e.at)}
                  </span>
                  <span
                    className="mt-[7px] size-2 shrink-0 rounded-full"
                    style={{ background: e.color ?? "var(--color-border)" }}
                  />
                  <span className="text-body">
                    {e.label}
                    {e.detail && (
                      <span className="text-foreground-muted"> · {e.detail}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </Card>
      </div>
    </div>
  );
}

function Section({ index, section }: { index: number; section: ReportSection }) {
  return (
    <section className="mt-6">
      <h2 className="text-body border-border-subtle mb-3 flex items-center gap-2 border-b pb-2 font-semibold">
        {index}. {section.title}
        {section.pending && <StatusBadge status="pending" label="미발생" showDot={false} />}
      </h2>
      {section.rows.length > 0 && (
        <dl className="flex flex-col gap-1.5">
          {section.rows.map((r) => (
            <div key={r.label} className="flex gap-3">
              <dt className="text-body text-foreground-muted w-[168px] shrink-0">{r.label}</dt>
              <dd className="text-body">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {section.note && (
        <p className="text-body text-foreground-muted mt-2 leading-relaxed">{section.note}</p>
      )}
    </section>
  );
}
