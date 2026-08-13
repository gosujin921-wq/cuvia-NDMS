/* ─────────────────────────────────────────────
 * 영향 결과 — 03 화면정의서 §5 · 04 §12 · §15-8
 *
 * 물이 차오르는 그림만으로는 판단이 서지 않는다. "이만큼 잠깁니다"와 "47동이 잠기고
 * 412명이 대피 대상입니다"는 다른 말이고, 대응 등급을 올릴지 정하는 자리에서 필요한
 * 것은 뒤쪽이다.
 *
 * ★ 이 카드의 핵심은 절대값이 아니라 **비교**다. 시각을 옮기면 숫자가 바뀌지만, 그 변화의
 *   뜻은 "6동에서 47동으로"라고 나란히 세워야 읽힌다. 현재를 왼쪽에 붙박아 두고 선택한
 *   시각을 오른쪽에 세우는 것이 디지털트윈이 내놓는 결과의 형태다.
 *
 * ★ 예상 수위가 **결과의 첫 행**이다. 시간축이 주 조작축이 되면서 수위는 사용자가 미는
 *   값에서 그 시각에 따라오는 값으로 자리를 옮겼다(03 §5). 조작 대상이 결과가 된 것이
 *   시간축 전환의 가장 깊은 변화다.
 *
 * 행 구조는 재난유형과 무관하게 같다(demo/analysis.ts ImpactResult) — 무엇이 덮치든
 * 대응이 물어보는 것은 범위·건물·도로·사람으로 같기 때문이다. 그래서 "침수 면적"이
 * 아니라 "영향 범위"라고 적는다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { cn } from "@ds";
import type { ImpactResult } from "../../../demo/analysis";

interface ImpactRowSpec {
  icon: string;
  label: string;
  format: (impact: ImpactResult) => string;
  /** 이 값을 크기 비교에 쓴다 — 늘었는지 판정 */
  amount: (impact: ImpactResult) => number;
  /** 값이 0 을 넘으면 위험색 */
  danger?: boolean;
}

const ROWS: ImpactRowSpec[] = [
  {
    icon: "mdi:texture-box",
    label: "영향 범위",
    format: (i) => `${i.areaHa.toFixed(1)} ha`,
    amount: (i) => i.areaHa,
  },
  {
    icon: "mdi:home-group",
    label: "영향 건물",
    format: (i) => `${i.buildings}동`,
    amount: (i) => i.buildings,
  },
  {
    icon: "mdi:road-variant",
    label: "통제 도로",
    format: (i) => (i.roadM > 0 ? `${i.roadM} m` : "없음"),
    amount: (i) => i.roadM,
  },
  {
    icon: "mdi:account-group",
    label: "대응 대상",
    format: (i) => (i.evacuees > 0 ? `${i.evacuees}명` : "없음"),
    amount: (i) => i.evacuees,
    danger: true,
  },
];

/** 조건값 행 — 시간축이 만들어 낸 값. 재난유형마다 이름과 단위가 다르다 */
export interface ConditionRow {
  label: string;
  unit: string;
  baseline: number | null;
  selected: number;
}

interface ImpactResultCardProps {
  /** 기준 시각의 영향 — 비교 기준. 없으면 선택 조건만 세운다 */
  baseline: ImpactResult | null;
  /** 선택 시각의 영향 */
  selected: ImpactResult;
  /** 열 머리 — "현재 17:29" · "19:10 바닷물 최고" */
  baselineLabel: string;
  selectedLabel: string;
  /** 두 쪽이 같은 값인가 — 같으면 비교를 접고 한 열로 선다 */
  same: boolean;
  /** 결과 첫 행에 세울 조건값 (예상 수위 등) */
  condition?: ConditionRow;
}

/** 한 줄이 화면에 낼 것 — 조건값 행과 영향 행을 같은 모양으로 세우기 위한 중간형 */
interface RenderRow {
  key: string;
  icon: string;
  label: string;
  baselineText: string | null;
  selectedText: string;
  grew: boolean;
  alarming: boolean;
  emphasis?: boolean;
}

