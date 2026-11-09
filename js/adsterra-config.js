/**
 * PrepWise — Centralized Adsterra Advertising Configuration (3 Active Display Placements)
 * 
 * Sole monetization provider configuration for PrepWise (https://prepwises.online).
 * 
 * POLICY DECISION:
 * - ACTIVE: 3 non-intrusive container display placements (Homepage, Company Profile, Quiz Results).
 * - PERMANENTLY DISABLED: Popunder (Unit 32172757) and Social Bar (Unit 32172758).
 * - ZERO forced redirects, notification ads, popunders, or smartlinks anywhere on the site.
 * - Strictly requires explicit user consent ('advertising' category) via PrepWiseConsent before loading.
 */

(function () {
  'use strict';

  const ADSTERRA_CONFIG = {
    provider: 'adsterra',
    version: '2.1.0',
    websiteDomain: 'prepwises.online',

    // MASTER SWITCH (Active for verified display placements)
    enabled: true,

    // Safety and quality filters configured in Adsterra Dashboard
    filters: {
      excludeAdult: true,
      excludeGambling: true,
      excludeAlertsAndDeceptiveSoftware: true,
      excludeForcedRedirects: true,
      excludeSmartlinks: true,
      excludePopunders: true,
      excludeSocialBar: true
    },

    // Units Catalog & Status
    units: {
      // 1. Popunder — PERMANENTLY DISABLED
      '32172757': {
        unitId: '32172757',
        format: 'popunder',
        name: 'Popunder',
        enabled: false,
        status: 'permanently-disabled',
        reason: 'Disabled per educational UX policy'
      },

      // 2. Social Bar — PERMANENTLY DISABLED
      '32172758': {
        unitId: '32172758',
        format: 'social-bar',
        name: 'Social Bar',
        enabled: false,
        status: 'permanently-disabled',
        reason: 'Disabled per educational UX policy'
      },

      // 3. Native Banner — ACTIVE
      '32172759': {
        unitId: '32172759',
        format: 'native-banner',
        name: 'Native Banner',
        enabled: true,
        scriptSrc: 'https://bauval.org/21/cf54b7a35f5f1b688587f9f9b2590912',
        containerId: 'container-cf54b7a35f5f1b688587f9f9b2590912',
        cfAsync: false,
        async: true,
        rawSnippet: '<script async="async" data-cfasync="false" src="https://bauval.org/21/cf54b7a35f5f1b688587f9f9b2590912"></script><div id="container-cf54b7a35f5f1b688587f9f9b2590912"></div>'
      },

      // 4. Banner 300x250 — ACTIVE
      '32172760': {
        unitId: '32172760',
        format: 'banner-300x250',
        name: 'Banner 300x250',
        width: 300,
        height: 250,
        enabled: true,
        key: '0d9f54e21d55ad258d1ac8ff5a73433b',
        scriptSrc: 'https://bauval.org/22/0d9f54e21d55ad258d1ac8ff5a73433b',
        rawSnippet: "<script>atOptions = {'key':'0d9f54e21d55ad258d1ac8ff5a73433b','format':'iframe','height':250,'width':300,'params':{}};</script><script src=\"https://bauval.org/22/0d9f54e21d55ad258d1ac8ff5a73433b\"></script>"
      },

      // 5. Banner 320x50 — ACTIVE
      '32172761': {
        unitId: '32172761',
        format: 'banner-320x50',
        name: 'Banner 320x50',
        width: 320,
        height: 50,
        enabled: true,
        key: 'fadaa658a1da452b0f5bed520cfc9a09',
        scriptSrc: 'https://bauval.org/22/fadaa658a1da452b0f5bed520cfc9a09',
        rawSnippet: "<script>atOptions = {'key':'fadaa658a1da452b0f5bed520cfc9a09','format':'iframe','height':50,'width':320,'params':{}};</script><script src=\"https://bauval.org/22/fadaa658a1da452b0f5bed520cfc9a09\"></script>"
      },

      // 6. Banner 728x90 — ACTIVE
      '32172762': {
        unitId: '32172762',
        format: 'banner-728x90',
        name: 'Banner 728x90',
        width: 728,
        height: 90,
        enabled: true,
        key: 'f2c5fa5caeb276be7a6a9192acffab05',
        scriptSrc: 'https://bauval.org/22/f2c5fa5caeb276be7a6a9192acffab05',
        rawSnippet: "<script>atOptions = {'key':'f2c5fa5caeb276be7a6a9192acffab05','format':'iframe','height':90,'width':728,'params':{}};</script><script src=\"https://bauval.org/22/f2c5fa5caeb276be7a6a9192acffab05\"></script>"
      }
    },

    // Site Placement Mappings (Exactly 3 Active Display Slots)
    placements: {
      // 1. Homepage: Banner 728x90 on Desktop / Banner 320x50 on Mobile
      'ad-homepage-inline-secondary': {
        slotId: 'ad-homepage-inline-secondary',
        page: 'homepage',
        name: 'Homepage In-Content Break',
        label: 'Sponsored',
        enabled: true,
        desktopUnitId: '32172762', // Banner 728x90
        mobileUnitId: '32172761',  // Banner 320x50
        lazy: true
      },

      // 2. Company Profile: Native Banner on Desktop / 300x250 on Mobile
      'ad-company-roles-inline': {
        slotId: 'ad-company-roles-inline',
        page: 'company',
        name: 'Company Roles Content Break',
        label: 'Sponsored',
        enabled: true,
        desktopUnitId: '32172759', // Native Banner
        mobileUnitId: '32172760',  // Banner 300x250
        lazy: true
      },

      // 3. Quiz Completion Screen: Banner 728x90 on Desktop / 300x250 on Mobile
      'ad-quiz-results': {
        slotId: 'ad-quiz-results',
        page: 'quiz',
        name: 'Quiz Completion Results Banner',
        label: 'Advertisement',
        enabled: true,
        desktopUnitId: '32172762', // Banner 728x90
        mobileUnitId: '32172760',   // Banner 300x250
        fallbackUnitId: '32172760',
        lazy: false
      },

      // Permanently Disabled Placements
      'popunder-global': {
        unitId: '32172757',
        format: 'popunder',
        name: 'Global Popunder',
        enabled: false,
        status: 'permanently-disabled'
      },

      'social-bar-global': {
        unitId: '32172758',
        format: 'social-bar',
        name: 'Global Social Bar',
        enabled: false,
        status: 'permanently-disabled'
      }
    }
  };

  const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.PREPWISE_ADSTERRA_CONFIG = ADSTERRA_CONFIG;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ADSTERRA_CONFIG;
  }
})();
