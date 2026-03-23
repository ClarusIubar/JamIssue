import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const sampleDir = path.join(projectRoot, 'sample');
const htmlPath = path.join(sampleDir, '장소별 위치 3294836daaec807c9e20de8938a26e1c.html');
const outputJsonPath = path.join(sampleDir, 'places.generated.json');
const outputSqlPath = path.join(projectRoot, 'backend', 'sql', 'migrations', '20260323_seed_sample_places.sql');

const MANUAL_OVERRIDES_BY_NUMBER = {
  70: { latitude: 36.3688239, longitude: 127.3879822, district: '\uC11C\uAD6C' },
  71: { latitude: 36.3601462, longitude: 127.3570634, district: '\uC720\uC131\uAD6C' },
};

const CATEGORY_META = {
  restaurant: {
    name: '맛집',
    jamColor: '#FF6B9D',
    accentColor: '#FFB3C6',
    stampReward: '로컬 미식 스탬프',
    heroLabel: 'Local Bite',
    visitTime: '40분 - 1시간 30분',
  },
  cafe: {
    name: '카페',
    jamColor: '#7CB9D1',
    accentColor: '#A8D5E2',
    stampReward: '카페 투어 스탬프',
    heroLabel: 'Slow Brew',
    visitTime: '30분 - 1시간',
  },
  attraction: {
    name: '명소',
    jamColor: '#FFB3C6',
    accentColor: '#FFD4E0',
    stampReward: '도시 산책 스탬프',
    heroLabel: 'City Escape',
    visitTime: '1시간 - 2시간',
  },
  culture: {
    name: '문화',
    jamColor: '#A8D5E2',
    accentColor: '#C9E4EA',
    stampReward: '문화 탐방 스탬프',
    heroLabel: 'Art Spot',
    visitTime: '1시간 - 2시간',
  },
};

function decodeHtml(value) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function normalizeCategory(raw) {
  const value = raw.replace(/\s+/g, '');
  if (value.includes('카페')) return 'cafe';
  if (value.includes('문화') || value.includes('공방') || value.includes('소품샵')) return 'culture';
  if (value.includes('명소')) return 'attraction';
  return 'restaurant';
}

function inferDistrict(name, lat, lng) {
  const n = name.replace(/\s+/g, '');
  if (/(관저|갈마|탄방|둔산|만년|괴정|월평|도안|복수)/.test(n)) return '서구';
  if (/(유성|봉명|궁동|충남대|도룡|온천|노은|엑스포|과학관)/.test(n)) return '유성구';
  if (/(소제|대동|신흥|원동|정동|대전역)/.test(n)) return '동구';
  if (/(대흥|은행|선화|중앙로|오월드|뿌리공원|사정|산성)/.test(n)) return '중구';
  if (lat < 36.31) return lng < 127.36 ? '서구' : '중구';
  if (lng >= 127.425) return lat >= 36.332 ? '동구' : '중구';
  if (lat >= 36.365 && lng < 127.39) return '유성구';
  if (lng < 127.40) return '서구';
  return '대전';
}

function slugify(number, name, used) {
  const base = name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 70);
  const safeBase = base || `place-${String(number).padStart(3, '0')}`;
  let slug = `${String(number).padStart(3, '0')}-${safeBase}`;
  let suffix = 2;
  while (used.has(slug)) {
    slug = `${String(number).padStart(3, '0')}-${safeBase}-${suffix++}`;
  }
  used.add(slug);
  return slug;
}

function deriveTags(name, category, district, rawCategory) {
  const tags = new Set([CATEGORY_META[category].name, district]);
  if (/칼국수/.test(name)) tags.add('칼국수');
  if (/빵|베이커리|제과|하레하레|손수베이커리|미미제과점|뮤제/.test(name)) tags.add('베이커리');
  if (/수목원|공원|뚝방|오월드/.test(name)) tags.add('산책');
  if (/미술관|예술|과학관|art|아트|공방/i.test(name)) tags.add('전시');
  if (rawCategory.includes('소품샵')) tags.add('소품샵');
  if (category === 'cafe') tags.add('카페투어');
  if (category === 'restaurant') tags.add('로컬맛집');
  if (category === 'culture') tags.add('문화코스');
  if (category === 'attraction') tags.add('도시산책');
  return Array.from(tags).slice(0, 4);
}

function makeSummary(name, category) {
  switch (category) {
    case 'restaurant':
      return `${name}에서 대전 로컬 미식 흐름을 가볍게 시작해 보세요.`;
    case 'cafe':
      return `${name}에서 대전 카페 동선을 천천히 이어가기 좋아요.`;
    case 'culture':
      return `${name}에서 대전 문화 코스를 한 번에 이어가기 좋아요.`;
    default:
      return `${name}에서 대전 명소 산책 흐름을 자연스럽게 이어갈 수 있어요.`;
  }
}

function makeDescription(name, category, district) {
  switch (category) {
    case 'restaurant':
      return `${name}는 ${district} 권역에서 한 끼 동선으로 묶기 좋은 로컬 맛집입니다. 식사 뒤 카페나 산책 스폿과 이어 방문하기 좋게 구성했습니다.`;
    case 'cafe':
      return `${name}는 ${district} 권역에서 쉬어가기 좋은 카페 스폿입니다. 식사 뒤 혹은 산책 중간에 들르기 좋도록 여유 있는 카페 동선을 기준으로 정리했습니다.`;
    case 'culture':
      return `${name}는 ${district} 권역의 문화 스폿으로, 전시·공방·체험 흐름으로 묶기 좋습니다. 반나절 코스 안에서 다른 장소와 함께 이어보는 구성을 상정했습니다.`;
    default:
      return `${name}는 ${district} 권역에서 산책과 사진 기록을 함께 남기기 좋은 장소입니다. 카페나 문화 스폿과 연결해 반나절 코스로 묶기 좋게 정리했습니다.`;
  }
}

