# JamIssue 배포 런북

기준 브랜치: `main`

이 문서는 팀 저장소를 Cloudflare Pages + Cloudflare Workers + Supabase 조합으로 운영할 때 필요한 설정과 점검 순서를 정리합니다.

## 1. 현재 운영 구조

```text
GitHub main
-> GitHub Actions
-> Cloudflare Pages (daejeon-jamissue-pages)
-> Cloudflare Worker (daejeon-jamissue-api)
-> Supabase
```

운영 기준:
- 프런트: `https://daejeon.jamissue.com`
- API: `https://api.daegeon.jamissue.com`
- 운영 반영 브랜치: `main`

## 2. GitHub Actions 워크플로

### `ci.yml`

- 프런트 `npm ci`, `npm run typecheck`, `npm run build`
- 백엔드 `pytest`

### `cloudflare-pages.yml`

- Pages 프로젝트명: `daejeon-jamissue-pages`
- PR에서는 preview 배포
- `main` push에서는 production 배포

### `cloudflare-worker.yml`

- Worker 프로젝트명: `daejeon-jamissue-api`
- PR에서는 `wrangler deploy --dry-run`
- `main` push에서는 production 배포

### `public-event-sync.yml`

- 매주 월요일 03:00 KST 실행
- 대전시 공식 행사 상세검색 페이지를 수집
- Worker 내부 import 엔드포인트로 DB upsert 요청

## 3. 설정값 위치

### GitHub Repository Secrets

위치:
`GitHub > Repository > Settings > Secrets and variables > Actions > Repository secrets`

```env
CLOUDFLARE_API_TOKEN=<Cloudflare API token>
CLOUDFLARE_ACCOUNT_ID=<Cloudflare account id>
EVENT_IMPORT_TOKEN=<random long token>
```

### GitHub Repository Variables

위치:
`GitHub > Repository > Settings > Secrets and variables > Actions > Repository variables`

```env
PUBLIC_APP_BASE_URL=https://api.daegeon.jamissue.com
PUBLIC_NAVER_MAP_CLIENT_ID=<NAVER_MAP_CLIENT_ID>
```

### Cloudflare Worker Variables

위치:
`Cloudflare Dashboard > Workers & Pages > daejeon-jamissue-api > Settings > Variables and Secrets > Variables`

```env
APP_ENV=worker-first
APP_SESSION_HTTPS=true
APP_FRONTEND_URL=https://daejeon.jamissue.com
APP_CORS_ORIGINS=https://daejeon.jamissue.com
APP_NAVER_LOGIN_CLIENT_ID=<NAVER_LOGIN_CLIENT_ID>
APP_NAVER_LOGIN_CALLBACK_URL=https://api.daegeon.jamissue.com/api/auth/naver/callback
APP_STORAGE_BACKEND=supabase
APP_SUPABASE_URL=https://<project-ref>.supabase.co
APP_SUPABASE_STORAGE_BUCKET=review-images
APP_STAMP_UNLOCK_RADIUS_METERS=120
```

### Cloudflare Worker Secrets

위치:
`Cloudflare Dashboard > Workers & Pages > daejeon-jamissue-api > Settings > Variables and Secrets > Secrets`

```env
APP_SESSION_SECRET=<random 64+ chars>
APP_JWT_SECRET=<random 64+ chars>
APP_DATABASE_URL=postgres://postgres.<project-ref>:<DB_PASSWORD>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
APP_SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
APP_NAVER_LOGIN_CLIENT_SECRET=<NAVER_LOGIN_CLIENT_SECRET>
APP_EVENT_IMPORT_TOKEN=<same value as GitHub EVENT_IMPORT_TOKEN>
```

### Cloudflare Pages Custom Domain

위치:
`Cloudflare Dashboard > Workers & Pages > daejeon-jamissue-pages > Custom domains`

확인값:
- production domain: `daejeon.jamissue.com`
- preview domain: `*.pages.dev`

### 네이버 개발자센터

입력값:

```text
서비스 URL
https://daejeon.jamissue.com

Callback URL
https://api.daegeon.jamissue.com/api/auth/naver/callback
```

## 4. 행사 동기화 운영 원칙

- Worker는 요청 시점에 원본 사이트를 직접 fetch 하지 않습니다.
- 수집은 GitHub Actions가 담당합니다.
- 수집 결과는 `public_event`에 upsert 됩니다.
- 프런트와 API는 DB를 기준으로 앞으로 30일 이내 행사만 보여줍니다.

관련 엔드포인트:
- `GET /api/festivals`
- `GET /api/banner/events`
- `POST /api/internal/public-events/import`

## 5. 초기 작업 순서

1. Supabase SQL을 적용합니다.
2. Worker `daejeon-jamissue-api`에 variables/secrets를 입력합니다.
3. GitHub secrets/variables를 입력합니다.
4. Pages 프로젝트 `daejeon-jamissue-pages`를 생성하고 custom domain을 연결합니다.
5. 네이버 개발자센터 서비스 URL / callback URL을 운영 값으로 맞춥니다.
6. `main` 기준 GitHub Actions 결과를 확인합니다.

## 6. 수동 확인 명령

프런트 검증:

```powershell
cd D:\JamIssue
npm.cmd install
npm.cmd run typecheck
npm.cmd run build
```

행사 수집 dry-run:

```powershell
cd D:\JamIssue
node scripts/sync-daejeon-events.mjs --dry-run
```

백엔드 검증:

```powershell
cd D:\JamIssue\backend
python -m pytest tests
```

## 7. 장애 점검 포인트

### 행사 API가 0건일 때

확인 순서:
1. `public-event-sync` 워크플로 마지막 실행이 성공했는지 확인
2. GitHub secret `EVENT_IMPORT_TOKEN`이 있는지 확인
3. Worker secret `APP_EVENT_IMPORT_TOKEN`이 같은 값인지 확인
4. `public_data_source.last_imported_at`가 갱신됐는지 확인

### 네이버 로그인이 비활성화될 때

확인 순서:
1. Worker variable `APP_NAVER_LOGIN_CLIENT_ID`
2. Worker secret `APP_NAVER_LOGIN_CLIENT_SECRET`
3. Worker variable `APP_NAVER_LOGIN_CALLBACK_URL`
4. 네이버 개발자센터 서비스 URL / callback URL
