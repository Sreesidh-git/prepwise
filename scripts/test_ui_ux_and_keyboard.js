/**
 * PrepWise — UI/UX Redesign, Keyboard Engine & Review Matrix Test Suite
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
console.log('PREPWISE UI/UX REDESIGN & KEYBOARD ENGINE VERIFICATION');
console.log('============================================================\n');

// --- 1. GLOBAL DESIGN TOKENS & ACCESSIBILITY ---
console.log('--- 1. GLOBAL DESIGN TOKENS & ACCESSIBILITY ---');
const styleCss = fs.readFileSync(path.join(__dirname, '../css/style.css'), 'utf8');

test('css/style.css defines modern neutral palette tokens (--color-bg: #fafafa, --color-text: #09090b)', () => {
  assert(styleCss.includes('--color-bg: #fafafa'), 'Missing --color-bg: #fafafa');
  assert(styleCss.includes('--color-text: #09090b'), 'Missing --color-text: #09090b');
  assert(styleCss.includes('--color-surface-alt: #f4f4f5'), 'Missing #f4f4f5 neutral');
});

test('css/style.css defines multi-layered shadow tokens (--shadow-card and --shadow-card-hover)', () => {
  assert(styleCss.includes('--shadow-card:'), 'Missing --shadow-card token');
  assert(styleCss.includes('--shadow-card-hover:'), 'Missing --shadow-card-hover token');
});

test('css/style.css implements explicit :focus-visible ring for accessibility', () => {
  assert(styleCss.includes(':focus-visible {'), 'Missing :focus-visible rule');
  assert(styleCss.includes('outline: 2px solid var(--color-primary)'), 'Missing 2px primary outline in :focus-visible');
});

test('css/style.css implements @media (prefers-reduced-motion: reduce)', () => {
  assert(styleCss.includes('@media (prefers-reduced-motion: reduce)'), 'Missing prefers-reduced-motion rule');
  assert(styleCss.includes('animation-duration: 0.01ms !important'), 'Missing animation zeroing');
});

test('quiz.html uses semantic <h1> for primary page heading', () => {
  const quizHtml = fs.readFileSync(path.join(__dirname, '../quiz.html'), 'utf8');
  assert(quizHtml.includes('<h1 class="quiz-title" id="quizTitle"'), 'Missing semantic <h1> in quiz.html');
});

test('privacy.html references canonical prepwises.online and contains zero stale prepwise-7ij domain mentions', () => {
  const privacyHtml = fs.readFileSync(path.join(__dirname, '../privacy.html'), 'utf8');
  assert(!privacyHtml.includes('prepwise-7ij.pages.dev'), 'Stale domain prepwise-7ij found in privacy.html');
  assert(privacyHtml.includes('prepwises.online'), 'prepwises.online missing from privacy.html');
});

// --- 2. HOMEPAGE REDESIGN & SEARCH KEYBOARD SHORTCUT ---
console.log('\n--- 2. HOMEPAGE REDESIGN & SEARCH SHORTCUT ---');
const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');

test('index.html search bar includes keyboard shortcut hint pill (<kbd class="search-kbd">/</kbd>)', () => {
  assert(indexHtml.includes('<kbd class="search-kbd"'), 'Missing search-kbd pill in index.html');
});

test('js/app.js implements global "/" shortcut to focus search input with input guards', () => {
  assert(appJs.includes("e.key === '/'"), "Missing key === '/' listener in js/app.js");
  assert(appJs.includes('searchInput.focus()'), 'Missing searchInput.focus()');
  assert(appJs.includes("['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)"), 'Missing activeElement tag guard');
});

test('css/style.css defines elevated hero-stats micro-metric card layout', () => {
  assert(styleCss.includes('.hero-stats {'), 'Missing .hero-stats rule');
  assert(styleCss.includes('.hero-stat:hover {'), 'Missing .hero-stat:hover rule');
  assert(styleCss.includes('.search-kbd {'), 'Missing .search-kbd styling');
});

// --- 3. QUIZ INTERFACE & KEYBOARD ENGINE ---
console.log('\n--- 3. QUIZ INTERFACE & KEYBOARD ENGINE ---');
const quizJs = fs.readFileSync(path.join(__dirname, '../js/quiz.js'), 'utf8');

test('js/quiz.js implements setupKeyboardNavigation() and calls it on init', () => {
  assert(quizJs.includes('setupKeyboardNavigation();'), 'setupKeyboardNavigation not called in init');
  assert(quizJs.includes('function setupKeyboardNavigation()'), 'Missing setupKeyboardNavigation function');
});

test('js/quiz.js guards keyboard listener against input/textarea typing and modifier keys', () => {
  assert(quizJs.includes("['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)"), 'Missing tagName guard in quiz.js');
  assert(quizJs.includes('e.ctrlKey || e.metaKey || e.altKey'), 'Missing modifier key guard in quiz.js');
});

test('js/quiz.js maps 1-4 and A-D keys to answer options', () => {
  assert(quizJs.includes("'1': 0"), "Missing '1' key mapping");
  assert(quizJs.includes("'2': 1"), "Missing '2' key mapping");
  assert(quizJs.includes("'3': 2"), "Missing '3' key mapping");
  assert(quizJs.includes("'4': 3"), "Missing '4' key mapping");
  assert(quizJs.includes("'a': 0"), "Missing 'a' key mapping");
});

test('js/quiz.js maps Enter / ArrowRight to next and ArrowLeft to prev', () => {
  assert(quizJs.includes("key === 'Enter' || key === 'ArrowRight'"), 'Missing Enter/ArrowRight handler');
  assert(quizJs.includes("key === 'ArrowLeft'"), 'Missing ArrowLeft handler');
});

test('js/quiz.js maps S / s to solution toggle', () => {
  assert(quizJs.includes("key === 's' || key === 'S'"), 'Missing S/s solution toggle handler');
});

test('js/quiz.js renders keyboard shortcuts hint bar in question card', () => {
  assert(quizJs.includes('quiz-shortcuts-hint'), 'Missing quiz-shortcuts-hint in question HTML');
  assert(styleCss.includes('.quiz-shortcuts-hint'), 'Missing .quiz-shortcuts-hint in style.css');
});

// --- 4. RESULTS SCREEN & INTERACTIVE REVIEW MATRIX ---
console.log('\n--- 4. RESULTS SCREEN & INTERACTIVE REVIEW MATRIX ---');

test('js/quiz.js computes category performance breakdown with progress bars', () => {
  assert(quizJs.includes('categoryBreakdownHtml'), 'Missing categoryBreakdownHtml computation');
  assert(quizJs.includes('results-categories-section'), 'Missing results-categories-section HTML');
  assert(styleCss.includes('.results-categories-section'), 'Missing .results-categories-section in style.css');
});

test('js/quiz.js generates 50-question interactive review matrix chips', () => {
  assert(quizJs.includes('matrixChipsHtml'), 'Missing matrixChipsHtml computation');
  assert(quizJs.includes('review-matrix-grid'), 'Missing review-matrix-grid HTML');
  assert(quizJs.includes('review-chip'), 'Missing review-chip class');
  assert(styleCss.includes('.review-chip'), 'Missing .review-chip styling in style.css');
});

test('js/quiz.js binds openReviewQuestion() click handlers on review chips', () => {
  assert(quizJs.includes('function openReviewQuestion(idx)'), 'Missing openReviewQuestion function');
  assert(quizJs.includes('openReviewQuestion(qIdx)'), 'Missing chip click listener calling openReviewQuestion');
});

test('js/quiz.js supports return to results matrix from review mode', () => {
  assert(quizJs.includes('isReviewMode'), 'Missing isReviewMode state');
  assert(quizJs.includes('exitReviewBtn'), 'Missing exitReviewBtn element');
  assert(quizJs.includes('Back to Results Matrix'), 'Missing Back to Results Matrix button text');
});

// --- 5. COMPANY PROFILES & TRADEMARK NON-AFFILIATION DISCLAIMER ---
console.log('\n--- 5. COMPANY PROFILES & TRADEMARK DISCLAIMER ---');
const companyHtml = fs.readFileSync(path.join(__dirname, '../company.html'), 'utf8');

test('company.html includes explicit non-affiliation trademark disclaimer', () => {
  assert(companyHtml.includes('PrepWise is an independent educational platform'), 'Missing non-affiliation disclaimer');
  assert(companyHtml.includes('Company names and logos are trademarks of their respective owners and used solely for nominative identification.'), 'Missing nominative trademark text');
});

test('css/style.css defines polished role-card tokens with shadow-card and shadow-card-hover', () => {
  assert(styleCss.includes('box-shadow: var(--shadow-card);'), 'Missing --shadow-card on role-card');
  assert(styleCss.includes('box-shadow: var(--shadow-card-hover);'), 'Missing --shadow-card-hover on role-card:hover');
});

// --- 6. ADMIN DASHBOARD POLISH ---
console.log('\n--- 6. ADMIN DASHBOARD POLISH ---');
const adminCss = fs.readFileSync(path.join(__dirname, '../admin/admin.css'), 'utf8');

test('admin/admin.css has zebra striping and sticky table headers for high data density', () => {
  assert(adminCss.includes('tbody tr:nth-child(even)'), 'Missing zebra striping in admin.css');
  assert(adminCss.includes('position: sticky; top: 0;'), 'Missing sticky table headers in admin.css');
});

console.log('\n============================================================');
console.log(`TOTAL RESULTS: ${passed} passed, ${failed} failed`);
console.log('============================================================');

if (failed > 0) process.exit(1);

