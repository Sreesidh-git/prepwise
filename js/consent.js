/**
 * PrepWise Consent & Privacy Preferences Module (js/consent.js)
 * 
 * Provides first-party cookie/storage preference management:
 * - Strictly Necessary (always active)
 * - Two-tier advertising choice:
 *     1. "Show All Ads" (Tier: 'all') -> Authorizes standard Adsterra display banners and minimal analytics.
 *     2. "Show Essential Ads" (Tier: 'essential') -> Rejects third-party tracking cookies; no consent-dependent ad requests are sent.
 * - Persistent "Cookie Settings" link in the footer to modify or withdraw consent at any time.
 * - Zero dark patterns: clear equal choices, no preselected optional tracking.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'prepwise_consent_preferences';
  const VERSION = 1;

  function safeStorage() {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  function getPreferences() {
    const store = safeStorage();
    if (!store) return null;
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === VERSION && typeof parsed.necessary === 'boolean') {
        return parsed;
      }
    } catch {
      // JSON parse error or corrupted storage
    }
    return null;
  }

  function savePreferences(prefs) {
    const store = safeStorage();
    const finalPrefs = {
      necessary: true,
      analytics: Boolean(prefs.analytics),
      advertising: Boolean(prefs.advertising),
      tier: prefs.tier || (prefs.advertising ? 'all' : 'essential'),
      timestamp: new Date().toISOString(),
      version: VERSION
    };
    if (store) {
      try {
        store.setItem(STORAGE_KEY, JSON.stringify(finalPrefs));
      } catch (err) {
        console.warn('[PrepWise Consent] Failed to save preferences', err);
      }
    }
    dispatchUpdate(finalPrefs);
    return finalPrefs;
  }

  function dispatchUpdate(prefs) {
    const event = new CustomEvent('prepwise_consent_updated', {
      detail: prefs
    });
    window.dispatchEvent(event);
  }

  function hasConsent(category) {
    if (category === 'necessary') return true;
    const prefs = getPreferences();
    if (!prefs) return false;
    return Boolean(prefs[category]);
  }

  // --- UI Construction ---

  function createBanner() {
    if (document.getElementById('prepwise-consent-banner')) return;

    const banner = document.createElement('aside');
    banner.id = 'prepwise-consent-banner';
    banner.className = 'prepwise-consent-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Privacy and Advertising Choices');
    banner.innerHTML = `
      <div class="prepwise-consent-content">
        <div class="prepwise-consent-text">
          <p class="prepwise-consent-title"><strong>Privacy &amp; Advertising Choices</strong></p>
          <p class="prepwise-consent-desc">
            We use cookies and partner with Adsterra to keep PrepWise free for students. Choose your preferred advertising experience:
          </p>
        </div>
        <div class="prepwise-consent-actions">
          <button type="button" class="btn-consent btn-consent-essential" id="btnConsentEssential">Show Essential Ads</button>
          <button type="button" class="btn-consent btn-consent-all btn-consent-accept" id="btnConsentAll">Show All Ads</button>
          <button type="button" class="btn-consent-link" id="btnConsentSettings">Cookie Settings</button>
        </div>
      </div>
    `;
    document.body.appendChild(banner);

    const acceptBtn = banner.querySelector('#btnConsentAll') || banner.querySelector('#btnConsentAccept');
    const essentialBtn = banner.querySelector('#btnConsentEssential') || banner.querySelector('#btnConsentReject');
    const settingsBtn = banner.querySelector('#btnConsentSettings') || banner.querySelector('#btnConsentManage');

    if (acceptBtn) {
      acceptBtn.addEventListener('click', () => {
        savePreferences({ analytics: true, advertising: true, tier: 'all' });
        hideBanner();
      });
    }

    if (essentialBtn) {
      essentialBtn.addEventListener('click', () => {
        savePreferences({ analytics: false, advertising: false, tier: 'essential' });
        hideBanner();
      });
    }

    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        openModal();
      });
    }
  }

  function hideBanner() {
    const banner = document.getElementById('prepwise-consent-banner');
    if (banner) banner.remove();
  }

  function createModal() {
    if (document.getElementById('prepwise-consent-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'prepwise-consent-modal';
    modal.className = 'prepwise-consent-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'consentModalTitle');
    modal.hidden = true;

    modal.innerHTML = `
      <div class="prepwise-consent-backdrop" id="consentModalBackdrop"></div>
      <div class="prepwise-consent-dialog" tabIndex="-1">
        <div class="prepwise-consent-header">
          <h2 id="consentModalTitle">Cookie &amp; Advertising Settings</h2>
          <button type="button" class="prepwise-consent-close" id="btnConsentClose" aria-label="Close preferences dialog">&times;</button>
        </div>
        <div class="prepwise-consent-body">
          <p class="prepwise-consent-intro">
            PrepWise is built with data minimization in mind. You can update your advertising preferences or withdraw consent below at any time.
          </p>

          <div class="consent-category">
            <div class="consent-category-header">
              <div>
                <strong>Strictly Necessary Storage</strong>
                <span class="consent-badge">Always Active</span>
              </div>
              <input type="checkbox" checked disabled aria-label="Strictly necessary storage always enabled">
            </div>
            <p class="consent-category-desc">
              Required for basic website navigation, security tokens, in-progress quiz question tracking, and remembering your privacy choices. Cannot be turned off.
            </p>
          </div>

          <div class="consent-category">
            <div class="consent-category-header">
              <label for="toggleAdvertising">
                <strong>Advertising &amp; Monetization (Adsterra)</strong>
                <span class="consent-badge">Optional</span>
              </label>
              <input type="checkbox" id="toggleAdvertising" class="consent-toggle">
            </div>
            <p class="consent-category-desc">
              Authorizes standard non-intrusive display banners and native widgets from partner Adsterra in three designated content breaks. If disabled, third-party advertising tracking is blocked. Zero popunders, floating bars, or in-quiz ads run on this site.
            </p>
          </div>

          <div class="consent-category">
            <div class="consent-category-header">
              <label for="toggleAnalytics">
                <strong>Analytics &amp; Performance Telemetry</strong>
              </label>
              <input type="checkbox" id="toggleAnalytics" class="consent-toggle">
            </div>
            <p class="consent-category-desc">
              Allows anonymous first-party telemetry (page view counts, quiz completion rates, and company syllabus interest) to help us improve question sets. No personal profiles are built.
            </p>
          </div>
        </div>

        <div class="prepwise-consent-footer">
          <button type="button" class="btn-consent btn-consent-essential" id="btnModalEssential">Show Essential Ads</button>
          <button type="button" class="btn-consent btn-consent-save" id="btnModalSave">Save Settings</button>
          <button type="button" class="btn-consent btn-consent-all btn-consent-accept" id="btnModalAcceptAll">Show All Ads</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const backdrop = modal.querySelector('#consentModalBackdrop') || document.getElementById('consentModalBackdrop');
    const closeBtn = modal.querySelector('#btnConsentClose') || document.getElementById('btnConsentClose');
    const saveBtn = modal.querySelector('#btnModalSave') || document.getElementById('btnModalSave');
    const acceptAllBtn = modal.querySelector('#btnModalAcceptAll') || document.getElementById('btnModalAcceptAll');
    const essentialBtn = modal.querySelector('#btnModalEssential') || modal.querySelector('#btnModalRejectAll') || document.getElementById('btnModalEssential');

    if (backdrop) backdrop.addEventListener('click', closeModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    if (acceptAllBtn) {
      acceptAllBtn.addEventListener('click', () => {
        savePreferences({ analytics: true, advertising: true, tier: 'all' });
        closeModal();
        hideBanner();
      });
    }

    if (essentialBtn) {
      essentialBtn.addEventListener('click', () => {
        savePreferences({ analytics: false, advertising: false, tier: 'essential' });
        closeModal();
        hideBanner();
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const toggleAn = modal.querySelector('#toggleAnalytics') || document.getElementById('toggleAnalytics');
        const toggleAd = modal.querySelector('#toggleAdvertising') || document.getElementById('toggleAdvertising');
        const analyticsChecked = toggleAn ? toggleAn.checked : false;
        const advertisingChecked = toggleAd ? toggleAd.checked : false;
        savePreferences({
          analytics: analyticsChecked,
          advertising: advertisingChecked,
          tier: advertisingChecked ? 'all' : 'essential'
        });
        closeModal();
        hideBanner();
      });
    }

    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    });
  }

  let previousActiveElement = null;

  function openModal() {
    createModal();
    const modal = document.getElementById('prepwise-consent-modal');
    if (!modal) return;

    previousActiveElement = document.activeElement;
    const prefs = getPreferences() || { analytics: false, advertising: false };
    document.getElementById('toggleAnalytics').checked = Boolean(prefs.analytics);
    document.getElementById('toggleAdvertising').checked = Boolean(prefs.advertising);

    modal.hidden = false;
    document.body.classList.add('prepwise-modal-open');

    const dialog = modal.querySelector('.prepwise-consent-dialog');
    if (dialog) dialog.focus();
  }

  function closeModal() {
    const modal = document.getElementById('prepwise-consent-modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('prepwise-modal-open');
    if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
      previousActiveElement.focus();
    }
  }

  function init() {
    const existingPrefs = getPreferences();
    if (!existingPrefs) {
      createBanner();
    }

    // Bind all footer/navigation triggers for Cookie Settings
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('#openConsentPreferences, #openConsentSettings, .open-consent-preferences, [data-consent-preferences], a[href="#cookie-settings"], a[href="#privacy-choices"]');
      if (trigger) {
        e.preventDefault();
        openModal();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose global interface
  window.PrepWiseConsent = {
    getPreferences,
    hasConsent,
    setPreferences: savePreferences,
    openPreferences: openModal,
    closePreferences: closeModal,
    acceptAll() {
      return savePreferences({ analytics: true, advertising: true, tier: 'all' });
    },
    rejectOptional() {
      return savePreferences({ analytics: false, advertising: false, tier: 'essential' });
    }
  };
})();
