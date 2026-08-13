/* ─────────────────────────────────────────────
 * 라우터 밖에서 화면 옮기기
 *
 * 엔진(ScenarioProvider)과 토스트는 라우터 트리 밖에 산다. main.tsx 가 ScenarioProvider
 * 안에 RouterProvider 를 넣기 때문이고, 그래서 useNavigate 를 쓸 수 없다.
 *
 * router 를 정적으로 import 하면 router → pages → ScenarioProvider → 여기 로 모듈 순환이
 * 생긴다. 클릭 시점에 가져오면 초기화 순서에 걸리지 않는다.
 * ───────────────────────────────────────────── */

export async function navigateTo(to: string) {
  const { router } = await import("../router");
  await router.navigate(to);
}
