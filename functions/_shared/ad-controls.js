import { envValue, supabaseRequest } from './supabase.js';

export const AD_CONTROLS_SETTING_KEY = 'adsterra_controls';

// Baseline strictly mirrors current working production js/adsterra-config.js:
// Popunder (32172757) is permanently OFF by default; all 5 approved units are ON.
export const DEFAULT_AD_UNITS = Object.freeze({
  '32172757': { unitId: '32172757', format: 'popunder', name: 'Popunder', defaultEnabled: false, ownerOnly: true },
  '32172758': { unitId: '32172758', format: 'social-bar', name: 'Social Bar', defaultEnabled: true, ownerOnly: false },
  '32172759': { unitId: '32172759', format: 'native-banner', name: 'Native Banner', defaultEnabled: true, ownerOnly: false },
  '32172760': { unitId: '32172760', format: 'banner-300x250', name: 'Banner 300x250', defaultEnabled: true, ownerOnly: false },
  '32172761': { unitId: '32172761', format: 'banner-320x50', name: 'Banner 320x50', defaultEnabled: true, ownerOnly: false },
  '32172762': { unitId: '32172762', format: 'banner-728x90', name: 'Banner 728x90', defaultEnabled: true, ownerOnly: false }
});

export function getBaselineAdControls() {
  return {
    masterEnabled: true,
    units: {
      '32172757': false,
      '32172758': true,
      '32172759': true,
      '32172760': true,
      '32172761': true,
      '32172762': true
    },
    source: 'baseline',
    updatedAt: null
  };
}

export function normalizeAdControls(rawValue, updatedAt = null) {
  const baseline = getBaselineAdControls();
  if (!rawValue || typeof rawValue !== 'object') {
    return baseline;
  }

  const normalizedUnits = {};
  Object.keys(DEFAULT_AD_UNITS).forEach((unitId) => {
    const fallback = DEFAULT_AD_UNITS[unitId].defaultEnabled;
    const rawState = rawValue.units?.[unitId];
    normalizedUnits[unitId] = typeof rawState === 'boolean' ? rawState : fallback;
  });

  return {
    masterEnabled: typeof rawValue.masterEnabled === 'boolean' ? rawValue.masterEnabled : baseline.masterEnabled,
    units: normalizedUnits,
    source: rawValue.source || 'supabase',
    updatedAt: updatedAt || rawValue.updatedAt || null
  };
}

export async function loadStoredAdControls(env, accessToken = null) {
  const rows = await supabaseRequest(
    env,
    `/rest/v1/website_settings?select=key,value,is_public,updated_at&key=eq.${encodeURIComponent(AD_CONTROLS_SETTING_KEY)}&limit=1`,
    accessToken ? { accessToken } : {}
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    return getBaselineAdControls();
  }
  return normalizeAdControls(row.value, row.updated_at);
}

/**
 * Non-blocking fail-open reader for public /api/config.
 * Returns only non-sensitive booleans; falls back to production baseline on error/timeout.
 */
export async function readPublicAdControls(env) {
  try {
    const baseUrl = envValue(env, 'SUPABASE_URL').replace(/\/$/, '');
    const publishableKey = envValue(env, 'SUPABASE_PUBLISHABLE_KEY');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    try {
      const resp = await fetch(
        `${baseUrl}/rest/v1/website_settings?select=value,updated_at&key=eq.${encodeURIComponent(AD_CONTROLS_SETTING_KEY)}&is_public=eq.true&limit=1`,
        {
          headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
          signal: controller.signal
        }
      );
      if (!resp.ok) return getBaselineAdControls();
      const rows = await resp.json().catch(() => null);
      const row = Array.isArray(rows) ? rows[0] : null;
      return row ? normalizeAdControls(row.value, row.updated_at) : getBaselineAdControls();
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return getBaselineAdControls();
  }
}

