import {
  json,
  readJsonBody,
  requireAdmin,
  supabaseRequest,
  writeActivityLog
} from '../../_shared/supabase.js';

const RESOURCES = new Set([
  'company_categories',
  'companies',
  'question_categories',
  'interview_questions',
  'quizzes',
  'hiring_news',
  'website_settings',
  'feedback',
  'admin_activity_logs'
]);
const MUTABLE_RESOURCES = new Set([
  'company_categories',
  'companies',
  'question_categories',
  'interview_questions',
  'quizzes',
  'hiring_news',
  'website_settings',
  'feedback'
]);

function resourceName(context) {
  const resource = context?.params?.resource;
  return RESOURCES.has(resource) ? resource : null;
}

async function handle(contextOrRequest, maybeContext) {
  const context = maybeContext || contextOrRequest;
  const request = contextOrRequest.request || contextOrRequest;
  const resource = resourceName(context);
  if (!resource) {
    return json({ error: 'Unknown admin resource' }, 404);
  }

  const auth = await requireAdmin(request, context.env);
  if (auth.response) {
    return auth.response;
  }

  try {
    if (request.method === 'GET') {
      const orderColumn = resource === 'admin_activity_logs' ? 'created_at' : 'updated_at';
      const payload = await supabaseRequest(
        context.env,
        `/rest/v1/${resource}?select=*&order=${orderColumn}.desc&limit=100`,
        { accessToken: auth.token }
      );
      return json({ data: payload });
    }

    if (!['POST', 'PATCH', 'DELETE'].includes(request.method) || !MUTABLE_RESOURCES.has(resource)) {
      return json({ error: 'Method not allowed' }, 405);
    }

    let path = `/rest/v1/${resource}`;
    let entityId = null;
    if (request.method !== 'POST') {
      const id = new URL(request.url).searchParams.get('id');
      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
        return json({ error: 'A valid resource id is required' }, 400);
      }
      entityId = id;
      path += `?id=eq.${encodeURIComponent(id)}`;
    }

    const body = request.method === 'DELETE' ? null : await readJsonBody(request);
    const payload = await supabaseRequest(context.env, path, {
      method: request.method,
      accessToken: auth.token,
      headers: { Prefer: 'return=representation' },
      body: body ? JSON.stringify([body]) : undefined
    });
    const createdId = Array.isArray(payload) ? payload[0]?.id : null;
    await writeActivityLog(
      context.env,
      auth.token,
      auth.user.id,
      `${request.method.toLowerCase()}_${resource}`,
      resource,
      entityId || createdId,
      { fields: body ? Object.keys(body) : [] }
    );
    return json({ data: payload });
  } catch (error) {
    if (error.message === 'Request body must be a JSON object') {
      return json({ error: error.message }, 400);
    }
    console.error('Admin resource error', error.status || 500);
    return json({ error: 'The admin operation could not be completed' }, error.status === 409 ? 409 : 500);
  }
}

export const onRequestGet = handle;
export const onRequestPost = handle;
export const onRequestPatch = handle;
export const onRequestDelete = handle;
