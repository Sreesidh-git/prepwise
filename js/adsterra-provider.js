/**
 * PrepWise — Adsterra Provider Adapter (js/adsterra-provider.js)
 * 
 * Bridges Adsterra advertising units with PrepWise ad lifecycle engine.
 * 
 * Enforces:
 * - Explicit user consent check prior to loading
 * - Script and placement deduplication
 * - Layout-shift prevention with responsive min-height bounds
 * - Kill-switch controls for immediate placement disabling
 * - Zero mock/fake publisher execution
 */

(function () {
  'use strict';

  const config = window.PREPWISE_ADSTERRA_CONFIG;
  const loadedScripts = new Set();
  const renderedPlacements = new Set();

  function getDeviceType() {
    const w = window.innerWidth;
    return w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
  }

  function hasAdvertisingConsent() {
    if (typeof window.PrepWiseConsent !== 'undefined' && typeof window.PrepWiseConsent.hasConsent === 'function') {
      return window.PrepWiseConsent.hasConsent('advertising');
    }
    // If consent module is absent or uninitialized, default to false for safety
    return false;
  }

  const AdsterraProvider = {
    name: 'adsterra',

    /**
     * Request and render an Adsterra ad placement.
     * @param {Object} context
     * @param {Object} context.placement - Registry placement metadata
     * @param {HTMLElement} context.element - Slot container element in DOM
     */
    request({ placement, element }) {
      return new Promise((resolve, reject) => {
        // 1. Consent Gate
        if (!hasAdvertisingConsent()) {
          return reject(new Error('Advertising consent not granted by user'));
        }

        // 2. Global & Placement Config Checks
        if (!config || !config.enabled) {
          return reject(new Error('Adsterra monetization is globally disabled pending verification'));
        }

        const placementConfig = config.placements?.[placement.id];
        if (!placementConfig || !placementConfig.enabled) {
          return reject(new Error(`Adsterra placement "${placement.id}" is disabled`));
        }

        if (placementConfig.prohibited) {
          return reject(new Error(`Placement "${placement.id}" is prohibited under educational safety policy`));
        }

        // 3. Genuine Code Verification (No fake or placeholder codes)
        if (!placementConfig.adsterraKey || !placementConfig.scriptSrc) {
          return reject(new Error(`Adsterra genuine code is not yet configured for "${placement.id}"`));
        }

        // 4. Duplicate Render Guard
        if (renderedPlacements.has(placement.id)) {
          return resolve({ status: 'already-rendered', placementId: placement.id });
        }

        const device = getDeviceType();
        const size = placementConfig.sizes?.[device] || placementConfig.sizes?.desktop || [728, 90];

        // 5. Layout Stability & Accessible Label
        element.style.minHeight = `${size[1] + 24}px`; // Reserve height including label to prevent CLS
        element.style.setProperty('--ad-slot-width', `${size[0]}px`);

        // Create label if not already present
        if (!element.querySelector('.ad-label')) {
          const label = document.createElement('div');
          label.className = 'ad-label';
          label.setAttribute('aria-hidden', 'true');
          label.textContent = placementConfig.label || 'Advertisement';
          element.appendChild(label);
        }

        // Create isolated content frame
        let container = element.querySelector('.ad-content-box');
        if (!container) {
          container = document.createElement('div');
          container.className = 'ad-content-box';
          container.id = `adsterra-box-${placement.id}`;
          container.style.width = '100%';
          container.style.maxWidth = `${size[0]}px`;
          container.style.minHeight = `${size[1]}px`;
          container.style.margin = '0 auto';
          container.style.overflow = 'hidden';
          element.appendChild(container);
        }

        // 6. Script Deduplication & Injection
        const scriptId = `adsterra-script-${placement.id}`;
        if (!document.getElementById(scriptId) && !loadedScripts.has(placementConfig.scriptSrc)) {
          const script = document.createElement('script');
          script.id = scriptId;
          script.async = true;
          script.src = placementConfig.scriptSrc;
          script.dataset.adsterraKey = placementConfig.adsterraKey;

          script.onload = () => {
            loadedScripts.add(placementConfig.scriptSrc);
            renderedPlacements.add(placement.id);
            element.classList.add('adsterra-active');
            resolve({ status: 'rendered', placementId: placement.id, format: placementConfig.type });
          };

          script.onerror = (err) => {
            reject(new Error(`Failed to load Adsterra script for "${placement.id}": ${err?.message || 'Network error'}`));
          };

          container.appendChild(script);
        } else {
          // Script already loaded on page, mark rendered
          renderedPlacements.add(placement.id);
          element.classList.add('adsterra-active');
          resolve({ status: 'rendered', placementId: placement.id, format: placementConfig.type });
        }
      });
    },

    /**
     * Emergency Kill-Switch: Disables a placement in real time.
     */
    killPlacement(placementId) {
      const el = document.getElementById(placementId);
      if (el) {
        el.classList.remove('is-enabled', 'adsterra-active');
        el.style.display = 'none';
        el.innerHTML = '';
      }
      renderedPlacements.delete(placementId);
      console.warn(`[PrepWise Adsterra] Placement "${placementId}" killed.`);
    },

    /**
     * Emergency Kill-Switch: Disables all advertising.
     */
    killAll() {
      if (config) {
        config.enabled = false;
      }
      renderedPlacements.forEach((id) => this.killPlacement(id));
      renderedPlacements.clear();
      console.warn('[PrepWise Adsterra] All advertising terminated via master kill-switch.');
    }
  };

  // Wire Adsterra provider into PrepWise Ad Loader if present
  if (typeof window.PREPWISE_ADS !== 'undefined' && typeof window.PREPWISE_ADS.configure === 'function') {
    window.PREPWISE_ADS.configure(AdsterraProvider);
  }

  const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.PREPWISE_ADSTERRA = AdsterraProvider;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdsterraProvider;
  }
})();

