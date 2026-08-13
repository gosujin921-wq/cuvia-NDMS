# CUVIA DSMS — 창원특례시 안전재난관제 데모

문서가 사양이다. `docs/정본/01~05` 가 정본이고 **코드보다 문서가 먼저다** — 새 지구명·수치·문안·상태값은 `04_데모_데이터.md` 에 등재한 뒤 `designs/src/demo/` 에 반영한다. 구현 순서는 `docs/작업/작업계획.md` (차수 I·J).

## ★ 데모 상태 엔진 — 단일 source of truth

**화면 컴포넌트에 시각·단계·등급·집계값을 리터럴로 쓰지 않는다.** 이 데모는 시연 도중 값이 변한다(S2 격상 · S6 승인 · S8 시계 점프). 화면마다 `"17:22"`, `"경보"`, `"3.41"` 을 하드코딩하면 격상 순간 여덟 군데(토스트·팝업·그래프·핀·뱃지·칩·시계·판정 카드)가 어긋나고, 03 §0-7 의 "모든 화면 요소가 같은 프레임에서 함께 바뀐다" 가 깨진다.

두 층으로 가른다:

- **정적 데이터** — 04 문서의 확정값(원장 18건 · 발령 기준 · 침수영향 · SOP 항목 · 전파 원장) → `demo/*.ts`. 시연 중 절대 변하지 않는다
- **시나리오 상태** — 변하는 전부를 공통 스토어 하나가 소유한다:
  - `scenarioStep` (S0~S9) — 화면 시계·도시 대응단계가 여기서 파생 (04 §0)
  - `selectedDistrict` / `selectedEvent` — 화면을 옮겨도 유지 (02 §2)
  - `approvedResponseLevel` — [대응등급 대피로 상향] 승인이 쓴다 (04 §10)
  - SOP 실행 결과 · 시연 중 쌓인 전파 내역

**화면에 보이는 모든 값은 `f(정적, 상태)` 로 계산한다.** 계측 단계 = §4-2 이력을 현재 시계로 자른 것, 도넛 = 원장 + 현재 시계, 핀 색 = 계측 단계, `대피 대응중` 배지 = `approvedResponseLevel`. 컴포넌트는 상태를 읽고 계산할 뿐 소유하지 않는다.

- 격상 8초 타이머는 **엔진이 소유**한다 — 팝업이 들면 팝업을 닫는 순간 격상이 취소된다 (03 §2 는 "팝업을 닫아도 격상은 일어난다")
- 새로고침 = S0(17:16) 리셋. 별도 리셋 수단 불필요 (04 §0)
- 선례: CUVIA_IDC `designs/src/state/DemoProvider.tsx` — 상태는 Provider 가 들고 컴포넌트는 `useDemo()` 로 읽는 구조를 그대로 따른다

## DS 컴포넌트 우선

**UI 를 손으로 만들기 전에 DS(`@cuvia/components`)에 있는지 먼저 확인한다.** Button · Card · Badge/StatusBadge · Tag · Dialog/Modal · DataTable · Tabs · Select · GlassPanel · MapMarker/MapControl · EmptyState · toast(sonner) 등 50여 종이 이미 있다 — 목록은 `designs/node_modules/@cuvia/components/src/index.ts` (barrel).

- import 는 항상 `@ds` (= `src/ds.ts` 재수출) 한 경로로만. `@cuvia/components` 직접 import 금지 — 제품(cuvia_platform_web) 이관 시 `ds.ts` 한 파일만 바꾸기 위한 규칙
- 직접 만드는 것은 DS 에 없는 것만 (`src/components/` 의 차트·맵 전용 부품이 그 예). 그때도 색·간격은 `@cuvia/tokens` 토큰(`var(--color-risk-lv*)` 등)을 쓰고 리터럴 색을 박지 않는다
- DS 컴포넌트가 살짝 안 맞으면 복제하지 말고 감싸서 쓴다. DS 자체를 고쳐야 하면 형제 클론에 `ds:link` 로 물려 작업 (designs/README.md)
