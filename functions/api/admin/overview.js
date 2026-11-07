import { json, requireAdmin, supabaseCount } from '../../_shared/supabase.js';

const COUNT_TARGETS = [
  ['companies', '/rest/v1/companies?select=id'],
  ['questions', '/rest/v1/interview_questions?select=id'],
  ['news', '/rest/v1/hiring_news?select=id'],
  ['pageViews', '/rest/v1/page_views?select=id'],
  ['uniqueSessions', '/rest/v1/visitor_sessions?select=id'],
  ['quizAttempts', '/rest/v1/quiz_attempts?select=id'],
  ['feedbackOpen', '/rest/v1/feedback?select=id&status=eq.open']
];

export async function onRequestGet(context) {
  const auth = await requireAdmin(context.request, context.env);
  if (auth.response) {
    return auth.response;
  }
  try {
    const values = await Promise.all(
      COUNT_TARGETS.map(async ([name, path]) => [name, await supabaseCount(context.env, path, auth.token)])
    );
    return json({
      data: Object.fromEntries(values),
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Admin overview error', error.message);
    return json({ error: 'Overview analytics could not be loaded' }, 500);
  }
}
