# JamIssue growgardens 배포 런북

이 문서는 `codex/worker-first-poc` 브랜치 기준입니다.

현재 배포 구조:

```text
Frontend
-> Cloudflare Pages (jamissue-web)

API
-> Cloudflare Worker (jamissue-api)
-> Supabase REST

Optional fallback
-> FastAPI origin
```

## 현재 완료 상태

- 프론트 Pages 프로젝트: `jamissue-web`
- 프론트 커스텀 도메인: `https://jamissue.growgardens.app`
- API Worker 이름: `jamissue-api`
- API 커스텀 도메인: `https://api.jamissue.growgardens.app`
- Worker 직접 처리 범위:
  - health
  - auth providers / me / logout
  - naver login / callback
  - bootstrap
  - reviews 조회
  - community routes 조회
  - my routes / my summary
  - banner events

## 아직 남아 있는 작업

- Worker에 직접 없는 쓰기 API를 계속 둘지 결정
- 계속 둘 거면 `APP_ORIGIN_API_URL` 에 FastAPI origin 주소 입력
- 카카오 로그인 실제 구현

즉 지금 상태는 “읽기 + 네이버 로그인 중심 Worker POC”입니다.

## 1. Supabase SQL 적용

Supabase Dashboard -> SQL Editor -> New query 에서 아래 파일을 순서대로 실행합니다.

1. `backend/sql/supabase_schema.sql`
2. `backend/sql/supabase_seed.sql`
3. `backend/sql/supabase_storage.sql`

목적:

- 앱 핵심 테이블 생성
- 장소 / 코스 / 후기 / 댓글 / 스탬프 / 사용자 경로 데이터 준비
- `review-images` 버킷 준비

## 2. Cloudflare Pages 공개값

위치:

- `Workers & Pages -> jamissue-web -> Settings -> Environment variables`

입력값:

```env
PUBLIC_APP_BASE_URL=https://api.jamissue.growgardens.app
PUBLIC_NAVER_MAP_CLIENT_ID=<네이버 지도 Dynamic Map Client ID>
```

설명:

- `PUBLIC_APP_BASE_URL`
  - 프론트가 API를 호출할 주소
- `PUBLIC_NAVER_MAP_CLIENT_ID`
  - 네이버 지도 Dynamic Map 키

## 3. Cloudflare Worker Variables

위치:

- `Workers & Pages -> jamissue-api -> Settings -> Variables and Secrets -> Variables`

입력값:

```env
APP_ENV=worker-first
APP_SESSION_HTTPS=true
APP_FRONTEND_URL=https://jamissue.growgardens.app
APP_CORS_ORIGINS=https://jamissue.growgardens.app
APP_NAVER_LOGIN_CALLBACK_URL=https://api.jamissue.growgardens.app/api/auth/naver/callback
APP_STORAGE_BACKEND=supabase
APP_SUPABASE_URL=https://ifofgcaqrgtiurzqhiyy.supabase.co
APP_SUPABASE_STORAGE_BUCKET=review-images
APP_STAMP_UNLOCK_RADIUS_METERS=120
APP_ORIGIN_API_URL=
```

설명:

- `APP_FRONTEND_URL`
  - 로그인 완료 후 사용자를 되돌릴 프론트 주소
- `APP_CORS_ORIGINS`
  - 브라우저에서 API 호출을 허용할 origin
- `APP_NAVER_LOGIN_CALLBACK_URL`
  - 네이버가 로그인 완료 후 호출할 callback 주소
- `APP_STORAGE_BACKEND`
  - 현재는 `supabase`
- `APP_SUPABASE_URL`
  - Supabase 프로젝트 URL
- `APP_SUPABASE_STORAGE_BUCKET`
  - 후기 이미지 버킷 이름
- `APP_STAMP_UNLOCK_RADIUS_METERS`
  - 현장 스탬프 반경
- `APP_ORIGIN_API_URL`
  - Worker에 아직 없는 쓰기 API를 FastAPI origin으로 넘기고 싶을 때만 사용
  - 비워 두면 직접 미구현 API는 `501`

## 4. Cloudflare Worker Secrets

위치:

- `Workers & Pages -> jamissue-api -> Settings -> Variables and Secrets -> Secrets`

입력값:

```env
APP_SESSION_SECRET=<랜덤 64자 이상>
APP_JWT_SECRET=<랜덤 64자 이상>
APP_DATABASE_URL=postgres://postgres.<project-ref>:<DB_PASSWORD>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
APP_SUPABASE_SERVICE_ROLE_KEY=<Supabase service_role key>
APP_NAVER_LOGIN_CLIENT_ID=<네이버 로그인 Client ID>
APP_NAVER_LOGIN_CLIENT_SECRET=<네이버 로그인 Client Secret>
```

설명:

- `APP_SESSION_SECRET`
  - Worker 세션 쿠키 서명용
- `APP_JWT_SECRET`
  - JWT 서명용
- `APP_DATABASE_URL`
  - Supabase Postgres transaction pooler 접속 문자열
- `APP_SUPABASE_SERVICE_ROLE_KEY`
  - Supabase REST / Storage 서버 권한 키
- `APP_NAVER_LOGIN_CLIENT_ID`
  - 네이버 로그인 앱 Client ID
- `APP_NAVER_LOGIN_CLIENT_SECRET`
  - 네이버 로그인 앱 Client Secret

## 5. 네이버 개발자센터 등록값

- 서비스 URL: `https://jamissue.growgardens.app`
- Callback URL: `https://api.jamissue.growgardens.app/api/auth/naver/callback`

## 6. 확인용 주소

- 프론트: `https://jamissue.growgardens.app`
- API: `https://api.jamissue.growgardens.app`
- workers.dev: `https://jamissue-api.yhh4433.workers.dev`

## 7. 현재 주의점

- 카카오는 현재 비활성
- Worker에 직접 없는 쓰기 API는 `APP_ORIGIN_API_URL` 없으면 `501`
- 이 브랜치는 메인 FastAPI 아키텍처를 대체하는 확정안이 아니라 배포 실험 브랜치
