# CUVIA 안전재난관제 designs

Vite + React + Tailwind v4. 공통 부품·토큰은 `@cuvia/components` / `@cuvia/tokens`(사내 Gitea npm 레지스트리)를 사용한다.

## 설치·실행

`@cuvia/*` 패키지는 인증이 필요하다. `~/.npmrc` 에 Gitea PAT(read:package 권한) 한 줄 추가:

```
//gitea.cudodev.synology.me:5001/api/packages/cuvia/npm/:_authToken=<PAT>
```

```bash
corepack pnpm install
corepack pnpm dev   # http://localhost:5400
```

## 디자인 시스템 라이브 작업 (선택)

`cuvia_platform_design` 클론이 이 저장소의 형제 폴더(`../cuvia_platform_design` 기준: 상위 폴더)에 있으면, 레지스트리 버전 대신 클론 소스를 직접 물려 DS 수정을 즉시 반영할 수 있다.

```bash
corepack pnpm ds:link     # DS 클론 소스로 전환. DS 수정이 dev 서버에 즉시 반영
corepack pnpm ds:unlink   # 레지스트리 버전으로 복귀
```

링크는 `pnpm install` 을 다시 돌려도 유지된다. 대신 링크 중에는 `pnpm-lock.yaml` 에 `link:` 경로가 기록되므로(package.json 은 안 바뀜), **lockfile 을 커밋하기 전에 반드시 `ds:unlink` 로 해제**해서 `link:` 가 남지 않은 상태로 커밋한다.
