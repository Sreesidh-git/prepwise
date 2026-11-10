const DEFAULT_DAYS = 7;
const MAX_DAYS = 366;

export function parseAnalyticsDate(value, fallback) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Parses from/to query parameters using consistent UTC day boundaries when
 * no custom range is provided, aligning first-party queries with GA4/GSC day windows.
 */
export function parseAnalyticsDateRange(request, fallbackDays = DEFAULT_DAYS) {
  const url = new URL(request.url);
  const now = new Date();
  const end = parseAnalyticsDate(url.searchParams.get('to'), now);
  const requestedFrom = url.searchParams.get('from');
  let start;
  if (requestedFrom) {
    start = parseAnalyticsDate(requestedFrom, null);
  } else {
    start = new Date(now.getTime() - (fallbackDays - 1) * 86400000);
    start.setUTCHours(0, 0, 0, 0);
  }
  if (!start || !end || start > end) return { error: 'Invalid date range' };
  if (end.getTime() - start.getTime() > MAX_DAYS * 86400000) {
    return { error: `Date range cannot exceed ${MAX_DAYS} days` };
  }
  return { start, end };
}

export function buildCompanyLookup(companyRows) {
  const aliasToKey = new Map();
  const keyToLabel = new Map();

  (Array.isArray(companyRows) ? companyRows : []).forEach((row) => {
    const slug = String(row?.slug || row?.id || '').trim();
    if (!slug) return;
    const key = slug.toLowerCase();
    const display = String(row?.short_name || row?.shortName || slug).trim() || slug;
    keyToLabel.set(key, display);

    [row?.id, row?.slug, row?.short_name, row?.shortName, row?.name].forEach((variant) => {
      const normalized = String(variant || '').trim().toLowerCase();
      if (normalized) aliasToKey.set(normalized, key);
    });
  });

  return { aliasToKey, keyToLabel };
}

export function canonicalizeCompanyLabel(rawValue, lookup) {
  const text = String(rawValue || '').trim();
  if (!text) return null;
  const lowered = text.toLowerCase();
  const canonicalKey = lookup?.aliasToKey?.get(lowered) || lowered;
  return lookup?.keyToLabel?.get(canonicalKey) || canonicalKey;
}

/**
 * Counts quiz categories once per completed quiz attempt (using quiz_attempts rows when
 * present, or quiz_complete events otherwise) instead of summing quiz_start + quiz_complete + rows.
 */
export function countCompletedQuizCategories(attempts, events) {
  const counts = new Map();
  const attemptList = Array.isArray(attempts) ? attempts : [];

  if (attemptList.length > 0) {
    attemptList.forEach((attempt) => {
      if (attempt?.is_abandoned) return;
      const cat = String(attempt?.category || 'all').trim() || 'all';
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });
    return counts;
  }

  (Array.isArray(events) ? events : []).forEach((event) => {
    if (event?.event_name !== 'quiz_complete') return;
    const props = event.properties && typeof event.properties === 'object' ? event.properties : {};
    const cat = String(props.category || 'all').trim() || 'all';
    counts.set(cat, (counts.get(cat) || 0) + 1);
  });
  return counts;
}

