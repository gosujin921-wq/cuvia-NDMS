/* ─────────────────────────────────────────────
 * 시간별 예보 — 좌하단 날씨 (03 §21 조건 요약 자리 · 사용자 재정비 2026-09-15)
 *
 * 기상청 시간별 예보와 같은 줄 구성이다. 시각 · 날씨 · 기온 · 체감 · 강수강도 · 강수확률 · 바람 · 습도.
 * 침수를 미리 볼 때 "오늘 비가 더 오나"가 같은 화면에 있어야 판단이 이어진다.
 * 조건(강우·만조)은 우측 시뮬레이션 조건 카드가 들고 시설 상태는 지도 핀이 든다 — 여기에 다시 적지 않는다.
 * 값은 Phase 1 데모 예보(demo/measurements hourlyForecast)다.
 * ───────────────────────────────────────────── */

import { Icon } from "@iconify/react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from "@ds";
import { weatherOf } from "../../../demo/weather";
import { useScenario } from "../../../state/ScenarioProvider";
import { hourlyForecast, type ForecastSlot } from "../../../demo/measurements";

type WeatherRow = { label: string; cell: (slot: ForecastSlot) => React.ReactNode };
const ROWS: Record<string, WeatherRow> = {
  sky: { label: "날씨", cell: (s) => <Icon icon={s.skyIcon} className={cn("mx-auto size-5", s.rain > 0 ? "text-primary-text" : "text-foreground-muted")} aria-label={s.rainIntensity === "-" ? "흐림" : "비"} /> },
  temperature: { label: "기온", cell: (s) => <span className="font-mono text-foreground">{Math.round(s.temperature)}°</span> },
  feelsLike: { label: "체감", cell: (s) => <span className="font-mono">{Math.round(s.feelsLike)}°</span> },
  rain: { label: "강수", cell: (s) => <span className={cn(s.rainIntensity !== "-" && "text-primary-text")}>{s.rainIntensity}</span> },
  probability: { label: "확률", cell: (s) => <span className="font-mono">{s.rainProbability}%</span> },
  wind: {
    label: "바람",
    cell: (s) => (
      <span className="flex flex-col items-center leading-tight">
        <Icon icon="mdi:arrow-up-thin" className="size-4 text-foreground" style={{ transform: `rotate(${s.windFromBearing + 180}deg)` }} aria-label={`${s.windDirection}풍`} />
        <span>{s.windLabel}</span>
      </span>
    ),
  },
  humidity: { label: "습도", cell: (s) => <span className="font-mono">{s.humidity}%</span> },
};

/** 유형이 필요한 줄만 — 침수·범람·월류·산불·급경사지는 비와 바람, 폭염은 기온·체감·습도 */
const FOCUS: Record<"rain" | "heat", (keyof typeof ROWS)[]> = {
  rain: ["sky", "rain", "probability", "wind"],
  heat: ["sky", "temperature", "feelsLike", "humidity"],
};

export function TwinWeather({ districtId, focus = "rain" }: { districtId: string; /** 어느 줄을 세우나 — 유형이 정한다 */ focus?: "rain" | "heat" }) {
  const rows = FOCUS[focus].map((k) => ROWS[k]);
  /* 다섯 칸 — 좌측 열(300px)에서 "약간 강"·"약한비"가 한 줄에 서는 폭 */
  const slots = hourlyForecast(districtId).slice(0, 5);
  /* 기상은 트랙이 정한다 (04 §15-4). 트윈의 날씨효과도 이 값을 따라간다 */
  const { track } = useScenario();
  const WEATHER = weatherOf(track);

  return (
    <section className="flex flex-col gap-2 p-3" aria-label="시간별 예보">
      <header className="flex items-center gap-2">
        {/* 머리 아이콘은 흰색 — 색은 아래 줄의 날씨 아이콘만 든다(2026-09-15 사용자) */}
        <Icon icon={WEATHER.conditionIcon} className="size-7 shrink-0 text-foreground" aria-hidden />
        <span className="font-mono text-h5 font-semibold text-foreground">{WEATHER.temperature}℃</span>
        <span className="text-caption text-foreground-muted">{WEATHER.condition} · 습도 {WEATHER.humidity}%</span>
        <span className="ml-auto text-caption text-foreground-subtle">{WEATHER.windDirection} {WEATHER.windSpeed} m/s</span>
      </header>

      {/* DS Table — 오버레이 패널이라 셀 여백만 기본(h-10·p-3)에서 조인다 */}
      <Table className="table-fixed text-caption">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-6 w-10 px-1 text-left font-normal text-foreground-subtle">시각</TableHead>
            {slots.map((slot) => (
              <TableHead key={slot.label} className="h-6 px-1 text-center font-normal text-foreground-subtle">{slot.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label} className="hover:bg-transparent">
              <TableCell className="whitespace-nowrap px-1 py-0.5 text-left text-foreground-subtle">{row.label}</TableCell>
              {slots.map((slot) => (
                <TableCell key={slot.label} className="whitespace-nowrap px-0.5 py-0.5 text-center text-foreground-muted">{row.cell(slot)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
