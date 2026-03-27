const PROVIDERS = [
  { key: 'naver', label: '네이버' },
  { key: 'kakao', label: '카카오' },
];

const BADGE_BY_MOOD = {
  '설렘': '첫 방문',
  '친구랑': '친구 추천',
  '혼자서': '로컬 탐방',
  '데이트': '데이트 코스',
  '야경 맛집': '야경 성공',
};

const SESSION_COOKIE_NAME = 'jamissue_worker_session';
const OAUTH_STATE_COOKIE_NAME = 'jamissue_worker_oauth_state';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10;
const NAVER_AUTHORIZE_URL = 'https://nid.naver.com/oauth2.0/authorize';
const NAVER_TOKEN_URL = 'https://nid.naver.com/oauth2.0/token';
const NAVER_PROFILE_URL = 'https://openapi.naver.com/v1/nid/me';
const textEncoder = new TextEncoder();
const STATIC_BASE_CACHE_TTL_MS = 5 * 60 * 1000;
const FESTIVALS_CACHE_TTL_MS = 10 * 60 * 1000;
let staticBaseCache = { expiresAt: 0, value: null, pending: null };
let festivalsCache = { expiresAt: 0, syncAt: 0, value: null, pending: null };

function jsonResponse(status, payload, env, request, extraHeaders = {}) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders,
  });
  applyCorsHeaders(headers, env, request);
  return new Response(JSON.stringify(payload), { status, headers });
}

function redirectResponse(location, env, request, cookies = []) {
  const headers = new Headers({
    location,
    'cache-control': 'no-store',
  });
  applyCorsHeaders(headers, env, request);
  for (const cookie of cookies) {
    headers.append('set-cookie', cookie);
  }
  return new Response(null, { status: 302, headers });
}

function applyCorsHeaders(headers, env, request) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = (env.APP_CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const fallbackOrigin = env.APP_FRONTEND_URL ?? '*';
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : fallbackOrigin;
  headers.set('Access-Control-Allow-Origin', allowOrigin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Headers', 'content-type, authorization');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  headers.set('Vary', 'Origin');
}

function handlePreflight(env, request) {
  const headers = new Headers();
  applyCorsHeaders(headers, env, request);
  return new Response(null, { status: 204, headers });
}

function getSupabaseKey(env) {
  return env.APP_SUPABASE_SERVICE_ROLE_KEY || env.APP_SUPABASE_ANON_KEY || '';
}

async function supabaseRequest(env, path, init = {}) {
  if (!env.APP_SUPABASE_URL) {
    throw new Error('APP_SUPABASE_URL is empty.');
  }

  const apiKey = getSupabaseKey(env);
  if (!apiKey) {
    throw new Error('Supabase API key is missing.');
  }

  const headers = new Headers(init.headers || undefined);
  headers.set('apikey', apiKey);
  headers.set('Authorization', `Bearer ${apiKey}`);
  headers.set('Accept', 'application/json');

  const method = init.method ?? 'GET';
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (method !== 'GET' && method !== 'HEAD' && !headers.has('Prefer')) {
    headers.set('Prefer', 'return=representation');
  }

  const response = await fetch(`${env.APP_SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: init.body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${detail}`);
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('application/json') ? JSON.parse(text) : text;
}

function encodeFilterValue(value) {
  return encodeURIComponent(String(value));
}

function parseListLimit(url, defaultLimit = 12, maxLimit = 24) {
  const raw = Number(url.searchParams.get('limit') ?? defaultLimit);
  if (!Number.isFinite(raw) || raw <= 0) {
    return defaultLimit;
  }
  return Math.min(Math.floor(raw), maxLimit);
}

function uniqueValues(values) {
  return [...new Set((values ?? []).filter((value) => value !== null && value !== undefined && value !== ''))];
}

function buildInFilter(values) {
  const unique = uniqueValues(values);
  if (unique.length === 0) {
    return null;
  }
  return `in.(${unique.map((value) => encodeFilterValue(value)).join(',')})`;
}

async function rememberPending(cacheState, loader) {
  if (cacheState.pending) {
    return cacheState.pending;
  }
  cacheState.pending = loader().finally(() => {
    cacheState.pending = null;
  });
  return cacheState.pending;
}

function formatDateTime(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  }).format(date);
}

function formatDate(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  }).format(date);
}

function toSeoulDateKey(value = null) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);
}

function isFestivalOngoingInSeoul(startsAt, endsAt, nowValue = Date.now()) {
  if (!startsAt || !endsAt) {
    return false;
  }
  const startDateKey = toSeoulDateKey(startsAt);
  const endDateKey = toSeoulDateKey(endsAt);
  const nowDateKey = toSeoulDateKey(nowValue);
  return startDateKey <= nowDateKey && endDateKey >= nowDateKey;
}

function normalizeFestivalSeriesKeyPart(value) {
  return String(value || "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[&_·/|]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .toLowerCase();
}

function buildFestivalSeriesKey(row) {
  return [
    normalizeFestivalSeriesKeyPart(row.title),
    normalizeFestivalSeriesKeyPart(row.venue_name ?? row.road_address ?? row.address ?? ""),
  ].join("|");
}

function parseSeoulDateKey(dateKey) {
  return new Date(`${dateKey}T00:00:00+09:00`);
}

function areFestivalSeriesDatesAdjacent(leftEnd, rightStart) {
  const leftKey = toSeoulDateKey(leftEnd);
  const rightKey = toSeoulDateKey(rightStart);
  if (!leftKey || !rightKey) {
    return false;
  }
  const nextDate = parseSeoulDateKey(leftKey);
  nextDate.setDate(nextDate.getDate() + 1);
  return parseSeoulDateKey(rightKey).getTime() <= nextDate.getTime();
}

function areFestivalSeriesPeriodsMergeable(leftRow, rightRow) {
  const leftStartTime = new Date(leftRow.starts_at).getTime();
  const leftEndTime = new Date(leftRow.ends_at).getTime();
  const rightStartTime = new Date(rightRow.starts_at).getTime();
  const rightEndTime = new Date(rightRow.ends_at).getTime();
  if (!Number.isFinite(leftStartTime) || !Number.isFinite(leftEndTime) || !Number.isFinite(rightStartTime) || !Number.isFinite(rightEndTime)) {
    return false;
  }
  if (rightStartTime <= leftEndTime && rightEndTime >= leftStartTime) {
    return true;
  }
  return areFestivalSeriesDatesAdjacent(leftRow.ends_at, rightRow.starts_at);
}

function buildImportedFestivalSeriesKey(item) {
  return [
    normalizeFestivalSeriesKeyPart(item.title),
    normalizeFestivalSeriesKeyPart(item.venueName ?? item.roadAddress ?? item.address ?? ""),
  ].join("|");
}

function areImportedFestivalSeriesPeriodsMergeable(leftItem, rightItem) {
  const leftStartTime = new Date(leftItem.startsAt).getTime();
  const leftEndTime = new Date(leftItem.endsAt).getTime();
  const rightStartTime = new Date(rightItem.startsAt).getTime();
  const rightEndTime = new Date(rightItem.endsAt).getTime();
  if (!Number.isFinite(leftStartTime) || !Number.isFinite(leftEndTime) || !Number.isFinite(rightStartTime) || !Number.isFinite(rightEndTime)) {
    return false;
  }
  if (rightStartTime <= leftEndTime && rightEndTime >= leftStartTime) {
    return true;
  }
  return areFestivalSeriesDatesAdjacent(leftItem.endsAt, rightItem.startsAt);
}

function mergeImportedFestivalItems(items) {
  const sorted = [...items].sort((left, right) => {
    const startDiff = new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
    if (startDiff !== 0) {
      return startDiff;
    }
    return String(left.title || "").localeCompare(String(right.title || ""), "ko");
  });

  return sorted.reduce((acc, item) => {
    const previous = acc[acc.length - 1];
    if (
      previous &&
      buildImportedFestivalSeriesKey(previous) === buildImportedFestivalSeriesKey(item) &&
      areImportedFestivalSeriesPeriodsMergeable(previous, item)
    ) {
      if (new Date(item.endsAt).getTime() > new Date(previous.endsAt).getTime()) {
        previous.endsAt = item.endsAt;
      }
      if (!previous.summary && item.summary) {
        previous.summary = item.summary;
      }
      if (!previous.homepageUrl && item.homepageUrl) {
        previous.homepageUrl = item.homepageUrl;
      }
      if (!previous.roadAddress && item.roadAddress) {
        previous.roadAddress = item.roadAddress;
      }
      if (!previous.address && item.address) {
        previous.address = item.address;
      }
      if ((!Number.isFinite(Number(previous.latitude)) || !Number.isFinite(Number(previous.longitude))) && Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))) {
        previous.latitude = item.latitude;
        previous.longitude = item.longitude;
      }
      previous.rawPayload = {
        ...(previous.rawPayload || {}),
        mergedExternalIds: [...new Set([...(previous.rawPayload?.mergedExternalIds || [previous.externalId].filter(Boolean)), item.externalId].filter(Boolean))],
      };
      previous.externalId = createFestivalExternalId(
        previous.title,
        new Date(previous.startsAt),
        previous.venueName ?? null,
        previous.roadAddress ?? previous.address ?? null,
      );
      return acc;
    }
    acc.push({
      ...item,
      externalId: createFestivalExternalId(
        item.title,
        new Date(item.startsAt),
        item.venueName ?? null,
        item.roadAddress ?? item.address ?? null,
      ),
      rawPayload: {
        ...(item.rawPayload || {}),
        mergedExternalIds: [item.externalId].filter(Boolean),
      },
    });
    return acc;
  }, []);
}

function deduplicateImportedFestivalItemsByExternalId(items) {
  const grouped = new Map();
  for (const item of items) {
    const key = String(item.externalId || "");
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...item });
      continue;
    }
    if (new Date(item.startsAt).getTime() < new Date(existing.startsAt).getTime()) {
      existing.startsAt = item.startsAt;
    }
    if (new Date(item.endsAt).getTime() > new Date(existing.endsAt).getTime()) {
      existing.endsAt = item.endsAt;
    }
    if (!existing.summary && item.summary) {
      existing.summary = item.summary;
    }
    if (!existing.homepageUrl && item.homepageUrl) {
      existing.homepageUrl = item.homepageUrl;
    }
    if (!existing.roadAddress && item.roadAddress) {
      existing.roadAddress = item.roadAddress;
    }
    if (!existing.address && item.address) {
      existing.address = item.address;
    }
    if ((!Number.isFinite(Number(existing.latitude)) || !Number.isFinite(Number(existing.longitude))) && Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))) {
      existing.latitude = item.latitude;
      existing.longitude = item.longitude;
    }
    existing.rawPayload = {
      ...(existing.rawPayload || {}),
      mergedExternalIds: [...new Set([...(existing.rawPayload?.mergedExternalIds || []), ...(item.rawPayload?.mergedExternalIds || []), item.externalId].filter(Boolean))],
    };
  }
  return [...grouped.values()];
}

function groupFestivalRowsBySeries(rows) {
  return rows.reduce((acc, row) => {
    const previous = acc[acc.length - 1];
    if (
      previous &&
      buildFestivalSeriesKey(previous) === buildFestivalSeriesKey(row) &&
      areFestivalSeriesPeriodsMergeable(previous, row)
    ) {
      if (new Date(row.ends_at).getTime() > new Date(previous.ends_at).getTime()) {
        previous.ends_at = row.ends_at;
      }
      if (!previous.summary && row.summary) {
        previous.summary = row.summary;
      }
      if (!previous.source_page_url && row.source_page_url) {
        previous.source_page_url = row.source_page_url;
      }
      if (!previous.road_address && row.road_address) {
        previous.road_address = row.road_address;
      }
      if (!previous.address && row.address) {
        previous.address = row.address;
      }
      if (
        (!Number.isFinite(Number(previous.latitude)) || !Number.isFinite(Number(previous.longitude))) &&
        Number.isFinite(Number(row.latitude)) &&
        Number.isFinite(Number(row.longitude))
      ) {
        previous.latitude = row.latitude;
        previous.longitude = row.longitude;
      }
      return acc;
    }
    acc.push({ ...row });
    return acc;
  }, []);
}

function formatVisitLabel(visitNumber) {
  const safeVisitNumber = Number.isFinite(Number(visitNumber)) && Number(visitNumber) > 0 ? Number(visitNumber) : 1;
  return `${safeVisitNumber}번째 방문`;
}

function buildSessionDurationLabel(session) {
  const startedAt = new Date(session.started_at);
  const endedAt = new Date(session.ended_at);
  const diffMs = Math.max(0, endedAt.getTime() - startedAt.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) {
    return `당일 코스 · 스탬프 ${session.stamp_count ?? 0}개`;
  }
  return `${diffDays}박 ${diffDays + 1}일 · 스탬프 ${session.stamp_count ?? 0}개`;
}

function buildStampLogs(stampRows, placesByPositionId) {
  const todayKey = toSeoulDateKey();
  const sessionCounts = new Map();
  for (const row of stampRows) {
    if (!row.travel_session_id) {
      continue;
    }
    const sessionId = String(row.travel_session_id);
    sessionCounts.set(sessionId, (sessionCounts.get(sessionId) ?? 0) + 1);
  }

  return [...stampRows]
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .map((row) => {
      const place = placesByPositionId.get(String(row.position_id));
      const travelSessionId = row.travel_session_id ? String(row.travel_session_id) : null;
      return {
        id: String(row.stamp_id),
        placeId: place?.id ?? String(row.position_id),
        placeName: place?.name ?? "?? ?? ??",
        stampedAt: formatDateTime(row.created_at),
        stampedDate: formatDate(row.created_at),
        visitNumber: row.visit_ordinal ?? 1,
        visitLabel: formatVisitLabel(row.visit_ordinal ?? 1),
        travelSessionId,
        travelSessionStampCount: travelSessionId ? Number(sessionCounts.get(travelSessionId) ?? 0) : 0,
        isToday: row.stamp_date === todayKey,
      };
    });
}

