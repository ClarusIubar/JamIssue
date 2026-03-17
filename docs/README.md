# Docs Guide

JamIssue 문서는 아래 4개를 기준으로 봅니다.

- `prd-compliance.md`
  - 현재 구현이 PRD와 어디까지 맞는지 체크
- `community-routes.md`
  - 사용자 생성 경로 정책과 정렬/제약 정리
- `account-identity-schema.md`
  - `user` / `user_identity` / 삭제 규칙 정리
- `growgardens-deploy-runbook.md`
  - 현재 배포/환경변수/도메인 정리

## 2026-03-18 기준 핵심 변경

- 스탬프는 단순 상태값이 아니라 `user_stamp` 로그로 기록
- 같은 장소라도 날짜가 다르면 다시 스탬프 획득 가능
- 24시간 이내 스탬프는 같은 `travel_session` 으로 묶음
- 후기 작성은 반드시 해당 장소의 `stamp_id` 를 가져야 함
- 사용자 생성 코스는 `travel_session_id` 기준으로 발행
- 내부 계정 `user_id` 와 외부 로그인 `user_identity` 분리
- 닉네임은 중복 허용, 같은 이메일 자동 병합 금지
