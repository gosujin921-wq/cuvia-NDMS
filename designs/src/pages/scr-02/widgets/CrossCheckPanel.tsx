/* ─────────────────────────────────────────────
 * 현장 교차검증 — 03 화면정의서 §2 우측 중단 · 04 §10-4
 *
 * 이 지구가 위험하다는 확인 근거를 줄 단위로 세운다: 수위(기준 초과) · 실측 조위
 * (천문조 대비 편차) · 기압 · 바람 · CCTV 현장 확인. 판정이 아니라 근거의 나열이다 —
 * 자동 판정은 계측 단계(03 §0-6)까지고, 수위 하나로 내린 단계를 조위·기상·영상이
 * 받쳐 준다는 것을 한자리에서 읽게 한다.
 *
 * CCTV 행만 사람의 행동에 물린다(04 §10-4). 시스템이 영상을 "판독"한 것처럼 만들지
 * 않는다 — S3 에서 담당자가 실제로 CCTV 를 열어 본 뒤에야 확인으로 바뀐다.
 *
 * 시간대별 예보는 싣지 않는다 — 예보는 검증(지금 위험이 진짜인가)이 아니라
 * 전망(앞으로 유지되나)이고, 그 몫은 SCR-01 기상 카드와 SCR-05 날씨 패널이다(03 §2).
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { cn } from "@ds";
import {
  DISPLACEMENT_THRESHOLD,
  RAIN_THRESHOLD,
  WATER_THRESHOLDS,
  levelSpec,
} from "../../../demo/levels";
import { watchedEventOfAt, activeEventsAt, eventViewAt } from "../../../demo/events";
import { CCTV_SCENES } from "../../../demo/devices";
import { drainageOf, tideSurgeOf } from "../../../demo/drainage";
import { formatClock } from "../../../lib/datetime";
import { tideReadingAt } from "../../../demo/measurements";
import { WEATHER } from "../../../demo/weather";
import { useScenario } from "../../../state/ScenarioProvider";
import type { District } from "../../../demo/districts";
import type { Device } from "../../../demo/devices";

interface CrossCheckPanelProps {
  district: District;
  devices: Device[];
}

interface CheckRow {
  icon: string;
  /** 확인된 근거인가 — 아니면 흐리게 눕는다 (CCTV 확인 전) */
  checked: boolean;
  label: string;
  note: string;
  noteColor?: string;
}

