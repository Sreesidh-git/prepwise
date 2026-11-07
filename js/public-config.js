// Safe fallback for static-only local hosting. Cloudflare Pages supplies the
// public values through /api/config; never put the secret key in this file.
window.PREPWISE_CONFIG = window.PREPWISE_CONFIG || {
  supabaseUrl: '',
  supabasePublishableKey: '',
  supabaseAnonKey: '',
  siteUrl: '',
  ga4MeasurementId: ''
};
