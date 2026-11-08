import {
  envValue,
  json,
  readJsonBody,
  requireOwner,
  supabaseRequest,
  writeActivityLog
} from '../../_shared/supabase.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function onRequestGet(context) {
  const auth = await requireOwner(context.request, context.env);
  if (auth.response) return auth.response;

  try {
    // 1. Fetch all admin profiles
    const profiles = await supabaseRequest(
      context.env,
      '/rest/v1/admin_profiles?select=user_id,role,display_name,is_active,created_at,updated_at&order=created_at.asc',
      { accessToken: auth.token }
    );

    const profileList = Array.isArray(profiles) ? profiles : [];

    // 2. Attempt to resolve administrator emails via Supabase Auth Admin API
    let userEmailMap = new Map();
    try {
      const baseUrl = envValue(context.env, 'SUPABASE_URL').replace(/\/$/, '');
      const secretKey = envValue(context.env, 'SUPABASE_SECRET_KEY');

      // Specifically resolve emails for known administrator IDs without exposing unrelated Auth users
      await Promise.all(
        profileList.map(async (p) => {
          if (!p.user_id) return;
          if (p.user_id === auth.user.id && auth.user.email) {
            userEmailMap.set(p.user_id, auth.user.email);
            return;
          }
          try {
            const userRes = await fetch(`${baseUrl}/auth/v1/admin/users/${encodeURIComponent(p.user_id)}`, {
              headers: {
                apikey: secretKey,
                Authorization: `Bearer ${secretKey}`
              }
            });
            if (userRes.ok) {
              const u = await userRes.json();
              if (u?.email) userEmailMap.set(p.user_id, u.email);
            }
          } catch {
            // Ignore single user resolution failure
          }
        })
      );
    } catch {
      // Gracefully fall back without emails if admin users API is restricted
    }

    const data = profileList.map((p) => ({
      ...p,
      email: userEmailMap.get(p.user_id) || (p.user_id === auth.user.id ? auth.user.email : null)
    }));

    return json({ data });
  } catch (error) {
    console.error('Administrators GET error:', error);
    return json({ error: 'Failed to retrieve administrator profiles' }, 500);
  }
}

export async function onRequestPost(context) {
  const auth = await requireOwner(context.request, context.env);
  if (auth.response) return auth.response;

  try {
    const body = await readJsonBody(context.request);
    const userId = (body.user_id || '').trim();
    const displayName = (body.display_name || '').trim();

    if (!userId || !UUID_REGEX.test(userId)) {
      return json({ error: 'A valid Supabase Auth User UUID is required.' }, 400);
    }

    if (!displayName || displayName.length > 120) {
      return json({ error: 'Display name is required and must be 120 characters or fewer.' }, 400);
    }

    const ownerUserId = envValue(context.env, 'SUPABASE_OWNER_USER_ID');
    if (userId === ownerUserId) {
      return json({ error: 'The Owner profile is already configured and cannot be duplicated.' }, 409);
    }

    // Role is strictly fixed to 'admin' - owners can only be designated via configuration
    const newProfile = {
      user_id: userId,
      role: 'admin',
      display_name: displayName,
      is_active: true
    };

    const payload = await supabaseRequest(context.env, '/rest/v1/admin_profiles', {
      method: 'POST',
      accessToken: auth.token,
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([newProfile])
    });

    const created = Array.isArray(payload) ? payload[0] : payload;

    await writeActivityLog(
      context.env,
      auth.token,
      auth.user.id,
      'create_administrator',
      'admin_profiles',
      userId,
      { display_name: displayName, role: 'admin' }
    );

    return json({ data: created, success: true }, 201);
  } catch (error) {
    console.error('Administrators POST error:', error);
    if (error.message?.includes('duplicate key') || error.status === 409) {
      return json({ error: 'An administrator profile for this user ID already exists.' }, 409);
    }
    if (error.message?.includes('foreign key') || error.status === 400) {
      return json({ error: 'No matching Supabase Auth user found for this UUID. Create the user in Auth first.' }, 400);
    }
    return json({ error: error.message || 'Failed to create administrator profile' }, error.status || 500);
  }
}

export async function onRequestPatch(context) {
  const auth = await requireOwner(context.request, context.env);
  if (auth.response) return auth.response;

  try {
    const body = await readJsonBody(context.request);
    const userId = (body.user_id || '').trim();

    if (!userId || !UUID_REGEX.test(userId)) {
      return json({ error: 'A valid User UUID is required.' }, 400);
    }

    const ownerUserId = envValue(context.env, 'SUPABASE_OWNER_USER_ID');

    // Security Rule: Owner profile cannot be deactivated or demoted
    if (userId === ownerUserId) {
      if (body.is_active === false) {
        return json({ error: 'Cannot deactivate the Owner profile.' }, 403);
      }
      if (body.role && body.role !== 'owner') {
        return json({ error: 'Cannot demote the Owner profile.' }, 403);
      }
    }

    // Security Rule: Cannot promote someone to owner through API
    if (body.role && body.role === 'owner' && userId !== ownerUserId) {
      return json({ error: 'Cannot promote administrators to owner.' }, 403);
    }

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (typeof body.display_name === 'string') {
      const trimmed = body.display_name.trim();
      if (!trimmed || trimmed.length > 120) {
        return json({ error: 'Display name must be between 1 and 120 characters.' }, 400);
      }
      updates.display_name = trimmed;
    }

    if (typeof body.is_active === 'boolean') {
      updates.is_active = body.is_active;
    }

    const payload = await supabaseRequest(
      context.env,
      `/rest/v1/admin_profiles?user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        accessToken: auth.token,
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify([updates])
      }
    );

    const action = updates.is_active === false
      ? 'deactivate_administrator'
      : (updates.is_active === true && body.is_active !== undefined
        ? 'reactivate_administrator'
        : 'update_administrator');

    await writeActivityLog(
      context.env,
      auth.token,
      auth.user.id,
      action,
      'admin_profiles',
      userId,
      { updates: Object.keys(updates) }
    );

    return json({ data: payload, success: true });
  } catch (error) {
    console.error('Administrators PATCH error:', error);
    return json({ error: error.message || 'Failed to update administrator profile' }, error.status || 500);
  }
}

export async function onRequestDelete(context) {
  const auth = await requireOwner(context.request, context.env);
  if (auth.response) return auth.response;

  try {
    const url = new URL(context.request.url);
    const userId = (url.searchParams.get('user_id') || '').trim();

    if (!userId || !UUID_REGEX.test(userId)) {
      return json({ error: 'A valid User UUID is required.' }, 400);
    }

    const ownerUserId = envValue(context.env, 'SUPABASE_OWNER_USER_ID');
    if (userId === ownerUserId) {
      return json({ error: 'Cannot remove the Owner profile.' }, 403);
    }

    await supabaseRequest(
      context.env,
      `/rest/v1/admin_profiles?user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        accessToken: auth.token
      }
    );

    await writeActivityLog(
      context.env,
      auth.token,
      auth.user.id,
      'remove_administrator',
      'admin_profiles',
      userId
    );

    return json({ success: true, removed_user_id: userId });
  } catch (error) {
    console.error('Administrators DELETE error:', error);
    return json({ error: error.message || 'Failed to remove administrator' }, error.status || 500);
  }
}

