# 배포 변경 문서 (2026-03-16)

## 변경 배경

기존 배포 사고방식은 아래 구조였습니다.

```text
nginx
-> FastAPI app server
-> MySQL
```

하지만 실제 배포 요구사항은 다음과 같습니다.

- Cloudflare 도메인을 쓴다.
- GitHub secrets / Cloudflare secrets로 키를 관리한다.
- Supabase를 DB와 스토리지로 활용한다.
- 가능하면 배포 경험은 단순해야 한다.
- 팀 공통 구현 기준인 FastAPI는 유지한다.

따라서 배포 구조도 아래처럼 바뀝니다.

```text
Cloudflare Pages or Static Assets
-> Cloudflare Worker (FastAPI ASGI runtime)
-> Supabase Postgres / Supabase Storage
```

## 배포 대상 정리

### 프론트
- 배포 대상: Cloudflare Pages 또는 Workers Static Assets
- 역할: 정적 프론트 서빙
- 비밀값: 지도 공개 키, 공개 API base URL

### 백엔드
- 배포 대상: Cloudflare Python Worker
- 역할: FastAPI 앱 실행
- 비밀값: 세션 시크릿, JWT 시크릿, Supabase URL, OAuth 시크릿

### DB / Storage
- Supabase Postgres
- Supabase Storage

## 시크릿 기준

### Cloudflare Worker secrets
- `APP_SESSION_SECRET`
- `APP_JWT_SECRET`
- `APP_NAVER_LOGIN_CLIENT_ID`
- `APP_NAVER_LOGIN_CLIENT_SECRET`
- `APP_GOOGLE_LOGIN_CLIENT_ID`
- `APP_GOOGLE_LOGIN_CLIENT_SECRET`
- `APP_KAKAO_LOGIN_CLIENT_ID`
- `APP_KAKAO_LOGIN_CLIENT_SECRET`
- `APP_APPLE_LOGIN_CLIENT_ID`
- `APP_APPLE_LOGIN_CLIENT_SECRET`
- `APP_SUPABASE_URL`
- `APP_SUPABASE_ANON_KEY`
- `APP_SUPABASE_SERVICE_ROLE_KEY`

### 공개 변수
- `PUBLIC_APP_BASE_URL`
- `PUBLIC_NAVER_MAP_CLIENT_ID`

## 현재 배포 원칙

1. 프론트와 백엔드는 독립적으로 배포 가능해야 한다.
2. Worker는 FastAPI 앱을 감싸는 얇은 진입 레이어여야 한다.
3. 런타임 전용 코드가 도메인 로직을 잠식하면 안 된다.
4. DB/스토리지 접근은 로컬 파일 시스템 가정에서 벗어나야 한다.

## 단계별 배포 전략

### Phase 1. Worker 파일럿
- FastAPI를 Cloudflare Python Worker에서 띄워본다.
- 최소 엔드포인트를 먼저 확인한다.
- 프론트는 현재 정적 빌드를 유지한다.

### Phase 2. Supabase 정렬
- 업로드는 `storage_backend` 어댑터를 통해 Local / Supabase Storage 전환이 가능하다.
- DB 접근은 아직 SQLAlchemy 중심이므로, Supabase/Postgres 어댑터 정리가 후속 작업이다.

### Phase 3. 서비스 분리 준비
- 경계를 유지한 채 Worker 1개로 운영한다.
- 이후 필요 시 Service bindings로 기능을 분리한다.

## 이번 커밋에서 추가하는 파일

- `backend/worker_entry.py`
- `backend/pyproject.toml`
- `backend/wrangler.toml`
- `.github/workflows/worker-pilot.yml`

이 파일들은 FastAPI on Workers 파일럿을 위한 최소 뼈대입니다.

## 이번 단계에서 아직 미완인 점

- 현재 FastAPI 코드는 로컬 파일 시스템과 SQLAlchemy 중심 가정이 남아 있습니다.
- 따라서 Worker 배포가 바로 전체 API를 100% 대체하는 상태는 아닙니다.
- 이번 작업은 문서와 실행 진입점, 배포 틀을 먼저 맞추는 단계입니다.

## 다음 작업 우선순위

1. `APP_STORAGE_BACKEND=supabase` 기준 업로드를 실제 Cloudflare/Supabase 환경에서 검증
2. DB 접근을 Supabase/Postgres 어댑터로 분리
3. Worker에서 실제 보장할 엔드포인트 범위를 넓히기
4. 배포 워크플로에서 secrets 주입 확정

## 참고 문서

- 아키텍처 변경 문서: [docs/architecture-change-2026-03-16.md](/D:/Code305/JamIssue/docs/architecture-change-2026-03-16.md)
- Cloudflare FastAPI: https://developers.cloudflare.com/workers/languages/python/packages/fastapi/
- Cloudflare Static Assets: https://developers.cloudflare.com/workers/static-assets/
- Cloudflare Service bindings: https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/
- Cloudflare Workers + Supabase: https://developers.cloudflare.com/workers/databases/third-party-integrations/supabase/
