/* ─────────────────────────────────────────────
 * 근거 — 이 숫자가 어디서 왔나 (scr-00 · 2026-09-17)
 *
 * 패널에 흩어져 있던 출처·산식·범례·면책 문장을 전부 여기로 모았다. 패널은 판단에 쓰는 값만 들고,
 * "이 값이 어디서 왔나"는 이 창에서 본다.
 * ▸ 결: 이력의 사건 기록 창(scr-07 IncidentRecordModal)과 **같은 틀**이다 — 넓은 창 · 절 바로가기 탭 ·
 *   `01` 절 번호와 질문 한 줄 · 라벨 위 값 아래의 3열 필드. 같은 결이라 말만 하고 모양이 달랐던 것을 맞췄다
 *   (2026-09-17 사용자 "근거창이 어떻게 이력창이랑 똑같아, 디자인이 다른데").
 *
 * 읽는 순서 다섯 절 — 사용자가 알고 싶은 순서다
 *   ① 입력      무엇을 넣었나
 *   ② 계산      어떻게 숫자가 되었나
 *   ③ 가정      무엇을 전제했나
 *   ④ 한계      어디가 흔들리나
 *   ⑤ 읽는 법   화면의 색과 말이 무슨 뜻인가
 * 값을 다시 계산하지 않는다. 판이 스스로 든 근거(`Forecast.basis`)가 있으면 그 다섯 절에 섞어 편다.
 * ───────────────────────────────────────────── */