function buildTravelSessions(sessionRows, userStampRows, placesByPositionId, ownerRouteRows = []) {
  const stampsBySessionId = new Map();
  for (const stampRow of userStampRows) {
    if (!stampRow.travel_session_id) {
      continue;
    }
    const sessionId = String(stampRow.travel_session_id);
    if (!stampsBySessionId.has(sessionId)) {
      stampsBySessionId.set(sessionId, []);
    }
    stampsBySessionId.get(sessionId).push(stampRow);
  }
  const publishedRouteIdBySession = new Map(ownerRouteRows.filter((row) => row.travel_session_id).map((row) => [String(row.travel_session_id), String(row.route_id)]));
  return [...sessionRows]
    .sort((left, right) => new Date(right.started_at).getTime() - new Date(left.started_at).getTime())
    .map((session) => {
      const sessionId = String(session.travel_session_id);
      const sessionStamps = [...(stampsBySessionId.get(sessionId) ?? [])].sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
      const uniquePlaceIds = [];
      const uniquePlaceNames = [];
      const seenPlaceIds = new Set();
      for (const stampRow of sessionStamps) {
        const place = placesByPositionId.get(String(stampRow.position_id));
        const placeId = place?.id ?? String(stampRow.position_id);
        if (seenPlaceIds.has(placeId)) {
          continue;
        }
        seenPlaceIds.add(placeId);
        uniquePlaceIds.push(placeId);
        uniquePlaceNames.push(place?.name ?? placeId);
      }
      return {
        id: sessionId,
        startedAt: session.started_at,
        endedAt: session.ended_at,
        durationLabel: buildSessionDurationLabel(session),
        stampCount: session.stamp_count ?? sessionStamps.length,
        placeIds: uniquePlaceIds,
        placeNames: uniquePlaceNames,
        canPublish: uniquePlaceIds.length >= 2,
        publishedRouteId: publishedRouteIdBySession.get(sessionId) ?? null,
        coverPlaceId: uniquePlaceIds[0] ?? null,
      };
    });
}
function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function base64UrlEncode(bytes) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4 || 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey('raw', textEncoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function signPayload(secret, payload) {
  const body = base64UrlEncode(textEncoder.encode(JSON.stringify(payload)));
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(body));
  return `${body}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function verifyPayload(secret, token) {
  if (!token || !secret) {
    return null;
  }

  const [body, signature] = token.split('.');
  if (!body || !signature) {
    return null;
  }

  try {
    const key = await importHmacKey(secret);
    const isValid = await crypto.subtle.verify('HMAC', key, base64UrlDecode(signature), textEncoder.encode(body));
    if (!isValid) {
      return null;
    }
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(body)));
  } catch {
    return null;
  }
}

function getSigningSecret(env) {
  return env.APP_SESSION_SECRET || env.APP_JWT_SECRET || '';
}

function getSecureCookieFlag(request, env) {
  if (env.APP_SESSION_HTTPS === 'false') {
    return false;
  }
  return new URL(request.url).protocol === 'https:';
}

function serializeCookie(name, value, options) {
  const parts = [`${name}=${value}`];
  parts.push(`Path=${options.path ?? '/'}`);
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }
  if (options.secure) {
    parts.push('Secure');
  }
  parts.push(`SameSite=${options.sameSite ?? 'Lax'}`);
  return parts.join('; ');
}

function clearCookie(name, secure) {
  return serializeCookie(name, '', {
    maxAge: 0,
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: '/',
  });
}

function parseCookies(request) {
  const cookieHeader = request.headers.get('Cookie') ?? '';
  const cookies = new Map();
  for (const chunk of cookieHeader.split(';')) {
    const [rawName, ...valueParts] = chunk.trim().split('=');
    if (!rawName) {
      continue;
    }
    cookies.set(rawName, valueParts.join('='));
  }
  return cookies;
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value));
  return base64UrlEncode(new Uint8Array(digest));
}

function isAdminUser(env, userId) {
  const adminIds = (env.APP_ADMIN_USER_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return adminIds.includes(userId);
}

function buildSessionUser(userId, nickname, email, provider, profileImage, env, profileCompletedAt = null) {
  return {
    id: userId,
    nickname,
    email: email ?? null,
    provider,
    profileImage: profileImage ?? null,
    isAdmin: isAdminUser(env, userId),
    profileCompletedAt: profileCompletedAt ?? null,
  };
}
async function readSessionUser(request, env) {
  const sessionToken = parseCookies(request).get(SESSION_COOKIE_NAME);
  const payload = await verifyPayload(getSigningSecret(env), sessionToken);
  if (!payload?.user || (payload.exp && payload.exp < nowSeconds())) {
    return null;
  }
  return {
    ...payload.user,
    isAdmin: isAdminUser(env, payload.user.id),
    profileCompletedAt: payload.user.profileCompletedAt ?? null,
  };
}
function buildRedirectUrl(baseUrl, params = {}) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function naverConfigured(env) {
  return Boolean(env.APP_NAVER_LOGIN_CLIENT_ID && env.APP_NAVER_LOGIN_CLIENT_SECRET && env.APP_NAVER_LOGIN_CALLBACK_URL);
}

function buildAuthProviders(env) {
  return PROVIDERS.map((provider) => {
    if (provider.key === 'naver') {
      const enabled = naverConfigured(env);
      return {
        key: provider.key,
        label: provider.label,
        isEnabled: enabled,
        loginUrl: enabled ? '/api/auth/naver/login' : null,
      };
    }

    return {
      key: provider.key,
      label: provider.label,
      isEnabled: false,
      loginUrl: null,
    };
  });
}

function createAuthResponse(sessionUser, env) {
  return {
    isAuthenticated: Boolean(sessionUser),
    user: sessionUser,
    providers: buildAuthProviders(env),
  };
}

function buildNaverLoginUrl(env, state) {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: env.APP_NAVER_LOGIN_CLIENT_ID,
    redirect_uri: env.APP_NAVER_LOGIN_CALLBACK_URL,
    state,
  });
  return `${NAVER_AUTHORIZE_URL}?${query.toString()}`;
}

async function exchangeNaverCode(env, code, state) {
  const query = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: env.APP_NAVER_LOGIN_CLIENT_ID,
    client_secret: env.APP_NAVER_LOGIN_CLIENT_SECRET,
    code,
    state,
  });
  const response = await fetch(`${NAVER_TOKEN_URL}?${query.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  const payload = await response.json();
  if (!response.ok || payload.error || !payload.access_token) {
    throw new Error(payload.error_description || payload.message || '네이버 토큰 교환에 실패했어요.');
  }
  return payload;
}

async function fetchNaverProfile(accessToken) {
  const response = await fetch(NAVER_PROFILE_URL, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const payload = await response.json();
  if (!response.ok || payload.resultcode !== '00' || !payload.response) {
    throw new Error(payload.message || '네이버 사용자 정보를 가져오지 못했어요.');
  }
  return payload.response;
}

async function findIdentity(env, provider, providerUserId) {
  const rows = await supabaseRequest(
    env,
    `user_identity?select=identity_id,user_id,email,profile_image&provider=eq.${encodeFilterValue(provider)}&provider_user_id=eq.${encodeFilterValue(providerUserId)}&limit=1`,
  );
  return rows?.[0] ?? null;
}

async function readUserRow(env, userId) {
  const rows = await supabaseRequest(
    env,
    `user?select=user_id,nickname,email,provider,profile_completed_at&user_id=eq.${encodeFilterValue(userId)}&limit=1`,
  );
  return rows?.[0] ?? null;
}

async function findUserByNickname(env, nickname, excludeUserId = null) {
  const normalized = String(nickname ?? '').trim();
  if (!normalized) {
    return null;
  }
  const rows = await supabaseRequest(env, 'user?select=user_id,nickname');
  return (rows ?? []).find((row) => {
    if (excludeUserId && row.user_id === excludeUserId) {
      return false;
    }
    return String(row.nickname ?? '').toLowerCase() === normalized.toLowerCase();
  }) ?? null;
}

async function ensureUniqueNickname(env, nickname, excludeUserId = null) {
  const normalized = String(nickname ?? '').trim();
  if (normalized.length < 2) {
    const error = new Error('닉네임은 두 글자 이상으로 적어 주세요.');
    error.status = 400;
    throw error;
  }
  const existing = await findUserByNickname(env, normalized, excludeUserId);
  if (existing) {
    const error = new Error('이미 사용 중인 닉네임이에요.');
    error.status = 409;
    throw error;
  }
  return normalized;
}

async function buildUniqueSocialNickname(env, nickname) {
  const base = String(nickname ?? '').trim() || '이름 없음';
  const existing = await findUserByNickname(env, base);
  if (!existing) {
    return base;
  }
  for (let suffix = 2; suffix < 10000; suffix += 1) {
    const candidate = `${base.slice(0, 95)}${suffix}`;
    const duplicate = await findUserByNickname(env, candidate);
    if (!duplicate) {
      return candidate;
    }
  }
  throw new Error('사용 가능한 닉네임을 만들 수 없어요.');
}

async function upsertNaverUser(env, profile) {
  const fallbackNickname = profile.nickname || profile.name || '이름 없음';
  const nowIso = new Date().toISOString();
  const existingIdentity = await findIdentity(env, 'naver', profile.id);

  if (existingIdentity) {
    await supabaseRequest(env, `user?user_id=eq.${encodeFilterValue(existingIdentity.user_id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        email: profile.email ?? null,
        provider: 'naver',
        updated_at: nowIso,
      }),
    });
    await supabaseRequest(env, `user_identity?identity_id=eq.${encodeFilterValue(existingIdentity.identity_id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        email: profile.email ?? null,
        profile_image: profile.profile_image ?? null,
        updated_at: nowIso,
      }),
    });
    const user = await readUserRow(env, existingIdentity.user_id);
    return buildSessionUser(
      existingIdentity.user_id,
      user?.nickname ?? fallbackNickname,
      user?.email ?? profile.email,
      'naver',
      profile.profile_image,
      env,
      user?.profile_completed_at ?? null,
    );
  }

  const userId = crypto.randomUUID();
  const safeNickname = await buildUniqueSocialNickname(env, fallbackNickname);
  await supabaseRequest(env, 'user', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      nickname: safeNickname,
      email: profile.email ?? null,
      provider: 'naver',
      profile_completed_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    }),
  });
  await supabaseRequest(env, 'user_identity', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      provider: 'naver',
      provider_user_id: profile.id,
      email: profile.email ?? null,
      profile_image: profile.profile_image ?? null,
      created_at: nowIso,
      updated_at: nowIso,
    }),
  });

  return buildSessionUser(userId, safeNickname, profile.email, 'naver', profile.profile_image, env, null);
}
function normalizePlaceCategory(category, slug = '') {
  const cultureSlugHints = ['museum', 'arts-center', 'art-science', 'science-museum', 'observatory'];
  if (category === 'restaurant' || category === 'cafe' || category === 'attraction' || category === 'culture') {
    return category;
  }
  if (category === 'food') {
    return 'restaurant';
  }
  if (category === 'night') {
    return 'attraction';
  }
  if (category === 'landmark') {
    return cultureSlugHints.some((hint) => slug.includes(hint)) ? 'culture' : 'attraction';
  }
  return 'attraction';
}

function getCategoryPalette(category, row) {
  const fallbackJam = row.jam_color ?? '#FFB3C6';
  const fallbackAccent = row.accent_color ?? '#FF6B9D';
  switch (category) {
    case 'restaurant':
      return { jamColor: '#FF6B9D', accentColor: '#FFB3C6', heroLabel: 'Bakery Bite', summaryPrefix: '빵과 면, 국밥까지' };
    case 'cafe':
      return { jamColor: '#7CB9D1', accentColor: '#A8D5E2', heroLabel: 'Cafe Mood', summaryPrefix: '커피와 디저트' };
    case 'culture':
      return { jamColor: '#A8D5E2', accentColor: '#C9E4EA', heroLabel: 'Culture Spot', summaryPrefix: '전시와 문화 공간' };
    case 'attraction':
      return { jamColor: '#FFB3C6', accentColor: '#FFD4E0', heroLabel: 'City Spot', summaryPrefix: '대전 산책과 명소' };
    default:
      return { jamColor: fallbackJam, accentColor: fallbackAccent, heroLabel: row.hero_label, summaryPrefix: '' };
  }
}
function mapPlace(row) {
  return {
    id: row.slug,
    positionId: String(row.position_id),
    name: row.name,
    district: row.district,
    category: normalizePlaceCategory(row.category, row.slug),
    jamColor: getCategoryPalette(normalizePlaceCategory(row.category, row.slug), row).jamColor,
    accentColor: getCategoryPalette(normalizePlaceCategory(row.category, row.slug), row).accentColor,
    imageUrl: row.image_url ?? null,
    latitude: row.latitude,
    longitude: row.longitude,
    summary: row.summary,
    description: row.description,
    vibeTags: Array.isArray(row.vibe_tags) ? row.vibe_tags : [],
    visitTime: row.visit_time,
    routeHint: row.route_hint,
    stampReward: row.stamp_reward,
    heroLabel: getCategoryPalette(normalizePlaceCategory(row.category, row.slug), row).heroLabel,
  };
}

async function loadStaticBaseRows(env) {
  const now = Date.now();
  if (staticBaseCache.value && staticBaseCache.expiresAt > now) {
    return staticBaseCache.value;
  }

  return rememberPending(staticBaseCache, async () => {
    const [placeRows, courseRows, coursePlaceRows] = await Promise.all([
      supabaseRequest(env, "map?select=position_id,slug,name,district,category,latitude,longitude,summary,description,image_url,image_storage_path,vibe_tags,visit_time,route_hint,stamp_reward,hero_label,jam_color,accent_color,is_active&is_active=eq.true&order=position_id.asc"),
      supabaseRequest(env, "course?select=course_id,title,mood,duration,note,color,display_order&order=display_order.asc"),
      supabaseRequest(env, "course_place?select=course_id,position_id,stop_order&order=stop_order.asc"),
    ]);
    const value = { placeRows, courseRows, coursePlaceRows };
    staticBaseCache = {
      ...staticBaseCache,
      value,
      expiresAt: Date.now() + STATIC_BASE_CACHE_TTL_MS,
      pending: null,
    };
    return value;
  });
}

function countComments(comments) {
  let total = 0;
  for (const comment of comments) {
    total += 1 + countComments(comment.replies);
  }
  return total;
}

function buildCommentTree(commentRows, usersById) {
  const isDeletedCommentRow = (row) => {
    const body = String(row?.body ?? '').trim();
    return Boolean(row?.is_deleted) || body === '[deleted]' || body === '삭제된 댓글입니다.';
  };
  const commentsById = new Map();
  const rowsById = new Map(commentRows.map((row) => [String(row.comment_id), row]));
  const roots = [];

  for (const row of commentRows) {
    const comment = {
      id: String(row.comment_id),
      userId: row.user_id,
      author: usersById.get(row.user_id)?.nickname ?? '이름 없음',
      body: isDeletedCommentRow(row) ? '삭제된 댓글입니다.' : row.body,
      parentId: row.parent_id ? String(row.parent_id) : null,
      isDeleted: isDeletedCommentRow(row),
      createdAt: formatDateTime(row.created_at),
      replies: [],
    };
    commentsById.set(comment.id, comment);
  }

  for (const comment of commentsById.values()) {
    const parentRow = comment.parentId ? rowsById.get(comment.parentId) : null;
    const rootParentId = parentRow ? String(parentRow.parent_id ?? parentRow.comment_id) : null;
    if (rootParentId && commentsById.has(rootParentId)) {
      commentsById.get(rootParentId).replies.push(comment);
    } else {
      roots.push(comment);
    }
  }

  const hasLiveDescendant = (node) => node.replies.some((reply) => !reply.isDeleted || hasLiveDescendant(reply));

  const collapseDeletedNodes = (nodes) => nodes.reduce((acc, node) => {
    const nextNode = {
      ...node,
      replies: collapseDeletedNodes(node.replies),
    };
    if (nextNode.isDeleted) {
      if (hasLiveDescendant(nextNode)) {
        acc.push(nextNode);
      }
      return acc;
    }
    acc.push(nextNode);
    return acc;
  }, []);

  return collapseDeletedNodes(roots);
}

function buildMyComments(commentRows, reviewsById) {
  const isDeletedCommentRow = (row) => {
    const body = String(row?.body ?? '').trim();
    return Boolean(row?.is_deleted) || body === '[deleted]' || body === '삭제된 댓글입니다.';
  };
  return [...commentRows]
    .filter((row) => !isDeletedCommentRow(row))
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .map((row) => {
      const review = reviewsById.get(String(row.feed_id));
      if (!review) {
        return null;
      }
      return {
        id: String(row.comment_id),
        reviewId: String(row.feed_id),
        placeId: review.placeId,
        placeName: review.placeName,
        body: row.body,
        isDeleted: false,
        parentId: row.parent_id ? String(row.parent_id) : null,
        createdAt: formatDateTime(row.created_at),
        reviewBody: review.body,
      };
    })
    .filter(Boolean);
}

function mapReviewRows(feedRows, commentRows, likeRows, usersById, placesByPositionId, stampRowsById, routeRows = [], likedFeedIds = new Set()) {
  const commentsByFeedId = new Map();
  for (const row of commentRows) {
    const feedId = String(row.feed_id);
    if (!commentsByFeedId.has(feedId)) {
      commentsByFeedId.set(feedId, []);
    }
    commentsByFeedId.get(feedId).push(row);
  }

  const likesByFeedId = new Map();
  for (const row of likeRows) {
    const feedId = String(row.feed_id);
    likesByFeedId.set(feedId, (likesByFeedId.get(feedId) ?? 0) + 1);
  }

  const publishedRouteIdBySession = new Map(
    routeRows
      .filter((row) => row.travel_session_id)
      .map((row) => [String(row.travel_session_id), String(row.route_id)]),
  );

  return feedRows.map((row) => {
    const place = placesByPositionId.get(String(row.position_id));
    const stamp = row.stamp_id ? stampRowsById.get(String(row.stamp_id)) : null;
    const reviewComments = buildCommentTree(commentsByFeedId.get(String(row.feed_id)) ?? [], usersById);
    const visitNumber = stamp?.visit_ordinal ?? 1;
    const travelSessionId = stamp?.travel_session_id ? String(stamp.travel_session_id) : null;
    return {
      id: String(row.feed_id),
      userId: row.user_id,
      placeId: place?.id ?? String(row.position_id),
      placeName: place?.name ?? "장소 정보 없음",
      author: usersById.get(row.user_id)?.nickname ?? "이름 없음",
      body: row.body,
      mood: row.mood,
      badge: row.badge,
      visitedAt: formatDateTime(row.created_at),
      imageUrl: row.image_url ?? null,
      commentCount: countComments(reviewComments),
      likeCount: likesByFeedId.get(String(row.feed_id)) ?? 0,
      likedByMe: likedFeedIds.has(String(row.feed_id)),
      stampId: row.stamp_id ? String(row.stamp_id) : null,
      visitNumber,
      visitLabel: formatVisitLabel(visitNumber),
      travelSessionId,
      hasPublishedRoute: travelSessionId ? publishedRouteIdBySession.has(travelSessionId) : false,
      comments: reviewComments,
    };
  });
}
function mapCourses(courseRows, coursePlaceRows, placesByPositionId) {
  const placeIdsByCourseId = new Map();
  for (const row of coursePlaceRows) {
    const courseId = String(row.course_id);
    if (!placeIdsByCourseId.has(courseId)) {
      placeIdsByCourseId.set(courseId, []);
    }
    placeIdsByCourseId.get(courseId).push({
      stopOrder: row.stop_order,
      placeId: placesByPositionId.get(String(row.position_id))?.id ?? String(row.position_id),
    });
  }

  return courseRows.map((row) => ({
    id: String(row.course_id),
    title: row.title,
    mood: row.mood,
    duration: row.duration,
    note: row.note,
    color: row.color,
    placeIds: (placeIdsByCourseId.get(String(row.course_id)) ?? [])
      .sort((left, right) => left.stopOrder - right.stopOrder)
      .map((item) => item.placeId),
  }));
}

