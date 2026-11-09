/**
 * PrepWise Client-Side Analytics & Telemetry
 * 
 * Includes:
 * - Exclusion of authenticated administrators (Owner & Admins)
 * - Safe developer/test exclusion mechanisms
 * - Strict gating behind user privacy consent (PrepWiseConsent)
 * - Session and duplicate event debouncing
 */
(function () {
  'use strict';

  const config = window.PREPWISE_CONFIG || {};
  const storageKey = 'prepwise_anonymous_id';
  const sessionKey = 'prepwise_session_id';
  const eventKey = 'prepwise_analytics_events';
  const devOptOutKey = 'prepwise_analytics_optout';

  function safeStorage(type) {
    try {
      return type === 'session' ? window.sessionStorage : window.localStorage;
    } catch {
      return null;
    }
  }

  // Handle URL developer controls (e.g., ?prepwise_analytics=disable or ?prepwise_analytics=enable)
  (function handleDeveloperParams() {
    try {
      if (typeof window === 'undefined' || !window.location) return;
      const params = new URLSearchParams(window.location.search);
      const val = params.get('prepwise_analytics');
      const debug = params.get('prepwise_debug');
      const local = safeStorage('local');
      if (!local) return;

      if (val === 'disable' || debug === 'exclude') {
        local.setItem(devOptOutKey, 'true');
        console.info('[PrepWise Analytics] Developer exclusion activated for this browser.');
      } else if (val === 'enable') {
        local.removeItem(devOptOutKey);
        console.info('[PrepWise Analytics] Developer exclusion cleared for this browser.');
      }
    } catch {
      // Defensive
    }
  })();

  function isAdminSession() {
    try {
      if (window.location.pathname.startsWith('/admin')) {
        return true;
      }
      const local = safeStorage('local');
      if (local) {
        const adminRaw = local.getItem('prepwise_admin_session');
        if (adminRaw) {
          const parsed = JSON.parse(adminRaw);
          if (parsed && (parsed.access_token || parsed.user)) {
            return true;
          }
        }
      }
      const session = safeStorage('session');
      if (session) {
        const adminRaw = session.getItem('prepwise_admin_session');
        if (adminRaw) {
          const parsed = JSON.parse(adminRaw);
          if (parsed && (parsed.access_token || parsed.user)) {
            return true;
          }
        }
      }
    } catch {
      // JSON parse error or access blocked
    }
    return false;
  }

  function isDeveloperExcluded() {
    try {
      if (window.__PREPWISE_DEV_EXCLUDE__ === true || window.__PREPWISE_ANALYTICS_EXCLUDE__ === true) {
        return true;
      }
      const local = safeStorage('local');
      if (local && local.getItem(devOptOutKey) === 'true') {
        return true;
      }
      const session = safeStorage('session');
      if (session && session.getItem(devOptOutKey) === 'true') {
        return true;
      }
    } catch {
      // Storage access blocked
    }
    return false;
  }

  function hasConsent() {
    if (window.PrepWiseConsent && typeof window.PrepWiseConsent.hasConsent === 'function') {
      return window.PrepWiseConsent.hasConsent('analytics');
    }
    return false;
  }

  function getExclusionStatus() {
    if (isAdminSession()) {
      return { excluded: true, reason: 'admin-session', trackingEnabled: false };
    }
    if (isDeveloperExcluded()) {
      return { excluded: true, reason: 'developer-optout', trackingEnabled: false };
    }
    if (!hasConsent()) {
      return { excluded: true, reason: 'consent-not-granted', trackingEnabled: false };
    }
    return { excluded: false, reason: null, trackingEnabled: true };
  }

  function identifier(key) {
    const store = safeStorage('local');
    if (!store) return null;
    let value;
    try {
      value = store.getItem(key);
      if (!value && window.crypto?.randomUUID) {
        value = window.crypto.randomUUID();
        store.setItem(key, value);
      }
    } catch {
      return null;
    }
    return value;
  }

  function clearAnalyticsStorage() {
    const local = safeStorage('local');
    if (local) {
      try {
        local.removeItem(storageKey);
        local.removeItem(sessionKey);
      } catch {}
    }
    const session = safeStorage('session');
    if (session) {
      try {
        session.removeItem(eventKey);
      } catch {}
    }
  }

  function alreadyTracked(eventName, properties = {}) {
    const store = safeStorage('session');
    if (!store) return false;
    try {
      const current = JSON.parse(store.getItem(eventKey) || '{}');
      const fingerprint = `${eventName}:${window.location.pathname}:${JSON.stringify({
        companyId: properties.companyId,
        category: properties.category,
        level: properties.level,
        resultCount: properties.resultCount,
        questionCount: properties.questionCount,
        score: properties.score
      })}`;
      if (current[fingerprint]) return true;
      current[fingerprint] = Date.now();
      const entries = Object.entries(current).filter(([, timestamp]) => Date.now() - timestamp < 86400000);
      store.setItem(eventKey, JSON.stringify(Object.fromEntries(entries)));
      return false;
    } catch {
      return false;
    }
  }

  function deviceCategory() {
    const width = window.innerWidth;
    return width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
  }

  function ga(eventName, parameters = {}) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, parameters);
    }
  }

  function track(eventName, properties = {}) {
    try {
      const status = getExclusionStatus();
      if (status.excluded) {
        return; // Suppressed for admin, developer opt-out, or missing consent
      }

      const advertisingEvent = eventName.startsWith('ad_');
      const anonymousId = identifier(storageKey);
      if (!anonymousId) return;
      if (alreadyTracked(eventName, properties)) return;

      const payload = {
        eventName,
        anonymousId,
        sessionId: identifier(sessionKey),
        path: window.location.pathname + window.location.search,
        title: document.title,
        referrer: document.referrer,
        properties: { ...properties, deviceCategory: deviceCategory() }
      };

      ga(eventName, properties);
      if (advertisingEvent) return;

      if (config.supabaseUrl && config.supabasePublishableKey) {
        fetch('/api/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(() => {});
      }
    } catch {
      // Defensive: analytics must never break public page functionality.
    }
  }

  window.prepwiseTrack = track;
  window.prepwiseAnalyticsStatus = getExclusionStatus;

  function initializeGa4() {
    const status = getExclusionStatus();
    if (status.excluded) return;

    if (!config.ga4MeasurementId || document.querySelector('script[data-prepwise-ga4]')) return;
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.ga4MeasurementId)}`;
    script.dataset.prepwiseGa4 = 'true';
    document.head.appendChild(script);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', config.ga4MeasurementId, { send_page_view: false });
  }

  async function loadRuntimeConfig() {
    try {
      const response = await fetch('/api/config', { headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const runtimeConfig = await response.json();
      Object.assign(config, runtimeConfig);
      config.supabaseAnonKey = config.supabasePublishableKey;
    } catch {
      // Static local hosting intentionally has no runtime configuration endpoint.
    }
  }

  function triggerPageEvents() {
    initializeGa4();
    track('page_view');

    const companyId = new URLSearchParams(window.location.search).get('id');
    if (companyId) track('company_view', { companyId });

    if (window.location.pathname.endsWith('/quiz.html') || window.location.pathname === '/quiz' || window.location.pathname.endsWith('/quiz')) {
      track('quiz_start', { companyId: new URLSearchParams(window.location.search).get('company') || 'tcs' });
    }
  }

  // React to dynamic consent updates
  window.addEventListener('prepwise_consent_updated', (event) => {
    const prefs = event.detail || {};
    if (prefs.analytics) {
      triggerPageEvents();
    } else {
      clearAnalyticsStorage();
    }
  });

  document.addEventListener('DOMContentLoaded', async () => {
    await loadRuntimeConfig();

    if (hasConsent()) {
      triggerPageEvents();
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      let timeout;
      searchInput.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          const term = searchInput.value.trim();
          if (term.length >= 2) {
            track('search', {
              search_term: term,
              queryLength: term.length,
              resultCount: document.querySelectorAll('.company-card[data-company]').length
            });
          }
        }, 700);
      });
    }
  });
})();
