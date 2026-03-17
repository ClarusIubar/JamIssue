# Community Routes

JamIssue의 추천 코스는 운영자가 조합을 끝없이 늘리는 구조보다, 사용자가 실제로 찍은 스탬프 동선을 공개 경로로 발행하고 다른 사용자가 소비하는 구조를 우선합니다.

## PRD 반영 문장

`사용자가 실제 방문한 스탬프 기반 동선을 공개 경로로 발행하고, 다른 사용자는 좋아요순/최신순으로 그 경로를 탐색할 수 있어야 한다.`

## 핵심 정책

- 경로 발행은 로그인 사용자만 가능
- 경로 발행의 기준은 임의 장소 선택이 아니라 `travel_session`
- 하나의 세션에서 실제로 찍은 스탬프만 코스에 포함
- 최소 2곳 이상이어야 공개 경로 발행 가능
- 같은 세션으로는 경로를 한 번만 발행
- 정렬은 `popular` / `latest` 두 가지 제공
- 내가 만든 경로에는 좋아요 불가

## 왜 이렇게 가는가

- 운영자가 50개 장소 조합을 직접 만들지 않아도 됨
- 실제 방문 이력이 있으므로 추천 신뢰도가 높아짐
- 후기와 스탬프가 코스 콘텐츠로 이어짐
- 사용자가 직접 생태계를 만드는 구조가 됨

## 데이터 모델

### user_route
- 경로 메타 정보
- 작성자, 제목, 소개, mood, 공개 여부, 좋아요 수, `travel_session_id`, `is_user_generated`

### user_route_place
- 경로에 포함된 장소와 순서
- 세션 안의 스탬프 순서대로 자동 생성

### user_route_like
- 사용자별 경로 좋아요 기록
- 한 사용자는 한 경로에 한 번만 좋아요 가능

## 현재 구현 규칙

- `POST /api/community-routes`
  - `travelSessionId` 필수
  - 세션 소유자만 발행 가능
  - 이미 발행된 세션이면 차단
- `GET /api/community-routes?sort=popular|latest`
  - 공개 경로 목록 조회
- `POST /api/community-routes/{routeId}/like`
  - 좋아요 토글
- `GET /api/my/routes`
  - 내가 만든 경로 조회

## 후기와의 관계

직접적인 `feed -> route` 다대다를 먼저 만들지 않고, 아래처럼 같은 `travel_session` 에 묶인 기록으로 연결합니다.

- `user_stamp -> travel_session`
- `feed -> stamp_id -> travel_session`
- `user_route -> travel_session_id`

이 구조를 쓰면 데이터 정합성을 유지하면서도, 나중에 “이 코스에서 남긴 후기들”을 확장하기 쉽습니다.
