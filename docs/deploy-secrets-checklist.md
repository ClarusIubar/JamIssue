# 배포 시크릿 체크리스트

상세 설명이 필요하면 [docs/deploy-secrets-detailed.md](/D:/Code305/JamIssue/docs/deploy-secrets-detailed.md) 를 함께 보세요.

가장 중요한 구분:
- `PUBLIC_APP_BASE_URL=https://api.jamissue.growgardens.app`
- `APP_FRONTEND_URL=https://jamissue.growgardens.app`
- `APP_NAVER_LOGIN_CALLBACK_URL=https://api.jamissue.growgardens.app/api/auth/naver/callback`

## Cloudflare Worker Secret
- `APP_SESSION_SECRET`
- `APP_JWT_SECRET`
- `APP_DATABASE_URL`
- `APP_SUPABASE_SERVICE_ROLE_KEY`
- `APP_NAVER_LOGIN_CLIENT_ID`
- `APP_NAVER_LOGIN_CLIENT_SECRET`

## Cloudflare Worker Variable
- `APP_FRONTEND_URL=https://jamissue.growgardens.app`
- `APP_CORS_ORIGINS=https://jamissue.growgardens.app`
- `APP_NAVER_LOGIN_CALLBACK_URL=https://api.jamissue.growgardens.app/api/auth/naver/callback`
- `APP_STORAGE_BACKEND=supabase`
- `APP_SUPABASE_URL=https://your-project-ref.supabase.co`
- `APP_SUPABASE_STORAGE_BUCKET=review-images`
- `APP_STAMP_UNLOCK_RADIUS_METERS=120`

## 프론트 공개 변수
- `PUBLIC_APP_BASE_URL=https://api.jamissue.growgardens.app`
- `PUBLIC_NAVER_MAP_CLIENT_ID=YOUR_NAVER_MAP_CLIENT_ID`

## GitHub Actions
Secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Variables:
- `CLOUDFLARE_PAGES_PROJECT_NAME=jamissue-web`
- `PUBLIC_APP_BASE_URL=https://api.jamissue.growgardens.app`
- `PUBLIC_NAVER_MAP_CLIENT_ID=YOUR_NAVER_MAP_CLIENT_ID`