import { useRef, useState, type ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "@ds";
import { FormDialog } from "../../../components/FormDialog";
import { formatClock, formatStamp } from "../../../lib/datetime";
import type { Forecast } from "../../../model/forecast";

type SectionId = "input" | "calc" | "assume" | "limit" | "read";

/** 절 하나 — 라벨·값 줄(`rows`)이 먼저 서고 문장(`lines`)이 뒤에 붙는다. 둘 다 비면 절이 서지 않는다 */
export interface BasisNote {
  id: SectionId;
  rows?: { label: string; value: string }[];
  lines?: string[];
}

const SECTIONS: { id: SectionId; label: string; question: string }[] = [
  { id: "input", label: "입력", question: "무엇을 넣었나" },
  { id: "calc", label: "계산", question: "어떻게 숫자가 되었나" },
  { id: "assume", label: "가정", question: "무엇을 전제했나" },
  { id: "limit", label: "한계", question: "어디가 흔들리나" },
  { id: "read", label: "읽는 법", question: "화면의 색과 말이 무슨 뜻인가" },
];

export function SimBasisDialog({ title, subtitle, notes, forecast, onClose }: {
  title: string;
  /** 대상 한 줄 — 날짜·기준 시각. 머리 설명에 선다 */
  subtitle?: string;
  notes: BasisNote[];
  /** 지금 서 있는 판. 근거를 들고 있으면 모델·입력·가정·불확실성을 절에 섞는다 */
  forecast?: Forecast | null;
  onClose: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<SectionId>("input");

  const b = forecast?.basis ?? null;
  const byId = new Map(notes.map((n) => [n.id, n]));
  const merged: Record<SectionId, { rows: { label: string; value: string }[]; lines: string[] }> = {
    input: { rows: [], lines: [] }, calc: { rows: [], lines: [] }, assume: { rows: [], lines: [] }, limit: { rows: [], lines: [] }, read: { rows: [], lines: [] },
  };
  for (const s of SECTIONS) {
    const n = byId.get(s.id);
    merged[s.id].rows.push(...(n?.rows ?? []));
    merged[s.id].lines.push(...(n?.lines ?? []));
  }
  if (b) {
    for (const i of b.inputs ?? []) merged.input.rows.push({ label: `${i.kind} · ${i.label}`, value: `${formatClock(i.at)}까지` });
    if (b.inputQuality) merged.input.rows.push({ label: "입력 품질", value: b.inputQuality });
    merged.calc.rows.push({ label: "모델", value: `${b.modelName} v${b.modelVersion}` });
    merged.calc.rows.push({ label: "기준시각", value: formatStamp(b.baseTime) });
    if (b.calculationActor) merged.calc.rows.push({ label: "계산 주체", value: b.calculationActor });
    merged.assume.lines.push(...(b.assumptions ?? []));
    if (b.uncertainty) {
      merged.limit.rows.push({ label: "불확실성", value: b.uncertainty.grade });
      if (b.uncertainty.sensitiveTo?.length) merged.limit.rows.push({ label: "민감", value: b.uncertainty.sensitiveTo.join(" · ") });
      if (b.uncertainty.unusableRanges?.length) merged.limit.lines.push(`이 구간은 쓰지 않습니다 · ${b.uncertainty.unusableRanges.join(" · ")}`);
    }
    if (b.replacementNote) merged.limit.lines.push(b.replacementNote);
  }
  /* 값이 비었거나 "해당 없음"인 줄은 세우지 않는다 — 표에 빈 칸이 남으면 정리돼 보이지 않는다 */
  for (const s of SECTIONS) merged[s.id].rows = merged[s.id].rows.filter((r) => r.value && r.value !== "해당 없음" && r.value !== "-");
  const shown = SECTIONS.filter((s) => merged[s.id].rows.length > 0 || merged[s.id].lines.length > 0);

  const goSection = (id: SectionId) => {
    setActive(id);
    scroller.current?.querySelector(`[data-section="${id}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const onScroll = () => {
    const box = scroller.current;
    if (!box) return;
    const top = box.getBoundingClientRect().top + 24;
    let current = shown[0]?.id ?? "input";
    for (const s of shown) {
      const el = box.querySelector(`[data-section="${s.id}"]`);
      if (el && el.getBoundingClientRect().top <= top) current = s.id;
    }
    setActive(current);
  };

  return (
    <FormDialog
      open
      onClose={onClose}
      icon="mdi:file-search-outline"
      title={`${title} · 근거`}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-foreground-muted">입력과 계산</span>
          {subtitle && <><span className="text-foreground-subtle" aria-hidden>·</span><span className="font-mono text-foreground-muted">{subtitle}</span></>}
          <span className="text-foreground-subtle" aria-hidden>·</span>
          <span className="text-foreground-subtle">판단은 보는 사람이 합니다</span>
        </span>
      }
      contentClassName="w-[1080px] max-w-[calc(100vw-2rem)] sm:max-w-[1080px] h-[90vh]"
      bodyClassName="flex flex-col px-0 py-0"
    >
      <div className="shrink-0 border-b border-border px-6 py-2">
        <Tabs value={active} onValueChange={(next) => goSection(next as SectionId)}>
          <TabsList variant="panel" className="w-fit bg-transparent">
            {shown.map((s, i) => (
              <TabsTrigger key={s.id} value={s.id} variant="panel" className="text-caption">
                <span className="font-mono text-foreground-subtle">{i + 1}</span>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div ref={scroller} onScroll={onScroll} className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-6 pb-8 pt-5">
        {shown.map((s, i) => (
          <Section key={s.id} id={s.id} index={i + 1} label={s.label} question={s.question}>
            {merged[s.id].rows.length > 0 && (
              <dl className="grid grid-cols-3 gap-x-6 gap-y-3">
                {merged[s.id].rows.map((r) => (
                  <div key={`${r.label}-${r.value}`} className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-caption text-foreground-subtle">{r.label}</dt>
                    <dd className="min-w-0 break-keep text-body leading-snug text-foreground">{r.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {merged[s.id].lines.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {merged[s.id].lines.map((l) => (
                  <li key={l} className="flex items-baseline gap-2">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-foreground-subtle" aria-hidden />
                    <span className="min-w-0 break-keep text-body leading-snug text-foreground-muted">{l}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ))}
      </div>
    </FormDialog>
  );
}

/** 절 — 이력의 사건 기록 창과 같은 머리(번호 · 제목 · 질문 · 아래선) */
function Section({ id, index, label, question, children }: { id: SectionId; index: number; label: string; question: string; children: ReactNode }) {
  return (
    <section data-section={id} aria-label={label} className="flex scroll-mt-2 flex-col gap-3">
      <header className="flex items-baseline gap-2 border-b border-border pb-2">
        <span className="font-mono text-body font-semibold text-primary-text">{String(index).padStart(2, "0")}</span>
        <h3 className="text-body font-semibold text-foreground">{label}</h3>
        <span className="truncate text-caption text-foreground-subtle">{question}</span>
      </header>
      {children}
    </section>
  );
}
