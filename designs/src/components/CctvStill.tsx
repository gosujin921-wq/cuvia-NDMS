/* ─────────────────────────────────────────────
 * CCTV 스틸 — 실촬 컷 (04 §2-5)
 *
 * 스트림이 없다. `public/cctv` 의 스틸을 틀고 그 위에 카메라 질감(주사선·비네트)만
 * 얹는다. 이 부품을 쓰는 자리는 채널이 살아 있다는 뜻의 LIVE 라벨을 함께 세운다.
 *
 * 어느 컷을 트는가는 `cctvStillAt(device, now)` 가 정한다. 컴포넌트는 시계를 읽어
 * 넘길 뿐 고르지 않는다 — 격상 프레임에서 스틸이 토스트·핀·그래프와 함께 갈리려면
 * 판단이 한 군데 있어야 한다(CLAUDE.md).
 *
 * 질감 색은 토큰 밖 리터럴이다 — UI 크롬이 아니라 촬영 화면 위의 연출이고(지도 타일과
 * 같은 취급), 테마가 바뀌어도 같아야 한다.
 * ───────────────────────────────────────────── */

import { cn } from "@ds";
import { cctvStillAt, type Device } from "../demo/devices";
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

  /* relative 는 질감 층의 기준틀 — 호출부가 absolute 를 주면 twMerge 가 그쪽을 남긴다 */
  return (
    <div className={cn("relative overflow-hidden bg-black", className)} aria-hidden>
      <img
        src={cctvStillAt(device, now)}
        alt=""
        draggable={false}
        className="size-full object-cover"
      />
      <span className="pointer-events-none absolute inset-0" style={{ background: SCANLINES }} />
      <span className="pointer-events-none absolute inset-0" style={{ background: VIGNETTE }} />
    </div>
  );
}
