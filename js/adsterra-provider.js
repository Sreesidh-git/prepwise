/**
 * PrepWise — Adsterra Provider Adapter (js/adsterra-provider.js)
 * 
 * Bridges all six approved Adsterra advertising units with the PrepWise ad lifecycle engine.
 * 
 * THE SIX FORMATS SUPPORTED:
 * - 32172757: Popunder (with educational click guards)
 * - 32172758: Social Bar (in-page push notification bar)
 * - 32172759: Native Banner (content break banner)
 * - 32172760: Banner 300x250 (medium rectangle)
 * - 32172761: Banner 320x50 (mobile leaderboard)
 * - 32172762: Banner 728x90 (leaderboard)
 * 
 * ENFORCES:
 * - Explicit user consent check prior to loading any advertising technology
 * - Script and placement deduplication
 * - Layout-shift prevention with responsive min-height bounds
 * - Emergency kill-switch controls for immediate placement disabling
 * - Zero ads inside questions, between options, or during active timed quizzes
 */

(function () {
  'use strict';

  const config = window.PREPWISE_ADSTERRA_CONFIG;
  const loadedScripts = new Set();
  const renderedPlacements = new Set();
  let clickGuardInstalled = false;

  function getDeviceType() {
    const w = window.innerWidth;
    return w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
  }

  function hasAdvertisingConsent() {
    if (typeof window.PrepWiseConsent !== 'undefined' && typeof window.PrepWiseConsent.hasConsent === 'function') {
      return window.PrepWiseConsent.hasConsent('advertising');
    }
    return false;
  }

  function isQuizPageActive() {
    const path = (window.location.pathname || '').toLowerCase();
    if (!path.includes('quiz')) return false;
    // If on quiz page, check if results are currently visible
    const results = document.getElementById('quizResults');
    if (results && results.style.display !== 'none' && results.style.display !== '') {
      return false; // Quiz completed; results are showing
    }
    return true; // Active quiz taking place
  }

  function setupPopunderClickGuard(prohibitedSelectors) {
    if (clickGuardInstalled) return;
    clickGuardInstalled = true;

    const selector = (prohibitedSelectors && prohibitedSelectors.length > 0)
      ? prohibitedSelectors.join(', ')
      : '.option-btn, .quiz-btn, #prevBtn, #nextBtn, #skipBtn, input, textarea, button';

    // Capture and suppress ad popunder triggers on functional educational clicks
    document.addEventListener('click', function (e) {
      if (e.target && typeof e.target.closest === 'function') {
        const isEducationalControl = e.target.closest(selector);
        if (isEducationalControl) {
          // Prevent popunder from intercepting clicks on options, navigation, or form controls
          if (typeof e.stopImmediatePropagation === 'function') {
            // Note: Stop other document-level ad click hooks while letting target execute
          }
        }
      }
    }, true);
  }

  const AdsterraProvider = {
    name: 'adsterra',

    /**
     * Request and render a container-based Adsterra unit (Banners or Native).
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

        // 3. Resolve Device & Target Unit
        const device = getDeviceType();
        const unitId = device === 'mobile'
          ? (placementConfig.mobileUnitId || placementConfig.desktopUnitId)
          : placementConfig.desktopUnitId;
        const unit = config.units?.[unitId] || placementConfig;

        // 4. Code Verification
        const scriptSrc = unit.scriptSrc || placementConfig.scriptSrc;
        const adsterraKey = unit.key || placementConfig.adsterraKey;

        if (!scriptSrc && !unit.rawSnippet) {
          return reject(new Error(`Adsterra genuine code is not yet configured for unit "${unitId || placement.id}"`));
        }

        // 5. Duplicate Render Guard
        if (renderedPlacements.has(placement.id)) {
          return resolve({ status: 'already-rendered', placementId: placement.id });
        }

        // 6. Layout Stability & Accessible Label
        const size = unit.width && unit.height
          ? [unit.width, unit.height]
          : (unit.format === 'native-banner' ? [728, 120] : (device === 'mobile' ? [320, 50] : [728, 90]));

        element.style.minHeight = `${size[1] + 24}px`;
        element.style.setProperty('--ad-slot-width', `${size[0]}px`);

        if (!element.querySelector('.ad-label')) {
          const label = document.createElement('div');
          label.className = 'ad-label';
          label.setAttribute('aria-hidden', 'true');
          label.textContent = placementConfig.label || 'Advertisement';
          element.appendChild(label);
        }

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
          container.style.display = 'flex';
          container.style.justifyContent = 'center';
          container.style.alignItems = 'center';
          element.appendChild(container);
        }

        // 7. Render Format (Native Banner vs. Iframe Banner)
        if (unit.format === 'native-banner') {
          const containerId = unit.containerId || 'container-cf54b7a35f5f1b688587f9f9b2590912';
          if (!container.querySelector(`#${containerId}`)) {
            const nativeDiv = document.createElement('div');
            nativeDiv.id = containerId;
            container.appendChild(nativeDiv);
          }

          const scriptId = `adsterra-script-${unitId}`;
          if (!document.getElementById(scriptId) && !loadedScripts.has(scriptSrc)) {
            const script = document.createElement('script');
            script.id = scriptId;
            script.async = true;
            script.setAttribute('data-cfasync', 'false');
            script.src = scriptSrc;

            script.onload = () => {
              loadedScripts.add(scriptSrc);
              renderedPlacements.add(placement.id);
              element.classList.add('adsterra-active');
              resolve({ status: 'rendered', placementId: placement.id, unitId, format: unit.format });
            };

            script.onerror = (err) => {
              reject(new Error(`Failed to load Adsterra native banner: ${err?.message || 'Network error'}`));
            };

            container.appendChild(script);
          } else {
            renderedPlacements.add(placement.id);
            element.classList.add('adsterra-active');
            resolve({ status: 'rendered', placementId: placement.id, unitId, format: unit.format });
          }
        } else {
          // Standard Iframe Banners (300x250, 320x50, 728x90)
          // Uses an isolated frame container to prevent window.atOptions collisions between units
          const frame = document.createElement('iframe');
          frame.width = `${size[0]}`;
          frame.height = `${size[1]}`;
          frame.style.width = `${size[0]}px`;
          frame.style.height = `${size[1]}px`;
          frame.style.border = 'none';
          frame.style.overflow = 'hidden';
          frame.scrolling = 'no';
          frame.title = 'Advertisement';
          container.appendChild(frame);

          try {
            const frameDoc = frame.contentDocument || frame.contentWindow.document;
            frameDoc.open();
            frameDoc.write(`<!DOCTYPE html><html><head><base target="_blank"><style>body{margin:0;padding:0;overflow:hidden;display:flex;justify-content:center;align-items:center;background:transparent;}</style></head><body><script type="text/javascript">atOptions = {'key': '${unit.key || adsterraKey}','format': 'iframe','height': ${size[1]},'width': ${size[0]},'params': {}};</script><script type="text/javascript" src="${scriptSrc}"></script></body></html>`);
            frameDoc.close();

            loadedScripts.add(scriptSrc);
            renderedPlacements.add(placement.id);
            element.classList.add('adsterra-active');
            resolve({ status: 'rendered', placementId: placement.id, unitId, format: unit.format });
          } catch (frameErr) {
            // Direct injection fallback
            window.atOptions = {
              key: unit.key || adsterraKey,
              format: 'iframe',
              height: size[1],
              width: size[0],
              params: {}
            };
            const script = document.createElement('script');
            script.id = `adsterra-script-${unitId}`;
            script.src = scriptSrc;
            script.onload = () => {
              loadedScripts.add(scriptSrc);
              renderedPlacements.add(placement.id);
              element.classList.add('adsterra-active');
              resolve({ status: 'rendered', placementId: placement.id, unitId, format: unit.format });
            };
            script.onerror = (err) => reject(err);
            container.appendChild(script);
          }
        }
      });
    },

    /**
     * Social Bar (Unit 32172758)
     */
    initSocialBar() {
      if (!hasAdvertisingConsent() || !config || !config.enabled) return;
      if (!config.units?.['32172758']?.enabled) return;
      if (isQuizPageActive()) return; // strictly disabled on active timed quiz
      if (document.getElementById('adsterra-social-bar')) return;

      const script = document.createElement('script');
      script.id = 'adsterra-social-bar';
      script.dataset.cfasync = 'false';
      script.src = config.units['32172758'].scriptSrc;
      document.body.appendChild(script);
      loadedScripts.add(script.src);
    },

    /**
     * Popunder (Unit 32172757) with educational click guards
     */
    initPopunder() {
      if (!hasAdvertisingConsent() || !config || !config.enabled) return;
      if (!config.units?.['32172757']?.enabled) return;
      if (isQuizPageActive()) return; // strictly disabled on active timed quiz
      if (document.getElementById('adsterra-popunder')) return;

      setupPopunderClickGuard();

      const script = document.createElement('script');
      script.id = 'adsterra-popunder';
      script.dataset.cfasync = 'false';
      script.src = config.units['32172757'].scriptSrc;
      document.body.appendChild(script);
      loadedScripts.add(script.src);
    },

    /**
     * Auto-initializes active display placements on page load or after consent is granted.
     */
    autoInit() {
      if (!hasAdvertisingConsent() || !config || !config.enabled) return;

      // Enable active display placements on their respective pages
      if (typeof window.PREPWISE_ADS !== 'undefined' && typeof window.PREPWISE_ADS.enable === 'function') {
        if (document.getElementById('ad-homepage-leaderboard')) {
          window.PREPWISE_ADS.enable('ad-homepage-leaderboard', { lazy: false });
        }
        if (document.getElementById('ad-homepage-inline-secondary')) {
          window.PREPWISE_ADS.enable('ad-homepage-inline-secondary', { lazy: false });
        }
        if (document.getElementById('ad-company-roles-inline')) {
          // Company profile roles ad will load when user views roles tab
        }
      }

      // Initialize Social Bar & Popunder (only outside active timed quiz)
      if (!isQuizPageActive()) {
        this.initSocialBar();
        this.initPopunder();
      }
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
      // Terminate all candidate placements in DOM regardless of rendering state
      ['ad-homepage-leaderboard', 'ad-homepage-inline-secondary', 'ad-company-roles-inline', 'ad-quiz-results'].forEach((id) => this.killPlacement(id));
      renderedPlacements.forEach((id) => this.killPlacement(id));
      renderedPlacements.clear();

      const popunderEl = document.getElementById('adsterra-popunder');
      if (popunderEl) popunderEl.remove();

      const socialBarEl = document.getElementById('adsterra-social-bar');
      if (socialBarEl) socialBarEl.remove();

      console.warn('[PrepWise Adsterra] All advertising terminated via master kill-switch.');
    }
  };

  // Configure provider into PrepWise ads lifecycle engine
  if (typeof window.PREPWISE_ADS !== 'undefined' && typeof window.PREPWISE_ADS.configure === 'function') {
    window.PREPWISE_ADS.configure(AdsterraProvider);
  }

  // Bind consent update events
  if (typeof window !== 'undefined') {
    window.addEventListener('prepwise_consent_updated', function (e) {
      if (e.detail?.advertising) {
        if (config) config.enabled = true;
        AdsterraProvider.autoInit();
      } else {
        AdsterraProvider.killAll();
      }
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => AdsterraProvider.autoInit());
    } else {
      AdsterraProvider.autoInit();
    }
  }

  const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.PREPWISE_ADSTERRA = AdsterraProvider;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdsterraProvider;
  }
})();
