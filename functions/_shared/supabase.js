const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS
  });
}

export function envValue(env, name) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing server environment variable: ${name}`);
  }
  return value;
}

function supabaseHeaders(env, accessToken) {
  const serviceRoleKey = envValue(env, 'SUPABASE_SERVICE_ROLE_KEY');
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${accessToken || serviceRoleKey}`,
    'Content-Type': 'application/json'
  };
}

export async function supabaseRequest(env, path, options = {}) {
  const baseUrl = envValue(env, 'PUBLIC_SUPABASE_URL').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...supabaseHeaders(env, options.accessToken),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }
  if (!response.ok) {
    const error = new Error(payload?.message || `Supabase request failed: ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export function bearerToken(request) {
  const value = request.headers.get('Authorization') || '';
  if (!value.startsWith('Bearer ')) {
    return null;
  }
  return value.slice('Bearer '.length).trim() || null;
}

export async function requireAdmin(request, env) {
  const token = bearerToken(request);
  if (!token) {
    return { response: json({ error: 'Authentication required' }, 401) };
  }

  const supabaseUrl = envValue(env, 'PUBLIC_SUPABASE_URL').replace(/\/$/, '');
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: envValue(env, 'PUBLIC_SUPABASE_ANON_KEY'),
      Authorization: `Bearer ${token}`
    }
  });
  if (!userResponse.ok) {
    return { response: json({ error: 'Invalid authentication session' }, 401) };
  }

  const user = await userResponse.json();
  const userId = user?.id;
  if (!userId) {
    return { response: json({ error: 'Invalid authentication subject' }, 401) };
  }

  const encodedUserId = encodeURIComponent(userId);
  const profiles = await supabaseRequest(
    env,
    `/rest/v1/admin_profiles?select=user_id,role,display_name&user_id=eq.${encodedUserId}&is_active=eq.true`,
    { accessToken: token }
  );
  if (!Array.isArray(profiles) || profiles.length !== 1) {
    return { response: json({ error: 'Administrator access required' }, 403) };
  }

  return { token, user, profile: profiles[0] };
}

export async function writeActivityLog(env, token, userId, action, entityType, entityId, metadata = {}) {
  await supabaseRequest(env, '/rest/v1/admin_activity_logs', {
    method: 'POST',
    accessToken: token,
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify([{
      admin_user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      metadata
    }])
  });
}

export function readJsonBody(request) {
  return request.json().then((body) => {
    if (!body || Array.isArray(body) || typeof body !== 'object') {
      throw new Error('Request body must be a JSON object');
    }
    return body;
  });
}
