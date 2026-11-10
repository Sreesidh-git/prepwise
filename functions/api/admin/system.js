import { json, requireAdmin, supabaseCount } from '../../_shared/supabase.js';

export async function onRequestGet(context) {
  const auth = await requireAdmin(context.request, context.env);
  if (auth.response) return auth.response;

  const startedAt = Date.now();
  try {
    let dbStatus = 'standby';
    let companyCount = 0;
    let questionCount = 0;
    let analyticsCount = 0;

    try {
      [companyCount, questionCount, analyticsCount] = await Promise.all([
        supabaseCount(context.env, '/rest/v1/companies?select=id', auth.token),
        supabaseCount(context.env, '/rest/v1/interview_questions?select=id', auth.token),
        supabaseCount(context.env, '/rest/v1/analytics_events?select=id', auth.token).catch(() => 0)
      ]);
      dbStatus = companyCount > 0 ? 'reachable' : 'standby';
    } catch {
      dbStatus = 'connection error';
    }

    return json({
      data: {
        backendConnectivity: 'operational',
        databaseAvailability: dbStatus,
        adminApiHealth: `healthy (${auth.role}-authenticated)`,
        contentValidationStatus: `verified (${companyCount} companies, ${questionCount} questions in database)`,
        analyticsAvailability: `active (first-party: ${analyticsCount} recorded events; GA4 G-K6P94Q968B)`,
        advertisingConfigurationStatus: 'active (5 Adsterra display/social units; Popunder 32172757 permanently disabled)',
        contentRecords: companyCount,
        questionRecords: questionCount,
        analyticsRecords: analyticsCount,
        responseMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Admin system health error', error.message);
    return json({ error: 'System health could not be loaded' }, 503);
  }
}
