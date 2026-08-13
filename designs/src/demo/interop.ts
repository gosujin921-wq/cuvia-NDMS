/* ─────────────────────────────────────────────
 * 연계 현황 — 정본: docs/정본/04_데모_데이터.md §6
 *
 * 4개 중 1개를 끊김으로 둔다. 전부 초록이면 이 패널이 무엇을 알려주는 자리인지 보이지 않는다.
 * ───────────────────────────────────────────── */

export interface InteropLink {
  id: string;
  /** 기관명 */
  org: string;
  /** 주고받는 것 */
  subject: string;
  status: "정상" | "끊김";
  /** 최근 주고받은 시각 */
  lastSyncAt: string;
}

export const INTEROP_LINKS: InteropLink[] = [
  {
    id: "ndms",
    org: "행정안전부 NDMS",
    subject: "계측·이벤트 발생 내역",
    status: "정상",
    lastSyncAt: "2026-08-12T17:44:00",
  },
  {
    id: "kma",
    org: "기상청",
    subject: "특보·예보 수신",
    status: "정상",
    lastSyncAt: "2026-08-12T17:40:00",
  },
  {
    id: "ekr",
    org: "한국농어촌공사",
    subject: "저수지 수위·저수율",
    status: "정상",
    lastSyncAt: "2026-08-12T17:30:00",
  },
  {
    id: "gyeongnam",
    org: "경상남도 재난안전상황실",
    subject: "이벤트·전파 내역",
    status: "끊김",
    lastSyncAt: "2026-08-12T09:02:00",
  },
];
