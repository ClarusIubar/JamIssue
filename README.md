# JamIssue

JamIssue는 대전 지역 방문 피드, 스탬프, 코스, 축제 정보를 한 앱 안에서 연결하는 모바일 웹 서비스입니다.

- 서비스 주소: [https://daejeon.jamissue.com](https://daejeon.jamissue.com)
- 프론트엔드: Cloudflare Pages
- API: Cloudflare Worker
- 데이터 저장소: Supabase

## 운영 구조

- 기본 배포 브랜치: `main`
- 프론트 도메인: `https://daejeon.jamissue.com`
- API 도메인: `https://api.daejeon.jamissue.com`
- Pages 프로젝트: `daejeon-jamissue-pages`
- Worker 프로젝트: `daejeon-jamissue-api`

JamIssue는 현재 `Pages + Worker + Supabase` 조합을 기준으로 운영합니다.

- Pages
  - 정적 프론트 번들 제공
  - 공개 런타임 설정 주입
- Worker
  - 공개 API 진입점
  - 인증, 리뷰/댓글, 스탬프, 코스, 축제, 알림, 마이페이지 처리
- Supabase
  - 운영 DB
  - 이미지 스토리지
  - 일부 실시간 보조 기능

## 배포 파이프라인

### PR

PR에서는 아래 검증이 먼저 실행됩니다.

- `backend`
- `frontend`
- `deploy-pages`
- `validate-worker`

### `main` push

`main`에 반영되면 아래 순서로 운영 배포와 검증이 이어집니다.

1. `deploy-pages`
2. `deploy-worker`
3. `smoke`
4. `protected-smoke`

현재 운영 smoke는 커스텀 도메인이 아니라 실제 배포 origin을 기준으로 확인합니다.

- Pages origin: `https://daejeon-jamissue-pages.pages.dev`
- Worker origin: `https://daejeon-jamissue-api.yhh4433.workers.dev`

## Smoke 체크

### Public smoke

공개 경로가 정상인지 확인합니다.

- `GET /`
- `GET /app-config.js`
- `GET /api/health`
- `GET /api/auth/providers`
- `GET /api/map-bootstrap`
- `GET /api/review-feed?limit=1`
- `GET /api/community-routes`
- `GET /api/festivals`
- `GET /api/my/summary` 비로그인 상태 응답

### Protected smoke

보호 경로는 `SMOKE_AUTH_BEARER_TOKEN`이 있을 때만 실행합니다.

- 토큰이 없으면 실패가 아니라 `skip` 처리
- 토큰이 있으면 인증이 필요한 운영 경로를 실제로 확인

로컬에서 실행할 수 있는 명령:

```powershell
npm.cmd run smoke:public
npm.cmd run smoke:protected
```

## 로컬 검증

프론트 검증:

```powershell
cd D:\JamIssue
npm.cmd install
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:all
```

백엔드 검증:

```powershell
cd D:\JamIssue\backend
python -m pytest tests
```

공공 행사 동기화 dry-run:

```powershell
cd D:\JamIssue
node scripts/sync-daejeon-events.mjs --dry-run
```

## 주요 환경 변수

### GitHub Repository Secrets

위치:
`GitHub > Repository > Settings > Secrets and variables > Actions > Repository secrets`

```env
CLOUDFLARE_API_TOKEN=<Cloudflare API token>
CLOUDFLARE_ACCOUNT_ID=<Cloudflare account id>
EVENT_IMPORT_TOKEN=<random long token>
PUBLIC_SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY>
SMOKE_AUTH_BEARER_TOKEN=<protected smoke token>
```

### GitHub Repository Variables

위치:
`GitHub > Repository > Settings > Secrets and variables > Actions > Repository variables`

```env
PUBLIC_APP_BASE_URL=https://api.daejeon.jamissue.com
PUBLIC_NAVER_MAP_CLIENT_ID=<NAVER_MAP_CLIENT_ID>
PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
```

### Cloudflare Worker Variables

```env
APP_ENV=worker-first
APP_SESSION_HTTPS=true
APP_FRONTEND_URL=https://daejeon.jamissue.com
APP_CORS_ORIGINS=https://daejeon.jamissue.com
APP_NAVER_LOGIN_CLIENT_ID=<NAVER_LOGIN_CLIENT_ID>
APP_NAVER_LOGIN_CALLBACK_URL=https://api.daejeon.jamissue.com/api/auth/naver/callback
APP_STORAGE_BACKEND=supabase
APP_SUPABASE_URL=https://<project-ref>.supabase.co
APP_SUPABASE_STORAGE_BUCKET=review-images
APP_STAMP_UNLOCK_RADIUS_METERS=120
```

### Cloudflare Worker Secrets

```env
APP_SESSION_SECRET=<random 64+ chars>
APP_JWT_SECRET=<random 64+ chars>
APP_DATABASE_URL=postgres://postgres.<project-ref>:<DB_PASSWORD>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
APP_SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
APP_NAVER_LOGIN_CLIENT_SECRET=<NAVER_LOGIN_CLIENT_SECRET>
APP_EVENT_IMPORT_TOKEN=<same value as GitHub EVENT_IMPORT_TOKEN>
```

## 참고 문서

- [문서 안내](/D:/JamIssue/docs/README.md)
- [배포 런북](/D:/JamIssue/docs/growgardens-deploy-runbook.md)
- [운영 리팩토링 로드맵](/D:/JamIssue/docs/operations-refactor-roadmap.md)
- [백엔드 README](/D:/JamIssue/backend/README.md)

## CI 메모

문서만 수정해서 Actions를 돌릴 필요가 없을 때는 커밋 메시지에 `[skip ci]`를 포함하면 됩니다.