function makeRouteHint(category, district) {
  switch (category) {
    case 'restaurant':
      return `${district} 동선에서 카페나 산책 스폿과 함께 묶기 좋아요.`;
    case 'cafe':
      return `${district} 동선에서 식사 뒤 한 번 더 쉬어가기 좋은 스폿이에요.`;
    case 'culture':
      return `${district} 권역의 전시·공방·소품샵 흐름으로 이어 보기 좋아요.`;
    default:
      return `${district} 권역에서 카페나 문화 스폿과 함께 반나절 코스로 이어 보세요.`;
  }
}

function sqlString(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function getImageFileName(number) {
  return number === 1 ? 'image.png' : `image ${number - 1}.png`;
}

const html = fs.readFileSync(htmlPath, 'utf8');
const rowMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];
const usedSlugs = new Set();
const places = [];

for (const match of rowMatches) {
  const cells = [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => decodeHtml(cell[1]));
  if (cells.length !== 5 || cells[0] === '번호') continue;
  const number = Number(cells[0]);
  if (!Number.isFinite(number)) continue;
  const name = cells[1];
  const rawCategory = cells[2];
  const longitude = Number(cells[3]);
  const latitude = Number(cells[4]);
  const category = normalizeCategory(rawCategory);
  const override = MANUAL_OVERRIDES_BY_NUMBER[number] ?? null;
  const resolvedLatitude = override?.latitude ?? latitude;
  const resolvedLongitude = override?.longitude ?? longitude;
  const district = override?.district ?? inferDistrict(name, resolvedLatitude, resolvedLongitude);
  const slug = slugify(number, name, usedSlugs);
  const imageFileName = getImageFileName(number);
  const localImagePath = path.join(sampleDir, imageFileName);
  const imageExists = fs.existsSync(localImagePath);
  const imageStoragePath = `places/${String(number).padStart(3, '0')}/hero.png`;

  places.push({
    number,
    slug,
    name,
    rawCategory,
    category,
    district,
    latitude: resolvedLatitude,
    longitude: resolvedLongitude,
    summary: makeSummary(name, category),
    description: makeDescription(name, category, district),
    vibeTags: deriveTags(name, category, district, rawCategory),
    visitTime: CATEGORY_META[category].visitTime,
    routeHint: makeRouteHint(category, district),
    stampReward: CATEGORY_META[category].stampReward,
    heroLabel: CATEGORY_META[category].heroLabel,
    jamColor: CATEGORY_META[category].jamColor,
    accentColor: CATEGORY_META[category].accentColor,
    imageFileName,
    imageExists,
    imageStoragePath,
    imageUrl: null,
  });
}

if (places.length === 0) {
  throw new Error('sample HTML에서 장소 데이터를 찾지 못했습니다.');
}

const missingImages = places.filter((place) => !place.imageExists);
if (missingImages.length > 0) {
  throw new Error(`이미지 파일이 누락되었습니다: ${missingImages.map((place) => `${place.number}:${place.imageFileName}`).join(', ')}`);
}

const sql = [
  'begin;',
  '',
  'insert into public.map (',
  '  slug,',
  '  name,',
  '  district,',
  '  category,',
  '  latitude,',
  '  longitude,',
  '  summary,',
  '  description,',
  '  image_url,',
  '  image_storage_path,',
  '  vibe_tags,',
  '  visit_time,',
  '  route_hint,',
  '  stamp_reward,',
  '  hero_label,',
  '  jam_color,',
  '  accent_color,',
  '  is_active',
  ') values',
  places.map((place) => `(${[
    sqlString(place.slug),
    sqlString(place.name),
    sqlString(place.district),
    sqlString(place.category),
    place.latitude,
    place.longitude,
    sqlString(place.summary),
    sqlString(place.description),
    'null',
    sqlString(place.imageStoragePath),
    sqlJson(place.vibeTags),
    sqlString(place.visitTime),
    sqlString(place.routeHint),
    sqlString(place.stampReward),
    sqlString(place.heroLabel),
    sqlString(place.jamColor),
    sqlString(place.accentColor),
    'true',
  ].join(', ')})`).join(',\n'),
  'on conflict (slug) do update set',
  '  name = excluded.name,',
  '  district = excluded.district,',
  '  category = excluded.category,',
  '  latitude = excluded.latitude,',
  '  longitude = excluded.longitude,',
  '  summary = excluded.summary,',
  '  description = excluded.description,',
  '  image_storage_path = excluded.image_storage_path,',
  '  vibe_tags = excluded.vibe_tags,',
  '  visit_time = excluded.visit_time,',
  '  route_hint = excluded.route_hint,',
  '  stamp_reward = excluded.stamp_reward,',
  '  hero_label = excluded.hero_label,',
  '  jam_color = excluded.jam_color,',
  '  accent_color = excluded.accent_color,',
  '  is_active = excluded.is_active,',
  '  updated_at = now();',
  '',
  'commit;',
  '',
].join('\n');

fs.writeFileSync(outputJsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), count: places.length, places }, null, 2), 'utf8');
fs.writeFileSync(outputSqlPath, Buffer.from('\uFEFF' + sql, 'utf8'));

console.log(`generated ${places.length} places`);
console.log(outputJsonPath);
console.log(outputSqlPath);
