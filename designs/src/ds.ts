/* ─────────────────────────────────────────────
 * DS 단일 진입점 — 이 앱이 디자인시스템을 받는 유일한 경로
 *
 * 제품(cuvia_platform_web)은 DS 를 packages/ui/src/components 배럴로 한 번 감싸고,
 * 소비처는 예외 없이 `@cuvia/ui/components` 한 경로로만 import 한다(297곳). 그래야
 * DS 컴포넌트를 래핑·교체해도 호출부가 안 바뀐다.
 *
 * 이 앱은 그 워크스페이스 밖이라 `@cuvia/ui` 를 물 수 없다. 대신 같은 규칙만 흉내낸다 —
 * 출처를 여기 한 곳으로 모아 두면, 제품으로 옮길 때 이 파일의 재수출 대상만
 * `@cuvia/ui/components` 로 바꾸면 화면 코드는 손대지 않는다.
 *
 * 규칙: 화면·위젯은 `@cuvia/components` 를 직접 import 하지 않는다. 항상 `@ds`.
 * ───────────────────────────────────────────── */

export * from "@cuvia/components";
