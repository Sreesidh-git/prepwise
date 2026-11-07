import { json, supabaseRequest } from '../_shared/supabase.js';

const allowedEvents = new Set(['page_view', 'search', 'company_view', 'quiz_start', 'quiz_complete']);
const rateBuckets = new Map();

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function withinRateLimit(request) {
  const key = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= 60_000) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= 60;
}

function safeText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : null;
}

export async function onRequestPost(context) {
  if (!withinRateLimit(context.request)) {
    return json({ error: 'Analytics rate limit exceeded' }, 429);
  }
  try {
    const body = await context.request.json();
    const eventName = safeText(body?.eventName, 40);
    const anonymousId = safeText(body?.anonymousId, 128);
    if (!allowedEvents.has(eventName) || !anonymousId || anonymousId.length < 16) {
      return json({ error: 'Invalid analytics event' }, 400);
    }

    const properties = body.properties && typeof body.properties === 'object' && !Array.isArray(body.properties)
      ? body.properties
      : {};
    const path = safeText(body.path, 500);
    await supabaseRequest(context.env, '/rest/v1/analytics_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify([{ event_name: eventName, anonymous_id: anonymousId, path, properties }])
    });

    if (eventName === 'page_view') {
      const sessionId = isUuid(body.sessionId) ? body.sessionId : null;
      if (sessionId) {
        await supabaseRequest(context.env, `/rest/v1/visitor_sessions?id=eq.${sessionId}`, {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify([{
            id: sessionId,
            anonymous_id: anonymousId,
            last_seen_at: new Date().toISOString(),
            landing_path: path,
            page_count: 1
          }])
        });
        await supabaseRequest(context.env, '/rest/v1/page_views', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify([{
            session_id: sessionId,
            anonymous_id: anonymousId,
            path,
            title: safeText(body.title, 200),
            referrer: safeText(body.referrer, 500),
            device_category: safeText(properties.deviceCategory, 20) || 'unknown'
          }])
        });
      }
    } else if (eventName === 'search') {
      await supabaseRequest(context.env, '/rest/v1/search_queries', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify([{
          anonymous_id: anonymousId,
          query: safeText(properties.query, 200) || 'unknown',
          result_count: Number.isInteger(properties.resultCount) ? Math.max(properties.resultCount, 0) : null
        }])
      });
    } else if (eventName === 'quiz_complete') {
      await supabaseRequest(context.env, '/rest/v1/quiz_attempts', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify([{
          anonymous_id: anonymousId,
          question_count: Number.isInteger(properties.questionCount) ? Math.max(properties.questionCount, 0) : 0,
          answered_count: Number.isInteger(properties.answeredCount) ? Math.max(properties.answeredCount, 0) : 0,
          score: Number.isInteger(properties.score) ? Math.max(properties.score, 0) : null,
          category: safeText(properties.category, 100),
          level: safeText(properties.level, 30),
          completed_at: new Date().toISOString(),
          is_abandoned: false
        }])
      });
    }
    return json({ ok: true }, 202);
  } catch (error) {
    console.error('Analytics event error', error.message);
    return json({ error: 'Analytics event rejected' }, 400);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204 });
}
