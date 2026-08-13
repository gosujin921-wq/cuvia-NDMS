/* ─────────────────────────────────────────────
 * CCTV 화면 — 실촬 컷 (04 §2-5)
 *
 * 스트림이 없다. `public/cctv` 의 실촬분을 틀고 그 위에 카메라 질감(주사선·비네트)만
 * 얹는다. 이 부품을 쓰는 자리는 채널이 살아 있다는 뜻의 LIVE 라벨을 함께 세운다.
 *
 * 실촬분은 두 갈래다. **영상이 등재된 카메라(봉암 배수문·배수펌프장)는 클립을 무한
 * 반복으로 틀고**, 나머지는 스틸 한 장이 그 자리를 받는다. 어느 쪽이든 화면 문법
 * (16:9 · LIVE 라벨 · 질감)은 같아서 호출부는 갈래를 몰라도 된다.
 *
 * 무엇을 트는가는 `cctvClipOf(device)` · `cctvStillAt(device, now)` 가 정한다.
 * 컴포넌트는 시계를 읽어 넘길 뿐 고르지 않는다 — 격상 프레임에서 스틸이 토스트·핀·
 * 그래프와 함께 갈리려면 판단이 한 군데 있어야 한다(CLAUDE.md).
 *
 * 질감 색은 토큰 밖 리터럴이다 — UI 크롬이 아니라 촬영 화면 위의 연출이고(지도 타일과
 * 같은 취급), 테마가 바뀌어도 같아야 한다.
 * ───────────────────────────────────────────── */

import { cn } from "@ds";
import { cctvClipOf, cctvStillAt, type Device } from "../demo/devices";
import { useScenario } from "../state/ScenarioProvider";

/** 주사선 — 4px 주기의 얇은 어두운 선. 더 진하거나 촘촘하면 타일이 블라인드로 읽힌다 */
const SCANLINES =
  "repeating-linear-gradient(to bottom, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 4px)";

/** 비네트 — 가장자리만 떨어뜨린다 */
const VIGNETTE = "radial-gradient(ellipse at center, rgba(0,0,0,0) 62%, rgba(0,0,0,0.55) 100%)";

interface CctvStillProps {
  device: Device;
  className?: string;
}

export function CctvStill({ device, className }: CctvStillProps) {
  const { now } = useScenario();
  const clip = cctvClipOf(device);
  const still = cctvStillAt(device, now);

  /* relative 는 질감 층의 기준틀 — 호출부가 absolute 를 주면 twMerge 가 그쪽을 남긴다 */
  return (
    <div className={cn("relative overflow-hidden bg-black", className)} aria-hidden>
      {clip ? (
        /* muted 없이는 브라우저가 자동재생을 막는다 — 관제 화면에 소리를 낼 자리도 없다.
           playsInline 은 모바일 사파리가 전체화면으로 채가는 것을 막고, poster 는 클립이
           내려오기 전 몇 프레임을 검은 화면 대신 그 카메라의 평시 컷으로 채운다 */
        <video
          src={clip}
          poster={still}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="size-full object-cover"
        />
      ) : (
        <img src={still} alt="" draggable={false} className="size-full object-cover" />
      )}
      <span className="pointer-events-none absolute inset-0" style={{ background: SCANLINES }} />
      <span className="pointer-events-none absolute inset-0" style={{ background: VIGNETTE }} />
    </div>
  );
}