function mapCommunityRoutes(routeRows, routePlaceRows, usersById, placesByPositionId, likedRouteIds = new Set()) {
  const placeRowsByRouteId = new Map();
  for (const row of routePlaceRows) {
    const routeId = String(row.route_id);
    if (!placeRowsByRouteId.has(routeId)) {
      placeRowsByRouteId.set(routeId, []);
    }
    placeRowsByRouteId.get(routeId).push({
      stopOrder: row.stop_order,
      placeId: placesByPositionId.get(String(row.position_id))?.id ?? String(row.position_id),
    });
  }

  return routeRows.map((row) => {
    const placeRows = (placeRowsByRouteId.get(String(row.route_id)) ?? []).sort((left, right) => left.stopOrder - right.stopOrder);
    const placeIds = placeRows.map((item) => item.placeId);
    return {
      id: String(row.route_id),
      authorId: row.user_id,
      author: usersById.get(row.user_id)?.nickname ?? "이름 없음",
      title: row.title,
      description: row.description,
      mood: row.mood,
      likeCount: row.like_count ?? 0,
      likedByMe: likedRouteIds.has(String(row.route_id)),
      createdAt: formatDateTime(row.created_at),
      placeIds,
      placeNames: placeIds.map((placeId) => {
        for (const place of placesByPositionId.values()) {
          if (place.id === placeId) {
            return place.name;
          }
        }
        return placeId;
      }),
      isUserGenerated: row.is_user_generated ?? false,
      travelSessionId: row.travel_session_id ? String(row.travel_session_id) : null,
    };
  });
}
async function loadBaseData(env, sessionUserId = null) {
  const [{ placeRows, courseRows, coursePlaceRows }, feedRows] = await Promise.all([
    loadStaticBaseRows(env),
    supabaseRequest(env, "feed?select=feed_id,position_id,user_id,stamp_id,body,mood,badge,image_url,created_at&order=created_at.desc"),
  ]);

  const feedIdsFilter = buildInFilter(feedRows.map((row) => row.feed_id));
  const reviewStampIdsFilter = buildInFilter(feedRows.map((row) => row.stamp_id).filter(Boolean));

  const [commentRows, likeRows, reviewStampRows, userFeedLikeRows = [], userSessionRows = [], ownerRouteRows = [], userStampRows = []] = await Promise.all([
    feedIdsFilter
      ? supabaseRequest(env, `user_comment?select=comment_id,feed_id,user_id,parent_id,body,is_deleted,created_at&feed_id=${feedIdsFilter}&order=created_at.asc`)
      : Promise.resolve([]),
    feedIdsFilter
      ? supabaseRequest(env, `feed_like?select=feed_id,user_id&feed_id=${feedIdsFilter}`)
      : Promise.resolve([]),
    reviewStampIdsFilter
      ? supabaseRequest(env, `user_stamp?select=stamp_id,user_id,position_id,travel_session_id,stamp_date,visit_ordinal,created_at&stamp_id=${reviewStampIdsFilter}`)
      : Promise.resolve([]),
    sessionUserId && feedIdsFilter
      ? supabaseRequest(env, `feed_like?select=feed_id&user_id=eq.${encodeFilterValue(sessionUserId)}&feed_id=${feedIdsFilter}`)
      : Promise.resolve([]),
    sessionUserId
      ? supabaseRequest(env, `travel_session?select=travel_session_id,user_id,started_at,ended_at,last_stamp_at,stamp_count,created_at&user_id=eq.${encodeFilterValue(sessionUserId)}&order=started_at.desc`)
      : Promise.resolve([]),
    sessionUserId
      ? supabaseRequest(env, `user_route?select=route_id,travel_session_id&user_id=eq.${encodeFilterValue(sessionUserId)}&order=created_at.desc`)
      : Promise.resolve([]),
    sessionUserId
      ? supabaseRequest(env, `user_stamp?select=stamp_id,user_id,position_id,travel_session_id,stamp_date,visit_ordinal,created_at&user_id=eq.${encodeFilterValue(sessionUserId)}&order=created_at.desc`)
      : Promise.resolve([]),
  ]);
  const reviewTravelSessionIds = [...new Set((reviewStampRows ?? []).map((row) => row.travel_session_id).filter(Boolean).map((value) => String(value)))];
  const reviewRouteRows = reviewTravelSessionIds.length > 0
    ? await supabaseRequest(env, `user_route?select=route_id,travel_session_id&travel_session_id=${buildInFilter(reviewTravelSessionIds)}`)
    : [];

  const userIdsFilter = buildInFilter([
    ...feedRows.map((row) => row.user_id),
    ...commentRows.map((row) => row.user_id),
    ...(sessionUserId ? [sessionUserId] : []),
  ]);
  const userRows = userIdsFilter
    ? await supabaseRequest(env, `user?select=user_id,nickname&user_id=${userIdsFilter}`)
    : [];

  const allStampRows = [...reviewStampRows, ...userStampRows.filter((row) => !reviewStampRows.some((stamp) => String(stamp.stamp_id) === String(row.stamp_id)))];
  const places = placeRows.map(mapPlace);
  const placesByPositionId = new Map(places.map((place) => [place.positionId, place]));
  const usersById = new Map(userRows.map((row) => [row.user_id, row]));
  const stampRowsById = new Map((allStampRows ?? []).map((row) => [String(row.stamp_id), row]));
  const likedFeedIds = new Set((userFeedLikeRows ?? []).map((row) => String(row.feed_id)));
  const collectedPlaceIds = [...new Set(userStampRows.map((row) => placesByPositionId.get(String(row.position_id))?.id).filter(Boolean))];
  const stampLogs = buildStampLogs(userStampRows, placesByPositionId);
  const travelSessions = buildTravelSessions(userSessionRows ?? [], userStampRows, placesByPositionId, ownerRouteRows ?? []);

  return {
    places,
    placesByPositionId,
    reviews: mapReviewRows(feedRows, commentRows, likeRows, usersById, placesByPositionId, stampRowsById, reviewRouteRows, likedFeedIds),
    courses: mapCourses(courseRows, coursePlaceRows, placesByPositionId),
    collectedPlaceIds,
    stampLogs,
    travelSessions,
  };
}
async function loadCommunityRoutes(env, options = {}) {
  const { sort = "popular", sessionUserId = null, ownerUserId = null } = options;
  const routeFilter = ownerUserId
    ? `user_id=eq.${encodeFilterValue(ownerUserId)}&order=created_at.desc`
    : `is_public=eq.true&order=${sort === "popular" ? "like_count.desc,created_at.desc" : "created_at.desc"}`;

  const routeRows = await supabaseRequest(env, `user_route?select=route_id,user_id,travel_session_id,title,description,mood,like_count,created_at,is_public,is_user_generated&${routeFilter}`);
  const routeIdsFilter = buildInFilter(routeRows.map((row) => row.route_id));
  if (!routeIdsFilter) {
    return [];
  }

  const [routePlaceRows, userRouteLikeRows = []] = await Promise.all([
    supabaseRequest(env, `user_route_place?select=route_id,position_id,stop_order&route_id=${routeIdsFilter}&order=stop_order.asc`),
    sessionUserId
      ? supabaseRequest(env, `user_route_like?select=route_id&user_id=eq.${encodeFilterValue(sessionUserId)}&route_id=${routeIdsFilter}`)
      : Promise.resolve([]),
  ]);

  const userIdsFilter = buildInFilter(routeRows.map((row) => row.user_id));
  const [{ placeRows }, userRows] = await Promise.all([
    loadStaticBaseRows(env),
    userIdsFilter
      ? supabaseRequest(env, `user?select=user_id,nickname&user_id=${userIdsFilter}`)
      : Promise.resolve([]),
  ]);

  const neededPositionIds = new Set(routePlaceRows.map((row) => String(row.position_id)));
  const placesByPositionId = new Map(
    placeRows
      .filter((row) => neededPositionIds.has(String(row.position_id)))
      .map((row) => [String(row.position_id), { id: row.slug, name: row.name }]),
  );
  const usersById = new Map(userRows.map((row) => [row.user_id, row]));
  const likedRouteIds = new Set(userRouteLikeRows.map((row) => String(row.route_id)));
  return mapCommunityRoutes(routeRows, routePlaceRows, usersById, placesByPositionId, likedRouteIds);
}
async function loadMapData(env, sessionUserId = null) {
  const [{ placeRows }, userSessionRows = [], ownerRouteRows = [], userStampRows = []] = await Promise.all([
    loadStaticBaseRows(env),
    sessionUserId
      ? supabaseRequest(env, `travel_session?select=travel_session_id,user_id,started_at,ended_at,last_stamp_at,stamp_count,created_at&user_id=eq.${encodeFilterValue(sessionUserId)}&order=started_at.desc`)
      : Promise.resolve([]),
    sessionUserId
      ? supabaseRequest(env, `user_route?select=route_id,travel_session_id&user_id=eq.${encodeFilterValue(sessionUserId)}&order=created_at.desc`)
      : Promise.resolve([]),
    sessionUserId
      ? supabaseRequest(env, `user_stamp?select=stamp_id,user_id,position_id,travel_session_id,stamp_date,visit_ordinal,created_at&user_id=eq.${encodeFilterValue(sessionUserId)}&order=created_at.desc`)
      : Promise.resolve([]),
  ]);

  const places = placeRows.map(mapPlace);
  const placesByPositionId = new Map(places.map((place) => [place.positionId, place]));
  const collectedPlaceIds = [...new Set(userStampRows.map((row) => placesByPositionId.get(String(row.position_id))?.id).filter(Boolean))];
  const stampLogs = buildStampLogs(userStampRows, placesByPositionId);
  const travelSessions = buildTravelSessions(userSessionRows ?? [], userStampRows, placesByPositionId, ownerRouteRows ?? []);

  return {
    places,
    collectedPlaceIds,
    stampLogs,
    travelSessions,
  };
}

async function loadCuratedCourses(env) {
  const { placeRows, courseRows, coursePlaceRows } = await loadStaticBaseRows(env);
  const placesByPositionId = new Map(placeRows.map((row) => [String(row.position_id), mapPlace(row)]));
  return mapCourses(courseRows, coursePlaceRows, placesByPositionId);
}

async function loadReviewData(env, sessionUserId = null, filters = {}) {
  const { placeRows } = await loadStaticBaseRows(env);
  const places = placeRows.map(mapPlace);
  const placesByPositionId = new Map(places.map((place) => [place.positionId, place]));
  const placeIdToPositionId = new Map(places.map((place) => [place.id, place.positionId]));
  const reviewQuery = [
    'select=feed_id,position_id,user_id,stamp_id,body,mood,badge,image_url,created_at',
    'order=created_at.desc',
  ];

  if (filters.placeId) {
    const positionId = placeIdToPositionId.get(filters.placeId);
    if (!positionId) {
      return [];
    }
    reviewQuery.push(`position_id=eq.${encodeFilterValue(positionId)}`);
  }

  if (filters.userId) {
    reviewQuery.push(`user_id=eq.${encodeFilterValue(filters.userId)}`);
  }

  const feedRows = await supabaseRequest(env, `feed?${reviewQuery.join('&')}`);
  const feedIdsFilter = buildInFilter(feedRows.map((row) => row.feed_id));
  const reviewStampIdsFilter = buildInFilter(feedRows.map((row) => row.stamp_id).filter(Boolean));
  const [commentRows, likeRows, reviewStampRows, userFeedLikeRows = []] = await Promise.all([
    feedIdsFilter
      ? supabaseRequest(env, `user_comment?select=comment_id,feed_id,user_id,parent_id,body,is_deleted,created_at&feed_id=${feedIdsFilter}&order=created_at.asc`)
      : Promise.resolve([]),
    feedIdsFilter
      ? supabaseRequest(env, `feed_like?select=feed_id,user_id&feed_id=${feedIdsFilter}`)
      : Promise.resolve([]),
    reviewStampIdsFilter
      ? supabaseRequest(env, `user_stamp?select=stamp_id,user_id,position_id,travel_session_id,stamp_date,visit_ordinal,created_at&stamp_id=${reviewStampIdsFilter}`)
      : Promise.resolve([]),
    sessionUserId && feedIdsFilter
      ? supabaseRequest(env, `feed_like?select=feed_id&user_id=eq.${encodeFilterValue(sessionUserId)}&feed_id=${feedIdsFilter}`)
      : Promise.resolve([]),
  ]);
  const reviewTravelSessionIds = [...new Set((reviewStampRows ?? []).map((row) => row.travel_session_id).filter(Boolean).map((value) => String(value)))];
  const reviewRouteRows = reviewTravelSessionIds.length > 0
    ? await supabaseRequest(env, `user_route?select=route_id,travel_session_id&travel_session_id=${buildInFilter(reviewTravelSessionIds)}`)
    : [];

  const userIdsFilter = buildInFilter([
    ...feedRows.map((row) => row.user_id),
    ...commentRows.map((row) => row.user_id),
  ]);
  const userRows = userIdsFilter
    ? await supabaseRequest(env, `user?select=user_id,nickname&user_id=${userIdsFilter}`)
    : [];

  const usersById = new Map(userRows.map((row) => [row.user_id, row]));
  const stampRowsById = new Map((reviewStampRows ?? []).map((row) => [String(row.stamp_id), row]));
  const likedFeedIds = new Set((userFeedLikeRows ?? []).map((row) => String(row.feed_id)));
  return mapReviewRows(feedRows, commentRows, likeRows, usersById, placesByPositionId, stampRowsById, reviewRouteRows, likedFeedIds);
}

async function loadReviewPageData(env, sessionUserId = null, options = {}) {
  const { cursor = null, limit = 10 } = options;
  const { placeRows } = await loadStaticBaseRows(env);
  const places = placeRows.map(mapPlace);
  const placesByPositionId = new Map(places.map((place) => [place.positionId, place]));
  const reviewQuery = [
    'select=feed_id,position_id,user_id,stamp_id,body,mood,badge,image_url,created_at',
    'order=created_at.desc',
    `limit=${limit + 1}`,
  ];

  if (cursor) {
    reviewQuery.push(`created_at=lt.${encodeFilterValue(cursor)}`);
  }

  const feedRows = await supabaseRequest(env, `feed?${reviewQuery.join('&')}`);
  const nextCursor = feedRows.length > limit ? String(feedRows[limit].created_at) : null;
  const pageRows = feedRows.slice(0, limit);
  const feedIdsFilter = buildInFilter(pageRows.map((row) => row.feed_id));
  const reviewStampIdsFilter = buildInFilter(pageRows.map((row) => row.stamp_id).filter(Boolean));
  const [commentRows, likeRows, reviewStampRows, userFeedLikeRows = []] = await Promise.all([
    feedIdsFilter
      ? supabaseRequest(env, `user_comment?select=comment_id,feed_id,user_id,parent_id,body,is_deleted,created_at&feed_id=${feedIdsFilter}&order=created_at.asc`)
      : Promise.resolve([]),
    feedIdsFilter
      ? supabaseRequest(env, `feed_like?select=feed_id,user_id&feed_id=${feedIdsFilter}`)
      : Promise.resolve([]),
    reviewStampIdsFilter
      ? supabaseRequest(env, `user_stamp?select=stamp_id,user_id,position_id,travel_session_id,stamp_date,visit_ordinal,created_at&stamp_id=${reviewStampIdsFilter}`)
      : Promise.resolve([]),
    sessionUserId && feedIdsFilter
      ? supabaseRequest(env, `feed_like?select=feed_id&user_id=eq.${encodeFilterValue(sessionUserId)}&feed_id=${feedIdsFilter}`)
      : Promise.resolve([]),
  ]);
  const reviewTravelSessionIds = [...new Set((reviewStampRows ?? []).map((row) => row.travel_session_id).filter(Boolean).map((value) => String(value)))];
  const reviewRouteRows = reviewTravelSessionIds.length > 0
    ? await supabaseRequest(env, `user_route?select=route_id,travel_session_id&travel_session_id=${buildInFilter(reviewTravelSessionIds)}`)
    : [];

  const userIdsFilter = buildInFilter([
    ...pageRows.map((row) => row.user_id),
    ...commentRows.map((row) => row.user_id),
  ]);
  const userRows = userIdsFilter
    ? await supabaseRequest(env, `user?select=user_id,nickname&user_id=${userIdsFilter}`)
    : [];

  const usersById = new Map(userRows.map((row) => [row.user_id, row]));
  const stampRowsById = new Map((reviewStampRows ?? []).map((row) => [String(row.stamp_id), row]));
  const likedFeedIds = new Set((userFeedLikeRows ?? []).map((row) => String(row.feed_id)));
  return {
    items: mapReviewRows(pageRows, commentRows, likeRows, usersById, placesByPositionId, stampRowsById, reviewRouteRows, likedFeedIds),
    nextCursor,
  };
}

async function loadMyCommentPageData(env, userId, options = {}) {
  const { cursor = null, limit = 10 } = options;
  const query = [
    'select=comment_id,feed_id,user_id,parent_id,body,is_deleted,created_at',
    `user_id=eq.${encodeFilterValue(userId)}`,
    'order=created_at.desc',
    `limit=${limit + 1}`,
  ];
  if (cursor) {
    query.push(`created_at=lt.${encodeFilterValue(cursor)}`);
  }

  const commentRows = await supabaseRequest(env, `user_comment?${query.join('&')}`);
  const nextCursor = commentRows.length > limit ? String(commentRows[limit].created_at) : null;
  const pageRows = commentRows.slice(0, limit);
  const feedIdsFilter = buildInFilter(pageRows.map((row) => row.feed_id));
  if (!feedIdsFilter) {
    return { items: [], nextCursor };
  }

  const [feedRows, { placeRows }] = await Promise.all([
    supabaseRequest(env, `feed?select=feed_id,position_id,body&feed_id=${feedIdsFilter}`),
    loadStaticBaseRows(env),
  ]);
  const placesByPositionId = new Map(placeRows.map((row) => [String(row.position_id), { id: row.slug, name: row.name }]));
  return {
    items: mapMyComments(pageRows, feedRows ?? [], placesByPositionId),
    nextCursor,
  };
}

async function handleHealth(request, env) {
  return jsonResponse(200, {
    status: 'ok',
    env: 'worker-first',
    databaseUrl: env.APP_SUPABASE_URL ?? '',
    databaseProvider: 'supabase-rest',
    storageBackend: env.APP_STORAGE_BACKEND ?? 'supabase',
    storagePath: env.APP_SUPABASE_STORAGE_BUCKET ? `supabase://${env.APP_SUPABASE_STORAGE_BUCKET}` : '',
    supabaseConfigured: Boolean(env.APP_SUPABASE_URL && getSupabaseKey(env)),
    frontendUrlConfigured: Boolean(env.APP_FRONTEND_URL),
    corsOriginsConfigured: Boolean(env.APP_CORS_ORIGINS),
    naverLoginConfigured: naverConfigured(env),
    naverLoginClientIdConfigured: Boolean(env.APP_NAVER_LOGIN_CLIENT_ID),
    naverLoginClientSecretConfigured: Boolean(env.APP_NAVER_LOGIN_CLIENT_SECRET),
    naverLoginCallbackUrlConfigured: Boolean(env.APP_NAVER_LOGIN_CALLBACK_URL),
    naverLoginCallbackUrl: env.APP_NAVER_LOGIN_CALLBACK_URL ?? '',
  }, env, request);
}

async function handleAuthProviders(request, env) {
  return jsonResponse(200, buildAuthProviders(env), env, request);
}

async function handleAuthSession(request, env) {
  return jsonResponse(200, createAuthResponse(await readSessionUser(request, env), env), env, request);
}

async function handleLogout(request, env) {
  return jsonResponse(200, createAuthResponse(null, env), env, request, {
    "set-cookie": clearCookie(SESSION_COOKIE_NAME, getSecureCookieFlag(request, env)),
  });
}

