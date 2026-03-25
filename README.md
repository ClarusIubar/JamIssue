# JamIssue

대전 로컬 장소 탐색, 행사, 리뷰를 연결하는 서비스입니다.

## 운영 기준

- 배포 브랜치: `main`
- 프런트 도메인: `https://daejeon.jamissue.com`
- API 도메인: `https://api.daegeon.jamissue.com`
- Pages 프로젝트: `daejeon-jamissue-pages`
- Worker 프로젝트: `daejeon-jamissue-api`
- 데이터 저장소: Supabase

## 배포 흐름

### PR to `main`

- 프런트 `npm ci`, `npm run typecheck`, `npm run build`
- 백엔드 `pytest`
- Pages preview 배포
- Worker `wrangler deploy --dry-run`

### Push to `main`

- 프런트/백엔드 검증
- `daejeon-jamissue-pages` production 배포
- `daejeon-jamissue-api` production 배포

### 주간 행사 동기화

- GitHub Actions `public-event-sync.yml`
- 매주 월요일 03:00 KST 실행
- 대전시 공식 행사 상세검색 페이지를 읽어 DB에 upsert
- Worker는 요청 시 원본 사이트를 직접 크롤링하지 않고 DB만 조회

## 어디에 어떤 값을 넣는가

### GitHub Repository Secrets

위치:
`GitHub > Repository > Settings > Secrets and variables > Actions > Repository secrets`

```env
CLOUDFLARE_API_TOKEN=<Cloudflare API token>
CLOUDFLARE_ACCOUNT_ID=<Cloudflare account id>
EVENT_IMPORT_TOKEN=<random long token>
```

설명:
- `EVENT_IMPORT_TOKEN`은 주간 행사 동기화 워크플로가 Worker 내부 import 엔드포인트를 호출할 때 사용합니다.

### GitHub Repository Variables

위치:
`GitHub > Repository > Settings > Secrets and variables > Actions > Repository variables`

```env
PUBLIC_APP_BASE_URL=https://api.daegeon.jamissue.com
PUBLIC_NAVER_MAP_CLIENT_ID=<NAVER_MAP_CLIENT_ID>
```

설명:
- `PUBLIC_APP_BASE_URL`: 프런트에서 호출할 API 주소
- `PUBLIC_NAVER_MAP_CLIENT_ID`: 네이버 지도용 공개 client id

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

설명:
- `APP_EVENT_IMPORT_TOKEN`은 GitHub Actions에서 보내는 행사 적재 요청을 보호합니다.
- `APP_NAVER_LOGIN_CLIENT_ID`는 Worker variable, `APP_NAVER_LOGIN_CLIENT_SECRET`은 Worker secret입니다.

## 네이버 설정

### 지도

- 프런트에서 사용
- 필요한 값: `PUBLIC_NAVER_MAP_CLIENT_ID`
- 넣는 곳: GitHub Repository Variables

### 로그인

- Worker에서 사용
- 필요한 값:
  - `APP_NAVER_LOGIN_CLIENT_ID`
  - `APP_NAVER_LOGIN_CLIENT_SECRET`
  - `APP_NAVER_LOGIN_CALLBACK_URL`

### 네이버 개발자센터 입력값

```text
서비스 URL
https://daejeon.jamissue.com

Callback URL
https://api.daegeon.jamissue.com/api/auth/naver/callback
```

## 행사 데이터 구조

- 수집 소스: `https://www.daejeon.go.kr/fvu/FvuEventList.do?menuSeq=504`
- 수집 주체: GitHub Actions `public-event-sync`
- 적재 대상: `public_event`, `public_data_source`
- 조회 API:
  - `GET /api/festivals`
  - `GET /api/banner/events`
- 내부 적재 API:
  - `POST /api/internal/public-events/import`

운영 포인트:
- 화면 요청 시 원본 사이트를 직접 긁지 않습니다.
- 주간 작업이 새 데이터를 DB에 upsert 합니다.
- 프런트/API는 DB 기준으로 앞으로 30일 이내 행사만 슬라이싱합니다.

## 로컬 확인 명령

```powershell
cd D:\JamIssue
npm.cmd install
npm.cmd run typecheck
npm.cmd run build
node scripts/sync-daejeon-events.mjs --dry-run
```

```powershell
cd D:\JamIssue\backend
python -m pytest tests
```

## 참고 문서

- [docs/README.md](/D:/JamIssue/docs/README.md)
- [docs/growgardens-deploy-runbook.md](/D:/JamIssue/docs/growgardens-deploy-runbook.md)
- [backend/README.md](/D:/JamIssue/backend/README.md)
