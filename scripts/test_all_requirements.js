const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passedTests = 0;
let failedTests = 0;
const results = {
  analytics: [],
  advertising: [],
  csp_chartjs: [],
  admin_quiz: [],
  questions: []
};

function assert(condition, message, category = 'general') {
  if (condition) {
    passedTests++;
    results[category].push({ status: 'PASS', message });
    console.log(`  [PASS] ${message}`);
  } else {
    failedTests++;
    results[category].push({ status: 'FAIL', message });
    console.error(`  [FAIL] ${message}`);
  }
}

console.log('=== PREPWISE VERIFICATION TEST SUITE ===\n');

// -------------------------------------------------------------
// 1. ANALYTICS RUNTIME TESTS
// -------------------------------------------------------------
console.log('1. Testing Analytics Runtime...');
{
  const analyticsCode = fs.readFileSync('js/analytics.js', 'utf8');

  // Check syntax
  try {
    new vm.Script(analyticsCode);
    assert(true, 'js/analytics.js compiles without syntax errors', 'analytics');
  } catch (e) {
    assert(false, `js/analytics.js compilation failed: ${e.message}`, 'analytics');
  }

  // Mock DOM & Storage environment
  const mockEvents = [];
  const mockStorage = {};
  const mockSessionStorage = {};
  const mockListeners = {};

  const mockWindow = {
    PREPWISE_CONFIG: {
      supabaseUrl: 'https://test.supabase.co',
      supabasePublishableKey: 'test-anon-key'
    },
    location: {
      pathname: '/test-page',
      search: '?utm_source=test',
      href: 'https://example.com/test-page?utm_source=test'
    },
    innerWidth: 1200,
    addEventListener: (evt, cb) => {
      mockListeners[evt] = cb;
    },
    localStorage: {
      getItem: (k) => mockStorage[k] || null,
      setItem: (k, v) => { mockStorage[k] = String(v); },
      removeItem: (k) => { delete mockStorage[k]; }
    },
    sessionStorage: {
      getItem: (k) => mockSessionStorage[k] || null,
      setItem: (k, v) => { mockSessionStorage[k] = String(v); },
      removeItem: (k) => { delete mockSessionStorage[k]; }
    },
    crypto: {
      randomUUID: () => '11111111-2222-3333-4444-555555555555'
    },
    document: {
      title: 'PrepWise Test',
      referrer: 'https://google.com',
      addEventListener: (evt, cb) => {
        mockListeners['doc_' + evt] = cb;
      },
      querySelector: () => null,
      querySelectorAll: () => []
    },
    navigator: {},
    fetch: async (url, opts) => {
      mockEvents.push({ method: 'fetch', url, data: JSON.parse(opts.body) });
      return { ok: true, json: async () => ({ success: true }) };
    },
    console: {
      warn: () => {},
      error: () => {},
      log: () => {}
    }
  };
  mockWindow.window = mockWindow;

  const context = vm.createContext(mockWindow);
  vm.runInContext(analyticsCode, context);

  // Test that prepwiseTrack exists
  const track = context.window.prepwiseTrack;
  assert(typeof track === 'function', 'window.prepwiseTrack is exported as a function', 'analytics');

  // Test page_view
  track('page_view');
  assert(mockEvents.length === 1 && mockEvents[0].data.eventName === 'page_view', 'track("page_view") sends page_view payload', 'analytics');

  // Test duplicate suppression
  track('page_view');
  assert(mockEvents.length === 1, 'Duplicate page_view event is suppressed within the deduplication window', 'analytics');

  // Test company_view
  track('company_view', { companyId: 'tcs' });
  assert(mockEvents.length === 2 && mockEvents[1].data.eventName === 'company_view' && mockEvents[1].data.properties.companyId === 'tcs', 'track("company_view") sends companyId property', 'analytics');

  // Test search event (privacy check: query text must NOT be stored, only queryLength)
  track('search', { queryLength: 31, resultCount: 5 });
  assert(mockEvents.length === 3, 'track("search") sends search event', 'analytics');
  const searchPayload = mockEvents[2].data;
  assert(searchPayload.eventName === 'search', 'Search event has correct eventName', 'analytics');
  assert(searchPayload.properties.queryLength === 31, 'Search event tracks queryLength correctly', 'analytics');
  assert(!searchPayload.query && !searchPayload.searchText && !JSON.stringify(searchPayload).includes('software engineering'), 'Search event does NOT leak raw search text (PII protection)', 'analytics');

  // Test quiz_start
  track('quiz_start', { companyId: 'tcs', category: 'quantitative-aptitude' });
  assert(mockEvents.length === 4 && mockEvents[3].data.eventName === 'quiz_start' && mockEvents[3].data.properties.companyId === 'tcs', 'track("quiz_start") tracks quiz_start', 'analytics');

  // Test quiz_complete
  track('quiz_complete', { companyId: 'tcs', category: 'quantitative-aptitude', score: 8, questionCount: 10 });
  assert(mockEvents.length === 5 && mockEvents[4].data.eventName === 'quiz_complete' && mockEvents[4].data.properties.score === 8, 'track("quiz_complete") tracks quiz_complete with score and questionCount', 'analytics');

  // Test error resiliency: broken fetch does not throw
  context.fetch = () => Promise.reject(new Error('Network failure'));
  let didThrow = false;
  try {
    track('error_test', { foo: 'bar' });
  } catch (err) {
    didThrow = true;
  }
  assert(!didThrow, 'track() handles transport failures gracefully without throwing', 'analytics');
}