async function handleUpdateProfile(request, env) {
  const sessionResult = await requireSessionUser(request, env);
  if (sessionResult.response) {
    return sessionResult.response;
  }
  const payload = await readJsonBody(request);

  let nickname;
  try {
    nickname = await ensureUniqueNickname(env, payload.nickname, sessionResult.sessionUser.id);
  } catch (error) {
    return jsonResponse(error.status ?? 400, { detail: error.message ?? '닉네임을 저장할 수 없어요.' }, env, request);
  }

  const nowIso = new Date().toISOString();
  await supabaseRequest(env, `user?user_id=eq.${encodeFilterValue(sessionResult.sessionUser.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      nickname,
      profile_completed_at: sessionResult.sessionUser.profileCompletedAt ?? nowIso,
      updated_at: nowIso,
    }),
  });
  const userRow = await readUserRow(env, sessionResult.sessionUser.id);
  const nextSessionUser = buildSessionUser(
    sessionResult.sessionUser.id,
    userRow?.nickname ?? nickname,
    userRow?.email ?? sessionResult.sessionUser.email,
    sessionResult.sessionUser.provider,
    sessionResult.sessionUser.profileImage,
    env,
    userRow?.profile_completed_at ?? sessionResult.sessionUser.profileCompletedAt ?? nowIso,
  );
  const sessionToken = await signPayload(getSigningSecret(env), { user: nextSessionUser, exp: nowSeconds() + SESSION_MAX_AGE_SECONDS });
  return jsonResponse(200, createAuthResponse(nextSessionUser, env), env, request, {
    'set-cookie': serializeCookie(SESSION_COOKIE_NAME, sessionToken, {
      maxAge: SESSION_MAX_AGE_SECONDS,
      httpOnly: true,
      secure: getSecureCookieFlag(request, env),
      sameSite: 'Lax',
      path: '/',
    }),
  });
}
async function handleStartNaverLogin(request, env, url) {
  if (!naverConfigured(env)) {
    return jsonResponse(503, { detail: '네이버 로그인 설정이 비어 있어요.' }, env, request);
  }

  const next = url.searchParams.get('next') || env.APP_FRONTEND_URL || 'https://daejeon.jamissue.com';
  const state = crypto.randomUUID().replace(/-/g, '');
  const stateToken = await signPayload(getSigningSecret(env), {
    state,
    next,
    exp: nowSeconds() + OAUTH_STATE_MAX_AGE_SECONDS,
  });

  return redirectResponse(buildNaverLoginUrl(env, state), env, request, [
    serializeCookie(OAUTH_STATE_COOKIE_NAME, stateToken, {
      maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
      httpOnly: true,
      secure: getSecureCookieFlag(request, env),
      sameSite: 'Lax',
      path: '/',
    }),
  ]);
}

async function handleNaverCallback(request, env, url) {
  const secure = getSecureCookieFlag(request, env);
  const stateToken = parseCookies(request).get(OAUTH_STATE_COOKIE_NAME);
  const statePayload = await verifyPayload(getSigningSecret(env), stateToken);
  const redirectTarget = statePayload?.next || env.APP_FRONTEND_URL || 'https://daejeon.jamissue.com';
  const cleanupCookie = clearCookie(OAUTH_STATE_COOKIE_NAME, secure);

  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');
  if (error) {
    return redirectResponse(buildRedirectUrl(redirectTarget, { auth: 'naver-error', reason: errorDescription || error }), env, request, [cleanupCookie]);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state || !statePayload || statePayload.state !== state || statePayload.exp < nowSeconds()) {
    return redirectResponse(buildRedirectUrl(redirectTarget, { auth: 'naver-error', reason: 'state-mismatch' }), env, request, [cleanupCookie]);
  }

  try {
    const tokenPayload = await exchangeNaverCode(env, code, state);
    const profile = await fetchNaverProfile(tokenPayload.access_token);
    const sessionUser = await upsertNaverUser(env, profile);
    const sessionToken = await signPayload(getSigningSecret(env), { user: sessionUser, exp: nowSeconds() + SESSION_MAX_AGE_SECONDS });

    return redirectResponse(buildRedirectUrl(redirectTarget, { auth: 'naver-success' }), env, request, [
      cleanupCookie,
      serializeCookie(SESSION_COOKIE_NAME, sessionToken, {
        maxAge: SESSION_MAX_AGE_SECONDS,
        httpOnly: true,
        secure,
        sameSite: 'Lax',
        path: '/',
      }),
    ]);
  } catch (errorValue) {
    const reason = errorValue instanceof Error ? errorValue.message : String(errorValue);
    return redirectResponse(buildRedirectUrl(redirectTarget, { auth: 'naver-error', reason }), env, request, [cleanupCookie]);
  }
}

async function handleMapBootstrap(request, env) {
  const sessionUser = await readSessionUser(request, env);
  const mapData = await loadMapData(env, sessionUser?.id ?? null);
  return jsonResponse(200, {
    auth: createAuthResponse(sessionUser, env),
    places: mapData.places.map(({ positionId, ...place }) => place),
    stamps: {
      collectedPlaceIds: mapData.collectedPlaceIds,
      logs: mapData.stampLogs,
      travelSessions: mapData.travelSessions,
    },
    hasRealData: mapData.places.length > 0,
  }, env, request);
}

async function handleCuratedCourses(request, env) {
  return jsonResponse(200, { courses: await loadCuratedCourses(env) }, env, request);
}

async function handleBootstrap(request, env) {
  const sessionUser = await readSessionUser(request, env);
  const baseData = await loadBaseData(env, sessionUser?.id ?? null);
  return jsonResponse(200, {
    auth: createAuthResponse(sessionUser, env),
    places: baseData.places.map(({ positionId, ...place }) => place),
    reviews: baseData.reviews,
    courses: baseData.courses,
    stamps: {
      collectedPlaceIds: baseData.collectedPlaceIds,
      logs: baseData.stampLogs,
      travelSessions: baseData.travelSessions,
    },
    hasRealData: baseData.places.length > 0,
  }, env, request);
}
async function handleReviews(request, env, url) {
  const sessionUser = await readSessionUser(request, env);
  const reviews = await loadReviewData(env, sessionUser?.id ?? null, {
    placeId: url.searchParams.get('placeId') ?? undefined,
    userId: url.searchParams.get('userId') ?? undefined,
  });
  return jsonResponse(200, reviews, env, request);
}

async function handleReviewFeed(request, env, url) {
  const sessionUser = await readSessionUser(request, env);
  const payload = await loadReviewPageData(env, sessionUser?.id ?? null, {
    cursor: url.searchParams.get('cursor') ?? null,
    limit: parseListLimit(url, 10, 20),
  });
  return jsonResponse(200, payload, env, request);
}

async function handleReviewDetail(request, env, reviewId) {
  const sessionUser = await readSessionUser(request, env);
  const review = await loadSingleReview(env, reviewId, sessionUser?.id ?? null);
  if (!review) {
    return jsonResponse(404, { detail: '??? ?? ? ???.' }, env, request);
  }
  return jsonResponse(200, review, env, request);
}

async function handleCommunityRoutes(request, env, url) {
  const sessionUser = await readSessionUser(request, env);
  const sort = url.searchParams.get('sort') === 'latest' ? 'latest' : 'popular';
  const routes = await loadCommunityRoutes(env, { sort, sessionUserId: sessionUser?.id ?? null });
  return jsonResponse(200, routes, env, request);
}

async function handleMyRoutes(request, env) {
  const sessionUser = await readSessionUser(request, env);
  if (!sessionUser) {
    return jsonResponse(401, { detail: '로그인이 필요해요.' }, env, request);
  }
  return jsonResponse(200, await loadCommunityRoutes(env, { ownerUserId: sessionUser.id, sessionUserId: sessionUser.id }), env, request);
}

function mapMyComments(commentRows, feedRows, placesByPositionId) {
  const isDeletedCommentRow = (row) => {
    const body = String(row?.body ?? '').trim();
    return Boolean(row?.is_deleted) || body === '[deleted]' || body === '삭제된 댓글입니다.';
  };
  const feedById = new Map(feedRows.map((row) => [String(row.feed_id), row]));
  return commentRows.filter((row) => !isDeletedCommentRow(row)).map((row) => {
    const feed = feedById.get(String(row.feed_id));
    const place = feed ? placesByPositionId.get(String(feed.position_id)) : null;
    return {
      id: String(row.comment_id),
      reviewId: String(row.feed_id),
      placeId: place?.id ?? String(feed?.position_id ?? ''),
      placeName: place?.name ?? '장소 정보 없음',
      body: row.body,
      isDeleted: false,
      parentId: row.parent_id ? String(row.parent_id) : null,
      createdAt: formatDateTime(row.created_at),
      reviewBody: feed?.body ?? '',
    };
  });
}

async function buildAdminSummary(env) {
  const [userCount, placeCount, reviewCount, commentCount, stampCount, placeRows, feedRows] = await Promise.all([
    supabaseCount(env, 'user'),
    supabaseCount(env, 'map'),
    supabaseCount(env, 'feed'),
    supabaseCount(env, 'user_comment'),
    supabaseCount(env, 'user_stamp'),
    supabaseRequest(env, 'map?select=position_id,slug,name,district,category,is_active,is_manual_override,updated_at&order=is_active.desc,name.asc'),
    supabaseRequest(env, 'feed?select=position_id'),
  ]);

  const reviewCountByPosition = new Map();
  for (const row of feedRows ?? []) {
    const key = String(row.position_id);
    reviewCountByPosition.set(key, (reviewCountByPosition.get(key) ?? 0) + 1);
  }

  return {
    userCount,
    placeCount,
    reviewCount,
    commentCount,
    stampCount,
    sourceReady: true,
    places: (placeRows ?? []).map((row) => ({
      id: row.slug,
      name: row.name,
      district: row.district,
      category: normalizePlaceCategory(row.category, row.slug),
      isActive: Boolean(row.is_active),
      isManualOverride: Boolean(row.is_manual_override),
      reviewCount: reviewCountByPosition.get(String(row.position_id)) ?? 0,
      updatedAt: formatDateTime(row.updated_at),
    })),
  };
}

async function handleAdminSummary(request, env) {
  const sessionUser = await readSessionUser(request, env);
  if (!sessionUser || !sessionUser.isAdmin) {
    return jsonResponse(403, { detail: '??? ???.' }, env, request);
  }
  return jsonResponse(200, await buildAdminSummary(env), env, request);
}

async function handleAdminPlaceVisibility(request, env, placeId) {
  const sessionUser = await readSessionUser(request, env);
  if (!sessionUser || !sessionUser.isAdmin) {
    return jsonResponse(403, { detail: '???? ??? ? ???.' }, env, request);
  }
  const payload = await request.json().catch(() => null);
  const body = {};
  if (typeof payload?.isActive === 'boolean') body.is_active = payload.isActive;
  if (typeof payload?.isManualOverride === 'boolean') body.is_manual_override = payload.isManualOverride;
  body.updated_at = new Date().toISOString();
  const updatedRows = await supabaseRequest(env, `map?slug=eq.${encodeFilterValue(placeId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  const updatedRow = Array.isArray(updatedRows) ? updatedRows[0] : null;
  if (!updatedRow) {
    return jsonResponse(404, { detail: '??? ?? ? ???.' }, env, request);
  }
  const reviewRows = await supabaseRequest(env, `feed?select=feed_id&position_id=eq.${encodeFilterValue(updatedRow.position_id)}`);
  return jsonResponse(200, {
    id: updatedRow.slug,
    name: updatedRow.name,
    district: updatedRow.district,
    category: normalizePlaceCategory(updatedRow.category, updatedRow.slug),
    isActive: Boolean(updatedRow.is_active),
    isManualOverride: Boolean(updatedRow.is_manual_override),
    reviewCount: (reviewRows ?? []).length,
    updatedAt: formatDateTime(updatedRow.updated_at),
  }, env, request);
}

async function handleAdminImportPublicData(request, env) {
  const sessionUser = await readSessionUser(request, env);
  if (!sessionUser || !sessionUser.isAdmin) {
    return jsonResponse(403, { detail: '관리자만 공공데이터를 다시 불러올 수 있어요.' }, env, request);
  }

  const sourceRows = await supabaseRequest(
    env,
    `public_data_source?select=name,last_imported_at&source_key=eq.${encodeFilterValue('jamissue-public-event-feed')}&limit=1`,
  );
  const source = sourceRows?.[0] ?? null;

  return jsonResponse(200, {
    importedPlaces: 0,
    importedCourses: 0,
    importedEvents: 0,
    mode: 'scheduled',
    detail: '공공 행사 동기화는 GitHub Actions 주간 작업으로 처리돼요.',
    importedAt: source?.last_imported_at ?? null,
  }, env, request);
}

async function handleMySummary(request, env) {
  const sessionUser = await readSessionUser(request, env);
  if (!sessionUser) {
    return jsonResponse(401, { detail: "로그인이 필요해요." }, env, request);
  }

  const baseData = await loadBaseData(env, sessionUser.id);
  const routes = await loadCommunityRoutes(env, { ownerUserId: sessionUser.id, sessionUserId: sessionUser.id });
  const reviewItems = baseData.reviews.filter((review) => review.userId === sessionUser.id);
  const reviewById = new Map(baseData.reviews.map((review) => [String(review.id), review]));
  const notifications = await loadUserNotifications(env, sessionUser.id);
  const myCommentRows = await supabaseRequest(
    env,
    `user_comment?select=comment_id,feed_id,user_id,parent_id,body,is_deleted,created_at&user_id=eq.${encodeFilterValue(sessionUser.id)}&order=created_at.desc`,
  );
  const myComments = buildMyComments(myCommentRows ?? [], reviewById);
  const collectedSet = new Set(baseData.collectedPlaceIds);
  const visitedPlaces = baseData.places.filter((place) => collectedSet.has(place.id)).map(({ positionId, ...place }) => place);
  const unvisitedPlaces = baseData.places.filter((place) => !collectedSet.has(place.id)).map(({ positionId, ...place }) => place);

  return jsonResponse(200, {
    user: sessionUser,
    stats: {
      reviewCount: reviewItems.length,
      stampCount: baseData.stampLogs.length,
      uniquePlaceCount: collectedSet.size,
      totalPlaceCount: baseData.places.length,
      routeCount: routes.length,
    },
    reviews: reviewItems,
    comments: myComments,
    notifications,
    unreadNotificationCount: notifications.filter((notification) => !notification.isRead).length,
    stampLogs: baseData.stampLogs,
    travelSessions: baseData.travelSessions,
    visitedPlaces,
    unvisitedPlaces,
    collectedPlaces: visitedPlaces,
    routes,
  }, env, request);
}
function getFestivalSourceUrl(env) {
  const baseUrl = String(env.APP_PUBLIC_EVENT_SOURCE_URL || 'http://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api').trim();
  if (!baseUrl) {
    return null;
  }

  const url = new URL(baseUrl);
  if (url.hostname === 'api.data.go.kr' && url.protocol === 'https:') {
    url.protocol = 'http:';
  }
  if (!url.searchParams.get('serviceKey') && env.APP_PUBLIC_EVENT_SERVICE_KEY) {
    url.searchParams.set('serviceKey', env.APP_PUBLIC_EVENT_SERVICE_KEY);
  }
  if (!url.searchParams.get('type')) {
    url.searchParams.set('type', 'json');
  }
  if (!url.searchParams.get('resultType')) {
    url.searchParams.set('resultType', 'json');
  }
  if (!url.searchParams.get('pageNo')) {
    url.searchParams.set('pageNo', '1');
  }
  if (!url.searchParams.get('numOfRows')) {
    url.searchParams.set('numOfRows', '40');
  }
  return url.toString();
}

function extractFestivalItems(payload) {
  if (Array.isArray(payload)) {
    return payload.filter((item) => item && typeof item === 'object');
  }
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const candidates = [
    payload.items,
    payload.data,
    payload.records,
    payload.result,
    payload.response?.body?.items,
    payload.response?.body?.item,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item) => item && typeof item === 'object');
    }
    if (candidate && typeof candidate === 'object') {
      if (Array.isArray(candidate.item)) {
        return candidate.item.filter((item) => item && typeof item === 'object');
      }
      if (candidate.item && typeof candidate.item === 'object') {
        return [candidate.item];
      }
    }
  }

  return [];
}

