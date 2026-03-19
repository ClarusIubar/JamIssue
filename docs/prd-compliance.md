# JamIssue PRD 대비 구현 기준

기준일: 2026-03-19
기준 브랜치: `codex/production-deploy`
기준 검증: `npm run typecheck`, `npm run build` 통과

이 문서는 현재 코드가 PRD 요구사항을 어디까지 구현했는지 기록하는 기준 문서입니다.
문서상 표현이 아니라 실제 저장소와 배포 흐름을 기준으로 `구현됨 / 부분 구현 / 미구현`으로 나눕니다.

## 구현됨

### 1. 전역 구조와 탭
- 하단 탭 `지도 / 피드 / 코스 / 마이`
- `지도` 탭만 지도 + 바텀 드로워 사용
- `피드 / 코스 / 마이`는 별도 페이지형 패널 구조
- 바텀 드로워는 `closed / partial / full` 상태를 가짐

관련 파일:
- [App.tsx](/D:/Code305/JamIssue/src/App.tsx)
- [BottomNav.tsx](/D:/Code305/JamIssue/src/components/BottomNav.tsx)
- [MapTabStage.tsx](/D:/Code305/JamIssue/src/components/MapTabStage.tsx)
- [PlaceDetailSheet.tsx](/D:/Code305/JamIssue/src/components/PlaceDetailSheet.tsx)
- [FestivalDetailSheet.tsx](/D:/Code305/JamIssue/src/components/FestivalDetailSheet.tsx)

### 2. 스탬프 = 방문 로그
- `user_stamp`를 방문 로그로 사용
- 같은 장소라도 날짜가 다르면 재방문 스탬프 허용
- 같은 날짜에는 같은 장소를 한 번만 적립
- `visit_ordinal` 기반으로 `n번째 방문` 표시
- 장소별 오늘 스탬프 여부, 최근 방문 여부 계산 반영

관련 파일:
- [db_models.py](/D:/Code305/JamIssue/backend/app/db_models.py)
- [repository_normalized.py](/D:/Code305/JamIssue/backend/app/repository_normalized.py)
- [20260318_stamp_session_refactor.sql](/D:/Code305/JamIssue/backend/sql/migrations/20260318_stamp_session_refactor.sql)

### 3. 피드는 방문 증명 필수
- 후기 작성에는 `stamp_id`가 필수
- 프론트에서 비활성화
- API 단에서 `stamp_id` 소유자/장소 일치 검증
- GPS 반경 진입만으로는 후기 작성 불가

관련 파일:
- [PlaceDetailSheet.tsx](/D:/Code305/JamIssue/src/components/PlaceDetailSheet.tsx)
- [ReviewComposer.tsx](/D:/Code305/JamIssue/src/components/ReviewComposer.tsx)
- [repository_normalized.py](/D:/Code305/JamIssue/backend/app/repository_normalized.py)
- [index.js](/D:/Code305/JamIssue/deploy/api-worker-shell/index.js)

### 4. 코스는 24시간 여행 세션 기반
- 스탬프 간격이 24시간 이내면 같은 `travel_session`
- 24시간 초과 시 새 세션 생성
- 사용자 생성 코스는 `travel_session_id` 기준으로 발행
- 공개 경로 정렬 `popular / latest`
- `is_user_generated`로 큐레이션/사용자 경로 구분

관련 파일:
- [community-routes.md](/D:/Code305/JamIssue/docs/community-routes.md)
- [db_models.py](/D:/Code305/JamIssue/backend/app/db_models.py)
- [CourseTab.tsx](/D:/Code305/JamIssue/src/components/CourseTab.tsx)
- [index.js](/D:/Code305/JamIssue/deploy/api-worker-shell/index.js)

### 5. 댓글/좋아요 기본 규칙
- 댓글 깊이는 `부모 0 / 자식 1`로 제한
- 답글의 답글도 루트 댓글 자식으로 평탄화
- 댓글 soft delete 반영
- 피드 좋아요 / 경로 좋아요 분리
- 피드 댓글 시트 분리
- 마이페이지에서 `내가 쓴 댓글` 탭 제공

관련 파일:
- [CommentThread.tsx](/D:/Code305/JamIssue/src/components/CommentThread.tsx)
- [FeedCommentSheet.tsx](/D:/Code305/JamIssue/src/components/FeedCommentSheet.tsx)
- [MyPagePanel.tsx](/D:/Code305/JamIssue/src/components/MyPagePanel.tsx)
- [repository_normalized.py](/D:/Code305/JamIssue/backend/app/repository_normalized.py)

### 6. 마이페이지 기본 구조
- 상단 통계 분리
  - 방문한 고유 장소 수
  - 누적 스탬프 수
