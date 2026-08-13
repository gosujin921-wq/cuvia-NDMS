/* ─────────────────────────────────────────────
 * 기상 카드 — 03 화면정의서 §1 우상단
 *
 * 두 층으로 가른다. 위층은 **{유형} 관련 기상·조위**: 특보를 다시 알리는 곳이 아니라
 * 그 특보의 기상 근거(바람·기압·만조)를 보이는 곳이다. 특보명은 상단 상태 스트립이 한 번
 * 말한다(04 §4-7). 만조·천문조는 판정 카드와 같은 숫자로 선다(04 §5).
 * 아래층은 **도시 배경 위험**: 사건과 무관하게 도시가 깔고 있는 폭염·가뭄이다.
 * 물 재해만 보는 화면이 되지 않게, 여름 시즌 재해가 같은 자리에서 읽혀야 한다(01 개요).
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { ArcGaugeHero } from "../../../components/ArcGauge";
import { CITY_NAME } from "../../../lib/map-config";
import { majorDisasterAt } from "../../../demo/events";
import { DROUGHT, heatOf, weatherOf, type BackgroundRisk } from "../../../demo/weather";
import { formatClock } from "../../../lib/datetime";
import { useScenario } from "../../../state/ScenarioProvider";

export function WeatherCard() {
  /* 위층 제목이 지금 사건의 유형을 문다. 사건이 없으면 일반 제목으로 내려간다 */
  /* 기상은 트랙이 정한다 (04 §15-4) — 트랙을 갈면 하늘부터 바뀐다 */
  const { now, track } = useScenario();
  const WEATHER = weatherOf(track);
  const HEAT = heatOf(track);
  const major = majorDisasterAt(now);

  return (
    <section className="flex flex-col gap-3 p-3" aria-label={`${CITY_NAME} 기상`}>
      {/* 머리: 날씨 아이콘 · 기온 · 상태 · 체감 · 현재 시각 **한 줄 인라인** (03 §1).
          기온·시각은 같은 폰트 크기다. 아이콘은 색을 얹지 않고,
          시각은 관제 표기(24시간 · §0-3)를 따른다 */}
      <header className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <Icon
            icon={WEATHER.conditionIcon}
            className="size-6 shrink-0 text-foreground-muted"
            aria-hidden
          />
          <span className="font-mono text-h6 font-semibold tabular-nums text-foreground">
            {WEATHER.temperature}℃
          </span>
          <span className="truncate text-h6 text-foreground-muted">
            {WEATHER.condition} · 체감 {WEATHER.feelsLike}℃
          </span>
        </span>
        <span className="shrink-0 font-mono text-h6 font-semibold tabular-nums text-foreground">
          {formatClock(now)}
        </span>
      </header>

      {/* 사건 기상 근거. 줄글 목록이 아니라 숫자가 크게 서는 스탯 타일 3개다(03 §1).
          만조·천문조는 조건 시나리오(04 §10-3)와 같은 값이라 판정 카드와 같은 숫자를 말한다 */}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-caption font-medium text-foreground-muted">
          {major ? `${major.label} 관련 기상·조위` : "현재 사건 기상·조위"}
        </h3>

        <dl className="grid grid-cols-3 gap-2">
          <WeatherTile
            icon="mdi:weather-windy"
            label="바람"
            value={String(WEATHER.windSpeed)}
            unit="m/s"
            caption={`${WEATHER.windDirection}풍 · 습도 ${WEATHER.humidity}%`}
          />
          <WeatherTile
            icon="mdi:gauge"
            label="기압"
            value={String(WEATHER.pressure)}
            unit="hPa"
            caption={WEATHER.pressureTrend}
          />
          <WeatherTile
            icon="mdi:waves"
            label="만조"
            value={WEATHER.tide.highAt}
            caption={`천문조 ${WEATHER.tide.astro} EL.m · ${WEATHER.tide.note}`}
          />
        </dl>
      </div>

      {/* 도시 배경 위험: 폭염·가뭄을 반원 게이지 둘로(03 §1 · IDC ArcGauge 이식).
          게이지 값은 수치가 아니라 등급 환산이다(04 §5) */}
      <div className="flex flex-col gap-1.5 border-t border-border pt-3">
        <h3 className="text-caption font-medium text-foreground-muted">도시 배경 위험</h3>
        <dl className="grid grid-cols-2 gap-2">
          <RiskGauge risk={HEAT} badge={HEAT.hint} />
          <RiskGauge risk={DROUGHT} />
        </dl>
      </div>
    </section>
  );
}

/* 배경 위험 게이지 타일: 축 이름 → 게이지(등급) → 근거 수치 캡션.
   badge 는 폭염의 `열돔 영향 가능` 처럼 정보성 표기까지만인 것에 붙인다(04 §5) */
function RiskGauge({ risk, badge }: { risk: BackgroundRisk; badge?: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 rounded-md bg-surface-raised p-2">
      <dt className="flex w-full items-center justify-between gap-1 text-caption text-foreground-muted">
        {risk.axis}
        {badge && (
          <span className="truncate rounded border border-border px-1 py-px text-caption text-foreground-subtle">
            {badge}
          </span>
        )}
      </dt>
      <dd>
        <ArcGaugeHero
          value={risk.gauge}
          label={`${risk.axis} ${risk.level}`}
          chipLabel={risk.level}
          chipTone={risk.tone}
          size={112}
        />
      </dd>
      <dd className="line-clamp-2 w-full text-center text-caption text-foreground-subtle">
        {risk.note}
      </dd>
    </div>
  );
}

/* 스탯 타일: 라벨은 죽이고 숫자가 주인공이다. 캡션은 좁은 타일에서 두 줄까지
   감싸고, 그래도 넘치면 title 로 전문을 남긴다 */
function WeatherTile({
  icon,
  label,
  value,
  unit,
  caption,
}: {
  icon: string;
  label: string;
  value: string;
  unit?: string;
  caption: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-md bg-surface-raised p-2">
      <dt className="flex items-center gap-1 text-caption text-foreground-muted">
        <Icon icon={icon} className="size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
        {label}
      </dt>
      <dd className="font-mono text-h6 font-semibold leading-tight tabular-nums text-foreground">
        {value}
        {unit && (
          <span className="ml-0.5 font-sans text-caption font-normal text-foreground-subtle">
            {unit}
          </span>
        )}
      </dd>
      <dd className="line-clamp-2 text-caption text-foreground-subtle" title={caption}>
        {caption}
      </dd>
    </div>
  );
}
