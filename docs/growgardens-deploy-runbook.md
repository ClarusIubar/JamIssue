# JamIssue growgardens 배포 런북

## 현재 완료 상태
- 프론트 Pages 프로젝트: `jamissue-web`
- 프론트 최신 배포 미리보기: `https://dc50b514.jamissue-web.pages.dev`
- 프론트 커스텀 도메인: `https://jamissue.growgardens.app`
- API Worker 이름: `jamissue-api`
- API Worker workers.dev 주소: `https://jamissue-api.yhh4433.workers.dev`
- API 커스텀 도메인 라우트: `https://api.jamissue.growgardens.app`
- 프론트 빌드의 API base URL: `https://api.jamissue.growgardens.app`

## 지금 바로 해야 할 순서
1. Supabase SQL Editor에서 스키마를 생성한다.
2. 같은 SQL Editor에서 시드 데이터를 넣는다.
3. 같은 SQL Editor에서 Storage 버킷을 만든다.
4. Cloudflare Pages `jamissue-web`에 공개값을 넣는다.
5. Cloudflare Worker `jamissue-api`에 variables / secrets를 넣는다.
6. 네이버 개발자센터에 서비스 URL / callback URL을 등록한다.
7. API Worker를 실제 FastAPI Worker로 재배포한다.

## 1. Supabase SQL Editor에 넣을 쿼리
Supabase Dashboard -> SQL Editor -> New query 에서 아래 파일을 순서대로 실행한다.

### 1-1. 스키마 생성
파일: `backend/sql/supabase_schema.sql`
목적:
- 앱의 핵심 테이블 생성
- 장소, 코스, 후기, 댓글, 스탬프, 공공데이터 테이블 생성
- 인덱스 생성

### 1-2. 초기 데이터 입력
파일: `backend/sql/supabase_seed.sql`
목적:
- 장소 6개
- 코스 4개
- 후기 4개
- 기본 사용자와 스탬프 데이터
- 첫 연결 직후 앱이 비지 않게 하는 용도

### 1-3. Storage 버킷 생성
파일: `backend/sql/supabase_storage.sql`
목적:
- `review-images` 버킷 생성 또는 갱신
- 후기 이미지 업로드 버킷 준비

## 2. Cloudflare Pages에 넣을 공개값
위치:
- Cloudflare Dashboard
- `Workers & Pages` → `jamissue-web` → `Settings` → `Environment variables`

입력값:
- `PUBLIC_APP_BASE_URL=https://api.jamissue.growgardens.app`
- `PUBLIC_NAVER_MAP_CLIENT_ID=<네이버 지도 Dynamic Map Client ID>`

설명:
- `PUBLIC_APP_BASE_URL`은 프론트 주소가 아니라 API 주소다.
- `PUBLIC_NAVER_MAP_CLIENT_ID`는 네이버 로그인 키가 아니라 지도 키다.

## 3. Cloudflare Worker에 넣을 값
위치:
- Cloudflare Dashboard
- `Workers & Pages` → `jamissue-api` → `Settings` → `Variables and Secrets`

### 3-1. Variables
- `APP_ENV=worker`
- `APP_SESSION_HTTPS=true`
- `APP_FRONTEND_URL=https://jamissue.growgardens.app`
- `APP_CORS_ORIGINS=https://jamissue.growgardens.app`
- `APP_NAVER_LOGIN_CALLBACK_URL=https://api.jamissue.growgardens.app/api/auth/naver/callback`
- `APP_STORAGE_BACKEND=supabase`
- `APP_SUPABASE_URL=https://<project-ref>.supabase.co`
- `APP_SUPABASE_STORAGE_BUCKET=review-images`
- `APP_STAMP_UNLOCK_RADIUS_METERS=120`

### 3-2. Secrets
- `APP_SESSION_SECRET`
- `APP_JWT_SECRET`
- `APP_DATABASE_URL`
- `APP_SUPABASE_SERVICE_ROLE_KEY`
- `APP_NAVER_LOGIN_CLIENT_ID`
- `APP_NAVER_LOGIN_CLIENT_SECRET`

### 각 secret에 실제로 넣을 값
- `APP_SESSION_SECRET`
  - 세션 서명용 랜덤 문자열
- `APP_JWT_SECRET`
  - JWT 서명용 랜덤 문자열
- `APP_DATABASE_URL`
  - Supabase Postgres connection string
  - transaction pooler URL 권장
  - 예시 형식:
    - `postgres://postgres.<project-ref>:PASSWORD@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`
- `APP_SUPABASE_SERVICE_ROLE_KEY`
  - Supabase Dashboard -> Project Settings -> API -> `service_role`
- `APP_NAVER_LOGIN_CLIENT_ID`
  - 네이버 로그인 앱 Client ID
- `APP_NAVER_LOGIN_CLIENT_SECRET`
  - 네이버 로그인 앱 Client Secret

## 4. 네이버 개발자센터
서비스 URL:
- `https://jamissue.growgardens.app`

Callback URL:
- `https://api.jamissue.growgardens.app/api/auth/naver/callback`

## 5. 중요한 현재 제한
현재 API Worker 코드는 `backend/wrangler.toml`의 `worker_entry.py`를 기준으로 배포하도록 준비되어 있다.
다만 이 저장소 기준으로 `pywrangler deploy`를 바로 돌리면 Python Worker 빌드 단계에서 추가 정리가 한 번 더 필요하다.

즉 지금 상태는:
- SQL 입력은 끝낼 수 있다.
- Pages / Worker 값도 입력할 수 있다.
- 하지만 API를 실제로 살리려면 Worker 재배포 단계가 아직 1회 남아 있다.

## 6. 확인용 주소
- 프론트: `https://jamissue.growgardens.app`
- Pages 미리보기: `https://dc50b514.jamissue-web.pages.dev`
- API Worker: `https://jamissue-api.yhh4433.workers.dev`
- API 커스텀 도메인: `https://api.jamissue.growgardens.app`

참고:
- 커스텀 API 도메인은 인증서 전파 중이면 잠깐 SSL 오류가 날 수 있다.
- 그 경우 workers.dev 주소로 먼저 동작 확인이 가능하다.