- 내부 탭
  - `얻은 스탬프`
  - `내가 쓴 피드`
  - `내가 쓴 댓글`
  - `생성한 코스`
- 설정 버튼에서 닉네임 수정 가능

관련 파일:
- [MyPagePanel.tsx](/D:/Code305/JamIssue/src/components/MyPagePanel.tsx)

### 7. 계정/닉네임 정책
- 내부 계정 `user`, 외부 로그인 식별자 `user_identity` 분리
- 같은 이메일 자동 병합 금지
- 닉네임은 현재 유니크 제약 적용
- 닉네임 완료 단계 이후 프로필 완료 처리

관련 파일:
- [account-identity-schema.md](/D:/Code305/JamIssue/docs/account-identity-schema.md)
- [20260319_map_image_and_unique_nickname.sql](/D:/Code305/JamIssue/backend/sql/migrations/20260319_map_image_and_unique_nickname.sql)
- [repository_normalized.py](/D:/Code305/JamIssue/backend/app/repository_normalized.py)

### 8. 축제 정보 레이어
- 공공데이터 기반 축제 정보 동기화 구조 반영
- 대전 한정 필터
- 진행 중 + 30일 이내 예정 행사 표시
- 축제는 스탬프/피드/코스와 분리된 정보 제공 역할

관련 파일:
- [FestivalDetailSheet.tsx](/D:/Code305/JamIssue/src/components/FestivalDetailSheet.tsx)
- [index.js](/D:/Code305/JamIssue/deploy/api-worker-shell/index.js)

## 부분 구현

### 1. 지도 탭 UX 완성도
큰 구조는 맞지만, 프로토타입 재현도와 완성도는 아직 부족합니다.

현재 된 것:
- 지도 탭 전용 레이아웃
- 장소/축제 드로워 분리
- 하단 시트 존재감용 teaser
- 필터 칩과 브랜드 헤더 정리

남은 것:
- 프로토타입 대비 헤더/필터/맵 비율 정제
- 지도 위 정보 밀도와 여백 재정리
- 드로워 시각 완성도 및 액션 정렬 마감

### 2. 이전 상태 복원
구조와 훅은 들어가 있습니다.
- 탭/댓글 시트/하이라이트/스크롤 복원 로직 반영
- 명시적 `이전` 버튼 존재

하지만 아직 실사용 검증이 더 필요합니다.
- 특히 `마이 -> 장소 보기 -> 이전` 흐름에서 사용자가 기대하는 체감 복원이 충분한지 추가 검증 필요

관련 파일:
- [App.tsx](/D:/Code305/JamIssue/src/App.tsx)
- [useAppRouteState.ts](/D:/Code305/JamIssue/src/hooks/useAppRouteState.ts)
- [useScrollRestoration.ts](/D:/Code305/JamIssue/src/hooks/useScrollRestoration.ts)

### 3. 장소 이미지
- 스키마/API는 `map.image_url`까지 지원
- 장소 드로워에서도 이미지 노출 가능
- 하지만 실제 데이터는 아직 일부만 채워진 상태

## 미구현

### 1. 카카오 OAuth 실제 연결
- 타입/구조는 남아 있으나 실제 로그인 완료 플로우는 미구현

### 2. 관리자 전용 백오피스
- 관리자 플래그/기초 라우트는 있어도 독립 운영 백오피스는 없음

### 3. 신고/숨김/모더레이션
- PRD상 대비가 언급된 수준이지 실제 기능은 없음

### 4. 관측성/운영 모니터링
- 에러 모니터링, 운영 로그, 알림 체계 문서화/구현 미완료

## 현재 데이터/스키마 기준

### 스탬프
- `UNIQUE(user_id, position_id, stamp_date)`
- 방문 회차 = `visit_ordinal`
- 후기 작성 참조 = `feed.stamp_id`

### 여행 세션
- 직전 스탬프와의 차이가 24시간 이내면 같은 세션
- 초과하면 새 세션

### 장소 이미지
- `map.image_url` 사용

### 닉네임
- 현재는 유니크 제약 유지

## 현재 기준 검증 상태
- `npm.cmd run typecheck` 통과
- `npm.cmd run build` 통과
- 최신 프론트 변경은 `codex/production-deploy` 기준 Pages 배포로 확인 가능

## 관련 문서
- [screen-spec.md](/D:/Code305/JamIssue/docs/screen-spec.md)
- [community-routes.md](/D:/Code305/JamIssue/docs/community-routes.md)
- [account-identity-schema.md](/D:/Code305/JamIssue/docs/account-identity-schema.md)
- [growgardens-deploy-runbook.md](/D:/Code305/JamIssue/docs/growgardens-deploy-runbook.md)
