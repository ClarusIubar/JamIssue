# Cloudflare + Docker 배포 구조

## 선택한 방식

이번 배포 브랜치에서는 `GitHub Pages / Wrangler 단독` 대신 아래 구조를 기준으로 잡습니다.

```text
사용자
  -> Cloudflare DNS / Proxy / TLS
  -> origin server (Docker)
     -> frontend nginx container
        -> / 정적 프론트 서빙
        -> /api, /uploads 는 backend 로 프록시
     -> backend FastAPI container (gunicorn + uvicorn workers)
        -> Supabase Postgres
        -> local upload volume
```

이 방식을 고른 이유:
- 현재 서비스는 정적 프론트만으로 끝나지 않고 FastAPI 앱서버가 필요합니다.
- Cloudflare 도메인을 그대로 쓸 수 있습니다.
- 프론트와 백엔드를 컨테이너로 분리해서 빌드할 수 있습니다.
- 백엔드 워커 수를 `APP_WORKERS` 로 늘릴 수 있습니다.
- DB 는 origin 서버 내부가 아니라 Supabase 외부 Postgres 를 사용합니다.

## 컨테이너 구성

- 프론트: [infra/docker/frontend/Dockerfile](/D:/Code305/JamIssue/infra/docker/frontend/Dockerfile)
  - React 정적 빌드 결과물을 nginx 가 서빙합니다.
  - `/api`, `/uploads` 는 backend 컨테이너로 프록시합니다.
  - `PUBLIC_NAVER_MAP_CLIENT_ID`, `PUBLIC_APP_BASE_URL` 은 컨테이너 시작 시 `app-config.js` 로 주입합니다.

- 백엔드: [backend/Dockerfile](/D:/Code305/JamIssue/backend/Dockerfile)
  - `gunicorn + uvicorn workers` 로 실행합니다.
  - 기본 worker 수는 `APP_WORKERS=2` 입니다.
  - `APP_DATABASE_URL` 에 Supabase Postgres URL 을 넣으면 됩니다.

- 오케스트레이션: [deploy/docker-compose.cloudflare.yml](/D:/Code305/JamIssue/deploy/docker-compose.cloudflare.yml)
  - frontend / backend 두 서비스로 구성됩니다.
  - DB 는 외부 Supabase 를 사용하므로 compose 안에 DB 컨테이너는 두지 않습니다.
  - 업로드는 `uploads-data` 볼륨에 저장합니다.

## Cloudflare 도메인 연결 기준

가정:
- 실제 공개 도메인: `https://jamissue.example.com`
- origin 서버는 Docker 를 실행할 수 있는 Linux VM 또는 bare metal

권장 흐름:
1. Cloudflare 에서 도메인을 프록시(orange cloud) 상태로 연결합니다.
2. DNS 는 origin 서버의 공인 IP 로 연결합니다.
3. SSL/TLS 모드는 `Full (strict)` 를 권장합니다.
4. 공개 URL 은 프론트 도메인 하나로 통일합니다.
5. 프론트 nginx 가 같은 도메인에서 `/api` 와 `/uploads` 를 backend 로 넘깁니다.

이 방식이면:
- 브라우저는 항상 `https://jamissue.example.com` 만 봅니다.
- CORS 와 세션 쿠키 설정이 단순해집니다.
- 네이버 OAuth callback 도 한 도메인 기준으로 맞출 수 있습니다.

## Supabase 연결

현재 백엔드는 SQLAlchemy URL 문자열을 그대로 사용합니다.
배포에서는 아래 형식의 Postgres URL 을 넣으면 됩니다.

```bash
APP_DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres
```

주의:
- 이전 로컬 구조는 MySQL 이었지만, 배포용은 Supabase Postgres 로 분리합니다.
- 이 브랜치에서는 `psycopg[binary]` 의존성을 추가해 Postgres 연결도 가능하게 했습니다.
- 마이그레이션 도구는 아직 붙이지 않았으므로, 스키마 변경이 잦아지면 Alembic 을 다음 단계로 넣는 것이 좋습니다.

## GitHub Actions 역할

워크플로: [.github/workflows/container-release.yml](/D:/Code305/JamIssue/.github/workflows/container-release.yml)

동작:
- 배포 브랜치에 push 하면 프론트/백엔드 이미지를 각각 GHCR 에 푸시합니다.
- 배포용 compose 파일과 env 예시, 문서를 artifact 로 묶습니다.

현재 태그 전략:
- `ghcr.io/<owner>/jamissue-frontend:deploy-latest`
- `ghcr.io/<owner>/jamissue-backend:deploy-latest`
- 그리고 각 SHA 태그

## 필요한 GitHub Secrets

런타임 시크릿은 서버에서 compose env 파일로 쓰는 기준입니다.
지금 단계에서는 Actions 에 저장해 두고, 이후 실제 배포 job 을 붙일 때 그대로 재사용하면 됩니다.

필수:
- `PUBLIC_NAVER_MAP_CLIENT_ID`
- `APP_SESSION_SECRET`
- `APP_JWT_SECRET`
- `APP_DATABASE_URL`
- `APP_CORS_ORIGINS`
- `PUBLIC_APP_BASE_URL`

OAuth 사용 시 추가:
- `APP_NAVER_LOGIN_CLIENT_ID`
- `APP_NAVER_LOGIN_CLIENT_SECRET`
- `APP_NAVER_LOGIN_CALLBACK_URL`
- `APP_GOOGLE_LOGIN_CLIENT_ID`
- `APP_GOOGLE_LOGIN_CLIENT_SECRET`
- `APP_GOOGLE_LOGIN_CALLBACK_URL`
- `APP_KAKAO_LOGIN_CLIENT_ID`
- `APP_KAKAO_LOGIN_CLIENT_SECRET`
- `APP_KAKAO_LOGIN_CALLBACK_URL`
- `APP_APPLE_LOGIN_CLIENT_ID`
- `APP_APPLE_LOGIN_CLIENT_SECRET`
- `APP_APPLE_LOGIN_CALLBACK_URL`

옵션:
- `APP_ADMIN_USER_IDS`
- `APP_PUBLIC_DATA_SOURCE_URL`
- `APP_PUBLIC_EVENT_SOURCE_URL`
- `APP_PUBLIC_EVENT_SERVICE_KEY`

## 서버에서 실제 기동할 때

배포 서버에서 예시:

```bash
cp deploy/.env.cloudflare.example deploy/.env.cloudflare
# 실제 도메인 / Supabase / OAuth 값 입력

docker compose --env-file deploy/.env.cloudflare -f deploy/docker-compose.cloudflare.yml pull

docker compose --env-file deploy/.env.cloudflare -f deploy/docker-compose.cloudflare.yml up -d
```

## 지금 단계에서 남겨둔 것

이번 브랜치에서 아직 일부러 넣지 않은 것:
- 원격 서버 SSH 자동 배포 job
- Alembic 마이그레이션
- Cloudflare Tunnel 전용 설정
- Pages / Workers 배포 스크립트

이유:
- 현재 요구사항의 핵심은 `도메인 고려 + Docker 이미지 분리 + 외부 Supabase 연결 + 배포 브랜치 기반 빌드` 였기 때문입니다.
- 실제 서버 호스트가 정해지면 그때 SSH 배포나 systemd / watchtower / compose pull 전략을 붙이는 편이 안전합니다.
