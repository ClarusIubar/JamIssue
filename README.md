# JamIssue

대전 관광 모바일 웹앱 MVP입니다.

현재 저장소에는 두 축이 함께 들어 있습니다.

- 팀 기준 메인 아키텍처: `FastAPI + SQLAlchemy + Supabase`
- 배포 실험 브랜치: `codex/worker-first-poc`

즉, 이 브랜치는 메인 아키텍처를 버린 상태가 아니라 Cloudflare Worker에서 어디까지 가능한지 따로 검증하는 POC입니다.

## 지금 가장 먼저 알아야 할 점

- 현재 브랜치: `codex/worker-first-poc`
- 프론트 도메인: `https://jamissue.growgardens.app`
- API 도메인: `https://api.jamissue.growgardens.app`
- 현재 배포 축: `Cloudflare Pages + Cloudflare Worker + Supabase`

반면 저장소 안의 `backend/app` FastAPI 코드는 여전히 팀 기준 메인 백엔드 레퍼런스로 유지되고 있습니다.

## 기능 요약

- 지도 기반 장소 탐색
- 후기 / 댓글 / 좋아요
- 스탬프 적립
- 사용자 생성 추천 경로
- 네이버 로그인 중심 계정 구조
- 내부 계정 `user_id` 와 외부 로그인 `user_identity` 분리

## 현재 브랜치의 아키텍처

### 팀 기준 메인 아키텍처

```text
Frontend
-> Cloudflare Pages

API
-> FastAPI
-> SQLAlchemy

Data
-> Supabase Postgres
-> Supabase Storage
```

### 이 브랜치의 배포 실험 아키텍처

```text
Frontend
-> Cloudflare Pages

API
-> Cloudflare Worker
-> Supabase REST

Fallback
-> FastAPI origin (선택 사항)
```

중요한 구분:

- `Supabase`는 DB와 스토리지 서버입니다.
- `SQLAlchemy`는 별도 서버가 아니라 FastAPI 내부 ORM입니다.
- 이 브랜치의 Worker는 일부 API를 직접 처리하고, 나머지는 필요하면 `APP_ORIGIN_API_URL` 로 FastAPI origin에 프록시합니다.

## 현재 Worker가 직접 처리하는 API

현재 `deploy/api-worker-shell/index.js` 기준으로 Worker가 직접 처리하는 엔드포인트는 아래입니다.

