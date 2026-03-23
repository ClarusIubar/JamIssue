# Operations Refactor Roadmap

이 문서는 현재 기능 안정화 이후, 팀 단위로 추진해야 하는 운영 체계성 리팩터링 TODO를 정리한 문서입니다.

중요:
- 아래 항목은 즉시 머지 필수 작업이 아닙니다.
- 현재 앱을 혼자 유지보수하는 수준을 넘어, 팀 규약과 운영 표준을 정하는 작업입니다.
- 따라서 기능 수정처럼 즉흥적으로 진행하지 말고, 선행 조건과 완료 조건을 맞춘 뒤 단계적으로 진행해야 합니다.

## 목적
- 프론트 상태 관리 규칙을 팀 차원에서 정리한다.
- 백엔드 도메인 경계를 더 분명히 하여 책임을 고립한다.
- 운영 배포 후 실제 동작을 자동으로 확인하는 최소 스모크 테스트 체계를 만든다.

## 우선순위
1. 운영 스모크 테스트 자동화
2. 프론트 store를 auth/map/review/my 도메인으로 분리
3. `repository_normalized.py`를 도메인별로 분리

## 1. 운영 스모크 테스트 자동화

상태: TODO
우선순위: 높음
성격: 운영 체계 / 배포 안정성

### 배경
현재는 `typecheck`, `build`, `pytest`는 통과해도, 실제 배포 뒤에
- 로그인 붙는지
- 지도 데이터가 로드되는지
- 피드/코스/마이 탭이 비어 있지 않은지
- 관리자 탭이 정상 응답하는지
를 사람이 직접 확인해야 합니다.

### 목표
배포 직후 핵심 사용자 흐름의 실패를 자동으로 감지합니다.

### TODO
- [ ] 배포 후 호출할 공용 헬스 체크 시나리오 정의
- [ ] 최소 검증 대상 API 목록 확정
  - [ ] `/api/health`
  - [ ] `/api/map-bootstrap`
  - [ ] `/api/review-feed`
  - [ ] `/api/community-routes`
  - [ ] `/api/auth/providers`
- [ ] 인증 없는 public smoke와 인증 필요한 protected smoke 분리
- [ ] `jamissue.growgardens.app` 기준 브라우저 수준 smoke 시나리오 초안 작성
- [ ] 실패 시 바로 볼 수 있는 로그/요약 출력 형식 정의
- [ ] CI 또는 배포 후 수동 원클릭 스크립트 경로 결정

### 완료 조건
- 배포 후 최소 1개의 자동 스모크가 실행된다.
- API 단절, 빈 페이지, 로그인 공급자 응답 누락을 자동으로 감지한다.
- 운영자가 브라우저를 열기 전에 실패 여부를 알 수 있다.

## 2. 프론트 store를 auth/map/review/my로 분리

상태: TODO
우선순위: 중간
성격: 프론트 구조 표준화

### 배경
현재 Zustand 도입으로 `App.tsx`는 많이 가벼워졌지만, store가 아직 크게 나뉘어 있지 않아 도메인 경계가 완전히 분리된 상태는 아닙니다.

### 목표
도메인별 상태와 액션을 나눠, 새로운 기능 추가 시 영향 범위를 줄입니다.

### 대상 도메인
- `auth-store`
  - 로그인 상태
  - provider 목록
  - 사용자 프로필
  - 관리자 여부
- `map-store`
  - 지도 중심 좌표
  - 줌
  - 선택 장소/행사
  - 카테고리 필터
  - 현재 위치 상태
- `review-store`
  - 피드 목록
  - 리뷰 하이라이트
  - 댓글 시트 상태
  - 리뷰/댓글 페이지네이션
- `my-store`
  - 마이페이지 탭
  - 내 스탬프/피드/댓글/코스 데이터
  - 마이페이지 스크롤 복원 상태

### TODO
- [ ] 현재 `app-ui-store`, `app-runtime-store` 상태 필드 목록 정리
- [ ] 각 필드를 도메인별로 재분류
- [ ] 기존 selector/액션이 어떤 컴포넌트에서 쓰이는지 매핑
- [ ] store 분리 후 컴포넌트별 의존 범위 최소화
- [ ] 전역 notice 같은 cross-cutting 상태는 별도 `ui-shell` 또는 `app-shell` 계층으로 유지할지 결정
- [ ] `App.tsx`가 여러 store를 조합만 하도록 정리

### 완료 조건
- `App.tsx`가 도메인 상태를 직접 많이 들고 있지 않는다.
- 상태 변경 시 무관한 화면 재렌더가 줄어든다.
- 새 기능 추가 시 어느 store를 수정해야 하는지 명확하다.

## 3. `repository_normalized.py`를 도메인별로 분리

상태: TODO
우선순위: 중간
성격: 백엔드 구조 표준화

### 배경
헬퍼와 일부 서비스는 이미 분리됐지만, `repository_normalized.py`에는 여전히
- 프로필
- 스탬프
- 리뷰
- 댓글
- 마이페이지 조립
같은 흐름이 많이 남아 있습니다.

### 목표
저장소는 데이터 접근 중심, 서비스는 도메인 흐름 중심이 되도록 경계를 더 분명하게 나눕니다.

### 분리 후보
- `profile_repository.py`
- `stamp_repository.py`
- `review_repository.py`
- `comment_repository.py`
- `my_page_repository.py`

또는 최소한 서비스 우선 분리:
- `ProfileService`
- `StampService`
- `ReviewService`
- `CommentService`

### TODO
- [ ] `repository_normalized.py` 공개 함수 목록 분류
- [ ] route/service가 직접 쓰는 함수와 내부 전용 함수를 구분
- [ ] 리뷰/댓글/스탬프 도메인부터 파일 또는 클래스 단위로 분리
- [ ] 문자열/예외/ID 파서 공통 모듈 유지 기준 정리
- [ ] 서비스가 repository 세부 구현 대신 도메인 인터페이스에 의존하도록 조정

### 완료 조건
- `repository_normalized.py`가 더 이상 프로젝트의 만능 파일이 아니다.
- `main.py -> service -> repository` 흐름이 대부분의 경로에서 일관된다.
- 리뷰/스탬프/프로필 변경 시 관련 파일 경계가 명확하다.

## 실행 원칙
- 현재 동작과 UI를 깨지 않는 범위에서 단계적으로 진행합니다.
- 각 단계마다 아래 검증을 유지합니다.
  - `npm run typecheck`
  - `npm run build`
  - `backend/.venv/Scripts/python.exe -m pytest tests`
- 한 번에 전부 하지 않고, 도메인 하나씩 독립 커밋으로 나눕니다.
- 운영 경로를 건드리는 작업은 배포 전 smoke 절차가 먼저 있어야 합니다.

## 지금 결론
현재 브랜치는 안정화/구조 정리의 1차 마감선까지는 도달했습니다.
이 문서의 항목들은 그 다음 단계의 운영 체계 리팩터링이며, 팀이 합의한 뒤 계획적으로 진행하는 것이 맞습니다.
