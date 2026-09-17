/* ─────────────────────────────────────────────
 * 사건 알람 토스트 — 발생 · 격상
 *
 * 조작 응답 토스트(SOP 실행 · 분석 반영)와 성격이 다르다. 저것은 "눌렀다"의 답이라
 * 2.5초 뒤 사라지지만, 알람은 읽을 거리가 있어(무엇이 · 얼마나 · 언제) 더 오래 선다.
 * 그래도 **스스로 닫힌다** — 시연 내내 남아 쌓이면 지도를 덮고, 정작 방금 들어온 알람이
 * 앞선 더미에 묻힌다. 사람이 지우기를 기다리지 않는다.
 *
 * 알람 셋이 같은 회색 카드로 서면 "무엇이 급한가"가 읽히지 않는다. 지도 핀·뱃지·칩이
 * 쓰는 단계 색을 테두리와 아이콘에 그대로 얹어, 쌓인 더미를 색으로 먼저 훑게 한다
 * (단계 색은 화면 어디서나 같다 · 03 §0-2).
 *
 * 버튼은 그 지구의 재난관제로만 보낸다. `?event=` 를 붙이면 사건 지정 진입이라 스텝이
 * S5(판단 국면)로 뛴다 — 알람은 사건을 **보러 가는** 길이지 판단을 건너뛰는 길이 아니다.
 *
 * ★ 이미 그 화면에 서 있으면 버튼을 달지 않는다. 봉암 격상(B1)은 재난관제 안에서 터지는데
 *   거기에 [재난관제로 가기]가 서면 지금 보고 있는 화면으로 가라는 말이 된다. 그 자리에서
 *   읽어야 할 것은 화면이 방금 갈아 낀 문구(주의보 → 경보)다.
 *
 * ★ 같은 지구의 알람이 겹치면 **가장 최근 것에만** 버튼이 선다. 셋 다 같은 화면으로 가는
 *   버튼을 달면 어느 것을 눌러야 하는지 고민하게 되고, 정작 읽어야 할 것은 맨 위의 최신
 *   상태다. 앞선 알람은 "이런 일이 있었다"는 기록으로 남고 길은 하나만 낸다.
 *
 * 읽은 알람은 남지 않는다. 그 지구의 재난관제 화면에 들어서면 그때까지 쌓인 그 지구 알람을
 * 함께 닫는다(dismissAlarmsOf). 사건을 보러 들어왔는데 알람이 화면 위를 덮고 있으면 그
 * 알람은 이미 제 할 일을 마친 것이다. 들어선 뒤에 새로 들어오는 알람은 새 소식이라 그대로
 * 뜬다 — 격상이 그 자리다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Badge, Button, toast } from "@ds";
import type { AlertGrade } from "../model/alert";
import { levelSpec, type AlertLevel } from "../demo/levels";
import { fadeColor } from "./color";
import { navigateTo } from "./router-navigate";
import { ALERT_GRADE_TONE } from "./status-tone";

export interface AlarmToast {
  title: string;
  description: string;
  /** 테두리·아이콘 색을 정한다 */
  level: AlertLevel;
  /** [재난관제로 가기]가 여는 지구 */
  districtId: string;
}

interface OpenAlarm {
  id: string;
  alarm: AlarmToast;
}

/* 지구별로 지금 떠 있는 알람 — 뒤로 갈수록 최신이다. 새 알람이 오면 앞선 것들의 버튼을
   걷고, 화면이 그 지구에 들어서면 한꺼번에 닫는다 */
const openAlarms = new Map<string, OpenAlarm[]>();
let seq = 0;
/* 무리로 닫는 중 — onDismiss 가 한 건씩 되돌아와 남은 알람을 다시 그리지 않게 막는다 */
let dismissingAll = false;

/**
 * 알람이 스스로 서 있는 시간 (ms).
 *
 * 제목·부연·버튼을 읽고 누를 수 있는 길이여야 하고, 다음 알람이 오기 전에 비켜야 한다.
 * 발생 연출의 유입 간격(1.6초)보다 길어 세 건이 잠시 겹쳐 쌓이는 것은 의도한 그림이다 —
 * "지금 몇 건이 동시에 났나"가 그 겹침에서 읽힌다.
 */
const ALARM_DURATION_MS = 9_000;

