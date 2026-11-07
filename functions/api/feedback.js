import { json, readJsonBody, supabaseRequest } from '../_shared/supabase.js';

const MAX_MESSAGE_LENGTH = 5000;

export async function onRequestPost(context) {
  try {
    const body = await readJsonBody(context.request);
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message || message.length > MAX_MESSAGE_LENGTH) {
      return json({ error: 'Message must be between 1 and 5,000 characters' }, 400);
    }
    const kind = ['general', 'incorrect_content', 'broken_link', 'accessibility'].includes(body.kind)
      ? body.kind
      : 'general';
    const payload = await supabaseRequest(context.env, '/rest/v1/feedback', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify([{
        anonymous_id: typeof body.anonymousId === 'string' ? body.anonymousId.slice(0, 128) : null,
        page_path: typeof body.pagePath === 'string' ? body.pagePath.slice(0, 500) : null,
        kind,
        message
      }])
    });
    return json({ ok: true, data: payload }, 201);
  } catch (error) {
    if (error.message === 'Request body must be a JSON object') {
      return json({ error: error.message }, 400);
    }
    console.error('Feedback submission error', error.status || 500);
    return json({ error: 'Feedback could not be submitted' }, 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204 });
}
