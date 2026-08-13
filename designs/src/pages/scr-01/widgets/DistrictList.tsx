/* ─────────────────────────────────────────────
 * 위험지구 목록 — 03 화면정의서 §1 좌측
 *
 * 12개 지구를 세로로 놓고, 진행 중인 이벤트가 있는 지구를 위로 올린다. 아침에 화면을
 * 켠 담당자가 목록을 훑어 내려가지 않고 맨 위에서 오늘 볼 것을 만나야 한다.
 *
 * 항목을 누르면 그 지구의 조기경보 화면(SCR-02)으로 넘어간다.
 * ───────────────────────────────────────────── */

import { useMemo } from "react";
import { Icon } from "@iconify/react";
import { DISTRICTS, type District } from "../../../demo/districts";
import { activeEventOfAt, eventViewAt, hazardLabel } from "../../../demo/events";
import { processStateAt } from "../../../demo/sop";
import { useScenario } from "../../../state/ScenarioProvider";
import { levelSpec } from "../../../demo/levels";


/** 정렬 가중치 — 단계가 높은 지구를 위로 */
const LEVEL_WEIGHT: Record<string, number> = { evacuate: 3, warning: 2, advisory: 1 };

export function DistrictList({ onOpen }: { onOpen: (district: District) => void }) {
  const { now, approvedResponseLevel } = useScenario();
  const ordered = useMemo(
    () =>
      [...DISTRICTS].sort((a, b) => {
        const ea = activeEventOfAt(a.id, now);
        const eb = activeEventOfAt(b.id, now);
        const wa = ea ? LEVEL_WEIGHT[eventViewAt(ea, now).level] : 0;
        const wb = eb ? LEVEL_WEIGHT[eventViewAt(eb, now).level] : 0;
        if (wb !== wa) return wb - wa;
        /* 단계 동률이면 최신 발생순 — 시연 시작(셋 다 주의보)에 주인공 서항이 맨 위에 선다 */
        const ta = ea ? new Date(ea.raisedAt).getTime() : 0;
        const tb = eb ? new Date(eb.raisedAt).getTime() : 0;
        if (tb !== ta) return tb - ta;
        return a.id === "seohang" ? -1 : b.id === "seohang" ? 1 : 0;
      }),
    [now],
  );

  return (
    <ul className="flex flex-col gap-1 p-2">
      {ordered.map((district) => {
        const event = activeEventOfAt(district.id, now);
        const view = event ? eventViewAt(event, now) : null;
        const spec = view ? levelSpec(view.level) : null;

        return (
          <li key={district.id}>
            <button
              type="button"
              onClick={() => onOpen(district)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-md border-none bg-transparent px-2.5 py-2 text-left transition-colors hover:bg-surface-raised"
            >
              <span
                className={spec ? "size-2 shrink-0 animate-pulse rounded-full" : "size-2 shrink-0 rounded-full"}
                style={{ backgroundColor: spec ? spec.color : "var(--color-foreground-subtle)" }}
                aria-hidden
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-body font-medium text-foreground">
                    {district.name}
                  </span>
                  <span className="shrink-0 text-caption text-foreground-subtle">
                    {district.kind}
                  </span>
                </span>
                <span className="truncate text-caption text-foreground-muted">
                  {event && view && spec
                    ? `${hazardLabel(event.hazardType)} ${spec.label} · ${view.value} ${event.unit} · ${processStateAt(event, now, event.id === "EVT-260812-006" ? approvedResponseLevel : null)}`
                    : district.target}
                </span>
              </span>
              <Icon
                icon="mdi:chevron-right"
                className="size-4 shrink-0 text-foreground-subtle"
                aria-hidden
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
