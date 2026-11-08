(function () {
  'use strict';

  const config = window.PREPWISE_CONFIG || {};
  const storageKey = 'prepwise_anonymous_id';
  const sessionKey = 'prepwise_session_id';
  const eventKey = 'prepwise_analytics_events';

  function storage() {
    try {
      return window.localStorage;
    } catch (error) {
      return null;
    }
  }

  function identifier(key) {
    const store = storage();
    if (!store) return null;
    let value;
    try {
      value = store.getItem(key);
      if (!value && window.crypto?.randomUUID) {
        value = window.crypto.randomUUID();
        store.setItem(key, value);
      }
    } catch (error) {
      return null;
    }
    return value;
  }

  function alreadyTracked(eventName, properties = {}) {
    let store;
    try {
      store = window.sessionStorage;
      if (!store) return false;
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
    } catch (error) {
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
    } catch (error) {
      // Defensive: analytics must never break public page functionality.
    }
  }

  window.prepwiseTrack = track;

  function initializeGa4() {
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
    } catch (error) {
      // Static local hosting intentionally has no runtime configuration endpoint.
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await loadRuntimeConfig();
    initializeGa4();
    track('page_view');

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      let timeout;
      searchInput.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => track('search', { queryLength: searchInput.value.trim().length, resultCount: document.querySelectorAll('.company-card[data-company]').length }), 700);
      });
    }
    const companyId = new URLSearchParams(window.location.search).get('id');
    if (companyId) track('company_view', { companyId });
    if (window.location.pathname.endsWith('/quiz.html')) {
      track('quiz_start', { companyId: new URLSearchParams(window.location.search).get('company') || 'tcs' });
    }
  });
})();
