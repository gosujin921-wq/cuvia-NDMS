/* ─────────────────────────────────────────────
 * 현장영상 — 03 화면정의서 §2 하단 · 04 §2-5
 *
 * 화면 하단 전폭 스트립. SCR-01 주요 CCTV 스트립(IDC LiveStrip 선례)과 같은 골격이다:
 * 머리 행(제목·촬영 시각) 위, 16:9 타일 행 아래. 좌우 레일은 스트립 위에서 끝난다.
 * 채널은 그 지구의 주요 CCTV 2대(04 §2-5)로 고정이라 SCR-01 의 장수 실측은 필요 없다.
 *
 * 장면이 등재된 카메라는 `시연 영상` 라벨을 명시한 연출 그래픽을 틀고, 등재가 없으면
 * LIVE 자리 표시만 세운다. 실황처럼 팔지 않는다(04 §2-5).
 *
 * 타일을 누르면 지도의 그 CCTV 팝업이 열린다 — S3 에서 핀이 많아 짚기 어려울 때의
 * 대체 경로다(05 S3).
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { EmptyState } from "@ds";
import { cctvSceneOf, type Device } from "../../../demo/devices";
import { CctvScene } from "../../../components/CctvScene";
import { formatClock } from "../../../lib/datetime";
import { useScenario } from "../../../state/ScenarioProvider";

/* 이름표 가독 그라데이션 — SCR-01 CctvLiveStrip · SCR-03 CctvStrip 과 같은 값.
   영상 픽셀은 테마 색이 아니라 촬영 장면이라 그 위에 얹는 연출은 테마와 무관하다 */
const NAME_SCRIM =
  "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0) 100%)";

interface CctvDockProps {
  /** aria 표기용 지구명 */
  districtName: string;
  /** 세울 카메라 — 페이지가 featuredCctvOf 로 뽑아 넘긴다 (04 §2-5) */
  cctvs: Device[];
  onSelect: (device: Device) => void;
}

export function CctvDock({ districtName, cctvs, onSelect }: CctvDockProps) {
  const { now } = useScenario();

  return (
    <section className="flex h-full flex-col gap-1.5 p-3" aria-label={`${districtName} 현장영상`}>
      <div className="flex items-baseline gap-2">
        <h2 className="text-caption font-semibold text-foreground">현장영상</h2>
        <span className="text-caption text-foreground-subtle">촬영 {formatClock(now)}</span>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 gap-1.5 overflow-hidden">
        {cctvs.length === 0 && (
          <EmptyState variant="inline" icon="mdi:cctv-off" message="이 지구에 등재된 CCTV 가 없습니다." />
        )}
        {cctvs.map((device) => {
          const scene = cctvSceneOf(device);
          const offline = device.status !== "정상";
          return (
            <button
              key={device.id}
              type="button"
              onClick={() => onSelect(device)}
              className="relative aspect-video h-full shrink-0 cursor-pointer overflow-hidden rounded border-none bg-black p-0 text-left"
              aria-label={`${device.name} 팝업 열기`}
            >
              {offline ? (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  <Icon icon="mdi:video-off" className="size-5 text-foreground-subtle" aria-hidden />
                  <span className="text-caption text-foreground-subtle">{device.status}</span>
                </span>
              ) : scene ? (
                <>
                  <CctvScene kind={scene.kind} className="absolute inset-0" />
                  {/* 연출임을 화면에서 밝힌다 — LIVE 로 팔지 않는다 (04 §2-5) */}
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

              {/* 이름표 스크림 — SCR-01 CctvLiveStrip 과 같은 타일 문법 */}
              <span
                className="pointer-events-none absolute inset-x-0 bottom-0"
                style={{ height: "44%", background: NAME_SCRIM }}
                aria-hidden
              />
              <span className="pointer-events-none absolute bottom-1.5 left-2 right-2 flex flex-col text-caption">
                <span className="truncate text-white">{device.name}</span>
                {scene && (
                  <span className="truncate text-white/70">
                    {scene.scene} · {scene.bearing}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
