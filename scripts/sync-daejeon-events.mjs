const SEARCH_URL = 'https://www.daejeon.go.kr/fvu/FvuEventList.do?menuSeq=504';
const DETAIL_BASE_URL = 'https://www.daejeon.go.kr/fvu/FvuEventView.do';
const SOURCE_NAME = 'Daejeon Official Event Search';

function parseArgs(argv) {
  const options = {
    dryRun: false,
    from: null,
    to: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--from') {
      options.from = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === '--to') {
      options.to = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function getSeoulDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

function formatUtcDateKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultRange() {
  const todayParts = getSeoulDateParts();
  const start = new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + Number(process.env.FESTIVAL_SYNC_RANGE_DAYS || 90));
  return {
    from: formatUtcDateKey(start),
    to: formatUtcDateKey(end),
  };
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripHtml(text) {
  return escapeHtml(String(text || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function toStartOfDayIso(dateKey) {
  return `${dateKey}T00:00:00+09:00`;
}

function toEndOfDayIso(dateKey) {
  return `${dateKey}T23:59:59+09:00`;
}

function normalizeSeriesKeyPart(value) {
  return String(value || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[&_·/|]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toLowerCase();
}

function toSeoulDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parseSeoulDateKey(dateKey) {
  return new Date(`${dateKey}T00:00:00+09:00`);
}

function buildSeriesGroupingKey(item) {
  return [
    normalizeSeriesKeyPart(item.title),
    normalizeSeriesKeyPart(item.venueName || item.roadAddress || ''),
    normalizeSeriesKeyPart(item.homepageUrl || ''),
  ].join('|');
}

function areSeriesDatesAdjacent(leftEnd, rightStart) {
  const leftKey = toSeoulDateKey(leftEnd);
  const rightKey = toSeoulDateKey(rightStart);
  if (!leftKey || !rightKey) {
    return false;
  }
  const nextDate = parseSeoulDateKey(leftKey);
  nextDate.setDate(nextDate.getDate() + 1);
  return parseSeoulDateKey(rightKey).getTime() <= nextDate.getTime();
}

function mergeEventSeries(items) {
  const sorted = [...items].sort((left, right) => {
    const startDiff = new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
    if (startDiff !== 0) {
      return startDiff;
    }
    return left.title.localeCompare(right.title, 'ko');
  });

  const merged = [];
  for (const item of sorted) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      buildSeriesGroupingKey(previous) === buildSeriesGroupingKey(item) &&
      areSeriesDatesAdjacent(previous.endsAt, item.startsAt)
    ) {
      if (new Date(item.endsAt).getTime() > new Date(previous.endsAt).getTime()) {
        previous.endsAt = item.endsAt;
      }
      previous.summary = previous.summary || item.summary;
      previous.rawPayload = {
        ...(previous.rawPayload || {}),
        mergedEventSeqs: [...new Set([...(previous.rawPayload?.mergedEventSeqs || [previous.rawPayload?.eventSeq].filter(Boolean)), item.rawPayload?.eventSeq].filter(Boolean))],
      };
      continue;
    }
    merged.push({
      ...item,
      rawPayload: {
        ...(item.rawPayload || {}),
        mergedEventSeqs: [item.rawPayload?.eventSeq].filter(Boolean),
      },
    });
  }

  return merged;
}

function parseMaxPage(html) {
  const pageNumbers = [...html.matchAll(/fn_link_page\((\d+)\)/g)].map((match) => Number(match[1]));
  return pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1;
}

function parseEventRows(html) {
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) {
    return [];
  }

  const items = [];
  const rowMatches = tbodyMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/gi);
  for (const rowMatch of rowMatches) {
    const rowHtml = rowMatch[1];
    const eventSeqMatch = rowHtml.match(/eventSeq=(\d+)/);
    if (!eventSeqMatch) {
      continue;
    }

    const cellMatches = [...rowHtml.matchAll(/<td\b[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/td>/gi)];
    const subjectCell = cellMatches.find((match) => match[1].includes('subject'));
    const themeCell = cellMatches.find((match) => match[1].includes('theme'));
    const locationCell = cellMatches.find((match) => match[1].includes('location'));
    const dateCells = cellMatches.filter((match) => match[1].includes('date3'));

    const title = stripHtml(subjectCell?.[2] ?? '');
    const theme = stripHtml(themeCell?.[2] ?? '').replace(/^추천\s*:\s*/u, '').trim();
    const venueName = stripHtml(locationCell?.[2] ?? '');
    const startDate = stripHtml(dateCells[0]?.[2] ?? '');
    const endDate = stripHtml(dateCells[1]?.[2] ?? '');
    const eventSeq = eventSeqMatch[1];

    if (!title || !startDate || !endDate) {
      continue;
    }

    items.push({
      externalId: `daejeon-event-${eventSeq}`,
      title,
      venueName: venueName || null,
      district: '대전',
      address: venueName || null,
      roadAddress: venueName || null,
      startsAt: toStartOfDayIso(startDate),
      endsAt: toEndOfDayIso(endDate),
      homepageUrl: `${DETAIL_BASE_URL}?eventSeq=${eventSeq}&menuSeq=504`,
      latitude: null,
      longitude: null,
      summary: [theme, venueName].filter(Boolean).join(' · ') || '대전시 공식 행사안내 일정입니다.',
      rawPayload: {
        eventSeq,
        theme,
        venueName,
        startDate,
        endDate,
      },
    });
  }

  return items;
}

async function fetchEventListPage({ from, to, pageIndex }) {
  const body = new URLSearchParams({
    menuSeq: '504',
    pageIndex: String(pageIndex),
    beginDt: from,
    endDt: to,
    themeCd: '',
    placeCd: '',
    targetCd: '',
    managementCd: '',
    searchKeyword: '',
    eventSeq: '',
  });

  const response = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: {
      Accept: 'text/html',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Daejeon event list (${response.status}).`);
  }

  return response.text();
}

async function collectEvents(range) {
  const firstPageHtml = await fetchEventListPage({ ...range, pageIndex: 1 });
  const maxPage = parseMaxPage(firstPageHtml);
  const pages = [{ pageIndex: 1, html: firstPageHtml }];

  for (let pageIndex = 2; pageIndex <= maxPage; pageIndex += 1) {
    pages.push({
      pageIndex,
      html: await fetchEventListPage({ ...range, pageIndex }),
    });
  }

  const uniqueItems = new Map();
  for (const page of pages) {
    for (const item of parseEventRows(page.html)) {
      uniqueItems.set(item.externalId, item);
    }
  }

  return {
    pageCount: maxPage,
    items: mergeEventSeries([...uniqueItems.values()]),
  };
}

async function uploadEvents(items, range) {
  const importUrl = String(process.env.PUBLIC_EVENT_IMPORT_URL || '').trim();
  const token = String(process.env.EVENT_IMPORT_TOKEN || '').trim();

  if (!importUrl) {
    throw new Error('PUBLIC_EVENT_IMPORT_URL is required.');
  }
  if (!token) {
    throw new Error('EVENT_IMPORT_TOKEN is required.');
  }

  const response = await fetch(importUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      sourceName: SOURCE_NAME,
      sourceUrl: `${SEARCH_URL}&beginDt=${range.from}&endDt=${range.to}`,
      importedAt: new Date().toISOString(),
      items,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to upload imported events (${response.status}): ${await response.text()}`);
  }

  return response.json();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const defaultRange = getDefaultRange();
  const range = {
    from: options.from || defaultRange.from,
    to: options.to || defaultRange.to,
  };

  const { pageCount, items } = await collectEvents(range);
  console.log(`Collected ${items.length} unique events across ${pageCount} pages for ${range.from}..${range.to}.`);

  if (items[0]) {
    console.log(`First event: ${items[0].startsAt.slice(0, 10)} ${items[0].title}`);
  }

  if (options.dryRun) {
    return;
  }

  const result = await uploadEvents(items, range);
  console.log(`Uploaded ${result.importedEvents ?? items.length} events to ${process.env.PUBLIC_EVENT_IMPORT_URL}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
