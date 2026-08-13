# CUVIA 안전재난관제시스템 데모

창원특례시를 대상으로 만드는 안전재난관제 데모. 시 전체 조망에서 시작해 지구·센서·CCTV로 좁히고, 경보 이력과 주민 전파를 거쳐 3D 침수 시뮬레이션까지 이어지는 흐름을 화면 5개(SCR-01~05)로 보여준다. 화면 구성은 남해군 조기경보시스템 시연 자료를 기준으로 삼았다. 여기에 다섯 화면이 들고 있는 것을 한 번의 질문으로 모아 오는 AI 검색(SCR-06)을 옆길로 붙였다.

| 폴더 | 무엇 |
|---|---|
| [designs/](./designs/) | 앱. Vite + React + Tailwind v4 ([실행법](./designs/README.md)) |
| [docs/](./docs/) | 작업·감사 문서와 레거시 정본 ([안내](./docs/README.md)) |

```bash
cd designs
corepack pnpm install
corepack pnpm dev      # http://localhost:5400
```

## 고치는 순서

화면 구성·수치·시나리오가 바뀌면 코드(`designs/src`)를 고친다. 확정값은 `src/demo/*.ts`, 화면 동작은 페이지·위젯, 시연 중 변하는 상태는 `src/state/ScenarioProvider.tsx` 가 든다.

[docs/레거시/정본/](./docs/레거시/정본/) 은 이 데모가 어떻게 짜였는지의 배경 자료다. 코드 주석의 절 참조(`04 §11` 등)가 가리키는 곳이지만 더 이상 갱신하지 않는다 — 코드와 어긋나면 코드가 맞다.
