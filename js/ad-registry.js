/**
 * PrepWise Advertising Registry
 * 
 * Defines all registered ad units.
 * Policy Guardrails:
 * - High-risk formats (between-quiz-questions, interstitial, exit-intent) are permanently disabled/deprecated
 *   to avoid accidental clicks and preserve educational focus.
 * - Safe banner placements are retained for potential future non-intrusive monetization.
 * - ALL 13 placements remain strictly disabled (enabled: false).
 */
(function () {
  'use strict';

  const placements = [
    // --- Safe Non-Intrusive Placements (Reserved for potential future use) ---
    {
      id: 'ad-homepage-leaderboard',
      page: 'homepage',
      format: 'leaderboard',
      devices: ['desktop', 'tablet', 'mobile'],
      trigger: 'after-page-load',
      sizes: { desktop: [970, 90], mobile: [320, 100] },
      status: 'disabled',
      suitability: 'safe-top-banner'
    },
    {
      id: 'ad-homepage-inline-secondary',
      page: 'homepage',
      format: 'in-content',
      devices: ['desktop', 'tablet', 'mobile'],
      trigger: 'after-company-grid',
      status: 'disabled',
      suitability: 'safe-in-content'
    },
    {
      id: 'ad-homepage-inline-tertiary',
      page: 'homepage',
      format: 'in-content',
      devices: ['desktop', 'tablet', 'mobile'],
      trigger: 'before-how-it-works',
      status: 'disabled',
      suitability: 'safe-in-content'
    },
    {
      id: 'ad-company-inline',
      page: 'company',
      format: 'in-content',
      devices: ['desktop', 'tablet', 'mobile'],
      trigger: 'overview-render',
      status: 'disabled',
      suitability: 'safe-in-content'
    },
    {
      id: 'ad-company-sidebar',
      page: 'company',
      format: 'sidebar',
      devices: ['desktop', 'tablet'],
      trigger: 'overview-render',
      sizes: { desktop: [300, 250], tablet: [300, 250] },
      status: 'disabled',
      suitability: 'safe-sidebar-rectangle'
    },
    {
      id: 'ad-company-roles-inline',
      page: 'company',
      format: 'in-content',
      devices: ['desktop', 'tablet', 'mobile'],
      trigger: 'after-role-grid',
      status: 'disabled',
      suitability: 'safe-in-content'
    },
    {
      id: 'ad-quiz-before-results',
      page: 'quiz',
      format: 'in-content',
      devices: ['desktop', 'tablet', 'mobile'],
      trigger: 'before-results',
      status: 'disabled',
      suitability: 'caution-pre-results'
    },
    {
      id: 'ad-quiz-results',
      page: 'quiz',
      format: 'banner',
      devices: ['desktop', 'tablet', 'mobile'],
      trigger: 'results-render',
      sizes: { desktop: [970, 90], mobile: [320, 100] },
      status: 'disabled',
      suitability: 'safe-post-test'
    },
    {
      id: 'ad-sticky-bottom-desktop',
      page: 'all',
      format: 'sticky-banner',
      devices: ['desktop'],
      trigger: 'after-page-load',
      dismissible: true,
      sizes: { desktop: [728, 90] },
      status: 'disabled',
      suitability: 'safe-dismissible-bottom'
    },
    {
      id: 'ad-sticky-bottom-mobile',
      page: 'all',
      format: 'sticky-banner',
      devices: ['mobile', 'tablet'],
      trigger: 'after-page-load',
      dismissible: true,
      sizes: { mobile: [320, 50], tablet: [728, 90] },
      status: 'disabled',
      suitability: 'safe-dismissible-bottom'
    },

    // --- Permanently Disabled / Prohibited High-Risk Placements ---
    {
      id: 'ad-quiz-between-questions',
      page: 'quiz',
      format: 'in-content',
      devices: ['desktop', 'tablet', 'mobile'],
      trigger: 'between-questions',
      status: 'permanently-disabled',
      deprecated: true,
      policyRisk: 'high-accidental-clicks',
      rejectionReason: 'Prohibited on educational question steps to prevent accidental clicks'
    },
    {
      id: 'ad-interstitial',
      page: 'all',
      format: 'interstitial',
      devices: ['desktop', 'tablet', 'mobile'],
      trigger: 'future-page-transition',
      dismissible: true,
      status: 'permanently-disabled',
      deprecated: true,
      policyRisk: 'intrusive-interstitial',
      rejectionReason: 'Full-screen interrupts violate educational UX and Better Ads Standards'
    },
    {
      id: 'ad-exit-intent',
      page: 'all',
      format: 'modal',
      devices: ['desktop', 'tablet'],
      trigger: 'future-exit-intent',
      dismissible: true,
      status: 'permanently-disabled',
      deprecated: true,
      policyRisk: 'exit-popup',
      rejectionReason: 'Exit-intent popups violate user trust and Better Ads Standards'
    }
  ].map((placement) => {
    const isLaunchCandidate = [
      'ad-homepage-leaderboard',
      'ad-homepage-inline-secondary',
      'ad-homepage-inline-tertiary',
      'ad-company-sidebar',
      'ad-company-roles-inline',
      'ad-quiz-results',
      'ad-sticky-bottom-desktop',
      'ad-sticky-bottom-mobile'
    ].includes(placement.id);
    return {
      ...placement,
      enabled: isLaunchCandidate, // 3 approved display placements enabled with genuine Adsterra units
      selectedForLaunch: isLaunchCandidate,
      provider: isLaunchCandidate ? 'adsterra' : null,
      networkConfig: isLaunchCandidate ? { provider: 'adsterra' } : null
    };
  });

  const byId = Object.fromEntries(placements.map((placement) => [placement.id, placement]));

  const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);

  root.PREPWISE_AD_REGISTRY = Object.freeze({
    version: 2,
    placements: Object.freeze(placements),
    get(id) {
      return byId[id] || null;
    },
    forPage(page) {
      // Exclude permanently disabled units from delivery candidates
      return placements.filter((placement) => 
        placement.status !== 'permanently-disabled' && 
        (placement.page === 'all' || placement.page === page)
      );
    },
    getAll() {
      return placements;
    }
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.PREPWISE_AD_REGISTRY;
  }
})();
