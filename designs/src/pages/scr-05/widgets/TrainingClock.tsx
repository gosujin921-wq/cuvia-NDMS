/* ─────────────────────────────────────────────
 * 훈련 시계 — 지도 하단 (03 §26.4 · 2026-09-16 v2)
 *
 * 정지점은 **새로 결정할 일이 생기는 시각**이다. 시계는 여기서만 선다.
 *   판단 국면  조치를 정한다. 물이 오기 전이라 지도는 거의 안 바뀐다
 *   결과 국면  조치 창이 닫히고 결과가 나온다. 지도가 바뀐다
 *
 * ★ 훈련 중에는 **진행 표시**다. 누르는 자리가 아니다 — 시간을 되돌릴 수 없으므로
 *   기존 시간표처럼 드래그 손잡이를 두면 고장으로 보인다. 앞으로 갈 길은 점선이다.
 * ★ 강평에서는 누를 수 있다. 복기라서 시각을 오가며 지도를 본다(조치는 바꿀 수 없다).
 * ───────────────────────────────────────────── */

import { cn } from "@ds";
import { formatClock } from "../../../lib/datetime";
import type { TrainingScenario } from "../../../model/whatif";

export function TrainingClock({ stops, index, replay, onPick, flow, rising, waiting }: {
  stops: TrainingScenario["stops"];
  index: number;
  /** 강평인가 — 그때만 누를 수 있다 */
  replay?: boolean;
  onPick?: (i: number) => void;
  /** 정지점 사이를 흐르는 중 — 시각과 진행 막대가 따라 흐른다 */
  flow?: { to: number; p: number; at: string } | null;
  /** 물이 실제로 오는 구간인가 — 판단 → 판단은 지도가 거의 그대로다(와이어프레임 §정지점 설계) */
  rising?: boolean;
  /** 판단 국면 — 조치를 정하는 동안 시간은 가지 않는다 */
  waiting?: boolean;
}) {
  const st = stops[index];
  if (!st) return null;
  /* 정지점을 같은 간격으로 놓는다 — 시각 비례로 놓으면 판단 둘이 왼쪽 끝에 뭉친다(14:35·14:55) */
  const at = (i: number) => 6 + (i / Math.max(1, stops.length - 1)) * 88;
  /* 흐르는 중에는 막대와 시각이 두 정지점 사이에 선다 */
  const pos = flow ? at(index) + (at(flow.to) - at(index)) * flow.p : at(index);
  const clock = flow ? flow.at : st.at;

  return (
    <div className="pointer-events-auto rounded-lg border border-border bg-surface/95 px-3.5 py-2.5 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[20px] font-bold leading-none tracking-tight text-foreground tabular-nums">{formatClock(clock)}</span>
        <span className={cn("shrink-0 rounded border px-1.5 py-0.5 text-caption",
          flow ? "border-primary-text text-primary-text" : replay ? "border-primary-text text-primary-text" : st.phase === "결과" ? "border-success text-success" : "border-warning text-warning")}>
          {flow ? "시간 흐름" : replay ? "복기" : `${st.phase} 국면`}
        </span>

        <span className="relative mx-1 h-1 flex-1 rounded-full bg-border">
          <i className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pos}%` }} aria-hidden />
          {/* 앞으로 갈 길 — 아직 일어나지 않은 일이라 점선이다 */}
          {!replay && <span className="absolute right-0 top-0 h-0 border-t-2 border-dotted border-border-light" style={{ left: `${pos}%` }} aria-hidden />}
          {stops.map((s, i) => (
            <span key={s.at}>
              <u className={cn("absolute top-[-4px] h-3 w-0.5 rounded-sm", i <= index ? "bg-primary-text" : "bg-border-light")} style={{ left: `${at(i)}%` }} aria-hidden />
              <button
                type="button"
                disabled={!replay}
                onClick={() => onPick?.(i)}
                className={cn("absolute top-2.5 -translate-x-1/2 whitespace-nowrap rounded px-1 font-mono text-caption",
                  s.phase === "판단" ? "text-warning" : "text-success",
                  i === index && "font-bold",
                  replay ? "cursor-pointer hover:bg-surface-raised hover:text-foreground" : "cursor-default")}
                style={{ left: `${at(i)}%` }}
              >
                {formatClock(s.at)}
              </button>
            </span>
          ))}
        </span>
      </div>

      {/* 정지점 라벨(위 눈금 아래에 붙는다)과 겹치지 않게 한 칸 띄운다.
          ★ 좁은 창에서는 글줄을 **자른다**. 좌우 레일 사이가 바의 폭이라 1100px 에서는 100px 남짓이 되는데,
             그때 줄바꿈이나 넘침을 두면 옆 버튼 위로 글자가 겹쳐 뭉개진다(2026-09-17 측정).
          ★ 그래서 문구가 **짧다**. `[다음 단계]를 누르세요` 같은 안내는 뺐다 — 그 버튼이 바로 옆에 크게 서 있다 */}
      <p className="mt-5 flex overflow-hidden whitespace-nowrap text-caption text-foreground-subtle">
        {flow ? (
          /* 판단 → 판단 구간은 같은 예측 눈금이라 지도가 거의 그대로다. 그때 "물이 차오른다"고
             하면 화면이 지키지 못할 약속을 한다 — 물이 오는 것은 결과 국면의 약속이다 */
          <span className="text-primary-text">
            {rising ? "물이 차오르는 것을 보세요" : "물은 아직 오지 않았습니다"}
          </span>
        ) : waiting ? (
          <span className="text-warning">조치를 정하는 동안 시간은 가지 않습니다</span>
        ) : replay ? (
          <span>눌러서 그 시각으로 돌아가 봅니다</span>
        ) : (
          /* 결과 국면 — 조치 창은 닫혔다. 국면 범례 세 조각을 늘어놓던 자리인데,
             레일 사이 폭에서 조각마다 줄바꿈이 나 읽히지 않았다(2026-09-16). 지금 국면 한 줄만 든다 */
          <span className="text-success">판단 끝 · 결과를 봅니다</span>
        )}
      </p>
    </div>
  );
}
