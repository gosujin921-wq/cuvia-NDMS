/* ─────────────────────────────────────────────
 * 사전 모의분석 설정 — 03 화면정의서 §5 우측 머리말 (drill 모드)
 *
 * 사건 연계 분석은 무엇을 볼지가 이미 정해져 있다(SCR-02 가 사건을 들고 온다). 모의분석은
 * 그 자리가 비어 있으므로, 레일의 첫 카드가 "무엇을 볼 것인가"를 사용자에게 묻는다.
 *
 * 재난유형 목록은 원장에 그 지구 사건으로 등재된 유형이다(demo/analysis.ts hazardTypesOf).
 * 지구 성격에서 역산하면 그럴듯하지만 근거 없는 목록이 나온다.
 *
 * ★ 세 번째 줄이 **조건**이다. 사람이 세우는 것은 여기까지고, 수위는 세우지 않는다 —
 *   미는 것은 시간이고 수위는 그 시간에 따라 나온다(demo/progression.ts). 조건의 이름은
 *   재난유형이 정한다: 내수침수는 강우 강도, 폭풍해일은 해일 편차. 같은 셀렉트에 "침수
 *   예상 수위"를 세우면 결과를 원인 자리에 앉히는 것이 된다.
 *
 * ★ 상승률 산정을 조건 바로 아래 한 줄로 붙인다. 이 값이 축 위 눈금 시각을 전부 만들므로
 *   (55분 · 2시간 35분) 근거가 레버 옆에 없으면 시간이 어디서 왔는지 화면에 안 남는다.
 *
 * ★ 이 결과가 실제 사건에 닿지 않는다는 말을 카드 안에 둔다. 사건 연계와 화면 모양이
 *   거의 같아서, 안내가 없으면 두 결과가 같은 무게로 읽힌다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ds";
import { DISTRICTS, type District } from "../../../demo/districts";
import type { HazardType } from "../../../demo/events";
import type { ProgressionCondition, ProgressionSpec } from "../../../demo/progression";

interface DrillSetupPanelProps {
  district: District;
  onDistrictChange: (districtId: string) => void;
  hazardType: HazardType | null;
  hazardTypes: HazardType[];
  onHazardChange: (hazardType: HazardType) => void;
  /** 진행 스펙 — 등재되지 않은 유형이면 조건 줄이 서지 않는다 */
  progression: ProgressionSpec | null;
  condition: ProgressionCondition | null;
  onConditionChange: (id: string) => void;
}

export function DrillSetupPanel({
  district,
  onDistrictChange,
  hazardType,
  hazardTypes,
  onHazardChange,
  progression,
  condition,
  onConditionChange,
}: DrillSetupPanelProps) {
  return (
    <section className="flex flex-col gap-2 p-3" aria-label="사전 모의분석 설정">
      <h2 className="text-caption font-semibold text-foreground-muted">사전 모의분석</h2>

      <Row label="지구">
        <Select value={district.id} onValueChange={onDistrictChange}>
          <SelectTrigger className="h-8 text-caption" aria-label="분석 지구">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DISTRICTS.map((item) => (
              <SelectItem key={item.id} value={item.id} className="text-caption">
                {item.name}
                <span className="ml-1.5 text-foreground-subtle">{item.kind}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      <Row label="재난유형">
        {hazardTypes.length > 0 ? (
          <Select value={hazardType ?? undefined} onValueChange={(v) => onHazardChange(v as HazardType)}>
            <SelectTrigger className="h-8 text-caption" aria-label="재난유형">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {hazardTypes.map((type) => (
                <SelectItem key={type} value={type} className="text-caption">
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          /* 원장에 이 지구 사건이 한 건도 없으면 고를 유형이 없다 — 빈 셀렉트를 세우지 않는다 */
          <span className="flex h-8 items-center text-caption text-foreground-subtle">
            등재된 재난유형이 없습니다
          </span>
        )}
      </Row>

      {/* 조건 — 사람이 세우는 마지막 값. 유형이 이름을 정하고, 고른 값이 상승률을 정하고,
          상승률이 시간축 눈금을 정한다 */}
      {progression && condition && (
        <>
          <Row label={progression.leverLabel}>
            <Select value={condition.id} onValueChange={onConditionChange}>
              <SelectTrigger className="h-8 text-caption" aria-label={progression.leverLabel}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {progression.conditions.map((item) => (
                  <SelectItem key={item.id} value={item.id} className="text-caption">
                    {item.label}
                    <span className="ml-1.5 font-mono text-foreground-subtle">
                      {item.riseRate} m/h
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <p className="pl-16 text-caption text-foreground-subtle">{condition.note}</p>
        </>
      )}

      <p className="flex items-start gap-1 border-t border-border pt-1.5 text-caption text-foreground-subtle">
        <Icon icon="mdi:school-outline" className="mt-px size-3.5 shrink-0" aria-hidden />
        <span>예방·훈련·계획 목적 · 실제 사건 판단과 대응 이력에는 반영되지 않습니다</span>
      </p>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-caption text-foreground-muted">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}
