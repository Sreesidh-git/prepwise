/**
 * PrepWise — Verification Test Suite for Adsterra Monetization Repair & GA4 Installation
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('========================================================================');
console.log('PREPWISE FINAL MONETIZATION REPAIR & GA4 TEST SUITE');
console.log('========================================================================\n');

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
  }
}

// 1. Verify GA4 Tag in all HTML files
const htmlFiles = [
  'index.html',
  'company.html',
  'quiz.html',
  'about.html',
  'contact.html',
  'disclaimer.html',
  'privacy.html',
  'terms.html',
  '404.html'
];

htmlFiles.forEach(file => {
  test(`GA4 Tag and Consent Mode v2 present in ${file}`, () => {
    const content = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert(content.includes('G-K6P94Q968B'), `Missing Measurement ID in ${file}`);
    assert(content.includes("gtag('consent', 'default'"), `Missing default consent in ${file}`);
    assert(content.includes("'analytics_storage': 'denied'"), `Missing analytics_storage denied in ${file}`);
    assert(content.includes("'ad_storage': 'denied'"), `Missing ad_storage denied in ${file}`);
  });
});

// 2. Verify ad-frame.html exists and is properly structured
test('ad-frame.html exists with whitelist and synchronous document.write', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'ad-frame.html'), 'utf8');
  assert(content.includes('f2c5fa5caeb276be7a6a9192acffab05'), 'Missing 728x90 key');
  assert(content.includes('0d9f54e21d55ad258d1ac8ff5a73433b'), 'Missing 300x250 key');
  assert(content.includes('fadaa658a1da452b0f5bed520cfc9a09'), 'Missing 320x50 key');
  assert(content.includes('document.write'), 'Must use document.write for synchronous script registration');
  assert(content.includes('https://bauval.org/22/'), 'Must use bauval.org ad delivery domain');
});

// 3. Verify _headers has frame-ancestors 'self' and whitelisted domains
test('_headers has frame-ancestors self and whitelisted domains', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', '_headers'), 'utf8');
  assert(content.includes("frame-ancestors 'self'"), "Must allow self frame-ancestors");
  assert(content.includes('https://www.googletagmanager.com'), 'Must allow googletagmanager.com in script-src');
  assert(content.includes('https://*.google-analytics.com'), 'Must allow google-analytics.com in connect-src');
  assert(content.includes('https://*.nresystems.com'), 'Must allow nresystems.com in CSP');
});

// 4. Verify public-config.js and functions/api/config.js have G-K6P94Q968B
test('Runtime configs contain G-K6P94Q968B', () => {
  const publicCfg = fs.readFileSync(path.join(__dirname, '..', 'js', 'public-config.js'), 'utf8');
  assert(publicCfg.includes('G-K6P94Q968B'), 'public-config.js must contain G-K6P94Q968B');

  const apiCfg = fs.readFileSync(path.join(__dirname, '..', 'functions', 'api', 'config.js'), 'utf8');
  assert(apiCfg.includes('G-K6P94Q968B'), 'functions/api/config.js must have G-K6P94Q968B fallback');
});

// 5. Verify ad-registry.js has active banner placements
test('ad-registry.js marks authorized display placements as enabled', () => {
  const registry = fs.readFileSync(path.join(__dirname, '..', 'js', 'ad-registry.js'), 'utf8');
  assert(registry.includes("id: 'ad-homepage-leaderboard'") && registry.includes("status: 'active'"), 'Leaderboard must be active');
  assert(registry.includes("id: 'ad-sticky-bottom-mobile'") && registry.includes("enabled: true"), 'Sticky mobile must be enabled');
  assert(registry.includes("id: 'ad-company-roles-inline'") && registry.includes("status: 'active'"), 'Company roles must be active');
  assert(registry.includes("id: 'ad-quiz-before-results'") && registry.includes("status: 'disabled'"), 'Pre-results must remain disabled');
});

// 6. Verify adsterra-provider.js uses ad-frame.html for banners
test('adsterra-provider.js references ad-frame.html for banner isolation', () => {
  const provider = fs.readFileSync(path.join(__dirname, '..', 'js', 'adsterra-provider.js'), 'utf8');
  assert(provider.includes('ad-frame.html?key='), 'Must load banner units through ad-frame.html');
  assert(provider.includes('AdsterraProvider.initSocialBar'), 'Must safely reference AdsterraProvider methods');
  assert(provider.includes('AdsterraProvider.initPopunder'), 'Must safely reference Popunder method');
});

// 7. Verify consent.js updates Google Consent Mode
test('consent.js includes updateGoogleConsentMode function', () => {
  const consent = fs.readFileSync(path.join(__dirname, '..', 'js', 'consent.js'), 'utf8');
  assert(consent.includes('updateGoogleConsentMode'), 'Must define updateGoogleConsentMode');
  assert(consent.includes("'analytics_storage': prefs.analytics ? 'granted' : 'denied'"), 'Must update analytics_storage');
  assert(consent.includes("'ad_storage': prefs.advertising ? 'granted' : 'denied'"), 'Must update ad_storage');
});

// 8. Verify mobile filter collapse protection in index.html
test('index.html contains mobile filter collapse protection', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert(index.includes('#mobileFilterPanel:not(.is-open) { display: none !important; }'), 'Must protect mobile filter collapse');
  assert(index.includes('class="mobile-filter-btn" id="mobileFilterToggle"'), 'Must have mobile filter toggle button');
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.\n`);
if (passedTests === totalTests) {
  console.log('✓ ALL REPAIRS & VERIFICATIONS PASSED SUCCESSFULLY!');
  process.exit(0);
} else {
  console.error('✗ SOME CHECKS FAILED!');
  process.exit(1);
}
