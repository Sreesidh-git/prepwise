/**
 * PrepWise — Adsterra-Only Monetization Architecture & Safety Verification
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
console.log('PREPWISE ADSTERRA MONETIZATION & POLICY AUDIT');
console.log('============================================================\n');

// --- 1. ADSTERRA CENTRALIZED CONFIGURATION (js/adsterra-config.js) ---
console.log('--- 1. ADSTERRA CENTRALIZED CONFIGURATION ---');
const adsterraConfig = require('../js/adsterra-config.js');

test('adsterra-config.js defines websiteDomain as prepwises.online', () => {
  assert.strictEqual(adsterraConfig.websiteDomain, 'prepwises.online');
});

test('adsterra-config.js master kill-switch is strictly false (disabled pending codes)', () => {
  assert.strictEqual(adsterraConfig.enabled, false);
});

test('adsterra-config.js publisherId is null (no fake/mock publisher ID created)', () => {
  assert.strictEqual(adsterraConfig.publisherId, null);
});

test('adsterra-config.js defines quality exclusions for adult, gambling, and deceptive downloads', () => {
  assert.strictEqual(adsterraConfig.filters.excludeAdult, true);
  assert.strictEqual(adsterraConfig.filters.excludeGambling, true);
  assert.strictEqual(adsterraConfig.filters.excludeAlertsAndDeceptiveSoftware, true);
  assert.strictEqual(adsterraConfig.filters.excludePopunders, true);
  assert.strictEqual(adsterraConfig.filters.excludeSmartlinks, true);
});

test('adsterra-config.js selects exactly 3 initial launch placements', () => {
  const launchPlacements = Object.entries(adsterraConfig.placements).filter(([, p]) => p.selectedForLaunch);
  assert.strictEqual(launchPlacements.length, 3);
  const ids = launchPlacements.map(([id]) => id).sort();
  assert.deepStrictEqual(ids, ['ad-company-roles-inline', 'ad-homepage-inline-secondary', 'ad-quiz-results']);
});

test('All 3 launch placements are currently disabled (enabled: false) and have zero fake keys', () => {
  ['ad-homepage-inline-secondary', 'ad-company-roles-inline', 'ad-quiz-results'].forEach((id) => {
    const p = adsterraConfig.placements[id];
    assert.strictEqual(p.enabled, false, `${id} must be disabled until verified`);
    assert.strictEqual(p.adsterraKey, null, `${id} must not have fake adsterraKey`);
    assert.strictEqual(p.scriptSrc, null, `${id} must not have fake scriptSrc`);
  });
});

test('Remaining 10 placements in adsterra-config.js are disabled or prohibited', () => {
  const nonLaunch = Object.entries(adsterraConfig.placements).filter(([, p]) => !p.selectedForLaunch);
  assert.strictEqual(nonLaunch.length, 10);
  nonLaunch.forEach(([id, p]) => {
    assert.strictEqual(p.enabled, false, `${id} must be disabled`);
  });
});

test('High-risk placements (interstitial, exit-intent, in-quiz-questions) are permanently prohibited', () => {
  assert.strictEqual(adsterraConfig.placements['ad-quiz-between-questions'].prohibited, true);
  assert.strictEqual(adsterraConfig.placements['ad-interstitial'].prohibited, true);
  assert.strictEqual(adsterraConfig.placements['ad-exit-intent'].prohibited, true);
});

// --- 2. ADSTERRA PROVIDER ADAPTER (js/adsterra-provider.js) ---
console.log('\n--- 2. ADSTERRA PROVIDER ADAPTER ---');
const providerCode = fs.readFileSync(path.join(__dirname, '../js/adsterra-provider.js'), 'utf8');

test('adsterra-provider.js enforces consent check before loading any script', () => {
  assert(providerCode.includes("hasAdvertisingConsent()"), 'Missing hasAdvertisingConsent check');
  assert(providerCode.includes("Advertising consent not granted by user"), 'Missing consent rejection message');
});

test('adsterra-provider.js enforces master kill-switch check and placement enabled check', () => {
  assert(providerCode.includes("!config.enabled"), 'Missing global config.enabled check');
  assert(providerCode.includes("!placementConfig.enabled"), 'Missing placementConfig.enabled check');
});

test('adsterra-provider.js rejects if genuine adsterraKey or scriptSrc is missing (zero fake code execution)', () => {
  assert(providerCode.includes("!placementConfig.adsterraKey || !placementConfig.scriptSrc"), 'Missing code verification guard');
});

test('adsterra-provider.js prevents duplicate script loading and duplicate rendering', () => {
  assert(providerCode.includes("loadedScripts.has("), 'Missing loadedScripts deduplication check');
  assert(providerCode.includes("renderedPlacements.has("), 'Missing renderedPlacements deduplication check');
});

test('adsterra-provider.js provides emergency kill-switch functions (killPlacement and killAll)', () => {
  assert(providerCode.includes("killPlacement(placementId)"), 'Missing killPlacement function');
  assert(providerCode.includes("killAll()"), 'Missing killAll function');
});

test('adsterra-provider.js reserves min-height and displays accessible advertisement label', () => {
  assert(providerCode.includes("element.style.minHeight ="), 'Missing minHeight reservation for CLS prevention');
  assert(providerCode.includes(".ad-label"), 'Missing .ad-label element creation');
});

// --- 3. REGISTRY & LIFECYCLE INTEGRITY ---
console.log('\n--- 3. REGISTRY & LIFECYCLE INTEGRITY ---');
const registry = require('../js/ad-registry.js');

test('js/ad-registry.js contains exactly 13 placements, all strictly disabled', () => {
  assert.strictEqual(registry.placements.length, 13);
  registry.placements.forEach((p) => {
    assert.strictEqual(p.enabled, false, `Placement ${p.id} must be disabled`);
  });
});

test('js/ad-registry.js marks the 3 candidate placements with provider: adsterra', () => {
  ['ad-homepage-inline-secondary', 'ad-company-roles-inline', 'ad-quiz-results'].forEach((id) => {
    const p = registry.get(id);
    assert(p, `Placement ${id} not found in registry`);
    assert.strictEqual(p.provider, 'adsterra');
    assert.strictEqual(p.selectedForLaunch, true);
  });
});

// --- 4. PRESERVATION OF ADSENSE OWNERSHIP META TAG & NO AD-SERVING SCRIPTS ---
console.log('\n--- 4. METADATA & HTML SCRIPT TAG INTEGRITY ---');
const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const companyHtml = fs.readFileSync(path.join(__dirname, '../company.html'), 'utf8');
const quizHtml = fs.readFileSync(path.join(__dirname, '../quiz.html'), 'utf8');

test('index.html preserves Google AdSense ownership verification meta tag', () => {
  assert(indexHtml.includes('<meta name="google-adsense-account" content="ca-pub-5064047932463792">'), 'AdSense ownership meta tag must be preserved');
});

test('index.html, company.html, and quiz.html contain zero third-party advertising scripts', () => {
  [indexHtml, companyHtml, quizHtml].forEach((html) => {
    assert(!html.includes('pagead2.googlesyndication.com'), 'Found unexpected AdSense script');
    assert(!html.includes('adsbygoogle'), 'Found unexpected adsbygoogle');
    assert(!html.includes('adsterra.com/publisher'), 'Found raw third-party ad script before activation');
  });
});

test('index.html, company.html, and quiz.html load adsterra-config.js and adsterra-provider.js', () => {
  [indexHtml, companyHtml, quizHtml].forEach((html) => {
    assert(html.includes('js/adsterra-config.js'), 'Missing js/adsterra-config.js');
    assert(html.includes('js/adsterra-provider.js'), 'Missing js/adsterra-provider.js');
  });
});

// --- 5. PRIVACY POLICY & ADSTERRA DISCLOSURES ---
console.log('\n--- 5. PRIVACY POLICY & ADSTERRA DISCLOSURES ---');
const privacyHtml = fs.readFileSync(path.join(__dirname, '../privacy.html'), 'utf8');

test('privacy.html discloses Adsterra as prospective advertising partner', () => {
  assert(privacyHtml.includes('Adsterra'), 'privacy.html must mention Adsterra');
  assert(privacyHtml.includes('https://adsterra.com/privacy-policy-for-users/'), 'Missing Adsterra privacy link');
});

test('privacy.html confirms all 13 ad placements are currently 100% disabled', () => {
  assert(privacyHtml.includes('all 13 advertising placements are currently 100% disabled'), 'Missing 100% disabled statement in privacy.html');
});

test('privacy.html discloses opt-out choices via youronlinechoices.eu, aboutads.info, and networkadvertising.org', () => {
  assert(privacyHtml.includes('youronlinechoices.eu'), 'Missing youronlinechoices.eu');
  assert(privacyHtml.includes('aboutads.info'), 'Missing aboutads.info');
  assert(privacyHtml.includes('networkadvertising.org'), 'Missing networkadvertising.org');
});

// --- 6. AD DOCUMENTATION ---
console.log('\n--- 6. AD DOCUMENTATION ---');
const adDoc = fs.readFileSync(path.join(__dirname, '../ADVERTISING_PLACEMENTS.md'), 'utf8');

test('ADVERTISING_PLACEMENTS.md documents Adsterra-only monetization strategy', () => {
  assert(adDoc.includes('Adsterra') && adDoc.includes('prospective sole advertising provider'), 'Missing Adsterra mention in doc');
  assert(adDoc.includes('Launch Candidate 1'), 'Missing Launch Candidate 1 in doc');
  assert(adDoc.includes('Launch Candidate 2'), 'Missing Launch Candidate 2 in doc');
  assert(adDoc.includes('Launch Candidate 3'), 'Missing Launch Candidate 3 in doc');
});

test('ADVERTISING_PLACEMENTS.md documents exclusions for adult, gambling, deceptive software, popunders, smartlinks', () => {
  assert(adDoc.includes('No Adult / NSFW Content'), 'Missing adult exclusion in doc');
  assert(adDoc.includes('No Gambling or Casino Promotions'), 'Missing gambling exclusion in doc');
  assert(adDoc.includes('No Popunders (Onclick)'), 'Missing popunder exclusion in doc');
  assert(adDoc.includes('No Smartlinks'), 'Missing smartlinks exclusion in doc');
});

console.log('\n============================================================');
console.log(`TOTAL RESULTS: ${passed} passed, ${failed} failed`);
console.log('============================================================');

if (failed > 0) process.exit(1);