export function ImpactResultCard({
  baseline,
  selected,
  baselineLabel,
  selectedLabel,
  same,
  condition,
}: ImpactResultCardProps) {
  const compare = baseline !== null && !same;

  const rows: RenderRow[] = [];

  if (condition) {
    rows.push({
      key: "condition",
      icon: "mdi:altimeter",
      label: condition.label,
      baselineText:
        compare && condition.baseline != null
          ? `${condition.baseline.toFixed(2)} ${condition.unit}`
          : null,
      selectedText: `${condition.selected.toFixed(2)} ${condition.unit}`,
      grew: condition.baseline != null && condition.selected > condition.baseline,
      alarming: false,
      /* 조건값은 영향의 원인이라 구분선을 두고 위에 세운다 */
      emphasis: true,
    });
  }

  for (const row of ROWS) {
    rows.push({
      key: row.label,
      icon: row.icon,
      label: row.label,
      baselineText: compare && baseline !== null ? row.format(baseline) : null,
      selectedText: row.format(selected),
      grew: compare && baseline !== null && row.amount(selected) > row.amount(baseline),
      alarming: Boolean(row.danger) && row.amount(selected) > 0,
    });
  }

  return (
    <section className="flex flex-col gap-1.5 p-3" aria-label="영향 결과">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-body font-semibold text-foreground">영향 결과</h2>
        {!compare && (
          <span className="font-mono text-caption text-foreground-subtle">{selectedLabel} 기준</span>
        )}
      </header>

      {compare && (
        <div className="flex items-center gap-2 pb-0.5 text-caption text-foreground-subtle">
          <span className="w-14 shrink-0" />
          <span className="flex-1 text-right">{baselineLabel}</span>
          <span className="w-4 shrink-0" aria-hidden />
          <span className="flex-1 text-right font-medium text-foreground-muted">
            {selectedLabel}
          </span>
        </div>
      )}

      <dl className="flex flex-col">
        {rows.map((row) => (
          <div
            key={row.key}
            className={cn(
              "flex items-center gap-2 border-b border-border py-1.5 text-caption last:border-b-0",
              row.emphasis && "border-b-2",
            )}
          >
            <Icon icon={row.icon} className="size-4 shrink-0 text-foreground-subtle" aria-hidden />
            <dt className={cn("shrink-0 text-foreground-muted", compare ? "w-14" : "w-16")}>
              {row.label}
            </dt>
            {row.baselineText !== null ? (
              <>
                {/* 기준 시각 — 붙박이. 눈에 덜 띄게 두고 오른쪽이 결론이 되게 한다 */}
                <dd className="flex-1 text-right font-mono text-foreground-subtle">
                  {row.baselineText}
                </dd>
                <Icon
                  icon="mdi:arrow-right"
                  className={cn(
                    "size-4 shrink-0",
                    row.grew ? "text-foreground-muted" : "text-foreground-subtle opacity-40",
                  )}
                  aria-label="에서"
                />
                <dd
                  className={cn(
                    "flex-1 text-right font-mono font-semibold",
                    row.alarming ? "text-danger" : "text-foreground",
                  )}
                >
                  {row.selectedText}
                </dd>
              </>
            ) : (
              <dd
                className={cn(
                  "min-w-0 flex-1 text-right font-mono",
                  row.alarming ? "font-semibold text-danger" : "text-foreground",
                )}
              >
                {row.selectedText}
              </dd>
            )}
          </div>
        ))}
      </dl>

      {/* 숫자로 안 되는 단서 — 선택 쪽만 적는다. 기준 시각에도 걸려 있으면 새 사실이
          아니므로, 새로 걸린 것만 붉게 세운다 */}
      {selected.notes.length > 0 && (
        <ul className="flex flex-col gap-0.5 pt-0.5">
          {selected.notes.map((note) => {
            const isNew = compare && baseline !== null && !baseline.notes.includes(note);
            return (
              <li
                key={note}
                className={cn(
                  "flex items-start gap-1 text-caption",
                  isNew ? "text-danger" : "text-foreground-subtle",
                )}
              >
                <Icon
                  icon={isNew ? "mdi:alert-circle-outline" : "mdi:information-outline"}
                  className="mt-px size-3.5 shrink-0"
                  aria-hidden
                />
                <span className="min-w-0 flex-1">{note}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
