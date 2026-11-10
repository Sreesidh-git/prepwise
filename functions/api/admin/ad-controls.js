import { json, readJsonBody, requireAdmin, supabaseRequest, writeActivityLog } from '../../_shared/supabase.js';
import {
  AD_CONTROLS_SETTING_KEY,
  DEFAULT_AD_UNITS,
  loadStoredAdControls,
  normalizeAdControls
} from '../../_shared/ad-controls.js';

const VALID_ACTIONS = new Set(['toggle_unit', 'master_toggle', 'enable_all_eligible', 'disable_all']);

function formatAdminIdentity(auth) {
  return {
    id: auth.user.id,
    email: auth.user.email || null,
    displayName: auth.profile?.display_name || auth.user.email || auth.user.id,
    role: auth.role
  };
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context.request, context.env);
  if (auth.response) return auth.response;

  try {
    const [controls, logs] = await Promise.all([
      loadStoredAdControls(context.env, auth.token),
      supabaseRequest(
        context.env,
        '/rest/v1/admin_activity_logs?select=id,admin_user_id,action,entity_type,metadata,created_at&entity_type=eq.ad_controls&order=created_at.desc&limit=25',
        { accessToken: auth.token }
      ).catch(() => [])
    ]);

    return json({
      data: {
        controls,
        unitCatalog: Object.values(DEFAULT_AD_UNITS),
        permissions: {
          canToggleUnits: true,
          canTogglePopunder: auth.isOwner
        },
        runtimeEnforcement: {
          mode: 'live_runtime_gating',
          publicConfigEndpoint: '/api/config',
          enforcedInPublicProvider: true,
          note: 'Switches persist to Supabase website_settings, record audit logs, and gate public ad loading via /api/config on fresh page loads (already-loaded ads remain until refresh). Popunder unit 32172757 defaults to OFF and is strictly Owner-only.'
        },
        auditLogs: Array.isArray(logs) ? logs : []
      }
    });
  } catch (err) {
    console.error('Admin ad controls GET error:', err);
    return json({ error: 'Failed to load advertising control state' }, 500);
  }
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context.request, context.env);
  if (auth.response) return auth.response;

  let body;
  try {
    body = await readJsonBody(context.request);
  } catch (err) {
    return json({ error: err.message || 'Invalid JSON body' }, 400);
  }

  const action = String(body.action || '').trim();
  if (!VALID_ACTIONS.has(action)) {
    return json({ error: `Invalid ad control action: ${action || '(empty)'}` }, 400);
  }

  const timestamp = new Date().toISOString();
  const adminInfo = formatAdminIdentity(auth);

  let current;
  try {
    current = await loadStoredAdControls(context.env, auth.token);
  } catch (err) {
    return json({ error: `Unable to read current ad controls: ${err.message}` }, 500);
  }

  const next = normalizeAdControls(current, current.updatedAt);
  let targetUnitId = 'all';
  let previousState = null;
  let newState = null;

  if (action === 'toggle_unit') {
    const unitId = String(body.unitId || '').trim();
    if (!DEFAULT_AD_UNITS[unitId]) {
      return json({ error: `Unknown Adsterra unit ID: ${unitId}` }, 400);
    }
    if (typeof body.enabled !== 'boolean') {
      return json({ error: 'Boolean "enabled" value is required.' }, 400);
    }

    targetUnitId = unitId;
    previousState = Boolean(current.units[unitId]);
    newState = body.enabled;

    // Popunder safety enforcement (Unit 32172757) — only Owner can enable or disable
    if (unitId === '32172757') {
      if (!auth.isOwner) {
        await writeActivityLog(context.env, auth.token, auth.user.id, 'ad_control_denied', 'ad_controls', unitId, {
          administrator: adminInfo,
          unitId,
          previousState,
          attemptedState: newState,
          timestamp,
          success: false,
          reason: 'Only Owner can enable or disable Popunder unit 32172757.'
        });
        return json({ error: 'Only the Owner can enable or disable Popunder unit 32172757.' }, 403);
      }

      if (newState === true && body.popunderConfirmed !== true) {
        return json({
          error: 'Explicit Popunder confirmation (popunderConfirmed: true) is required before enabling unit 32172757.'
        }, 400);
      }
    }

    next.units[unitId] = newState;
  } else if (action === 'master_toggle') {
    if (typeof body.enabled !== 'boolean') {
      return json({ error: 'Boolean "enabled" value is required for master_toggle.' }, 400);
    }
    targetUnitId = 'master';
    previousState = { masterEnabled: current.masterEnabled, units: { ...current.units } };
    next.masterEnabled = body.enabled;
    // Master toggle never enables Popunder 32172757
    if (body.enabled) {
      next.units['32172757'] = current.units['32172757'] === true ? true : false;
    }
    newState = { masterEnabled: next.masterEnabled, units: { ...next.units } };
  } else if (action === 'enable_all_eligible') {
    targetUnitId = 'eligible_units';
    previousState = { masterEnabled: current.masterEnabled, units: { ...current.units } };
    next.masterEnabled = true;
    Object.keys(DEFAULT_AD_UNITS).forEach((id) => {
      // Enable All Eligible must never change Popunder setting
      if (id === '32172757') {
        next.units[id] = Boolean(current.units[id]);
      } else {
        next.units[id] = true;
      }
    });
    newState = { masterEnabled: next.masterEnabled, units: { ...next.units } };
  } else if (action === 'disable_all') {
    targetUnitId = 'all_units';
    previousState = { masterEnabled: current.masterEnabled, units: { ...current.units } };
    next.masterEnabled = false;
    Object.keys(DEFAULT_AD_UNITS).forEach((id) => {
      next.units[id] = false;
    });
    newState = { masterEnabled: next.masterEnabled, units: { ...next.units } };
  }

  const persistedValue = {
    masterEnabled: next.masterEnabled,
    units: next.units,
    source: 'supabase',
    updatedAt: timestamp
  };

  try {
    await supabaseRequest(context.env, '/rest/v1/website_settings?on_conflict=key', {
      method: 'POST',
      accessToken: auth.token,
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify([{
        key: AD_CONTROLS_SETTING_KEY,
        value: persistedValue,
        is_public: true,
        updated_by: auth.user.id,
        updated_at: timestamp
      }])
    });

    await writeActivityLog(context.env, auth.token, auth.user.id, `ad_control_${action}`, 'ad_controls', targetUnitId, {
      administrator: adminInfo,
      action,
      unitId: targetUnitId,
      previousState,
      newState,
      timestamp,
      success: true
    });

    return json({
      data: {
        controls: persistedValue,
        auditRecorded: true
      }
    });
  } catch (err) {
    await writeActivityLog(context.env, auth.token, auth.user.id, `ad_control_${action}_failed`, 'ad_controls', targetUnitId, {
      administrator: adminInfo,
      action,
      unitId: targetUnitId,
      previousState,
      attemptedState: newState,
      timestamp,
      success: false,
      error: err.message
    });
    return json({ error: `Failed to persist advertising controls: ${err.message}` }, 500);
  }
}

