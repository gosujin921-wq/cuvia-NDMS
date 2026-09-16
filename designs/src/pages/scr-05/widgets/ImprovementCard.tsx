/* ─────────────────────────────────────────────
 * 개선 항목 — 훈련의 산출물 (README §2.3 · 03 §26.7 · 2026-09-16)
 *
 * 돌려 보고 끝나면 "그래서 뭘 고칠까"가 남아야 한다. 그걸 여기에 사람이 적는다.
 *   ★ 시스템이 개선안 문장을 짓지 않는다 — 지어낸 문장은 근거가 없다.
 *   ★ 축은 임계치 · 데이터 · SOP 셋이다. `모델`은 없다(시뮬레이션 결과로 모델을 고치면 자기 출력을 되먹는다).
 *   ★ 사건 · 분석 기준 시점 · 바꾼 조건은 자동으로 붙는다(`context`). 사람이 다시 적지 않는다.
 * 여기서 적은 것은 예측 검증의 개선 항목과 한 목록으로 쌓이고, 승인 뒤에만 SOP·기준에 반영한다.
 * ───────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { Button, Input, Tag, cn, toast } from "@ds";
import type { ImprovementAxis, ImprovementItem } from "../../../model/whatif";

const AXES: ImprovementAxis[] = ["임계치", "데이터", "SOP"];

export function ImprovementCard({ items, context, canAdd, seed, onClearSeed, onAdd, onRemove }: {
  items: ImprovementItem[];
  /** 지금 보고 있는 것 — 적는 순간 항목에 붙는다 */
  context: string;
  /** 비교를 보고 있을 때만 적을 수 있다 — 근거 없이 적으면 맥락이 빈다 */
  canAdd: boolean;
  /** 규정 줄·결과 줄에서 넘어온 재료 — 축과 근거 한 줄. 고칠 문장은 넘어오지 않는다(사람이 적는다) */
  seed?: { axis: ImprovementAxis; note: string } | null;
  onClearSeed?: () => void;
  onAdd: (axis: ImprovementAxis, text: string, note?: string) => void;
  onRemove: (id: string) => void;
}) {
  const [axis, setAxis] = useState<ImprovementAxis>("SOP");
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  /* 규정 줄·결과 줄의 [개선 항목으로]를 누르면 축이 잡히고 입력칸으로 간다 — 누른 뒤 무엇을 할지가 보여야 한다 */
  useEffect(() => {
    if (!seed) return;
    setAxis(seed.axis);
    inputRef.current?.focus();
  }, [seed]);
  const submit = () => {
    const value = text.trim();
    if (!value) return;
    onAdd(axis, value, seed?.note);
    setText("");
    onClearSeed?.();
    /* 남겼다는 것이 보여야 한다 — 목록이 입력칸 위라 스크롤 위치에 따라 안 보였다(2026-09-16 사용자) */
    toast.success("개선 항목을 남겼습니다", { description: `${axis} · ${value}` });
  };

  return (
    <section className="flex flex-col gap-2 p-3" aria-label="개선 항목">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-body font-semibold text-foreground">개선 항목</h2>
        {/* 몇 건인지 늘 보인다 — 여러 건을 남길 수 있다는 것이 여기서 읽힌다 */}
        <span className="truncate text-caption text-foreground-subtle">{items.length > 0 ? `${items.length}건 남김` : "훈련에서 남길 것"}</span>
      </header>

      {items.length > 0 && (
        <ul className="flex flex-col gap-1">
          {items.map((it) => (
            <li key={it.id} className="group flex items-start gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-caption">
              <Tag className="shrink-0">{it.axis}</Tag>
              <span className="min-w-0 flex-1 break-keep leading-snug text-foreground">
                {it.text}
                <span className="mt-0.5 block text-foreground-subtle">{it.context}</span>
              </span>
              <button
                type="button"
                onClick={() => onRemove(it.id)}
                aria-label="개선 항목 지우기"
                className="shrink-0 cursor-pointer rounded p-0.5 text-foreground-subtle opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Icon icon="mdi:close" className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {canAdd ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1">
            {AXES.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAxis(a)}
                aria-pressed={axis === a}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-0.5 text-caption transition-colors",
                  axis === a ? "border-primary-text bg-primary text-primary-foreground" : "border-border bg-card text-foreground-muted hover:text-foreground",
                )}
              >
                {a}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <Input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
              placeholder="무엇을 고칠지 한 줄로"
              className="text-caption"
              aria-label="개선 항목 내용"
            />
            <Button size="sm" variant="secondary" onClick={submit} disabled={!text.trim()} className="shrink-0">
              남기기
            </Button>
          </div>
          <p className="break-keep text-caption text-foreground-subtle">
            <span className="text-foreground-muted">함께 남는 것</span> · {context}
            {/* 규정 줄·결과 줄에서 넘어온 근거는 따로 보여 준다 — 무엇을 보고 적는지가 입력칸 옆에 있어야 한다 */}
            {seed && (
              <span className="mt-0.5 flex items-baseline gap-1">
                <span className="text-foreground-muted">근거</span>
                <span className="min-w-0 flex-1 text-foreground">{seed.note}</span>
                {onClearSeed && (
                  <button type="button" onClick={onClearSeed} className="shrink-0 cursor-pointer text-foreground-subtle hover:text-foreground">
                    빼기
                  </button>
                )}
              </span>
            )}
          </p>
        </div>
      ) : (
        <p className="break-keep text-caption text-foreground-muted">상황을 얹거나 분기를 고르면 그 비교를 근거로 적을 수 있습니다.</p>
      )}
    </section>
  );
}
