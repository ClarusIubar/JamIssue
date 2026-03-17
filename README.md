# JamIssue

???愿愿?紐⑤컮???뱀빋?낅땲?? ??釉뚮옖移섎뒗 `worker-first` 諛고룷 ?ㅽ뿕 釉뚮옖移섏씠怨? 濡쒖뺄 諛깆뿏???덊띁?곗뒪濡쒕뒗 `FastAPI + SQLAlchemy` 援ъ“瑜?怨꾩냽 ?좎??⑸땲??

## ?꾩옱 湲곗?

- ?꾩옱 釉뚮옖移? `codex/worker-first-poc`
- ?꾨줎???꾨찓?? `https://jamissue.growgardens.app`
- API ?꾨찓?? `https://api.jamissue.growgardens.app`
- ?꾩옱 諛고룷 異? `Cloudflare Pages + Cloudflare Worker + Supabase`
- 濡쒖뺄/?덊띁?곗뒪 異? `FastAPI + SQLAlchemy + Supabase`

利? 諛고룷??Worker 湲곗??쇰줈 蹂닿퀬 ?덇퀬, ? ?꾪궎?띿쿂 ?덊띁?곗뒪??FastAPI 肄붾뱶濡??좎??섎뒗 ?곹깭?낅땲??

## ?듭떖 湲곕뒫

- 吏??以묒떖 ?먯깋
- 諛⑸Ц ?ㅽ꺃???곷┰
- 諛⑸Ц 利앸챸 湲곕컲 ?꾧린 ?묒꽦
- ?볤? / ?꾧린 醫뗭븘??- ?ъ슜???앹꽦 異붿쿇 寃쎈줈
- ?ㅼ씠踰?濡쒓렇??- 留덉씠?섏씠吏 ?듦퀎

## ?곗씠???뺢퇋??湲곗?

### 1. ?ㅽ꺃?꾨뒗 濡쒓렇??
`user_stamp` ???⑥닚??諛⑸Ц ?щ? ?뚯씠釉붿씠 ?꾨땲??諛⑸Ц 濡쒓렇?낅땲??

- 媛숈? ?μ냼?쇰룄 ?좎쭨媛 ?ㅻⅤ硫??ㅼ떆 ?곷┰ 媛??- 媛숈? ?좎쭨?먮뒗 ???μ냼????踰덈쭔 ?곷┰
- `visit_ordinal` 濡?`2踰덉㎏ 諛⑸Ц` 媛숈? ?쒖떆 媛??
### 2. ?곗냽 諛⑸Ц? ?몄뀡?쇰줈 臾띕뒗??
`travel_session` ? ?ㅽ꺃??濡쒓렇瑜?臾띕뒗 ?ы뻾 ?⑥쐞?낅땲??

- 吏곸쟾 ?ㅽ꺃?꾩? 24?쒓컙 ?대궡硫?媛숈? ?몄뀡
- 24?쒓컙 珥덇낵硫????몄뀡

### 3. ?꾧린 ?묒꽦? 諛⑸Ц 利앸챸???꾩슂?섎떎

`feed` ??諛섎뱶??`stamp_id` 瑜?媛吏묐땲??

- ?⑥닚 GPS 吏꾩엯留뚯쑝濡??꾧린 ?묒꽦 遺덇?
- ?ㅼ젣濡??곷┰???ㅽ꺃?꾧? ?덉뼱???꾧린 ?묒꽦 媛??- ?꾧린 移대뱶??n踰덉㎏ 諛⑸Ц 臾멸뎄瑜??쒖떆?????덉쓬

### 4. 異붿쿇 寃쎈줈???ъ슜???앺깭怨꾨? ?곗꽑?쒕떎

`user_route` ??媛쒕컻???먮젅?댁뀡 肄붿뒪? ?ъ슜???앹꽦 寃쎈줈瑜?媛숈씠 ?대릺, `is_user_generated` 濡?援щ텇?⑸땲??

?꾨줈?앺듃 ?먯튃:

`?ъ슜?먭? ?ㅼ젣 諛⑸Ц???ㅽ꺃??湲곕컲 ?숈꽑??怨듦컻 寃쎈줈濡?諛쒗뻾?섍퀬, ?ㅻⅨ ?ъ슜?먮뒗 醫뗭븘?붿닚/理쒖떊?쒖쑝濡?洹?寃쎈줈瑜??먯깋?????덉뼱???쒕떎.`

