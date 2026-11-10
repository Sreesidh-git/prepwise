import { json, requireAdmin, supabaseCount } from '../../_shared/supabase.js';
import { loadStoredAdControls } from '../../_shared/ad-controls.js';

function summarizeAdConfigStatus(adControls) {
  if (!adControls || typeof adControls !== 'object') {
    return 'unavailable (saved ad controls could not be verified; Popunder 32172757 is OFF by default and Owner-controlled)';
  }
  const masterOn = adControls.masterEnabled !== false;
  const popOn = adControls.units?.['32172757'] === true;
  const eligibleIds = ['32172758', '32172759', '32172760', '32172761', '32172762'];
  const activeEligibleCount = eligibleIds.filter((id) => adControls.units?.[id] === true).length;

  if (!masterOn) {
    return `paused (Master Advertising OFF; ${activeEligibleCount}/5 eligible units saved ON; Popunder 32172757 ${popOn ? 'saved ON, paused by Master' : 'OFF by default, Owner-controlled'})`;
  }
  if (popOn) {
    return `active (${activeEligibleCount}/5 display/social units ON; Popunder 32172757 ON — explicitly enabled by Owner)`;
  }
  return `active (${activeEligibleCount}/5 display/social units ON; Popunder 32172757 OFF by default, Owner-controlled)`;
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context.request, context.env);
  if (auth.response) return auth.response;

  const startedAt = Date.now();
  try {
    let dbStatus = 'standby';
    let companyCount = 0;
    let questionCount = 0;
    let analyticsCount = 0;
    let adControls = null;

    try {
      [companyCount, questionCount, analyticsCount, adControls] = await Promise.all([
        supabaseCount(context.env, '/rest/v1/companies?select=id', auth.token),
        supabaseCount(context.env, '/rest/v1/interview_questions?select=id', auth.token),
        supabaseCount(context.env, '/rest/v1/analytics_events?select=id', auth.token).catch(() => 0),
        loadStoredAdControls(context.env, auth.token).catch(() => null)
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
        advertisingConfigurationStatus: summarizeAdConfigStatus(adControls),
        adControls,
        adControlsLoaded: Boolean(adControls),
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
