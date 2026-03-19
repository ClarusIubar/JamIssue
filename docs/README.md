# Docs Guide

JamIssue 문서는 아래 순서대로 보면 현재 구조를 가장 빠르게 파악할 수 있습니다.

## 1. 제품 기준

- [prd-compliance.md](/D:/Code305/JamIssue/docs/prd-compliance.md)
  - PRD 대비 현재 구현 수준과 최신 반영 사항
- [screen-spec.md](/D:/Code305/JamIssue/docs/screen-spec.md)
  - 화면 구조, 탭 규칙, 바텀 드로워 기준

## 2. 도메인 정책

- [community-routes.md](/D:/Code305/JamIssue/docs/community-routes.md)
  - 사용자 생성 경로 정책
- [account-identity-schema.md](/D:/Code305/JamIssue/docs/account-identity-schema.md)
  - 계정, identity, 삭제 규칙

## 3. 배포 및 런타임

- [growgardens-deploy-runbook.md](/D:/Code305/JamIssue/docs/growgardens-deploy-runbook.md)
  - Pages, Worker, Supabase 적용 순서
- [worker-first-poc.md](/D:/Code305/JamIssue/docs/worker-first-poc.md)
  - Worker가 직접 처리하는 API 범위

## 현재 기준 요약

- 하단 탭은 `지도 / 피드 / 코스 / 마이`
- `지도` 탭만 지도 + 바텀 드로워 구조
- `피드 / 코스 / 마이`는 별도 페이지형 레이아웃
- 스탬프는 `user_stamp` 로그 구조
- 후기 작성은 `stamp_id` 필수
- 24시간 기준으로 `travel_session` 을 나눠 코스를 묶음
- 사용자 생성 코스는 `travel_session_id` 기준
- 내부 계정 `user` 와 외부 로그인 `user_identity` 분리
- 같은 이메일 자동 병합 금지
