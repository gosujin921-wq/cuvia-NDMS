/* ─────────────────────────────────────────────
 * 현재 분석 사건 — 03 화면정의서 §5 우측 머리말
 *
 * 트윈에 들어온 이유를 한 줄로 붙든다. 지금 무슨 사건을 놓고, 무엇을 확인하러 왔는가.
 *
 * 과거 이벤트 목록을 여기 세우지 않는다 — "이 지구에서 있었던 일"은 SCR-04 사건 이력의
 * 몫이고, 트윈에서 그걸 나란히 세우면 지금 분석 중인 사건이 목록의 한 줄로 묻힌다.
 * 참고가 필요하면 레일 맨 아래 접힌 자리로 내려간다(03 §5).
 * ───────────────────────────────────────────── */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ds";
import { LevelBadge } from "../../../components/LevelBadge";
import { hazardLabel, type AlertEvent, type EventView, type HazardType } from "../../../demo/events";
import type { District } from "../../../demo/districts";

export function AnalysisHeader({
  district,
  event,
  view,
  purpose,
  hazardTypes,
  hazardType,
  onHazardChange,
}: {
  district: District;
  /** 분석 대상 사건. 진행 중 사건이 없는 지구면 null */
  event: AlertEvent | null;
  view: EventView | null;
  /** 분석 목적 한 줄 — "만조 조건 영향 확인". 조건 시나리오가 없으면 비운다 */
  purpose?: string;
  /** 이 지구 원장에 있는 유형. 둘 이상일 때만 고르는 자리가 선다 */
  hazardTypes: HazardType[];
  hazardType: HazardType | null;
  /** 유형을 갈아탄다. 사건은 그대로고 보는 축만 바뀐다 */
  onHazardChange: (type: HazardType | null) => void;
}) {
  return (
    <section className="flex flex-col gap-1 p-3" aria-label="현재 분석 사건">
      <h2 className="text-caption font-semibold text-foreground-muted">현재 분석 사건</h2>

      {event && view ? (
        <>
          <div className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-body font-semibold text-foreground">
              {district.name} {hazardLabel(hazardType ?? event.hazardType)}
            </span>
            <LevelBadge level={view.level} />
          </div>

          {/* 유형을 갈아타는 자리 — 모의분석 설정과 **같은 셀렉트**다. 같은 일을 하는
              컨트롤을 두 벌 두지 않는다. 이 지구에 유형이 하나뿐이면 고를 것이 없다 */}
          {hazardTypes.length > 1 && (
            <Select
              value={hazardType ?? event.hazardType}
              onValueChange={(v) => onHazardChange(v as HazardType)}
            >
              <SelectTrigger className="h-8 text-caption" aria-label="분석할 재난유형">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {hazardTypes.map((type) => (
                  <SelectItem key={type} value={type} className="text-caption">
                    {hazardLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-caption text-foreground-muted">
            <span className="font-mono text-foreground">
              현재 관측 {view.value} {event.unit}
            </span>
            {purpose && <span className="text-foreground-subtle"> · 분석 목적: {purpose}</span>}
          </p>
        </>
      ) : (
        <>
          <span className="truncate text-body font-semibold text-foreground">{district.name}</span>
          {/* 사건 없이 열어 본 지구 — 조건을 바꿔 볼 수는 있어도 반영할 사건이 없다 */}
          <p className="text-caption text-foreground-subtle">
            진행 중인 사건이 없습니다 · 조건 검토만 가능합니다
          </p>
        </>
      )}
    </section>
  );
}
