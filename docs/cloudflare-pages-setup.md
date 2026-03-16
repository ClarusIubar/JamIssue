# Cloudflare Pages setup

프론트는 Cloudflare Pages로 배포하고, API는 별도 Worker/FastAPI 런타임으로 연결합니다.

## 이번 프로젝트에서 고정할 도메인
- 프론트: `https://jamissue.growgardens.app`
- API: `https://api.jamissue.growgardens.app`
- OAuth callback: `https://api.jamissue.growgardens.app/api/auth/naver/callback`

## 가장 중요한 구분
- `jamissue.growgardens.app` = 사용자가 보는 프론트 주소
- `api.jamissue.growgardens.app` = 프론트가 호출하는 백엔드 API 주소
- 네이버 로그인 callback 은 프론트 주소가 아니라 백엔드 API 주소여야 합니다.

## Pages 프로젝트
기본 Pages 프로젝트 이름은 `jamissue-web` 입니다.
생성 후 Pages 기본 주소는 보통 아래처럼 잡힙니다.
- `https://jamissue-web.pages.dev`

하지만 운영값은 `pages.dev` 가 아니라 최종 커스텀 도메인 기준으로 넣습니다.

## 프론트 공개 변수
- `PUBLIC_APP_BASE_URL=https://api.jamissue.growgardens.app`
- `PUBLIC_NAVER_MAP_CLIENT_ID=YOUR_NAVER_MAP_CLIENT_ID`

## Worker 변수
- `APP_FRONTEND_URL=https://jamissue.growgardens.app`
- `APP_CORS_ORIGINS=https://jamissue.growgardens.app`
- `APP_NAVER_LOGIN_CALLBACK_URL=https://api.jamissue.growgardens.app/api/auth/naver/callback`

## Worker Secret
- `APP_SESSION_SECRET`
- `APP_JWT_SECRET`
- `APP_DATABASE_URL`
- `APP_SUPABASE_SERVICE_ROLE_KEY`
- `APP_NAVER_LOGIN_CLIENT_ID`
- `APP_NAVER_LOGIN_CLIENT_SECRET`

## GitHub Actions 값
Secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Variables:
- `CLOUDFLARE_PAGES_PROJECT_NAME=jamissue-web`
- `PUBLIC_APP_BASE_URL=https://api.jamissue.growgardens.app`
- `PUBLIC_NAVER_MAP_CLIENT_ID=YOUR_NAVER_MAP_CLIENT_ID`