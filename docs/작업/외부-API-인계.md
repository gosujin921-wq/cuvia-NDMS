# 외부 API · 인증키 인계 문서

`weather` 브랜치에서 붙인 **외부 데이터 3곳**의 접속 정보·설정값·인증키를 한 자리에 모았다.
이어받는 사람이 이 문서 하나로 (1) 무엇이 어디서 오는지 (2) 다시 굽는 법 (3) 납품 전 손봐야 할
자리를 알 수 있게 쓴다.

작업 배경과 "왜 이렇게 했나"는 [weather-브랜치-노트](weather-브랜치-노트.md) 에 있다. 이 문서는
**접속 정보와 조작법**만 다룬다.

> ⚠ **이 문서에는 실제 인증키가 적혀 있다.** 저장소가 공개로 바뀌거나 외부에 넘길 일이 생기면
> §7 을 먼저 처리한다.

> ★ **재구현 메모 (2026-08-13).** weather 브랜치 원본 코드는 이 저장소로 넘어오지 못했다
> (로컬·원격 어디에도 없고, 위 브랜치 노트도 못 받았다). 이 문서를 사양 삼아 main 에
> 재구현했고, §8 배치의 파일명·역할은 그대로다. 원본과 다른 점 셋:
> 1. 굽은 파일 크기가 다르다(wind-field 35KB · temperature-field 98KB). 값 반올림 자리가
>    달랐던 것으로 보이며, **기온 검증(서항 17시 = 04 §5 의 32.4℃)과 범위(22.8~35.6℃)는
>    문서값과 정확히 일치**한다
> 2. 지형 격자는 시역 한 판이 아니라 **지구별 ±1.3km 패치 12개**(50KB)로 굽는다. 침수
>    씬이 지구 중심 둘레만 그리므로 그만큼만 뜬다. 굽는 방식(playwright + dev 서버 + 같은
>    terrain-rgb-v2 타일)은 §6 그대로이고, .png 로 요청해도 WebP 가 오는 것을 재확인했다
> 3. 트윈 침수면이 격자를 실제로 문다. 수위보다 낮은 칸에만 물을 채우고 침수선은 수위
>    등고선(marching squares)으로 뜬다. 격자가 없는 지구는 예전 원형 수면으로 물러난다

---

## 1. 한눈에

| 서비스 | 무엇을 받나 | 인증 | 실시간? | 붙은 상태 |
|---|---|---|---|---|
| **Open-Meteo** (archive/ERA5) | 바람 방향·세기 격자 | **불필요** | 아니오 · 미리 구움 | 종합상황 지도 바람 입자 |
| **Open-Meteo** (historical-forecast/KMA) | 기온 격자 1.5km | **불필요** | 아니오 · 미리 구움 | 종합상황 지도 기온 색면 |
| **생활안전지도** (행안부 WMS) | 해안침수예상도·침수흔적도 | 서비스키 필요 | **예 · 실시간 타일** | 지도 레이어 2종 |
| **MapTiler** | 베이스맵 스타일 · 지형 고도 타일 | API 키 필요 | **예 · 실시간 타일** | 지도 전체 + 트윈 침수면 |

**시연 중 네트워크를 타는 것은 생활안전지도와 MapTiler 둘뿐이다.** 날씨(바람·기온)는 전부
`public/weather/*.json` 으로 미리 구워 두었다 — 현장 네트워크가 죽어도 날씨 화면은 그대로 뜬다.

---

## 2. 인증키 · 토큰

