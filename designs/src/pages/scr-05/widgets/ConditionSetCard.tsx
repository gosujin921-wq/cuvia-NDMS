/* ─────────────────────────────────────────────
 * 사전 조건분석 — 조건을 골라 그 조합에 준비된 예측판을 연다 (IA-T01 · 02 §8)
 *
 * 사건 없이 "이 비가 이 조건으로 이어지면 어디까지 잠기나"를 묻는 자리다. 축은 조건 세트가 정한다
 * (강우 강도 · 만조). 고른 조합에 예측판이 없으면 값을 만들지 않고 빈 자리를 그대로 말한다 —
 * 실개발에서는 그 자리가 같은 조건의 ModelRun 요청이다.
 *
 * ★ 사람이 세우는 것은 조건까지다. 침수심은 예측판이 답한다. Phase 1 처럼 상승률을 곱해 수위를
 *   만들지 않는다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { formatClock } from "../../../lib/datetime";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ds";
import type { TrainingConditionSet } from "../../../model/training";
import type { TwinFamily } from "../../../model/incident";
import type { TwinFamilyContract } from "../../../model/twin-family";
import { TwinFamilySelect, type TwinFamilyOption } from "./TwinFamilySelect";

/** 조건 축 — 세트들의 params 에서 키 순서·값 순서 그대로 뽑는다 */
export function conditionAxesOf(sets: TrainingConditionSet[]): { key: string; label: string; values: { value: string; note?: string }[] }[] {
  const axes: { key: string; label: string; values: { value: string; note?: string }[] }[] = [];
  for (const s of sets) {
    for (const p of s.params) {
      let axis = axes.find((a) => a.key === p.key);
      if (!axis) {
        axis = { key: p.key, label: p.label, values: [] };
        axes.push(axis);
      }
      if (!axis.values.some((v) => v.value === p.value)) axis.values.push({ value: p.value, note: p.note });
    }
  }
  return axes;
}

/** 축 값 하나를 바꿨을 때 맞는 세트 — 없으면 null (조합이 정의되지 않음) */
export function conditionSetFor(sets: TrainingConditionSet[], current: TrainingConditionSet, key: string, value: string): TrainingConditionSet | null {
  const want = current.params.map((p) => (p.key === key ? { ...p, value } : p));
  return sets.find((s) => want.every((w) => s.params.some((p) => p.key === w.key && p.value === w.value))) ?? null;
}

export interface RegionOption {
  id: string;
  label: string;
  /** 예측판이 준비된 지역인가 — 아니면 셀렉트에서 disabled */
  prepared: boolean;
}