?곸슜 洹쒖튃:

- ?ㅼ젣濡??ㅽ꺃?꾨? 李띿? ?μ냼留?寃쎈줈???ы븿 媛??- 理쒖냼 2怨??댁긽?댁뼱??寃쎈줈 諛쒗뻾 媛??- ?뺣젹? `醫뗭븘?붿닚(popular)` / `理쒖떊??latest)`
- ?댁쁺??肄붿뒪??珥덇린 ?먮젅?댁뀡 ?⑸룄

### 5. 怨꾩젙怨?濡쒓렇???쒓났?먮뒗 遺꾨━?쒕떎

- ?대? 怨꾩젙 ?앸퀎?? `user.user_id`
- ?몃? 濡쒓렇???앸퀎?? `user_identity`
- 媛숈? ?대찓???먮룞 蹂묓빀 ?놁쓬
- ?됰꽕??以묐났 ?덉슜

## ?꾩옱 諛고룷 援ъ“

```text
Frontend
-> Cloudflare Pages

API
-> Cloudflare Worker
-> Supabase REST / Storage

Reference Backend
-> FastAPI
-> SQLAlchemy
-> Supabase
```

## ?꾩옱 Worker媛 吏곸젒 泥섎━?섎뒗 API

- `GET /api/health`
- `GET /api/auth/providers`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/auth/naver/login`
- `GET /api/auth/naver/callback`
- `GET /api/bootstrap`
- `GET /api/reviews`
- `POST /api/reviews/upload`
- `POST /api/reviews`
- `GET /api/reviews/:reviewId/comments`
- `POST /api/reviews/:reviewId/comments`
- `POST /api/reviews/:reviewId/like`
- `POST /api/stamps/toggle`
- `GET /api/community-routes`
- `POST /api/community-routes`
- `POST /api/community-routes/:routeId/like`
- `GET /api/my/routes`
- `GET /api/my/summary`
- `GET /api/banner/events`

## Cloudflare Pages 媛?
?꾨줈?앺듃: `jamissue-web`

```env
PUBLIC_APP_BASE_URL=https://api.jamissue.growgardens.app
PUBLIC_NAVER_MAP_CLIENT_ID=<?ㅼ씠踰?吏??Dynamic Map Client ID>
```

?ㅻ챸:

- `PUBLIC_APP_BASE_URL`
  - ?꾨줎?멸? ?몄텧??API 二쇱냼
- `PUBLIC_NAVER_MAP_CLIENT_ID`
  - ?ㅼ씠踰?吏?꾩슜 ??  - 濡쒓렇???ㅼ? ?ㅻ쫫

## Cloudflare Worker Variables

?꾨줈?앺듃: `jamissue-api`

```env
APP_ENV=worker-first
APP_SESSION_HTTPS=true
APP_FRONTEND_URL=https://jamissue.growgardens.app
APP_CORS_ORIGINS=https://jamissue.growgardens.app
APP_NAVER_LOGIN_CALLBACK_URL=https://api.jamissue.growgardens.app/api/auth/naver/callback
APP_STORAGE_BACKEND=supabase
APP_SUPABASE_URL=https://ifofgcaqrgtiurzqhiyy.supabase.co
APP_SUPABASE_STORAGE_BUCKET=review-images
APP_STAMP_UNLOCK_RADIUS_METERS=120
APP_ORIGIN_API_URL=
```

?ㅻ챸:

- `APP_FRONTEND_URL`: 濡쒓렇???꾨즺 ???섎룎由??꾨줎??二쇱냼
- `APP_CORS_ORIGINS`: 釉뚮씪?곗??먯꽌 ?덉슜??origin
- `APP_NAVER_LOGIN_CALLBACK_URL`: ?ㅼ씠踰?濡쒓렇??callback 二쇱냼
- `APP_STORAGE_BACKEND`: ?꾩옱??`supabase`
- `APP_SUPABASE_URL`: Supabase ?꾨줈?앺듃 URL
- `APP_SUPABASE_STORAGE_BUCKET`: ?꾧린 ?대?吏 踰꾪궥
- `APP_STAMP_UNLOCK_RADIUS_METERS`: 諛섍꼍 ?쒗븳
- `APP_ORIGIN_API_URL`: Worker媛 ?꾩쭅 吏곸젒 泥섎━?섏? ?딅뒗 API瑜?FastAPI origin???섍만 ?뚮쭔 ?ъ슜

## Cloudflare Worker Secrets

?꾨줈?앺듃: `jamissue-api`

```env
APP_SESSION_SECRET=<?쒕뜡 64???댁긽>
APP_JWT_SECRET=<?쒕뜡 64???댁긽>
APP_DATABASE_URL=postgres://postgres.<project-ref>:<DB_PASSWORD>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
APP_SUPABASE_SERVICE_ROLE_KEY=<Supabase service_role key>
APP_NAVER_LOGIN_CLIENT_ID=<?ㅼ씠踰?濡쒓렇??Client ID>
APP_NAVER_LOGIN_CLIENT_SECRET=<?ㅼ씠踰?濡쒓렇??Client Secret>
```

?ㅻ챸:

- `APP_SESSION_SECRET`: ?몄뀡 荑좏궎 ?쒕챸??- `APP_JWT_SECRET`: JWT ?쒕챸??- `APP_DATABASE_URL`: Supabase Postgres transaction pooler 二쇱냼
- `APP_SUPABASE_SERVICE_ROLE_KEY`: ?쒕쾭 沅뚰븳??Supabase ??- `APP_NAVER_LOGIN_CLIENT_ID`: ?ㅼ씠踰?濡쒓렇????- `APP_NAVER_LOGIN_CLIENT_SECRET`: ?ㅼ씠踰?濡쒓렇???쒗겕由?
## Supabase ?곸슜 ?쒖꽌

SQL Editor?먯꽌 ?꾨옒 ?쒖꽌濡??ㅽ뻾?⑸땲??

1. [backend/sql/supabase_schema.sql](/D:/Code305/JamIssue/backend/sql/supabase_schema.sql)
2. [backend/sql/supabase_seed.sql](/D:/Code305/JamIssue/backend/sql/supabase_seed.sql)
3. [backend/sql/supabase_storage.sql](/D:/Code305/JamIssue/backend/sql/supabase_storage.sql)

異붽? 留덉씠洹몃젅?댁뀡???꾩슂?섎㈃:

4. [backend/sql/migrations/20260318_stamp_session_refactor.sql](/D:/Code305/JamIssue/backend/sql/migrations/20260318_stamp_session_refactor.sql)

## ?ㅼ씠踰?媛쒕컻?먯꽱??媛?
- ?쒕퉬??URL: `https://jamissue.growgardens.app`
- Callback URL: `https://api.jamissue.growgardens.app/api/auth/naver/callback`

