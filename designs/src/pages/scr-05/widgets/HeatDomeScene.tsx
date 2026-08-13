/* ─────────────────────────────────────────────
 * 열돔 씬 — 폭염일 때 트윈 가운데를 차지하는 그림
 *
 * 트윈의 주인공은 도시 3D 지만, 폭염에는 그 3D 가 말할 것이 없다. 물처럼 차오르는 면도
 * 없고 무너지는 사면도 없다 — 더운 것은 도시 위 공기 기둥이라 도시 배율로는 안 보인다.
 * 그래서 **폭염 동안만 가운데 그림을 열돔 지구본으로 바꾼다.**
 *
 * ★ 트윈 지도에 겹치지 않는다. 겹칠 수가 없다 — 상층 격자가 2°(약 182km)라 도시 배율에서는
 *   화면 전체가 격자 한 칸 안에 들어가 색면이 균일한 한 색이 된다(HeatDomeGlobe 머리말).
 *   지구본은 자기 지도를 따로 만들고, 이 부품은 그것을 3D 씬 위에 통째로 덮는다.
 *
 * 자료(dome)를 밖에서 받는 것은 **읽어 주는 판이 우측 레일에 있기 때문**이다. 판의 시각
 * 슬라이더와 이 지구본이 같은 번호를 봐야 하므로, 자료는 페이지가 하나만 들고 둘에 나눠
 * 준다. 각자 읽으면 판을 밀어도 지구본이 안 따라온다.
 * ───────────────────────────────────────────── */

import { HeatDomeGlobe, type HeatDomeData } from "../../../components/heat-dome";

export function HeatDomeScene({ dome }: { dome: HeatDomeData }) {
  return (
    <HeatDomeGlobe
      lower={dome.lower}
      upper={dome.upper}
      index={dome.index}
      variant="full"
      className="absolute inset-0 z-10"
    />
  );
}
