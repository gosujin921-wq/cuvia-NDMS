/* ─────────────────────────────────────────────
 * 관제 팝업 타입 — KISA 관제 팝업 이식분
 *
 * 원본: cuvia_platform_web `kits/event-kit/src/control-popup/types.ts`
 *
 * 원본의 타입 대부분(ProcState · SopItem · HistoryNode · RelatedProximity)은 KISA 서버
 * 응답 모양이라 가져오지 않는다. DSMS 는 같은 값을 이미 데모 엔진에서 파생한다 —
 * 처리상태는 `demo/sop.ts processStateAt`, SOP 는 `demo/sop.ts`, 이력은
 * `demo/timeline.ts eventTimelineAt` 이다. 여기 남는 것은 원본에 대응하는 값이
 * DSMS 쪽에 없어 새로 만든 것 하나뿐이다.
 * ───────────────────────────────────────────── */

import type { AlertLevel } from "../../../demo/levels";

/**
 * 관련 이벤트 카드 한 장 — 원본 `RelatedEventCandidate` 의 DSMS 대응물.
 *
 * 원본은 근접도(같은 구역>층>건물)와 묶음 상태(linked · grouped)를 들었다. 둘 다 KISA
 * 서버가 계산해 주는 값이라 DSMS 에는 없다. 지어내지 않고 **DSMS 가 실제로 아는 것**만
 * 싣는다 — 같은 시각에 진행 중인 다른 사건이 무엇이고, 어느 지구에서, 무엇이 탐지했나.
 */
export interface RelatedEventCandidate {
  /** 사건 id — 카드 key 이자 정보 탭의 동시 진행 사건 목록에 서는 값 */
  id: string;
  /** 재난유형 표기 (폭풍해일 · 내수침수 …) */
  hazardLabel: string;
  /** 그 사건의 지금 계측 단계 */
  level: AlertLevel;
  /** 지구 id — 카드 썸네일이 그 지구의 주요 CCTV 스틸을 트는 데 쓴다 (04 §2-5) */
  districtId: string;
  /** 지구명 */
  location: string;
  /** 계측값 표기 ("3.02 EL.m") */
  valueText: string;
  /** 현재 시계 기준 상대 시각 ("11분 전") */
  relativeTime: string;
  /** 탐지 장비 표시명 */
  device: string;
  /** 이 팝업이 보는 사건과 같은 지구인가 */
  sameDistrict: boolean;
}