function readFestivalText(payload, keys) {
  for (const key of keys) {
    const value = payload?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return null;
}

function readFestivalNumber(payload, keys) {
  const value = readFestivalText(payload, keys);
  if (!value) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseFestivalDate(value, endOfDay = false) {
  if (!value) {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  if (/^\d{8}$/.test(text)) {
    const year = Number(text.slice(0, 4));
    const month = Number(text.slice(4, 6));
    const day = Number(text.slice(6, 8));
    const date = new Date(Date.UTC(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
    parsed.setUTCHours(23, 59, 59, 0);
  }
  return parsed;
}

function createFestivalExternalId(title, startDate, venueName, roadAddress) {
  const seed = `${title}|${startDate.toISOString()}|${venueName || ''}|${roadAddress || ''}`;
  const bytes = textEncoder.encode(seed);
  return `festival-${base64UrlEncode(bytes).slice(0, 22)}`;
}

function getFestivalWindowEnd(now) {
  return new Date(now + 30 * 24 * 60 * 60 * 1000);
}

function getFestivalCityKeyword(env) {
  const cityKeyword = String(env.APP_PUBLIC_EVENT_CITY_KEYWORD || '대전').trim();
  return cityKeyword || '대전';
}

function getFestivalAreaKeywords(cityKeyword) {
  const normalized = String(cityKeyword || '').trim();
  const keywords = new Set(normalized ? [normalized] : []);

  if (normalized.includes('대전')) {
    ['대전광역시', '동구', '중구', '서구', '유성구', '대덕구'].forEach((keyword) => keywords.add(keyword));
  }

  return [...keywords];
}

function isFestivalInTargetArea(payload, cityKeyword) {
  const haystack = [
    readFestivalText(payload, ['district', 'signguNm']),
    readFestivalText(payload, ['축제명', 'fstvlNm', 'eventNm', 'eventTitle']),
    readFestivalText(payload, ['개최장소', 'opar', 'venueName', 'fstvlCo']),
    readFestivalText(payload, ['소재지도로명주소', '소재지 도로명주소', 'rdnmadr', 'roadAddress']),
    readFestivalText(payload, ['소재지지번주소', 'lnmadr', 'address']),
  ]
    .filter(Boolean)
    .join(' ');

  return getFestivalAreaKeywords(cityKeyword).some((keyword) => haystack.includes(keyword));
}

function deriveFestivalDistrict(payload, cityKeyword) {
  const explicit = readFestivalText(payload, ['district', 'signguNm']);
  if (explicit) {
    return explicit;
  }

  const combined = [
    readFestivalText(payload, ['rdnmadr', 'roadAddress']),
    readFestivalText(payload, ['lnmadr', 'address']),
    readFestivalText(payload, ['opar', 'venueName', 'fstvlCo']),
  ]
    .filter(Boolean)
    .join(' ');
  const districtMatch = combined.match(/([가-힣]+구)/);
  return districtMatch?.[1] || cityKeyword;
}

function parseFestivalCoordinate(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeFestival(payload, cityKeyword) {
  if (!isFestivalInTargetArea(payload, cityKeyword)) {
    return null;
  }

  const title = readFestivalText(payload, ['fstvlNm', 'eventNm', 'eventTitle']);
  const venueName = readFestivalText(payload, ['opar', 'venueName', 'fstvlCo']);
  const startDate = parseFestivalDate(readFestivalText(payload, ['fstvlStartDate', 'eventStartDate', 'startDate']));
  const endDate = parseFestivalDate(readFestivalText(payload, ['fstvlEndDate', 'eventEndDate', 'endDate']), true);
  const homepageUrl = readFestivalText(payload, ['homepageUrl', 'homepage']);
  const roadAddress = readFestivalText(payload, ['rdnmadr', 'roadAddress']);
  const latitude = parseFestivalCoordinate(readFestivalText(payload, ['latitude', 'lat', 'mapY', 'y']));
  const longitude = parseFestivalCoordinate(readFestivalText(payload, ['longitude', 'lng', 'mapX', 'x']));

  if (!title || !startDate || !endDate) {
    return null;
  }

  if (endDate.getTime() < Date.now()) {
    return null;
  }

  return {
    externalId: readFestivalText(payload, ['eventId', 'id']) || createFestivalExternalId(title, startDate, venueName, roadAddress),
    title,
    venueName,
    district: deriveFestivalDistrict(payload, cityKeyword),
    roadAddress,
    startsAt: startDate.toISOString(),
    endsAt: endDate.toISOString(),
    homepageUrl,
    latitude,
    longitude,
    summary: venueName ? `${venueName}에서 열리는 ${cityKeyword} 축제예요.` : `${cityKeyword}에서 열리는 축제예요.`,
    rawPayload: payload,
  };
}

const DAEJEON_EVENT_SCHEDULE_BASE_URL = 'http://www.daejeon.go.kr';
const DAEJEON_EVENT_SCHEDULE_MENU_SEQ = '7419';
const DAEJEON_EVENT_DETAIL_MENU_SEQ = '4629';

function decodeHtmlText(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtmlTags(value) {
  return decodeHtmlText(String(value || '').replace(/<[^>]+>/g, ' '));
}

function buildDaejeonEventScheduleUrl(year, month) {
  return `${DAEJEON_EVENT_SCHEDULE_BASE_URL}/fvu/FvuEventDayScheduleList.do?menuSeq=${DAEJEON_EVENT_SCHEDULE_MENU_SEQ}&month=${month}&year=${year}`;
}

function buildDaejeonEventDetailUrl(eventSeq, menuSeq = DAEJEON_EVENT_DETAIL_MENU_SEQ) {
  return `${DAEJEON_EVENT_SCHEDULE_BASE_URL}/fvu/FvuEventView.do?eventSeq=${eventSeq}&menuSeq=${menuSeq}`;
}

function getFestivalWindowMonthKeys(nowDate, windowEndDate) {
  const keys = [];
  const cursor = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), 1));
  const last = new Date(Date.UTC(windowEndDate.getUTCFullYear(), windowEndDate.getUTCMonth(), 1));

  while (cursor.getTime() <= last.getTime()) {
    keys.push({ year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return keys;
}

function parseScheduleDateTime(value, endOfDay = false) {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim().replace(/\./g, '-');
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?$/);
  if (!match) {
    return parseFestivalDate(normalized, endOfDay);
  }

  const dateText = match[1];
  const timeText = match[2];
  return parseFestivalDate(timeText ? `${dateText}T${timeText}:00` : dateText, endOfDay && !timeText);
}

function parseDaejeonEventPeriod(periodText) {
  const parts = String(periodText || '').split('~').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    return { startsAt: null, endsAt: null };
  }

  const startsAt = parseScheduleDateTime(parts[0], false);
  const endsAt = parseScheduleDateTime(parts[1] || parts[0], true);
  return { startsAt, endsAt };
}

function extractDaejeonScheduleEventRefs(html, year, startTime, endTime) {
  const refs = new Map();
  const rowPattern = /<td class="day[^>]*">\s*(\d{2})\/(\d{2})\s*<\/td>[\s\S]*?<ul class="list02">([\s\S]*?)<\/ul>/g;
  let rowMatch;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const month = Number(rowMatch[1]);
    const day = Number(rowMatch[2]);
    const date = new Date(Date.UTC(year, month - 1, day));
    const dateTime = date.getTime();
    if (dateTime < startTime || dateTime > endTime) {
      continue;
    }

    const eventBlock = rowMatch[3];
    const eventPattern = /FvuEventView\.do\?eventSeq=(\d+)&amp;menuSeq=(\d+)[^>]*>\s*([\s\S]*?)\s*<\/a>/g;
    let eventMatch;

    while ((eventMatch = eventPattern.exec(eventBlock)) !== null) {
      const eventSeq = eventMatch[1];
      const menuSeq = eventMatch[2];
      const title = stripHtmlTags(eventMatch[3]);
      if (!title) {
        continue;
      }

      const existing = refs.get(eventSeq);
      if (!existing || dateTime < existing.date.getTime()) {
        refs.set(eventSeq, {
          eventSeq,
          menuSeq,
          title,
          date,
        });
      }
    }
  }

  return [...refs.values()].sort((left, right) => left.date.getTime() - right.date.getTime());
}

function extractDaejeonEventDetailValue(html, label) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`<strong>${escapedLabel}\\s*:\\s*<\\/strong>\\s*([\\s\\S]*?)<\\/li>`, 'i');
  const match = html.match(regex);
  return match ? stripHtmlTags(match[1]) : null;
}

function parseDaejeonEventDetail(html, eventRef) {
  const titleMatch = html.match(/<h4 class="event">행사명:\s*([\s\S]*?)\s*<span class="recommend">/i);
  const title = titleMatch ? stripHtmlTags(titleMatch[1]) : eventRef.title;
  const venueName = extractDaejeonEventDetailValue(html, '장소');
  const theme = extractDaejeonEventDetailValue(html, '테마');
  const organizer = extractDaejeonEventDetailValue(html, '주관');
  const periodLabel = extractDaejeonEventDetailValue(html, '기간');
  const contact = extractDaejeonEventDetailValue(html, '문의');
  const { startsAt, endsAt } = parseDaejeonEventPeriod(periodLabel);

  if (!title || !startsAt || !endsAt) {
    return null;
  }

  const summaryParts = [theme, venueName, organizer].filter(Boolean);

  return {
    externalId: `daejeon-event-${eventRef.eventSeq}`,
    title,
    venueName,
    district: '대전',
    roadAddress: venueName,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    homepageUrl: buildDaejeonEventDetailUrl(eventRef.eventSeq, eventRef.menuSeq),
    latitude: null,
    longitude: null,
    summary: summaryParts.length > 0 ? summaryParts.join(' · ') : '대전시 공식 행사안내 일정입니다.',
    rawPayload: {
      eventSeq: eventRef.eventSeq,
      menuSeq: eventRef.menuSeq,
      title,
      venueName,
      theme,
      organizer,
      periodLabel,
      contact,
    },
  };
}

async function syncFestivalsFromOfficialSchedule(env) {
  const nowDate = new Date();
  const windowEndDate = getFestivalWindowEnd(nowDate.getTime());
  const monthKeys = getFestivalWindowMonthKeys(nowDate, windowEndDate);
  const startTime = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());
  const endTime = Date.UTC(windowEndDate.getUTCFullYear(), windowEndDate.getUTCMonth(), windowEndDate.getUTCDate());

  const schedulePages = await Promise.all(
    monthKeys.map(async ({ year, month }) => {
      const url = buildDaejeonEventScheduleUrl(year, month);
      const response = await fetch(url, { headers: { Accept: 'text/html' } });
      if (!response.ok) {
        throw new Error(`대전시 행사안내 목록을 불러오지 못했어요. (${response.status})`);
      }
      return {
        url,
        refs: extractDaejeonScheduleEventRefs(await response.text(), year, startTime, endTime),
      };
    }),
  );

  const eventRefs = schedulePages.flatMap((page) => page.refs);
  const uniqueEventRefs = [...new Map(eventRefs.map((eventRef) => [eventRef.eventSeq, eventRef])).values()]
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .slice(0, 40);

  const detailedItems = await Promise.all(
    uniqueEventRefs.map(async (eventRef) => {
      const response = await fetch(buildDaejeonEventDetailUrl(eventRef.eventSeq, eventRef.menuSeq), {
        headers: { Accept: 'text/html' },
      });
      if (!response.ok) {
        return null;
      }
      return parseDaejeonEventDetail(await response.text(), eventRef);
    }),
  );

  return detailedItems.filter(Boolean);
}

async function ensureFestivalSource(env, requestUrl) {
  const rows = await supabaseRequest(env, 'public_data_source?select=source_id,source_key&source_key=eq.jamissue-public-event-feed&limit=1');
  if (rows?.[0]) {
    return rows[0];
  }

  const created = await supabaseRequest(env, 'public_data_source', {
    method: 'POST',
    body: JSON.stringify({
      source_key: 'jamissue-public-event-feed',
      provider: 'public-event',
      name: 'Daejeon City Event Schedule',
      source_url: requestUrl,
      last_imported_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  return Array.isArray(created) ? created[0] : created;
}

async function syncFestivalsFromSource(env) {
  const requestUrl = buildDaejeonEventScheduleUrl(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1);
  const items = await syncFestivalsFromOfficialSchedule(env);
  const source = await ensureFestivalSource(env, requestUrl);
  const sourceId = source.source_id;
  const existingRows = await supabaseRequest(env, `public_event?select=public_event_id,external_id&source_id=eq.${encodeFilterValue(sourceId)}`);
  const existingByExternalId = new Map((existingRows || []).map((row) => [String(row.external_id), row]));
  const seenExternalIds = new Set();
  const nowIso = new Date().toISOString();

  for (const item of items) {
    seenExternalIds.add(item.externalId);
    const existing = existingByExternalId.get(item.externalId);
    const body = {
      source_id: sourceId,
      external_id: item.externalId,
      title: item.title,
      venue_name: item.venueName,
      district: item.district,
      road_address: item.roadAddress,
      latitude: item.latitude,
      longitude: item.longitude,
      starts_at: item.startsAt,
      ends_at: item.endsAt,
      summary: item.summary,
      description: item.summary,
      source_page_url: item.homepageUrl,
      sync_status: 'imported',
      raw_payload: item.rawPayload,
      normalized_payload: {
        title: item.title,
        venue_name: item.venueName,
        road_address: item.roadAddress,
        starts_at: item.startsAt,
        ends_at: item.endsAt,
        homepage_url: item.homepageUrl,
        latitude: item.latitude,
        longitude: item.longitude,
      },
      updated_at: nowIso,
    };

    if (existing) {
      await supabaseRequest(env, `public_event?public_event_id=eq.${encodeFilterValue(existing.public_event_id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    } else {
      await supabaseRequest(env, 'public_event', {
        method: 'POST',
        body: JSON.stringify({ ...body, created_at: nowIso }),
      });
    }
  }

  const staleIds = (existingRows || [])
    .filter((row) => !seenExternalIds.has(String(row.external_id)))
    .map((row) => row.public_event_id);
  if (staleIds.length > 0) {
    await supabaseRequest(env, `public_event?public_event_id=in.(${staleIds.join(',')})`, {
      method: 'DELETE',
    });
  }

  await supabaseRequest(env, `public_data_source?source_id=eq.${encodeFilterValue(sourceId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      last_imported_at: nowIso,
      updated_at: nowIso,
    }),
  });

  return items;
}

async function handleFestivals(request, env) {
  const now = Date.now();
  if (festivalsCache.value && festivalsCache.expiresAt > now) {
    return jsonResponse(200, festivalsCache.value, env, request);
  }

  const festivals = await rememberPending(festivalsCache, async () => {
    if (festivalsCache.syncAt + FESTIVALS_CACHE_TTL_MS <= now) {
      try {
        await syncFestivalsFromSource(env);
        festivalsCache.syncAt = Date.now();
      } catch (error) {
        console.error('festival sync failed', error);
      }
    }

    const nowIso = new Date(now).toISOString();
    const windowEndIso = getFestivalWindowEnd(now).toISOString();
    const cityKeyword = getFestivalCityKeyword(env);
    const districtRows = await supabaseRequest(
      env,
      `public_event?select=public_event_id,title,venue_name,road_address,starts_at,ends_at,source_page_url,latitude,longitude&district=eq.${encodeFilterValue('대전')}&ends_at=gte.${encodeFilterValue(nowIso)}&starts_at=lte.${encodeFilterValue(windowEndIso)}&order=starts_at.asc&limit=40`,
    );
    const fallbackRows = await supabaseRequest(
      env,
      `public_event?select=public_event_id,title,venue_name,district,road_address,starts_at,ends_at,source_page_url,latitude,longitude&ends_at=gte.${encodeFilterValue(nowIso)}&starts_at=lte.${encodeFilterValue(windowEndIso)}&order=starts_at.asc&limit=100`,
    );
    const rows = [...(districtRows || []), ...(fallbackRows || [])].filter(
      (row, index, allRows) => allRows.findIndex((candidate) => candidate.public_event_id === row.public_event_id) === index,
    );
    const value = (rows || [])
      .filter((row) => {
        const startTime = new Date(row.starts_at).getTime();
        const endTime = new Date(row.ends_at).getTime();
        return (
          Number.isFinite(startTime) &&
          Number.isFinite(endTime) &&
          endTime >= now &&
          startTime <= getFestivalWindowEnd(now).getTime() &&
          isFestivalInTargetArea(row, cityKeyword)
        );
      })
      .slice(0, 10)
      .map((row) => ({
        id: String(row.public_event_id),
        title: row.title,
        venueName: row.venue_name ?? null,
        startDate: row.starts_at ? String(row.starts_at).slice(0, 10) : '',
        endDate: row.ends_at ? String(row.ends_at).slice(0, 10) : '',
        homepageUrl: row.source_page_url ?? null,
        roadAddress: row.road_address ?? null,
        latitude: parseFestivalCoordinate(row.latitude),
        longitude: parseFestivalCoordinate(row.longitude),
        isOngoing: new Date(row.starts_at).getTime() <= now && new Date(row.ends_at).getTime() >= now,
      }));

    festivalsCache = {
      ...festivalsCache,
      value: value,
      expiresAt: Date.now() + FESTIVALS_CACHE_TTL_MS,
      pending: null,
    };
    return value;
  });

  return jsonResponse(200, festivals, env, request);
}

async function handleBannerEvents(request, env) {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const windowEndIso = getFestivalWindowEnd(now).toISOString();
  const cityKeyword = getFestivalCityKeyword(env);
  const [districtEventRows, sourceRows] = await Promise.all([
    supabaseRequest(
      env,
      `public_event?select=public_event_id,title,venue_name,district,starts_at,ends_at,summary,source_page_url&district=eq.${encodeFilterValue('대전')}&ends_at=gte.${encodeFilterValue(nowIso)}&starts_at=lte.${encodeFilterValue(windowEndIso)}&order=starts_at.asc&limit=4`,
    ),
    supabaseRequest(env, 'public_data_source?select=name,last_imported_at&provider=eq.public-event&limit=1'),
  ]);

  const fallbackEventRows = await supabaseRequest(
    env,
    `public_event?select=public_event_id,title,venue_name,district,road_address,starts_at,ends_at,summary,source_page_url&ends_at=gte.${encodeFilterValue(nowIso)}&starts_at=lte.${encodeFilterValue(windowEndIso)}&order=starts_at.asc&limit=20`,
  );
  const eventRows = [...(districtEventRows || []), ...(fallbackEventRows || [])].filter(
    (row, index, allRows) => allRows.findIndex((candidate) => candidate.public_event_id === row.public_event_id) === index,
  );
  const source = sourceRows[0] ?? null;
  const items = eventRows.length > 0
    ? eventRows
      .filter((row) => isFestivalInTargetArea(row, cityKeyword))
      .slice(0, 4)
      .map((row) => ({
        id: String(row.public_event_id),
        title: row.title,
        venueName: row.venue_name ?? null,
        district: row.district ?? '',
        startDate: row.starts_at,
        endDate: row.ends_at,
        dateLabel: row.starts_at && row.ends_at ? `${formatDate(row.starts_at)} - ${formatDate(row.ends_at)}` : '일정 업데이트 전',
        summary: row.summary ?? '',
        sourcePageUrl: row.source_page_url ?? null,
        linkedPlaceName: null,
        isOngoing: new Date(row.starts_at).getTime() <= now && new Date(row.ends_at).getTime() >= now,
      }))
    : [];

  return jsonResponse(200, {
    sourceReady: items.length > 0 || Boolean(source?.last_imported_at),
    sourceName: source?.name ?? null,
    importedAt: source?.last_imported_at ?? null,
    items,
  }, env, request);
}

const INTERNAL_FESTIVAL_SOURCE_KEY = 'jamissue-public-event-feed';
const INTERNAL_FESTIVAL_SOURCE_NAME = 'Daejeon Official Event Search';
const INTERNAL_FESTIVAL_SOURCE_URL = 'https://www.daejeon.go.kr/fvu/FvuEventList.do?menuSeq=504';

function getTargetFestivalCityKeyword(env) {
  const cityKeyword = String(env.APP_PUBLIC_EVENT_CITY_KEYWORD || '대전').trim();
  return cityKeyword || '대전';
}

function getTargetFestivalAreaKeywords(cityKeyword) {
  const normalized = String(cityKeyword || '').trim();
  const keywords = new Set(normalized ? [normalized] : []);

  if (normalized.includes('대전')) {
    ['대전광역시', '동구', '중구', '서구', '유성구', '대덕구'].forEach((keyword) => keywords.add(keyword));
  }

  return [...keywords];
}

function isFestivalRowInTargetArea(payload, cityKeyword) {
  const haystack = [
    readFestivalText(payload, ['district', 'signguNm']),
    readFestivalText(payload, ['title', 'eventTitle', 'fstvlNm', 'eventNm']),
    readFestivalText(payload, ['venueName', 'venue_name', 'fstvlCo', 'opar']),
    readFestivalText(payload, ['roadAddress', 'road_address', 'rdnmadr']),
    readFestivalText(payload, ['address', 'lnmadr']),
  ]
    .filter(Boolean)
    .join(' ');

  return getTargetFestivalAreaKeywords(cityKeyword).some((keyword) => haystack.includes(keyword));
}

function deriveImportedFestivalDistrict(payload, cityKeyword) {
  const explicit = readFestivalText(payload, ['district', 'signguNm']);
  if (explicit) {
    return explicit;
  }

  const combined = [
    readFestivalText(payload, ['roadAddress', 'road_address', 'rdnmadr']),
    readFestivalText(payload, ['address', 'lnmadr']),
    readFestivalText(payload, ['venueName', 'venue_name', 'fstvlCo', 'opar']),
  ]
    .filter(Boolean)
    .join(' ');
  const districtMatch = combined.match(/([가-힣]+구)/);
  return districtMatch?.[1] || cityKeyword;
}

function readFestivalImportToken(env) {
  return String(env.APP_EVENT_IMPORT_TOKEN || '').trim();
}

function readBearerToken(request) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function normalizeFestivalImportItem(payload, cityKeyword) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const title = readFestivalText(payload, ['title', 'eventTitle', 'name']);
  const venueName = readFestivalText(payload, ['venueName', 'venue_name', 'placeName', 'location']);
  const roadAddress = readFestivalText(payload, ['roadAddress', 'road_address', 'address']);
  const startsAt = parseFestivalDate(readFestivalText(payload, ['startsAt', 'starts_at', 'startDate']));
  const endsAt = parseFestivalDate(readFestivalText(payload, ['endsAt', 'ends_at', 'endDate']), true);
  const homepageUrl = readFestivalText(payload, ['homepageUrl', 'homepage_url', 'sourcePageUrl', 'source_page_url']);
  const district = deriveImportedFestivalDistrict(
    {
      district: readFestivalText(payload, ['district']),
      signguNm: readFestivalText(payload, ['signguNm']),
      roadAddress,
      address: readFestivalText(payload, ['address']),
      venueName,
      title,
    },
    cityKeyword,
  );
  const latitude = parseFestivalCoordinate(readFestivalText(payload, ['latitude', 'lat']));
  const longitude = parseFestivalCoordinate(readFestivalText(payload, ['longitude', 'lng']));
  const sourceUpdatedAt = parseFestivalDate(readFestivalText(payload, ['sourceUpdatedAt', 'source_updated_at']));
  const areaProbe = {
    district,
    venueName,
    roadAddress,
    address: readFestivalText(payload, ['address']),
    title,
  };

  if (!title || !startsAt || !endsAt || !isFestivalRowInTargetArea(areaProbe, cityKeyword)) {
    return null;
  }

  return {
    externalId: readFestivalText(payload, ['externalId', 'external_id', 'eventSeq', 'id']) || createFestivalExternalId(title, startsAt, venueName, roadAddress),
    title,
    venueName,
    district,
    address: readFestivalText(payload, ['address']),
    roadAddress,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    homepageUrl,
    latitude,
    longitude,
    summary: readFestivalText(payload, ['summary', 'description']) || (venueName ? `${venueName}에서 열리는 ${cityKeyword} 행사예요.` : `${cityKeyword}에서 열리는 행사예요.`),
    rawPayload: payload.rawPayload && typeof payload.rawPayload === 'object' ? payload.rawPayload : payload,
    sourceUpdatedAt: sourceUpdatedAt ? sourceUpdatedAt.toISOString() : null,
  };
}

async function ensureImportedFestivalSource(env, requestUrl, sourceName) {
  const rows = await supabaseRequest(env, `public_data_source?select=source_id,source_key&source_key=eq.${encodeFilterValue(INTERNAL_FESTIVAL_SOURCE_KEY)}&limit=1`);
  if (rows?.[0]) {
    return rows[0];
  }

  const created = await supabaseRequest(env, 'public_data_source', {
    method: 'POST',
    body: JSON.stringify({
      source_key: INTERNAL_FESTIVAL_SOURCE_KEY,
      provider: 'public-event',
      name: sourceName,
      source_url: requestUrl,
      updated_at: new Date().toISOString(),
    }),
  });
  return Array.isArray(created) ? created[0] : created;
}

async function upsertImportedFestivalItems(env, items, options = {}) {
  const cityKeyword = getTargetFestivalCityKeyword(env);
  const normalizedItems = deduplicateImportedFestivalItemsByExternalId(mergeImportedFestivalItems((items || [])
    .map((item) => normalizeFestivalImportItem(item, cityKeyword))
    .filter(Boolean)));
  if (normalizedItems.length === 0) {
    throw new Error('No valid festival items were provided for import.');
  }

  const sourceName = String(options.sourceName || INTERNAL_FESTIVAL_SOURCE_NAME).trim() || INTERNAL_FESTIVAL_SOURCE_NAME;
  const requestUrl = String(options.sourceUrl || INTERNAL_FESTIVAL_SOURCE_URL).trim() || INTERNAL_FESTIVAL_SOURCE_URL;
  const importedAt = parseFestivalDate(options.importedAt)?.toISOString() || new Date().toISOString();
  const source = await ensureImportedFestivalSource(env, requestUrl, sourceName);
  const sourceId = source.source_id;
  const existingRows = await supabaseRequest(env, `public_event?select=public_event_id,external_id&source_id=eq.${encodeFilterValue(sourceId)}`);
  const seenExternalIds = new Set();
  const nowIso = new Date().toISOString();
  const upsertRows = [];

  for (const item of normalizedItems) {
    seenExternalIds.add(item.externalId);
    upsertRows.push({
      source_id: sourceId,
      external_id: item.externalId,
      title: item.title,
      venue_name: item.venueName,
      district: item.district,
      address: item.address,
      road_address: item.roadAddress,
      latitude: item.latitude,
      longitude: item.longitude,
      starts_at: item.startsAt,
      ends_at: item.endsAt,
      summary: item.summary,
      description: item.summary,
      source_page_url: item.homepageUrl,
      source_updated_at: item.sourceUpdatedAt,
      sync_status: 'imported',
      raw_payload: item.rawPayload,
      normalized_payload: {
        title: item.title,
        venue_name: item.venueName,
        address: item.address,
        road_address: item.roadAddress,
        starts_at: item.startsAt,
        ends_at: item.endsAt,
        homepage_url: item.homepageUrl,
        latitude: item.latitude,
        longitude: item.longitude,
      },
      updated_at: nowIso,
      created_at: nowIso,
    });
  }

  if (upsertRows.length > 0) {
    await supabaseRequest(env, 'public_event?on_conflict=source_id,external_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(upsertRows),
    });
  }

  const staleIds = (existingRows || [])
    .filter((row) => !seenExternalIds.has(String(row.external_id)))
    .map((row) => row.public_event_id);
  if (staleIds.length > 0) {
    await supabaseRequest(env, `public_event?public_event_id=in.(${staleIds.join(',')})`, {
      method: 'DELETE',
    });
  }

  await supabaseRequest(env, `public_data_source?source_id=eq.${encodeFilterValue(sourceId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: sourceName,
      source_url: requestUrl,
      last_imported_at: importedAt,
      updated_at: nowIso,
    }),
  });

  return normalizedItems;
}

async function loadFestivalRowsFromDb(env, nowIso, windowEndIso, limit = 100) {
  const rows = await supabaseRequest(
    env,
    `public_event?select=public_event_id,title,venue_name,district,address,road_address,starts_at,ends_at,summary,source_page_url,latitude,longitude&ends_at=gte.${encodeFilterValue(nowIso)}&starts_at=lte.${encodeFilterValue(windowEndIso)}&order=starts_at.asc&limit=${limit}`,
  );
  const cityKeyword = getTargetFestivalCityKeyword(env);
  return groupFestivalRowsBySeries((rows || []).filter((row) => isFestivalRowInTargetArea(row, cityKeyword)));
}

async function handleFestivalsFromDb(request, env) {
  const now = Date.now();
  if (festivalsCache.value && festivalsCache.expiresAt > now) {
    return jsonResponse(200, festivalsCache.value, env, request);
  }

  const festivals = await rememberPending(festivalsCache, async () => {
    const nowIso = new Date(now).toISOString();
    const windowEndIso = getFestivalWindowEnd(now).toISOString();
    const rows = await loadFestivalRowsFromDb(env, nowIso, windowEndIso, 100);
    const value = rows
      .filter((row) => {
        const startTime = new Date(row.starts_at).getTime();
        const endTime = new Date(row.ends_at).getTime();
        return Number.isFinite(startTime) && Number.isFinite(endTime) && endTime >= now && startTime <= getFestivalWindowEnd(now).getTime();
      })
      .slice(0, 10)
      .map((row) => ({
        id: String(row.public_event_id),
        title: row.title,
        venueName: row.venue_name ?? null,
        startDate: row.starts_at ? toSeoulDateKey(row.starts_at) : '',
        endDate: row.ends_at ? toSeoulDateKey(row.ends_at) : '',
        homepageUrl: row.source_page_url ?? null,
        roadAddress: row.road_address ?? row.address ?? null,
        latitude: parseFestivalCoordinate(row.latitude),
        longitude: parseFestivalCoordinate(row.longitude),
        isOngoing: isFestivalOngoingInSeoul(row.starts_at, row.ends_at, now),
      }));

    festivalsCache = {
      ...festivalsCache,
      value,
      expiresAt: Date.now() + FESTIVALS_CACHE_TTL_MS,
      pending: null,
    };
    return value;
  });

  return jsonResponse(200, festivals, env, request);
}

async function handleBannerEventsFromDb(request, env) {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const windowEndIso = getFestivalWindowEnd(now).toISOString();
  const [eventRows, sourceRows] = await Promise.all([
    loadFestivalRowsFromDb(env, nowIso, windowEndIso, 20),
    supabaseRequest(env, `public_data_source?select=name,last_imported_at&source_key=eq.${encodeFilterValue(INTERNAL_FESTIVAL_SOURCE_KEY)}&limit=1`),
  ]);
  const source = sourceRows[0] ?? null;
  const items = eventRows.length > 0
    ? eventRows
      .slice(0, 4)
      .map((row) => ({
        id: String(row.public_event_id),
        title: row.title,
        venueName: row.venue_name ?? null,
        district: row.district ?? '',
        startDate: row.starts_at,
        endDate: row.ends_at,
        dateLabel: row.starts_at && row.ends_at ? `${formatDate(row.starts_at)} - ${formatDate(row.ends_at)}` : '',
        summary: row.summary ?? '',
        sourcePageUrl: row.source_page_url ?? null,
        linkedPlaceName: null,
        isOngoing: isFestivalOngoingInSeoul(row.starts_at, row.ends_at, now),
      }))
    : [];

  return jsonResponse(200, {
    sourceReady: items.length > 0 || Boolean(source?.last_imported_at),
    sourceName: source?.name ?? null,
    importedAt: source?.last_imported_at ?? null,
    items,
  }, env, request);
}

async function handleFestivalImport(request, env) {
  const configuredToken = readFestivalImportToken(env);
  if (!configuredToken) {
    return jsonResponse(503, { detail: 'APP_EVENT_IMPORT_TOKEN is empty.' }, env, request);
  }

  const bearerToken = readBearerToken(request);
  if (!bearerToken || bearerToken !== configuredToken) {
    return jsonResponse(401, { detail: '공공 행사 import 토큰이 올바르지 않아요.' }, env, request);
  }

  const payload = await request.json().catch(() => null);
  if (!payload || !Array.isArray(payload.items)) {
    return jsonResponse(400, { detail: 'items 배열이 필요해요.' }, env, request);
  }

  const importedItems = await upsertImportedFestivalItems(env, payload.items, {
    sourceName: payload.sourceName,
    sourceUrl: payload.sourceUrl,
    importedAt: payload.importedAt,
  });
  festivalsCache = {
    expiresAt: 0,
    syncAt: Date.now(),
    value: null,
    pending: null,
  };

  return jsonResponse(200, {
    importedEvents: importedItems.length,
    sourceName: String(payload.sourceName || INTERNAL_FESTIVAL_SOURCE_NAME),
    importedAt: parseFestivalDate(payload.importedAt)?.toISOString() || new Date().toISOString(),
  }, env, request);
}

async function handleFestivalsLegacy(request, env) {
  const now = Date.now();
  if (festivalsCache.value && festivalsCache.expiresAt > now) {
    return jsonResponse(200, festivalsCache.value, env, request);
  }

  const festivals = await rememberPending(festivalsCache, async () => {
    const nowIso = new Date(now).toISOString();
    const windowEndIso = getFestivalWindowEnd(now).toISOString();
    const rows = await loadFestivalRowsFromDb(env, nowIso, windowEndIso, 100);
    const value = rows
      .filter((row) => {
        const startTime = new Date(row.starts_at).getTime();
        const endTime = new Date(row.ends_at).getTime();
        return Number.isFinite(startTime) && Number.isFinite(endTime) && endTime >= now && startTime <= getFestivalWindowEnd(now).getTime();
      })
      .slice(0, 10)
      .map((row) => ({
        id: String(row.public_event_id),
        title: row.title,
        venueName: row.venue_name ?? null,
        startDate: row.starts_at ? String(row.starts_at).slice(0, 10) : '',
        endDate: row.ends_at ? String(row.ends_at).slice(0, 10) : '',
        homepageUrl: row.source_page_url ?? null,
        roadAddress: row.road_address ?? row.address ?? null,
        latitude: parseFestivalCoordinate(row.latitude),
        longitude: parseFestivalCoordinate(row.longitude),
        isOngoing: new Date(row.starts_at).getTime() <= now && new Date(row.ends_at).getTime() >= now,
      }));

    festivalsCache = {
      ...festivalsCache,
      value,
      expiresAt: Date.now() + FESTIVALS_CACHE_TTL_MS,
      pending: null,
    };
    return value;
  });

  return jsonResponse(200, festivals, env, request);
}

async function handleBannerEventsLegacy(request, env) {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const windowEndIso = getFestivalWindowEnd(now).toISOString();
  const [eventRows, sourceRows] = await Promise.all([
    loadFestivalRowsFromDb(env, nowIso, windowEndIso, 20),
    supabaseRequest(env, `public_data_source?select=name,last_imported_at&source_key=eq.${encodeFilterValue(INTERNAL_FESTIVAL_SOURCE_KEY)}&limit=1`),
  ]);
  const source = sourceRows[0] ?? null;
  const items = eventRows.length > 0
    ? eventRows
      .slice(0, 4)
      .map((row) => ({
        id: String(row.public_event_id),
        title: row.title,
        venueName: row.venue_name ?? null,
        district: row.district ?? '',
        startDate: row.starts_at,
        endDate: row.ends_at,
        dateLabel: row.starts_at && row.ends_at ? `${formatDate(row.starts_at)} - ${formatDate(row.ends_at)}` : '일정 업데이트 예정',
        summary: row.summary ?? '',
        sourcePageUrl: row.source_page_url ?? null,
        linkedPlaceName: null,
        isOngoing: new Date(row.starts_at).getTime() <= now && new Date(row.ends_at).getTime() >= now,
      }))
    : [];

  return jsonResponse(200, {
    sourceReady: items.length > 0 || Boolean(source?.last_imported_at),
    sourceName: source?.name ?? null,
    importedAt: source?.last_imported_at ?? null,
    items,
  }, env, request);
}

function getStampUnlockRadius(env) {
  const parsed = Number(env.APP_STAMP_UNLOCK_RADIUS_METERS ?? '120');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 120;
}

function calculateDistanceMeters(startLatitude, startLongitude, endLatitude, endLongitude) {
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = ((endLatitude - startLatitude) * Math.PI) / 180;
  const longitudeDelta = ((endLongitude - startLongitude) * Math.PI) / 180;
  const startLatitudeRadians = (startLatitude * Math.PI) / 180;
  const endLatitudeRadians = (endLatitude * Math.PI) / 180;

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitudeRadians) * Math.cos(endLatitudeRadians) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMeters * (2 * Math.asin(Math.sqrt(haversine)));
}

function buildNearPlaceMessage(placeName, distanceMeters, unlockRadius) {
  return `${placeName}까지 ${formatDistanceMeters(distanceMeters)} 남았어요. 반경 ${unlockRadius}m 안에 들어오면 열려요.`;
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    throw new Error('요청 형식이 올바르지 않아요.');
  }
}

async function requireSessionUser(request, env) {
  const sessionUser = await readSessionUser(request, env);
  if (!sessionUser) {
    return { response: jsonResponse(401, { detail: '로그인이 필요해요.' }, env, request) };
  }
  return { sessionUser };
}

async function readFeedRow(env, reviewId) {
  const rows = await supabaseRequest(env, `feed?select=feed_id,position_id,user_id&feed_id=eq.${encodeFilterValue(reviewId)}&limit=1`);
  return rows?.[0] ?? null;
}

async function readCommentRow(env, commentId) {
  const rows = await supabaseRequest(env, `user_comment?select=comment_id,feed_id,user_id,parent_id,is_deleted&comment_id=eq.${encodeFilterValue(commentId)}&limit=1`);
  return rows?.[0] ?? null;
}

async function readRouteRow(env, routeId) {
  const rows = await supabaseRequest(env, `user_route?select=route_id,user_id,like_count&route_id=eq.${encodeFilterValue(routeId)}&limit=1`);
  return rows?.[0] ?? null;
}

async function readNotificationRow(env, notificationId) {
  const rows = await supabaseRequest(
    env,
    `user_notification?select=notification_id,user_id,actor_user_id,type,title,body,review_id,comment_id,route_id,is_read,created_at&notification_id=eq.${encodeFilterValue(notificationId)}&limit=1`,
  );
  return rows?.[0] ?? null;
}

async function createUserNotification(env, {
  userId,
  actorUserId = null,
  type,
  title,
  body = '',
  reviewId = null,
  commentId = null,
  routeId = null,
  metadata = {},
}) {
  if (!userId) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const rows = await supabaseRequest(env, 'user_notification?select=notification_id', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      actor_user_id: actorUserId,
      type,
      title,
      body,
      review_id: reviewId ? Number(reviewId) : null,
      comment_id: commentId ? Number(commentId) : null,
      route_id: routeId ? Number(routeId) : null,
      metadata,
      is_read: false,
      created_at: nowIso,
      updated_at: nowIso,
    }),
  });
  return rows?.[0] ?? null;
}

async function loadUserNotifications(env, userId, limit = 30) {
  const rows = await supabaseRequest(
    env,
    `user_notification?select=notification_id,user_id,actor_user_id,type,title,body,review_id,comment_id,route_id,is_read,created_at&user_id=eq.${encodeFilterValue(userId)}&order=created_at.desc&limit=${limit}`,
  );
  const actorIdsFilter = buildInFilter((rows || []).map((row) => row.actor_user_id).filter(Boolean));
  const actorRows = actorIdsFilter
    ? await supabaseRequest(env, `user?select=user_id,nickname&user_id=${actorIdsFilter}`)
    : [];
  const actorNameById = new Map((actorRows || []).map((row) => [row.user_id, row.nickname]));

  return (rows || []).map((row) => ({
    id: String(row.notification_id),
    type: row.type,
    title: row.title,
    body: row.body ?? '',
    createdAt: formatDateTime(row.created_at),
    isRead: Boolean(row.is_read),
    reviewId: row.review_id ? String(row.review_id) : null,
    commentId: row.comment_id ? String(row.comment_id) : null,
    routeId: row.route_id ? String(row.route_id) : null,
    actorName: row.actor_user_id ? actorNameById.get(row.actor_user_id) ?? null : null,
  }));
}

async function countUnreadNotifications(env, userId) {
  const rows = await supabaseRequest(
    env,
    `user_notification?select=notification_id&user_id=eq.${encodeFilterValue(userId)}&is_read=eq.false`,
  );
  return rows?.length ?? 0;
}

async function loadNotificationById(env, notificationId) {
  const row = await readNotificationRow(env, notificationId);
  if (!row) {
    return null;
  }
  let actorName = null;
  if (row.actor_user_id) {
    const actorRows = await supabaseRequest(
      env,
      `user?select=user_id,nickname&user_id=eq.${encodeFilterValue(row.actor_user_id)}&limit=1`,
    );
    actorName = actorRows?.[0]?.nickname ?? null;
  }
  return {
    id: String(row.notification_id),
    type: row.type,
    title: row.title,
    body: row.body ?? '',
    createdAt: formatDateTime(row.created_at),
    isRead: Boolean(row.is_read),
    reviewId: row.review_id ? String(row.review_id) : null,
    commentId: row.comment_id ? String(row.comment_id) : null,
    routeId: row.route_id ? String(row.route_id) : null,
    actorName,
  };
}

async function buildNotificationRealtimeTopic(env, userId) {
  const secret = getSigningSecret(env);
  if (!secret) {
    throw new Error('Notification realtime secret is missing.');
  }
  const signature = await sha256Base64Url(`${userId}:${secret}:notifications`);
  return `user-notifications:${userId}:${signature}`;
}

async function sendRealtimeBroadcast(env, topic, event, payload) {
  if (!env.APP_SUPABASE_URL) {
    return;
  }

  const apiKey = getSupabaseKey(env);
  if (!apiKey) {
    return;
  }

  await fetch(`${env.APP_SUPABASE_URL}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          topic,
          event,
          payload,
          private: false,
        },
      ],
    }),
  });
}

