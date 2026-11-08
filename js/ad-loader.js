(function () {
  'use strict';

  const registry = window.PREPWISE_AD_REGISTRY;
  const states = new Map();
  const observers = new Map();
  const focusHistory = new Map();
  const sessionKey = 'prepwise_ad_session_state';
  const provider = {
    request() {
      throw new Error('No advertising provider is configured');
    }
  };

  function getPlacement(id) {
    const placement = registry?.get(id);
    if (!placement) throw new Error(`Unknown advertising placement: ${id}`);
    return placement;
  }

  function deviceCategory() {
    const width = window.innerWidth;
    return width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
  }

  function isTargeted(placement) {
    return placement.devices.includes(deviceCategory());
  }

  function sessionState() {
    try {
      return JSON.parse(sessionStorage.getItem(sessionKey) || '{}');
    } catch (error) {
      return {};
    }
  }

  function updateSessionState(nextState) {
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify(nextState));
    } catch (error) {
      // Private browsing or disabled storage must not break the site.
    }
  }

  function frequencyAllowed(placement, frequencyCap) {
    if (!frequencyCap) return true;
    const state = sessionState();
    if (state[placement.id]?.dismissed) return false;
    const now = Date.now();
    const lastShown = state[placement.id]?.lastShown || 0;
    return now - lastShown >= frequencyCap;
  }

  function emit(eventName, placement, properties = {}) {
    if (typeof window.prepwiseTrack !== 'function') return;
    window.prepwiseTrack(`ad_${eventName}`, {
      placementId: placement.id,
      format: placement.format,
      ...properties
    });
  }

  function updateState(placement, status, details = {}) {
    states.set(placement.id, { status, ...details });
    const element = document.getElementById(placement.id);
    if (element) {
      element.dataset.adState = status;
      element.classList.toggle('ad-loading', status === 'loading');
      element.classList.toggle('ad-error', status === 'error');
    }
  }

  function applySizing(placement, element) {
    const size = placement.sizes?.[deviceCategory()];
    if (!size) return;
    element.style.minHeight = `${size[1]}px`;
    element.style.setProperty('--ad-slot-width', `${size[0]}px`);
  }

  function detectAdBlocker(error) {
    return Boolean(error && /blocked|ad.?block|network/i.test(error.message || ''));
  }

  function load(id, options = {}) {
    const placement = getPlacement(id);
    const element = document.getElementById(id);
    if (!element || !placement.enabled || !isTargeted(placement)) {
      return Promise.resolve({ status: 'disabled', placementId: id });
    }
    if (states.get(id)?.status === 'loaded') {
      return Promise.resolve({ status: 'loaded', placementId: id });
    }

    applySizing(placement, element);
    updateState(placement, 'loading');
    emit('request', placement);
    return Promise.resolve()
      .then(() => provider.request({ placement, element, config: placement.networkConfig, ...options }))
      .then((result) => {
        updateState(placement, 'loaded', { result });
        emit('loaded', placement);
        emit('impression', placement);
        return { status: 'loaded', placementId: id, result };
      })
      .catch((error) => {
        updateState(placement, 'error', { error: error.message });
        if (detectAdBlocker(error)) document.documentElement.dataset.adBlockerDetected = 'true';
        emit('failed', placement, { reason: error.message });
        return { status: 'error', placementId: id, error };
      });
  }

  function observe(id, options = {}) {
    const placement = getPlacement(id);
    if (!placement.enabled || !document.getElementById(id) || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        observers.delete(id);
        load(id, options);
      }
    }, { rootMargin: '200px 0px' });
    observer.observe(document.getElementById(id));
    observers.set(id, observer);
  }

  function close(id, reason = 'user') {
    const placement = getPlacement(id);
    const element = document.getElementById(id);
    if (!element) return;
    element.classList.remove('is-enabled');
    element.hidden = true;
    const state = sessionState();
    state[id] = { ...(state[id] || {}), dismissed: true };
    updateSessionState(state);
    if (placement.format === 'interstitial' || placement.format === 'modal') {
      document.body.classList.remove('ad-overlay-open');
      const previousFocus = focusHistory.get(id);
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
      focusHistory.delete(id);
    }
    emit('closed', placement, { reason });
  }

  function configure(nextProvider) {
    if (!nextProvider || typeof nextProvider.request !== 'function') {
      throw new Error('An advertising provider must implement request(context)');
    }
    provider.request = nextProvider.request;
  }

  function enable(id, options = {}) {
    const placement = getPlacement(id);
    if (!placement.enabled) return false;
    if (!isTargeted(placement)) return false;
    const element = document.getElementById(id);
    if (!element) return false;
    if (!frequencyAllowed(placement, options.frequencyCap)) return false;
    const previousFocus = document.activeElement;
    if (placement.format === 'interstitial' || placement.format === 'modal') {
      focusHistory.set(id, previousFocus);
      document.body.classList.add('ad-overlay-open');
    }
    applySizing(placement, element);
    element.hidden = false;
    element.classList.add('is-enabled');
    const state = sessionState();
    state[id] = { lastShown: Date.now() };
    updateSessionState(state);
    if (placement.dismissible) {
      const closeButton = element.querySelector('.ad-slot-close');
      if (closeButton) {
        closeButton.hidden = false;
        closeButton.addEventListener('click', () => close(id));
        if (placement.format === 'interstitial' || placement.format === 'modal') closeButton.focus();
      }
    }
    if (options.lazy !== false) observe(id, options);
    else load(id, options);
    return true;
  }

  function initialize() {
    if (detectAdBlocker()) {
      document.documentElement.dataset.adBlockerDetected = 'true';
    }
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      registry.placements
        .filter((placement) => placement.dismissible && document.getElementById(placement.id)?.classList.contains('is-enabled'))
        .forEach((placement) => close(placement.id, 'escape'));
    });
  }

  window.PREPWISE_ADS = Object.freeze({
    configure,
    close,
    deviceCategory,
    enable,
    getState: (id) => states.get(id) || { status: 'disabled' },
    initialize,
    load,
    observe
  });

  document.addEventListener('DOMContentLoaded', initialize);
})();
