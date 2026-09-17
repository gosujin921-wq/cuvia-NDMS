/* ─────────────────────────────────────────────
 * 주요 CCTV 스트립 — IA-01 하단 (IA §6 감시 우선대상의 카메라). IDC LiveStrip 골격 그대로
 *
 * 활성 사건과 감시 우선구역의 카메라를 잇는다. 장면 분석(E7)이 오면 그 컷과 분석 문장이 타일에 선다 —
 * 실제 영상 확인은 사건 작업공간 몫이다. 타일은 16:9 고정, 폭이 남으면 채널을 늘리고 모자라면 줄인다.
 * 타일을 누르면 그 카메라의 사건 작업공간으로 간다.
 * ───────────────────────────────────────────── */

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "@ds";
import { CctvStill } from "../../../components/CctvStill";
import { cctvChannelsAt, findIncident } from "../../../model/selectors";
import { formatClock } from "../../../lib/datetime";
import { useScenario } from "../../../state/ScenarioProvider";

const NAME_SCRIM = "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0) 100%)";
const TILE_GAP = 6;

export function CctvLiveStrip() {
  const navigate = useNavigate();
  const { demoNow: now } = useScenario();
  const channels = useMemo(() => cctvChannelsAt(now), [now]);
  /* 사건이 서면 "우선 확인 CCTV" — 채널이 사건 카메라로 재구성된다는 것을 제목이 말한다 (CSMS CameraStrip) */
  const focused = channels.some((c) => c.incidentId);

  const rowRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(channels.length);
  useLayoutEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const measure = () => {
      const tileW = (el.clientHeight * 16) / 9;
      setVisibleCount(Math.max(1, Math.min(channels.length, Math.floor((el.clientWidth + TILE_GAP) / (tileW + TILE_GAP)))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [channels.length]);

  return (
    <section className="flex h-full flex-col gap-1.5 p-3" aria-label={focused ? "우선 확인 CCTV" : "지구 대표 CCTV"}>
      <div className="flex items-baseline gap-2">
        <h2 className="text-caption font-semibold text-foreground">{focused ? "우선 확인 CCTV" : "지구 대표 CCTV"}</h2>
        <span className="text-caption text-foreground-subtle">촬영 {formatClock(now)}</span>
      </div>
      <div ref={rowRef} className="flex min-h-0 min-w-0 flex-1 gap-1.5 overflow-hidden">
        {channels.length === 0 && <EmptyState variant="inline" icon="mdi:cctv-off" message="감시 우선대상·진행 사건이 없어 표시할 채널이 없습니다." />}
        {channels.slice(0, visibleCount).map((ch) => (
          <button
            key={ch.id}
            type="button"
            onClick={() => {
              const district = ch.incidentId ? findIncident(ch.incidentId)?.legacyDistrictId : undefined;
              navigate(district ? `/scr-02/${district}?evidenceId=${ch.id}` : "/scr-01");
            }}
            className="relative aspect-video h-full shrink-0 cursor-pointer overflow-hidden rounded border-none bg-black p-0 text-left"
            aria-label={`${ch.label} 사건 작업공간에서 열기`}
          >
            <CctvStill src={{ still: ch.still, clip: ch.clip }} className="absolute inset-0" />
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