export function ConditionSetCard({ sets, set, regions, region, onRegionChange, onChange, header, families, family, onFamilyChange, contract, locked = null }: {
  /** 이 유형·지역의 조건 세트. 비어 있으면 계약 한 줄만 선다 */
  sets: TrainingConditionSet[];
  set: TrainingConditionSet | null;
  /** 이 유형의 지역 후보 전부 */
  regions: RegionOption[];
  region: string | null;
  onRegionChange: (regionId: string) => void;
  onChange: (setId: string) => void;
  /** 머리 오른쪽 자리 — 출처 전환 */
  header?: React.ReactNode;
  families: TwinFamilyOption[];
  family: TwinFamily;
  onFamilyChange: (family: TwinFamily) => void;
  /** 유형군 계약 — 조건 세트가 없을 때 한 줄로 말한다 */
  contract: TwinFamilyContract;
  /** 훈련 진행 중 — 조건은 확정됐고 셀렉트는 잠긴다. 기준 시각을 보인다 */
  locked?: { baseTime: string } | null;
}) {
  const axes = conditionAxesOf(sets);
  const prepared = set !== null && set.baselineForecastId !== null;

  /* 훈련 진행 중 — 조건은 확정됐다. 셀렉트를 잠그는 대신 요약 넉 줄로 접는다. 시작 뒤 강우·만조를 바꾸면 무슨 조건에서 결정했는지 기록이 깨진다 */
  if (locked && set) {
    const hazard = families.find((f) => f.id === family)?.label ?? "";
    const regionLabel = regions.find((r) => r.id === region)?.label ?? "";
    return (
      <section className="flex flex-col gap-1.5 p-3" aria-label="훈련 조건">
        <header className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" aria-hidden />
          <h2 className="text-body font-semibold text-foreground">훈련 진행 중</h2>
          <span className="ml-auto font-mono text-caption text-foreground-subtle">기준 {formatClock(locked.baseTime)}</span>
        </header>
        <p className="text-caption text-foreground">{hazard} · {regionLabel}</p>
        <p className="text-caption text-foreground-muted">{set.params.map((p) => `${p.label} ${p.value}${p.note ? ` ${p.note}` : ""}`).join(" · ")}</p>
        <p className="flex items-start gap-1.5 border-t border-border pt-2 text-caption">
          <Icon icon="mdi:target" className="mt-px size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
          <span className="text-foreground-muted">목표</span>
          <span className="min-w-0 flex-1 font-semibold text-foreground">{set.goal ?? set.objectives[set.objectives.length - 1]}</span>
        </p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-2 p-3" aria-label="훈련 조건">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-body font-semibold text-foreground">훈련 조건</h2>
        {header}
      </header>

      {/* 유형이 첫 축이다 — 03 §5 일곱 유형군. 조건 축은 유형이 정한다 */}
      <TwinFamilySelect families={families} family={family} onChange={onFamilyChange} />

      {/* 지역 — 유형 다음 축. 후보는 다 세우고 예측판 없는 지역은 잠근다 */}
      {regions.length > 0 && (
        <label className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-caption text-foreground-muted">지역</span>
          <span className="min-w-0 flex-1">
            <Select value={region ?? undefined} onValueChange={onRegionChange}>
              <SelectTrigger className="h-8 text-caption" aria-label="훈련 지역">
                <SelectValue placeholder="지역 선택" />
              </SelectTrigger>
              <SelectContent>
                {regions.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-caption" disabled={!r.prepared}>
                    {r.label}
                    {!r.prepared && <span className="ml-1.5 text-foreground-subtle">· 예측판 없음</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </span>
        </label>
      )}

      {!set && (
        /* 조건 세트가 없는 유형 — 결과를 만들지 않는다(03 §16). 무엇을 보는 유형인지 한 줄만 */
        <p className="flex items-start gap-1 text-caption text-foreground-muted">
          <Icon icon="mdi:information-outline" className="mt-px size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
          <span>{contract.incidents[0]}. {contract.stateVariable}. 아직 조건 세트가 없어 개념 장면만 봅니다.</span>
        </p>
      )}

      {set && axes.map((axis) => {
        const cur = set.params.find((p) => p.key === axis.key)?.value ?? "";
        return (
          <label key={axis.key} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-caption text-foreground-muted">{axis.label}</span>
            <span className="min-w-0 flex-1">
              <Select value={cur} onValueChange={(v) => { const next = conditionSetFor(sets, set, axis.key, v); if (next) onChange(next.setId); }}>
                <SelectTrigger className="h-8 text-caption" aria-label={axis.label}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {axis.values.map((v) => {
                    const target = conditionSetFor(sets, set, axis.key, v.value);
                    return (
                      <SelectItem key={v.value} value={v.value} className="text-caption" disabled={!target}>
                        {v.value}
                        {v.note && <span className="ml-1.5 font-mono text-foreground-subtle">{v.note}</span>}
                        {target && target.baselineForecastId === null && <span className="ml-1.5 text-foreground-subtle">· 예측판 없음</span>}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </span>
          </label>
        );
      })}

      {/* 준비 안 된 조합만 말한다 — "준비된 예측판 · 기준 1 · 대안 2" 같은 내부 구조 설명은 두지 않는다 */}
      {set && !prepared && (
        <p className="flex items-start gap-1 text-caption text-foreground-subtle">
          <Icon icon="mdi:file-remove-outline" className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>{set.unavailableReason ?? "이 조합의 예측판이 없습니다"}</span>
        </p>
      )}

      {/* 목표는 한 줄 — 무엇을 결정하면 되는가. 세부 목표는 화면을 쓰면서 드러난다 */}
      {set && (
        <p className="flex items-start gap-1.5 border-t border-border pt-2 text-caption">
          <Icon icon="mdi:target" className="mt-px size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
          <span className="text-foreground-muted">목표</span>
          <span className="min-w-0 flex-1 font-semibold text-foreground">{set.goal ?? set.objectives[set.objectives.length - 1]}</span>
        </p>
      )}
    </section>
  );
}
