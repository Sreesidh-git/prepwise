import { envValue, json } from '../_shared/supabase.js';
import { readPublicAdControls } from '../_shared/ad-controls.js';

export async function onRequestGet(context) {
  try {
    const adControls = await readPublicAdControls(context.env);
    return json({
      supabaseUrl: envValue(context.env, 'SUPABASE_URL'),
      supabasePublishableKey: envValue(context.env, 'SUPABASE_PUBLISHABLE_KEY'),
      siteUrl: context.env.PUBLIC_SITE_URL || '',
      ga4MeasurementId: context.env.PUBLIC_GA4_MEASUREMENT_ID || 'G-K6P94Q968B',
      adControls
    });
  } catch (error) {
    console.error('Public configuration error', error.message);
    return json({ error: 'Public configuration is unavailable' }, 503);
  }
}
