/* ─────────────────────────────────────────────
 * 열돔 패널 — 디지털트윈 우측 레일에 서는 부품
 *
 * 두 겹으로 되어 있다:
 *  · 숫자  — 창원 상공 두 층의 값과 판정. 지도가 없어도 성립한다
 *  · 지구본 — 왜 그 값이 나오는지. 곁에 따로 띄운 작은 지도다
 *
 * 트윈 본 지도에 얹지 않는 이유는 HeatDomeGlobe 머리말에 있다 — 격자가 2°(약 182km)라
 * 도시 배율에서는 화면 전체가 격자 한 칸 안에 들어간다.
 *
 * 트윈의 주인공은 도시 3D 이고 열돔은 **그 도시가 왜 뜨거운지를 대는 배경**이다.
 * 그래서 레일 한 칸을 차지하되 지도만큼 크지 않게 둔다.
 * ───────────────────────────────────────────── */

import { HeatDomeGlobe } from "./HeatDomeGlobe";
import { HeatDomeReadout } from "./HeatDomeReadout";
import { useHeatDomeData } from "./useHeatDomeData";

export interface HeatDomePanelProps {
  /** 보여줄 프레임 번호. 없으면 자료가 정한 기본 프레임 */
  index?: number;
  /** 지구본을 함께 보일지 — 끄면 숫자만 선다 */
  showGlobe?: boolean;
  /** 지구본 높이 (px) */
  globeHeight?: number;
}

export function HeatDomePanel({ index, showGlobe = true, globeHeight = 190 }: HeatDomePanelProps) {
  const dome = useHeatDomeData(index);

  /* 자료를 못 읽으면 자리를 차지하지 않는다 — 켤 수 없는 패널을 세우지 않는다(04 §9 원칙) */
  if (!dome.readings) return null;

  return (
    <section className="flex flex-col gap-2 p-3" aria-label="열돔">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-caption font-semibold text-foreground-muted">열돔</h2>
        <span className="font-mono text-caption text-foreground-subtle">{dome.date}</span>
      </header>

      {/* ── 숫자 — 지도가 없어도 이것만으로 성립한다 ────────── */}
      <HeatDomeReadout readings={dome.readings} deep={dome.deep} />

      {/* ── 지구본 — 왜 그 값이 나오는지 ─────────────────── */}
      {showGlobe && (
        <>
          <HeatDomeGlobe
            lower={dome.lower}
            upper={dome.upper}
            index={dome.index}
            variant="panel"
            className="rounded-md"
            style={{ height: globeHeight }}
          />
          <p className="text-caption text-foreground-subtle">
            두 숫자 모두 <span className="text-foreground-muted">지면에서부터</span> 잰 공기
            기둥의 부풀음이다. 둘 다 높으면 12km 통째로 부풀어 더위를 흩을 것이 오지 않는다.
          </p>
        </>
      )}
    </section>
  );
}
