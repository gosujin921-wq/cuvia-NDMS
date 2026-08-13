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
import { DEMO_NOW, activeEventOf } from "../../../demo/events";
import { levelSpec } from "../../../demo/levels";
import { formatRelative } from "../../../lib/datetime";

/** 정렬 가중치 — 단계가 높은 지구를 위로 */
const LEVEL_WEIGHT: Record<string, number> = { evacuate: 3, warning: 2, advisory: 1 };

export function DistrictList({ onOpen }: { onOpen: (district: District) => void }) {
  const ordered = useMemo(
    () =>
      [...DISTRICTS].sort((a, b) => {
        const ea = activeEventOf(a.id);
        const eb = activeEventOf(b.id);
        return (eb ? LEVEL_WEIGHT[eb.level] : 0) - (ea ? LEVEL_WEIGHT[ea.level] : 0);
      }),
    [],
  );

  return (
    <ul className="flex flex-col gap-1 p-2">
      {ordered.map((district) => {
        const event = activeEventOf(district.id);
        const spec = event ? levelSpec(event.level) : null;

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
                  {event && spec
                    ? `${spec.label} · ${event.type} ${event.value} ${event.unit} · ${formatRelative(event.raisedAt, DEMO_NOW)}`
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
