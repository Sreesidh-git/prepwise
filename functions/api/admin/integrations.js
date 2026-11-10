import { json, requireAdmin } from '../../_shared/supabase.js';
import { gatherIntegrationsReport } from '../../_shared/integrations.js';

const VALID_SERVICES = new Set(['all', 'supabase', 'ga4', 'adsterra', 'gsc', 'cloudflare', 'health']);

export async function onRequestGet(context) {
  const auth = await requireAdmin(context.request, context.env);
  if (auth.response) return auth.response;

  const url = new URL(context.request.url);
  const service = (url.searchParams.get('service') || 'all').trim();
  if (!VALID_SERVICES.has(service)) {
    return json({ error: `Unknown integration service: ${service}` }, 400);
  }

  try {
    const report = await gatherIntegrationsReport({
      request: context.request,
      env: context.env,
      auth
    }, { service });
    return json({ data: report });
  } catch (error) {
    console.error('Admin integrations error', error);
    return json({ error: 'Failed to inspect service integrations' }, 500);
  }
}

export async function onRequestPost(context) {
  // POST triggers a live connection test / sync for a specified integration
  return onRequestGet(context);
}
