/**
 * Test Suite: PrepWise Advertising Readiness Phase 2
 * Tests:
 * 1. Admin analytics exclusion
 * 2. Developer / test analytics exclusion
 * 3. Normal visitor analytics with consent
 * 4. Consent lifecycle: accept all, reject optional, manage, persist
 * 5. Optional scripts blocked before consent
 * 6. Core site functionality without consent
 * 7. Ad placement safety (all 13 disabled, high-risk permanently disabled)
 * 8. Mobile consent interface & accessibility
 * 9. SEO & Canonical URL readiness
 */
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

// Minimal mock DOM environment for unit testing vanilla JS modules
class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

function setupMockEnv(pathname = '/', search = '') {
  const localStorage = new MockStorage();
  const sessionStorage = new MockStorage();
  const listeners = {};

  const mockWindow = {
    location: {
      pathname,
      search,
      origin: 'https://prepwise-7ij.pages.dev'
    },
    localStorage,
    sessionStorage,
    crypto: {
      randomUUID: () => '12345678-1234-4234-8234-123456789abc'
    },
    innerWidth: 1024,
    addEventListener: (event, handler) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    },
    dispatchEvent: (event) => {
      const handlers = listeners[event.type] || [];
      handlers.forEach(h => h(event));
    },
    CustomEvent: class CustomEvent {
      constructor(type, params = {}) {
        this.type = type;
        this.detail = params.detail;
      }
    }
  };

  const mockDocument = {
    title: 'PrepWise Test',
    referrer: '',
    readyState: 'complete',
    body: {
      appendChild: () => {},
      classList: {
        add: () => {},
        remove: () => {}
      }
    },
    head: {
      appendChild: () => {}
    },
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      setAttribute: () => {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {} },
      style: {},
      dataset: {},
      addEventListener: () => {},
      querySelector: () => null,
      querySelectorAll: () => []
    }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (event, handler) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    }
  };

  return { mockWindow, mockDocument, listeners };
}

