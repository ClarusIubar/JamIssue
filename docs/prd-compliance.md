# JamIssue PRD 구현 현황

기준일: 2026-03-20  
기준 브랜치: `codex/production-deploy`

이 문서는 현재 저장소와 라이브 배포 기준으로 PRD 구현 상태를 정리합니다.

## 구현됨

### 1. 네비게이션 및 레이아웃
- 하단 탭 `지도 / 피드 / 코스 / 마이`
- 지도 탭 중심 구조
- 장소 선택 시 바텀시트 상세 노출
- 드로워 상태 `closed / partial / full`

### 2. 스탬프와 방문 기록
- `user_stamp` 로그 구조
- 같은 장소도 날짜가 다르면 다시 적립 가능
- `visit_ordinal` 기반 `n번째 방문` 표현
- 방문 로그와 travel session 연결

### 3. 방문 증명 후기 제한
- 후기 작성은 `stamp_id` 기반 검증
- 방문 증명 없이 후기 작성 불가
- API에서도 `stamp_id` 소유/장소 일치 검증

### 4. 24시간 코스 묶음
- `travel_session` 구조 적용
- 24시간 이내 스탬프는 같은 세션으로 판단
- 코스는 `popular / latest` 정렬 지원

### 5. 댓글/좋아요
- 댓글 깊이 제한 `부모 0 / 자식 1`
- 피드 좋아요, 댓글, 코스 좋아요 동작
- 댓글 시트에서 특정 댓글 하이라이트/이동 지원

### 6. 마이페이지
- 탭 구성
  - 얻은 스탬프
  - 내가 쓴 피드
  - 내가 쓴 댓글
  - 생성한 코스
- 통계 노출
  - 고유 장소 방문 수
  - 누적 스탬프 수
- 닉네임 수정 UI 제공

### 7. 인증
- 내부 사용자 식별 `user`
- 제공자 식별 `user_identity`
- 네이버 로그인 연결
- 닉네임 유니크 정책 적용

### 8. 축제 정보 레이어
- 공공데이터 API 기반 축제 정보 동기화
- 지도 레이어 분리
- 축제는 정보 제공만 하고 스탬프/피드/코스와 분리

### 9. Worker 직접 구현 API
- `GET /api/health`
- `GET /api/auth/providers`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `PATCH /api/auth/profile`
- `GET /api/auth/naver/login`
- `GET /api/auth/naver/callback`
- `GET /api/bootstrap`
- `GET /api/map-bootstrap`
- `GET /api/reviews`
- `POST /api/reviews/upload`
- `POST /api/reviews`
- `GET /api/reviews/:reviewId/comments`
- `POST /api/reviews/:reviewId/comments`
- `POST /api/reviews/:reviewId/like`
- `POST /api/stamps/toggle`
- `GET /api/courses/curated`
- `GET /api/community-routes`
- `POST /api/community-routes`
- `POST /api/community-routes/:routeId/like`
- `GET /api/my/routes`
- `GET /api/my/summary`
- `GET /api/banner/events`
- `GET /api/festivals`

## 부분 구현

### 1. 지도 탭 UX 완성도
현재 기능은 동작하지만, 모바일 브라우저별 뷰포트 차이와 미세한 레이아웃 완성도는 계속 다듬는 중입니다.

### 2. 이전 상태 복원
이전 버튼과 브라우저 히스토리 복원은 들어가 있지만, 실제 스크롤/세부 상태 복원은 계속 검증이 필요합니다.

### 3. 장소 이미지 데이터
코드와 스키마는 `map.image_url`을 지원합니다. 다만 live DB는 이미지 값이 충분히 채워져 있지 않거나, 과거 DB 상태에 따라 null 처리로 동작합니다.

## 미구현

### 1. 카카오 OAuth 실제 연결
카카오는 정책상 남기고 있지만 실제 로그인 연결은 아직 완성되지 않았습니다.

### 2. 관리자 기능
관리자 백오피스, 신고/숨김, 운영용 moderation 기능은 미구현입니다.

### 3. 관측성
에러 리포팅, 성능 모니터링, 운영 알림 체계는 본격적으로 들어가 있지 않습니다.

## 데이터 구조 기준

### 스탬프
- `UNIQUE(user_id, position_id, stamp_date)`
- 반복 방문 수 = `visit_ordinal`
- 후기 방문 증명 = `feed.stamp_id`

### 코스
- 사용자 여행 세션은 24시간 기준으로 묶음
- 사용자 코스는 `travel_session_id`와 연결 가능

### 장소 이미지
- `map.image_url` 사용
- live DB가 과거 상태여도 worker는 null 허용으로 동작

## 검증 기준
- `npm.cmd run typecheck` 통과
- `npm.cmd run build` 통과
- `backend/.venv\Scripts\python.exe -m pytest tests` 통과
- live API 확인
  - `/api/map-bootstrap`
  - `/api/courses/curated`
  - `/api/community-routes`
  - `/api/reviews`

## 관련 문서
- [screen-spec.md](/D:/Code305/JamIssue/docs/screen-spec.md)
- [community-routes.md](/D:/Code305/JamIssue/docs/community-routes.md)
- [account-identity-schema.md](/D:/Code305/JamIssue/docs/account-identity-schema.md)
- [growgardens-deploy-runbook.md](/D:/Code305/JamIssue/docs/growgardens-deploy-runbook.md)
