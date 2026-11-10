import { json, requireAdmin, supabaseRequest, supabaseCount } from '../../_shared/supabase.js';
import {
  buildCompanyLookup,
  canonicalizeCompanyLabel,
  countCompletedQuizCategories,
  parseAnalyticsDateRange
} from '../../_shared/analytics-helpers.js';

const DEFAULT_DAYS = 7;

function iso(value) {
  return encodeURIComponent(value.toISOString());
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context.request, context.env);
  if (auth.response) return auth.response;

  const range = parseAnalyticsDateRange(context.request, DEFAULT_DAYS);
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
      attempts,
      companyRows
    ] = await Promise.all([
      supabaseCount(context.env, '/rest/v1/companies?select=id', auth.token).catch(() => 0),
      supabaseCount(context.env, '/rest/v1/interview_questions?select=id', auth.token).catch(() => 0),
      supabaseCount(context.env, '/rest/v1/hiring_news?select=id', auth.token).catch(() => 0),
      supabaseRequest(
        context.env,
        `/rest/v1/analytics_events?select=event_name,path,properties,occurred_at&occurred_at=gte.${startIso}&occurred_at=lte.${endIso}&order=occurred_at.asc&limit=5000`,
        { accessToken: auth.token }
      ).catch(() => []),
      supabaseRequest(
        context.env,
        `/rest/v1/visitor_sessions?select=anonymous_id,last_seen_at&last_seen_at=gte.${startIso}&last_seen_at=lte.${endIso}&limit=5000`,
        { accessToken: auth.token }
      ).catch(() => []),
      supabaseRequest(
        context.env,
        `/rest/v1/quiz_attempts?select=score,is_abandoned,completed_at,started_at,category&started_at=gte.${startIso}&started_at=lte.${endIso}&limit=5000`,
        { accessToken: auth.token }
      ).catch(() => []),
      supabaseRequest(
        context.env,
        '/rest/v1/companies?select=id,slug,short_name,name&limit=500',
        { accessToken: auth.token }
      ).catch(() => [])
    ]);

    const eventList = Array.isArray(events) ? events : [];
    const sessionList = Array.isArray(sessions) ? sessions : [];
    const attemptList = Array.isArray(attempts) ? attempts : [];
    const companyLookup = buildCompanyLookup(companyRows);

    const pageViews = eventList.filter((e) => e.event_name === 'page_view').length;
    const quizStarts = eventList.filter((e) => e.event_name === 'quiz_start').length;
    const quizCompletions = eventList.filter((e) => e.event_name === 'quiz_complete').length;
    const quizAttempts = attemptList.length;
    const completedAttempts = attemptList.filter((a) => !a.is_abandoned && a.completed_at).length;
    const uniqueVisitors = new Set(sessionList.map((s) => s.anonymous_id).filter(Boolean)).size;

    const eligibleStarts = quizStarts > 0 ? quizStarts : quizAttempts;
    const eligibleCompletions = quizStarts > 0 ? quizCompletions : completedAttempts;
    const completionRate = eligibleStarts > 0
      ? Math.round((eligibleCompletions / eligibleStarts) * 10000) / 100
      : null;

    // Aggregate popular companies, popular pages, and daily series from events
    const companyCounts = new Map();
    const pageCounts = new Map();
    const dailyMap = new Map();

    eventList.forEach((e) => {
      const props = e.properties && typeof e.properties === 'object' ? e.properties : {};
      if (e.occurred_at) {
        const day = new Date(e.occurred_at).toISOString().slice(0, 10);
        const bucket = dailyMap.get(day) || { date: day, pageViews: 0, quizStarts: 0, quizCompletions: 0, totalEvents: 0 };
        bucket.totalEvents += 1;
        if (e.event_name === 'page_view') bucket.pageViews += 1;
        if (e.event_name === 'quiz_start') bucket.quizStarts += 1;
        if (e.event_name === 'quiz_complete') bucket.quizCompletions += 1;
        dailyMap.set(day, bucket);
      }
      if (e.event_name === 'page_view' && e.path) {
        pageCounts.set(e.path, (pageCounts.get(e.path) || 0) + 1);
      }
      if (e.event_name === 'company_view') {
        const label = canonicalizeCompanyLabel(props.companyId || props.company_id, companyLookup);
        if (label) companyCounts.set(label, (companyCounts.get(label) || 0) + 1);
      }
    });
    const categoryCounts = countCompletedQuizCategories(attemptList, eventList);

    const dailyActivity = [];
    const cursor = new Date(range.start);
    cursor.setUTCHours(0, 0, 0, 0);
    const endDay = new Date(range.end);
    endDay.setUTCHours(23, 59, 59, 999);
    let guard = 0;
    while (cursor <= endDay && guard < 370) {
      const day = cursor.toISOString().slice(0, 10);
      dailyActivity.push(dailyMap.get(day) || { date: day, pageViews: 0, quizStarts: 0, quizCompletions: 0, totalEvents: 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      guard++;
    }

    const popularPages = [...pageCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([label, count]) => ({ label, count }));

    const popularCompanies = [...companyCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([label, count]) => ({ label, count }));

    const popularCategories = [...categoryCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
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
        popularPages,
        popularCategories,
        dailyActivity,
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
