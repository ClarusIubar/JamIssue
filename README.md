# JamIssue

JamIssue는 대전 장소를 지도에서 탐색하고, 스탬프를 찍은 뒤 피드와 코스로 이어지는 흐름을 제공하는 앱입니다.

현재 운영 기준 구조는 다음과 같습니다.
- 프론트: Cloudflare Pages `jamissue-web`
- API: Cloudflare Worker `jamissue-api`
- 데이터/스토리지: Supabase
- 기준 브랜치: `codex/production-deploy`

## 핵심 사용자 흐름

### 1. 지도에서 장소 탐색
- 하단 탭 `지도 / 행사 / 피드 / 코스 / 마이`
- 지도 탭에서 장소 마커와 축제 마커를 탐색
- 장소를 누르면 바텀시트가 열리고 상세 정보, 방문 상태, 현장 스탬프 액션을 확인
- 축제는 정보 레이어이며 스탬프/피드/코스와 분리

### 2. 스탬프 획득
- 스탬프는 `user_stamp` 로그 구조로 저장
- 같은 장소도 날짜가 다르면 다시 적립 가능
- 같은 날짜에는 같은 장소를 중복 적립하지 않음
- 각 로그는 `visit_ordinal`을 가져서 `n번째 방문` 표기가 가능
- 스탬프 간격이 24시간 이내면 같은 `travel_session`으로 묶음

### 3. 피드 작성
- 피드는 방문 증명 후에만 작성 가능
- 단순 GPS 반경 진입만으로는 작성 불가
- 후기 작성은 반드시 `stamp_id`가 필요
- API에서도 `stamp_id` 소유 여부와 장소 일치를 검증
- 피드에는 좋아요, 댓글, 답글(깊이 제한 `부모 0 / 자식 1`)이 연결됨

### 4. 코스 발행
- 운영자 큐레이션 코스와 사용자 코스가 함께 존재
- 사용자 코스는 스탬프/여행 세션 기반으로 생성
- 24시간 기준 `travel_session` 흐름을 따라 코스를 묶을 수 있음
- 코스 정렬은 `popular / latest`
- 코스도 좋아요 가능

### 5. 마이페이지
- 탭 구성
  - 얻은 스탬프
  - 내가 쓴 피드
  - 내가 쓴 댓글
  - 생성한 코스
- 프로필 상단에 통계 표시
  - 고유 장소 방문 수
  - 누적 스탬프 수
- 설정에서 닉네임 수정 가능

### 6. 관리자 흐름
- 관리자 계정은 마이페이지에 `관리` 탭이 노출됨
- 장소 노출/비노출 토글
- 공공데이터 다시 불러오기
- 관리자 여부는 Worker 환경변수 `APP_ADMIN_USER_IDS` 기준

## 탭별 데이터 로딩 원칙

JamIssue는 전체 화면 데이터를 한 번에 모두 읽지 않고, 탭 책임에 맞게 나눠서 읽습니다.

- 지도
  - `GET /api/map-bootstrap`
  - 지도 장소, 스탬프 상태, 로그인 세션의 최소 데이터만 로드
- 피드
  - `GET /api/review-feed`
  - 첫 페이지 로드 후 추가 페이지는 점진 로드
- 코스
  - `GET /api/courses/curated`
  - `GET /api/community-routes`
- 마이
  - `GET /api/my/summary`
  - `GET /api/my/comments`
  - 댓글 목록은 summary에 전부 싣지 않고 별도 페이지네이션

## 현재 구현 기능 상세

### 지도 / 장소 / 축제
- 장소 마커, 축제 마커, 카테고리 필터
- 장소 바텀시트 `closed / partial / full`
- 장소 상세에서 방문 회차, 태그, 설명, 스탬프 액션 확인
- 행사 탭에서 축제 목록/상세를 별도 탐색
- 축제는 공공데이터 API 기반으로 동기화
- 축제는 대전 범위 / 진행 중 및 예정 행사 중심 정보 제공

### 스탬프
- `UNIQUE(user_id, position_id, stamp_date)` 구조
- 반복 방문 수는 `visit_ordinal`
- 여행 세션은 `travel_session`
- 스탬프는 피드와 코스의 선행 조건

### 피드
- 스탬프를 찍은 뒤에만 작성 가능
- 이미지 업로드 지원
- 좋아요 / 댓글 / 답글 지원
- 댓글 시트에서 특정 댓글 하이라이트 및 이동 지원
- 마이페이지의 `내가 쓴 댓글`에서 해당 댓글 위치로 점프 가능

