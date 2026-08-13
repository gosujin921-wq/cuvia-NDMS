/* ─────────────────────────────────────────────
 * 분석 근거와 가정 — 03 화면정의서 §5
 *
 * 앞 카드가 "47동 · 412명"이라고 말한 뒤 반드시 따라와야 하는 자리다. 이 숫자가 무엇을
 * 보고 나왔고 무엇이 유지된다고 쳤는지가 없으면, 쓰는 사람은 그 값을 믿을 수도 의심할
 * 수도 없다.
 *
 * ★ **만조가 사는 곳이 여기다.** 분석 이름도 버튼명도 아니고 "19:10 전망을 이렇게 산출
 *   했다"의 한 줄이다(03 §5). 조석이 제목에 서면 화면 전체가 해안 전용으로 읽히고, 같은
 *   문법을 내수침수에 얹을 수 없다. 봉암은 같은 자리에 강우 지속·배수 제약이 선다.
 *
 * ★ "시연용 고정값 · 04 §12"는 우리끼리 쓰는 말이라 화면에 올리지 않는다. 문서 조항
 *   번호는 개발자의 좌표고, 화면을 쓰는 사람이 알아야 하는 것은 자료의 이름과 전제다.
 *
 * 값은 조건 시나리오(04 §10 · §15-7)의 산출 항을 그대로 되쓴다 — 여기서 새 숫자를
 * 만들면 판정 카드·AI 답변과 근거가 갈린다(demo/analysis.ts analysisBasisOf).
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { formatClock } from "../../../lib/datetime";
import type { AnalysisBasis } from "../../../demo/analysis";

export function AnalysisBasisCard({ basis }: { basis: AnalysisBasis }) {
  return (
    <section className="flex flex-col gap-1.5 p-3" aria-label="분석 근거와 가정">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-body font-semibold text-foreground">분석 근거와 가정</h2>
        <span className="shrink-0 font-mono text-caption text-foreground-subtle">
          분석 {formatClock(basis.at)}
          {basis.projectedAt && ` · 전망 ${formatClock(basis.projectedAt)}`}
        </span>
      </header>

      {/* 산정 조건 — 전망값을 만든 항. 라벨·값 표로 세운다. 문장으로 풀면 어느 것이
          관측이고 어느 것이 가정인지 섞인다 */}
      {basis.terms.length > 0 && (
        <dl className="flex flex-col">
          {basis.terms.map((term) => (
            <div
              key={term.label}
              className="flex items-baseline gap-2 border-b border-border py-1 text-caption last:border-b-0"
              title={term.note}
            >
              <dt className="min-w-0 flex-1 truncate text-foreground-muted">{term.label}</dt>
              <dd className="shrink-0 font-mono text-foreground">{term.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <Group icon="mdi:database-outline" label="근거" items={basis.sources} />
      {/* 가정은 근거와 성격이 다르다 — 관측된 것이 아니라 "이대로 간다고 쳤다"이다.
          둘을 한 목록으로 뭉치면 확정과 전제가 같은 무게로 읽힌다 */}
      <Group icon="mdi:help-rhombus-outline" label="가정" items={basis.assumptions} muted />
    </section>
  );
}

function Group({
  icon,
  label,
  items,
  muted,
}: {
  icon: string;
  label: string;
  items: string[];
  muted?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex gap-2 border-t border-border pt-1.5 first-of-type:border-t-0 first-of-type:pt-0">
      <span className="flex w-14 shrink-0 items-center gap-1 text-caption text-foreground-muted">
        <Icon icon={icon} className="size-3.5 shrink-0" aria-hidden />
        {label}
      </span>
      <ul className="flex min-w-0 flex-1 flex-col gap-0.5">
        {items.map((item) => (
          <li
            key={item}
            className={
              muted ? "text-caption text-foreground-subtle" : "text-caption text-foreground-muted"
            }
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
