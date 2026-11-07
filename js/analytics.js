(function () {
  'use strict';

  const config = window.PREPWISE_CONFIG || {};
  const storageKey = 'prepwise_anonymous_id';
  const sessionKey = 'prepwise_session_id';

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
    const anonymousId = identifier(storageKey);
    if (!anonymousId) return;
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
    if (config.supabaseUrl && config.supabaseAnonKey) {
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
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

  document.addEventListener('DOMContentLoaded', () => {
    initializeGa4();
    track('page_view');

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      let timeout;
      searchInput.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => track('search', { query: searchInput.value, resultCount: document.querySelectorAll('.company-card[data-company]').length }), 700);
      });
    }
    const companyId = new URLSearchParams(window.location.search).get('id');
    if (companyId) track('company_view', { companyId });
    if (window.location.pathname.endsWith('/quiz.html')) {
      track('quiz_start', { companyId: new URLSearchParams(window.location.search).get('company') || 'tcs' });
    }
  });
})();
