/* ─────────────────────────────────────────────
 * CCTV 시연 영상 — 연출 그래픽 (04 §2-5)
 *
 * 실제 스트림이 없다. 실황처럼 팔지 않는다 — 이 그래픽을 쓰는 자리는 반드시
 * `시연 영상` 라벨을 함께 세운다(03 §2). 장면은 사건 서사(04 §4-2)의 묘사다:
 *   quay    물양장 수위 상승 — 안벽 계선주 옆으로 수면이 높게 붙어 일렁인다
 *   overtop 해안도로 월파 — 호안 벽을 넘은 물보라가 도로로 비산한다
 *
 * 색은 토큰 밖 리터럴이다 — UI 크롬이 아니라 연출 장면(지도 타일과 같은 취급)이고,
 * 야간 해안 CCTV 의 저채도 톤은 앱 팔레트와 다른 축이다. SMIL 애니메이션이라
 * CSS 주입 없이 스스로 돈다.
 * ───────────────────────────────────────────── */

import { useId } from "react";

interface CctvSceneProps {
  kind: "quay" | "overtop";
  className?: string;
}

export function CctvScene({ kind, className }: CctvSceneProps) {
  /* 한 화면에 타일 여럿이 서므로 defs id 는 인스턴스마다 갈라야 한다.
     useId 의 콜론은 url(#...) 조각에서 브라우저를 타므로 걷는다 */
  const uid = useId().replace(/:/g, "");
  const scanId = `cctv-scan-${uid}`;
  const vignetteId = `cctv-vignette-${uid}`;

  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      width="100%"
      height="100%"
      aria-hidden
    >
      {kind === "quay" ? <QuayScene /> : <OvertopScene />}
      {/* 카메라 질감 — 주사선 + 비네트 */}
      <rect width="320" height="180" fill={`url(#${scanId})`} opacity="0.35" />
      <rect width="320" height="180" fill={`url(#${vignetteId})`} />
      <defs>
        <pattern id={scanId} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="1.4" y="0" fill="#000" opacity="0.5" />
        </pattern>
        <radialGradient id={vignetteId} cx="50%" cy="50%" r="75%">
          <stop offset="62%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/* 물양장 — 왼쪽에 안벽·계선주, 오른쪽에 높게 붙은 수면. 수면 띠가 좌우로 일렁이고
   전체가 천천히 오르내려 "차오르는 중"으로 읽힌다 */
function QuayScene() {
  return (
    <g>
      <rect width="320" height="180" fill="#0b1420" />
      {/* 밤하늘·먼 항만 불빛 */}
      <rect width="320" height="78" fill="#101c2b" />
      <circle cx="252" cy="30" r="1.6" fill="#e8c56a" opacity="0.8" />
      <circle cx="284" cy="42" r="1.3" fill="#e8c56a" opacity="0.6" />
      <circle cx="216" cy="24" r="1.2" fill="#9db4c8" opacity="0.5" />
      {/* 수면 — 안벽 상단 가까이 붙어 있다 */}
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0; 0 -3; 0 0"
          dur="5.2s"
          repeatCount="indefinite"
        />
        <rect x="0" y="78" width="320" height="102" fill="#16283a" />
        <g fill="none" stroke="#3d5c74" strokeWidth="1.6" opacity="0.75">
          <path d="M-40 92 q20 -5 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; 40 2; 80 0"
              dur="4.4s"
              repeatCount="indefinite"
            />
          </path>
          <path d="M-40 112 q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" opacity="0.55">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="80 0; 40 3; 0 0"
              dur="6.1s"
              repeatCount="indefinite"
            />
          </path>
          <path d="M-40 138 q20 -4 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" opacity="0.35">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; 60 0; 120 0"
              dur="7.3s"
              repeatCount="indefinite"
            />
          </path>
        </g>
        {/* 불빛 반사 기둥 */}
        <rect x="248" y="80" width="7" height="52" fill="#e8c56a" opacity="0.14">
          <animate attributeName="opacity" values="0.14;0.24;0.14" dur="3.4s" repeatCount="indefinite" />
        </rect>
      </g>
      {/* 안벽(물양장) — 수면이 상단 턱 바로 아래까지 왔다 */}
      <rect x="0" y="64" width="96" height="116" fill="#1d242c" />
      <rect x="0" y="64" width="96" height="7" fill="#2c3844" />
      <rect x="0" y="71" width="96" height="3" fill="#141a20" />
      {/* 계선주 둘 */}
      <g fill="#39434d">
        <rect x="18" y="50" width="10" height="16" rx="3" />
        <rect x="60" y="52" width="9" height="14" rx="3" />
      </g>
      {/* 안벽에 부딪혀 튀는 물마루 */}
      <g fill="#9fc3d8">
        <circle cx="98" cy="80" r="2">
          <animate attributeName="cy" values="84;70;84" dur="2.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0.9;0" dur="2.6s" repeatCount="indefinite" />
        </circle>
        <circle cx="106" cy="86" r="1.4">
          <animate attributeName="cy" values="88;76;88" dur="3.1s" begin="0.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0.7;0" dur="3.1s" begin="0.8s" repeatCount="indefinite" />
        </circle>
      </g>
    </g>
  );
}

/* 해안도로 — 아래에 도로·차선, 가운데 호안 벽. 파도 물보라가 벽을 넘어 도로 쪽으로
   비산한다. 물보라 입자가 포물선으로 튀어 "월파"로 읽힌다 */
function OvertopScene() {
  return (
    <g>
      <rect width="320" height="180" fill="#0b1420" />
      <rect width="320" height="66" fill="#101c2b" />
      {/* 바다 — 벽 너머에서 크게 일렁인다 */}
      <g>
        <rect x="0" y="66" width="320" height="46" fill="#16283a" />
        <path d="M-40 76 q25 -9 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0" fill="none" stroke="#48708c" strokeWidth="2.2" opacity="0.8">
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 50 -4; 100 0"
            dur="3.8s"
            repeatCount="indefinite"
          />
        </path>
        <path d="M-40 94 q25 -7 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0" fill="none" stroke="#3d5c74" strokeWidth="1.8" opacity="0.5">
          <animateTransform
            attributeName="transform"
            type="translate"
            values="100 0; 50 -2; 0 0"
            dur="5s"
            repeatCount="indefinite"
          />
        </path>
      </g>
      {/* 호안 벽 */}
      <rect x="0" y="106" width="320" height="14" fill="#2c3844" />
      <rect x="0" y="118" width="320" height="4" fill="#141a20" />
      {/* 도로 — 차선 점선 */}
      <rect x="0" y="122" width="320" height="58" fill="#171d24" />
      <g stroke="#8a94a0" strokeWidth="3" strokeDasharray="16 14" opacity="0.55">
        <line x1="0" y1="152" x2="320" y2="152" />
      </g>
      {/* 도로로 번진 물 — 반짝이며 넓어진다 */}
      <ellipse cx="96" cy="132" rx="52" ry="7" fill="#2b455c" opacity="0.55">
        <animate attributeName="rx" values="44;58;44" dur="4.2s" repeatCount="indefinite" />
      </ellipse>
      {/* 월파 물보라 — 벽을 넘는 포물선 입자들 */}
      <g fill="#c9dfec">
        <circle r="3">
          <animateMotion path="M84 106 q16 -34 34 12" dur="1.9s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;0" dur="1.9s" repeatCount="indefinite" />
        </circle>
        <circle r="2.2">
          <animateMotion path="M132 106 q14 -28 30 10" dur="2.3s" begin="0.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0.9;0" dur="2.3s" begin="0.5s" repeatCount="indefinite" />
        </circle>
        <circle r="1.8">
          <animateMotion path="M60 106 q12 -24 26 10" dur="2.6s" begin="1.1s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0.8;0" dur="2.6s" begin="1.1s" repeatCount="indefinite" />
        </circle>
        <circle r="2.6">
          <animateMotion path="M180 106 q15 -30 32 12" dur="2.1s" begin="0.9s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0.85;0" dur="2.1s" begin="0.9s" repeatCount="indefinite" />
        </circle>
      </g>
      {/* 벽 위로 솟는 물마루 */}
      <path d="M70 106 q20 -18 46 0 z" fill="#48708c" opacity="0.7">
        <animate attributeName="d" values="M70 106 q20 -8 46 0 z; M70 106 q20 -22 46 0 z; M70 106 q20 -8 46 0 z" dur="1.9s" repeatCount="indefinite" />
      </path>
      <path d="M160 106 q22 -14 44 0 z" fill="#3d5c74" opacity="0.6">
        <animate attributeName="d" values="M160 106 q22 -6 44 0 z; M160 106 q22 -18 44 0 z; M160 106 q22 -6 44 0 z" dur="2.4s" begin="0.7s" repeatCount="indefinite" />
      </path>
    </g>
  );
}
