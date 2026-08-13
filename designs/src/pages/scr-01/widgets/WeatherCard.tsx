/* ─────────────────────────────────────────────
 * 기상 카드 — 03 화면정의서 §1 우상단
 *
 * 발효 특보 · 기온 · 체감온도에 폭염·가뭄을 같은 카드 안에 둔다. 물 재해만 보는 화면이
 * 되지 않게, 여름 시즌 재해가 같은 자리에서 읽혀야 한다(01 개요 §원본 시연에서 더하는 것).
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Badge } from "@ds";
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

      {/* 발효 특보 — DS Badge 의 색 variant. 경보는 주황(risk-lv4), 주의보는 노랑(risk-lv3)
          단계에 대응한다. 원색은 뱃지에 덧씌우지 않는다(lib/level-tone.ts 규칙) */}
      <div className="flex flex-wrap gap-1.5">
        {WEATHER.advisories.map((advisory) => (
          <Badge key={advisory.label} variant={advisory.level === "warning" ? "orange" : "yellow"}>
            {advisory.label}
          </Badge>
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
        </div>
      </div>

      {/* 폭염·가뭄 */}
      <dl className="grid grid-cols-2 gap-2 border-t border-border pt-3">
        <div className="flex flex-col gap-0.5">
          <dt className="text-caption text-foreground-muted">폭염</dt>
          <dd className="text-body font-medium text-risk-lv4">{HEAT.level}</dd>
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