// -------------------------------------------------------------
// 2. ADVERTISING CSS & PLACEMENTS
// -------------------------------------------------------------
console.log('\n2. Testing Advertising CSS & Placements...');
{
  const styleCss = fs.readFileSync('css/style.css', 'utf8');
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  const companyHtml = fs.readFileSync('company.html', 'utf8');
  const quizHtml = fs.readFileSync('quiz.html', 'utf8');
  const companyJs = fs.readFileSync('js/company.js', 'utf8');
  const adRegistry = fs.readFileSync('js/ad-registry.js', 'utf8');

  // Verify default collapsed ad-slot rule
  assert(/\.ad-slot\s*\{[^}]*display:\s*none;/.test(styleCss), '.ad-slot has display: none defined', 'advertising');
  assert(/\.ad-slot\.is-enabled\s*\{[^}]*display:\s*block;/.test(styleCss), '.ad-slot.is-enabled activates display', 'advertising');

  // Verify .ad-slot-sidebar is only displayed when .is-enabled
  const sidebarEnabledMatch = /\.ad-slot-sidebar\.is-enabled\s*\{[^}]*display:\s*flex;/.test(styleCss);
  const sidebarStandaloneMatch = !/\.ad-slot-sidebar\s*\{[^}]*display:\s*flex;/.test(styleCss);
  assert(sidebarEnabledMatch && sidebarStandaloneMatch, '.ad-slot-sidebar only sets display: flex when .is-enabled is present', 'advertising');

  // Verify .ad-slot-halfpage is only displayed when .is-enabled
  const halfpageEnabledMatch = /\.ad-slot-halfpage\.is-enabled\s*\{[^}]*min-height:\s*600px;/.test(styleCss);
  const halfpageStandaloneMatch = !/\.ad-slot-halfpage\s*\{[^}]*display:/.test(styleCss);
  assert(halfpageEnabledMatch && halfpageStandaloneMatch, '.ad-slot-halfpage only applies styling when .is-enabled is present', 'advertising');

  // Check all 13 placements from ADVERTISING_PLACEMENTS.md are defined in registry and DOM templates
  const allTemplates = indexHtml + companyHtml + quizHtml + companyJs;
  const placementIds = [
    'ad-homepage-leaderboard',
    'ad-homepage-inline-secondary',
    'ad-homepage-inline-tertiary',
    'ad-company-inline',
    'ad-company-sidebar',
    'ad-company-roles-inline',
    'ad-quiz-between-questions',
    'ad-quiz-before-results',
    'ad-quiz-results',
    'ad-sticky-bottom-desktop',
    'ad-sticky-bottom-mobile',
    'ad-interstitial',
    'ad-exit-intent'
  ];

  placementIds.forEach(id => {
    assert(adRegistry.includes(`id: '${id}'`), `Placement ${id} is registered in js/ad-registry.js`, 'advertising');
    assert(allTemplates.includes(`id="${id}"`), `Placement ${id} exists in HTML/JS templates`, 'advertising');
  });

  // Verify Task 4: ad-homepage-inline-secondary is placed AFTER #companiesGrid in index.html
  const gridIndex = indexHtml.indexOf('id="companiesGrid"');
  const secondaryAdIndex = indexHtml.indexOf('id="ad-homepage-inline-secondary"');
  assert(gridIndex !== -1 && secondaryAdIndex !== -1 && secondaryAdIndex > gridIndex, 'ad-homepage-inline-secondary is located after #companiesGrid', 'advertising');
}

// -------------------------------------------------------------
// 3. CHART.JS & CONTENT SECURITY POLICY (CSP)
// -------------------------------------------------------------
console.log('\n3. Testing CSP & Chart.js Configuration...');
{
  const headers = fs.readFileSync('_headers', 'utf8');
  const adminHtml = fs.readFileSync('admin/index.html', 'utf8');

  // Verify jsdelivr is allowed in script-src
  assert(headers.includes('script-src') && headers.includes('https://cdn.jsdelivr.net'), '_headers CSP allows https://cdn.jsdelivr.net in script-src', 'csp_chartjs');

  // Verify strict security controls are preserved
  assert(headers.includes("frame-ancestors 'none'"), "CSP preserves frame-ancestors 'none'", 'csp_chartjs');
  assert(headers.includes("default-src 'self'"), "CSP preserves default-src 'self'", 'csp_chartjs');
  assert(headers.includes("strict-origin-when-cross-origin"), "Referrer-Policy is strict-origin-when-cross-origin", 'csp_chartjs');

  // Verify Chart.js script tag in admin/index.html
  assert(adminHtml.includes('https://cdn.jsdelivr.net/npm/chart.js'), 'admin/index.html includes Chart.js from CDN', 'csp_chartjs');
}

