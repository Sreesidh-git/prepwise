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
  const serviceRoleKey = envValue(env, 'SUPABASE_SECRET_KEY');
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${accessToken || serviceRoleKey}`,
    'Content-Type': 'application/json'
  };
}

export async function supabaseRequest(env, path, options = {}) {
  const baseUrl = envValue(env, 'SUPABASE_URL').replace(/\/$/, '');
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

export async function supabaseCount(env, path, accessToken) {
  const baseUrl = envValue(env, 'SUPABASE_URL').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      ...supabaseHeaders(env, accessToken),
      Prefer: 'count=exact',
      Range: '0-0'
    }
  });
  if (!response.ok) {
    throw new Error(`Supabase count failed: ${response.status}`);
  }
  const contentRange = response.headers.get('content-range') || '';
  const total = contentRange.split('/')[1];
  return total && total !== '*' ? Number.parseInt(total, 10) : 0;
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

  try {
    const supabaseUrl = envValue(env, 'SUPABASE_URL').replace(/\/$/, '');
    const publishableKey = envValue(env, 'SUPABASE_PUBLISHABLE_KEY');

    let userResponse;
    try {
      userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${token}`
        }
      });
    } catch {
      return { response: json({ error: 'Authentication service unavailable' }, 503) };
    }

    if (!userResponse.ok) {
      return { response: json({ error: 'Invalid authentication session' }, 401) };
    }

    const user = await userResponse.json().catch(() => null);
    const userId = user?.id;
    if (!userId) {
      return { response: json({ error: 'Invalid authentication subject' }, 401) };
    }

    const ownerUserId = envValue(env, 'SUPABASE_OWNER_USER_ID');
    // Ensure SUPABASE_SECRET_KEY is also present for server mutations
    envValue(env, 'SUPABASE_SECRET_KEY');

    const encodedUserId = encodeURIComponent(userId);
    let profiles;
    try {
      profiles = await supabaseRequest(
        env,
        `/rest/v1/admin_profiles?select=user_id,role,display_name,is_active&user_id=eq.${encodedUserId}`,
        { accessToken: token }
      );
    } catch {
      return { response: json({ error: 'Administrator authorization check failed' }, 403) };
    }

    if (!Array.isArray(profiles) || profiles.length !== 1) {
      return { response: json({ error: 'Administrator access required' }, 403) };
    }

    const profile = profiles[0];

    // Profile must be active
    if (!profile.is_active) {
      return { response: json({ error: 'Account is deactivated' }, 403) };
    }

    // Role must be owner or admin
    if (profile.role !== 'owner' && profile.role !== 'admin') {
      return { response: json({ error: 'Administrator access required' }, 403) };
    }

    // If profile role claims to be owner, verify UID matches SUPABASE_OWNER_USER_ID
    const isOwner = (profile.role === 'owner' && userId === ownerUserId);
    if (profile.role === 'owner' && !isOwner) {
      return { response: json({ error: 'Owner access validation failed' }, 403) };
    }

    const verifiedRole = isOwner ? 'owner' : 'admin';

    return {
      token,
      user,
      profile,
      role: verifiedRole,
      isOwner
    };
  } catch (error) {
    return { response: json({ error: error.message || 'Server configuration is incomplete' }, 500) };
  }
}

export async function requireOwner(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.response) {
    return auth;
  }

  const ownerUserId = envValue(env, 'SUPABASE_OWNER_USER_ID');
  if (!auth.isOwner || auth.role !== 'owner' || auth.user.id !== ownerUserId) {
    return { response: json({ error: 'Owner access required' }, 403) };
  }

  return auth;
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
