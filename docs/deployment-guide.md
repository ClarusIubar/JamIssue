# JamIssue Deployment Guide

이 문서는 `growgardens-deploy-runbook`과 `worker-first-poc`를 통합한 최종 배포 가이드입니다.
프로젝트의 현재 배포 구조와 설정, 운영 스펙 등을 다룹니다.

## 배포 아키텍처 (Cloudflare Pages + Supabase)

기존 로컬 혹은 별도의 백엔드 중심 아키텍처에서 벗어나 **정적 웹 + API 하이브리드** 형태로 배포됩니다.

```text
Frontend (React + 정적 파일)
-> Cloudflare Pages (프로젝트: jamissue)

API (Serverless Backend)
-> Cloudflare Worker (프로젝트: jamissue-api)
-> DB/Storage: Supabase REST 
```

## Cloudflare Pages 프론트엔드 배포

현재 모바일 웹 번들을 `/infra/nginx/site` 경로에 정적 사이트 형태로 빌드한 후, Cloudflare Pages로 직접 배포합니다.

### 배포 명령어
```bash
npm run build 
npx wrangler pages deploy infra/nginx/site --project-name jamissue --branch production
```
*주의: `dist` 폴더가 아닌 `infra/nginx/site` 폴더를 타겟으로 배포해야 정상적으로 에셋이 서빙됩니다.*

### Pages 환경 변수 (잼있슈-web)
- `PUBLIC_APP_BASE_URL`: 프론트가 호출할 API 주소 (ex: `https://api.jamissue.growgardens.app`)
- `PUBLIC_NAVER_MAP_CLIENT_ID`: 네이버 지도 Dynamic Map 키

## Cloudflare Worker 백엔드 API 배포

Worker는 장소 조회, 후기/댓글 처리, 스탬프 발급, 사용자 공개 경로 제어 등 핵심 비즈니스 로직을 직접 처리합니다. (단 카카오 OAuth나 복잡한 관리자 API는 제외)

### Worker 환경 변수 (잼있슈-api)
- `APP_FRONTEND_URL`: 로그인 후 Redirect할 웹 주소
- `APP_STORAGE_BACKEND`: `supabase`
- `APP_STAMP_UNLOCK_RADIUS_METERS`: 후기 활성화 및 스탬프 반경 제약조건 (현행 `120`)

### Worker 시크릿 (Secrets)
보안 유지가 필요한 중요 값들은 Dashboard 내 Environment Variables의 **Encrypt** 기능을 사용하여 등록해야 합니다.
- `APP_SESSION_SECRET`
- `APP_JWT_SECRET`
- `APP_DATABASE_URL` (Supabase Postgres Pooler)
- `APP_SUPABASE_SERVICE_ROLE_KEY`
- `APP_NAVER_LOGIN_CLIENT_ID` / `SECRET`

## Supabase DB 적용
최초 배포 시나리오일 경우 Supabase SQL Editor를 통해 다음 순서로 쿼리를 실행하여 테이블 및 스토리지를 구성합니다.
1. `backend/sql/supabase_schema.sql` (테이블/관계 기본 스키마)
2. `backend/sql/supabase_seed.sql` (최초 장소/카테고리 목업 데이터)
3. `backend/sql/supabase_storage.sql` (스토리지 버킷 및 권한 세팅)

## 운영 참고사항
- Cloudflare Pages의 자동 빌드가 아닌 로컬 빌드 후 `wrangler` CLI로 수동 배포하는 것이 현재 표준입니다.
- Worker 브랜치는 사용자 핵심 흐름 대부분을 직접 처리할 수 있음이 검증되었으며, 추가 확장이 있을 경우 FastAPI와의 책임 분리(`APP_ORIGIN_API_URL` 프록시)를 논의해야 합니다.
