import { formatDate, formatDateTime, toSeoulDateKey } from './lib/dates.js';
import { applyCorsHeaders, handlePreflight, jsonResponse, redirectResponse } from './lib/http.js';
import {
  buildAuthProviders,
  createAuthResponse,
  getSigningSecret,
  handleAuthProviders,
  handleAuthSession,
  handleLogout,
  handleNaverCallback,
  handleStartNaverLogin,
  handleUpdateProfile,
  naverConfigured,
  readSessionUser,
  sha256Base64Url,
} from './services/auth.js';
import { handleBannerEvents, handleFestivalImport, handleFestivals } from './services/festivals.js';
import {
  handleCreateComment,
  handleCreateReview,
  handleDeleteComment,
  handleDeleteReview,
  handleReviewUpload,
  handleToggleReviewLike,
  handleUpdateComment,
  handleUpdateReview,
} from './services/review-interactions.js';
import {
  countUnreadNotifications,
  createUserNotification,
  handleDeleteNotification,
  handleMarkAllNotificationsRead,
  handleMarkNotificationRead,
  handleMyNotifications,
  handleNotificationRealtimeChannel,
  loadNotificationById,
  loadUserNotifications,
  publishNotificationEvent,
} from './services/notifications.js';
import {
  buildInFilter,
  encodeFilterValue,
  getSupabaseKey,
  parseListLimit,
  rememberPending,
  supabaseRequest,
} from './lib/supabase.js';

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

const STATIC_BASE_CACHE_TTL_MS = 5 * 60 * 1000;
const FESTIVALS_CACHE_TTL_MS = 10 * 60 * 1000;
let staticBaseCache = { expiresAt: 0, value: null, pending: null };
let festivalsCache = { expiresAt: 0, syncAt: 0, value: null, pending: null };

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
    totalVisitCount: Number(row.total_visit_count ?? 0),
  };
}

function buildPlaceVisitCountMap(stampRows) {
  const counts = new Map();
  for (const row of stampRows ?? []) {
    const key = String(row.position_id);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
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

  const [commentRows, likeRows, reviewStampRows, userFeedLikeRows = [], userSessionRows = [], ownerRouteRows = [], userStampRows = [], allPlaceStampRows = []] = await Promise.all([
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
    supabaseRequest(env, "user_stamp?select=position_id"),
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
  const placeVisitCounts = buildPlaceVisitCountMap(allPlaceStampRows);
  const places = placeRows.map((row) => mapPlace({ ...row, total_visit_count: placeVisitCounts.get(String(row.position_id)) ?? 0 }));
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
  const [{ placeRows }, userSessionRows = [], ownerRouteRows = [], userStampRows = [], allPlaceStampRows = []] = await Promise.all([
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
    supabaseRequest(env, "user_stamp?select=position_id"),
  ]);

  const placeVisitCounts = buildPlaceVisitCountMap(allPlaceStampRows);
  const places = placeRows.map((row) => mapPlace({ ...row, total_visit_count: placeVisitCounts.get(String(row.position_id)) ?? 0 }));
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

async function readRouteRow(env, routeId) {
  const rows = await supabaseRequest(env, `user_route?select=route_id,user_id,like_count&route_id=eq.${encodeFilterValue(routeId)}&limit=1`);
  return rows?.[0] ?? null;
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

function buildReviewInteractionDeps() {
  return {
    badgeByMood: BADGE_BY_MOOD,
    countUnreadNotifications,
    createUserNotification,
    loadBaseData,
    loadNotificationById,
    loadSingleReview,
    publishNotificationEvent,
    readSessionUser,
  };
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

async function readRouteRow(env, routeId) {
  const rows = await supabaseRequest(env, `user_route?select=route_id,user_id,like_count&route_id=eq.${encodeFilterValue(routeId)}&limit=1`);
  return rows?.[0] ?? null;
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

function buildReviewInteractionDeps() {
  return {
    badgeByMood: BADGE_BY_MOOD,
    countUnreadNotifications,
    createUserNotification,
    loadBaseData,
    loadNotificationById,
    loadSingleReview,
    publishNotificationEvent,
    readSessionUser,
  };
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
    return handleReviewUpload(request, env, buildReviewInteractionDeps());
  }
  if (request.method === "POST" && url.pathname === "/api/reviews") {
    return handleCreateReview(request, env, buildReviewInteractionDeps());
  }
  if (request.method === "GET" && reviewDetailMatch) {
    return handleReviewDetail(request, env, reviewDetailMatch[1]);
  }
  if (request.method === "PATCH" && reviewDetailMatch) {
    return handleUpdateReview(request, env, reviewDetailMatch[1], buildReviewInteractionDeps());
  }
  if (request.method === "GET" && reviewCommentMatch) {
    const sessionUser = await readSessionUser(request, env);
    const comments = (await loadSingleReview(env, reviewCommentMatch[1], sessionUser?.id ?? null))?.comments ?? [];
    return jsonResponse(200, comments, env, request);
  }
  if (request.method === "POST" && reviewCommentMatch) {
    return handleCreateComment(request, env, reviewCommentMatch[1], buildReviewInteractionDeps());
  }
  if (request.method === "PATCH" && reviewCommentDetailMatch) {
    return handleUpdateComment(request, env, reviewCommentDetailMatch[1], reviewCommentDetailMatch[2], buildReviewInteractionDeps());
  }
  if (request.method === "DELETE" && reviewCommentDetailMatch) {
    return handleDeleteComment(request, env, reviewCommentDetailMatch[1], reviewCommentDetailMatch[2], buildReviewInteractionDeps());
  }
  if (request.method === "POST" && reviewLikeMatch) {
    return handleToggleReviewLike(request, env, reviewLikeMatch[1], buildReviewInteractionDeps());
  }
  if (request.method === "DELETE" && reviewDetailMatch) {
    return handleDeleteReview(request, env, reviewDetailMatch[1], buildReviewInteractionDeps());
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
    return handleFestivals(request, env);
  }
  if (request.method === "GET" && url.pathname === "/api/banner/events") {
    return handleBannerEvents(request, env);
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
