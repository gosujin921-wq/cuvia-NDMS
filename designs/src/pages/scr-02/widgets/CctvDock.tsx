/* ─────────────────────────────────────────────
 * 현장영상 — 사건 작업공간 하단 (IA §7 영상·현장). Phase 1 현장영상 도크의 골격 그대로
 *
 * 사건 카메라 채널을 잇는다. 장면 분석(E7)이 오면 그 컷과 신뢰도가 타일에 선다. 타일을 누르면 화면 가운데
 * 큰 오버레이(CctvBigView)가 열린다 — 실제 영상 확인은 담당자의 행동이다(02 D2).
 * ───────────────────────────────────────────── */

import { EmptyState } from "@ds";
import { CctvStill } from "../../../components/CctvStill";
import type { CctvChannelView } from "../../../model/selectors";
import { formatClock } from "../../../lib/datetime";
import { useScenario } from "../../../state/ScenarioProvider";

const NAME_SCRIM = "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0) 100%)";

export function CctvDock({ channels, onSelect }: { channels: CctvChannelView[]; onSelect: (channel: CctvChannelView) => void }) {
  const { demoNow: now } = useScenario();
  return (
    <section className="flex h-full flex-col gap-1.5 p-3" aria-label="현장영상">
      <div className="flex items-baseline gap-2">
        <h2 className="text-caption font-semibold text-foreground">현장영상</h2>
        <span className="text-caption text-foreground-subtle">촬영 {formatClock(now)}</span>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 gap-1.5 overflow-hidden">
        {channels.length === 0 && <EmptyState variant="inline" icon="mdi:cctv-off" message="이 사건에 연결된 CCTV 가 없습니다." />}
        {channels.map((ch) => (
          <button key={ch.id} type="button" onClick={() => onSelect(ch)} className="relative aspect-video h-full shrink-0 cursor-pointer overflow-hidden rounded border-none bg-black p-0 text-left" aria-label={`${ch.label} 영상 열기`}>
            <CctvStill src={{ still: ch.still }} className="absolute inset-0" />
            <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-surface px-1.5 py-0.5 text-caption text-foreground">
              <span className="size-1.5 animate-pulse rounded-full bg-danger" aria-hidden />
              LIVE
            </span>
            {ch.analysis && <span className="absolute right-1.5 top-1.5 rounded bg-surface px-1.5 py-0.5 text-caption text-warning">분석 {Math.round(ch.analysis.confidence * 100)}%</span>}
            <span className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: "44%", background: NAME_SCRIM }} aria-hidden />
            <span className="pointer-events-none absolute bottom-1.5 left-2 right-2 flex flex-col text-caption">
              <span className="truncate text-white">{ch.label}</span>
              <span className="truncate text-white/70">{ch.analysis?.description ?? ch.scene}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
