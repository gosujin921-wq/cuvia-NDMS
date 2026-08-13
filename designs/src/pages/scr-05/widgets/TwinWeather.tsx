/* ─────────────────────────────────────────────
 * 날씨 — 03 화면정의서 §5 좌하단
 *
 * 지금 기상과 시간대별 풍속·강수량·강수확률. 침수를 미리 볼 때 "오늘 비가 더 오나"가
 * 같은 화면에 있어야 판단이 이어진다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ds";
import { WEATHER } from "../../../demo/weather";
import { hourlyForecast, type ForecastSlot } from "../../../demo/measurements";

/** 표의 세 줄 — 시각 열은 헤더가 맡고, 여기는 값 줄만 정의한다 */
const ROWS: { label: string; value: (slot: ForecastSlot) => string }[] = [
  { label: "풍속", value: (slot) => `${slot.windSpeed}` },
  { label: "강수량", value: (slot) => `${slot.rain}` },
  { label: "강수확률", value: (slot) => `${slot.rainProbability}%` },
];

export function TwinWeather({ districtId }: { districtId: string }) {
  const slots = hourlyForecast(districtId).slice(0, 6);

  return (
    <section className="flex flex-col gap-2 p-3" aria-label="날씨">
      <div className="flex items-center gap-2">
        <Icon icon={WEATHER.conditionIcon} className="size-7 shrink-0 text-risk-lv3" aria-hidden />
        <span className="font-mono text-h5 font-semibold text-foreground">
          {WEATHER.temperature}℃
        </span>
        <span className="text-caption text-foreground-muted">{WEATHER.condition}</span>
        <span className="ml-auto text-caption text-foreground-subtle">
          {WEATHER.windDirection} {WEATHER.windSpeed} m/s
        </span>
      </div>

      {/* DS Table — 오버레이 패널이라 셀 여백만 기본(h-10·p-3)에서 조인다 */}
      <Table className="text-caption">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-6 px-1 text-left font-normal text-foreground-subtle">
              시각
            </TableHead>
            {slots.map((slot) => (
              <TableHead
                key={slot.label}
                className="h-6 px-1 text-center font-normal text-foreground-subtle"
              >
                {slot.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROWS.map((row) => (
            <TableRow key={row.label}>
              <TableCell className="px-1 py-1 text-left text-foreground-subtle">
                {row.label}
              </TableCell>
              {slots.map((slot) => (
                <TableCell
                  key={slot.label}
                  className="px-1 py-1 text-center font-mono text-foreground-muted"
                >
                  {row.value(slot)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