async function publishNotificationEvent(env, userId, event, payload) {
  const topic = await buildNotificationRealtimeTopic(env, userId);
  await sendRealtimeBroadcast(env, topic, event, payload);
}

async function handleMyNotifications(request, env) {
  const sessionResult = await requireSessionUser(request, env);
  if (sessionResult.response) {
    return sessionResult.response;
  }

  const notifications = await loadUserNotifications(env, sessionResult.sessionUser.id, 50);
  return jsonResponse(200, notifications, env, request);
}

async function handleNotificationRealtimeChannel(request, env) {
  const sessionResult = await requireSessionUser(request, env);
  if (sessionResult.response) {
    return sessionResult.response;
  }

  const topic = await buildNotificationRealtimeTopic(env, sessionResult.sessionUser.id);
  return jsonResponse(200, { topic }, env, request);
}

async function loadSingleReview(env, reviewId, sessionUserId = null) {
  const reviewRows = await supabaseRequest(
    env,
    `feed?select=feed_id,position_id,user_id,stamp_id,body,mood,badge,image_url,created_at&feed_id=eq.${encodeFilterValue(reviewId)}&limit=1`,
  );
  const reviewRow = reviewRows?.[0] ?? null;
  if (!reviewRow) {
    return null;
  }

  const [commentRows, likeRows, placeRows, stampRows, userFeedLikeRows = []] = await Promise.all([
    supabaseRequest(env, `user_comment?select=comment_id,feed_id,user_id,parent_id,body,is_deleted,created_at&feed_id=eq.${encodeFilterValue(reviewId)}&order=created_at.asc`),
    supabaseRequest(env, `feed_like?select=feed_id,user_id&feed_id=eq.${encodeFilterValue(reviewId)}`),
    supabaseRequest(env, `map?select=position_id,slug,name,district,category,latitude,longitude,summary,description,image_url,image_storage_path,vibe_tags,visit_time,route_hint,stamp_reward,hero_label,jam_color,accent_color,is_active&position_id=eq.${encodeFilterValue(reviewRow.position_id)}&limit=1`),
    reviewRow.stamp_id
      ? supabaseRequest(env, `user_stamp?select=stamp_id,user_id,position_id,travel_session_id,stamp_date,visit_ordinal,created_at&stamp_id=eq.${encodeFilterValue(reviewRow.stamp_id)}&limit=1`)
      : Promise.resolve([]),
    sessionUserId
      ? supabaseRequest(env, `feed_like?select=feed_id&user_id=eq.${encodeFilterValue(sessionUserId)}&feed_id=eq.${encodeFilterValue(reviewId)}&limit=1`)
      : Promise.resolve([]),
  ]);
  const reviewTravelSessionIds = [...new Set((stampRows ?? []).map((row) => row.travel_session_id).filter(Boolean).map((value) => String(value)))];
  const reviewRouteRows = reviewTravelSessionIds.length > 0
    ? await supabaseRequest(env, `user_route?select=route_id,travel_session_id&travel_session_id=${buildInFilter(reviewTravelSessionIds)}`)
    : [];

  const userIdsFilter = buildInFilter([reviewRow.user_id, ...commentRows.map((row) => row.user_id)]);
  const userRows = userIdsFilter
    ? await supabaseRequest(env, `user?select=user_id,nickname&user_id=${userIdsFilter}`)
    : [];

  const places = placeRows.map(mapPlace);
  const placesByPositionId = new Map(places.map((place) => [place.positionId, place]));
  const usersById = new Map(userRows.map((row) => [row.user_id, row]));
  const stampRowsById = new Map((stampRows ?? []).map((row) => [String(row.stamp_id), row]));
  const likedFeedIds = new Set((userFeedLikeRows ?? []).map((row) => String(row.feed_id)));

  return (
    mapReviewRows([reviewRow], commentRows ?? [], likeRows ?? [], usersById, placesByPositionId, stampRowsById, reviewRouteRows, likedFeedIds)[0] ??
    null
  );
}

