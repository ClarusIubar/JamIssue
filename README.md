# JamIssue

JamIssue는 20~30대 여성을 핵심 타깃으로 하는 대전 관광 모바일 웹앱 MVP입니다.
대전을 "빵처럼 고르고, 잼처럼 기억하는" 경험으로 풀어내는 것을 목표로 하며, 텍스트를 과하게 읽게 하기보다 지도와 카드 중심으로 빠르게 고르게 만드는 방향을 따릅니다.

현재 저장소 기준 구조는 아래 두 축으로 나뉩니다.

- 로컬 개발: `React + TypeScript 정적 프론트 + nginx + FastAPI + portable MySQL`
- 배포 준비: `Cloudflare Pages(프론트) + Cloudflare Worker(API 진입점) + Supabase(Postgres/Storage)`

## 핵심 목표

- 대전 관광 정보를 한 곳에서 빠르게 고를 수 있게 한다.
- 20~30대 여성 취향의 아기자기한 탐색 경험을 만든다.
- 스탬프, 후기, 사용자 경로를 통해 사용자 생태계를 만든다.
- 운영자가 임의로 짠 코스뿐 아니라 실제 방문 기반 경로가 추천 레이어가 되게 한다.

## 현재 구현 범위

- 대전 장소 탐색과 카테고리 필터
- 네이버 지도 연동 구조
- 네이버 로그인 연동
- 장소 후기 / 댓글 / 이미지 업로드
- 현장 반경 기반 스탬프 적립
- 사용자 생성 경로와 좋아요
- 마이페이지와 관리자 요약 패널
- 로컬 nginx + FastAPI + MySQL 스택
- GitHub Actions CI

## 계정 기준

- 서비스 내부 고유 계정은 `user.user_id`
- 네이버/카카오 외부 식별자는 `user_identity(provider, provider_user_id)`
- 같은 이메일이어도 자동으로 계정을 합치지 않습니다.
- 이미 로그인한 사용자가 명시적으로 연결할 때만 같은 내부 `user_id`에 묶습니다.

## 현재 기준 문서

- PRD 비교 체크: [docs/prd-compliance.md](D:/Code305/JamIssue/docs/prd-compliance.md)
- 화면설계서: [docs/screen-spec.md](D:/Code305/JamIssue/docs/screen-spec.md)
- 다음 작업 보고서: [docs/next-work-report.md](D:/Code305/JamIssue/docs/next-work-report.md)
- 계정/삭제 규칙: [docs/account-identity-schema.md](D:/Code305/JamIssue/docs/account-identity-schema.md)
- 커뮤니티 경로 설계: [docs/community-routes.md](D:/Code305/JamIssue/docs/community-routes.md)
- 백엔드 실행 문서: [backend/README.md](D:/Code305/JamIssue/backend/README.md)
- MySQL 스키마: [backend/sql/schema.sql](D:/Code305/JamIssue/backend/sql/schema.sql)
- Supabase 스키마: [backend/sql/supabase_schema.sql](D:/Code305/JamIssue/backend/sql/supabase_schema.sql)

## 로컬 실행 주소

- 앱: `http://localhost:8000`
- API: `http://localhost:8000/api`
- 헬스체크: `http://localhost:8000/api/health`

## 로컬 실행

처음 한 번:

```powershell
cd D:/Code305/JamIssue
npm.cmd install
powershell -ExecutionPolicy Bypass -File D:/Code305/JamIssue/scripts/install-local-nginx.ps1
powershell -ExecutionPolicy Bypass -File D:/Code305/JamIssue/scripts/install-local-mysql.ps1
```

평소 실행:

```powershell
powershell -ExecutionPolicy Bypass -File D:/Code305/JamIssue/scripts/dev.ps1 start
powershell -ExecutionPolicy Bypass -File D:/Code305/JamIssue/scripts/dev.ps1 status
powershell -ExecutionPolicy Bypass -File D:/Code305/JamIssue/scripts/dev.ps1 logs
powershell -ExecutionPolicy Bypass -File D:/Code305/JamIssue/scripts/dev.ps1 stop
```

