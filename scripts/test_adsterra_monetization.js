/**
 * PrepWise — Adsterra Monetization Architecture & Safety Verification (3 Active Display Placements)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('============================================================');
console.log('PREPWISE ADSTERRA MONETIZATION & POLICY AUDIT (3 DISPLAY PLACEMENTS)');
console.log('============================================================\n');

// --- 1. ADSTERRA CENTRALIZED CONFIGURATION (js/adsterra-config.js) ---
console.log('--- 1. ADSTERRA CENTRALIZED CONFIGURATION ---');
const adsterraConfig = require('../js/adsterra-config.js');

test('adsterra-config.js defines websiteDomain as prepwises.online', () => {
  assert.strictEqual(adsterraConfig.websiteDomain, 'prepwises.online');
});

test('adsterra-config.js master switch is active (enabled: true) for verified display units', () => {
  assert.strictEqual(adsterraConfig.enabled, true);
});

test('adsterra-config.js defines exactly the 6 dashboard unit IDs', () => {
  const expectedUnitIds = ['32172757', '32172758', '32172759', '32172760', '32172761', '32172762'];
  assert(adsterraConfig.units, 'Missing units object in config');
  assert.deepStrictEqual(Object.keys(adsterraConfig.units).sort(), expectedUnitIds.sort());
});

test('Popunder (32172757) and Social Bar (32172758) are permanently disabled', () => {
  const popunder = adsterraConfig.units['32172757'];
  const socialBar = adsterraConfig.units['32172758'];
  assert.strictEqual(popunder.enabled, false);
  assert.strictEqual(popunder.status, 'permanently-disabled');
  assert.strictEqual(socialBar.enabled, false);
  assert.strictEqual(socialBar.status, 'permanently-disabled');
});

test('Unit 32172759 (Native Banner) is enabled with genuine scriptSrc and containerId', () => {
  const u = adsterraConfig.units['32172759'];
  assert.strictEqual(u.enabled, true);
  assert.strictEqual(u.format, 'native-banner');
  assert.strictEqual(u.scriptSrc, 'https://bauval.org/21/cf54b7a35f5f1b688587f9f9b2590912');
  assert.strictEqual(u.containerId, 'container-cf54b7a35f5f1b688587f9f9b2590912');
});

test('Unit 32172760 (Banner 300x250) is enabled with genuine key and dimensions', () => {
  const u = adsterraConfig.units['32172760'];
  assert.strictEqual(u.enabled, true);
  assert.strictEqual(u.format, 'banner-300x250');
  assert.strictEqual(u.key, '0d9f54e21d55ad258d1ac8ff5a73433b');
  assert.strictEqual(u.scriptSrc, 'https://bauval.org/22/0d9f54e21d55ad258d1ac8ff5a73433b');
  assert.strictEqual(u.width, 300);
  assert.strictEqual(u.height, 250);
});

test('Unit 32172761 (Banner 320x50) is enabled with genuine key and dimensions', () => {
  const u = adsterraConfig.units['32172761'];
  assert.strictEqual(u.enabled, true);
  assert.strictEqual(u.format, 'banner-320x50');
  assert.strictEqual(u.key, 'fadaa658a1da452b0f5bed520cfc9a09');
  assert.strictEqual(u.scriptSrc, 'https://bauval.org/22/fadaa658a1da452b0f5bed520cfc9a09');
  assert.strictEqual(u.width, 320);
  assert.strictEqual(u.height, 50);
});

test('Unit 32172762 (Banner 728x90) is enabled with genuine key and dimensions', () => {
  const u = adsterraConfig.units['32172762'];
  assert.strictEqual(u.enabled, true);
  assert.strictEqual(u.format, 'banner-728x90');
  assert.strictEqual(u.key, 'f2c5fa5caeb276be7a6a9192acffab05');
  assert.strictEqual(u.scriptSrc, 'https://bauval.org/22/f2c5fa5caeb276be7a6a9192acffab05');
  assert.strictEqual(u.width, 728);
  assert.strictEqual(u.height, 90);
});

test('adsterra-config.js maps exactly the 3 active display placements', () => {
  const p = adsterraConfig.placements;
  assert.strictEqual(p['ad-homepage-inline-secondary'].enabled, true);
  assert.strictEqual(p['ad-homepage-inline-secondary'].desktopUnitId, '32172762'); // 728x90
  assert.strictEqual(p['ad-homepage-inline-secondary'].mobileUnitId, '32172761');  // 320x50

  assert.strictEqual(p['ad-company-roles-inline'].enabled, true);
  assert.strictEqual(p['ad-company-roles-inline'].desktopUnitId, '32172759');     // Native Banner
  assert.strictEqual(p['ad-company-roles-inline'].mobileUnitId, '32172760');      // 300x250

  assert.strictEqual(p['ad-quiz-results'].enabled, true);
  assert.strictEqual(p['ad-quiz-results'].desktopUnitId, '32172762');             // 728x90
  assert.strictEqual(p['ad-quiz-results'].mobileUnitId, '32172760');              // 300x250

  assert.strictEqual(p['popunder-global'].enabled, false);
  assert.strictEqual(p['social-bar-global'].enabled, false);
});

// --- 2. ADSTERRA PROVIDER ADAPTER (js/adsterra-provider.js) ---
console.log('\n--- 2. ADSTERRA PROVIDER ADAPTER ---');
const providerCode = fs.readFileSync(path.join(__dirname, '../js/adsterra-provider.js'), 'utf8');

test('adsterra-provider.js enforces consent check before loading any script', () => {
  assert(providerCode.includes("hasAdvertisingConsent()"), 'Missing hasAdvertisingConsent check');
  assert(providerCode.includes("Advertising consent not granted by user"), 'Missing consent rejection message');
});

test('adsterra-provider.js enforces master switch check and placement enabled check', () => {
  assert(providerCode.includes("!config.enabled"), 'Missing global config.enabled check');
  assert(providerCode.includes("!placementConfig.enabled"), 'Missing placementConfig.enabled check');
});

test('adsterra-provider.js permanently disables Popunder and Social Bar execution', () => {
  assert(providerCode.includes("Social Bar (Unit 32172758) — Permanently Disabled"), 'Missing Social Bar permanent disable marker');
  assert(providerCode.includes("Popunder (Unit 32172757) — Permanently Disabled"), 'Missing Popunder permanent disable marker');
});

test('adsterra-provider.js provides emergency kill-switch functions (killPlacement and killAll)', () => {
  assert(providerCode.includes("killPlacement(placementId)"), 'Missing killPlacement function');
  assert(providerCode.includes("killAll()"), 'Missing killAll function');
});

test('adsterra-provider.js reserves min-height and displays accessible advertisement label', () => {
  assert(providerCode.includes("element.style.minHeight ="), 'Missing minHeight reservation for CLS prevention');
  assert(providerCode.includes(".ad-label"), 'Missing .ad-label element creation');
});

test('adsterra-provider.js implements isolated friendly frame banner rendering', () => {
  assert(providerCode.includes("frame.title = 'Advertisement'"), 'Missing isolated frame title');
  assert(providerCode.includes("frameDoc.write("), 'Missing frameDoc.write for isolated execution');
});

// --- 3. REGISTRY & LIFECYCLE INTEGRITY ---
console.log('\n--- 3. REGISTRY & LIFECYCLE INTEGRITY ---');
const registry = require('../js/ad-registry.js');

test('js/ad-registry.js contains exactly 13 placements, only 3 launch candidates enabled', () => {
  assert.strictEqual(registry.placements.length, 13);
  const enabledPlacements = registry.placements.filter((p) => p.enabled);
  assert.strictEqual(enabledPlacements.length, 3, 'Exactly 3 placements must be enabled');
  const enabledIds = enabledPlacements.map((p) => p.id).sort();
  assert.deepStrictEqual(enabledIds, ['ad-company-roles-inline', 'ad-homepage-inline-secondary', 'ad-quiz-results']);
});

test('js/ad-registry.js permanently disables high-risk educational formats', () => {
  ['ad-quiz-between-questions', 'ad-interstitial', 'ad-exit-intent'].forEach((id) => {
    const p = registry.get(id);
    assert.strictEqual(p.status, 'permanently-disabled');
    assert.strictEqual(p.enabled, false);
  });
});

// --- 4. METADATA & HTML SCRIPT TAG INTEGRITY ---
console.log('\n--- 4. METADATA & HTML SCRIPT TAG INTEGRITY ---');
const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const companyHtml = fs.readFileSync(path.join(__dirname, '../company.html'), 'utf8');
const quizHtml = fs.readFileSync(path.join(__dirname, '../quiz.html'), 'utf8');

test('index.html preserves Google AdSense ownership verification meta tag', () => {
  assert(indexHtml.includes('<meta name="google-adsense-account" content="ca-pub-5064047932463792">'), 'AdSense ownership meta tag must be preserved');
});

test('index.html, company.html, and quiz.html load adsterra-config.js and adsterra-provider.js', () => {
  [indexHtml, companyHtml, quizHtml].forEach((html) => {
    assert(html.includes('js/adsterra-config.js'), 'Missing js/adsterra-config.js');
    assert(html.includes('js/adsterra-provider.js'), 'Missing js/adsterra-provider.js');
  });
});

// --- 5. CSP HEADERS VERIFICATION ---
console.log('\n--- 5. CSP HEADERS VERIFICATION ---');
const headersContent = fs.readFileSync(path.join(__dirname, '../_headers'), 'utf8');

test('_headers allows bauval.org, strictly excludes abscloud.org and unsafe-eval, and scopes frame-src', () => {
  assert(headersContent.includes('https://bauval.org'), 'Missing bauval.org in _headers');
  assert(!headersContent.includes('abscloud.org'), 'abscloud.org must NOT be in _headers (Popunder disabled)');
  assert(!headersContent.includes("'unsafe-eval'"), "CSP must NOT contain 'unsafe-eval'");
  assert(headersContent.includes("frame-src 'self' https://bauval.org https://*.bauval.org"), 'Missing scoped frame-src in _headers');
});

// --- 6. PRIVACY POLICY & ADSTERRA DISCLOSURES ---
console.log('\n--- 6. PRIVACY POLICY & ADSTERRA DISCLOSURES ---');
const privacyHtml = fs.readFileSync(path.join(__dirname, '../privacy.html'), 'utf8');

test('privacy.html accurately discloses the 3 active display placements and confirms popunders/social bar are disabled', () => {
  assert(privacyHtml.includes('Adsterra'), 'privacy.html must mention Adsterra');
  assert(privacyHtml.includes('The Three Active Display Placements'), 'Missing active display placements heading in privacy.html');
  assert(privacyHtml.includes('Zero popunders, onclick popups, floating notification bars (Social Bar)'), 'Missing explicit prohibited formats statement');
  assert(privacyHtml.includes('https://adsterra.com/privacy-policy-for-users/'), 'Missing Adsterra privacy link');
});

test('privacy.html discloses opt-out choices via youronlinechoices.eu, aboutads.info, and networkadvertising.org', () => {
  assert(privacyHtml.includes('youronlinechoices.eu'), 'Missing youronlinechoices.eu');
  assert(privacyHtml.includes('aboutads.info'), 'Missing aboutads.info');
  assert(privacyHtml.includes('networkadvertising.org'), 'Missing networkadvertising.org');
});

// --- 7. AD DOCUMENTATION ---
console.log('\n--- 7. AD DOCUMENTATION ---');
const adDoc = fs.readFileSync(path.join(__dirname, '../ADVERTISING_PLACEMENTS.md'), 'utf8');

test('ADVERTISING_PLACEMENTS.md documents the 3 active display placements and confirms popunder/social bar disabling', () => {
  assert(adDoc.includes('The Three Active Display Placements'), 'Missing active placements section');
  assert(adDoc.includes('Popunder (`32172757`):** Permanently disabled'), 'Missing Popunder permanent disable statement');
  assert(adDoc.includes('Social Bar (`32172758`):** Permanently disabled'), 'Missing Social Bar permanent disable statement');
});

console.log('\n============================================================');
console.log(`TOTAL RESULTS: ${passed} passed, ${failed} failed`);
console.log('============================================================');

if (failed > 0) process.exit(1);