// -------------------------------------------------------------
// 4. ADMIN QUIZ PANEL IMPLEMENTATION
// -------------------------------------------------------------
console.log('\n4. Testing Admin Quiz Panel...');
{
  const adminHtml = fs.readFileSync('admin/index.html', 'utf8');
  const adminJs = fs.readFileSync('admin/admin.js', 'utf8');
  const analyticsApi = fs.readFileSync('functions/api/admin/analytics.js', 'utf8');

  // Check DOM elements
  assert(adminHtml.includes('id="section-quiz"'), 'admin/index.html has #section-quiz', 'admin_quiz');
  assert(adminHtml.includes('id="quizCards"'), 'admin/index.html has #quizCards', 'admin_quiz');
  assert(adminHtml.includes('id="quizScoreChart"'), 'admin/index.html has #quizScoreChart canvas', 'admin_quiz');
  assert(adminHtml.includes('id="quizEventsChart"'), 'admin/index.html has #quizEventsChart canvas', 'admin_quiz');
  assert(adminHtml.includes('id="quizCategoriesTable"'), 'admin/index.html has #quizCategoriesTable', 'admin_quiz');
  assert(adminHtml.includes('id="quizCompaniesTable"'), 'admin/index.html has #quizCompaniesTable', 'admin_quiz');
  assert(adminHtml.includes('id="refreshQuiz"'), 'admin/index.html has #refreshQuiz button', 'admin_quiz');

  // Check admin.js logic
  assert(adminJs.includes('async function loadQuiz()'), 'admin.js defines loadQuiz()', 'admin_quiz');
  assert(adminJs.includes('function renderQuiz('), 'admin.js defines renderQuiz()', 'admin_quiz');
  assert(adminJs.includes("button.dataset.section === 'quiz'"), 'admin.js routes "quiz" section in navigation handler', 'admin_quiz');
  assert(adminJs.includes("button.dataset.refresh === 'quiz'"), 'admin.js handles data-refresh="quiz" in refresh button handler', 'admin_quiz');

  // Check API aggregation
  assert(analyticsApi.includes('popularQuizCompanies'), 'functions/api/admin/analytics.js aggregates popularQuizCompanies', 'admin_quiz');
  assert(analyticsApi.includes('popularCategories'), 'functions/api/admin/analytics.js aggregates popularCategories', 'admin_quiz');
}

// -------------------------------------------------------------
// 5. QUESTION VALIDATION & BANNER LOGIC
// -------------------------------------------------------------
console.log('\n5. Testing Question Validation & Logic...');
{
  const reportPath = 'scripts/question_validation_report.json';
  assert(fs.existsSync(reportPath), 'scripts/question_validation_report.json exists', 'questions');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert(report.summary && report.summary.total_questions === 1100, 'Report summarizes 1100 total questions', 'questions');
  assert(report.summary.valid_questions === 1086, 'Report records 1086 valid verified questions', 'questions');
  assert(report.summary.manual_editorial_review_count === 14, 'Validation report flags exactly 14 questions for manual review', 'questions');
  assert(report.summary.invalid_questions === 0, 'Report records 0 fatal invalid questions', 'questions');

  // Check TCS Q9 is cleanly corrected with 35 litres option
  const tcsQuestions = JSON.parse(fs.readFileSync('data/questions/tcs.json', 'utf8'));
  const q9 = tcsQuestions.questions.find(q => q.id === 9);
  assert(q9 && q9.options[2] === '35 litres', 'TCS Q9 includes 35 litres option', 'questions');
  assert(q9 && q9.correctAnswer === 2, 'TCS Q9 correctAnswer is index 2', 'questions');
  assert(q9 && q9.explanation.includes('Final Answer:') && !q9.explanation.includes('Let me recalculate'), 'TCS Q9 explanation has clean 4-part structure without monologue', 'questions');

  // Check that quiz.js shows review warning banner for flagged questions
  const quizJs = fs.readFileSync('js/quiz.js', 'utf8');
  assert(quizJs.includes('explanationNeedsReview'), 'js/quiz.js has explanationNeedsReview logic', 'questions');
  assert(quizJs.includes('question-validation-warning'), 'js/quiz.js renders question-validation-warning banner when explanation is flagged', 'questions');
}

console.log('\n========================================');
console.log(`TEST RESULTS: ${passedTests} passed, ${failedTests} failed.`);
console.log('========================================');
process.exit(failedTests > 0 ? 1 : 0);
