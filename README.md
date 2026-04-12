# JamIssue

**서비스 주소: https://daejeon.jamissue.com/**

대전의 로컬 장소·행사·리뷰를 한곳에서 탐색할 수 있는 서비스입니다.  
대전 시내 카페·식당·문화공간 등을 지도로 찾아보고, 공식 행사 일정을 확인하며, 
직접 방문 후 리뷰와 스탬프를 남길 수 있습니다.

## 운영 기준

- 팀 구현 기준 브랜치: `team/main`
- 백업/보관 브랜치: `main`
- 운영 배포 브랜치: `codex/production-deploy`
- 프런트 도메인: `https://daejeon.jamissue.com`
- API 도메인: `https://api.daejeon.jamissue.com`
- Pages 프로젝트: `daejeon-jamissue-pages`
- Worker 프로젝트: `daejeon-jamissue-api`
- 데이터 저장소: Supabase

### 브랜치 운영 원칙

- `team/main`은 팀에서 실제 구현을 쌓아가는 기준 브랜치입니다.
- `main`은 보여주기용/백업용 브랜치로 취급하며, 구현의 source of truth로 보지 않습니다.
- 운영 배포는 `codex/production-deploy`를 별도 축으로 관리합니다.
- 따라서 `team/main`, `main`, `codex/production-deploy`는 각각 역할이 다르며 서로 같은 승격 단계로 취급하지 않습니다.

## 배포 흐름

### PR to `codex/production-deploy`

- 프런트 `npm ci`, `npm run typecheck`, `npm run build`
- 백엔드 `pytest`
- Pages preview 배포
- Worker `wrangler deploy --dry-run`

### Push to `codex/production-deploy`

- 프런트/백엔드 검증
- `daejeon-jamissue-pages` production 배포
- `daejeon-jamissue-api` production 배포
- `production-smoke.yml`로 운영 스모크 체크 실행

### Push to `team/main`

- 팀 구현의 기준선으로 취급합니다.
- 기능 개발, 팀 작업 통합, 구현 누적은 이 브랜치를 중심으로 진행합니다.
- 운영 배포 기준 브랜치와는 별개입니다.

### Push to `main`

- 백업/보관 목적 브랜치로 취급합니다.
- 팀 구현 기준선이나 운영 배포 기준선으로 간주하지 않습니다.

## 런타임 호출 경계

이 저장소는 Pages + Worker + Supabase 조합을 기본 운영 경계로 사용합니다.

### 진입점

- 브라우저 사용자는 `https://daejeon.jamissue.com` Pages 프런트에 접속합니다.
- 프런트는 공개 API를 `https://api.daejeon.jamissue.com` Worker 경유로만 호출합니다.
- 프런트는 운영 기준으로 FastAPI origin을 직접 호출하지 않습니다.

### 책임 분리

- Pages
  - 정적 프런트 번들 제공
  - `app-config.js`로 런타임 환경값 주입
- Worker
  - 공개 API의 단일 진입점
  - 인증, 리뷰/댓글/좋아요/스탬프, 공공행사, 알림, 마이페이지 API 처리
  - 필요 시에만 origin API로 프록시
- FastAPI origin
  - 로컬 개발용 앱서버
  - Worker에서 아직 직접 처리하지 않은 경로의 보조 origin
  - 프런트의 운영 호출 대상은 아님
- Supabase
  - 운영 DB / Storage / Realtime

### 호출 규칙

- 프런트 코드에서는 `PUBLIC_APP_BASE_URL`에 들어간 Worker API 주소만 사용합니다.
- 공개 계약의 기준은 Worker가 실제로 노출하는 경로입니다.
- Worker가 직접 처리하지 않는 API만 선택적으로 origin으로 넘길 수 있습니다.
- 새 API를 추가할 때는
  1. 프런트가 호출할 공개 경로를 먼저 정하고
  2. Worker 직접 처리인지 origin 프록시인지 결정한 뒤
  3. README와 배포/스모크 경로를 같이 갱신합니다.

### 운영 체크 포인트

- 배포 성공만으로 서비스 정상 동작으로 보지 않습니다.
- `production-smoke.yml`이 Pages/Worker 배포 이후 핵심 공개 API와 프런트 진입점을 다시 확인합니다.
- 최소 스모크 경로:
  - `GET /api/health`
  - `GET /api/auth/providers`
  - `GET /api/map-bootstrap`
  - `GET /api/review-feed`
  - `GET /api/community-routes`
  - `GET /api/festivals`

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
PUBLIC_SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY>
```

설명:
- `EVENT_IMPORT_TOKEN`은 주간 행사 동기화 워크플로가 Worker 내부 import 엔드포인트를 호출할 때 사용합니다.

### GitHub Repository Variables

위치:
`GitHub > Repository > Settings > Secrets and variables > Actions > Repository variables`

```env
PUBLIC_APP_BASE_URL=https://api.daejeon.jamissue.com
PUBLIC_NAVER_MAP_CLIENT_ID=<NAVER_MAP_CLIENT_ID>
PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
```

설명:
- `PUBLIC_APP_BASE_URL`: 프런트에서 호출할 API 주소
- `PUBLIC_NAVER_MAP_CLIENT_ID`: 네이버 지도용 공개 client id

- `PUBLIC_SUPABASE_URL`: 프런트에서 Realtime 연결에 사용할 Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY`: 프런트에서 Realtime 연결에 사용할 Supabase anon key

### Cloudflare Worker Variables

위치:
`Cloudflare Dashboard > Workers & Pages > daejeon-jamissue-api > Settings > Variables and Secrets > Variables`

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
https://api.daejeon.jamissue.com/api/auth/naver/callback
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

## CI 메모

- 문서만 수정해서 `main`에 바로 반영할 때는 커밋 메시지에 `[skip ci]`를 포함해 GitHub Actions를 건너뛸 수 있습니다.
