# CUVIA 안전재난관제시스템 데모

창원특례시를 대상으로 만드는 안전재난관제 데모. 시 전체 조망에서 시작해 지구·센서·CCTV로 좁히고, 경보 이력과 주민 전파를 거쳐 3D 침수 시뮬레이션까지 이어지는 흐름을 화면 5개(SCR-01~05)로 보여준다. 화면 구성은 남해군 조기경보시스템 시연 자료를 기준으로 삼았다. 여기에 다섯 화면이 들고 있는 것을 한 번의 질문으로 모아 오는 AI 검색(SCR-06)을 옆길로 붙였다.

| 폴더 | 무엇 |
|---|---|
| [designs/](./designs/) | 앱. Vite + React + Tailwind v4 ([실행법](./designs/README.md)) |
| [docs/](./docs/) | 기준·작업 문서 ([안내](./docs/README.md)) |

```bash
cd designs
corepack pnpm install
corepack pnpm dev      # http://localhost:5400
```

## 고치는 순서

화면 구성·수치·시나리오가 바뀌면 [docs/정본/](./docs/정본/) 을 먼저 고치고 코드를 따라오게 한다. 코드 주석이 정본 문서를 경로로 참조하므로, 문서를 건너뛰면 어느 쪽이 맞는지 알 수 없게 된다.
