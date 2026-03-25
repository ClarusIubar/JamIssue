# JamIssue Backend

JamIssue의 앱서버는 FastAPI 기반입니다.
로컬에서는 nginx가 `http://localhost:8000` 단일 진입점이 되고, FastAPI는 내부적으로 `8001`에서 동작합니다.

## 역할

- 장소, 후기, 댓글, 스탬프, 사용자 경로 API 제공
- 네이버 OAuth 로그인 처리
- 관리자 요약 API 제공
- 이미지 업로드 처리
- MySQL 기준 스키마와 데이터 무결성 유지

## 데이터베이스 기준

- 기본 드라이버: `mysql+pymysql`
- 로컬 기본 URL: `mysql+pymysql://jamissue:jamissue@127.0.0.1:3306/jamissue?charset=utf8mb4`
- 로컬 스키마: [schema.sql](D:/Code305/JamIssue/backend/sql/schema.sql)
- Supabase/Postgres 스키마: [supabase_schema.sql](D:/Code305/JamIssue/backend/sql/supabase_schema.sql)

## 실행 방식

현재 로컬 실행은 `run_appserver.py` 기준입니다. 기본 Python 3.14에서 `backend/.venv/Lib/site-packages`를 참조하도록 구성해 두었습니다.

준비:

1. [backend/.env.example](D:/Code305/JamIssue/backend/.env.example)를 `backend/.env`로 복사
2. Python 3.14 준비
3. `backend/.venv/Lib/site-packages`에 의존성 설치

예시:

```powershell
C:/Users/PC/AppData/Local/Programs/Python/Python314/python.exe -m pip install -r D:/Code305/JamIssue/backend/requirements.local.txt --target D:/Code305/JamIssue/backend/.venv/Lib/site-packages
```

직접 실행:

```powershell
C:/Users/PC/AppData/Local/Programs/Python/Python314/python.exe D:/Code305/JamIssue/backend/run_appserver.py
```

일반적으로는 저장소 루트에서 아래 스크립트를 권장합니다.

```powershell
powershell -ExecutionPolicy Bypass -File D:/Code305/JamIssue/scripts/dev.ps1 start
```

## 계정/삭제 규칙

핵심 규칙은 [docs/account-identity-schema.md](D:/Code305/JamIssue/docs/account-identity-schema.md)에 정리되어 있습니다.

요약:
- 내부 고유 계정 ID는 `user.user_id`
- 네이버/카카오 외부 식별자는 `user_identity`
- 같은 이메일이면 하나의 내부 계정으로 연결 가능
- 회원 탈퇴 시 `user_id` 기준으로 후기, 댓글, 스탬프, 추천 경로 정리
- 댓글 직접 삭제는 soft delete, 피드 삭제는 댓글까지 정리

## 주요 API

- `GET /api/health`
- `GET /api/auth/me`
- `GET /api/auth/providers`
- `GET /api/auth/naver/login`
- `GET /api/auth/naver/callback`
- `POST /api/auth/logout`
- `GET /api/bootstrap`
- `GET /api/places`
- `GET /api/courses`
- `GET /api/community-routes`
- `POST /api/community-routes`
- `POST /api/community-routes/{route_id}/like`
- `DELETE /api/community-routes/{route_id}`
- `GET /api/reviews`
- `POST /api/reviews`
- `DELETE /api/reviews/{review_id}`
- `GET /api/reviews/{review_id}/comments`
- `POST /api/reviews/{review_id}/comments`
- `DELETE /api/reviews/{review_id}/comments/{comment_id}`
- `POST /api/reviews/upload`
- `GET /api/my/summary`
- `DELETE /api/my/account`
- `GET /api/stamps`
- `POST /api/stamps/toggle`
- `GET /api/admin/summary`
- `PATCH /api/admin/places/{place_id}`
- `POST /api/admin/import/public-data`
- `POST /api/internal/public-events/import`

## 테스트

```powershell
cd D:/Code305/JamIssue/backend
.\.venv\Scripts\python.exe -m pytest tests
```
