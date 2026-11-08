import { json, requireAdmin, supabaseRequest } from '../../_shared/supabase.js';

const MAX_DAYS = 366;
const MAX_ROWS = 10000;
const DEFAULT_DAYS = 7;
const EVENT_NAMES = new Set(['page_view', 'search', 'company_view', 'quiz_start', 'quiz_complete']);

function parseDate(value, fallback) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateRange(request) {
  const url = new URL(request.url);
  const now = new Date();
  const end = parseDate(url.searchParams.get('to'), now);
  const requestedFrom = url.searchParams.get('from');
  const start = requestedFrom
    ? parseDate(requestedFrom, null)
    : new Date(now.getTime() - DEFAULT_DAYS * 86400000);
  if (!start || !end || start > end) return { error: 'Invalid date range' };
  if (end.getTime() - start.getTime() > MAX_DAYS * 86400000) {
    return { error: `Date range cannot exceed ${MAX_DAYS} days` };
  }
  return { start, end };
}

function iso(value) {
  return encodeURIComponent(value.toISOString());
}

function queryPath(resource, select, dateColumn, range, extra = '') {
  return `/rest/v1/${resource}?select=${select}&${dateColumn}=gte.${iso(range.start)}&${dateColumn}=lte.${iso(range.end)}${extra}&limit=${MAX_ROWS}`;
}

function dayKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function increment(map, key, amount = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + amount);
}

function sortedMap(map, limit = 20) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows, columns) {
  return [columns.join(','), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(','))].join('\r\n');
}

async function loadData(env, range, token) {
  const [events, sessions, views, attempts] = await Promise.all([
    supabaseRequest(env, queryPath('analytics_events', 'event_name,path,properties,occurred_at,anonymous_id', 'occurred_at', range), { accessToken: token }),
    supabaseRequest(env, queryPath('visitor_sessions', 'anonymous_id,first_seen_at,last_seen_at', 'last_seen_at', range), { accessToken: token }),
    supabaseRequest(env, queryPath('page_views', 'anonymous_id,path,title,referrer,device_category,occurred_at', 'occurred_at', range), { accessToken: token }),
    supabaseRequest(env, queryPath('quiz_attempts', 'anonymous_id,started_at,completed_at,question_count,answered_count,score,category,level,is_abandoned', 'started_at', range), { accessToken: token })
  ]);
  return {
    events: Array.isArray(events) ? events : [],
    sessions: Array.isArray(sessions) ? sessions : [],
    views: Array.isArray(views) ? views : [],
    attempts: Array.isArray(attempts) ? attempts : []
  };
}

function summarize(data) {
  const pageViews = data.events.filter((event) => event.event_name === 'page_view').length;
  const quizStarts = data.events.filter((event) => event.event_name === 'quiz_start').length;
  const quizCompletions = data.events.filter((event) => event.event_name === 'quiz_complete').length;
  const completedAttempts = data.attempts.filter((attempt) => !attempt.is_abandoned && attempt.completed_at).length;
  const uniqueVisitors = new Set(data.sessions.map((session) => session.anonymous_id).filter(Boolean)).size;
  const daily = new Map();
  const pages = new Map();
  const companies = new Map();
  const categories = new Map();
  const quizCompanies = new Map();
  const eventTypes = new Map();
  const devices = new Map();

  data.events.forEach((event) => {
    increment(eventTypes, event.event_name);
    increment(daily, dayKey(event.occurred_at));
    if (event.event_name === 'page_view') increment(pages, event.path);
    const properties = event.properties && typeof event.properties === 'object' ? event.properties : {};
    if (event.event_name === 'company_view') increment(companies, properties.companyId || properties.company_id);
    if (event.event_name === 'quiz_start' || event.event_name === 'quiz_complete') {
      increment(categories, properties.category || 'all');
      const quizCompany = properties.companyId || properties.company_id;
      if (quizCompany) increment(quizCompanies, quizCompany);
    }
  });
  data.attempts.forEach((attempt) => {
    if (attempt.category) increment(categories, attempt.category);
  });
  data.views.forEach((view) => increment(devices, view.device_category || 'unknown'));

  const completionRate = quizStarts > 0 ? Math.round((quizCompletions / quizStarts) * 10000) / 100 : null;
  const scores = data.attempts.filter((attempt) => !attempt.is_abandoned && Number.isFinite(attempt.score));
  const averageScore = scores.length
    ? Math.round((scores.reduce((total, attempt) => total + attempt.score, 0) / scores.length) * 100) / 100
    : null;

  return {
    totals: {
      visitors: data.sessions.length,
      uniqueVisitors,
      pageViews,
      quizStarts,
      quizCompletions,
      completionRate,
      quizAttempts: data.attempts.length,
      completedAttempts,
      averageScore
    },
    dailyActivity: sortedMap(daily, MAX_DAYS),
    eventTypes: sortedMap(eventTypes),
    popularPages: sortedMap(pages),
    popularCompanies: sortedMap(companies),
    popularQuizCompanies: sortedMap(quizCompanies),
    popularCategories: sortedMap(categories),
    deviceCategories: sortedMap(devices),
    scoreDistribution: [0, 20, 40, 60, 80, 100].map((threshold, index, values) => {
      const upper = values[index + 1] ?? 101;
      return {
        label: index === values.length - 1 ? `${threshold}%+` : `${threshold}-${upper - 1}%`,
        count: scores.filter((attempt) => {
          const percentage = attempt.question_count ? (attempt.score / attempt.question_count) * 100 : 0;
          return percentage >= threshold && percentage < upper;
        }).length
      };
    })
  };
}