프론트 정적 번들 생성:

```powershell
npm.cmd run build
```

## 환경 변수

프론트 [`.env`](D:/Code305/JamIssue/.env):

```bash
PUBLIC_APP_BASE_URL=http://localhost:8000
PUBLIC_NAVER_MAP_CLIENT_ID=YOUR_NAVER_MAP_CLIENT_ID
```

백엔드 [backend/.env](D:/Code305/JamIssue/backend/.env):

```bash
APP_ENV=development
APP_HOST=127.0.0.1
APP_PORT=8001
APP_CORS_ORIGINS=http://localhost:8000,http://127.0.0.1:8000
APP_FRONTEND_URL=http://localhost:8000
APP_SESSION_SECRET=CHANGE_ME_LOCAL_SESSION_SECRET
APP_SESSION_HTTPS=false
APP_DATABASE_URL=mysql+pymysql://jamissue:jamissue@127.0.0.1:3306/jamissue?charset=utf8mb4
APP_NAVER_LOGIN_CLIENT_ID=YOUR_NAVER_LOGIN_CLIENT_ID
APP_NAVER_LOGIN_CLIENT_SECRET=YOUR_NAVER_LOGIN_CLIENT_SECRET
APP_NAVER_LOGIN_CALLBACK_URL=http://localhost:8000/api/auth/naver/callback
APP_ADMIN_USER_IDS=
```

## 현재 배포 상태

이미 준비된 것:

- 프론트 정적 빌드
- Cloudflare Pages 배포 설정 파일
- Cloudflare Worker API 진입점/셸
- Supabase용 스키마/시드/스토리지 SQL
- 배포용 시크릿/변수 문서

아직 사람이 직접 넣어야 하는 것:

- Supabase SQL 적용
- Cloudflare Pages 공개 변수 입력
- Cloudflare Worker secrets / variables 입력
- 네이버 개발자센터 서비스 URL / Callback URL 등록

즉, **Cloudflare에 키만 넣는다고 끝나는 상태는 아닙니다.**
최소한 아래 4가지는 같이 해야 실제 동작이 납니다.

1. Supabase에 스키마와 스토리지를 만든다.
2. Worker에 서버 비밀값과 DB/Storage 연결값을 넣는다.
3. Pages에 프론트 공개값을 넣는다.
4. 네이버 개발자센터에 실제 서비스 도메인과 콜백 도메인을 등록한다.

현재 기준 문서:

- 배포 시크릿 체크리스트: [docs/deploy-secrets-checklist.md](D:/Code305/JamIssue/docs/deploy-secrets-checklist.md)
- 배포 시크릿 상세 설명: [docs/deploy-secrets-detailed.md](D:/Code305/JamIssue/docs/deploy-secrets-detailed.md)
- GrowGardens 배포 런북: [docs/growgardens-deploy-runbook.md](D:/Code305/JamIssue/docs/growgardens-deploy-runbook.md)
- Cloudflare Pages 설정: [docs/cloudflare-pages-setup.md](D:/Code305/JamIssue/docs/cloudflare-pages-setup.md)

## Supabase 적용 순서

Supabase SQL Editor에는 아래 순서로 넣으면 됩니다.

1. [backend/sql/supabase_schema.sql](D:/Code305/JamIssue/backend/sql/supabase_schema.sql)
2. [backend/sql/supabase_seed.sql](D:/Code305/JamIssue/backend/sql/supabase_seed.sql)
3. [backend/sql/supabase_storage.sql](D:/Code305/JamIssue/backend/sql/supabase_storage.sql)

주의:

- `supabase_schema.sql` 기준으로 `user.email`은 unique가 아닙니다.
- 같은 이메일이라고 자동 병합하지 않는 계정 구조를 전제로 합니다.
- 소셜 계정 연결은 명시적 연결 흐름으로만 처리합니다.

