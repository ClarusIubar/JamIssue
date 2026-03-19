# JamIssue PRD 대비 구현 체크

기준일: 2026-03-19  
기준 브랜치: `codex/production-deploy` (`550a92b`)  
검증 상태: `npm run typecheck`, `npm run build` 통과

이 문서는 현재 저장소 기준으로 PRD 요구사항이 어디까지 반영됐는지와,
`fetch --all` 이후 확인한 최신 개선 사항이 무엇인지 함께 정리하는 기준 문서입니다.

## 이번 fetch 이후 확인된 최신 반영

최근 원격 `codex/production-deploy`에는 아래 흐름이 추가 반영되어 있음을 확인했습니다.

- 브라우저 뒤로가기/탭 전환 시 상태 보존 강화
  - 지도 상세를 열고 뒤로 가면 이전 탭이나 이전 상태로 복귀하는 흐름 보강
- 피드 스크롤 복원 추가
  - 피드 탭에서 상세/댓글을 보고 돌아와도 읽던 위치를 보존하는 훅 추가
- 댓글 UI 구조 개선
  - 댓글 2단 깊이 제한
  - depth-1 댓글에서는 답글 버튼/폼 숨김
  - 피드 전용 댓글 시트 도입
- 피드 중심 UI 정리
  - 댓글을 카드 본문 아래에 늘어놓는 대신 시트형으로 분리
- 마이페이지/지도/피드 일부 스타일 조정

관련 주요 파일:
- [App.tsx](/D:/Code305/JamIssue/src/App.tsx)
- [FeedTab.tsx](/D:/Code305/JamIssue/src/components/FeedTab.tsx)
- [ReviewList.tsx](/D:/Code305/JamIssue/src/components/ReviewList.tsx)
- [CommentThread.tsx](/D:/Code305/JamIssue/src/components/CommentThread.tsx)
- [FeedCommentSheet.tsx](/D:/Code305/JamIssue/src/components/FeedCommentSheet.tsx)
- [MyPagePanel.tsx](/D:/Code305/JamIssue/src/components/MyPagePanel.tsx)
- [NaverMap.tsx](/D:/Code305/JamIssue/src/components/NaverMap.tsx)
- [useAppRouteState.ts](/D:/Code305/JamIssue/src/hooks/useAppRouteState.ts)
- [useScrollRestoration.ts](/D:/Code305/JamIssue/src/hooks/useScrollRestoration.ts)

## 완료된 항목

### 1. 핵심 정보 구조
- 하단 탭 `지도 / 피드 / 코스 / 마이`
- `지도` 탭 전용 장소 드로워 구조
- `피드 / 코스 / 마이`는 지도 배경을 공유하지 않는 별도 페이지형 레이아웃
- 축제 정보 레이어 추가
  - 대전 한정
  - 진행 중 + 30일 이내 예정 행사

### 2. 방문 증명과 스탬프
- 스탬프 적립 반경 검증
- `user_stamp` 로그 기반 반복 방문
- 같은 장소 재방문 시 `n번째 방문` 계산
- 스탬프 간격 24시간 기준 `travel_session` 분리
- 후기 작성 시 `stamp_id` 필수 검증
- 사용자 생성 경로를 `travel_session_id` 기준으로 발행
- 경로 정렬 `좋아요순(popular)` / `최신순(latest)`

### 3. 마이페이지와 계정 구조
- 마이페이지 통계 분리
  - 고유 방문 장소 수
  - 누적 스탬프 수
- `user` 와 `user_identity` 분리
- 같은 이메일 자동 병합 금지
- 닉네임 중복 허용
- 회원 탈퇴 시 `user_id` 기준 정리 규칙 반영

### 4. 댓글/피드 도메인 규칙
- 댓글 soft delete, 부모 삭제 후 대댓글 유지
- 피드 삭제 시 댓글/좋아요 정리
- 댓글 깊이 2단 제한
- depth-1 댓글 답글 UI 차단
- 피드 댓글 시트 분리
- 피드 탭 스크롤 복원 추가

## 부분 완료 항목

### 1. 지도 탭 UX 완성도
PRD의 큰 방향은 반영되어 있으나, 시각 완성도는 여전히 부족합니다.

반영된 것:
- 지도 탭 전용 레이아웃
- 장소 상세 바텀 드로워
- 축제 정보 시트 분리
- 브라우저 뒤로가기 상태 연결

남은 것:
- 상단 카드/필터/지도 카드 비율 재정리
- 드로워 조형과 버튼 스타일 정제
- 프로토타입 대비 감성/UI 밀도 보정

### 2. 인증
- 네이버 로그인 동작
- 닉네임 수정 단계 반영
- 카카오는 구조만 있고 실제 OAuth는 아직 미구현

### 3. 운영 기능
- 관리자 성격의 최소 구조는 있으나, 독립 백오피스로 분리된 상태는 아님

### 4. 공공데이터
- 축제 API 연동 구조와 동기화는 반영
- 추가 공공데이터 소스 확장은 미완료

## 미완료 항목

- 카카오 OAuth 실제 연결
- 관리자 전용 백오피스 분리
- 모바일 QA 문서와 검수 결과 체계화
- 관측성/모니터링 문서 정리
- 지도 탭 프로토타입 재현도 마감

## 현재 데이터 규칙

### 스탬프
- `user_stamp` 는 방문 로그 테이블
- `UNIQUE(user_id, position_id, stamp_date)`
- 같은 장소라도 날짜가 다르면 재방문 허용
- `visit_ordinal` 로 방문 회차 표시

### 여행 세션
- 직전 스탬프와 다음 스탬프 차이가 24시간 이내면 같은 `travel_session`
- 24시간 초과 시 새 세션 생성

### 후기 작성
- `stamp_id` 없는 후기 작성 불가
- `feed.position_id` 와 `user_stamp.position_id` 일치 검증

### 사용자 생성 코스
- `travel_session_id` 기준으로만 발행
- 같은 세션으로 중복 발행 불가
- 세션 안의 스탬프 순서대로 장소를 묶음

## 최신 코드 기준에서 눈에 띄는 이슈

- [FeedCommentSheet.tsx](/D:/Code305/JamIssue/src/components/FeedCommentSheet.tsx)
  - 최근 머지 이후 일부 문자열이 깨져 있음
  - `aria-label`, 닫기 버튼 글리프, 메타 구분자 재정리 필요
- `team/main` 은 현재 최신 `codex/production-deploy` 보다 뒤처져 있음
  - 필요 시 최신 상태를 다시 팀 저장소에 반영해야 함
- 작업 루트에 임시 파일이 남아 있음
  - `tmp_alias_main.js`
  - `tmp_live_main.js`

## 검증 상태

- `npm.cmd run typecheck` 통과
- `npm.cmd run build` 통과
- 최신 fetch 이후에도 프론트 빌드 정상

## 관련 문서

- [community-routes.md](/D:/Code305/JamIssue/docs/community-routes.md)
- [account-identity-schema.md](/D:/Code305/JamIssue/docs/account-identity-schema.md)
- [screen-spec.md](/D:/Code305/JamIssue/docs/screen-spec.md)
- [README.md](/D:/Code305/JamIssue/README.md)