function activityRows(data) {
  return data.events
    .filter((event) => EVENT_NAMES.has(event.event_name))
    .map((event) => {
      const properties = event.properties && typeof event.properties === 'object' ? event.properties : {};
      return {
        eventType: event.event_name,
        page: event.path || 'Unavailable',
        company: properties.companyId || properties.company_id || 'Unavailable',
        category: properties.category || 'Unavailable',
        level: properties.level || 'Unavailable',
        device: properties.deviceCategory || 'Unavailable',
        timestamp: event.occurred_at
      };
    });
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context.request, context.env);
  if (auth.response) return auth.response;
  const range = dateRange(context.request);
  if (range.error) return json({ error: range.error }, 400);

  try {
    const data = await loadData(context.env, range, auth.token);
    const url = new URL(context.request.url);
    const view = url.searchParams.get('view') || 'summary';
    const rows = activityRows(data);
    if (view === 'activity') {
      const sort = url.searchParams.get('sort') || 'timestamp_desc';
      if (!['timestamp_desc', 'timestamp_asc', 'event_desc'].includes(sort)) return json({ error: 'Invalid sort order' }, 400);
      const eventType = url.searchParams.get('eventType');
      if (eventType && !EVENT_NAMES.has(eventType)) return json({ error: 'Invalid event type' }, 400);
      const filteredRows = eventType ? rows.filter((row) => row.eventType === eventType) : rows;
      filteredRows.sort((a, b) => sort === 'event_desc'
        ? b.eventType.localeCompare(a.eventType) || b.timestamp.localeCompare(a.timestamp)
        : sort === 'timestamp_asc'
          ? a.timestamp.localeCompare(b.timestamp)
          : b.timestamp.localeCompare(a.timestamp));
      const page = Math.max(Number.parseInt(url.searchParams.get('page') || '1', 10) || 1, 1);
      const pageSize = Math.min(Math.max(Number.parseInt(url.searchParams.get('pageSize') || '50', 10) || 50, 1), 200);
      const offset = (page - 1) * pageSize;
      const pagedRows = filteredRows.slice(offset, offset + pageSize);
      if (url.searchParams.get('format') === 'csv') {
        const columns = ['eventType', 'page', 'company', 'category', 'level', 'device', 'timestamp'];
        return new Response(toCsv(filteredRows.slice(0, 5000), columns), {
          headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="prepwise-activity.csv"', 'Cache-Control': 'no-store' }
        });
      }
      return json({ data: pagedRows, pagination: { page, pageSize, total: filteredRows.length, hasNext: offset + pageSize < filteredRows.length }, range: { from: range.start.toISOString(), to: range.end.toISOString() } });
    }
    return json({ data: summarize(data), range: { from: range.start.toISOString(), to: range.end.toISOString() } });
  } catch (error) {
    console.error('Admin analytics error', error.message);
    return json({ error: 'Analytics could not be loaded' }, 500);
  }
}
