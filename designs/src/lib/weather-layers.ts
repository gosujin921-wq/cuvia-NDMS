/* ─────────────────────────────────────────────
 * 기상 격자 토글 한 벌 — 지도 화면 공용 (SCR-02 · SCR-05)
 *
 * 미리 구운 자료(public/weather · 외부-API-인계 §3)를 켜고 끄는 항목 정의다. 두 화면이
 * 같은 격자를 쓰면서 항목 이름·색·기본값을 따로 들면, 같은 비가 화면마다 다른 이름과
 * 다른 색으로 선다. 레이어 팝오버가 화면마다 다른 말을 하는 순간 같은 앱으로 안 읽힌다.
 *
 * ★ [영향 표현] 묶음에 든다. 전망을 만든 산정 조건이 해일 편차·강우 유입이고(04 §10-3),
 *   그 비와 바람이 지도에 없으면 근거의 세 항은 출처 없는 숫자로 남는다. "무엇이 이
 *   영향을 만들었나"와 "그래서 어디까지 잠기나"는 같은 물음의 앞뒤라 한 묶음이다.
 * ───────────────────────────────────────────── */

export const WEATHER_ITEMS = [
  { id: "rain", label: "강수", color: "#8668db", icon: "mdi:weather-pouring" },
  { id: "temp", label: "기온", color: "#d15f33", icon: "mdi:thermometer" },
  { id: "wind", label: "바람", color: "#94a3b8", icon: "mdi:weather-windy" },
] as const;

export type WeatherKey = (typeof WEATHER_ITEMS)[number]["id"];
export type WeatherState = Record<WeatherKey, boolean>;

export function isWeatherKey(id: string): id is WeatherKey {
  return WEATHER_ITEMS.some((item) => item.id === id);
}

/**
 * 기본 켜짐 — 바람·강수는 폭풍해일 상황의 배경 결이라 켜 두고, 기온 색면은 꺼 둔다.
 *
 * 기온은 지도를 통째로 덮는 색면이라 켜면 그 아래 지구·장비가 묻힌다. 특히 트윈의
 * 기울인 3D 씬에서는 건물이 색면 위에 뜬 것처럼 보인다 — 필요한 사람만 켠다.
 */
export const DEFAULT_WEATHER: WeatherState = { rain: true, temp: false, wind: true };

/**
 * 재난관제(SCR-02)의 기본값 — 전부 꺼짐.
 *
 * 항목은 트윈과 같이 두되 켜진 채로 열지 않는다. 재난관제는 "무슨 일이 났고 왜 위험한가"를
 * 지도에서 짚는 화면이라 장비 핀과 침수 주제도가 주인공이고, 그 위에 비·바람 격자를 깔면
 * 짚어야 할 핀이 색면에 묻힌다. 지도를 열면 켜져 있어야 하는 것은 해안침수예상도·
 * 침수흔적도 둘이다.
 *
 * 트윈은 반대다 — 그 비가 전망을 만든 조건이라 켜진 채로 연다(DEFAULT_WEATHER).
 */
export const WEATHER_OFF: WeatherState = { rain: false, temp: false, wind: false };

/** 팝오버 항목 한 벌 — 두 화면이 같은 모양으로 세운다 */
export function weatherLayerItems(state: WeatherState) {
  return WEATHER_ITEMS.map((item) => ({
    id: item.id,
    label: item.label,
    color: item.color,
    icon: item.icon,
    visible: state[item.id],
  }));
}
