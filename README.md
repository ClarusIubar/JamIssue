# JamIssue

대전 관광 모바일 웹앱입니다. 이 브랜치는 `worker-first` 배포 실험 브랜치이고, 로컬 백엔드 레퍼런스로는 `FastAPI + SQLAlchemy` 구조를 계속 유지합니다.

## 현재 기준

- 현재 브랜치: `codex/worker-first-poc`
- 프론트 도메인: `https://jamissue.growgardens.app`
- API 도메인: `https://api.jamissue.growgardens.app`
- 현재 배포 축: `Cloudflare Pages + Cloudflare Worker + Supabase`
- 로컬/레퍼런스 축: `FastAPI + SQLAlchemy + Supabase`

즉, 배포는 Worker 기준으로 보고 있고, 팀 아키텍처 레퍼런스는 FastAPI 코드로 유지하는 상태입니다.

## 핵심 기능

- 지도 중심 탐색
- 방문 스탬프 적립
- 방문 증명 기반 후기 작성
- 댓글 / 후기 좋아요
- 사용자 생성 추천 경로
- 네이버 로그인
- 마이페이지 통계

## 데이터 정규화 기준

### 1. 스탬프는 로그다

`user_stamp` 는 단순한 방문 여부 테이블이 아니라 방문 로그입니다.

- 같은 장소라도 날짜가 다르면 다시 적립 가능
- 같은 날짜에는 한 장소당 한 번만 적립
- `visit_ordinal` 로 `2번째 방문` 같은 표시 가능

### 2. 연속 방문은 세션으로 묶는다

`travel_session` 은 스탬프 로그를 묶는 여행 단위입니다.

- 직전 스탬프와 24시간 이내면 같은 세션
- 24시간 초과면 새 세션

### 3. 후기 작성은 방문 증명이 필요하다

`feed` 는 반드시 `stamp_id` 를 가집니다.

- 단순 GPS 진입만으로 후기 작성 불가
- 실제로 적립한 스탬프가 있어야 후기 작성 가능
- 후기 카드에 n번째 방문 문구를 표시할 수 있음

### 4. 추천 경로는 사용자 생태계를 우선한다

`user_route` 는 개발자 큐레이션 코스와 사용자 생성 경로를 같이 담되, `is_user_generated` 로 구분합니다.

프로젝트 원칙:

`사용자가 실제 방문한 스탬프 기반 동선을 공개 경로로 발행하고, 다른 사용자는 좋아요순/최신순으로 그 경로를 탐색할 수 있어야 한다.`

적용 규칙:

- 실제로 스탬프를 찍은 장소만 경로에 포함 가능
- 최소 2곳 이상이어야 경로 발행 가능
- 정렬은 `좋아요순(popular)` / `최신순(latest)`
- 운영자 코스는 초기 큐레이션 용도

### 5. 계정과 로그인 제공자는 분리한다

- 내부 계정 식별자: `user.user_id`
- 외부 로그인 식별자: `user_identity`
- 같은 이메일 자동 병합 없음
- 닉네임 중복 허용

## 현재 배포 구조

```text
Frontend
-> Cloudflare Pages

API
-> Cloudflare Worker
-> Supabase REST / Storage

Reference Backend
-> FastAPI
-> SQLAlchemy
-> Supabase
```

## 현재 Worker가 직접 처리하는 API

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

## Cloudflare Pages 값

프로젝트: `jamissue-web`

```env
PUBLIC_APP_BASE_URL=https://api.jamissue.growgardens.app
PUBLIC_NAVER_MAP_CLIENT_ID=<네이버 지도 Dynamic Map Client ID>
```

설명:

- `PUBLIC_APP_BASE_URL`
  - 프론트가 호출할 API 주소
- `PUBLIC_NAVER_MAP_CLIENT_ID`
  - 네이버 지도용 키
  - 로그인 키와 다름

## Cloudflare Worker Variables

프로젝트: `jamissue-api`

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

- `APP_FRONTEND_URL`: 로그인 완료 후 되돌릴 프론트 주소
- `APP_CORS_ORIGINS`: 브라우저에서 허용할 origin
- `APP_NAVER_LOGIN_CALLBACK_URL`: 네이버 로그인 callback 주소
- `APP_STORAGE_BACKEND`: 현재는 `supabase`
- `APP_SUPABASE_URL`: Supabase 프로젝트 URL
- `APP_SUPABASE_STORAGE_BUCKET`: 후기 이미지 버킷
- `APP_STAMP_UNLOCK_RADIUS_METERS`: 반경 제한
- `APP_ORIGIN_API_URL`: Worker가 아직 직접 처리하지 않는 API를 FastAPI origin에 넘길 때만 사용

## Cloudflare Worker Secrets

프로젝트: `jamissue-api`

```env
APP_SESSION_SECRET=<랜덤 64자 이상>
APP_JWT_SECRET=<랜덤 64자 이상>
APP_DATABASE_URL=postgres://postgres.<project-ref>:<DB_PASSWORD>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
APP_SUPABASE_SERVICE_ROLE_KEY=<Supabase service_role key>
APP_NAVER_LOGIN_CLIENT_ID=<네이버 로그인 Client ID>
APP_NAVER_LOGIN_CLIENT_SECRET=<네이버 로그인 Client Secret>
```

설명:

- `APP_SESSION_SECRET`: 세션 쿠키 서명용
- `APP_JWT_SECRET`: JWT 서명용
- `APP_DATABASE_URL`: Supabase Postgres transaction pooler 주소
- `APP_SUPABASE_SERVICE_ROLE_KEY`: 서버 권한용 Supabase 키
- `APP_NAVER_LOGIN_CLIENT_ID`: 네이버 로그인 키
- `APP_NAVER_LOGIN_CLIENT_SECRET`: 네이버 로그인 시크릿

## Supabase 적용 순서

SQL Editor에서 아래 순서로 실행합니다.

1. [backend/sql/supabase_schema.sql](/D:/Code305/JamIssue/backend/sql/supabase_schema.sql)
2. [backend/sql/supabase_seed.sql](/D:/Code305/JamIssue/backend/sql/supabase_seed.sql)
3. [backend/sql/supabase_storage.sql](/D:/Code305/JamIssue/backend/sql/supabase_storage.sql)

추가 마이그레이션이 필요하면:

4. [backend/sql/migrations/20260318_stamp_session_refactor.sql](/D:/Code305/JamIssue/backend/sql/migrations/20260318_stamp_session_refactor.sql)

## 네이버 개발자센터 값

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

## 문서

- [docs/README.md](/D:/Code305/JamIssue/docs/README.md)
- [docs/prd-compliance.md](/D:/Code305/JamIssue/docs/prd-compliance.md)
- [docs/community-routes.md](/D:/Code305/JamIssue/docs/community-routes.md)
- [docs/account-identity-schema.md](/D:/Code305/JamIssue/docs/account-identity-schema.md)
- [docs/worker-first-poc.md](/D:/Code305/JamIssue/docs/worker-first-poc.md)
- [docs/growgardens-deploy-runbook.md](/D:/Code305/JamIssue/docs/growgardens-deploy-runbook.md)