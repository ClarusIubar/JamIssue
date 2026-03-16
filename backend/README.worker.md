# Cloudflare Worker pilot

이 디렉터리는 `FastAPI`를 Cloudflare Python Worker에서 먼저 실행해보기 위한 실제 배포 뼈대입니다.

## 핵심 파일
- `worker_entry.py`: Worker가 FastAPI 앱을 실행하는 진입점
- `wrangler.toml`: Worker 이름, 기본 vars, 정적 자산 연결 설정
- `.dev.vars.example`: 로컬 Worker 테스트용 환경변수 예시
- `scripts/print-worker-secret-commands.ps1`: `wrangler secret put` 명령 목록 출력

## 현재 권장 도메인 구조
- 프론트: `https://jamissue.growgardens.app`
- API: `https://api.jamissue.growgardens.app`
- 네이버 로그인 callback: `https://api.jamissue.growgardens.app/api/auth/naver/callback`

## 값의 의미
- `APP_FRONTEND_URL`: 사용자가 보는 프론트 주소
- `APP_CORS_ORIGINS`: 프론트에서 API 호출을 허용할 origin
- `APP_NAVER_LOGIN_CALLBACK_URL`: 네이버가 로그인 완료 후 호출하는 백엔드 OAuth callback 주소

## 값을 어디에 넣나
### 로컬 검증
1. `backend/.dev.vars.example` 를 `backend/.dev.vars` 로 복사
2. 실제 값 입력
3. `cd backend`
4. `uv run pywrangler dev`

### 배포 런타임
- 민감값: Cloudflare Dashboard -> Worker -> Settings -> Variables and Secrets -> Secrets
- 비민감값: Cloudflare Dashboard -> Worker -> Settings -> Variables and Secrets -> Variables

## Secret으로 넣을 값
- `APP_SESSION_SECRET`
- `APP_JWT_SECRET`
- `APP_DATABASE_URL`
- `APP_SUPABASE_SERVICE_ROLE_KEY`
- `APP_NAVER_LOGIN_CLIENT_ID`
- `APP_NAVER_LOGIN_CLIENT_SECRET`

## Variable로 넣을 값
- `APP_FRONTEND_URL=https://jamissue.growgardens.app`
- `APP_CORS_ORIGINS=https://jamissue.growgardens.app`
- `APP_NAVER_LOGIN_CALLBACK_URL=https://api.jamissue.growgardens.app/api/auth/naver/callback`
- `APP_STORAGE_BACKEND=supabase`
- `APP_SUPABASE_URL=https://your-project-ref.supabase.co`
- `APP_SUPABASE_STORAGE_BUCKET=review-images`
- `APP_STAMP_UNLOCK_RADIUS_METERS=120`