export function CrossCheckPanel({ district, devices }: CrossCheckPanelProps) {
  const { now, step } = useScenario();
  const event = watchedEventOfAt(district.id, now);
  const view = event ? eventViewAt(event, now) : null;
  const coastal = district.kind === "해일";
  const tideDevice = devices.find((d) => d.kind === "TD");
  const tide = tideDevice ? tideReadingAt(now) : null;
  /* 장면 등재 지구(서항)만 CCTV 확인 행이 선다. S3 에서 CCTV 팝업을 연 뒤 확인으로 */
  const sceneSpots = CCTV_SCENES.filter((s) => s.districtId === district.id);
  const cctvChecked = step >= 3;

  /* 배수 제약 등재 지구(봉암 · 04 §15-6) — 내수침수는 "안쪽 물이 못 나간다"가 요지라
     외수위·배수문·펌프·하구 조위가 근거 줄로 함께 선다. 해일 지구에는 없는 층이다 */
  const drainage = drainageOf(district.id);

  const rows: CheckRow[] = [];
  if (event && view) {
    const base =
      event.type === "수위"
        ? WATER_THRESHOLDS[district.id]
        : event.type === "강우"
          ? RAIN_THRESHOLD
          : DISPLACEMENT_THRESHOLD;
    const spec = levelSpec(view.level);
    rows.push({
      icon: "mdi:waves-arrow-up",
      checked: true,
      label: `${event.type} ${view.value} ${event.unit}`,
      note: base ? `${spec.label} 기준 ${base[view.level]} 초과` : spec.label,
      noteColor: spec.color,
    });
  }
  if (drainage) {
    /* 물이 못 나가는 이유를 물리 순서대로 — 바깥이 높다 → 문을 닫았다 → 펌프만 남았다 */
    const inner = view?.value ?? 0;
    rows.push({
      icon: "mdi:transfer-up",
      checked: true,
      label: `외수위 ${drainage.outerLevel} EL.m`,
      note: inner ? `내수위 대비 +${(drainage.outerLevel - inner).toFixed(2)} m · 역류 조건` : "봉암천",
    });
    rows.push({
      icon: "mdi:boom-gate",
      checked: true,
      label: `배수문 폐쇄 ${formatClock(new Date(drainage.gateClosedAt))}`,
      note: "운영 로그 · 자연배수 차단",
    });
    rows.push({
      icon: "mdi:pump",
      checked: true,
      label: `배수펌프 ${drainage.pumpsRunning}대 전량 가동`,
      note: `${formatClock(new Date(drainage.pumpsFrom))}~ · 강우 주의보보다 22분 앞섬`,
    });
    /* 대표 사건이 아닌 쪽(집중호우)의 값도 근거로 세운다 — 대표는 하나지만 근거는 둘이다.
       대표가 이미 강우면(발생 연출 중 · 격상 전) 같은 사건을 두 줄로 세우지 않는다 */
    const rain = activeEventsAt(now).find(
      (e) => e.districtId === district.id && e.type === "강우" && e.id !== event?.id,
    );
    if (rain) {
      const rainView = eventViewAt(rain, now);
      rows.push({
        icon: "mdi:weather-pouring",
        checked: true,
        label: `강우 ${rainView.value} ${rain.unit}`,
        note: `누적 ${drainage.rainAccumMm} mm · ${levelSpec(rainView.level).label} 기준 ${RAIN_THRESHOLD[rainView.level]} 초과`,
        noteColor: levelSpec(rainView.level).color,
      });
    }
    rows.push({
      icon: "mdi:waves",
      checked: true,
      label: `하구 조위 ${drainage.tideMeasured} EL.m`,
      note: `천문조 ${drainage.tideAstro} 대비 +${tideSurgeOf(drainage)} m · 만조 ${formatClock(new Date(drainage.highTideAt))}`,
    });
    rows.push({
      icon: "mdi:gauge",
      checked: true,
      label: `기압 ${drainage.pressure} hPa`,
      note: drainage.pressureTrend,
    });
  } else {
    if (tide) {
      rows.push({
        icon: "mdi:waves",
        checked: true,
        label: `실측 조위 ${tide.measured} EL.m`,
        note: `천문조 ${tide.astro} 대비 +${tide.surge} m`,
      });
    }
    if (coastal) {
      rows.push({
        icon: "mdi:gauge",
        checked: true,
        label: `기압 ${WEATHER.pressure} hPa`,
        note: WEATHER.pressureTrend,
      });
    }
    rows.push({
      icon: "mdi:weather-windy",
      checked: true,
      label: `${WEATHER.windDirection}풍 ${WEATHER.windSpeed} m/s`,
      note: coastal ? "해안 유입 방향" : "",
    });
  }
  if (sceneSpots.length > 0 && event) {
    rows.push({
      icon: "mdi:cctv",
      checked: cctvChecked,
      label: cctvChecked ? `${sceneSpots.map((s) => s.spot).join("·")} 확인` : "CCTV 현장 확인",
      note: cctvChecked ? sceneSpots[0].scene : "확인 전",
    });
  }

  return (
    <section
      className="flex h-full min-h-0 flex-col gap-2 p-3"
      aria-label={`${district.name} 현장 교차검증`}
    >
      <header className="flex shrink-0 items-baseline gap-2">
        <h2 className="text-body font-semibold text-foreground">
          {event ? "현장 교차검증" : "기상·조위"}
        </h2>
        {event && (
          <span className="text-caption text-foreground-subtle">계측 단계를 받치는 근거</span>
        )}
      </header>

      {/* 근거 행 — 각각 박스에 넣는다. 줄 나열보다 근거 하나하나가 카드로 서야
          "무엇이 무엇을 받치는가"가 눈으로 갈린다. 위에서부터 쌓고 남는 자리는
          아래에 둔다 — 카드 간격이 화면 높이에 따라 벌어지면 목록으로 안 읽힌다 */}
      <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
        {rows.map((row) => (
          <li
            /* 근거 종류(아이콘)까지 키에 넣는다 — 라벨만으로는 같은 값이 두 근거에
               걸릴 때 키가 겹쳐, 값이 바뀐 뒤에도 옛 행이 목록에 남는다 */
            key={`${row.icon}-${row.label}`}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2",
              !row.checked && "opacity-60",
            )}
          >
            {/* 확인 표시는 사건이 있을 때만 — 사건 없는 지구의 기상 행에 체크가 서면
                "무엇을 확인했다"는 건지 알 수 없는 표시가 된다 */}
            {event && (
              <Icon
                icon={row.checked ? "mdi:check-circle-outline" : "mdi:circle-outline"}
                className={cn("size-4 shrink-0", row.checked ? "text-success" : "text-foreground-subtle")}
                aria-hidden
              />
            )}
            <Icon icon={row.icon} className="size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-caption text-foreground">{row.label}</span>
            {row.note && (
              <span
                className="shrink-0 text-caption text-foreground-muted"
                style={row.noteColor ? { color: row.noteColor } : undefined}
              >
                {row.note}
              </span>
            )}
          </li>
        ))}

        {/* 조위 비교 (04 §10-4) — 이 4행이 서 있어야 S5 판정 카드의 편차 +1.15 가
            갑자기 등장하지 않는다. 만조 행은 조위표(천문 계산), 나머지는 우리 센서다.
            근거 행과 같은 층이라 목록 안에 서되 배경 없이 — 박스 안의 박스를 만들지 않는다 */}
        {tide && !drainage && (
          <li>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 px-2.5 text-caption">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-foreground-subtle">천문조 현재값</dt>
                <dd className="font-mono text-foreground-muted">{tide.astro}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-foreground-subtle">실측 조위</dt>
                <dd className="font-mono text-foreground">{tide.measured}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-foreground-subtle">해일 편차</dt>
                <dd className="font-mono font-medium text-foreground">+{tide.surge}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-foreground-subtle">만조 {WEATHER.tide.highAt}</dt>
                <dd className="font-mono text-foreground-muted">{WEATHER.tide.astro}</dd>
              </div>
            </dl>
          </li>
        )}

        {/* 배수 수지 (04 §15-6) — 조위 비교와 같은 자리, 같은 문법. 이 넉 줄이 서야
            판정 카드의 `배수 제약 +0.15` 가 갑자기 등장하지 않는다 */}
        {drainage && (
          <li>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 px-2.5 text-caption">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-foreground-subtle">외수위</dt>
                <dd className="font-mono text-foreground-muted">{drainage.outerLevel}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-foreground-subtle">내수위</dt>
                <dd className="font-mono text-foreground">{view?.value ?? "—"}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-foreground-subtle">자연배수</dt>
                <dd className="font-mono font-medium text-danger">차단</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-foreground-subtle">
                  만조 {formatClock(new Date(drainage.highTideAt))}
                </dt>
                <dd className="font-mono text-foreground-muted">{drainage.tideAstro}</dd>
              </div>
            </dl>
          </li>
        )}
      </ul>
    </section>
  );
}