### 코스
- 운영자 큐레이션 코스
- 사용자 생성 코스
- 좋아요순 / 최신순 정렬
- 좋아요 지원

### 마이페이지
- 스탬프, 피드, 댓글, 코스 탭
- 프로필 설정 진입
- 닉네임 수정
- 닉네임 유니크 정책 적용
- 관리자 계정이면 `관리` 탭 노출

### 인증
- 내부 사용자 식별: `user`
- 제공자 식별: `user_identity`
- 네이버 로그인 구현
- 카카오는 정책상 자리만 있고 실제 연결은 미구현

## Worker에서 직접 처리하는 API

### 인증 / 프로필
- `GET /api/health`
- `GET /api/auth/providers`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `PATCH /api/auth/profile`
- `GET /api/auth/naver/login`
- `GET /api/auth/naver/callback`

### 지도 / 장소 / 피드 / 코스
- `GET /api/bootstrap`
- `GET /api/map-bootstrap`
- `GET /api/review-feed`
- `GET /api/reviews`
- `POST /api/reviews/upload`
- `POST /api/reviews`
- `GET /api/reviews/:reviewId/comments`
- `POST /api/reviews/:reviewId/comments`
- `POST /api/reviews/:reviewId/like`
- `POST /api/stamps/toggle`
- `GET /api/courses/curated`
- `GET /api/community-routes`
- `POST /api/community-routes`
- `POST /api/community-routes/:routeId/like`

### 마이 / 부가 데이터
- `GET /api/my/routes`
- `GET /api/my/summary`
- `GET /api/my/comments`
- `GET /api/banner/events`
- `GET /api/festivals`

### 관리자
- `GET /api/admin/summary`
- `PATCH /api/admin/places/:id`
- `POST /api/admin/import/public-data`

## 데이터 구조 기준

### 스탬프
- `user_stamp`는 로그성 테이블
- 반복 방문 허용
- 동일 날짜 중복 적립 차단
- 방문 증명 후기 = `feed.stamp_id`

### 코스
- `travel_session`이 24시간 기준 세션을 관리
- 사용자 코스는 세션과 연결 가능
- 운영자 코스와 사용자 코스를 구분

### 댓글
- 깊이 제한 `부모 0 / 자식 1`
- soft delete 유지
- 피드 삭제 시 댓글 연쇄 정리

### 장소 이미지
- `map.image_url` 사용
- `map.image_storage_path`로 스토리지 원본 경로를 함께 관리
- live DB가 과거 상태여도 worker는 null 허용으로 처리

## 비기능 요구사항 대응 현황

### 레이턴시
- 탭별 API 분리로 초기 eager load 축소
- 피드/내 댓글 페이지네이션 적용
- 공용 GET 요청은 캐시 및 중복 요청 방지 흐름 유지

### 렌더링 안정성
- 프론트 자산은 해시 파일명으로 배포되어 브라우저 캐시 오염을 줄임
- 비지도 탭의 백그라운드 로더 실패가 전역 배너로 새지 않도록 분리

### 상호작용
- 지도 바텀시트, 댓글 시트, 마이페이지 deep link는 브라우저 뒤로가기와 앱 내부 복귀 흐름을 함께 고려
- 댓글 깊이는 `부모 0 / 자식 1`로 제한

## Supabase SQL 적용 순서

### 기본 스키마 / 스토리지

신규 프로젝트 기준 SQL 실행 순서는 아래와 같습니다.

1. [supabase_schema.sql](/D:/Code305/JamIssue/backend/sql/supabase_schema.sql)
2. [supabase_storage.sql](/D:/Code305/JamIssue/backend/sql/supabase_storage.sql)
3. [20260319_map_image_and_unique_nickname.sql](/D:/Code305/JamIssue/backend/sql/migrations/20260319_map_image_and_unique_nickname.sql)
4. [20260323_add_map_image_storage_path.sql](/D:/Code305/JamIssue/backend/sql/migrations/20260323_add_map_image_storage_path.sql)

### 샘플 장소 데이터로 완전 초기화하는 현재 기준 절차

샘플 디렉터리와 이미지 매핑을 기준으로 장소/이미지 정본을 다시 넣으려면 아래 순서로 진행합니다.