## 濡쒖뺄 ?먭? 紐낅졊

?꾨줎????낆껜??

```powershell
cd D:/Code305/JamIssue
npm.cmd run typecheck
```

?꾨줎??鍮뚮뱶:

```powershell
cd D:/Code305/JamIssue
npm.cmd run build
```

諛깆뿏???뚯뒪??

```powershell
cd D:/Code305/JamIssue/backend
.\.venv\Scripts\python.exe -m pytest tests
```

## 臾몄꽌

- [docs/README.md](/D:/Code305/JamIssue/docs/README.md)
- [docs/prd-compliance.md](/D:/Code305/JamIssue/docs/prd-compliance.md)
- [docs/community-routes.md](/D:/Code305/JamIssue/docs/community-routes.md)
- [docs/account-identity-schema.md](/D:/Code305/JamIssue/docs/account-identity-schema.md)
- [docs/worker-first-poc.md](/D:/Code305/JamIssue/docs/worker-first-poc.md)
- [docs/growgardens-deploy-runbook.md](/D:/Code305/JamIssue/docs/growgardens-deploy-runbook.md)

## 배포 브랜치 운영

- production 배포 브랜치: codex/production-deploy`r
- 기능 작업은 별도 브랜치에서 진행한 뒤 codex/production-deploy로 PR/merge
- merge 후 GitHub Actions가 프론트 Pages와 API Worker를 함께 production 배포
- Pages는 production 브랜치 슬롯으로, Worker는 jamissue-api custom domain으로 배포
