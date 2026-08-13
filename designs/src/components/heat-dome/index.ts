/* ─────────────────────────────────────────────
 * 열돔 부품 — 이 폴더 하나가 열돔 표현의 전부다
 *
 * 디지털트윈에는 `HeatDomePanel` 하나만 세우면 된다. 나머지는 그 안에서 쓴다.
 * 자료를 읽는 쪽(useHeatDomeData)과 그리는 쪽(HeatDomeGlobe)을 갈라 둔 것은, 도시 배율
 * 화면에서 **숫자만 쓰고 지도는 안 붙이는** 길을 열어 두기 위해서다.
 * ───────────────────────────────────────────── */

export { HeatDomePanel, type HeatDomePanelProps } from "./HeatDomePanel";
export { HeatDomeCard, type HeatDomeCardProps } from "./HeatDomeCard";
export { HeatDomeGlobe, type HeatDomeGlobeProps } from "./HeatDomeGlobe";
export { DomeGrid, type DomeGridProps } from "./DomeGrid";
export { HeatDomeReadout, type HeatDomeReadoutProps } from "./HeatDomeReadout";
export { useHeatDomeData, LOWER, UPPER, type HeatDomeData, type LayerReading } from "./useHeatDomeData";