## Cloudflare 입력값 요약

프론트 Pages 공개값:

```bash
PUBLIC_APP_BASE_URL=https://api.jamissue.growgardens.app
PUBLIC_NAVER_MAP_CLIENT_ID=YOUR_NAVER_MAP_CLIENT_ID
```

Worker Variables:

```bash
APP_FRONTEND_URL=https://jamissue.growgardens.app
APP_CORS_ORIGINS=https://jamissue.growgardens.app
APP_NAVER_LOGIN_CALLBACK_URL=https://api.jamissue.growgardens.app/api/auth/naver/callback
APP_STORAGE_BACKEND=supabase
APP_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
APP_SUPABASE_STORAGE_BUCKET=review-images
APP_STAMP_UNLOCK_RADIUS_METERS=120
```

Worker Secrets:

```bash
APP_SESSION_SECRET=...
APP_JWT_SECRET=...
APP_DATABASE_URL=postgres://...pooler.supabase.com:6543/postgres
APP_SUPABASE_SERVICE_ROLE_KEY=...
APP_NAVER_LOGIN_CLIENT_ID=...
APP_NAVER_LOGIN_CLIENT_SECRET=...
```

네이버 개발자센터:

- 서비스 URL: `https://jamissue.growgardens.app`
- Callback URL: `https://api.jamissue.growgardens.app/api/auth/naver/callback`

## 네이버 Maps API 선택

현재 PRD와 구현 기준으로는 `Dynamic Map`만 먼저 발급받으면 됩니다.

필수:
- `Dynamic Map`

지금 단계에서는 불필요:
- `Static Map`
- `Directions 5`
- `Directions 15`
- `Geocoding`
- `Reverse Geocoding`

지도 키와 로그인 키는 서로 다른 목적입니다.
- 지도 키: `PUBLIC_NAVER_MAP_CLIENT_ID`
- 로그인 키: `APP_NAVER_LOGIN_CLIENT_ID`, `APP_NAVER_LOGIN_CLIENT_SECRET`

## 지도 키 운영 원칙

- 로컬 개발용 키와 운영용 키는 분리합니다.
- `localhost` / `127.0.0.1` 등록 키는 비밀값처럼 취급하지 않습니다.
- 운영 키는 실제 서비스 도메인만 등록한 별도 앱으로 발급합니다.
- 개발용 키에는 사용량 제한과 알림을 함께 거는 편이 안전합니다.

## 주요 API

- `GET /api/health`
- `GET /api/auth/me`
- `GET /api/auth/providers`
- `GET /api/auth/naver/login`
- `GET /api/auth/naver/link`
- `GET /api/auth/naver/callback`
- `POST /api/auth/logout`
- `GET /api/bootstrap`
- `GET /api/places`
- `GET /api/places/{place_id}`
- `GET /api/courses`
- `GET /api/community-routes`
- `POST /api/community-routes`
- `POST /api/community-routes/{route_id}/like`
- `DELETE /api/community-routes/{route_id}`
- `GET /api/reviews`
- `POST /api/reviews`
- `DELETE /api/reviews/{review_id}`
- `GET /api/reviews/{review_id}/comments`
- `POST /api/reviews/{review_id}/comments`
- `DELETE /api/reviews/{review_id}/comments/{comment_id}`
- `POST /api/reviews/upload`
- `GET /api/my/summary`
- `DELETE /api/my/account`
- `GET /api/stamps`
- `POST /api/stamps/toggle`
- `GET /api/admin/summary`
- `PATCH /api/admin/places/{place_id}`
- `POST /api/admin/import/public-data`

## 현재 남은 본작업

- UI/UX 1차 정리 마무리
- 후기 작성 권한과 스탬프 정책 연결
- 공공데이터 정식 연동
- 모바일 QA 체계화
- 배포/관측성 정리

세부 우선순위는 [docs/next-work-report.md](D:/Code305/JamIssue/docs/next-work-report.md)에 정리되어 있습니다.
