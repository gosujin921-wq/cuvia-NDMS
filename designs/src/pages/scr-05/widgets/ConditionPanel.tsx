/* ─────────────────────────────────────────────
 * 분석 조건 — 03 화면정의서 §5 우측
 *
 * ★ 재난유형에 따라 패널이 **교체**된다. 공통 슬라이더 하나를 만들지 않는다.
 *
 *   폭풍해일 · 하천범람 · 내수침수   수면 표고 (WaterLevelCondition)
 *   집중호우                          강우 지속시간 · 내수위 · 배수 조건   ← 미등재
 *   지반변위                          누적 강우 · 토양 포화 · 사면 조건     ← 미등재
 *
 * 유형을 하나 늘리는 일은 demo/analysis.ts 의 ConditionSpec 한 줄과 이 파일의 분기
 * 하나다. DigitalTwinPage 와 3D 씬은 손대지 않는다 — 그것이 이 갈래를 둔 이유다.
 *
 * 04 에 조건표가 등재되지 않은 유형에는 슬라이더를 세우지 않는다. 근거 없이 움직이는
 * 숫자보다 "아직 등재되지 않음"이 정직하다.
 * ───────────────────────────────────────────── */

import { EmptyState } from "@ds";
import type { HazardType } from "../../../demo/events";
import { conditionSpecOf } from "../../../demo/analysis";
import { WaterLevelCondition, type ConditionPreset } from "./WaterLevelCondition";

interface ConditionPanelProps {
  districtId: string;
  hazardType: HazardType | null;
  value: number;
  onChange: (next: number) => void;
  marker?: { value: number; label: string };
  presets?: ConditionPreset[];
}

export function ConditionPanel({
  districtId,
  hazardType,
  value,
  onChange,
  marker,
  presets,
}: ConditionPanelProps) {
  const spec = hazardType ? conditionSpecOf(districtId, hazardType) : null;

  if (!spec) {
    return (
      <section className="flex flex-col gap-1.5 p-3" aria-label="분석 조건">
        <h2 className="text-body font-semibold text-foreground">분석 조건</h2>
        <EmptyState
          variant="inline"
          icon="mdi:tune-variant"
          message={
            hazardType
              ? `${hazardType} 조건 분석은 아직 등재되지 않았습니다`
              : "분석할 사건이 없습니다"
          }
        />
      </section>
    );
  }

  switch (spec.kind) {
    case "water-level":
      return (
        <WaterLevelCondition
          spec={spec}
          value={value}
          onChange={onChange}
          marker={marker}
          presets={presets}
        />
      );
  }
}
