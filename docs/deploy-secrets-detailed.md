# 배포 시크릿 상세 가이드

이 문서는 `JamIssue` 배포 시 어떤 값을 어디에 넣는지 설명합니다.

## 이번 프로젝트에서 고정할 도메인
- 프론트: `https://jamissue.growgardens.app`
- API: `https://api.jamissue.growgardens.app`
- 네이버 로그인 callback: `https://api.jamissue.growgardens.app/api/auth/naver/callback`

## 가장 많이 헷갈리는 세 값
- `PUBLIC_APP_BASE_URL` = 프론트가 호출할 백엔드 API 주소
- `APP_FRONTEND_URL` = 사용자가 보는 프론트 주소
- `APP_NAVER_LOGIN_CALLBACK_URL` = 네이버가 호출할 백엔드 OAuth callback 주소

즉 지금 값은 이렇게 갑니다.
- `PUBLIC_APP_BASE_URL=https://api.jamissue.growgardens.app`
- `APP_FRONTEND_URL=https://jamissue.growgardens.app`
- `APP_CORS_ORIGINS=https://jamissue.growgardens.app`
- `APP_NAVER_LOGIN_CALLBACK_URL=https://api.jamissue.growgardens.app/api/auth/naver/callback`

## Cloudflare Worker Secret
- `APP_SESSION_SECRET`
- `APP_JWT_SECRET`
- `APP_DATABASE_URL`
- `APP_SUPABASE_SERVICE_ROLE_KEY`
- `APP_NAVER_LOGIN_CLIENT_ID`
- `APP_NAVER_LOGIN_CLIENT_SECRET`

이 값들은 토큰 서명, DB 접속, Storage 업로드, OAuth 토큰 교환에 쓰이므로 secret 입니다.

## Cloudflare Worker Variable
- `APP_FRONTEND_URL=https://jamissue.growgardens.app`
- `APP_CORS_ORIGINS=https://jamissue.growgardens.app`
- `APP_NAVER_LOGIN_CALLBACK_URL=https://api.jamissue.growgardens.app/api/auth/naver/callback`
- `APP_STORAGE_BACKEND=supabase`
- `APP_SUPABASE_URL=https://your-project-ref.supabase.co`
- `APP_SUPABASE_STORAGE_BUCKET=review-images`
- `APP_STAMP_UNLOCK_RADIUS_METERS=120`

이 값들은 공개되어도 바로 침해로 이어지지 않는 운영 설정값입니다.

## 프론트 공개 변수
- `PUBLIC_APP_BASE_URL=https://api.jamissue.growgardens.app`
- `PUBLIC_NAVER_MAP_CLIENT_ID=YOUR_NAVER_MAP_CLIENT_ID`

`PUBLIC_APP_BASE_URL` 은 이름은 애매하지만 현재 코드에서는 API base URL 로 사용합니다.
프론트 도메인을 넣는 값이 아닙니다.

## 네이버 개발자센터에 등록할 값
서비스 URL:
- `https://jamissue.growgardens.app`

Callback URL:
- `https://api.jamissue.growgardens.app/api/auth/naver/callback`

지도 키는 네이버 Maps 앱의 Dynamic Map 키를 사용하고,
로그인 키는 네이버 로그인 앱의 Client ID / Secret 을 사용합니다. 서로 다를 수 있습니다.