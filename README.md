# JamIssue

JamIssue는 대전 장소 탐색, 스탬프, 피드, 코스를 연결하는 웹 앱입니다.

## 배포 기준

- 배포 브랜치: `main`
- Pages 프로젝트: `daejeon-jamissue`
- Worker 프로젝트: `daejeon-jamissue-api`
- 데이터/스토리지: Supabase

`main`에 머지되면 GitHub Actions가 production 배포를 수행합니다. `main`으로 향하는 PR은 검증과 preview 확인용입니다.

## 배포 방법

### PR to `main`

- [`ci.yml`](/D:/JamIssue/.github/workflows/ci.yml)
  - 프런트 `npm ci`, `npm run typecheck`, `npm run build`
  - 백엔드 `pytest`
- [`cloudflare-pages.yml`](/D:/JamIssue/.github/workflows/cloudflare-pages.yml)
  - 정적 프런트 빌드
  - `daejeon-jamissue`에 preview 배포
- [`cloudflare-worker.yml`](/D:/JamIssue/.github/workflows/cloudflare-worker.yml)
  - Worker 번들 `wrangler deploy --dry-run` 검증

### Push to `main`

- [`ci.yml`](/D:/JamIssue/.github/workflows/ci.yml)
  - 프런트/백엔드 검증
- [`cloudflare-pages.yml`](/D:/JamIssue/.github/workflows/cloudflare-pages.yml)
  - `daejeon-jamissue`가 없으면 생성
  - production branch를 `main`으로 맞춤
  - production 정적 배포 수행
- [`cloudflare-worker.yml`](/D:/JamIssue/.github/workflows/cloudflare-worker.yml)
  - `daejeon-jamissue-api`를 production으로 배포

즉, 운영 반영 기준은 항상 `main`입니다. 예전 `codex/production-deploy` 기준 문서는 더 이상 배포 기준이 아닙니다.

## 어디에 어떤 키를 넣는가

### 1. GitHub Repository Secrets

위치:
`GitHub > Repository > Settings > Secrets and variables > Actions > Repository secrets`

입력할 키:

```env
CLOUDFLARE_API_TOKEN=<Cloudflare API token>
CLOUDFLARE_ACCOUNT_ID=<Cloudflare account id>
```

용도:
- GitHub Actions에서 Pages/Worker 배포

### 2. GitHub Repository Variables

위치:
`GitHub > Repository > Settings > Secrets and variables > Actions > Repository variables`

입력할 키:

```env
PUBLIC_APP_BASE_URL=https://api.daegeon.jamissue.com
PUBLIC_NAVER_MAP_CLIENT_ID=<NAVER_DYNAMIC_MAP_CLIENT_ID>
```

용도:
- Pages 빌드 시 프런트 공개 설정 주입

### 3. Cloudflare Worker Variables

위치:
`Cloudflare Dashboard > Workers & Pages > daejeon-jamissue-api > Settings > Variables and Secrets > Variables`

입력할 키:

```env
APP_ENV=worker-first
APP_SESSION_HTTPS=true
APP_FRONTEND_URL=https://daejeon.jamissue.com
APP_CORS_ORIGINS=https://daejeon.jamissue.com
APP_NAVER_LOGIN_CALLBACK_URL=https://api.daegeon.jamissue.com/api/auth/naver/callback
APP_STORAGE_BACKEND=supabase
APP_SUPABASE_URL=https://<project-ref>.supabase.co
APP_SUPABASE_STORAGE_BUCKET=review-images
APP_STAMP_UNLOCK_RADIUS_METERS=120
APP_PUBLIC_EVENT_SOURCE_URL=https://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api
APP_ORIGIN_API_URL=
```

### 4. Cloudflare Worker Secrets

위치:
`Cloudflare Dashboard > Workers & Pages > daejeon-jamissue-api > Settings > Variables and Secrets > Secrets`

입력할 키:

```env
APP_SESSION_SECRET=<random 64+ chars>
APP_JWT_SECRET=<random 64+ chars>
APP_DATABASE_URL=postgres://postgres.<project-ref>:<DB_PASSWORD>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
APP_SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
APP_NAVER_LOGIN_CLIENT_ID=<NAVER_LOGIN_CLIENT_ID>
APP_NAVER_LOGIN_CLIENT_SECRET=<NAVER_LOGIN_CLIENT_SECRET>
APP_PUBLIC_EVENT_SERVICE_KEY=<DATA_GO_KR_SERVICE_KEY>
```

### 5. Cloudflare Pages 도메인

위치:
`Cloudflare Dashboard > Workers & Pages > daejeon-jamissue > Custom domains`

확인할 값:
- 프런트 도메인

그리고 이 값과 아래 값은 서로 맞아야 합니다.
- GitHub Variable `PUBLIC_APP_BASE_URL`
- Worker Variable `APP_FRONTEND_URL`
- Worker Variable `APP_CORS_ORIGINS`
- Worker Variable `APP_NAVER_LOGIN_CALLBACK_URL`

### 6. 네이버 개발자센터

위치:
`네이버 개발자센터 > 애플리케이션 설정`

맞춰야 할 값:
- 서비스 URL = `https://daejeon.jamissue.com`
- Callback URL = `https://api.daegeon.jamissue.com/api/auth/naver/callback`

## 처음 셋업 순서

1. Cloudflare에서 Worker 변수/시크릿을 먼저 입력합니다.
2. GitHub에서 repository secrets/variables를 입력합니다.
3. 필요하면 [`scripts/create-cloudflare-pages-project.ps1`](/D:/JamIssue/scripts/create-cloudflare-pages-project.ps1)로 Pages 프로젝트를 미리 생성합니다.
4. `main`에 머지하거나 push합니다.
5. GitHub Actions에서 `ci`, `cloudflare-pages`, `cloudflare-worker`가 통과하는지 확인합니다.

Pages 프로젝트를 미리 만들고 싶으면:

```powershell
cd D:\JamIssue
.\scripts\create-cloudflare-pages-project.ps1
```

수동으로 Pages 업로드를 확인하고 싶으면:

```powershell
cd D:\JamIssue
.\scripts\deploy-cloudflare-pages.ps1
```

## 로컬 검증

```powershell
cd D:\JamIssue
npm.cmd install
npm.cmd run typecheck
npm.cmd run build
```

```powershell
cd D:\JamIssue\backend
python -m pytest tests
```

## 참고 문서

- [docs/README.md](/D:/JamIssue/docs/README.md)
- [docs/growgardens-deploy-runbook.md](/D:/JamIssue/docs/growgardens-deploy-runbook.md)
- [backend/README.md](/D:/JamIssue/backend/README.md)
