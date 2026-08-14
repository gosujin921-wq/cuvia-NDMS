/* ─────────────────────────────────────────────
 * CCTV 크게 보기 — KISA·SK 관제 대시보드 이식분
 *
 * 원본: cuvia_platform_web `features/dashboard-kisa/components/cctv-strip.tsx` CctvBigView.
 * 두 프로필(kisa·sk)이 같은 부품을 쓴다 — CCTV 핀이든 미리보기 타일이든, 누르면 지도
 * 위에 앵커된 작은 팝업이 아니라 **화면 가운데 큰 오버레이**가 뜬다. DSMS 만 300px
 * 마커 팝업으로 열려 있어 같은 조작이 제품마다 다른 화면을 냈다.
 *
 * 골격·간격·연출을 원본 그대로 옮겼다: 딤(.55 + blur) 위 글래스 면, 우상단 코너 닫기,
 * 제목 줄(이름 + 흐린 위치), 616px 16:9 영상 칸, 상단 스크림, 좌상단 둥근 검은 필 라벨.
 *
 * DSMS 로 오면서 갈린 곳만 셋이다:
 *   · **면을 DS Modal 이 든다.** 원본은 지도 컨테이너 안에만 딤을 깔아야 해서 오버레이를
 *     손으로 짰지만(그래서 닫기 자리도 `DS ModalContent 는 top-4 right-4` 라고 주석으로
 *     흉내냈다), DSMS 는 화면 전체를 덮는다 — 집중 팝업(ExecutionPopup)과 같은 규격이라
 *     ModalContent 를 그대로 쓴다. 딤 값·닫기 자리·ESC·포커스 복귀가 공짜로 따라온다
 *   · **영상은 `CctvStill` 이 든다.** 원본의 WebRTC 플레이어 자리다 — 이 데모에는 스트림이
 *     없고 실촬 클립·스틸이 그 자리를 받는다(04 §2-5). PTZ 사이드 패널은 조작할 API 가
 *     없어 옮기지 않았다
 *   · **라벨은 `LIVE` 다.** 원본 대시보드는 `실시간` 이지만 DSMS 는 도크·스트립·관제 팝업
 *     셋이 이미 LIVE 로 서 있다(04 §2-5). 필 모양·색·점멸은 원본 그대로 두고 낱말만 맞춘다
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Modal, ModalContent, ModalTitle } from "@ds";
import { CctvStill } from "./CctvStill";
import { cctvSceneOf, type Device } from "../demo/devices";
import { formatClock } from "../lib/datetime";
import { useScenario } from "../state/ScenarioProvider";

/** 상단 스크림 — 좌상단 라벨이 밝은 화면 위에서도 읽히게. 원본 값 그대로 */
const TOP_SCRIM =
  "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0) 100%)";

/** 신호 없는 화면의 바탕 — 토큰 밖 리터럴이다. UI 크롬이 아니라 꺼진 모니터 면이고
    (CctvStill 의 질감 색과 같은 취급), 테마가 바뀌어도 같아야 한다. 원본 값 그대로 */
const OFFLINE_SURFACE = "#393a42";

export function CctvBigView({ device, onClose }: { device: Device; onClose: () => void }) {
  const { now } = useScenario();
  const scene = cctvSceneOf(device);
  const offline = device.status !== "정상";

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <ModalContent
        /* 글라스 면 · 딤 규격 전부 원본 값 — 모달 rgba(0,0,0,.55) + blur 4px.
           관제요원은 같은 지도에서 사건 → 집중 팝업, CCTV 핀 → 이 화면을 번갈아 여는데,
           둘 중 하나만 딤이 옅고 뒤가 안 흐려지면 "이건 다른 층위인가"로 읽힌다 */
        variant="glass"
        overlayClassName="duration-200 bg-black/55 backdrop-blur-xs"
        className="w-fit max-w-[calc(100%-2rem)] gap-0 p-3 sm:max-w-[85%]"
        /* 본문이 영상 한 칸이라 설명 줄이 없다 — Radix 의 aria-describedby 경고를 끈다 */
        aria-describedby={undefined}
        /* 열자마자 닫기 버튼에 포커스 링이 그려지는 것을 막는다. DS 닫기는 `focus:ring-2`
           (focus-visible 이 아니다)라, Radix 가 프로그램으로 옮긴 포커스에도 파란 테가 뜬다 —
           영상 한 칸이 본문인 화면에서 그 테가 먼저 읽힌다. 원본에도 없다. ESC·바깥 클릭은
           document 에 걸린 DismissableLayer 몫이라 포커스와 무관하게 그대로 닫힌다 */
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* 제목 줄 — 이름 + 흐린 위치. pr-8 은 우상단 코너 닫기 자리를 비운다.
            원본은 이름이 `CCTV 01` 같은 코드라 font-mono 였다. DSMS 이름은 한글 지점명이라
            mono 로 세우면 대체 서체로 떨어져 도크·스트립의 같은 이름과 어긋난다 */}
        <div className="flex items-center gap-2 pr-8 pb-2">
          <ModalTitle className="min-w-0 flex-1 truncate text-body font-semibold text-foreground">
            {device.name}
            <span className="ml-1.5 font-normal text-muted-foreground">{device.address}</span>
          </ModalTitle>
        </div>

        <div className="flex gap-3">
          <div className="relative aspect-video w-[616px] max-w-full min-w-0 overflow-hidden rounded-md border border-border">
            {offline ? (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: OFFLINE_SURFACE }}
              >
                <Icon
                  icon="mdi:video-off-outline"
                  className="size-12 text-foreground-subtle"
                  aria-hidden
                />
              </div>
            ) : (
              <CctvStill device={device} className="absolute inset-0" />
            )}

            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-1/4"
              style={{ background: TOP_SCRIM }}
              aria-hidden
            />

            <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-caption backdrop-blur-sm">
              {offline ? (
                <span className="font-medium text-white/90">{device.status}</span>
              ) : (
                <>
                  <span
                    className="size-1.5 shrink-0 animate-pulse rounded-full bg-danger"
                    aria-hidden
                  />
                  <span className="font-medium text-white">LIVE</span>
                  {scene && (
                    <>
                      <span className="text-white/40">·</span>
                      <span className="text-white/70">
                        {scene.scene} · {scene.bearing}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>

            {/* 촬영 시각 — 원본에 없는 한 칸이다. 시연 시계는 도중에 뛰고(S8) 화면 요소가
                같은 프레임에서 함께 바뀌어야 하는데(CLAUDE.md), 영상만 시각을 안 들면
                도크의 `촬영 09:01` 과 이 화면이 언제 것인지 서로 말이 달라진다.
                라벨과 같은 필 문법이라 원본 문법을 깨지 않는다 */}
            <div className="absolute bottom-3 right-3 z-10 rounded-full bg-black/60 px-2.5 py-1 font-mono text-caption text-white/90 backdrop-blur-sm">
              {formatClock(now)}
            </div>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
