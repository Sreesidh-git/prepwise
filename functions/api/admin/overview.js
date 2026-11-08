import { json, requireAdmin, supabaseRequest, supabaseCount } from '../../_shared/supabase.js';

const DEFAULT_DAYS = 7;
const MAX_DAYS = 366;

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

export async function onRequestGet(context) {
  const auth = await requireAdmin(context.request, context.env);
  if (auth.response) return auth.response;

  const range = dateRange(context.request);
  if (range.error) return json({ error: range.error }, 400);

  try {
    const startIso = iso(range.start);
    const endIso = iso(range.end);

    // Concurrently fetch counts and range-specific metrics
    const [
      companyCount,
      questionCount,
      newsCount,
      events,
      sessions,
      attempts
    ] = await Promise.all([
      supabaseCount(context.env, '/rest/v1/companies?select=id', auth.token).catch(() => 0),
      supabaseCount(context.env, '/rest/v1/interview_questions?select=id', auth.token).catch(() => 0),
      supabaseCount(context.env, '/rest/v1/hiring_news?select=id', auth.token).catch(() => 0),
      supabaseRequest(
        context.env,
        `/rest/v1/analytics_events?select=event_name,path,properties,occurred_at&occurred_at=gte.${startIso}&occurred_at=lte.${endIso}&limit=5000`,
        { accessToken: auth.token }
      ).catch(() => []),
      supabaseRequest(
        context.env,
        `/rest/v1/visitor_sessions?select=anonymous_id,last_seen_at&last_seen_at=gte.${startIso}&last_seen_at=lte.${endIso}&limit=5000`,
        { accessToken: auth.token }
      ).catch(() => []),
      supabaseRequest(
        context.env,
        `/rest/v1/quiz_attempts?select=score,is_abandoned,completed_at,started_at&started_at=gte.${startIso}&started_at=lte.${endIso}&limit=5000`,
        { accessToken: auth.token }
      ).catch(() => [])
    ]);

    const eventList = Array.isArray(events) ? events : [];
    const sessionList = Array.isArray(sessions) ? sessions : [];
    const attemptList = Array.isArray(attempts) ? attempts : [];

    const pageViews = eventList.filter((e) => e.event_name === 'page_view').length;
    const quizStarts = eventList.filter((e) => e.event_name === 'quiz_start').length;
    const quizCompletions = eventList.filter((e) => e.event_name === 'quiz_complete').length;
    const completedAttempts = attemptList.filter((a) => !a.is_abandoned && a.completed_at).length;
    const uniqueVisitors = new Set(sessionList.map((s) => s.anonymous_id).filter(Boolean)).size;

    const completionRate = quizStarts > 0
      ? Math.round((quizCompletions / quizStarts) * 10000) / 100
      : null;

    // Aggregate popular companies from company_view events
    const companyCounts = new Map();
    const categoryCounts = new Map();

    eventList.forEach((e) => {
      const props = e.properties && typeof e.properties === 'object' ? e.properties : {};
      if (e.event_name === 'company_view') {
        const c = props.companyId || props.company_id;
        if (c) companyCounts.set(c, (companyCounts.get(c) || 0) + 1);
      }
      if (e.event_name === 'quiz_start' || e.event_name === 'quiz_complete') {
        const cat = props.category;
        if (cat) categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      }
    });

    const popularCompanies = [...companyCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => ({ label, count }));

    const popularCategories = [...categoryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => ({ label, count }));

    // Recent activity: latest 5 events
    const recentActivity = eventList
      .slice(-5)
      .reverse()
      .map((e) => ({
        event: e.event_name,
        path: e.path || '—',
        timestamp: e.occurred_at
      }));

    return json({
      data: {
        currentUser: {
          id: auth.user.id,
          email: auth.user.email,
          role: auth.role,
          isOwner: auth.isOwner,
          displayName: auth.profile.display_name || auth.user.email
        },
        databaseRecords: {
          companies: companyCount,
          questions: questionCount,
          news: newsCount
        },
        metrics: {
          pageViews,
          visitorSessions: sessionList.length,
          uniqueVisitors,
          quizAttempts: attemptList.length,
          quizStarts,
          quizCompletions,
          completedAttempts,
          completionRate
        },
        popularCompanies,
        popularCategories,
        recentActivity,
        systemHealth: {
          backend: 'operational',
          database: companyCount > 0 ? 'reachable' : 'standby',
          checkedAt: new Date().toISOString()
        }
      },
      range: {
        from: range.start.toISOString(),
        to: range.end.toISOString()
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Admin overview error', error);
    return json({ error: 'Overview analytics could not be loaded' }, 500);
  }
}