| 키 | 값 | 박혀 있는 자리 | 발급처 | 상태 |
|---|---|---|---|---|
| MapTiler API Key | `WPWmpNf4y5nzKDA7mQXe` | [map-config.ts:13](../../designs/src/lib/map-config.ts#L13) · [fetch-terrain-grid.mjs:63](../../designs/scripts/fetch-terrain-grid.mjs#L63) | maptiler.com | **CUVIA 제품군 공용값.** 이 저장소가 발급한 것이 아니다 |
| 생활안전지도 서비스키 | `HVS1OPHY-HVS1-HVS1-HVS1-HVS1OPHYU3` | [safemap.ts:27](../../designs/src/lib/safemap.ts#L27) | safemap.go.kr 오픈API | 개인 신청분 · 인터페이스별 승인 상태는 §4 표 |
| Open-Meteo | — | — | — | **키 없음.** 신청·가입 불필요 |

**둘 다 브라우저 요청 주소에 그대로 실려 나간다.** 개발자도구를 열면 보인다. 데모라 그대로 두었고,
`.env` 파일은 만들지 않았다 (프로젝트에 `.env` 체계 자체가 없다). 납품 전 처리는 §7.

**MapTiler 키를 바꾸면 두 자리를 같이 고쳐야 한다.** 스타일 URL 과 지형 타일 URL 이 같은 키를 쓰고,
서로 다른 고도 자료를 물면 트윈 침수면이 울퉁불퉁해진다.

---

## 3. Open-Meteo — 날씨 격자 (키 없음)

### 3-1. 바람 — ERA5 재분석

```
GET https://archive-api.open-meteo.com/v1/archive
    ?latitude=<쉼표로 이은 위도들>&longitude=<쉼표로 이은 경도들>
    &start_date=2018-08-23&end_date=2018-08-23
    &hourly=wind_speed_10m,wind_direction_10m
    &timezone=Asia%2FSeoul&wind_speed_unit=ms
```

| 설정 | 값 | 어디 |
|---|---|---|
| 날짜 · 사건 | `2018-08-23` 태풍 솔릭 | `DATE` / `EVENT` 상수 |
| 격자 범위 | 126.0~131.5°E · 33.0~37.0°N (남해안 광역) | `WEST/EAST/SOUTH/NORTH` |
| 눈금 | 0.25° (≒25km · ERA5 원본 해상도) | `STEP` |
| 지점 수 | 23×17 = **391** | 계산됨 |
| 굽는 시각 | 12~23시 12장 · 화면은 22시 | `HOURS` / `DEFAULT_HOUR` |
| 결과 | `public/weather/wind-field.json` (51 KB) | |

전 지점을 **한 요청**에 넣는다. 391 지점이면 URL 이 아직 짧아 나눌 필요가 없다.

### 3-2. 기온 — 기상청 국지예보(LDPS) 1.5km

```
GET https://historical-forecast-api.open-meteo.com/v1/forecast
    ?latitude=<…>&longitude=<…>
    &start_date=2025-08-24&end_date=2025-08-24
    &hourly=temperature_2m
    &models=kma_seamless&timezone=Asia%2FSeoul
```

| 설정 | 값 | 어디 |
|---|---|---|
| 날짜 · 사건 | `2025-08-24` 폭염 | `DATE` / `EVENT` |
| 기준점 | 서항지구 `35.197, 128.567` | `SEOHANG` |
| 눈금 | 0.015° (≒1.5km · 원본 해상도) | `STEP` |
| 격자 범위 | 서항에서 서18·동32·남20·북20 칸 → bbox `128.297, 34.897, 129.047, 35.497` | `REACH` |
| 지점 수 | 51×41 = **2,091** | 계산됨 |
| 굽는 시각 | 12~21시 10장 · 화면은 17시 | `HOURS` / `DEFAULT_HOUR` |
| 결과 | `public/weather/temperature-field.json` (99 KB) · 22.8~35.6℃ | |

**⚠ 격자 눈금을 어림수로 바꾸지 말 것.** 모든 좌표가 `서항 ± STEP 의 정수배` 로 놓여 있다.
`128.3` 같은 값에서 시작하면 서항이 눈금 사이에 떨어져 옆 칸(32.8℃)을 물고, **04 §5 의 32.4℃ 와
어긋난다** — 이 날짜를 고른 이유가 사라진다. `REACH` 는 키워도 되지만 `STEP` 과 `SEOHANG` 은 고정.

**⚠ 자료가 있는 기간이 좁다.** 2024년 이전과 2026년은 값이 전부 `null` 로 온다. 시나리오 당일
(2026-08-12)을 못 쓴 이유가 이것이다.

### 3-3. 호출 한도 — 지점 수로 센다

무료 한도가 요청 수가 아니라 **지점 수**다. 250 지점 한 번 = 250 콜.

- 한 번에 `BATCH = 250` 지점씩 나눠 보낸다 (더 넣으면 URL 이 길어 거절)
- 429 를 받으면 `COOLDOWN_MS = 65초` 쉬고 그 묶음부터 다시 받는다 — 스크립트가 알아서 한다
- 2,091 지점이면 **429 를 두어 번 맞고 총 5분쯤** 걸린다. 다섯 번 걸리면 포기하고 끝난다

범위를 넓힐 때 드는 값 (1.5km 격자는 1도²당 약 4,400 지점):

| 범위 | 지점 | 시간 | 파일 |
|---|---|---|---|
| 지금 (창원+여백) | 2,091 | 5분 | 99 KB |
| 경남·부산권 | 약 13,000 | 15~20분 | 약 600 KB |
| 남해안 전역 | 약 98,000 | 약 2시간 | 약 4.6 MB |

### 3-4. 출처 표기 (라이선스)

CC BY 4.0 이라 화면 어딘가에 출처가 있어야 한다. **지금은 화면 표기가 없다.** 레이어
팝오버 안내 줄에 있던 표기를 걷어냈고(2026-08-13), 다른 자료 출처와 함께 **추후 한곳**
(정보·출처 모달 등)에 모아 정리하기로 했다. 공개 배포 전에 반드시 넣어야 한다. 정식 문구:

- 바람 — `Open-Meteo (CC BY 4.0) · ERA5 재분석 / Copernicus Climate Change Service`
- 기온 — `Open-Meteo (CC BY 4.0) · 기상청(KMA) 국지예보모델`

---

## 4. 생활안전지도 WMS — 행안부 공식 침수 자료

실시간 타일이다. 지도를 움직일 때마다 요청이 나간다.

```
GET https://www.safemap.go.kr/openapi2/<인터페이스ID>_WMS
    ?serviceKey=HVS1OPHY-HVS1-HVS1-HVS1-HVS1OPHYU3
    &layers=<레이어명>&styles=&format=image/png
    &srs=EPSG:3857&width=512&height=512&transparent=TRUE
    &bbox={bbox-epsg-3857}
```

### 인터페이스별 승인 상태 — **같은 키인데 갈린다**

| 인터페이스 | 자료 | `layers` | 지금 키로 |
|---|---|---|---|
| IF_0091 | 복합 해안침수예상도 2단계(2024~) | `A2SM_FLUDEXPECT_22` | **200 · 사용 중** |
| IF_0092 | 침수흔적도 | `A2SM_FLUDMARKS` | **200 · 사용 중** |
| IF_0100 | 하천범람지도(지방하천) | `A2SM_FLOODFOVRRISK2` | **200 · 아직 안 붙임** |
| IF_0089 | 하천범람지도(국가하천) | `A2SM_FLOODFOVRRISK1` | 500 · 미등록 |
| IF_0090 | 해안침수예상도 1단계(2009~2023) | `A2SM_FLUDEXPECT` | 500 · 미등록 |

미등록분은 `등록되지 않은 서비스키` 500 이 온다. 키가 틀린 게 아니라 **그 인터페이스 승인이 없는
것**이니, 필요해지면 safemap.go.kr 에서 해당 인터페이스를 추가 신청한다.

IF_0100 을 붙일 때는 [safemap.ts](../../designs/src/lib/safemap.ts) 의 `SAFEMAP_LAYERS` 에 한 줄
더하면 끝난다 — 호출 규격이 IF_0091·0092 와 같다. 침수심 5등급 색: `#ffff7f` 0.5m 미만 ·
`#bfff00` 0.5~1 · `#00ffff` 1~2 · `#bf7fff` 2~5 · `#ff007f` 5m 이상.

### 여기서 막혔던 자리 넷 — 다시 헤매지 말 것

1. 호스트에 **`www.` 가 있어야** 한다. 없으면 302 로 흘러간다
2. 좌표계는 **EPSG:3857**. 공식 예제의 4326 으로는 안 온다
3. **`styles` 는 비워야 한다.** 범례 API 가 `STYLE: A2SM_FloodFovrRisk` 를 알려주지만 그 값을
   넣으면 400 이다. 반대로 `layers` 는 **반드시** 넣어야 한다 (공식 Java 예제에는 빠져 있다)
4. 레이어명은 짐작하면 전부 400 이다. 정답은 범례 API 가 알려준다:
   `https://www.safemap.go.kr/openapi2/lgdInfo?serviceKey=<키>&intId=IF_0091`

---

## 5. MapTiler — 베이스맵 · 지형 고도

```
스타일  https://api.maptiler.com/maps/019cd585-7992-7faa-9a87-243ab5ce8247/style.json?key=<키>
고도타일 https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=<키>
```

- 스타일 ID `019cd585-…` 는 **CUVIA 제품군 공통**이다. MapTiler 쪽에서 고치면 다른 제품에도 번지므로
  이 앱에서만 덮어쓴다 ([map-config.ts](../../designs/src/lib/map-config.ts) 참고)
- 스타일이 `terrain-rgb-v2` 고도 소스를 이미 물고 있다 — 3D 지형·지형 음영은 손댈 것이 없다
- 트윈 침수면용 고도 격자는 **같은 타일을 직접 받아** 굽는다. 다른 고도 자료를 쓰면 두 값이 몇 m씩
  어긋나 수면이 울퉁불퉁해진다
- 고도값 환산: `-10000 + (R×65536 + G×256 + B) × 0.1` (terrain-rgb 규격)

**⚠ 이 고도 자료는 90m 격자 지표면 모형이라 항만 일대를 실제보다 6~7m 높게 본다.** 공식
해안침수예상도와의 겹침이 55% 에서 천장을 친다. 그래서 "어디까지 잠기나"는 생활안전지도가 답하고,
이 격자는 "수위가 오르면 어떻게 차오르나"의 모양만 맡는다. 자세히는 브랜치 노트 §확인한 것.

---

## 6. 다시 굽는 법

전부 `designs/` 안에서 실행한다. `package.json` 에 script 로 등록하지 않았다 — 자주 돌릴 것이
아니고, 실수로 시연 직전에 돌면 곤란해서다.

| 명령 | 걸리는 시간 | 전제 | 결과 |
|---|---|---|---|
| `node scripts/fetch-wind-field.mjs` | 수 초 | — | `public/weather/wind-field.json` |
| `node scripts/fetch-temperature-field.mjs` | **약 5분** (429 대기 포함) | — | `public/weather/temperature-field.json` |
| `node scripts/fetch-terrain-grid.mjs` | 수 분 | **dev 서버(`pnpm dev`, :5400) 가 떠 있어야 함** + playwright chromium 설치 | `public/weather/terrain-grid.json` (835 KB) |

`fetch-terrain-grid.mjs` 가 브라우저를 띄우는 것은 **MapTiler 가 확장자와 무관하게 WebP 를 주는데
노드에 WebP 디코더가 없어서**다. 크로미움 canvas 로 픽셀을 읽는다. `about:blank` 는 출처가 없어
canvas 를 못 읽으므로 dev 서버를 출처로 삼는다 — 그래서 서버가 떠 있어야 한다. 크로미움 경로는
`~/Library/Caches/ms-playwright` 에서 찾는다 (**macOS arm64 전용 경로가 박혀 있다** — 다른 OS 에서
이어받으면 이 부분을 고쳐야 한다).

기온 스크립트는 마지막에 `서항지구 17:00 — 32.4℃ (04 §5 문서값: 32.4℃)` 를 찍는다. **이 두 값이
갈리면 굽기가 잘못된 것**이니 그대로 커밋하지 말 것.

---

## 7. 납품 전 반드시 (지금은 데모라 미룬 것)

- [ ] **MapTiler 키 정책 확인.** 제품군 공용 키를 그대로 쓰고 있다. 도메인 제한을 걸거나 이 제품용
      키를 따로 발급한다
- [ ] **생활안전지도 서비스키 재발급 + 서버 뒤로 숨기기.** 지금은 브라우저 요청 주소에 그대로 실린다.
      WMS 타일을 우리 서버가 중계(proxy)하는 형태가 정석이다
- [ ] 두 키를 코드에서 빼 환경변수로 돌린다 (`VITE_MAPTILER_KEY` / `VITE_SAFEMAP_KEY`).
      지금 프로젝트에 `.env` 체계가 없어 이때 같이 만든다. 고칠 자리는 §2 표의 3곳뿐
- [ ] 자료 출처 표기를 한곳(정보·출처 모달 등)에 모아 정식으로 넣는다. Open-Meteo CC BY 4.0
      필수 (§3-4 문구), 행안부 생활안전지도·MapTiler 도 함께. 팝오버 표기는 걷어낸 상태라
      공개 배포 전까지가 시한이다
- [ ] 기상청 연동으로 갈아끼울 계획이면 — Open-Meteo 는 "승인을 기다리지 않고 오늘 붙는" 임시
      선택이었다. 공공데이터포털 기상청 API 승인이 나면 §3 의 두 스크립트만 갈면 된다

---

## 8. 배선 — 어느 파일이 무엇을 하나

| 몫 | 바람 | 기온 | 침수(공식) | 침수(격자) |
|---|---|---|---|---|
| 굽는 스크립트 | `scripts/fetch-wind-field.mjs` | `scripts/fetch-temperature-field.mjs` | — (실시간) | `scripts/fetch-terrain-grid.mjs` |
| 구운 파일 | `public/weather/wind-field.json` | `public/weather/temperature-field.json` | — | `public/weather/terrain-grid.json` |
| 읽는 부품 | `lib/wind-field.ts` | `lib/temperature-field.ts` | `lib/safemap.ts` | `lib/terrain-grid.ts` |
| 그리는 부품 | `lib/wind-layer.ts` (WebGL 입자) | `lib/temperature-layer.ts` (캔버스 색면) | (WMS raster) | `lib/flood-scene.ts` |
| 붙이는 훅 | `lib/useWindLayer.ts` | `lib/useTemperatureLayer.ts` | — | — |
| 서는 화면 | SCR-01 | SCR-01 | SCR-01 · SCR-05 | SCR-05 |

**강수·기압·습도를 붙일 때는 이 배관을 그대로 복제한다** — Open-Meteo 스크립트의 `hourly=` 를
`precipitation` / `surface_pressure` 로 갈고 색 기준만 바꾸면 된다. 다만 강수는 색면보다 움직이는
표현이 어울리고 기압은 등압선이라 색면이 아니다 — **표현부터 정한 뒤** 굽는다.

`hourly=` 에 여러 항목을 쉼표로 이어 한 번에 받을 수 있다. 지점 수 한도는 항목 수와 무관하므로,
강수·기압을 함께 쓸 거라면 기온 굽기에 얹어 한 번에 받는 편이 5분을 두 번 쓰지 않는 길이다.

---

## 9. 불러와지는데 아직 안 붙인 것

| 자료 | 어디서 | 상태 |
|---|---|---|
| 시간당 강수량 · 기압 · 습도 | Open-Meteo (같은 배관) | 신청 불필요 · 표현 미정 |
| 하천 유량 (GloFAS) | Open-Meteo Flood API | 낙동강 하구 태풍 당일 42 → 204 → 1011 m³/s. **격자가 5km 라 창원천·남천 같은 지방하천은 구분 안 됨** |
| 토양 수분 | Open-Meteo | 주남저수지 제방 변위(시나리오 5)의 선행 강우 지표로 쓸 수 있다 |
| 하천범람지도(지방하천) | 생활안전지도 IF_0100 | **키가 열려 있다.** `SAFEMAP_LAYERS` 한 줄이면 붙는다 (§4) |
| 국토지리정보원 5m DEM | — | 침수 범위를 직접 산정할 경우의 원본. **신청 필요** |
