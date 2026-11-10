import { json, requireAdmin, supabaseRequest } from '../../_shared/supabase.js';
import {
  buildCompanyLookup,
  canonicalizeCompanyLabel,
  countCompletedQuizCategories,
  parseAnalyticsDateRange
} from '../../_shared/analytics-helpers.js';

const MAX_DAYS = 366;
const MAX_ROWS = 10000;
const DEFAULT_DAYS = 7;
const EVENT_NAMES = new Set(['page_view', 'search', 'company_view', 'quiz_start', 'quiz_complete']);

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

function chronologicalDailySeries(events, rangeStart, rangeEnd) {
  const counts = new Map();
  const quizCounts = new Map();
  events.forEach((e) => {
    if (!e.occurred_at) return;
    const k = new Date(e.occurred_at).toISOString().slice(0, 10);
    counts.set(k, (counts.get(k) || 0) + 1);
    if (e.event_name === 'quiz_start' || e.event_name === 'quiz_complete') {
      const entry = quizCounts.get(k) || { starts: 0, completions: 0 };
      if (e.event_name === 'quiz_start') entry.starts += 1;
      else entry.completions += 1;
      quizCounts.set(k, entry);
    }
  });

  const timeline = [];
  const quizTimeline = [];
  const current = new Date(rangeStart);
  current.setUTCHours(0, 0, 0, 0);
  const end = new Date(rangeEnd);
  end.setUTCHours(23, 59, 59, 999);

  let iterations = 0;
  while (current <= end && iterations < 366) {
    const dayStr = current.toISOString().slice(0, 10);
    const q = quizCounts.get(dayStr) || { starts: 0, completions: 0 };
    timeline.push({
      label: dayStr,
      count: counts.get(dayStr) || 0
    });
    quizTimeline.push({
      label: dayStr,
      starts: q.starts,
      completions: q.completions,
      count: q.starts + q.completions
    });
    current.setUTCDate(current.getUTCDate() + 1);
    iterations++;
  }

  return { timeline, quizTimeline };
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
  const [events, sessions, views, attempts, companyRows] = await Promise.all([
    supabaseRequest(env, queryPath('analytics_events', 'event_name,path,properties,occurred_at,anonymous_id', 'occurred_at', range, '&order=occurred_at.asc'), { accessToken: token }),
    supabaseRequest(env, queryPath('visitor_sessions', 'anonymous_id,first_seen_at,last_seen_at', 'last_seen_at', range), { accessToken: token }),
    supabaseRequest(env, queryPath('page_views', 'anonymous_id,path,title,referrer,device_category,occurred_at', 'occurred_at', range), { accessToken: token }),
    supabaseRequest(env, queryPath('quiz_attempts', 'anonymous_id,started_at,completed_at,question_count,answered_count,score,category,level,is_abandoned', 'started_at', range), { accessToken: token }),
    supabaseRequest(env, '/rest/v1/companies?select=id,slug,short_name,name&limit=500', { accessToken: token }).catch(() => [])
  ]);
  return {
    events: Array.isArray(events) ? events : [],
    sessions: Array.isArray(sessions) ? sessions : [],
    views: Array.isArray(views) ? views : [],
    attempts: Array.isArray(attempts) ? attempts : [],
    companyLookup: buildCompanyLookup(companyRows)
  };
}

function summarize(data, range) {
  const pageViews = data.events.filter((event) => event.event_name === 'page_view').length;
  const quizStarts = data.events.filter((event) => event.event_name === 'quiz_start').length;
  const quizCompletions = data.events.filter((event) => event.event_name === 'quiz_complete').length;
  const completedAttempts = data.attempts.filter((attempt) => !attempt.is_abandoned && attempt.completed_at).length;
  const quizAttempts = data.attempts.length;
  const uniqueVisitors = new Set(data.sessions.map((session) => session.anonymous_id).filter(Boolean)).size;
  const daily = new Map();
  const pages = new Map();
  const companies = new Map();
  const quizCompanies = new Map();
  const eventTypes = new Map();
  const devices = new Map();

  data.events.forEach((event) => {
    increment(eventTypes, event.event_name);
    increment(daily, dayKey(event.occurred_at));
    if (event.event_name === 'page_view') increment(pages, event.path);
    const properties = event.properties && typeof event.properties === 'object' ? event.properties : {};
    if (event.event_name === 'company_view') {
      const companyLabel = canonicalizeCompanyLabel(properties.companyId || properties.company_id, data.companyLookup);
      increment(companies, companyLabel);
    }
    if (event.event_name === 'quiz_start' || event.event_name === 'quiz_complete') {
      const quizCompanyLabel = canonicalizeCompanyLabel(properties.companyId || properties.company_id, data.companyLookup);
      increment(quizCompanies, quizCompanyLabel);
    }
  });
  const categories = countCompletedQuizCategories(data.attempts, data.events);
  data.views.forEach((view) => increment(devices, view.device_category || 'unknown'));

  const eligibleStarts = quizStarts > 0 ? quizStarts : quizAttempts;
  const eligibleCompletions = quizStarts > 0 ? quizCompletions : completedAttempts;
  const completionRate = eligibleStarts > 0
    ? Math.round((eligibleCompletions / eligibleStarts) * 10000) / 100
    : null;
  const scores = data.attempts.filter((attempt) => !attempt.is_abandoned && Number.isFinite(attempt.score));
  const averageScore = scores.length
    ? Math.round((scores.reduce((total, attempt) => total + attempt.score, 0) / scores.length) * 100) / 100
    : null;
  const pctScores = scores.filter((attempt) => Number.isFinite(attempt.question_count) && attempt.question_count > 0);
  const averageScorePercentage = pctScores.length
    ? Math.round((pctScores.reduce((total, attempt) => total + (attempt.score / attempt.question_count) * 100, 0) / pctScores.length) * 100) / 100
    : null;

  const series = range?.start && range?.end
    ? chronologicalDailySeries(data.events, range.start, range.end)
    : { timeline: sortedMap(daily, MAX_DAYS), quizTimeline: [] };

  return {
    totals: {
      visitors: data.sessions.length,
      uniqueVisitors,
      pageViews,
      quizStarts,
      quizCompletions,
      completionRate,
      quizAttempts,
      completedAttempts,
      averageScore,
      averageScorePercentage
    },
    dailyActivity: series.timeline,
    dailyQuizActivity: series.quizTimeline,
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
  const range = parseAnalyticsDateRange(context.request, DEFAULT_DAYS);
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
    return json({ data: summarize(data, range), range: { from: range.start.toISOString(), to: range.end.toISOString() } });
  } catch (error) {
    console.error('Admin analytics error', error.message);
    return json({ error: 'Analytics could not be loaded' }, 500);
  }
}