- `GET /api/health`
- `GET /api/auth/providers`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/auth/naver/login`
- `GET /api/auth/naver/callback`
- `GET /api/bootstrap`
- `GET /api/reviews`
- `POST /api/reviews/upload`
- `POST /api/reviews`
- `GET /api/reviews/:reviewId/comments`
- `POST /api/reviews/:reviewId/comments`
- `POST /api/reviews/:reviewId/like`
- `POST /api/stamps/toggle`
- `GET /api/community-routes`
- `POST /api/community-routes`
- `POST /api/community-routes/:routeId/like`
- `GET /api/my/routes`
- `GET /api/my/summary`
- `GET /api/banner/events`

이 범위는 현재 `Pages + Worker + Supabase` 만으로 직접 확인 가능합니다.

추가 규칙:

- 후기 작성과 스탬프 적립은 모두 `APP_STAMP_UNLOCK_RADIUS_METERS` 반경 안에서만 허용됩니다.
- 후기 작성 요청은 현재 좌표(`latitude`, `longitude`)가 함께 와야 합니다.
- 추천 경로 작성은 실제로 적립한 스탬프 장소만 허용됩니다.

## 현재 Worker에서 아직 직접 처리하지 않는 API

아래 기능은 아직 Worker 직접 구현이 아니라 추후 origin 또는 별도 구현이 필요합니다.

- 카카오 OAuth 실제 로그인 흐름
- 관리자 수정 작업
- 그 외 메인 FastAPI 브랜치에만 있는 관리/운영 API

즉, 현재 브랜치는 “읽기 전용 POC”를 넘어서 사용자 쓰기 흐름 일부까지 직접 처리하는 Worker 실험 브랜치입니다.

## 현재 계정 구조

현재 기준의 핵심 규칙은 이렇습니다.

- 서비스 내부 고유 계정 ID는 `user.user_id`
- 네이버/카카오 같은 외부 로그인 식별자는 `user_identity`
- 같은 이메일이라고 자동 병합하지 않음
- 명시적 계정 연결일 때만 하나의 내부 `user_id`에 묶음

이 구조 덕분에 네이버에서 카카오로 로그인 수단을 바꿔도 내부 사용자 기록은 유지할 수 있습니다.

## Cloudflare Pages에 넣는 값

프로젝트: `jamissue-web`  
위치: `Workers & Pages -> jamissue-web -> Settings -> Environment variables`

```env
PUBLIC_APP_BASE_URL=https://api.jamissue.growgardens.app
PUBLIC_NAVER_MAP_CLIENT_ID=<네이버 지도 Dynamic Map Client ID>
```

각 값의 의미:

- `PUBLIC_APP_BASE_URL`
  - 프론트 코드가 API를 호출할 기준 주소입니다.
  - 이름은 `PUBLIC_APP_BASE_URL` 이지만 현재 코드에서는 “프론트 주소”가 아니라 “API 주소”로 사용합니다.
- `PUBLIC_NAVER_MAP_CLIENT_ID`
  - 네이버 지도 Dynamic Map용 키입니다.
  - 네이버 로그인 키와 다릅니다.

## Cloudflare Worker Variables

프로젝트: `jamissue-api`  
위치: `Workers & Pages -> jamissue-api -> Settings -> Variables and Secrets -> Variables`

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

각 값의 의미:

- `APP_FRONTEND_URL`
  - 로그인 완료 후 사용자를 다시 돌려보낼 프론트 주소
- `APP_CORS_ORIGINS`
  - 브라우저에서 API 호출을 허용할 origin
- `APP_NAVER_LOGIN_CALLBACK_URL`
  - 네이버가 로그인 완료 후 호출할 백엔드 callback 주소
- `APP_STORAGE_BACKEND`
  - 현재는 `supabase`
- `APP_SUPABASE_URL`
  - Supabase 프로젝트 기본 URL
- `APP_SUPABASE_STORAGE_BUCKET`
  - 후기 이미지를 넣을 버킷 이름
- `APP_STAMP_UNLOCK_RADIUS_METERS`
  - 스탬프 활성 반경
- `APP_ORIGIN_API_URL`
  - Worker에 아직 없는 쓰기 API를 FastAPI origin으로 넘길 때만 사용
  - 비어 있으면 직접 미구현 API는 `501`

## Cloudflare Worker Secrets

프로젝트: `jamissue-api`  
위치: `Workers & Pages -> jamissue-api -> Settings -> Variables and Secrets -> Secrets`

```env
APP_SESSION_SECRET=<랜덤 64자 이상>
APP_JWT_SECRET=<랜덤 64자 이상>
APP_DATABASE_URL=postgres://postgres.<project-ref>:<DB_PASSWORD>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
APP_SUPABASE_SERVICE_ROLE_KEY=<Supabase service_role key>
APP_NAVER_LOGIN_CLIENT_ID=<네이버 로그인 Client ID>
APP_NAVER_LOGIN_CLIENT_SECRET=<네이버 로그인 Client Secret>
```

각 값의 의미:

- `APP_SESSION_SECRET`
  - Worker 세션 쿠키 서명용 비밀값
- `APP_JWT_SECRET`
  - JWT 서명용 비밀값
- `APP_DATABASE_URL`
  - Supabase Postgres transaction pooler 접속 문자열
- `APP_SUPABASE_SERVICE_ROLE_KEY`
  - 서버 권한으로 Supabase REST / Storage에 접근할 때 쓰는 키
- `APP_NAVER_LOGIN_CLIENT_ID`
  - 네이버 로그인 앱의 Client ID
- `APP_NAVER_LOGIN_CLIENT_SECRET`
  - 네이버 로그인 앱의 Client Secret

## Supabase 적용 순서

Supabase SQL Editor에서 아래 순서로 실행합니다.

1. [supabase_schema.sql](/D:/Code305/JamIssue/backend/sql/supabase_schema.sql)
2. [supabase_seed.sql](/D:/Code305/JamIssue/backend/sql/supabase_seed.sql)
3. [supabase_storage.sql](/D:/Code305/JamIssue/backend/sql/supabase_storage.sql)

## 네이버 개발자센터 등록값

- 서비스 URL: `https://jamissue.growgardens.app`
- Callback URL: `https://api.jamissue.growgardens.app/api/auth/naver/callback`

## 로컬 점검 명령

프론트 타입체크:

```powershell
cd D:/Code305/JamIssue
npm.cmd run typecheck
```

프론트 빌드:

```powershell
cd D:/Code305/JamIssue
npm.cmd run build
```

백엔드 테스트:

```powershell
cd D:/Code305/JamIssue/backend
.\.venv\Scripts\python.exe -m pytest tests
```

현재 확인 상태:

- `npm.cmd run typecheck` 통과
- `npm.cmd run build` 통과
- `backend/.venv/Scripts/python.exe -m pytest tests` 통과 (`22 passed`)

## 현재 제한

- 카카오는 아직 Worker 브랜치에서 실제 OAuth 미구현
- 관리자 수정 작업과 카카오 OAuth는 아직 Worker 직접 구현 전
- `APP_ORIGIN_API_URL` 은 현재 관리자/미구현 API 보조용으로만 남아 있음
- 이 브랜치는 메인 `FastAPI` 아키텍처를 대체하는 확정안이 아니라 별도 배포 실험 브랜치

## 관련 문서

- [Worker-first POC 문서](/D:/Code305/JamIssue/docs/worker-first-poc.md)
- [growgardens 배포 런북](/D:/Code305/JamIssue/docs/growgardens-deploy-runbook.md)
- [계정/삭제 규칙](/D:/Code305/JamIssue/docs/account-identity-schema.md)

