/**
 * PrepWise — Centralized Adsterra Advertising Configuration
 * 
 * Sole monetization provider configuration for PrepWise (https://prepwises.online).
 * 
 * SAFETY INVARIANTS:
 * 1. Global master switch `enabled` is FALSE until genuine publisher account and codes are verified.
 * 2. NO fake publisher IDs, mock keys, or simulated script sources are allowed.
 * 3. Only 3 initial safe placements are selected for launch:
 *    - Homepage: ad-homepage-inline-secondary (banner after company grid)
 *    - Company Profile: ad-company-roles-inline (native/banner between syllabus and roles)
 *    - Quiz Results: ad-quiz-results (banner strictly below results and explanations)
 * 4. High-risk placements (interstitials, popunders, smartlinks, in-quiz questions) are PROHIBITED.
 * 5. Requires explicit user consent ('advertising' category) via PrepWiseConsent before loading.
 */

(function () {
  'use strict';

  const ADSTERRA_CONFIG = {
    provider: 'adsterra',
    version: '1.0.0',
    websiteDomain: 'prepwises.online',

    // MASTER KILL-SWITCH
    // Set to true only when domain is approved in Adsterra and genuine codes are installed.
    enabled: false,

    // Publisher details (supplied by account owner)
    publisherId: null,

    // Safety and quality filters (configured in Adsterra dashboard)
    filters: {
      excludeAdult: true,
      excludeGambling: true,
      excludeAlertsAndDeceptiveSoftware: true,
      excludeForcedRedirects: true,
      excludePopunders: true,
      excludeSmartlinks: true
    },

    // Individual placement configurations
    placements: {
      // --- LAUNCH CANDIDATE 1: Homepage Inline Secondary ---
      'ad-homepage-inline-secondary': {
        name: 'Homepage In-Content Banner',
        page: 'homepage',
        selectedForLaunch: true,
        enabled: false, // Activated when genuine Adsterra code is supplied
        type: 'banner', // 728x90 desktop / 320x50 mobile
        targetElementId: 'ad-homepage-inline-secondary',
        label: 'Sponsored',
        sizes: {
          desktop: [728, 90],
          tablet: [728, 90],
          mobile: [320, 50]
        },
        lazy: true,
        // Genuine Adsterra parameters to be populated from dashboard:
        adsterraKey: null,
        scriptSrc: null
      },

      // --- LAUNCH CANDIDATE 2: Company Profile Roles Inline ---
      'ad-company-roles-inline': {
        name: 'Company Roles In-Content Banner / Native',
        page: 'company',
        selectedForLaunch: true,
        enabled: false, // Activated when genuine Adsterra code is supplied
        type: 'native', // Native banner / 4:1 banner / 300x250
        targetElementId: 'ad-company-roles-inline',
        label: 'Sponsored',
        sizes: {
          desktop: [728, 90],
          tablet: [728, 90],
          mobile: [300, 250]
        },
        lazy: true,
        // Genuine Adsterra parameters to be populated from dashboard:
        adsterraKey: null,
        scriptSrc: null
      },

      // --- LAUNCH CANDIDATE 3: Quiz Completion Results ---
      'ad-quiz-results': {
        name: 'Quiz Completion Results Banner',
        page: 'quiz',
        selectedForLaunch: true,
        enabled: false, // Activated when genuine Adsterra code is supplied
        type: 'banner', // 728x90 desktop / 300x250 mobile
        targetElementId: 'ad-quiz-results',
        label: 'Advertisement',
        sizes: {
          desktop: [728, 90],
          tablet: [728, 90],
          mobile: [300, 250]
        },
        lazy: false, // Renders immediately when results screen opens
        // Genuine Adsterra parameters to be populated from dashboard:
        adsterraKey: null,
        scriptSrc: null
      },

      // --- REMAINING PLACEMENTS: STRICTLY DISABLED ---
      'ad-homepage-leaderboard': {
        name: 'Homepage Leaderboard',
        page: 'homepage',
        selectedForLaunch: false,
        enabled: false,
        reason: 'Reserved; initial launch limited to 1 banner per page'
      },
      'ad-homepage-inline-tertiary': {
        name: 'Homepage Tertiary Banner',
        page: 'homepage',
        selectedForLaunch: false,
        enabled: false,
        reason: 'Reserved'
      },
      'ad-company-inline': {
        name: 'Company Overview Inline',
        page: 'company',
        selectedForLaunch: false,
        enabled: false,
        reason: 'Reserved; roles placement prioritized'
      },
      'ad-company-sidebar': {
        name: 'Company Sidebar',
        page: 'company',
        selectedForLaunch: false,
        enabled: false,
        reason: 'Reserved'
      },
      'ad-quiz-before-results': {
        name: 'Quiz Pre-Results Slot',
        page: 'quiz',
        selectedForLaunch: false,
        enabled: false,
        reason: 'Must not obstruct test submission'
      },
      'ad-sticky-bottom-desktop': {
        name: 'Desktop Bottom Anchor',
        page: 'all',
        selectedForLaunch: false,
        enabled: false,
        reason: 'Reserved; evaluate user experience before introducing sticky units'
      },
      'ad-sticky-bottom-mobile': {
        name: 'Mobile Bottom Anchor',
        page: 'all',
        selectedForLaunch: false,
        enabled: false,
        reason: 'Reserved; evaluate screen estate before introducing sticky units'
      },

      // --- PROHIBITED PLACEMENTS: PERMANENTLY DISABLED ---
      'ad-quiz-between-questions': {
        name: 'Active Quiz Inter-Question Slot',
        page: 'quiz',
        selectedForLaunch: false,
        enabled: false,
        prohibited: true,
        reason: 'PROHIBITED: Never display ads between questions or near answer choices'
      },
      'ad-interstitial': {
        name: 'Full Screen Interstitial',
        page: 'all',
        selectedForLaunch: false,
        enabled: false,
        prohibited: true,
        reason: 'PROHIBITED: No intrusive full-page overlays on educational site'
      },
      'ad-exit-intent': {
        name: 'Exit Intent Modal',
        page: 'all',
        selectedForLaunch: false,
        enabled: false,
        prohibited: true,
        reason: 'PROHIBITED: No exit-intent popups'
      }
    }
  };

  const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.PREPWISE_ADSTERRA_CONFIG = Object.freeze(ADSTERRA_CONFIG);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ADSTERRA_CONFIG;
  }
})();

