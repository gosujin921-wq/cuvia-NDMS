/**
 * CUVIA 심볼 마크.
 *
 * 원본은 public/simbol.svg(fill 고정 #2160ad)를 <img> 로 불러와 흰색으로
 * 만들려고 `filter: brightness(0) invert(100%)` 를 붙였다(전역 29곳 반복).
 * 여기서는 인라인 SVG + currentColor 로 바꿔 필터 없이 색을 상속받는다.
 */
export function AgentSymbol({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 57.5 51.66"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <polygon points="19.23 23.24 29.28 5.81 41.39 5.81 49.16 19.28 55.87 19.28 44.74 0 25.93 0 15.87 17.42 19.23 23.24" />
      <polygon points="41.39 45.85 11.56 45.85 14.92 51.66 44.74 51.66 55.87 32.38 49.16 32.38 41.39 45.85" />
      <polygon points="43.89 36.31 12.76 36.31 3.36 20.02 0 25.83 9.41 42.12 40.54 42.12 43.89 36.31" />
      <polygon points="22.28 33.71 12.22 16.29 21.62 0 14.92 0 5.51 16.29 15.57 33.71 22.28 33.71" />
      <path d="M53.72,22.05c-2.08,0-3.78,1.69-3.78,3.78s1.7,3.78,3.78,3.78,3.78-1.69,3.78-3.78-1.69-3.78-3.78-3.78Z" />
    </svg>
  );
}
