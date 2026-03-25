# JamIssue 팀 배포 런북

기준 브랜치: `main`

이 문서는 team 저장소를 Cloudflare Pages + Cloudflare Workers + Supabase 조합으로 운영할 때 따라가는 기준 절차입니다.

## 1. 현재 배포 구조

```text
GitHub main
-> GitHub Actions
-> Cloudflare Pages (daejeon-jamissue)
-> Cloudflare Worker (daejeon-jamissue-api)
-> Supabase
```

운영 반영 기준은 `main`입니다.
- PR to `main`: 검증 + Pages preview + Worker dry-run
- push to `main`: production 배포

## 2. GitHub Actions 워크플로

### `ci.yml`

- 프런트 `npm ci`, `npm run typecheck`, `npm run build`
- 백엔드 `pytest`

### `cloudflare-pages.yml`

- Pages 프로젝트명: `daejeon-jamissue`
- PR에서는 preview 배포
- `main` push에서는 production 배포
- project가 없으면 workflow가 API로 생성 시도

### `cloudflare-worker.yml`

- Worker 프로젝트명: `daejeon-jamissue-api`
- PR에서는 `wrangler deploy --dry-run`
- `main` push에서는 production deploy

## 3. 어디에 어떤 키를 넣는가

### GitHub Repository Secrets

위치:
`GitHub > Repository > Settings > Secrets and variables > Actions > Repository secrets`

```env
CLOUDFLARE_API_TOKEN=<Cloudflare API token>
CLOUDFLARE_ACCOUNT_ID=<Cloudflare account id>
```

용도:
- Pages 배포
- Worker 배포
- Pages 프로젝트 생성/production branch 설정

권장 메모:
- `CLOUDFLARE_API_TOKEN`은 Pages와 Workers를 배포할 수 있는 권한이 필요합니다.

### GitHub Repository Variables

위치:
`GitHub > Repository > Settings > Secrets and variables > Actions > Repository variables`

```env
PUBLIC_APP_BASE_URL=https://api.daegeon.jamissue.com
PUBLIC_NAVER_MAP_CLIENT_ID=<NAVER_DYNAMIC_MAP_CLIENT_ID>
```

용도:
- 프런트 빌드 시 공개 설정 주입

### Cloudflare Worker Variables

위치:
`Cloudflare Dashboard > Workers & Pages > daejeon-jamissue-api > Settings > Variables and Secrets > Variables`

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

주의:
- `APP_FRONTEND_URL`과 `APP_CORS_ORIGINS`는 실제 Pages 도메인과 같아야 합니다.
- `APP_NAVER_LOGIN_CALLBACK_URL`은 실제 API 도메인과 같아야 합니다.
- `APP_ORIGIN_API_URL`은 FastAPI origin fallback이 필요할 때만 넣습니다.

### Cloudflare Worker Secrets

위치:
`Cloudflare Dashboard > Workers & Pages > daejeon-jamissue-api > Settings > Variables and Secrets > Secrets`

```env
APP_SESSION_SECRET=<random 64+ chars>
APP_JWT_SECRET=<random 64+ chars>
APP_DATABASE_URL=postgres://postgres.<project-ref>:<DB_PASSWORD>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
APP_SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
APP_NAVER_LOGIN_CLIENT_ID=<NAVER_LOGIN_CLIENT_ID>
APP_NAVER_LOGIN_CLIENT_SECRET=<NAVER_LOGIN_CLIENT_SECRET>
APP_PUBLIC_EVENT_SERVICE_KEY=<DATA_GO_KR_SERVICE_KEY>
```

### Cloudflare Pages 도메인

위치:
`Cloudflare Dashboard > Workers & Pages > daejeon-jamissue > Custom domains`

확인 항목:
- production frontend domain
- preview domain 또는 `*.pages.dev`

### 네이버 개발자센터

위치:
`네이버 개발자센터 > 애플리케이션 설정`

입력 항목:
- 서비스 URL = `https://daejeon.jamissue.com`
- Callback URL = `https://api.daegeon.jamissue.com/api/auth/naver/callback`

## 4. 초기 셋업 순서

1. Supabase SQL을 적용합니다.
2. Cloudflare Worker `daejeon-jamissue-api`에 Variables/Secrets를 입력합니다.
3. GitHub repository secrets/variables를 입력합니다.
4. 필요하면 [`scripts/create-cloudflare-pages-project.ps1`](/D:/JamIssue/scripts/create-cloudflare-pages-project.ps1)로 `daejeon-jamissue`를 미리 생성합니다.
5. Pages custom domain과 Worker route/domain을 연결합니다.
6. 네이버 개발자센터의 서비스 URL/Callback URL을 실제 도메인으로 맞춥니다.
7. `main`에 머지해서 배포를 확인합니다.

## 5. Supabase SQL 적용 순서

신규 프로젝트 기준:

1. [backend/sql/supabase_schema.sql](/D:/JamIssue/backend/sql/supabase_schema.sql)
2. [backend/sql/supabase_storage.sql](/D:/JamIssue/backend/sql/supabase_storage.sql)
3. [backend/sql/migrations/20260319_map_image_and_unique_nickname.sql](/D:/JamIssue/backend/sql/migrations/20260319_map_image_and_unique_nickname.sql)
4. [backend/sql/migrations/20260323_add_map_image_storage_path.sql](/D:/JamIssue/backend/sql/migrations/20260323_add_map_image_storage_path.sql)

샘플 장소 데이터로 완전 초기화하려면:

1. [backend/sql/migrations/20260323_reset_all_app_data.sql](/D:/JamIssue/backend/sql/migrations/20260323_reset_all_app_data.sql)
2. [backend/sql/migrations/20260323_add_place_images_bucket.sql](/D:/JamIssue/backend/sql/migrations/20260323_add_place_images_bucket.sql)
3. [backend/sql/migrations/20260323_seed_sample_places.sql](/D:/JamIssue/backend/sql/migrations/20260323_seed_sample_places.sql)

## 6. 수동 명령

Pages 프로젝트 생성:

```powershell
cd D:\JamIssue
.\scripts\create-cloudflare-pages-project.ps1
```

Pages 수동 배포:

```powershell
cd D:\JamIssue
.\scripts\deploy-cloudflare-pages.ps1
```

프런트 검증:

```powershell
cd D:\JamIssue
npm.cmd install
npm.cmd run typecheck
npm.cmd run build
```

백엔드 검증:

```powershell
cd D:\JamIssue\backend
python -m pytest tests
```

## 7. 운영 메모

- 축제 데이터는 공공데이터 API를 바탕으로 동기화됩니다.
- `APP_ORIGIN_API_URL`이 비어 있으면 origin fallback은 사용하지 않습니다.
- PR에서는 Worker production 배포를 하지 않습니다.
- 프런트 preview는 Pages에서 확인하고, production 반영은 `main` merge 후 확인합니다.
