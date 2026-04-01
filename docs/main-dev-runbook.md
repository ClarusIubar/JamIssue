# JamIssue `main-dev` / `dev.jamissue.com` 운영 메모

## 목적

- 운영선 `main` / `daejeon.jamissue.com`
- 개발선 `main-dev` / `dev.jamissue.com`

한 저장소 안에서 두 개의 배포 라인을 분리해, 운영 배포와 개발 검증을 서로 덜 간섭하게 만드는 것이 목적입니다.

## 브랜치 기준

- 운영 브랜치: `main`
- 개발 브랜치: `main-dev`

현재 dev 라인의 시작점은 `team/main` 최신본입니다.

## 도메인 기준

### 운영

- 프론트: `https://daejeon.jamissue.com`
- API: `https://api.daejeon.jamissue.com`
- Pages 프로젝트: `daejeon-jamissue-pages`
- Worker 서비스: `daejeon-jamissue-api`

### 개발

- 프론트: `https://dev.jamissue.com`
- API: `https://api.dev.jamissue.com`
- Pages 프로젝트: `daejeon-jamissue-pages-dev`
- Worker 서비스: `daejeon-jamissue-api-dev`

## GitHub Actions 반영 내용

### Pages

- `.github/workflows/cloudflare-pages.yml`
- `main` 과 `main-dev` 둘 다 감지
- `main-dev` 일 때:
  - Pages 프로젝트 이름: `daejeon-jamissue-pages-dev`
  - `PUBLIC_APP_BASE_URL=https://api.dev.jamissue.com`
  - Pages custom domain: `dev.jamissue.com`

### Worker

- `.github/workflows/cloudflare-worker.yml`
- `main` 과 `main-dev` 둘 다 감지
- `main-dev` 일 때:
  - `wrangler deploy --env dev`

## Worker dev 환경

- `deploy/api-worker-shell/wrangler.toml`
- `[env.dev]` 추가
- `api.dev.jamissue.com` custom domain route 추가
- `APP_FRONTEND_URL`, `APP_CORS_ORIGINS`, `APP_NAVER_LOGIN_CALLBACK_URL` 를 dev 도메인 기준으로 분리

## Cloudflare에서 추가로 확인할 것

### Pages

- 프로젝트: `daejeon-jamissue-pages-dev`
- custom domain: `dev.jamissue.com`
- production branch: `main-dev`

### Worker

- 서비스: `daejeon-jamissue-api-dev`
- custom domain: `api.dev.jamissue.com`

## 필요한 GitHub Secrets / Variables

현재 `main` 배포에 쓰는 아래 값들을 `main-dev`에도 그대로 재사용할 수 있습니다.

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `PUBLIC_NAVER_MAP_CLIENT_ID`
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`

Worker 시크릿은 서비스별로 같은 값을 사용해도 되지만, 운영/개발 분리가 필요하면 Cloudflare 대시보드에서 dev Worker 쪽에 따로 넣습니다.

## 추천 순서

1. `origin/main-dev` 브랜치 생성 및 push
2. GitHub Actions가 `daejeon-jamissue-pages-dev` 를 만들도록 실행
3. `dev.jamissue.com` Pages custom domain 활성 확인
4. Worker dev 배포 후 `api.dev.jamissue.com` 연결 확인
5. 네이버 로그인 콜백 URL에 `https://api.dev.jamissue.com/api/auth/naver/callback` 추가
