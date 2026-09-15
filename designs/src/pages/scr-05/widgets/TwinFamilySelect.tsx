/* ─────────────────────────────────────────────
 * 트윈 유형군 셀렉트 — 03 §5 일곱 유형군이 다 선다. 화면에는 재난명만
 *
 * 사전 조건분석의 첫 축이다. 열돔 지구본(E)은 개념 예시 장면으로 살려 둔 자리다.
 * TODO(정본): 03 §16 비교 기준안은 C·D·F 셋이고 E 는 후보다. E 장면을 정본에 올릴지는 결정 대기(2026-09-14)
 * ───────────────────────────────────────────── */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ds";
import type { TwinFamily } from "../../../model/incident";

export interface TwinFamilyOption {
  id: TwinFamily;
  label: string;
  /** 덧말 — 기본은 없다. "조건 세트 4" 같은 제작자 언어는 쓰지 않는다 */
  note?: string;
}

export function TwinFamilySelect({ families, family, onChange }: { families: TwinFamilyOption[]; family: TwinFamily; onChange: (family: TwinFamily) => void }) {
  if (families.length < 2) return null;
  return (
    <label className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-caption text-foreground-muted">유형</span>
      <span className="min-w-0 flex-1">
        <Select value={family} onValueChange={(v) => onChange(v as TwinFamily)}>
          <SelectTrigger className="h-8 text-caption" aria-label="트윈 유형군">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {families.map((f) => (
              <SelectItem key={f.id} value={f.id} className="text-caption">
                {f.label}{f.note && <span className="ml-1.5 text-foreground-subtle">{f.note}</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </span>
    </label>
  );
}
