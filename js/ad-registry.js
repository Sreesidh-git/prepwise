(function () {
  'use strict';

  const placements = [
    { id: 'ad-homepage-leaderboard', page: 'homepage', format: 'leaderboard', devices: ['desktop', 'tablet', 'mobile'], trigger: 'after-page-load', sizes: { desktop: [970, 90], mobile: [320, 100] } },
    { id: 'ad-homepage-inline-secondary', page: 'homepage', format: 'in-content', devices: ['desktop', 'tablet', 'mobile'], trigger: 'after-company-grid' },
    { id: 'ad-homepage-inline-tertiary', page: 'homepage', format: 'in-content', devices: ['desktop', 'tablet', 'mobile'], trigger: 'before-how-it-works' },
    { id: 'ad-company-inline', page: 'company', format: 'in-content', devices: ['desktop', 'tablet', 'mobile'], trigger: 'overview-render' },
    { id: 'ad-company-sidebar', page: 'company', format: 'sidebar', devices: ['desktop', 'tablet'], trigger: 'overview-render', sizes: { desktop: [300, 250], tablet: [300, 250] } },
    { id: 'ad-company-roles-inline', page: 'company', format: 'in-content', devices: ['desktop', 'tablet', 'mobile'], trigger: 'after-role-grid' },
    { id: 'ad-quiz-between-questions', page: 'quiz', format: 'in-content', devices: ['desktop', 'tablet', 'mobile'], trigger: 'between-questions' },
    { id: 'ad-quiz-before-results', page: 'quiz', format: 'in-content', devices: ['desktop', 'tablet', 'mobile'], trigger: 'before-results' },
    { id: 'ad-quiz-results', page: 'quiz', format: 'banner', devices: ['desktop', 'tablet', 'mobile'], trigger: 'results-render', sizes: { desktop: [970, 90], mobile: [320, 100] } },
    { id: 'ad-sticky-bottom-desktop', page: 'all', format: 'sticky-banner', devices: ['desktop'], trigger: 'after-page-load', dismissible: true, sizes: { desktop: [728, 90] } },
    { id: 'ad-sticky-bottom-mobile', page: 'all', format: 'sticky-banner', devices: ['mobile', 'tablet'], trigger: 'after-page-load', dismissible: true, sizes: { mobile: [320, 50], tablet: [728, 90] } },
    { id: 'ad-interstitial', page: 'all', format: 'interstitial', devices: ['desktop', 'tablet', 'mobile'], trigger: 'future-page-transition', dismissible: true },
    { id: 'ad-exit-intent', page: 'all', format: 'modal', devices: ['desktop', 'tablet'], trigger: 'future-exit-intent', dismissible: true }
  ].map((placement) => ({
    ...placement,
    enabled: false,
    provider: null,
    networkConfig: null
  }));

  const byId = Object.fromEntries(placements.map((placement) => [placement.id, placement]));

  const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);

  root.PREPWISE_AD_REGISTRY = Object.freeze({
    version: 1,
    placements: Object.freeze(placements),
    get(id) {
      return byId[id] || null;
    },
    forPage(page) {
      return placements.filter((placement) => placement.page === 'all' || placement.page === page);
    }
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.PREPWISE_AD_REGISTRY;
  }
})();