/** 같은 id 로 다시 부르면 sonner 가 그 토스트를 갈아 끼운다 — 버튼만 뺀 판을 그릴 때 쓴다 */
function render({ id, alarm }: OpenAlarm, withAction: boolean) {
  const spec = levelSpec(alarm.level);

  toast.warning(alarm.title, {
    id,
    description: alarm.description,
    duration: ALARM_DURATION_MS,
    closeButton: true,
    icon: (
      <Icon
        icon="mdi:alert"
        className="size-5 shrink-0"
        style={{ color: spec.color }}
        aria-hidden
      />
    ),
    style: {
      borderColor: spec.color,
      borderWidth: 1,
      /* 단계 색을 한 겹 더 밖으로 흘린다 — 어두운 지도 위에서 테두리만으로는 묻힌다 */
      boxShadow: `0 0 0 3px ${fadeColor(spec.color, 18)}, 0 6px 20px rgba(0, 0, 0, 0.35)`,
    },
    /* ★ 키를 빼지 않고 undefined 를 넣는다. sonner 는 같은 id 로 다시 부르면
       `{...기존, ...새것}` 로 병합하므로, 키가 없으면 앞서 달아 둔 버튼이 그대로 남는다 */
    action: withAction
      ? {
          label: "재난관제로 가기",
          onClick: () => navigateTo(`/scr-02/${alarm.districtId}`),
        }
      : undefined,
    actionButtonStyle: withAction
      ? {
          backgroundColor: spec.color,
          color: "var(--color-surface)",
          fontWeight: 600,
          whiteSpace: "nowrap",
        }
      : undefined,
    /* 사람이 닫았다 — 남은 것 중 최신에 길을 돌려준다 */
    onDismiss: () => forget(alarm.districtId, id, true),
    /* 시간이 지나 스스로 닫혔다 — 목록에서만 뺀다. 여기서 다시 그리면 sonner 가 그
       토스트의 타이머를 되감아, 알람 더미가 서로를 붙잡고 안 사라진다 */
    onAutoClose: () => forget(alarm.districtId, id, false),
  });
}

/* 지금 그 지구의 재난관제에 서 있나. 라우터 밖이라 주소를 직접 읽는다(navigateTo 와
   같은 사정 · lib/router-navigate.ts). BrowserRouter 라 pathname 이 곧 현재 화면이다 */
function alreadyOn(districtId: string): boolean {
  return window.location.pathname.startsWith(`/scr-02/${districtId}`);
}

/** 닫힌 알람을 목록에서 뺀다. `regrant` 면 남은 것 중 최신에 길을 돌려준다 */
function forget(districtId: string, id: string, regrant: boolean) {
  if (dismissingAll) return;
  const rest = (openAlarms.get(districtId) ?? []).filter((open) => open.id !== id);
  if (rest.length === 0) {
    openAlarms.delete(districtId);
    return;
  }
  openAlarms.set(districtId, rest);
  if (regrant) render(rest[rest.length - 1], !alreadyOn(districtId));
}

export function alarmToast(alarm: AlarmToast) {
  const stack = openAlarms.get(alarm.districtId) ?? [];
  /* 앞선 같은 지구 알람에서 버튼을 걷는다 — 길은 최신 하나만 낸다 */
  stack.forEach((open) => render(open, false));

  const next: OpenAlarm = { id: `alarm-${alarm.districtId}-${++seq}`, alarm };
  openAlarms.set(alarm.districtId, [...stack, next]);
  render(next, !alreadyOn(alarm.districtId));
}

/** 그 지구의 재난관제에 들어섰다 — 쌓여 있던 그 지구 알람을 닫는다 */
export function dismissAlarmsOf(districtId: string) {
  const stack = openAlarms.get(districtId);
  if (!stack?.length) return;
  dismissingAll = true;
  stack.forEach((open) => toast.dismiss(open.id));
  openAlarms.delete(districtId);
  dismissingAll = false;
}

/** 트랙 재발사(리셋) — 앞 편의 알람은 한 건도 남기지 않는다 */
export function dismissAllAlarms() {
  dismissingAll = true;
  toast.dismiss();
  openAlarms.clear();
  dismissingAll = false;
}

