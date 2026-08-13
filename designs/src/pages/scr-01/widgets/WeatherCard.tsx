/* ─────────────────────────────────────────────
 * 기상 카드 — 03 화면정의서 §1 우상단
 *
 * 발효 특보 · 기온 · 체감온도에 폭염·가뭄을 같은 카드 안에 둔다. 물 재해만 보는 화면이
 * 되지 않게, 여름 시즌 재해가 같은 자리에서 읽혀야 한다(01 개요 §원본 시연에서 더하는 것).
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { cn } from "@ds";
import { CITY_NAME } from "../../../lib/map-config";
import { DROUGHT, HEAT, WEATHER } from "../../../demo/weather";

export function WeatherCard() {
  return (
    <section className="flex flex-col gap-3 p-3" aria-label={`${CITY_NAME} 기상`}>
      <header className="flex items-center justify-between">
        <h2 className="text-body font-semibold text-foreground">{CITY_NAME} 기상</h2>
        <span className="text-caption text-foreground-subtle">
          습도 {WEATHER.humidity}% · {WEATHER.windDirection} {WEATHER.windSpeed} m/s
        </span>
      </header>

      {/* 발효 특보 — 출처가 다른 정보는 라벨·스타일부터 가른다(03 §0-8).
          기상청 특보는 `기상특보 ·` 접두 + 외곽선, 우리 센서의 시스템 이벤트는 채움 뱃지.
          같은 "주의보"가 두 뜻으로 서는 것을 라벨 없이 두면 안 된다 */}
      <div className="flex flex-wrap gap-1.5">
        {WEATHER.advisories.map((advisory) => (
          <span
            key={advisory.label}
            className={cn(
              "rounded-full border px-2 py-0.5 text-caption font-medium",
              advisory.level === "warning"
                ? "border-risk-lv4 text-risk-lv4"
                : "border-risk-lv3 text-risk-lv3",
            )}
          >
            기상특보 · {advisory.label}
          </span>
        ))}
      </div>

      {/* 기온 */}
      <div className="flex items-center gap-3">
        <Icon icon={WEATHER.conditionIcon} className="size-10 shrink-0 text-risk-lv3" aria-hidden />
        <div className="flex min-w-0 flex-col">
          <span className="font-mono text-h4 font-semibold leading-tight text-foreground">
            {WEATHER.temperature}℃
          </span>
          <span className="text-caption text-foreground-muted">
            체감 {WEATHER.feelsLike}℃ · {WEATHER.condition}
          </span>
          {/* 기압·만조 — 폭풍해일 판단의 배경 정보(04 §5). 만조·천문조는 조건 시나리오
              (§10-3)와 같은 값이라 판정 카드와 이 카드가 같은 숫자를 말한다 */}
          <span className="text-caption text-foreground-subtle">
            기압 {WEATHER.pressure} hPa {WEATHER.pressureTrend} · 만조 {WEATHER.tide.highAt} (천문조{" "}
            {WEATHER.tide.astro} EL.m)
          </span>
        </div>
      </div>

      {/* 폭염·가뭄 */}
      <dl className="grid grid-cols-2 gap-2 border-t border-border pt-3">
        <div className="flex flex-col gap-0.5">
          <dt className="text-caption text-foreground-muted">폭염</dt>
          <dd className="flex items-center gap-1.5 text-body font-medium text-risk-lv4">
            {HEAT.level}
            {/* 열돔 — 정보성 표기까지만(04 §5). 판정하는 것처럼 만들지 않는다 */}
            <span className="rounded border border-border px-1 py-px text-caption font-normal text-foreground-subtle">
              {HEAT.hint}
            </span>
          </dd>
          <dd className="text-caption text-foreground-subtle">{HEAT.note}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-caption text-foreground-muted">가뭄</dt>
          <dd className="text-body font-medium text-risk-lv3">{DROUGHT.level}</dd>
          <dd className="text-caption text-foreground-subtle">{DROUGHT.note}</dd>
        </div>
      </dl>
    </section>
  );
}
