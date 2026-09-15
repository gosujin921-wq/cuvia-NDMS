/* ─────────────────────────────────────────────
 * 지구 경로 칩 · 지금 어디를 보고 있나, 그리고 다른 지구로 건너뛰는 길
 *
 * ▸ 정본: CSMS 사업장 집중관제 SpacePickerChip(→ KISA SCR-2100 BreadcrumbChip). 코드를 그대로 옮기고 단계만
 *   줄였다 — CSMS 는 사업장 > 동 > 층 세 단계, 여기는 지구 한 단계다(2026-09-14 사용자 지시 "CSMS 와 같이").
 * ▸ 마지막 칸(지금 지구)은 누를 것이 없으므로 글자로만 선다. 끝의 ⌄ 가 트리다 · 12개 지구 중 고르면 그 지구의
 *   사건 작업공간으로 옮겨 간다(사건 → 알림 → 지구 현황 → 사건 없음 안내 순으로 열린다).
 * ▸ 상태 배지는 달지 않는다 · 옆 캡슐(사건·알림·지구 현황)이 말한다. 브레드크럼은 길, 캡슐은 상태.
 * ───────────────────────────────────────────── */

import { useMemo } from "react";
import { TreePicker, type TreePickerNode } from "@ds";
import { DISTRICTS } from "../../../demo/districts";

export function DistrictPickerChip({ districtId, label, onSelect }: {
  /** 지금 지구 */
  districtId: string;
  /** 지금 자리에 적을 이름 — 사건 범위 이름이 있으면 그것, 없으면 지구명 */
  label: string;
  onSelect: (districtId: string) => void;
}) {
  const items = useMemo<TreePickerNode[]>(() => DISTRICTS.map((d) => ({ id: d.id, label: `${d.name} · ${d.kind}`, parentId: null })), []);
  return (
    <div className="flex items-center gap-1">
      <span className="text-body font-semibold text-foreground">{label}</span>
      {/* 트리 · 경로를 글자로 또 적지 않는다(왼쪽이 이미 말했다) · ⌄ 하나로 선다.
          DS TreePicker chip 트리거는 `<span>경로</span><Icon/>` 이라 그 span 만 걷는다 */}
      <TreePicker
        items={items}
        value={districtId}
        onChange={(id) => { if (id && id !== districtId) onSelect(id); }}
        variant="chip"
        clearable={false}
        ariaLabel="다른 지구 선택"
        placeholder=""
        className="border-0 bg-transparent px-1 py-1 text-foreground-muted hover:bg-transparent hover:text-foreground [&>span]:hidden"
      />
    </div>
  );
}
