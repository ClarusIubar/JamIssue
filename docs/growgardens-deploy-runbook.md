# JamIssue growgardens 운영 런북

기준 브랜치: `codex/production-deploy`

현재 운영 구조는 다음과 같습니다.

```text
Frontend
-> Cloudflare Pages (jamissue-web)

API
-> Cloudflare Worker (jamissue-api)
-> Supabase REST / Storage

Optional
-> FastAPI origin fallback
```

## 현재 Worker가 직접 처리하는 범위

- 인증 상태 조회 / 로그인 callback / 로그아웃
- 지도 부트스트랩 / 피드 조회 / 코스 조회 / 마이페이지 요약
- 후기 업로드 / 작성 / 댓글 / 좋아요
- 스탬프 토글
- 사용자 생성 코스 조회 / 작성 / 좋아요
- 축제 정보 동기화 / 조회
- 프로필 수정

## Worker가 직접 처리하지 않는 범위

- 카카오 OAuth 실제 연결
- 관리자 운영 API
- FastAPI origin fallback을 쓰는 별도 확장 기능

## 1. Supabase SQL 적용 순서

신규 프로젝트 기준:
1. [supabase_schema.sql](/D:/Code305/JamIssue/backend/sql/supabase_schema.sql)
2. [supabase_storage.sql](/D:/Code305/JamIssue/backend/sql/supabase_storage.sql)
3. [20260318_seed_daejeon_places_50.sql](/D:/Code305/JamIssue/backend/sql/migrations/20260318_seed_daejeon_places_50.sql)
4. [20260318_seed_daejeon_activity.sql](/D:/Code305/JamIssue/backend/sql/migrations/20260318_seed_daejeon_activity.sql)
5. [20260318_normalize_place_categories.sql](/D:/Code305/JamIssue/backend/sql/migrations/20260318_normalize_place_categories.sql)
6. [20260319_map_image_and_unique_nickname.sql](/D:/Code305/JamIssue/backend/sql/migrations/20260319_map_image_and_unique_nickname.sql)

## 2. Cloudflare Pages 환경변수

프로젝트: `jamissue-web`  
위치: `Workers & Pages -> jamissue-web -> Settings -> Environment variables`

```env
PUBLIC_APP_BASE_URL=https://api.jamissue.growgardens.app
PUBLIC_NAVER_MAP_CLIENT_ID=<NAVER_DYNAMIC_MAP_CLIENT_ID>
```

## 3. Cloudflare Worker Variables

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
APP_PUBLIC_EVENT_SOURCE_URL=https://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api
APP_ORIGIN_API_URL=
```

## 4. Cloudflare Worker Secrets

프로젝트: `jamissue-api`  
위치: `Workers & Pages -> jamissue-api -> Settings -> Variables and Secrets -> Secrets`

```env
APP_SESSION_SECRET=<랜덤 64자 이상 문자열>
APP_JWT_SECRET=<랜덤 64자 이상 문자열>
APP_DATABASE_URL=postgres://postgres.<project-ref>:<DB_PASSWORD>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
APP_SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
APP_NAVER_LOGIN_CLIENT_ID=<NAVER_LOGIN_CLIENT_ID>
APP_NAVER_LOGIN_CLIENT_SECRET=<NAVER_LOGIN_CLIENT_SECRET>
APP_PUBLIC_EVENT_SERVICE_KEY=<DATA_GO_KR_SERVICE_KEY>
```

## 5. 네이버 개발자센터 설정

- 서비스 URL: `https://jamissue.growgardens.app`
- Callback URL: `https://api.jamissue.growgardens.app/api/auth/naver/callback`

## 6. 운영 주소

- 프론트: `https://jamissue.growgardens.app`
- API: `https://api.jamissue.growgardens.app`
- Worker 원본 주소: `https://jamissue-api.yhh4433.workers.dev`

## 7. 운영 메모

- 축제 데이터는 공공데이터 API를 바탕으로 동기화됩니다.
- `APP_ORIGIN_API_URL`은 FastAPI origin fallback이 필요할 때만 사용합니다.
- live DB가 과거 상태여도 worker는 `map.image_url`을 null 허용으로 처리하도록 맞춰져 있습니다.
