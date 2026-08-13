# 모션·z 층서 상수 정리안

> 대상: `designs/src` 전역
> 목적: 화면마다 리터럴로 흩어진 지속·간격·이징·z 값을 한 곳으로 모은다
> 결과물: `src/lib/motion.ts` 한 파일 + 아래 체크리스트

---

## 1. 왜 모으나

같은 값이 여러 자리에 리터럴로 서 있으면 하나를 고칠 때 나머지가 남는다. 상태 엔진에서 시각·단계·등급을 한 곳이 소유하게 만든 것과 같은 이유이고(CLAUDE.md), 모션은 아직 그 정리를 안 거쳤다.

지금 실제로 아픈 자리는 둘이다.

- **지도 카메라 `500`이 다섯 곳**에 있는데 뜻은 셋(복귀 · 확대 · 이동)이다
- **z 값이 두 평면**(지도 마커 스택 · 화면 Tailwind 스택)에 섞여 있고, 지도 평면의 `1`을 두 화면이 각각 다른 뜻으로 쓴다

나머지는 지금 어긋나 있지 않다. 같이 옮기되 순서는 뒤다.

---

## 2. 경계 규칙

이 정리의 요지는 "정본을 언제 봐야 하는가"의 선을 긋는 것이다.

| 부류 | 정본 확인 | 예 |
|---|---|---|
| **시나리오 타이밍** | 필요. 04·05가 값을 소유한다 | 격상 3초 · SOP 순차 0.45초 · 유입 1.6초 · 지구 진입 0.7초 |
| **순수 표현** | 불필요. 정본에 없고 앞으로도 없다 | 호버 확대율 · 이징 · z 층서 · 차트 전환 · 타이핑 속도 |

정본 출처가 있는 값은 `motion.ts` 로 옮길 때 **출처 주석**(`04 §15-1` 형태)을 단다. 그 주석이 곧 "이 값을 바꾸려면 문서부터"라는 표시다. 출처 주석이 없는 값은 코드가 자유롭게 정한다.

> 05 S6 은 "항목이 순차로 넘어가는 0.45초 간격이 이 컷의 전부다"라고 적고 있다. 연출 숫자로 보이지만 대본의 일부다. 이런 값이 넷 있다.

---

## 3. 인벤토리

### 3-1 시나리오 타이밍 (5자리)

| | 값 | 위치 | 출처 주석 |
|---|---|---|---|
| [ ] | `delayMs: 3_000` 서항 격상 | `state/ScenarioProvider.tsx:67` | 04 §0 · 05 S2 |
| [ ] | `autoEscalateMs: 3_000` 봉암 격상 | `state/ScenarioProvider.tsx:146` | 04 §15-1 |
| [ ] | `ONSET_STEP_MS = 1_600` 유입 간격 | `state/ScenarioProvider.tsx:150` | 04 §15-1 |
| [ ] | `STEP_MS = 450` SOP 순차 | `pages/scr-02/widgets/SopPanel.tsx:46` | 05 S6 |
| [ ] | `+ 200` 완료 토스트 여유 | `pages/scr-02/widgets/SopPanel.tsx:141` | 없음 (자유) |

같은 3초가 트랙 spec 두 곳에 따로 있다. 트랙별로 다를 이유가 없으면 상수 하나로 묶고 두 spec 이 그것을 참조한다.

### 3-2 지도 카메라 (7자리) ★ 1순위

| | 값 | 위치 | 뜻 |
|---|---|---|---|
| [ ] | `700` | `pages/scr-02/EarlyWarningPage.tsx:163` | 지구 진입 (05 S1 "0.7초") |
| [ ] | `800` | `pages/scr-05/DigitalTwinPage.tsx:289` | 트윈 진입 (문서에 숫자 없음) |
| [ ] | `500` | `pages/scr-02/EarlyWarningPage.tsx:347` | 원래대로 |
| [ ] | `500` | `pages/scr-05/DigitalTwinPage.tsx:552` | 원래대로 |
| [ ] | `500` | `pages/scr-01/OverviewDashboardPage.tsx:156` | 원래대로 |
| [ ] | `500` | `components/MapClusters.tsx:160` | 클러스터 확대 |
| [ ] | `500` | `pages/scr-02/EarlyWarningPage.tsx:181` | 팝업 자리 맞춤 `panBy` |
| [ ] | `400` | `components/MapUtilStrip.tsx:114` | 기울기 토글 |
| [ ] | `0` | `pages/scr-01/OverviewDashboardPage.tsx:117` | 최초 진입 (즉시) |

권장 이름 셋: `CAMERA_ENTER`(진입) · `CAMERA_RESET`(복귀) · `CAMERA_NUDGE`(확대·이동). 지구 진입 700 은 05 S1 이 소유하므로 출처 주석을 단다. 트윈 진입 800 은 문서에 숫자가 없으니 자유값이고, 700 으로 맞출지 800 을 남길지만 정하면 된다.

### 3-3 컴포넌트 전환 (4자리)

| | 값 | 위치 |
|---|---|---|
| [ ] | `1s ease-out` ×2 | `components/ArcGauge.tsx:103,110` |
| [ ] | `0.9s ease-out` + `120ms` 스태거 | `components/RingDonut.tsx:116` |
| [ ] | `duration-500` 진행바 | `components/DemoControls.tsx:68` |
| [ ] | `TYPE_MS = 26` 타이핑 | `pages/scr-06/AiSearchPage.tsx:87` |

게이지 1s 와 도넛 0.9s 는 같은 동작("값이 차오른다")인데 값이 다르다. 이유가 없으면 하나로 맞춘다.