/* ─────────────────────────────────────────────
 * Phase 2 알림 토스트 · 세계 tick 이 새 알림(AttentionAlert)을 낳을 때
 *
 * 카드 구조는 CSMS `lib/alarm-toast.tsx` 와 같다(2026-09-17 사용자 지시 "CSMS에서 가져와").
 * 뱃지 줄 · 아이콘+제목 줄 · 위치 줄 · 설명+버튼 바닥줄의 네 줄 카드이고, sonner 슬롯으로는
 * 이 구조가 안 나와 toast.custom 으로 그린다. 위험색은 CSMS riskTone 자리에 ALERT_GRADE_TONE 을 문다.
 * // TODO(ds): CSMS lib/alarm-toast.tsx 의 AlarmToastCard 와 같은 부품. DS 승격 대상
 * ───────────────────────────────────────────── */

export interface AlertToastInput {
  alertId: string;
  title: string;
  kind: string;
  grade: AlertGrade;
  /** 위치 줄 */
  location: string;
  /** 바닥 줄 한 문장 */
  summary: string;
  /** 있으면 [사건 확인하기] 가 이 주소로 보낸다. 이미 그 화면이면 버튼을 달지 않는다 */
  href?: string;
}

/* CSMS 와 같은 길이 · 버튼 있는 알림은 읽고 누를 만큼 더 둔다 */
const ALERT_DURATION_MS = 8_000;
const ALERT_ACTION_DURATION_MS = 20_000;

/* 지금 떠 있는 알림 토스트 id · 재난관제에 들어서면 이것만 걷는다(조작 응답 토스트는 남긴다) */
const openAlerts = new Set<string>();

/** 재난관제에 들어섰다 · 떠 있던 알림을 전부 닫는다 (2026-09-17 사용자 지시) */
export function dismissAlertToasts() {
  openAlerts.forEach((id) => toast.dismiss(id));
  openAlerts.clear();
}

export function alertToast(input: AlertToastInput) {
  const toastId = `alert-${input.alertId}`;
  openAlerts.add(toastId);
  const href = input.href && !window.location.pathname.startsWith(input.href.split("?")[0]) ? input.href : undefined;
  toast.custom((id) => <AlertToastCard id={id} {...input} href={href} />, {
    id: toastId,
    duration: href ? ALERT_ACTION_DURATION_MS : ALERT_DURATION_MS,
    onDismiss: () => openAlerts.delete(toastId),
    onAutoClose: () => openAlerts.delete(toastId),
  });
}

function AlertToastCard({ id, title, kind, grade, location, summary, href }: AlertToastInput & { id: string | number }) {
  const tone = ALERT_GRADE_TONE[grade];
  return (
    <div
      className="relative w-[360px] rounded-lg border border-l-2 border-border bg-card/95 p-3 shadow-lg backdrop-blur-sm"
      style={{ borderLeftColor: fadeColor(tone.color, 60) }}
    >
      <button
        type="button"
        onClick={() => toast.dismiss(id)}
        aria-label="알림 닫기"
        className="absolute right-2 top-2 flex size-5 cursor-pointer items-center justify-center rounded text-foreground-subtle transition-colors hover:bg-surface-raised hover:text-foreground"
      >
        <Icon icon="mdi:close" className="size-4" aria-hidden />
      </button>

      <div className="flex items-center gap-1.5 pb-1.5 pr-6">
        <Badge variant={tone.badge}>{grade}</Badge>
        <span className="text-caption text-foreground-muted">{kind}</span>
      </div>

      <div className="flex items-center gap-1.5 pr-6">
        <Icon icon="mdi:alert" className="size-4 shrink-0" style={{ color: tone.color }} aria-hidden />
        <span className="min-w-0 truncate text-body font-semibold text-foreground">{title}</span>
      </div>

      <p className="flex items-center gap-1 pt-1 text-caption text-foreground-muted">
        <Icon icon="mdi:map-marker" className="size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">{location}</span>
      </p>

      <div className="flex items-end gap-2 pt-2">
        <p className="line-clamp-2 min-w-0 flex-1 text-caption text-foreground-muted">{summary}</p>
        {href && (
          <Button
            size="sm"
            variant="gradient"
            className="shrink-0"
            onClick={() => {
              navigateTo(href);
              toast.dismiss(id);
            }}
          >
            사건 확인하기
          </Button>
        )}
      </div>
    </div>
  );
}
