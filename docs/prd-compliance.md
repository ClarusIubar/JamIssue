# JamIssue PRD 대비 구현 체크

기준일: 2026-03-18
기준 브랜치: `codex/worker-first-poc`

이 문서는 현재 저장소 기준으로 PRD 핵심 요구가 어디까지 반영됐는지 짧게 점검하는 문서입니다.

## 현재 완료된 핵심

- 지도 중심 탐색 구조 유지
- 후기 / 댓글 / 좋아요 흐름 존재
- 현장 반경 검증 후 스탬프 적립
- 스탬프를 단순 Boolean이 아니라 `user_stamp` 로그로 저장
- 같은 장소라도 날짜가 다르면 다시 스탬프 획득 가능
- 스탬프 간 간격이 24시간 이내면 같은 `travel_session` 으로 묶음
- 후기 작성 시 `stamp_id` 필수 검증
- 사용자 생성 경로를 `travel_session_id` 기준으로 발행
- 경로 정렬 `좋아요순(popular)` / `최신순(latest)`
- 마이페이지에서 고유 방문 장소 수 / 누적 스탬프 수 분리
- `user` 와 `user_identity` 분리, 같은 이메일 자동 병합 금지
- 닉네임 중복 허용 구조 유지
- 회원 탈퇴 시 `user_id` 기준 정리 규칙 반영
- 댓글 삭제는 soft delete, 대댓글 문맥 유지
- 피드 삭제 시 댓글/좋아요 정리

## 이번 턴에서 정리된 데이터 규칙

### 1. 스탬프 로그
- `user_stamp` 는 방문 로그 테이블로 동작
- `UNIQUE(user_id, position_id, stamp_date)`
- 같은 장소라도 날짜가 다르면 재방문 허용
- `visit_ordinal` 로 `n번째 방문` 표시 가능

### 2. 여행 세션
- `travel_session` 이 24시간 룰의 기준
- 직전 스탬프와 다음 스탬프 차이가 24시간 이내면 같은 세션
- 24시간 초과 시 새로운 세션 생성

### 3. 후기 작성 권한
- 후기 작성은 단순 GPS 진입만으로는 불가
- 반드시 해당 장소에 대해 획득한 `stamp_id` 가 있어야 함
- `feed.position_id` 와 `user_stamp.position_id` 일치 검증

### 4. 사용자 생성 코스
- `user_route.travel_session_id` 기준으로 발행
- 같은 세션으로는 중복 발행 차단
- 세션 안의 스탬프 순서대로 장소를 자동 묶음

## 부분 구현 또는 후속 작업

- 바텀 시트 중심 UI 전면 개편은 계속 진행 중
- 카카오 OAuth 실제 로그인 흐름은 아직 미완료
- 관리자 기능은 요약/노출 제어 수준
- 실시간 공공 API 정식 연동은 아직 미완료
- 모바일 실기기 QA 문서는 보강 필요

## 검증 상태

- `backend/.venv/Scripts/python.exe -m pytest tests` 통과 (`24 passed`)
- `npm.cmd run typecheck` 통과
- `npm.cmd run build` 통과

## 관련 문서

- [docs/community-routes.md](/D:/Code305/JamIssue/docs/community-routes.md)
- [docs/account-identity-schema.md](/D:/Code305/JamIssue/docs/account-identity-schema.md)
- [README.md](/D:/Code305/JamIssue/README.md)