### 3-4 CSS 키프레임 (2자리 · `src/index.css`)

| | 값 | 위치 | reduced-motion 가드 |
|---|---|---|---|
| [ ] | `agent-glow-spin 3s linear infinite` | 105행 | 있음 (121행) |
| [ ] | `rain-fall 1.6s linear infinite` | 179행 | 있음 (182행) |

비 애니메이션 1.6s 는 유입 간격 1.6s 와 숫자만 같고 뜻이 다르다. 한 파일에 모을 때 이름으로 확실히 갈라 둔다. 새 애니메이션을 더할 때는 `prefers-reduced-motion` 가드를 같이 넣는다(위 둘이 선례다).

### 3-5 Tailwind 유틸 (4자리)

| | 값 | 위치 |
|---|---|---|
| [ ] | `hover:scale-105` | `components/AgentFab.tsx:40` · `pages/scr-01/widgets/DistrictMarkers.tsx:97` · `pages/scr-01/widgets/AgentBar.tsx:165` |
| [ ] | `hover:scale-[1.03]` | `pages/scr-01/widgets/AgentBar.tsx:99` (혼자 다르다) |
| | `active:scale-95` 3곳 | 값 일치. 손댈 것 없음 |
| | `transition-colors` 20여 곳 | 값 일치. 손댈 것 없음 |
| | `animate-pulse` 7곳 · `animate-spin` 5곳 | DS 기본. 손댈 것 없음 |

클래스 문자열이라 `motion.ts` 로 옮기기보다 값을 통일하는 쪽이 낫다. 1.03 을 105 로 맞추면 끝난다.

### 3-6 z 층서

**지도 평면** (MapLibre 마커 element 스택)

| | z | 무엇 | 위치 |
|---|---|---|---|
| | auto | 기본 장치 핀 · 지구 칩 | |
| [ ] | `1` | 이벤트 핀 | `pages/scr-02/widgets/DeviceMarkers.tsx:104` |
| [ ] | `1` | 지구 칩 호버·포커스 | `pages/scr-01/widgets/DistrictMarkers.tsx:80` |
| [ ] | `2` | 팝업 `.dsms-popup` | `src/index.css:135` |

두 개의 `1` 은 서로 다른 화면이라 지금 부딪히지 않는다. 다만 층서 표에 나란히 서게 되므로 이름을 갈라 둔다(`PIN_RAISED` · `CHIP_HOVER` 등).

**화면 평면** (Tailwind)

| | z | 무엇 | 위치 |
|---|---|---|---|
| | `z-0` | 지도 컨테이너 | 페이지 3곳 |
| | `z-20` | 좌우 레일 · 하단 요소 | `lib/layout.ts:40` `RAIL_BASE` + 페이지 3곳 |
| | `z-30` | 유틸 스트립 · 상단 캡슐 | `lib/layout.ts:43` `UTIL_STRIP` + 페이지 4곳 |
| | `z-40` | AgentFab · AgentBar 칩 목록 | `components/AgentFab.tsx:39` · `pages/scr-01/widgets/AgentBar.tsx:87` |
| | `z-50` | 데모 컨트롤 | `components/DemoControls.tsx:59,81` |

화면 평면은 이미 `layout.ts` 가 절반을 들고 있고 값도 어긋나지 않는다. **문서로 표를 남기는 것까지만** 하고 코드는 두는 편이 낫다. 층을 새로 추가할 때 이 표를 보면 된다.

**지역 스택** (위 두 표와 무관하니 섞지 않는다)

- `agent-glow` 의 `0` / `1`: `src/index.css:107,118`
- 트윈 슬라이더 손잡이 `z-10`: `pages/scr-05/widgets/WaterLevelCondition.tsx:82`

---

## 4. 정리 순서

1. `src/lib/motion.ts` 신설. 3-2 지도 카메라부터 옮긴다 (뜻 셋으로 갈라 이름 붙이기)
2. 3-6 z 층서: 지도 평면 세 값을 `motion.ts` 로, 화면 평면은 이 문서의 표로만 남긴다
3. 3-1 시나리오 타이밍. 출처 주석을 달아 옮기고, 3초 두 자리를 하나로 묶는다
4. 3-3 · 3-4 · 3-5. 값 통일이 필요한 것만 손댄다 (게이지·도넛, 1.03)

1~2 만 해도 이 정리의 값어치는 거의 다 나온다. 3~4 는 지나가다 같이 쳐도 된다.

---

## 5. 수용 기준

- [ ] 화면 컴포넌트에 지속·간격 리터럴이 남지 않는다 (Tailwind 유틸 클래스는 예외)
- [ ] 정본이 값을 소유하는 다섯 자리에 출처 주석이 붙어 있다
- [ ] 지도 평면과 화면 평면의 z 가 한 표 안에서 섞이지 않는다
- [ ] 05 S2 격상 · S6 SOP 순차 · 봉암 발생 연출이 정리 전과 같은 속도로 돈다
- [ ] `type-check` · `build` 통과

## 6. 하지 말 것

- **`motion.ts` 에 정본 값을 새로 만들지 않는다.** 04·05 에 있는 값을 옮겨 담을 뿐이다. 여기서 3초를 2.5초로 바꾸면 대본과 갈린다
- **화면 평면 z 를 상수로 바꾸느라 Tailwind 클래스를 걷지 않는다.** `z-20` 이 문자열로 보이는 편이 레일 배치를 읽을 때 낫다
- **`transition-colors` 를 건드리지 않는다.** 20여 곳이 이미 같은 값이고, 모아도 얻는 것이 없다
