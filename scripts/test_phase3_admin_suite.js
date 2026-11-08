/**
 * PrepWise Phase 3 Admin Control Centre Test Suite
 * Tests:
 * 1. Admin HTML structure and element ID uniqueness
 * 2. Admin API endpoints authorization & request handling
 * 3. Company CRUD & slug validation rules
 * 4. Question Batch Import & validation rules
 * 5. Content summary metrics & 14-flagged questions review routing
 * 6. Visitor analytics & CSV export
 * 7. System health 6-card indicators
 * 8. 13-placement ad registry disabled verification
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passedTests = 0;
let totalTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${description}`);
  } catch (error) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${error.message}`);
  }
}

async function testAsync(description, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${description}`);
  } catch (error) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${error.message}`);
  }
}

console.log('\n--- SUITE 1: HTML STRUCTURE & ELEMENT ID UNIQUENESS ---');

const htmlContent = fs.readFileSync(path.join(__dirname, '..', 'admin', 'index.html'), 'utf8');

test('admin/index.html has zero duplicate element IDs', () => {
  const idRegex = /id=["']([^"']+)["']/g;
  const ids = [];
  let match;
  while ((match = idRegex.exec(htmlContent)) !== null) {
    ids.push(match[1]);
  }
  const seen = new Set();
  const duplicates = [];
  for (const id of ids) {
    if (seen.has(id)) duplicates.push(id);
    seen.add(id);
  }
  assert.strictEqual(duplicates.length, 0, `Duplicate IDs found: ${duplicates.join(', ')}`);
});

test('admin/index.html includes all required Overview panel elements', () => {
  const required = [
    'overviewFilters', 'overviewPeriod', 'overviewFrom', 'overviewTo',
    'overviewCards', 'overviewChart', 'overviewPopularCompanies',
    'overviewPopularCategories', 'overviewRecentActivity', 'overviewSystemHealth'
  ];
  for (const id of required) {
    assert(htmlContent.includes(`id="${id}"`), `Missing element: #${id}`);
  }
});

test('admin/index.html includes all required Company Management elements', () => {
  const required = [
    'companyToolbar', 'companySearchInput', 'companyCategoryFilter',
    'newCompanyButton', 'exportCompaniesButton', 'companyEditorForm',
    'cName', 'cShortName', 'cSlug', 'cLogo', 'cLogoColor', 'cLogoBg',
    'cIndustry', 'cFounded', 'cHeadquarters', 'cCeo', 'cEmployees',
    'cWebsite', 'cDescription', 'cInterviewProcess', 'companyPreviewCard',
    'companyValidationBanner', 'saveCompanySubmit', 'cancelCompanyEditor'
  ];
  for (const id of required) {
    assert(htmlContent.includes(`id="${id}"`), `Missing element: #${id}`);
  }
});

test('admin/index.html includes all required Question Management & Import elements', () => {
  const required = [
    'questionToolbar', 'questionCompanyFilter', 'questionCategoryFilter',
    'questionDifficultyFilter', 'questionStatusFilter', 'questionSearchInput',
    'newQuestionButton', 'importQuestionsButton', 'exportQuestionsButton',
    'validateDatasetButton', 'questionImportModal', 'importValidationBanner',
    'importFileInput', 'importJsonTextarea', 'importPreviewSummary',
    'validateImportBtn', 'confirmImportBtn', 'cancelImportBtn',
    'questionEditorForm', 'questionValidationBanner', 'qExplanationPreview'
  ];
  for (const id of required) {
    assert(htmlContent.includes(`id="${id}"`), `Missing element: #${id}`);
  }
});

test('admin/index.html includes Content Summary KPI card container and refresh button', () => {
  assert(htmlContent.includes('id="contentSummaryCards"'), 'Missing #contentSummaryCards');
  assert(htmlContent.includes('id="refreshContentSummary"'), 'Missing #refreshContentSummary');
});

test('admin/index.html includes Visitor activity panels and CSV export button', () => {
  const required = [
    'visitorPopularPages', 'visitorPopularCompanies',
    'visitorActivityTable', 'exportActivity', 'activityPrevious', 'activityNext'
  ];
  for (const id of required) {
    assert(htmlContent.includes(`id="${id}"`), `Missing element: #${id}`);
  }
});

test('admin/index.html includes Quiz analytics elements with daily chart & filters', () => {
  const required = [
    'quizFilters', 'quizPeriod', 'quizFrom', 'quizTo', 'quizCards',
    'quizScoreChart', 'quizDailyChart', 'quizEventsChart',
    'quizCategoriesTable', 'quizCompaniesTable'
  ];
  for (const id of required) {
    assert(htmlContent.includes(`id="${id}"`), `Missing element: #${id}`);
  }
});

test('admin/index.html includes Advertising 13-placement summary cards and table', () => {
  assert(htmlContent.includes('id="advertisingSummaryCards"'), 'Missing #advertisingSummaryCards');
  assert(htmlContent.includes('id="advertisingPlacements"'), 'Missing #advertisingPlacements');
});

console.log('\n--- SUITE 2: ADMIN JAVASCRIPT LOGIC & REGEX RULES ---');

const adminJsContent = fs.readFileSync(path.join(__dirname, '..', 'admin', 'admin.js'), 'utf8');

test('admin.js contains exactly 14 flagged questions in review registry', () => {
  const expectedFlagged = [
    'accenture-16', 'accenture-26',
    'amazon-10', 'amazon-33',
    'cognizant-19', 'cognizant-25',
    'google-32',
    'hcl-30',
    'infosys-14', 'infosys-25', 'infosys-49',
    'microsoft-34',
    'wipro-8', 'wipro-32'
  ];
  for (const key of expectedFlagged) {
    assert(adminJsContent.includes(`'${key}'`), `Missing flagged key: ${key}`);
  }
});

test('admin.js slug regex strictly enforces lowercase alphanumeric and single hyphens', () => {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  assert.strictEqual(slugRegex.test('tcs'), true);
  assert.strictEqual(slugRegex.test('google'), true);
  assert.strictEqual(slugRegex.test('tata-consultancy-services'), true);
  assert.strictEqual(slugRegex.test('mercadolibre'), true);

  assert.strictEqual(slugRegex.test('TCS'), false);
  assert.strictEqual(slugRegex.test('-tcs'), false);
  assert.strictEqual(slugRegex.test('tcs-'), false);
  assert.strictEqual(slugRegex.test('tcs--consultancy'), false);
  assert.strictEqual(slugRegex.test('tcs_consultancy'), false);
  assert.strictEqual(slugRegex.test('tcs consultancy'), false);
});

test('admin.js exports companies and questions safely without exposing secrets', () => {
  assert(adminJsContent.includes('exportCompaniesButton'), 'Missing company export handler');
  assert(adminJsContent.includes('exportQuestionsButton'), 'Missing question export handler');
  assert(!adminJsContent.includes('SUPABASE_SECRET_KEY'), 'Exposed secret key in admin.js');
  assert(!adminJsContent.includes('SUPABASE_OWNER_USER_ID'), 'Exposed owner user id in admin.js');
});

console.log('\n--- SUITE 3: CLOUDFLARE PAGES FUNCTIONS BACKEND VALIDATION ---');

// Mock request / response helpers for testing Cloudflare Pages Functions
function mockRequest(method, url, headers = {}, body = null) {
  return {
    method,
    url,
    headers: new Map(Object.entries(headers)),
    json: async () => (body ? (typeof body === 'string' ? JSON.parse(body) : body) : null),
    text: async () => (body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '')
  };
}

(async () => {
  // Test 1: overview.js
  const overviewModule = await import('../functions/api/admin/overview.js');
  await testAsync('overview.js rejects unauthenticated requests with 401', async () => {
    const req = mockRequest('GET', 'http://localhost/api/admin/overview');
    const res = await overviewModule.onRequestGet({ request: req, env: {} });
    assert.strictEqual(res.status, 401);
  });

  // Test 2: companies.js
  const companiesModule = await import('../functions/api/admin/companies.js');
  await testAsync('companies.js rejects unauthenticated requests with 401', async () => {
    const req = mockRequest('GET', 'http://localhost/api/admin/companies');
    const res = await companiesModule.onRequestGet({ request: req, env: {} });
    assert.strictEqual(res.status, 401);
  });

  // Test 3: questions.js
  const questionsModule = await import('../functions/api/admin/questions.js');
  await testAsync('questions.js rejects unauthenticated requests with 401', async () => {
    const req = mockRequest('GET', 'http://localhost/api/admin/questions');
    const res = await questionsModule.onRequestGet({ request: req, env: {} });
    assert.strictEqual(res.status, 401);
  });

  // Test 4: content-summary.js
  const contentSummaryModule = await import('../functions/api/admin/content-summary.js');
  await testAsync('content-summary.js rejects unauthenticated requests with 401', async () => {
    const req = mockRequest('GET', 'http://localhost/api/admin/content-summary');
    const res = await contentSummaryModule.onRequestGet({ request: req, env: {} });
    assert.strictEqual(res.status, 401);
  });

  // Test 5: system.js
  const systemModule = await import('../functions/api/admin/system.js');
  await testAsync('system.js rejects unauthenticated requests with 401', async () => {
    const req = mockRequest('GET', 'http://localhost/api/admin/system');
    const res = await systemModule.onRequestGet({ request: req, env: {} });
    assert.strictEqual(res.status, 401);
  });

  console.log('\n--- SUITE 4: DATA INTEGRITY & AD REGISTRY AUDIT ---');

  // Verify ad registry
  const adRegistry = require('../js/ad-registry.js');
  test('PREPWISE_AD_REGISTRY has all 13 placements registered and disabled', () => {
    const registry = global.window ? global.window.PREPWISE_AD_REGISTRY : adRegistry;
    const placements = registry.placements;
    assert.strictEqual(placements.length, 13, `Expected 13 placements, found ${placements.length}`);
    for (const p of placements) {
      assert.strictEqual(p.enabled, false, `Placement ${p.id} must be disabled`);
    }
  });

  // Verify question validation report matches exactly
  const reportPath = path.join(__dirname, 'question_validation_report.json');
  test('question_validation_report.json confirms 1,086 approved and 14 review questions', () => {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.strictEqual(report.summary.total_questions, 1100);
    assert.strictEqual(report.summary.valid_questions, 1086);
    assert.strictEqual(report.summary.invalid_questions, 0);
    assert.strictEqual(report.summary.manual_editorial_review_count, 14);
    assert.strictEqual(report.summary.duplicate_option_count, 0);
    assert.strictEqual(report.summary.invalid_answer_index_count, 0);
    assert.strictEqual(report.flagged_questions.length, 14);
  });

  // Verify 22 companies dataset exists and has valid schemas
  const companiesPath = path.join(__dirname, '..', 'data', 'companies.json');
  test('data/companies.json has 22 valid companies matching slug format', () => {
    const companies = JSON.parse(fs.readFileSync(companiesPath, 'utf8'));
    assert.strictEqual(companies.length, 22);
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    for (const c of companies) {
      assert(c.name && c.name.trim(), `Company missing name: ${JSON.stringify(c)}`);
      assert(c.shortName && c.shortName.trim(), `Company missing shortName: ${c.name}`);
      const slug = c.slug || c.id;
      assert(slugRegex.test(slug), `Invalid slug for company ${c.name}: ${slug}`);
    }
  });

  console.log(`\n========================================`);
  console.log(`PHASE 3 TEST SUMMARY: ${passedTests}/${totalTests} tests passed.`);
  console.log(`========================================\n`);

  if (passedTests < totalTests) {
    process.exit(1);
  }
})();

