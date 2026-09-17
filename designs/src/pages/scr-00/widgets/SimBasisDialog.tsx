/* ─────────────────────────────────────────────
 * 근거 — 이 숫자가 어디서 왔나 (scr-00 · 2026-09-17)
 *
 * 패널에 흩어져 있던 출처·산식·범례·면책 문장을 전부 여기로 모았다. 패널은 판단에 쓰는 값만 들고,
 * "이 값이 어디서 왔나"는 이 창에서 한 번에 본다.
 * ▸ 결: 이력의 사건 기록 창(scr-07 IncidentRecordModal) — 절마다 번호와 **질문 한 줄**이 서고, 값은 표로, 문장은 최소다
 *   (2026-09-17 사용자 "근거 창도 이력만큼은 정리돼서 나오게").
 *
 * 읽는 순서 다섯 절 — 사용자가 알고 싶은 순서다
 *   ① 입력      무엇을 넣었나
 *   ② 계산      어떻게 숫자가 되었나
 *   ③ 가정      무엇을 전제했나
 *   ④ 한계      어디가 흔들리나 · 무엇이 아직 없나
 *   ⑤ 읽는 법   화면의 색과 말이 무슨 뜻인가
 * 값을 다시 계산하지 않는다. 판이 스스로 든 근거(`Forecast.basis`)가 있으면 ①②③④에 섞어 편다.
 * ───────────────────────────────────────────── */

import { Tag } from "@ds";
import { FormDialog } from "../../../components/FormDialog";
import { formatClock, formatStamp } from "../../../lib/datetime";
import type { Forecast } from "../../../model/forecast";

/** 절 하나 — 라벨·값 줄(`rows`)이 먼저 서고 문장(`lines`)이 뒤에 붙는다. 둘 다 비면 절이 서지 않는다 */
export interface BasisNote {
  id: "input" | "calc" | "assume" | "limit" | "read";
  rows?: { label: string; value: string }[];
  lines?: string[];
}

const SECTIONS: Record<BasisNote["id"], { title: string; question: string }> = {
  input: { title: "입력", question: "무엇을 넣었나" },
  calc: { title: "계산", question: "어떻게 숫자가 되었나" },
  assume: { title: "가정", question: "무엇을 전제했나" },
  limit: { title: "한계", question: "어디가 흔들리나" },
  read: { title: "읽는 법", question: "화면의 색과 말이 무슨 뜻인가" },
};
const ORDER: BasisNote["id"][] = ["input", "calc", "assume", "limit", "read"];

export function SimBasisDialog({ title, subtitle, notes, forecast, onClose }: {
  title: string;
  /** 대상 한 줄 — 날짜·기준 시각. 머리 칩으로 선다 */
  subtitle?: string;
  notes: BasisNote[];
  /** 지금 서 있는 판. 근거를 들고 있으면 모델·입력·가정·불확실성을 절에 섞는다 */
  forecast?: Forecast | null;
  onClose: () => void;
}) {
  const b = forecast?.basis ?? null;
  const byId = new Map(notes.map((n) => [n.id, n]));

  /* 판이 든 근거를 절에 나눠 넣는다 — 화면이 준 줄 뒤에 붙는다 */
  const merged: Record<BasisNote["id"], { rows: { label: string; value: string }[]; lines: string[] }> = {
    input: { rows: [], lines: [] }, calc: { rows: [], lines: [] }, assume: { rows: [], lines: [] }, limit: { rows: [], lines: [] }, read: { rows: [], lines: [] },
  };
  for (const id of ORDER) {
    const n = byId.get(id);
    merged[id].rows.push(...(n?.rows ?? []));
    merged[id].lines.push(...(n?.lines ?? []));
  }
  if (b) {
    for (const i of b.inputs ?? []) merged.input.rows.push({ label: `${i.kind} · ${i.label}`, value: `${formatClock(i.at)}까지` });
    merged.calc.rows.push({ label: "모델", value: `${b.modelName} v${b.modelVersion}` });
    merged.calc.rows.push({ label: "기준시각", value: formatStamp(b.baseTime) });
    if (b.calculationActor) merged.calc.rows.push({ label: "계산 주체", value: b.calculationActor });
    if (b.inputQuality) merged.input.rows.push({ label: "입력 품질", value: b.inputQuality });
    merged.assume.lines.push(...(b.assumptions ?? []));
    if (b.uncertainty) {
      merged.limit.rows.push({ label: "불확실성", value: b.uncertainty.grade });
      if (b.uncertainty.sensitiveTo?.length) merged.limit.rows.push({ label: "민감", value: b.uncertainty.sensitiveTo.join(" · ") });
      if (b.uncertainty.unusableRanges?.length) merged.limit.lines.push(`이 구간은 쓰지 않습니다 · ${b.uncertainty.unusableRanges.join(" · ")}`);
    }
    if (b.replacementNote) merged.limit.lines.push(b.replacementNote);
  }
  /* 값이 비었거나 "해당 없음"인 줄은 세우지 않는다 — 표에 빈 칸이 남으면 정리돼 보이지 않는다 */
  for (const id of ORDER) merged[id].rows = merged[id].rows.filter((r) => r.value && r.value !== "해당 없음" && r.value !== "-");
  const shown = ORDER.filter((id) => merged[id].rows.length > 0 || merged[id].lines.length > 0);

  return (
    <FormDialog
      open
      onClose={onClose}
      icon="mdi:file-search-outline"
      title={`${title} · 근거`}
      description={
        <span className="flex flex-wrap items-center gap-2 text-caption">
          <Tag>입력과 계산</Tag>
          {subtitle && <span className="text-foreground-muted">{subtitle}</span>}
          <span className="text-foreground-subtle">판단은 보는 사람이 합니다</span>
        </span>
      }
      contentClassName="w-[720px] max-w-[calc(100vw-2rem)] sm:max-w-[720px] max-h-[92vh]"
      bodyClassName="flex flex-col gap-7 px-6 pb-7 pt-5"
    >
      {shown.map((id, i) => {
        const sec = SECTIONS[id];
        const { rows, lines } = merged[id];
        return (
          <section key={id} className="flex flex-col gap-2" aria-label={sec.title}>
            <header className="flex items-baseline gap-2 border-b border-border pb-1.5">
              <span className="font-mono text-caption text-foreground-subtle">{i + 1}</span>
              <h3 className="text-body font-semibold text-foreground">{sec.title}</h3>
              <span className="text-caption text-foreground-subtle">{sec.question}</span>
            </header>
            {rows.length > 0 && (
              <dl className="grid grid-cols-[minmax(120px,auto)_1fr] gap-x-4">
                {rows.map((r) => (
                  <div key={`${r.label}-${r.value}`} className="contents">
                    <dt className="border-b border-border/60 py-1.5 text-caption text-foreground-muted">{r.label}</dt>
                    <dd className="min-w-0 break-keep border-b border-border/60 py-1.5 text-caption leading-snug text-foreground">{r.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {lines.length > 0 && (
              <ul className="flex flex-col gap-1">
                {lines.map((l) => (
                  <li key={l} className="flex items-baseline gap-2">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-foreground-subtle" aria-hidden />
                    <span className="min-w-0 break-keep text-caption leading-snug text-foreground-muted">{l}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </FormDialog>
  );
}
