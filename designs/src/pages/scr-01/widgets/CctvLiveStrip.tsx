/* ─────────────────────────────────────────────
 * 주요 CCTV 스트립 (03 화면정의서 §1 하단 전폭 · 04 §2-5)
 *
 * IDC SCR-01 하단 LIVE 스트립 선례. 사건군(04 §4-7) 지구의 현장영상 카메라를 지구
 * 순서대로 잇는다(서항 2 · 명동항 2 · 구항 2). 장면 등재분은 `시연 영상` 라벨의
 * 연출 그래픽을 틀고, 없는 카메라는 LIVE 자리 표시만 선다. 실황처럼 팔지 않는다.
 *
 * 타일은 16:9 고정. 폭이 남으면 채널을 늘리고 모자라면 줄인다(앞 = 우선순위 ·
 * IDC LiveStrip 실측 패턴). 타일을 누르면 그 지구 재난관제(SCR-02)로 가고
 * 그 카메라가 선택된다(차수 K 선택 장비).
 * ───────────────────────────────────────────── */

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { EmptyState } from "@ds";
import { CctvScene } from "../../../components/CctvScene";
import { cctvSceneOf, featuredCctvOf, type Device } from "../../../demo/devices";
import { majorDisasterAt } from "../../../demo/events";
import { formatClock } from "../../../lib/datetime";
import { useScenario } from "../../../state/ScenarioProvider";

/* 이름표 가독 그라데이션. SCR-02 CctvDock 과 같은 값이다. 영상 픽셀은 테마 색이
   아니라 촬영 장면이라 그 위에 얹는 연출은 테마와 무관하게 같아야 한다 */
const NAME_SCRIM =
  "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0) 100%)";

/** 타일 사이 간격 (px) — gap-1.5 */
const TILE_GAP = 6;

export function CctvLiveStrip() {
  const navigate = useNavigate();
  const { now, selectDevice } = useScenario();

  /* 채널 = 사건군 지구의 현장영상 카메라(04 §2-5). 사건군이 줄면(S8 서항 해제)
     채널도 같은 프레임에 따라 줄어든다 */
  const channels = useMemo(
    () => (majorDisasterAt(now)?.events ?? []).flatMap((e) => featuredCctvOf(e.districtId)),
    [now],
  );

  /* 타일 폭 = 높이 × 16/9. 행 폭에 들어가는 장수를 실측으로 센다(IDC LiveStrip) */
  const rowRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(channels.length);
  useLayoutEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const measure = () => {
      const tileW = (el.clientHeight * 16) / 9;
      setVisibleCount(
        Math.max(
          1,
          Math.min(channels.length, Math.floor((el.clientWidth + TILE_GAP) / (tileW + TILE_GAP))),
        ),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [channels.length]);

  const open = (device: Device) => {
    selectDevice(device.id);
    navigate(`/scr-02/${device.districtId}`);
  };

  return (
    /* 헤더 행 위 + 타일 행 아래. IDC LiveStrip 과 같은 골격이다 — 타이틀을 좌측 열로
       세우면(SCR-02 현장영상 문법) 전폭 스트립에서는 빈 열만 길게 남는다 */
    <section className="flex h-full flex-col gap-1.5 p-3" aria-label="주요 CCTV">
      <div className="flex items-baseline gap-2">
        <h2 className="text-caption font-semibold text-foreground">주요 CCTV</h2>
        <span className="text-caption text-foreground-subtle">촬영 {formatClock(now)}</span>
      </div>

      <div ref={rowRef} className="flex min-h-0 min-w-0 flex-1 gap-1.5 overflow-hidden">
        {channels.length === 0 && (
          <EmptyState
            variant="inline"
            icon="mdi:cctv-off"
            message="진행 중인 사건군이 없어 표시할 채널이 없습니다."
          />
        )}
        {channels.slice(0, visibleCount).map((device) => {
          const scene = cctvSceneOf(device);
          const offline = device.status !== "정상";
          return (
            <button
              key={device.id}
              type="button"
              onClick={() => open(device)}
              className="relative aspect-video h-full shrink-0 cursor-pointer overflow-hidden rounded border-none bg-black p-0 text-left"
              aria-label={`${device.name} 재난관제에서 열기`}
            >
              {offline ? (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  <Icon icon="mdi:video-off" className="size-5 text-foreground-subtle" aria-hidden />
                  <span className="text-caption text-foreground-subtle">{device.status}</span>
                </span>
              ) : scene ? (
                <>
                  <CctvScene kind={scene.kind} className="absolute inset-0" />
                  {/* 연출임을 화면에서 밝힌다. LIVE 로 팔지 않는다 (04 §2-5) */}
                  <span className="absolute left-1.5 top-1.5 rounded bg-surface px-1.5 py-0.5 text-caption text-foreground">
                    시연 영상
                  </span>
                </>
              ) : (
                <>
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Icon icon="mdi:cctv" className="size-6 text-foreground-subtle" aria-hidden />
                  </span>
                  <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-surface px-1.5 py-0.5 text-caption text-foreground">
                    <span className="size-1.5 animate-pulse rounded-full bg-danger" aria-hidden />
                    LIVE
                  </span>
                </>
              )}

              {/* 이름표 스크림. SCR-02 CctvDock · SCR-03 CctvStrip 과 같은 타일 문법 */}
              <span
                className="pointer-events-none absolute inset-x-0 bottom-0"
                style={{ height: "44%", background: NAME_SCRIM }}
                aria-hidden
              />
              <span className="pointer-events-none absolute bottom-1.5 left-2 right-2 flex flex-col text-caption">
                <span className="truncate text-white">{device.name}</span>
                {scene && <span className="truncate text-white/70">{scene.scene}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
