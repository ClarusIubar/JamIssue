# 아키텍처 변경 문서 (2026-03-16)

## 변경 배경

현재 저장소는 `프론트 정적 번들 + FastAPI + 로컬 nginx + 로컬 DB` 구조를 기준으로 발전해 왔습니다. 하지만 실제 배포 조건은 아래와 같이 달라졌습니다.

- 팀 공통 기준은 `FastAPI 서버`를 유지한다.
- 배포는 가능한 한 `별도 서버를 직접 관리하지 않는 방향`을 선호한다.
- 도메인은 `Cloudflare`를 사용한다.
- 데이터베이스와 스토리지는 `Supabase`를 사용한다.
- 장기적으로는 기능 경계에 따라 서비스 분리도 고려한다.

즉, 구현 기준은 FastAPI를 유지하되, 배포와 실행 환경은 Cloudflare 쪽으로 옮겨보는 전략이 필요합니다.

## 이번 변경의 핵심 결정

### 유지하는 것

- 백엔드 주 프레임워크는 `FastAPI`
- API 계약, Pydantic 모델, 도메인 로직 중심 설계
- 관계형 데이터 모델을 전제로 한 서비스 구조
- 프론트/백엔드 분리 개념

### 바꾸는 것

- `로컬 nginx + 별도 앱서버`만을 전제로 한 배포 사고방식
- 초기 배포 실험 런타임을 `Cloudflare Python Worker`까지 확장
- DB/스토리지 운영 대상을 `Supabase`로 정렬

## 목표 구조

```text
Client
  -> Cloudflare Pages 또는 Static Assets
  -> Cloudflare Worker (FastAPI ASGI runtime)
  -> Supabase Postgres / Supabase Storage
```

이 구조는 Cloudflare 공식 문서에서 지원하는 방향입니다.

- Python Workers는 FastAPI를 지원합니다.
- Workers 런타임이 ASGI 서버 역할을 제공합니다.
- Workers는 Service bindings로 이후 서비스 분리를 지원합니다.
- Supabase는 Worker에서 client 방식 또는 Hyperdrive 방식으로 연결할 수 있습니다.

## 아키텍처 레이어 정의

### 1. 프론트 레이어
- 역할: 모바일 웹 UI, 지도, 사용자 상호작용
- 배포 대상: Cloudflare Pages 또는 Workers Static Assets
- 주의: 프론트는 가능한 한 백엔드 런타임 세부사항을 몰라야 한다.

### 2. 엣지/프록시 레이어
- 역할: 공개 엔드포인트, 라우팅, 캐시, 시크릿 바인딩, 도메인 연결
- 현재 후보: Cloudflare Worker
- 주의: 이 레이어는 프록시이자 API 런타임 진입점 역할을 동시에 가질 수 있다.

### 3. 앱서버 레이어
- 역할: FastAPI 기반 비즈니스 로직
- 현재 파일 기준: `backend/app/*`
- 원칙: 도메인 로직은 Worker 전용 코드와 섞지 않는다.

### 4. 데이터 레이어
- DB: Supabase Postgres
- 스토리지: Supabase Storage
- 원칙: DB/스토리지 접근은 점진적으로 어댑터 레이어로 이동한다.

## Worker-first이지만 FastAPI를 버리지 않는 이유

이번 변경은 `FastAPI를 Worker에서 실행해 보는 파일럿`을 의미합니다. 이는 곧 `FastAPI를 포기한다`는 뜻이 아닙니다.

오히려 이 구조는 아래 두 경로를 모두 열어둡니다.

1. 지금은 Cloudflare Worker에서 FastAPI를 실행한다.
2. 나중에 필요하면 같은 FastAPI 앱을 별도 앱서버로 분리한다.

즉, Worker는 FastAPI 앱의 실행 런타임 중 하나이며, 프레임워크 자체를 바꾸는 것이 아닙니다.

## 이후 서비스 분리 기준

초기에는 Worker 1개로 시작할 수 있습니다. 다만 코드 구조는 아래처럼 경계를 의식해서 나눕니다.

- `auth`
- `reviews`
- `stamps`
- `admin`
- `public_data`

이렇게 모듈 경계를 먼저 나누면, 이후에는 Cloudflare Service bindings를 통해 다음과 같이 분리할 수 있습니다.

- `auth worker`
- `public api worker`
- `admin/import worker`

중요한 점은 `처음부터 3개 Worker를 만들지 않아도`, 경계만 잘 나눠두면 나중에 3개로 가르기 쉬워진다는 것입니다.

## 이번 단계의 명확한 범위

이번 커밋에서 실제로 진행하는 범위:

- 아키텍처 변경 문서 작성
- Cloudflare Python Worker용 FastAPI 엔트리포인트 추가
- Worker 설정 파일 추가
- 배포 변경 문서 작성
- 배포 브랜치 기준 워크플로 초안 추가

이번 단계에서 아직 끝내지 않는 것:

- 전체 FastAPI API를 Worker 환경에 완전 이식
- SQLAlchemy/MySQL 중심 접근을 Supabase 전용 접근 계층으로 완전 전환
- 업로드를 Supabase Storage로 완전 이전
- Service bindings 기반 다중 Worker 분리

## 즉시 다음 할 일

1. Worker 파일럿에서 실제로 띄울 최소 API 범위를 정한다.
2. DB 접근을 `Supabase adapter` 기준으로 분리한다.
3. 업로드 경로를 로컬 파일 시스템에서 Supabase Storage로 바꾼다.
4. 이후에야 서비스 분리를 검토한다.

## 참고 문서

- 배포 변경 문서: [docs/deployment-change-2026-03-16.md](/D:/Code305/JamIssue/docs/deployment-change-2026-03-16.md)
- Cloudflare FastAPI: https://developers.cloudflare.com/workers/languages/python/packages/fastapi/
- Cloudflare Service bindings: https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/
- Cloudflare Workers + Supabase: https://developers.cloudflare.com/workers/databases/third-party-integrations/supabase/