1. [20260323_reset_all_app_data.sql](/D:/Code305/JamIssue/backend/sql/migrations/20260323_reset_all_app_data.sql)
2. [20260323_add_place_images_bucket.sql](/D:/Code305/JamIssue/backend/sql/migrations/20260323_add_place_images_bucket.sql)
3. [20260323_seed_sample_places.sql](/D:/Code305/JamIssue/backend/sql/migrations/20260323_seed_sample_places.sql)

위 절차는 기존 스탬프/피드/댓글/코스/사용자까지 전부 비우고 다시 넣는 흐름입니다.
개별 좌표 보정이 이미 반영된 최신 정본은 `20260323_seed_sample_places.sql`입니다.

### 레거시 테스트 시드

초기 대전 테스트 시드는 아직 저장소에 남아 있지만, 현재 샘플 정본 재구성 흐름의 기본 절차는 아닙니다.

1. [20260318_seed_daejeon_places_50.sql](/D:/Code305/JamIssue/backend/sql/migrations/20260318_seed_daejeon_places_50.sql)
2. [20260318_seed_daejeon_activity.sql](/D:/Code305/JamIssue/backend/sql/migrations/20260318_seed_daejeon_activity.sql)
3. [20260318_normalize_place_categories.sql](/D:/Code305/JamIssue/backend/sql/migrations/20260318_normalize_place_categories.sql)

## 샘플 장소 이미지 업로드

샘플 데이터와 이미지 파일은 `sample/` 디렉터리를 기준으로 관리합니다.

`sample/`은 로컬 전용 입력 데이터이며 Git 추적 대상이 아닙니다.
PR에는 생성된 migration / script / 코드 변경만 포함하고, 실제 샘플 원본 파일은 각자 로컬에 보관합니다.

정본 JSON 생성:

```powershell
cd D:/Code305/JamIssue
node scripts/generate-sample-place-data.mjs
```

스토리지 업로드 및 `map.image_url` / `image_storage_path` 반영:

```powershell
cd D:/Code305/JamIssue
$env:APP_SUPABASE_SERVICE_ROLE_KEY='<SUPABASE_SERVICE_ROLE_KEY>'
node scripts/upload-sample-place-images.mjs
```

업로드 결과:
- 버킷: `place-images`
- 경로 형식: `places/001/hero.png`
- DB 반영 컬럼: `map.image_url`, `map.image_storage_path`

## Cloudflare Pages 환경변수

프로젝트: `jamissue-web`

```env
PUBLIC_APP_BASE_URL=https://api.jamissue.growgardens.app
PUBLIC_NAVER_MAP_CLIENT_ID=<NAVER_DYNAMIC_MAP_CLIENT_ID>
```

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
APP_PUBLIC_EVENT_SOURCE_URL=https://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api
APP_ORIGIN_API_URL=
```

## Cloudflare Worker Secrets

```env
APP_SESSION_SECRET=<랜덤 64자 이상 문자열>
APP_JWT_SECRET=<랜덤 64자 이상 문자열>
APP_DATABASE_URL=postgres://postgres.<project-ref>:<DB_PASSWORD>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
APP_SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
APP_NAVER_LOGIN_CLIENT_ID=<NAVER_LOGIN_CLIENT_ID>
APP_NAVER_LOGIN_CLIENT_SECRET=<NAVER_LOGIN_CLIENT_SECRET>
APP_PUBLIC_EVENT_SERVICE_KEY=<DATA_GO_KR_SERVICE_KEY>
```

## 네이버 개발자센터 설정

- 서비스 URL: `https://jamissue.growgardens.app`
- Callback URL: `https://api.jamissue.growgardens.app/api/auth/naver/callback`

## 검증 명령

```powershell
cd D:/Code305/JamIssue
npm.cmd run typecheck
npm.cmd run build
```

```powershell
cd D:/Code305/JamIssue/backend
.\.venv\Scripts\python.exe -m pytest tests
```

## 기준 문서

- [docs/README.md](/D:/Code305/JamIssue/docs/README.md)
- [docs/prd-compliance.md](/D:/Code305/JamIssue/docs/prd-compliance.md)
- [docs/screen-spec.md](/D:/Code305/JamIssue/docs/screen-spec.md)
- [docs/community-routes.md](/D:/Code305/JamIssue/docs/community-routes.md)
- [docs/account-identity-schema.md](/D:/Code305/JamIssue/docs/account-identity-schema.md)
- [docs/growgardens-deploy-runbook.md](/D:/Code305/JamIssue/docs/growgardens-deploy-runbook.md)
- [docs/data-operations-runbook.md](/D:/Code305/JamIssue/docs/data-operations-runbook.md)