async function runTests() {
  console.log('\n============================================================');
  console.log('PREPWISE ADVERTISING READINESS PHASE 2 AUDIT');
  console.log('============================================================\n');

  // --- 1. AD PLACEMENT SAFETY ---
  console.log('--- 1. AD PLACEMENT SAFETY & INVARIANTS ---');
  const adRegistryContent = fs.readFileSync('js/ad-registry.js', 'utf8');
  assert(adRegistryContent.includes('enabled: false'), 'Ad registry sets enabled: false on all placements');

  // Evaluate ad-registry in Node environment
  const registryModule = {};
  const evalRegistry = new Function('window', 'module', adRegistryContent);
  const mockWinAds = { PREPWISE_CONFIG: {} };
  evalRegistry(mockWinAds, registryModule);
  const registry = mockWinAds.PREPWISE_AD_REGISTRY;

  assert(registry && registry.placements.length === 13, `Registry contains exactly 13 ad placements (found ${registry?.placements?.length})`);
  const allDisabled = registry.placements.every(p => p.enabled === false);
  assert(allDisabled, 'Every single registered placement is strictly disabled (enabled: false)');

  const betweenQuiz = registry.get('ad-quiz-between-questions');
  assert(betweenQuiz && betweenQuiz.status === 'permanently-disabled' && betweenQuiz.deprecated === true,
    'ad-quiz-between-questions is permanently disabled and marked deprecated');

  const interstitial = registry.get('ad-interstitial');
  assert(interstitial && interstitial.status === 'permanently-disabled',
    'ad-interstitial is permanently disabled');

  const exitIntent = registry.get('ad-exit-intent');
  assert(exitIntent && exitIntent.status === 'permanently-disabled',
    'ad-exit-intent is permanently disabled');

  // Check forPage filter excludes permanently disabled
  const quizCandidates = registry.forPage('quiz');
  assert(!quizCandidates.some(p => p.id === 'ad-quiz-between-questions'),
    'forPage("quiz") excludes permanently disabled between-questions ad');

  // --- 2. CSS SAFETY GUARDRAILS ---
  console.log('\n--- 2. CSS SAFETY GUARDRAILS ---');
  const styleCss = fs.readFileSync('css/style.css', 'utf8');
  assert(styleCss.includes('.quiz-container') && styleCss.includes('z-index: 10'),
    'css/style.css establishes z-index priority for quiz interactive controls');
  assert(styleCss.includes('.ad-slot:not(.is-enabled)') && styleCss.includes('pointer-events: none !important'),
    'css/style.css strictly zeroes out and disables pointer-events for non-enabled ad slots');

  // --- 3. CONSENT MODULE LIFECYCLE ---
  console.log('\n--- 3. CONSENT MODULE LIFECYCLE ---');
  const consentContent = fs.readFileSync('js/consent.js', 'utf8');
  assert(consentContent.includes('prepwise_consent_preferences'), 'Consent module uses prepwise_consent_preferences key');

  // Evaluate consent module with mock environment
  const { mockWindow: winC, mockDocument: docC } = setupMockEnv();
  const evalConsent = new Function('window', 'document', consentContent);
  evalConsent(winC, docC);

  const consentApi = winC.PrepWiseConsent;
  assert(typeof consentApi === 'object', 'PrepWiseConsent is exposed on window');
  assert(consentApi.getPreferences() === null, 'First visit returns null preferences (unprompted)');
  assert(consentApi.hasConsent('necessary') === true, 'Strictly necessary storage is always true');
  assert(consentApi.hasConsent('analytics') === false, 'Optional analytics is false before user consent');
  assert(consentApi.hasConsent('advertising') === false, 'Optional advertising is false before user consent');

  // Test acceptAll
  const accepted = consentApi.acceptAll();
  assert(accepted.analytics === true && accepted.advertising === true && accepted.necessary === true,
    'acceptAll() grants analytics and advertising');
  assert(consentApi.hasConsent('analytics') === true, 'hasConsent("analytics") returns true after acceptAll()');
  assert(winC.localStorage.getItem('prepwise_consent_preferences') !== null, 'Preferences persisted to localStorage');

  // Test rejectOptional
  const rejected = consentApi.rejectOptional();
  assert(rejected.analytics === false && rejected.advertising === false && rejected.necessary === true,
    'rejectOptional() disables analytics and advertising while keeping necessary true');
  assert(consentApi.hasConsent('analytics') === false, 'hasConsent("analytics") returns false after rejectOptional()');

  // Test custom setPreferences
  consentApi.setPreferences({ analytics: true, advertising: false });
  assert(consentApi.hasConsent('analytics') === true && consentApi.hasConsent('advertising') === false,
    'setPreferences() allows granular control (analytics: true, advertising: false)');

  // --- 4. ANALYTICS EXCLUSION FOR ADMINS & DEVELOPERS ---
  console.log('\n--- 4. ANALYTICS EXCLUSION FOR ADMINS & DEVELOPERS ---');
  const analyticsContent = fs.readFileSync('js/analytics.js', 'utf8');

  // Test 4A: Normal visitor without consent -> tracking blocked
  const { mockWindow: winA1, mockDocument: docA1 } = setupMockEnv('/company', '?id=google');
  winA1.PrepWiseConsent = { hasConsent: () => false };
  new Function('window', 'document', analyticsContent)(winA1, docA1);
  const status1 = winA1.prepwiseAnalyticsStatus();
  assert(status1.excluded === true && status1.reason === 'consent-not-granted',
    'Unconsented visitor has tracking blocked with reason "consent-not-granted"');

  // Test 4B: Consented normal visitor -> tracking enabled
  const { mockWindow: winA2, mockDocument: docA2 } = setupMockEnv('/company', '?id=google');
  winA2.PrepWiseConsent = { hasConsent: () => true };
  new Function('window', 'document', analyticsContent)(winA2, docA2);
  const status2 = winA2.prepwiseAnalyticsStatus();
  assert(status2.excluded === false && status2.trackingEnabled === true,
    'Consented normal visitor has tracking enabled');

  // Test 4C: Admin session detected in localStorage -> tracking strictly excluded
  const { mockWindow: winA3, mockDocument: docA3 } = setupMockEnv('/', '');
  winA3.localStorage.setItem('prepwise_admin_session', JSON.stringify({ access_token: 'fake-jwt', user: { email: 'admin@test.com' } }));
  winA3.PrepWiseConsent = { hasConsent: () => true }; // Even if consent was previously clicked
  new Function('window', 'document', analyticsContent)(winA3, docA3);
  const status3 = winA3.prepwiseAnalyticsStatus();
  assert(status3.excluded === true && status3.reason === 'admin-session',
    'Authenticated admin is excluded from traffic analytics with reason "admin-session"');

  // Test 4D: Admin path (/admin/*) -> tracking strictly excluded
  const { mockWindow: winA4, mockDocument: docA4 } = setupMockEnv('/admin/index.html', '');
  winA4.PrepWiseConsent = { hasConsent: () => true };
  new Function('window', 'document', analyticsContent)(winA4, docA4);
  const status4 = winA4.prepwiseAnalyticsStatus();
  assert(status4.excluded === true && status4.reason === 'admin-session',
    'Admin path /admin/* is excluded from traffic analytics with reason "admin-session"');

  // Test 4E: Developer opt-out query param (?prepwise_analytics=disable)
  const { mockWindow: winA5, mockDocument: docA5 } = setupMockEnv('/', '?prepwise_analytics=disable');
  winA5.PrepWiseConsent = { hasConsent: () => true };
  new Function('window', 'document', analyticsContent)(winA5, docA5);
  const status5 = winA5.prepwiseAnalyticsStatus();
  assert(status5.excluded === true && status5.reason === 'developer-optout',
    'URL ?prepwise_analytics=disable activates developer exclusion');
  assert(winA5.localStorage.getItem('prepwise_analytics_optout') === 'true',
    'Developer exclusion is persisted in localStorage');

  // Test 4F: Developer opt-out persistent across page loads without param
  const { mockWindow: winA6, mockDocument: docA6 } = setupMockEnv('/quiz', '');
  winA6.localStorage.setItem('prepwise_analytics_optout', 'true');
  winA6.PrepWiseConsent = { hasConsent: () => true };
  new Function('window', 'document', analyticsContent)(winA6, docA6);
  const status6 = winA6.prepwiseAnalyticsStatus();
  assert(status6.excluded === true && status6.reason === 'developer-optout',
    'Persisted developer exclusion suppresses analytics on subsequent visits');

  // Test 4G: Developer re-enable (?prepwise_analytics=enable)
  const { mockWindow: winA7, mockDocument: docA7 } = setupMockEnv('/', '?prepwise_analytics=enable');
  winA7.localStorage.setItem('prepwise_analytics_optout', 'true');
  winA7.PrepWiseConsent = { hasConsent: () => true };
  new Function('window', 'document', analyticsContent)(winA7, docA7);
  assert(winA7.localStorage.getItem('prepwise_analytics_optout') === null,
    'URL ?prepwise_analytics=enable clears persisted developer exclusion');

  // --- 5. PRIVACY POLICY AUDIT ---
  console.log('\n--- 5. PRIVACY POLICY AUDIT ---');
  const privacyHtml = fs.readFileSync('privacy.html', 'utf8');
  assert(privacyHtml.includes('prepwise_consent_preferences'), 'privacy.html documents prepwise_consent_preferences');
  assert(privacyHtml.includes('prepwise_anonymous_id'), 'privacy.html documents prepwise_anonymous_id');
  assert(privacyHtml.includes('all 13 advertising placements are currently 100% disabled'), 'privacy.html clearly states ads are 100% disabled');
  assert(privacyHtml.includes('Adsterra') || privacyHtml.includes('Google AdSense'), 'privacy.html discloses planned advertising partner integration');
  assert(privacyHtml.includes('aboutads.info') && (privacyHtml.includes('adsterra.com') || privacyHtml.includes('Google Ads Settings')), 'privacy.html provides required opt-out links');
  assert(privacyHtml.includes('Cookie Preferences'), 'privacy.html mentions the Cookie Preferences preference center');

  // --- 6. SEO & CANONICAL READINESS ACROSS ALL PUBLIC PAGES ---
  console.log('\n--- 6. SEO & CANONICAL READINESS ACROSS ALL PUBLIC PAGES ---');
  const publicPages = ['index.html', 'about.html', 'contact.html', 'privacy.html', 'terms.html', 'disclaimer.html', 'company.html', 'quiz.html'];
  
  publicPages.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    assert(content.includes('rel="canonical"'), `${file} has a canonical link tag`);
    assert(content.includes('href="css/consent.css"'), `${file} includes css/consent.css`);
    assert(content.includes('src="js/consent.js"'), `${file} includes js/consent.js`);
    assert(content.includes('open-consent-preferences') || content.includes('openConsentPreferences'),
      `${file} contains footer Cookie Preferences button`);
  });

  // Verify 404 has noindex
  const page404 = fs.readFileSync('404.html', 'utf8');
  assert(page404.includes('noindex, nofollow'), '404.html includes noindex, nofollow robots tag');

  // Verify future canonical domain in public-config.js
  const publicConfig = fs.readFileSync('js/public-config.js', 'utf8');
  assert(publicConfig.includes('https://prepwises.online'), 'js/public-config.js defines futureCanonicalDomain: https://prepwises.online');
  assert(publicConfig.includes('https://prepwise-7ij.pages.dev'), 'js/public-config.js defines activeProductionDomain: https://prepwise-7ij.pages.dev');

  // --- 7. ACCESSIBILITY & MOBILE RESPONSIVENESS OF CONSENT UI ---
  console.log('\n--- 7. ACCESSIBILITY & MOBILE RESPONSIVENESS OF CONSENT UI ---');
  const consentCss = fs.readFileSync('css/consent.css', 'utf8');
  assert(consentCss.includes('@media (max-width: 640px)'), 'consent.css includes mobile media query');
  assert(consentCss.includes(':focus-visible'), 'consent.css defines focus-visible accessibility outlines');
  assert(consentContent.includes("setAttribute('role', 'region')") && consentContent.includes("setAttribute('role', 'dialog')") && consentContent.includes("setAttribute('aria-modal', 'true')"),
    'consent.js implements ARIA landmarks (role="region", role="dialog", aria-modal="true")');

  console.log('\n============================================================');
  console.log(`PHASE 2 AUDIT SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
