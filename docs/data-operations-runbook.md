# JamIssue 데이터 운영 가이드

기준 브랜치: `codex/production-deploy`

이 문서는 운영자가 장소/이미지/공공데이터를 추가, 수정, 삭제하거나 전체 데이터를 다시 넣어야 할 때 따라가는 기준 절차입니다.

## 1. 운영 원칙

- 운영 중 장소 데이터의 정본은 `public.map`입니다.
- 장소 이미지는 Supabase Storage `place-images` 버킷에 저장하고, DB에는 아래 두 컬럼으로 연결합니다.
  - `map.image_url`
  - `map.image_storage_path`
- 공공데이터 동기화는 `public_place`, `public_event` 계열을 갱신하지만, `map.is_manual_override = true` 인 장소는 덮어쓰지 않습니다.
- 단순 DB 데이터 수정만으로 해결되는 작업은 Worker/Pages 재배포가 필요 없습니다.
- 코드나 Worker 라우터를 바꾼 경우에만 재배포가 필요합니다.

## 2. 어떤 작업을 어디서 해야 하는가

### 관리자 탭에서 가능한 것

- 장소 노출/숨김
- 장소 수동 보호(`is_manual_override`) 토글
- 공공데이터 다시 불러오기

### SQL 또는 스크립트가 필요한 것

- 장소 신규 추가
- 장소 이름/카테고리/좌표/설명 수정
- 장소 삭제
- 장소 대표 이미지 교체
- 전체 데이터 초기화 후 재적재

## 3. 장소 데이터 추가 / 수정

### 3-1. 단건 수정

직접 `public.map`를 수정합니다.

예시:

```sql
update public.map
set
  name = '유림공원',
  category = 'attraction',
  longitude = 127.3570634,
  latitude = 36.3601462,
  summary = '도심 산책과 계절 풍경을 가볍게 즐기기 좋은 공원이에요.',
  description = '유림공원은 산책, 사진, 휴식 동선으로 묶기 좋은 대전 명소입니다.',
  updated_at = now()
where slug = '081-유림공원';
```

수정 시 권장 항목:
- `name`
- `district`
- `category`
- `longitude`
- `latitude`
- `summary`
- `description`
- `vibe_tags`
- `visit_time`
- `route_hint`
- `stamp_reward`
- `hero_label`
- `jam_color`
- `accent_color`
- `image_url`
- `image_storage_path`
- `is_active`

### 3-2. 신규 장소 추가

`public.map`에 `insert` 합니다.

필수에 가까운 컬럼:
- `slug`
- `name`
- `district`
- `category`
- `latitude`
- `longitude`
- `summary`
- `description`
- `image_storage_path`
- `vibe_tags`
- `visit_time`
- `route_hint`
- `stamp_reward`
- `hero_label`
- `jam_color`
- `accent_color`
- `is_active`

이미지까지 같이 붙일 경우:
- 먼저 Storage에 업로드
- 그 다음 `image_url`, `image_storage_path`를 함께 저장

## 4. 장소 삭제 / 숨김

### 4-1. 운영 중 임시 비노출

삭제보다 `is_active = false`를 우선 권장합니다.

```sql
update public.map
set is_active = false, updated_at = now()
where slug = '081-유림공원';
```

장점:
- 기존 피드/스탬프/댓글/코스 연결 데이터가 바로 깨지지 않음
- 필요하면 다시 노출 가능

### 4-2. 완전 삭제

완전 삭제는 연관 테이블까지 고려해야 합니다.

연관 가능 테이블:
- `user_stamp`
- `feed`
- `feed_like`
- `user_comment`
- `course_place`
- `user_route_place`
- `public_place_map_link`
- `public_event_map_link`

운영 중에는 완전 삭제보다 `비노출`을 권장합니다.

## 5. 장소 이미지 교체

### 5-1. 단건 교체 절차

1. 새 이미지를 `place-images` 버킷에 업로드
2. 경로를 정합니다. 권장 형식:
   - `places/081/hero.png`
3. 공개 URL을 만들고 `map.image_url`에 저장
4. 원본 키는 `map.image_storage_path`에 저장

예시:

```sql
update public.map
set
  image_url = 'https://<project-ref>.supabase.co/storage/v1/object/public/place-images/places/081/hero.png',
  image_storage_path = 'places/081/hero.png',
  updated_at = now()
where slug = '081-유림공원';
```

### 5-2. 샘플 디렉터리 기준 일괄 업로드

로컬 전용 `sample/` 입력 데이터를 쓸 때:

```powershell
cd D:/Code305/JamIssue
node scripts/generate-sample-place-data.mjs
$env:APP_SUPABASE_SERVICE_ROLE_KEY='<SUPABASE_SERVICE_ROLE_KEY>'
node scripts/upload-sample-place-images.mjs
```

이 스크립트는:
- `sample/` 기준 정본 JSON 생성
- `place-images` 버킷 업로드
- `map.image_url`, `map.image_storage_path` 갱신

주의:
- `sample/`은 Git 추적 대상이 아닌 로컬 입력 데이터입니다.

## 6. 공공데이터 동기화

공공데이터 재반영은 관리자 탭 또는 API로 실행할 수 있습니다.

API:
- `POST /api/admin/import/public-data`

동기화 대상:
- `public_place`
- `public_event`
- 관련 `*_map_link`

보호 규칙:
- `map.is_manual_override = true` 인 장소는 자동 sync가 덮어쓰지 않음

즉, 운영자가 수동 보정한 좌표/설명/노출 상태를 보호하려면 먼저 `수동 보호`를 켜야 합니다.

## 7. 전체 데이터 초기화 후 재적재

완전히 다시 넣어야 할 때는 아래 순서를 따릅니다.

1. [20260323_reset_all_app_data.sql](/D:/Code305/JamIssue/backend/sql/migrations/20260323_reset_all_app_data.sql)
2. [20260323_add_place_images_bucket.sql](/D:/Code305/JamIssue/backend/sql/migrations/20260323_add_place_images_bucket.sql)
3. [20260323_seed_sample_places.sql](/D:/Code305/JamIssue/backend/sql/migrations/20260323_seed_sample_places.sql)
4. 필요 시 [20260323_fix_hanbat_yurim_coordinates.sql](/D:/Code305/JamIssue/backend/sql/migrations/20260323_fix_hanbat_yurim_coordinates.sql)
5. 이미지 업로드 스크립트 실행

주의:
- 이 초기화는 사용자/스탬프/피드/댓글/코스까지 모두 비웁니다.

## 8. 운영 체크리스트

데이터 수정 후 확인:
- 앱에서 장소 카드가 열리는가
- 지도 마커 위치가 맞는가
- 장소 이미지가 보이는가
- 피드/스탬프/코스와 연결이 깨지지 않았는가
- 관리자 탭에서 노출/수동 보호 토글이 정상 동작하는가

필요 시 추가 확인:
- `GET /api/map-bootstrap`
- `GET /api/review-feed`
- `GET /api/community-routes`
- `GET /api/my/summary`

## 9. 권장 운영 방식

- 운영 중 개별 장소 수정: `public.map` 직접 수정 + 필요 시 수동 보호
- 대량 정본 교체: reset + seed + image upload
- 공공데이터 반영: 관리자 탭의 import 사용
- 삭제가 필요해 보여도, 실제론 `is_active = false`를 우선 고려
