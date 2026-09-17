/* ─────────────────────────────────────────────
 * SCR-00 디지털트윈 시뮬레이션 (2026-09-17 · 새 방향)
 *
 *   실제 사건 데이터 → 트윈에서 사건 재현(기준) → 조건 변경 → 결과 계산 → 기준과 비교 → 관련 SOP 판단
 *
 * 상단 유형 탭 `침수 | 폭염`. 같은 화면 논리에 시뮬레이션 내용만 다르다 —
 *   침수   상황 → 물리(지형 수면) → 피해 범위 → SOP
 *   폭염   상황 → 기상 예보 격자 → 위험 상태 지속 → SOP   (열환경 저감 모델이 없어 "대책 적용 전후"는 만들지 않는다)
 * 모의훈련(/scr-05)은 이 상태로 킵한다. 여기는 조치를 정하는 자리가 아니라 조건을 바꿔 결과를 읽는 자리다.
 * 상태는 query 가 든다: `type` · `site` · `sc`(시나리오).
 * ───────────────────────────────────────────── */

import { useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { Notice, cn } from "@ds";
import { useFabSlot } from "../../layout/fab-slot";
import { CENTER_LEFT, CENTER_RIGHT } from "../../lib/layout";
import { FloodSim } from "./FloodSim";

type SimType = "flood" | "heat";
const TYPES: { id: SimType; label: string; icon: string }[] = [
  { id: "flood", label: "침수", icon: "mdi:waves" },
  { id: "heat", label: "폭염 · 도시 열환경", icon: "mdi:sun-thermometer-outline" },
];

export function SimulationPage() {
  const [params, setParams] = useSearchParams();
  const type: SimType = params.get("type") === "heat" ? "heat" : "flood";
  /* 하단 중앙에 시간축이 서므로 질의 버튼은 그 위로 */
  useFabSlot("clock");

  return (
    <div className="relative h-full w-full overflow-hidden">
      {type === "flood" ? (
        <FloodSim />
      ) : (
        <div className="flex h-full items-center justify-center p-6">
          <div className="max-w-md">
            <Notice variant="info" title="폭염 · 도시 열환경 시뮬레이션" description="기상청 예보 격자로 고온의 시간·공간 변화를 보고 폭염 단계에 따라 관련 SOP로 연결합니다. 다음 단계에서 붙입니다." />
          </div>
        </div>
      )}

      {/* 상단 중앙 유형 탭 */}
      <div className="pointer-events-none absolute top-3 z-30 flex justify-center" style={{ left: CENTER_LEFT, right: CENTER_RIGHT }}>
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-border bg-surface/95 p-0.5 backdrop-blur" role="tablist" aria-label="재난 유형">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={type === t.id}
              onClick={() => setParams(new URLSearchParams(t.id === "flood" ? {} : { type: t.id }), { replace: true })}
              className={cn("flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-caption font-medium transition-colors",
                type === t.id ? "bg-primary text-primary-foreground" : "text-foreground-muted hover:text-foreground")}
            >
              <Icon icon={t.icon} className="size-4" aria-hidden />
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
