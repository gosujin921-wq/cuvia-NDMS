/* ─────────────────────────────────────────────
 * 날짜·시각 공통 유틸 — 전 화면에서 이 모듈만 쓴다.
 *
 * toLocaleTimeString("ko-KR") 은 쓰지 않는다(오전/오후가 붙어 관제 화면 표기와 어긋난다).
 * 날짜·일시 포맷은 DS 공통 유틸을 그대로 재수출한다.
 * ───────────────────────────────────────────── */

export { formatDate, formatDateTime } from "@ds";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDate(input: string | Date): Date | null {
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 절대 시각 — "17:44". 이벤트 상세·전파 내역 표기. */
export function formatClock(input: string | Date): string {
  const d = toDate(input);
  if (!d) return "-";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 상대 시간 — "방금 전" · "3분 전" · "2시간 전" · "3일 전". 목록 표기. */
export function formatRelative(input: string | Date, now: Date = new Date()): string {
  const d = toDate(input);
  if (!d) return "-";

  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 0) return formatClock(d);
  if (diffSec < 60) return "방금 전";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;

  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}일 전`;
}