function sanitizeFileName(fileName) {
  return String(fileName || 'upload.jpg').replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function buildPublicStorageUrl(env, objectPath) {
  const normalizedPath = objectPath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  return `${env.APP_SUPABASE_URL}/storage/v1/object/public/${env.APP_SUPABASE_STORAGE_BUCKET}/${normalizedPath}`;
}

async function uploadReviewFile(env, sessionUser, file) {
  if (!env.APP_SUPABASE_URL || !env.APP_SUPABASE_STORAGE_BUCKET) {
    throw new Error('Supabase Storage 설정이 비어 있어요.');
  }

  const storageKey = env.APP_SUPABASE_SERVICE_ROLE_KEY || getSupabaseKey(env);
  if (!storageKey) {
    throw new Error('Supabase Storage 권한 키가 비어 있어요.');
  }

  const safeFileName = sanitizeFileName(file.name);
  const objectPath = `reviews/${sessionUser.id.replace(/[^a-zA-Z0-9_-]+/g, '_')}/${Date.now()}-${safeFileName}`;
  const uploadUrl = `${env.APP_SUPABASE_URL}/storage/v1/object/${env.APP_SUPABASE_STORAGE_BUCKET}/${objectPath.split('/').map((segment) => encodeURIComponent(segment)).join('/')}`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      apikey: storageKey,
      Authorization: `Bearer ${storageKey}`,
      'x-upsert': 'true',
      'content-type': file.type || 'application/octet-stream',
    },
    body: file,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`이미지 업로드에 실패했어요. (${response.status}) ${detail}`);
  }

  return {
    url: buildPublicStorageUrl(env, objectPath),
    fileName: safeFileName,
    contentType: file.type || 'application/octet-stream',
  };
}

async function handleReviewUpload(request, env) {
  const sessionResult = await requireSessionUser(request, env);
  if (sessionResult.response) {
    return sessionResult.response;
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return jsonResponse(400, { detail: '업로드할 이미지 파일이 필요해요.' }, env, request);
  }
  if (!(file.type || '').startsWith('image/')) {
    return jsonResponse(400, { detail: '이미지 파일만 업로드할 수 있어요.' }, env, request);
  }

  const maxUploadSize = Number(env.APP_MAX_UPLOAD_SIZE_BYTES ?? '5242880');
  if (file.size > maxUploadSize) {
    return jsonResponse(413, { detail: '이미지는 5MB 이하로 올려 주세요.' }, env, request);
  }

  const uploaded = await uploadReviewFile(env, sessionResult.sessionUser, file);
  return jsonResponse(200, uploaded, env, request);
}

async function handleCreateReview(request, env) {
  const sessionResult = await requireSessionUser(request, env);
  if (sessionResult.response) {
    return sessionResult.response;
  }

  const payload = await readJsonBody(request);
  const placeId = String(payload.placeId ?? "").trim();
  const stampId = String(payload.stampId ?? "").trim();
  const body = String(payload.body ?? "").trim();
  const mood = String(payload.mood ?? "설렘").trim();
  const imageUrl = payload.imageUrl ? String(payload.imageUrl) : null;

  if (!placeId) {
    return jsonResponse(400, { detail: "장소 정보가 필요해요." }, env, request);
  }
  if (!stampId) {
    return jsonResponse(400, { detail: "피드를 쓰려면 해당 방문 스탬프가 필요해요." }, env, request);
  }
  if (!body) {
    return jsonResponse(400, { detail: "후기를 조금 더 적어 주세요." }, env, request);
  }

  const baseData = await loadBaseData(env, sessionResult.sessionUser.id);
  const place = baseData.places.find((item) => item.id === placeId);
  if (!place) {
    return jsonResponse(404, { detail: "장소를 찾지 못했어요." }, env, request);
  }
  const stampRows = await supabaseRequest(env, `user_stamp?select=stamp_id,user_id,position_id,travel_session_id,visit_ordinal,stamp_date,created_at&stamp_id=eq.${encodeFilterValue(stampId)}&limit=1`);
  const stampRow = stampRows?.[0] ?? null;
  if (!stampRow) {
    return jsonResponse(404, { detail: "방문 스탬프를 찾지 못했어요." }, env, request);
  }
  if (stampRow.user_id !== sessionResult.sessionUser.id || String(stampRow.position_id) !== String(place.positionId)) {
    return jsonResponse(403, { detail: "해당 장소의 방문 스탬프가 확인되어야 피드를 쓸 수 있어요." }, env, request);
  }

  const insertedRows = await supabaseRequest(env, "feed?select=feed_id", {
    method: "POST",
    body: JSON.stringify({
      position_id: Number(place.positionId),
      user_id: sessionResult.sessionUser.id,
      stamp_id: Number(stampId),
      body,
      mood,
      badge: BADGE_BY_MOOD[mood] ?? "\uD604\uC7A5 \uBC29\uBB38",
      image_url: imageUrl,
    }),
  });

  const createdReview = await loadSingleReview(env, insertedRows?.[0]?.feed_id, sessionResult.sessionUser.id);
  const createdNotification = await createUserNotification(env, {
    userId: sessionResult.sessionUser.id,
    actorUserId: sessionResult.sessionUser.id,
    type: 'review-created',
    title: '피드 작성이 완료되었습니다.',
    body: `${place.name} 피드를 남겼어요.`,
    reviewId: insertedRows?.[0]?.feed_id ?? null,
    metadata: {
      placeId: place.id,
    },
  });
  if (createdNotification?.notification_id) {
    const notification = await loadNotificationById(env, createdNotification.notification_id);
    if (notification) {
      await publishNotificationEvent(env, sessionResult.sessionUser.id, 'notification.created', {
        notification,
        unreadCount: await countUnreadNotifications(env, sessionResult.sessionUser.id),
      });
    }
  }
  return jsonResponse(201, createdReview, env, request);
}

async function handleUpdateReview(request, env, reviewId) {
  const sessionResult = await requireSessionUser(request, env);
  if (sessionResult.response) {
    return sessionResult.response;
  }

  const reviewRow = await readFeedRow(env, reviewId);
  if (!reviewRow) {
    return jsonResponse(404, { detail: '?꾧린瑜?李얠? 紐삵뻽?댁슂.' }, env, request);
  }
  if (reviewRow.user_id !== sessionResult.sessionUser.id) {
    return jsonResponse(403, { detail: '?닿? ?묒꽦???쇰뱶留? ?섏젙?????덉뼱??' }, env, request);
  }

  const payload = await readJsonBody(request);
  const body = String(payload.body ?? '').trim();
  const mood = String(payload.mood ?? '').trim();

  if (!body) {
    return jsonResponse(400, { detail: '?꾧린瑜?議곌툑 ???곸뼱 二쇱꽭??' }, env, request);
  }
  if (!mood) {
    return jsonResponse(400, { detail: '?붾뱶 湲곕텇???좏깮?댁＜?몄슂.' }, env, request);
  }

  await supabaseRequest(env, `feed?feed_id=eq.${encodeFilterValue(reviewId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      body,
      mood,
      badge: BADGE_BY_MOOD[mood] ?? '\uD604\uC7A5 \uBC29\uBB38',
      updated_at: new Date().toISOString(),
    }),
  });

  const updatedReview = await loadSingleReview(env, reviewId, sessionResult.sessionUser.id);
  return jsonResponse(200, updatedReview, env, request);
}

async function handleCreateComment(request, env, reviewId) {
  const sessionResult = await requireSessionUser(request, env);
  if (sessionResult.response) {
    return sessionResult.response;
  }

  const reviewRow = await readFeedRow(env, reviewId);
  if (!reviewRow) {
    return jsonResponse(404, { detail: '후기를 찾지 못했어요.' }, env, request);
  }

  const payload = await readJsonBody(request);
  const body = String(payload.body ?? '').trim();
  let parentId = payload.parentId ? Number(payload.parentId) : null;
  let parentComment = null;
  if (!body) {
    return jsonResponse(400, { detail: '댓글을 조금 더 적어 주세요.' }, env, request);
  }

  if (parentId) {
    parentComment = await readCommentRow(env, parentId);
    if (!parentComment || String(parentComment.feed_id) !== String(reviewId)) {
      return jsonResponse(400, { detail: '같은 후기 안의 댓글에만 답글을 달 수 있어요.' }, env, request);
    }
    if (parentComment.parent_id) {
      parentId = Number(parentComment.parent_id);
    }
  }

  const insertedRows = await supabaseRequest(env, 'user_comment?select=comment_id', {
    method: 'POST',
    body: JSON.stringify({
      feed_id: Number(reviewId),
      user_id: sessionResult.sessionUser.id,
      parent_id: parentId,
      body,
      is_deleted: false,
    }),
  });

  const createdCommentId = insertedRows?.[0]?.comment_id ?? null;
  const actorUserId = sessionResult.sessionUser.id;
  const reviewOwnerId = reviewRow.user_id;

  if (parentComment && parentComment.user_id && parentComment.user_id !== actorUserId) {
    const createdNotification = await createUserNotification(env, {
      userId: parentComment.user_id,
      actorUserId,
      type: 'comment-reply',
      title: '내 댓글에 답글이 달렸습니다.',
      body,
      reviewId,
      commentId: createdCommentId,
    });
    if (createdNotification?.notification_id) {
      const notification = await loadNotificationById(env, createdNotification.notification_id);
      if (notification) {
        await publishNotificationEvent(env, parentComment.user_id, 'notification.created', {
          notification,
          unreadCount: await countUnreadNotifications(env, parentComment.user_id),
        });
      }
    }
  }

  if (
    reviewOwnerId
    && reviewOwnerId !== actorUserId
    && (!parentComment || parentComment.user_id !== reviewOwnerId)
  ) {
    const createdNotification = await createUserNotification(env, {
      userId: reviewOwnerId,
      actorUserId,
      type: 'review-comment',
      title: '내 피드에 댓글이 달렸습니다.',
      body,
      reviewId,
      commentId: createdCommentId,
    });
    if (createdNotification?.notification_id) {
      const notification = await loadNotificationById(env, createdNotification.notification_id);
      if (notification) {
        await publishNotificationEvent(env, reviewOwnerId, 'notification.created', {
          notification,
          unreadCount: await countUnreadNotifications(env, reviewOwnerId),
        });
      }
    }
  }

  const comments = (await loadSingleReview(env, reviewId, sessionResult.sessionUser.id))?.comments ?? [];
  return jsonResponse(200, comments, env, request);
}

async function handleUpdateComment(request, env, reviewId, commentId) {
  const sessionResult = await requireSessionUser(request, env);
  if (sessionResult.response) {
    return sessionResult.response;
  }

  const reviewRow = await readFeedRow(env, reviewId);
  if (!reviewRow) {
    return jsonResponse(404, { detail: '후기를 찾지 못했어요.' }, env, request);
  }

  const commentRow = await readCommentRow(env, commentId);
  if (!commentRow || String(commentRow.feed_id) !== String(reviewId)) {
    return jsonResponse(404, { detail: '댓글을 찾지 못했어요.' }, env, request);
  }
  if (commentRow.user_id !== sessionResult.sessionUser.id) {
    return jsonResponse(403, { detail: '내 댓글만 수정할 수 있어요.' }, env, request);
  }
  if (commentRow.is_deleted) {
    return jsonResponse(400, { detail: '삭제된 댓글은 수정할 수 없어요.' }, env, request);
  }

  const payload = await readJsonBody(request);
  const body = String(payload.body ?? '').trim();
  if (!body) {
    return jsonResponse(400, { detail: '댓글을 조금 더 적어 주세요.' }, env, request);
  }

  await supabaseRequest(env, `user_comment?comment_id=eq.${encodeFilterValue(commentId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      body,
      updated_at: new Date().toISOString(),
    }),
  });

  const comments = (await loadSingleReview(env, reviewId, sessionResult.sessionUser.id))?.comments ?? [];
  return jsonResponse(200, comments, env, request);
}

async function handleDeleteComment(request, env, reviewId, commentId) {
  const sessionResult = await requireSessionUser(request, env);
  if (sessionResult.response) {
    return sessionResult.response;
  }

  const reviewRow = await readFeedRow(env, reviewId);
  if (!reviewRow) {
    return jsonResponse(404, { detail: '후기를 찾지 못했어요.' }, env, request);
  }

  const commentRow = await readCommentRow(env, commentId);
  if (!commentRow || String(commentRow.feed_id) !== String(reviewId)) {
    return jsonResponse(404, { detail: '댓글을 찾지 못했어요.' }, env, request);
  }
  if (commentRow.user_id !== sessionResult.sessionUser.id) {
    return jsonResponse(403, { detail: '내 댓글만 삭제할 수 있어요.' }, env, request);
  }

  await supabaseRequest(env, `user_comment?comment_id=eq.${encodeFilterValue(commentId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      body: '[deleted]',
      is_deleted: true,
      updated_at: new Date().toISOString(),
    }),
  });

  const comments = (await loadSingleReview(env, reviewId, sessionResult.sessionUser.id))?.comments ?? [];
  return jsonResponse(200, comments, env, request);
}

async function handleDeleteReview(request, env, reviewId) {
  const sessionResult = await requireSessionUser(request, env);
  if (sessionResult.response) {
    return sessionResult.response;
  }

  const reviewRow = await readFeedRow(env, reviewId);
  if (!reviewRow) {
    return jsonResponse(404, { detail: '후기를 찾지 못했어요.' }, env, request);
  }
  if (reviewRow.user_id !== sessionResult.sessionUser.id) {
    return jsonResponse(403, { detail: '내가 쓴 피드만 삭제할 수 있어요.' }, env, request);
  }

  await supabaseRequest(env, `feed?feed_id=eq.${encodeFilterValue(reviewId)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });

  return jsonResponse(200, { reviewId: String(reviewId), deleted: true }, env, request);
}

