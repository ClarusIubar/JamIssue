# Worker-first POC

브랜치: `codex/worker-first-poc`

## 목적

Cloudflare Worker에서 FastAPI 전체를 직접 올리지 않고도,
Supabase 기반 핵심 사용자 흐름을 Worker가 어디까지 직접 처리할 수 있는지 확인한다.

## 현재 구조

```text
Cloudflare Pages
-> Cloudflare Worker
-> Supabase REST / Storage
```

현재 POC는 읽기 API만 보는 상태를 넘어서,
네이버 로그인과 후기 / 댓글 / 좋아요 / 스탬프 / 추천 경로 쓰기 일부까지 Worker가 직접 처리한다.
관리자 기능과 카카오 로그인처럼 아직 옮기지 않은 경로만 선택적으로 FastAPI origin으로 넘길 수 있다.

## 현재 Worker가 직접 처리하는 엔드포인트

- `GET /api/health`
- `GET /api/auth/providers`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/auth/naver/login`
- `GET /api/auth/naver/callback`
- `GET /api/bootstrap`
- `GET /api/reviews`
- `POST /api/reviews/upload`
- `POST /api/reviews`
- `GET /api/reviews/:reviewId/comments`
- `POST /api/reviews/:reviewId/comments`
- `POST /api/reviews/:reviewId/like`
- `POST /api/stamps/toggle`
- `GET /api/community-routes`
- `POST /api/community-routes`
- `POST /api/community-routes/:routeId/like`
- `GET /api/my/routes`
- `GET /api/my/summary`
- `GET /api/banner/events`

## 현재 확인된 동작

- `https://api.jamissue.growgardens.app/api/health`
  - 정상 응답
- `https://api.jamissue.growgardens.app/api/auth/providers`
  - 네이버 provider 활성 상태 확인 가능
- `https://api.jamissue.growgardens.app/api/bootstrap`
  - Supabase 장소 / 후기 / 코스 실제 응답
- `POST /api/reviews`
  - 로그인 없으면 `401`
  - 좌표가 반경 밖이면 `403`
  - 반경 안이면 후기 생성
- `POST /api/stamps/toggle`
  - 로그인 + 반경 조건 만족 시 적립
- `POST /api/community-routes`
  - 실제 적립한 스탬프 장소만 경로 공개 가능

## 현재 Worker에 직접 없는 것

- 카카오 OAuth 실제 로그인 흐름
- 관리자 수정 / 운영 API
- 메인 FastAPI 브랜치에만 있는 일부 백오피스 작업

이 API들은 아래 규칙을 따른다.

1. `APP_ORIGIN_API_URL` 이 설정돼 있으면 FastAPI origin으로 프록시
2. 비어 있으면 `501`

즉, 이 브랜치는 읽기 전용 shell이 아니라,
사용자 핵심 흐름 일부를 Worker에서 직접 검증하는 실험 브랜치다.

## 장점

- Worker 무료 플랜에서도 실제 데이터 읽기와 일부 쓰기 API를 확인할 수 있다.
- 프론트가 더 이상 shell 응답이 아니라 실제 장소 / 후기 / 경로 데이터를 받을 수 있다.
- 네이버 로그인 시작 / callback / 세션 확인까지 Worker에서 직접 확인할 수 있다.
- 후기와 스탬프를 같은 반경 규칙으로 묶어 UX를 단순화할 수 있다.

## 단점

- 카카오는 아직 비활성이다.
- 관리자 기능은 아직 Worker 기준으로 직접 옮기지 않았다.
- FastAPI 기준 메인 아키텍처와는 다르므로, 이 브랜치를 그대로 운영 구조로 확정하면 안 된다.

## 다음 실험 후보

1. 카카오 로그인까지 Worker에서 직접 처리 가능한지 확인
2. 관리자 최소 API를 Worker에 얹을지, FastAPI origin에 둘지 분리 기준 정하기
3. Worker 브랜치와 메인 FastAPI 브랜치의 공통 계약 문서 정리
4. 한계가 명확해지면 FastAPI 기준 메인 구조와 역할 분담 재정리
