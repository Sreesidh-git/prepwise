import { envValue, json } from '../_shared/supabase.js';

export function onRequestGet(context) {
  try {
    return json({
      supabaseUrl: envValue(context.env, 'SUPABASE_URL'),
      supabasePublishableKey: envValue(context.env, 'SUPABASE_PUBLISHABLE_KEY'),
      siteUrl: context.env.PUBLIC_SITE_URL || '',
      ga4MeasurementId: context.env.PUBLIC_GA4_MEASUREMENT_ID || ''
    });
  } catch (error) {
    console.error('Public configuration error', error.message);
    return json({ error: 'Public configuration is unavailable' }, 503);
  }
}