async function handleToggleReviewLike(request, env, reviewId) {
  const sessionResult = await requireSessionUser(request, env);
  if (sessionResult.response) {
    return sessionResult.response;
  }

  const reviewRow = await readFeedRow(env, reviewId);
  if (!reviewRow) {
    return jsonResponse(404, { detail: '후기를 찾지 못했어요.' }, env, request);
  }

  const existingRows = await supabaseRequest(
    env,
    `feed_like?select=feed_like_id&feed_id=eq.${encodeFilterValue(reviewId)}&user_id=eq.${encodeFilterValue(sessionResult.sessionUser.id)}&limit=1`,
  );
  const existing = existingRows?.[0] ?? null;

  if (existing) {
    await supabaseRequest(env, `feed_like?feed_like_id=eq.${encodeFilterValue(existing.feed_like_id)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });
  } else {
    await supabaseRequest(env, 'feed_like?select=feed_like_id', {
      method: 'POST',
      body: JSON.stringify({
        feed_id: Number(reviewId),
        user_id: sessionResult.sessionUser.id,
      }),
    });
  }

  const likeRows = await supabaseRequest(env, `feed_like?select=feed_like_id&feed_id=eq.${encodeFilterValue(reviewId)}`);
  return jsonResponse(200, {
    reviewId: String(reviewId),
    likeCount: likeRows.length,
    likedByMe: !existing,
  }, env, request);
}

async function handleToggleStamp(request, env) {
  const sessionResult = await requireSessionUser(request, env);
  if (sessionResult.response) {
    return sessionResult.response;
  }

  const payload = await readJsonBody(request);
  const placeId = String(payload.placeId ?? "").trim();
  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);
  if (!placeId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return jsonResponse(400, { detail: "장소와 현재 좌표가 필요해요." }, env, request);
  }

  const baseData = await loadBaseData(env, sessionResult.sessionUser.id);
  const place = baseData.places.find((item) => item.id === placeId);
  if (!place) {
    return jsonResponse(404, { detail: "장소를 찾지 못했어요." }, env, request);
  }

  const distanceMeters = calculateDistanceMeters(latitude, longitude, place.latitude, place.longitude);
  const unlockRadius = getStampUnlockRadius(env);
  if (distanceMeters > unlockRadius) {
    return jsonResponse(403, { detail: buildNearPlaceMessage(place.name, distanceMeters, unlockRadius) }, env, request);
  }

  const stampDate = toSeoulDateKey();
  const existingTodayRows = await supabaseRequest(env, `user_stamp?select=stamp_id&user_id=eq.${encodeFilterValue(sessionResult.sessionUser.id)}&position_id=eq.${encodeFilterValue(place.positionId)}&stamp_date=eq.${encodeFilterValue(stampDate)}&limit=1`);
  if (existingTodayRows?.[0]) {
    const nextBaseData = await loadBaseData(env, sessionResult.sessionUser.id);
    return jsonResponse(200, {
      collectedPlaceIds: nextBaseData.collectedPlaceIds,
      logs: nextBaseData.stampLogs,
      travelSessions: nextBaseData.travelSessions,
    }, env, request);
  }

  const nowIso = new Date().toISOString();
  const placeStampRows = await supabaseRequest(env, `user_stamp?select=stamp_id&user_id=eq.${encodeFilterValue(sessionResult.sessionUser.id)}&position_id=eq.${encodeFilterValue(place.positionId)}`);
  const visitOrdinal = (placeStampRows?.length ?? 0) + 1;

  const lastStampRows = await supabaseRequest(env, `user_stamp?select=stamp_id,travel_session_id,created_at&user_id=eq.${encodeFilterValue(sessionResult.sessionUser.id)}&order=created_at.desc&limit=1`);
  const lastStampRow = lastStampRows?.[0] ?? null;
  let travelSessionId = null;

  if (lastStampRow) {
    const gapMs = new Date(nowIso).getTime() - new Date(lastStampRow.created_at).getTime();
    if (gapMs <= 1000 * 60 * 60 * 24) {
      if (lastStampRow.travel_session_id) {
        travelSessionId = Number(lastStampRow.travel_session_id);
        const sessionRows = await supabaseRequest(env, `travel_session?select=stamp_count&travel_session_id=eq.${encodeFilterValue(travelSessionId)}&limit=1`);
        const sessionRow = sessionRows?.[0] ?? null;
        await supabaseRequest(env, `travel_session?travel_session_id=eq.${encodeFilterValue(travelSessionId)}`, {
          method: "PATCH",
          body: JSON.stringify({
            ended_at: nowIso,
            last_stamp_at: nowIso,
            stamp_count: Number(sessionRow?.stamp_count ?? 0) + 1,
            updated_at: nowIso,
          }),
        });
      } else {
        const createdSessions = await supabaseRequest(env, "travel_session?select=travel_session_id", {
          method: "POST",
          body: JSON.stringify({
            user_id: sessionResult.sessionUser.id,
            started_at: lastStampRow.created_at,
            ended_at: nowIso,
            last_stamp_at: nowIso,
            stamp_count: 2,
            created_at: nowIso,
            updated_at: nowIso,
          }),
        });
        travelSessionId = Number(createdSessions?.[0]?.travel_session_id);
        await supabaseRequest(env, `user_stamp?stamp_id=eq.${encodeFilterValue(lastStampRow.stamp_id)}`, {
          method: "PATCH",
          body: JSON.stringify({ travel_session_id: travelSessionId }),
        });
      }
    }
  }

  if (!travelSessionId) {
    const createdSessions = await supabaseRequest(env, "travel_session?select=travel_session_id", {
      method: "POST",
      body: JSON.stringify({
        user_id: sessionResult.sessionUser.id,
        started_at: nowIso,
        ended_at: nowIso,
        last_stamp_at: nowIso,
        stamp_count: 1,
        created_at: nowIso,
        updated_at: nowIso,
      }),
    });
    travelSessionId = Number(createdSessions?.[0]?.travel_session_id);
  }

  await supabaseRequest(env, "user_stamp?select=stamp_id", {
    method: "POST",
    body: JSON.stringify({
      user_id: sessionResult.sessionUser.id,
      position_id: Number(place.positionId),
      travel_session_id: travelSessionId,
      stamp_date: stampDate,
      visit_ordinal: visitOrdinal,
      created_at: nowIso,
    }),
  });

  const nextBaseData = await loadBaseData(env, sessionResult.sessionUser.id);
  return jsonResponse(200, {
    collectedPlaceIds: nextBaseData.collectedPlaceIds,
    logs: nextBaseData.stampLogs,
    travelSessions: nextBaseData.travelSessions,
  }, env, request);
}
async function handleCreateUserRoute(request, env) {
  const sessionResult = await requireSessionUser(request, env);
  if (sessionResult.response) {
    return sessionResult.response;
  }

  const payload = await readJsonBody(request);
  const travelSessionId = String(payload.travelSessionId ?? "").trim();
  const title = String(payload.title ?? "").trim();
  const description = String(payload.description ?? "").trim();
  const mood = String(payload.mood ?? "").trim();
  const isPublic = payload.isPublic !== false;

  if (!travelSessionId) {
    return jsonResponse(400, { detail: "방향을 묶을 여행 세션이 필요해요." }, env, request);
  }
  if (!title) {
    return jsonResponse(400, { detail: "경로 제목을 적어 주세요." }, env, request);
  }
  if (!description) {
    return jsonResponse(400, { detail: "한 줄 소개를 적어 주세요." }, env, request);
  }

  const sessionRows = await supabaseRequest(env, `travel_session?select=travel_session_id,user_id&travel_session_id=eq.${encodeFilterValue(travelSessionId)}&user_id=eq.${encodeFilterValue(sessionResult.sessionUser.id)}&limit=1`);
  if (!sessionRows?.[0]) {
    return jsonResponse(404, { detail: "여행 세션을 찾지 못했어요." }, env, request);
  }

  const existingRouteRows = await supabaseRequest(env, `user_route?select=route_id&user_id=eq.${encodeFilterValue(sessionResult.sessionUser.id)}&travel_session_id=eq.${encodeFilterValue(travelSessionId)}&limit=1`);
  if (existingRouteRows?.[0]) {
    return jsonResponse(409, { detail: "이미 발행한 여행 코스예요." }, env, request);
  }

  const sessionStampRows = await supabaseRequest(env, `user_stamp?select=position_id,created_at&travel_session_id=eq.${encodeFilterValue(travelSessionId)}&user_id=eq.${encodeFilterValue(sessionResult.sessionUser.id)}&order=created_at.asc`);
  const orderedPositionIds = [];
  const seenPositionIds = new Set();
  for (const stampRow of sessionStampRows ?? []) {
    const positionId = String(stampRow.position_id);
    if (seenPositionIds.has(positionId)) {
      continue;
    }
    seenPositionIds.add(positionId);
    orderedPositionIds.push(positionId);
  }
  if (orderedPositionIds.length < 2) {
    return jsonResponse(400, { detail: "코스에는 최소 두 곳 이상의 스탬프 기록이 필요해요." }, env, request);
  }

  const routeRows = await supabaseRequest(env, "user_route?select=route_id", {
    method: "POST",
    body: JSON.stringify({
      user_id: sessionResult.sessionUser.id,
      travel_session_id: Number(travelSessionId),
      title,
      description,
      mood,
      is_public: isPublic,
      is_user_generated: true,
      like_count: 0,
    }),
  });
  const routeId = routeRows?.[0]?.route_id;

  await supabaseRequest(env, "user_route_place?select=user_route_place_id", {
    method: "POST",
    body: JSON.stringify(orderedPositionIds.map((positionId, index) => ({
      route_id: Number(routeId),
      position_id: Number(positionId),
      stop_order: index + 1,
    }))),
  });

  const routes = await loadCommunityRoutes(env, { ownerUserId: sessionResult.sessionUser.id, sessionUserId: sessionResult.sessionUser.id });
  const createdRoute = routes.find((route) => route.id === String(routeId)) ?? null;
  const createdNotification = await createUserNotification(env, {
    userId: sessionResult.sessionUser.id,
    actorUserId: sessionResult.sessionUser.id,
    type: 'route-published',
    title: '새로운 코스가 발행되었습니다.',
    body: title,
    routeId,
    metadata: {
      travelSessionId,
    },
  });
  if (createdNotification?.notification_id) {
    const notification = await loadNotificationById(env, createdNotification.notification_id);
    if (notification) {
      await publishNotificationEvent(env, sessionResult.sessionUser.id, 'notification.created', {
        notification,
        unreadCount: await countUnreadNotifications(env, sessionResult.sessionUser.id),
      });
    }
  }
  return jsonResponse(201, createdRoute, env, request);
}

async function handleMarkNotificationRead(request, env, notificationId) {
  const sessionResult = await requireSessionUser(request, env);
  if (sessionResult.response) {
    return sessionResult.response;
  }

  const notificationRow = await readNotificationRow(env, notificationId);
  if (!notificationRow) {
    return jsonResponse(404, { detail: '알림을 찾지 못했어요.' }, env, request);
  }
  if (notificationRow.user_id !== sessionResult.sessionUser.id) {
    return jsonResponse(403, { detail: '내 알림만 확인할 수 있어요.' }, env, request);
  }

  if (!notificationRow.is_read) {
    const nowIso = new Date().toISOString();
    await supabaseRequest(env, `user_notification?notification_id=eq.${encodeFilterValue(notificationId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        is_read: true,
        read_at: nowIso,
        updated_at: nowIso,
      }),
    });
    await publishNotificationEvent(env, sessionResult.sessionUser.id, 'notification.read', {
      notificationId: String(notificationId),
      unreadCount: await countUnreadNotifications(env, sessionResult.sessionUser.id),
    });
  }

  return jsonResponse(200, {
    notificationId: String(notificationId),
    read: true,
  }, env, request);
}

async function handleMarkAllNotificationsRead(request, env) {
  const sessionResult = await requireSessionUser(request, env);
  if (sessionResult.response) {
    return sessionResult.response;
  }

  const unreadRows = await supabaseRequest(
    env,
    `user_notification?select=notification_id&user_id=eq.${encodeFilterValue(sessionResult.sessionUser.id)}&is_read=eq.false`,
  );
  const updated = unreadRows?.length ?? 0;

  if (updated > 0) {
    const nowIso = new Date().toISOString();
    await supabaseRequest(
      env,
      `user_notification?user_id=eq.${encodeFilterValue(sessionResult.sessionUser.id)}&is_read=eq.false`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          is_read: true,
          read_at: nowIso,
          updated_at: nowIso,
        }),
      },
    );
    await publishNotificationEvent(env, sessionResult.sessionUser.id, 'notification.all-read', {
      updated,
      unreadCount: 0,
    });
  }

  return jsonResponse(200, { updated }, env, request);
}

async function handleDeleteNotification(request, env, notificationId) {
  const sessionResult = await requireSessionUser(request, env);
  if (sessionResult.response) {
    return sessionResult.response;
  }

  const notificationRow = await readNotificationRow(env, notificationId);
  if (!notificationRow) {
    return jsonResponse(404, { detail: '알림을 찾지 못했어요.' }, env, request);
  }
  if (notificationRow.user_id !== sessionResult.sessionUser.id) {
    return jsonResponse(403, { detail: '내 알림만 삭제할 수 있어요.' }, env, request);
  }

  await supabaseRequest(env, `user_notification?notification_id=eq.${encodeFilterValue(notificationId)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  await publishNotificationEvent(env, sessionResult.sessionUser.id, 'notification.deleted', {
    notificationId: String(notificationId),
    unreadCount: await countUnreadNotifications(env, sessionResult.sessionUser.id),
  });

  return jsonResponse(200, {
    notificationId: String(notificationId),
    deleted: true,
  }, env, request);
}

async function handleToggleCommunityRouteLike(request, env, routeId) {
  const sessionResult = await requireSessionUser(request, env);
  if (sessionResult.response) {
    return sessionResult.response;
  }

  const routeRow = await readRouteRow(env, routeId);
  if (!routeRow) {
    return jsonResponse(404, { detail: '경로를 찾지 못했어요.' }, env, request);
  }
  const existingRows = await supabaseRequest(
    env,
    `user_route_like?select=route_like_id&route_id=eq.${encodeFilterValue(routeId)}&user_id=eq.${encodeFilterValue(sessionResult.sessionUser.id)}&limit=1`,
  );
  const existing = existingRows?.[0] ?? null;

  if (existing) {
    await supabaseRequest(env, `user_route_like?route_like_id=eq.${encodeFilterValue(existing.route_like_id)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });
  } else {
    await supabaseRequest(env, 'user_route_like?select=route_like_id', {
      method: 'POST',
      body: JSON.stringify({
        route_id: Number(routeId),
        user_id: sessionResult.sessionUser.id,
      }),
    });
  }

  const likeRows = await supabaseRequest(env, `user_route_like?select=route_like_id&route_id=eq.${encodeFilterValue(routeId)}`);
  const likeCount = likeRows.length;
  await supabaseRequest(env, `user_route?route_id=eq.${encodeFilterValue(routeId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      like_count: likeCount,
      updated_at: new Date().toISOString(),
    }),
  });

  return jsonResponse(200, {
    routeId: String(routeId),
    likeCount,
    likedByMe: !existing,
  }, env, request);
}

function resolveOriginUrl(request, env) {
  const originBaseUrl = (env.APP_ORIGIN_API_URL ?? '').trim();
  if (!originBaseUrl) {
    return null;
  }
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(originBaseUrl);
  upstreamUrl.pathname = incomingUrl.pathname;
  upstreamUrl.search = incomingUrl.search;
  return upstreamUrl;
}

function buildProxyHeaders(request) {
  const incomingUrl = new URL(request.url);
  const headers = new Headers(request.headers);
  headers.set('x-forwarded-host', incomingUrl.host);
  headers.set('x-forwarded-proto', incomingUrl.protocol.replace(':', ''));
  headers.set('x-forwarded-for', headers.get('cf-connecting-ip') ?? '');
  return headers;
}

async function proxyToOrigin(request, env) {
  const upstreamUrl = resolveOriginUrl(request, env);
  if (!upstreamUrl) {
    return jsonResponse(501, { detail: '이 기능은 아직 Worker 브랜치에서 직접 구현되지 않았어요.' }, env, request);
  }

  const init = {
    method: request.method,
    headers: buildProxyHeaders(request),
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
  }

  const upstreamResponse = await fetch(upstreamUrl.toString(), init);
  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.set('cache-control', 'no-store');
  applyCorsHeaders(responseHeaders, env, request);
  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}

async function routeRequest(request, env) {
  const url = new URL(request.url);
  const reviewCommentMatch = url.pathname.match(/^\/api\/reviews\/(\d+)\/comments$/);
  const reviewCommentDetailMatch = url.pathname.match(/^\/api\/reviews\/(\d+)\/comments\/(\d+)$/);
  const reviewLikeMatch = url.pathname.match(/^\/api\/reviews\/(\d+)\/like$/);
  const reviewDetailMatch = url.pathname.match(/^\/api\/reviews\/(\d+)$/);
  const communityRouteLikeMatch = url.pathname.match(/^\/api\/community-routes\/(\d+)\/like$/);
  const notificationReadMatch = url.pathname.match(/^\/api\/notifications\/(\d+)\/read$/);
  const notificationDetailMatch = url.pathname.match(/^\/api\/notifications\/(\d+)$/);
  const adminPlaceMatch = url.pathname.match(/^\/api\/admin\/places\/([^/]+)$/);

  if (request.method === "OPTIONS") {
    return handlePreflight(env, request);
  }
  if (request.method === "GET" && url.pathname === "/api/health") {
    return handleHealth(request, env);
  }
  if (request.method === "GET" && url.pathname === "/api/auth/providers") {
    return handleAuthProviders(request, env);
  }
  if (request.method === "GET" && url.pathname === "/api/auth/me") {
    return handleAuthSession(request, env);
  }
  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    return handleLogout(request, env);
  }
  if (request.method === "PATCH" && url.pathname === "/api/auth/profile") {
    return handleUpdateProfile(request, env);
  }
  if (request.method === "GET" && url.pathname === "/api/auth/naver/login") {
    return handleStartNaverLogin(request, env, url);
  }
  if (request.method === "GET" && url.pathname === "/api/auth/naver/callback") {
    return handleNaverCallback(request, env, url);
  }
  if (request.method === "GET" && url.pathname === "/api/bootstrap") {
    return handleBootstrap(request, env);
  }
  if (request.method === "GET" && url.pathname === "/api/map-bootstrap") {
    return handleMapBootstrap(request, env);
  }
  if (request.method === "GET" && url.pathname === "/api/courses/curated") {
    return handleCuratedCourses(request, env);
  }
  if (request.method === "GET" && url.pathname === "/api/review-feed") {
    return handleReviewFeed(request, env, url);
  }
  if (request.method === "GET" && url.pathname === "/api/reviews") {
    return handleReviews(request, env, url);
  }
  if (request.method === "POST" && url.pathname === "/api/reviews/upload") {
    return handleReviewUpload(request, env);
  }
  if (request.method === "POST" && url.pathname === "/api/reviews") {
    return handleCreateReview(request, env);
  }
  if (request.method === "GET" && reviewDetailMatch) {
    return handleReviewDetail(request, env, reviewDetailMatch[1]);
  }
  if (request.method === "PATCH" && reviewDetailMatch) {
    return handleUpdateReview(request, env, reviewDetailMatch[1]);
  }
  if (request.method === "GET" && reviewCommentMatch) {
    const sessionUser = await readSessionUser(request, env);
    const comments = (await loadSingleReview(env, reviewCommentMatch[1], sessionUser?.id ?? null))?.comments ?? [];
    return jsonResponse(200, comments, env, request);
  }
  if (request.method === "POST" && reviewCommentMatch) {
    return handleCreateComment(request, env, reviewCommentMatch[1]);
  }
  if (request.method === "PATCH" && reviewCommentDetailMatch) {
    return handleUpdateComment(request, env, reviewCommentDetailMatch[1], reviewCommentDetailMatch[2]);
  }
  if (request.method === "DELETE" && reviewCommentDetailMatch) {
    return handleDeleteComment(request, env, reviewCommentDetailMatch[1], reviewCommentDetailMatch[2]);
  }
  if (request.method === "POST" && reviewLikeMatch) {
    return handleToggleReviewLike(request, env, reviewLikeMatch[1]);
  }
  if (request.method === "DELETE" && reviewDetailMatch) {
    return handleDeleteReview(request, env, reviewDetailMatch[1]);
  }
  if (request.method === "POST" && url.pathname === "/api/stamps/toggle") {
    return handleToggleStamp(request, env);
  }
  if (request.method === "GET" && url.pathname === "/api/community-routes") {
    return handleCommunityRoutes(request, env, url);
  }
  if (request.method === "POST" && url.pathname === "/api/community-routes") {
    return handleCreateUserRoute(request, env);
  }
  if (request.method === "POST" && communityRouteLikeMatch) {
    return handleToggleCommunityRouteLike(request, env, communityRouteLikeMatch[1]);
  }
  if (request.method === "GET" && url.pathname === "/api/my/routes") {
    return handleMyRoutes(request, env);
  }
  if (request.method === "GET" && url.pathname === "/api/my/summary") {
    return handleMySummary(request, env);
  }
  if (request.method === "GET" && url.pathname === "/api/my/notifications") {
    return handleMyNotifications(request, env);
  }
  if (request.method === "GET" && url.pathname === "/api/my/notifications/realtime-channel") {
    return handleNotificationRealtimeChannel(request, env);
  }
  if (request.method === "GET" && url.pathname === "/api/my/comments") {
    return handleMyComments(request, env, url);
  }
  if (request.method === "PATCH" && notificationReadMatch) {
    return handleMarkNotificationRead(request, env, notificationReadMatch[1]);
  }
  if (request.method === "PATCH" && url.pathname === "/api/notifications/read-all") {
    return handleMarkAllNotificationsRead(request, env);
  }
  if (request.method === "DELETE" && notificationDetailMatch) {
    return handleDeleteNotification(request, env, notificationDetailMatch[1]);
  }
  if (request.method === "GET" && url.pathname === "/api/festivals") {
    return handleFestivalsFromDb(request, env);
  }
  if (request.method === "GET" && url.pathname === "/api/banner/events") {
    return handleBannerEventsFromDb(request, env);
  }
  if (request.method === "POST" && url.pathname === "/api/internal/public-events/import") {
    return handleFestivalImport(request, env);
  }
  if (request.method === "GET" && url.pathname === "/api/admin/summary") {
    return handleAdminSummary(request, env);
  }
  if (request.method === "POST" && url.pathname === "/api/admin/import/public-data") {
    return handleAdminImportPublicData(request, env);
  }
  if (request.method === "PATCH" && adminPlaceMatch) {
    return handleAdminPlaceVisibility(request, env, adminPlaceMatch[1]);
  }

  return proxyToOrigin(request, env);
}
export default {
  async fetch(request, env) {
    try {
      return await routeRequest(request, env);
    } catch (error) {
      return jsonResponse(500, {
        service: 'daejeon-jamissue-api',
        status: 'worker-error',
        message: error instanceof Error ? error.message : String(error),
      }, env, request);
    }
  },
};
