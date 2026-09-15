/* ─────────────────────────────────────────────
 * 결정 기록 — 훈련 중 "이 대응을 언제부터 한다"를 처음으로 확정하는 자리 (IA §13.1 · 2026-09-15 사용자)
 *
 * 대응 버튼은 미리보기라 아무것도 결정하지 않는다. 이 대화상자에서 [결정 기록]을 눌러야 TrainingRun 에 결정이 쌓이고,
 * 그때부터 지도·시간 줄이 "통제됨 · 통제 중"을 쓴다. 시각·현재 결과·보고 있던 대안은 시스템이 채운다 — 사용자는 대응을 고르고
 * 시작 시각·메모만 손댄다. "17:40 상태에서 · 침수 예상 17:52 를 보고 · 도로 통제를 17:45 부터"가 자동으로 남는다.
 * ───────────────────────────────────────────── */

import { useState } from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, RadioGroup, RadioGroupItem, Textarea } from "@ds";
import { ALTERNATIVE_LABEL, type AlternativeId, type Forecast } from "../../../model/forecast";
import { formatClock } from "../../../lib/datetime";
import { minutesBetween } from "../../../lib/forecast-twin";

export interface DecisionDraft {
  alternativeId: AlternativeId;
  startAt: string;
  memo: string;
}

export function DecisionDialog({ open, onOpenChange, baseline, alternatives, initial, validAt, arrival, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseline: Forecast;
  alternatives: Forecast[];
  /** 대화상자를 열 때 보고 있던 대응 — 기본 선택 */
  initial: Forecast;
  /** 훈련 시각(유효 시각) */
  validAt: string;
  /** 판단 시점 기준 핵심 도달 */
  arrival: { label: string; at: string | null } | null;
  onConfirm: (draft: DecisionDraft) => void;
}) {
  const [pick, setPick] = useState<AlternativeId>(initial.alternativeId);
  const chosen = pick === "baseline" ? baseline : alternatives.find((a) => a.alternativeId === pick) ?? baseline;
  const isBase = pick === "baseline";
  /* 시작 시각 기본값 — 예측판의 대응 시점, 없으면 훈련 시각 5분 뒤 */
  const defaultStart = chosen.actionAt?.at ?? new Date(new Date(validAt).getTime() + 5 * 60_000).toISOString();
  const [startClock, setStartClock] = useState(formatClock(defaultStart));
  const [memo, setMemo] = useState("");
  const remain = arrival?.at ? minutesBetween(new Date(validAt), new Date(arrival.at)) : null;
  const target = chosen.targets[0];
  const valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(startClock);

  const choose = (id: AlternativeId) => {
    setPick(id);
    const f = id === "baseline" ? baseline : alternatives.find((a) => a.alternativeId === id);
    setStartClock(formatClock(f?.actionAt?.at ?? new Date(new Date(validAt).getTime() + 5 * 60_000).toISOString()));
  };
  const confirm = () => {
    if (!isBase && !valid) return;
    /* 시각 입력(hh:mm)을 훈련 날짜 위에 올린다 */
    const day = validAt.slice(0, 11), zone = validAt.slice(19);
    onConfirm({ alternativeId: pick, startAt: `${day}${startClock}:00${zone}`, memo: memo.trim() });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>결정 기록</DialogTitle>
          <DialogDescription>훈련 시각 {formatClock(validAt)} 에 내리는 결정입니다. 기록한 뒤부터 지도와 시간 줄이 이 대응을 실제로 반영합니다.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 text-caption">
          <dt className="text-foreground-muted">현재 훈련 시각</dt>
          <dd className="font-mono text-foreground">{formatClock(validAt)}</dd>

          <dt className="text-foreground-muted">선택한 대응</dt>
          <dd>
            <RadioGroup value={pick} onValueChange={(v) => choose(v as AlternativeId)} className="flex flex-col gap-1">
              {alternatives.map((a) => (
                <label key={a.forecastId} className="flex cursor-pointer items-center gap-2 text-foreground">
                  <RadioGroupItem value={a.alternativeId} id={`decision-${a.alternativeId}`} />
                  {ALTERNATIVE_LABEL[a.alternativeId]}
                </label>
              ))}
              <label className="flex cursor-pointer items-center gap-2 text-foreground-muted">
                <RadioGroupItem value="baseline" id="decision-baseline" />
                대응하지 않음
              </label>
            </RadioGroup>
          </dd>

          {target && (
            <>
              <dt className="text-foreground-muted">대상</dt>
              <dd className="text-foreground">{target.label}</dd>
            </>
          )}
          {!isBase && (
            <>
              <dt className="text-foreground-muted"><Label htmlFor="decision-start">{chosen.actionAt?.label.replace(" 시점", "") ?? "대응"} 시작</Label></dt>
              {/* type=time 은 OS 로캘대로 12시간제(05:45 PM)로 보인다 — 화면 시각 표기(17:45)와 맞추려 텍스트로 받는다 */}
              <dd><Input id="decision-start" inputMode="numeric" pattern="[0-2][0-9]:[0-5][0-9]" placeholder="17:45" value={startClock} onChange={(e) => setStartClock(e.target.value)} className="h-8 w-24 font-mono text-caption" /></dd>
            </>
          )}
          {arrival && (
            <>
              <dt className="text-foreground-muted">판단 근거</dt>
              <dd className="flex flex-col leading-tight text-foreground">
                {arrival.at ? (
                  <>
                    <span>{arrival.label} <span className="font-mono">{formatClock(arrival.at)}</span></span>
                    {remain !== null && <span className={remain > 0 ? "font-mono font-semibold text-warning" : "font-mono text-foreground-muted"}>{remain > 0 ? `${remain}분 남음` : remain === 0 ? "도달" : `${-remain}분 지남`}</span>}
                  </>
                ) : <span>{arrival.label.replace(/ 예상$/, "")} 없음 · 예측 범위 안</span>}
              </dd>
            </>
          )}
          <dt className="text-foreground-muted"><Label htmlFor="decision-memo">메모</Label></dt>
          <dd><Textarea id="decision-memo" value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} placeholder="한 줄이면 됩니다" className="text-caption" /></dd>
        </dl>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={confirm} disabled={!isBase && !valid}>결정 기록</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
