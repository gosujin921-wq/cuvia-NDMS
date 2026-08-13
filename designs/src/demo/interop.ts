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

/* 정상 3곳의 최근 전송은 시나리오 시계를 따라 흐르고(현재 · −4분 · −14분),
   경남만 09:02 에 멈춰 있어 시계가 갈수록 격차가 벌어진다 (04 §6) */
const OFFSET_MIN: Record<string, number> = { ndms: 0, kma: 4, ekr: 14 };

/**
 * 트랙별 연계 현황 (04 §6 · §15-4).
 *
 * 서항 트랙은 경남 상황실이 09:02 부터 끊겨 있다 — S0 에서 복선으로 심고 S7 의 보고
 * 실패로 회수하는 그 빨간 점이다. 봉암 트랙은 그 장애가 06:40 에 복구돼 **네 곳 전부
 * 정상**이고, 대신 실패가 현장 장비(CCTV)에서 난다(04 §15-11). 같은 화면이 트랙마다
 * 다른 곳을 빨갛게 칠하는 것이 두 편을 나란히 두는 값어치다.
 */
export function interopLinksAt(now: Date, track: "seohang" | "bongam" = "seohang"): InteropLink[] {
  const at = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();
  const gyeongnam: InteropLink =
    track === "bongam"
      ? {
          id: "gyeongnam",
          org: "경상남도 재난안전상황실",
          subject: "이벤트·전파 내역",
          status: "정상",
          lastSyncAt: new Date("2026-08-13T06:40:00").toISOString(),
        }
      : {
          id: "gyeongnam",
          org: "경상남도 재난안전상황실",
          subject: "이벤트·전파 내역",
          status: "끊김",
          lastSyncAt: "2026-08-12T09:02:00",
        };
  return [
    { id: "ndms", org: "행정안전부 NDMS", subject: "계측·이벤트 발생 내역", status: "정상", lastSyncAt: at(OFFSET_MIN.ndms) },
    { id: "kma", org: "기상청", subject: "특보·예보 수신", status: "정상", lastSyncAt: at(OFFSET_MIN.kma) },
    { id: "ekr", org: "한국농어촌공사", subject: "저수지 수위·저수율", status: "정상", lastSyncAt: at(OFFSET_MIN.ekr) },
    gyeongnam,
  ];
}
