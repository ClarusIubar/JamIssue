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
4. Cloudflare Worker `jamissue-api`에 secret을 넣는다.
5. secret 입력이 끝나면 API Worker를 실제 백엔드 구현으로 교체한다.

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

## 2. Cloudflare Worker에 넣을 secrets
작업 위치:
- `D:\Code305\JamIssue\deploy\api-worker-shell`

명령:
```powershell
cd D:\Code305\JamIssue\deploy\api-worker-shell
npx wrangler secret put APP_SESSION_SECRET
npx wrangler secret put APP_JWT_SECRET
npx wrangler secret put APP_DATABASE_URL
npx wrangler secret put APP_SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put APP_NAVER_LOGIN_CLIENT_ID
npx wrangler secret put APP_NAVER_LOGIN_CLIENT_SECRET
```

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

## 3. 이미 Worker에 들어가 있는 비민감 변수
아래 값은 현재 `deploy/api-worker-shell/wrangler.toml`에 이미 들어 있다.
- `APP_FRONTEND_URL=https://jamissue.growgardens.app`
- `APP_CORS_ORIGINS=https://jamissue.growgardens.app`
- `APP_NAVER_LOGIN_CALLBACK_URL=https://api.jamissue.growgardens.app/api/auth/naver/callback`
- `APP_STORAGE_BACKEND=supabase`
- `APP_SUPABASE_STORAGE_BUCKET=review-images`
- `APP_STAMP_UNLOCK_RADIUS_METERS=120`
- `APP_SESSION_HTTPS=true`
- `APP_ENV=worker`

## 4. 프론트 공개값
현재 프론트는 이미 다음 기준으로 다시 배포했다.
- `PUBLIC_APP_BASE_URL=https://api.jamissue.growgardens.app`
- `PUBLIC_NAVER_MAP_CLIENT_ID`는 로컬 `.env`의 지도 키를 사용해서 빌드됨

## 5. 중요한 현재 제한
현재 `api.jamissue.growgardens.app`에는 전체 FastAPI 앱이 아니라 "API Worker shell" 이 올라가 있다.
이렇게 한 이유는 Cloudflare 무료 플랜의 Worker 번들 크기 제한 3 MiB 때문에 현재 FastAPI 전체 번들이 배포되지 않기 때문이다.

즉 지금 상태는:
- 프론트 공개 도메인 준비 완료
- API 공개 도메인 준비 완료
- Supabase SQL 입력 준비 완료
- Worker secret 입력 준비 완료
- 실제 FastAPI 전체 이전은 다음 단계

## 6. 확인용 주소
- 프론트: `https://jamissue.growgardens.app`
- Pages 미리보기: `https://dc50b514.jamissue-web.pages.dev`
- API Worker: `https://jamissue-api.yhh4433.workers.dev`
- API 커스텀 도메인: `https://api.jamissue.growgardens.app`

참고:
- 커스텀 API 도메인은 인증서 전파 중이면 잠깐 SSL 오류가 날 수 있다.
- 그 경우 workers.dev 주소로 먼저 동작 확인이 가능하다.
