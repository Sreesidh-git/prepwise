// Safe fallback for static-only local hosting. Cloudflare Pages supplies the
// public values through /api/config; never put the secret key in this file.
window.PREPWISE_CONFIG = window.PREPWISE_CONFIG || {
  supabaseUrl: '',
  supabasePublishableKey: '',
  supabaseAnonKey: '',
  siteUrl: '',
  ga4MeasurementId: 'G-K6P94Q968B',
  futureCanonicalDomain: 'https://prepwises.online',
  activeProductionDomain: 'https://prepwise-7ij.pages.dev'
};
