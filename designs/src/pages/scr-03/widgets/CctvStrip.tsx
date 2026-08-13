/* ─────────────────────────────────────────────
 * 현장 CCTV 썸네일 — 03 화면정의서 §3 중앙 하단
 *
 * 숫자로 판단이 서지 않을 때 눈으로 확인하는 자리. 선택한 이벤트의 지구 CCTV 를 4분할로
 * 건다. 지구에 CCTV 가 4대보다 적으면 빈 칸을 남긴다. 남는 칸을 다른 지구 화면으로 채우면
 * 어느 마을을 보고 있는지 흐려진다.
 *
 * 타일 문법은 KISA 관제 대시보드의 CCTV 미리보기를 따른다
 * (cuvia_platform_web / features/dashboard-kisa/components/cctv-strip.tsx):
 *   패널 제목 + 대수 → 타일 그리드. 타일은 aspect-video · 기준 폭 200px 이상 ·
 *   검은 화면 + 스캔라인, 좌상단 상태 뱃지, 하단 그라데이션 위에 이름·설치 지점.
 * 지도 위 오버레이라 가운데 영역(CENTER_SPAN) 전체 폭을 쓴다 — 폭을 좁히면 4분할이
 * 썸네일보다 작아져 현장을 눈으로 확인하는 자리 구실을 못 한다.
 *
 * 데모에는 실제 스트림이 없다. 채널이 살아 있다는 표시만 둔다(03 §2).
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { EmptyState, StatusBadge, cn } from "@ds";
import type { Device } from "../../../demo/devices";

/** 4분할 고정 — 정본 §3 */
const SLOTS = 4;

/* 영상 위 연출 두 가지 — DS 토큰이 없는 자리다.
   영상 픽셀은 테마 색이 아니라 촬영 장면이라, 그 위에 얹는 주사선·가독 그라데이션은
   테마가 바뀌어도 같은 값이어야 한다. 그래서 토큰화 대상이 아니고, 대신 이름을 붙여
   타일 마크업에서 값이 안 보이게 둔다. 값은 KISA cctv-strip.tsx 와 같다. */
const SCANLINE =
  "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.8) 2px, rgba(255,255,255,0.8) 3px)";
const NAME_SCRIM =
  "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0) 100%)";

export function CctvStrip({ cameras }: { cameras: Device[] }) {
  const feeds = cameras.slice(0, SLOTS);
  const slots = [...feeds, ...Array(Math.max(0, SLOTS - feeds.length)).fill(null)];

  return (
    <section className="flex w-full flex-col gap-2 p-2.5" aria-label="현장 CCTV">
      <div className="flex items-center gap-2">
        <h2 className="text-body font-semibold text-foreground">현장 CCTV</h2>
        <span className="font-mono text-caption text-foreground-muted">
          {feeds.length} / {SLOTS}대
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {slots.map((camera: Device | null, index) =>
          camera ? (
            <CctvTile key={camera.id} camera={camera} />
          ) : (
            /* 빈 슬롯 — 정본(KISA cctv-strip)과 같이 DS EmptyState 로 낸다.
               "채널이 죽었다"가 아니라 "여기 카메라가 없다"는 뜻이라 점선 테두리로 구분한다 */
            <div
              key={`empty-${index}`}
              className="flex aspect-video min-w-0 items-center justify-center rounded-md border border-dashed border-border"
            >
              <EmptyState variant="inline" icon="mdi:video-off-outline" message="미설치" />
            </div>
          ),
        )}
      </div>
    </section>
  );
}

function CctvTile({ camera }: { camera: Device }) {
  const online = camera.status === "정상";

  return (
    <div
      className={cn(
        "relative aspect-video min-w-0 overflow-hidden rounded-md border",
        online ? "border-border" : "border-danger",
      )}
    >
      {online ? (
        /* 실제 스트림이 없다. 검은 화면 위에 주사선만 아주 옅게 깔아 "송출 중"으로 읽히게 한다 */
        <div className="absolute inset-0 bg-black">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: SCANLINE }}
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-10">
            <Icon icon="mdi:cctv" className="size-7 text-white" aria-hidden />
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-raised">
          <Icon icon="mdi:video-off" className="size-7 text-foreground-subtle" aria-hidden />
        </div>
      )}

      <StatusBadge
        status={online ? "live" : "offline"}
        label={online ? "LIVE" : camera.status}
        className="absolute left-2 top-2 z-10"
      />

      {/* 이름표는 화면 위에 얹힌다. 그라데이션을 깔아야 밝은 장면에서도 글자가 읽힌다 */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5]"
        style={{ height: "44%", background: NAME_SCRIM }}
        aria-hidden
      />
      <div className="pointer-events-none absolute bottom-1.5 left-2 z-10 flex max-w-[calc(100%-1rem)] items-center gap-1.5 text-caption">
        <span className="truncate font-mono text-white">{camera.name}</span>
        <span className="min-w-0 truncate text-white/70">{camera.spot}</span>
      </div>
    </div>
  );
}
