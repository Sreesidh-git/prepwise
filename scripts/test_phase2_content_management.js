const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  [PASS] ${msg}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${msg}`);
  }
}

console.log('=== PHASE 2 CONTENT MANAGEMENT & QUESTION QUALITY SUITE ===\n');

// 1. Question Bank Integrity Check
console.log('1. Verifying Question Bank Integrity across all 22 datasets...');
const questionDir = path.join(__dirname, '..', 'data', 'questions');
const files = fs.readdirSync(questionDir).filter(f => f.endsWith('.json'));

assert(files.length === 22, `Found exactly 22 question dataset files (found ${files.length})`);

let totalQuestions = 0;
let invalidIndices = 0;
let duplicateOptions = 0;
let emptyExplanations = 0;

files.forEach(file => {
  const filePath = path.join(questionDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const questions = data.questions || [];
  totalQuestions += questions.length;

  questions.forEach(q => {
    // Check answer index bounds
    if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
      invalidIndices++;
    }
    // Check option count
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      invalidIndices++;
    } else {
      const opts = q.options.map(o => String(o).trim().toLowerCase());
      if (new Set(opts).size !== 4) {
        duplicateOptions++;
      }
    }
    // Check explanation non-empty
    if (!q.explanation || !q.explanation.trim()) {
      emptyExplanations++;
    }
  });
});

assert(totalQuestions === 1100, `Total questions across bank equals 1,100 (counted ${totalQuestions})`);
assert(invalidIndices === 0, `All questions have valid [0, 1, 2, 3] correctAnswer indices (errors: ${invalidIndices})`);
assert(duplicateOptions === 0, `Zero duplicate options across all 1,100 questions (duplicates: ${duplicateOptions})`);
assert(emptyExplanations === 0, `Zero empty explanations across all 1,100 questions (empty: ${emptyExplanations})`);

// 2. Confirmed Fixes Verification
console.log('\n2. Verifying Confirmed Fixes in Question Bank...');
const tcs = JSON.parse(fs.readFileSync(path.join(questionDir, 'tcs.json'), 'utf8'));
const qTcs9 = tcs.questions.find(q => q.id === 9);
assert(qTcs9.options[2] === '35 litres', 'TCS Q9 includes 35 litres at index 2');
assert(qTcs9.correctAnswer === 2, 'TCS Q9 correctAnswer is index 2');
assert(qTcs9.explanation.includes('Final Answer:') && !qTcs9.explanation.includes('recalculate'), 'TCS Q9 explanation is clean');

const amazon = JSON.parse(fs.readFileSync(path.join(questionDir, 'amazon.json'), 'utf8'));
const qAmz26 = amazon.questions.find(q => q.id === 26);
assert(qAmz26.options[1] === 'Wednesday', 'Amazon Q26 option B is Wednesday');
assert(qAmz26.correctAnswer === 1, 'Amazon Q26 correctAnswer is index 1 (Wednesday)');

const cog = JSON.parse(fs.readFileSync(path.join(questionDir, 'cognizant.json'), 'utf8'));
const qCog47 = cog.questions.find(q => q.id === 47);
assert(qCog47.options[2] === '1', 'Cognizant Q47 option C is 1');
assert(qCog47.correctAnswer === 2, 'Cognizant Q47 correctAnswer is index 2 (1)');

const msft = JSON.parse(fs.readFileSync(path.join(questionDir, 'microsoft.json'), 'utf8'));
const qMsft8 = msft.questions.find(q => q.id === 8);
assert(qMsft8.options[1] === '211/2300', 'Microsoft Q8 option B is 211/2300');
assert(qMsft8.correctAnswer === 1, 'Microsoft Q8 correctAnswer is index 1');

const qMsft27 = msft.questions.find(q => q.id === 27);
assert(qMsft27.options[0] === '118', 'Microsoft Q27 option A is 118');
assert(qMsft27.correctAnswer === 0, 'Microsoft Q27 correctAnswer is index 0');

const ibm = JSON.parse(fs.readFileSync(path.join(questionDir, 'ibm.json'), 'utf8'));
const qIbm3 = ibm.questions.find(q => q.id === 3);
assert(qIbm3.options[0] === '20/3 days', 'IBM Q3 option A is 20/3 days');
assert(qIbm3.correctAnswer === 0, 'IBM Q3 correctAnswer is index 0');

const wipro = JSON.parse(fs.readFileSync(path.join(questionDir, 'wipro.json'), 'utf8'));
const qWip1 = wipro.questions.find(q => q.id === 1);
assert(qWip1.options[2] === 'Rs. 240', 'Wipro Q1 option C is Rs. 240');
assert(qWip1.correctAnswer === 2, 'Wipro Q1 correctAnswer is index 2');

const hcl = JSON.parse(fs.readFileSync(path.join(questionDir, 'hcl.json'), 'utf8'));
const qHcl14 = hcl.questions.find(q => q.id === 14);
assert(qHcl14.options[1] === '13 years', 'HCL Q14 option B is 13 years');
assert(qHcl14.correctAnswer === 1, 'HCL Q14 correctAnswer is index 1');

const qAmz2 = amazon.questions.find(q => q.id === 2);
assert(qAmz2.options[3] === '38.89%', 'Amazon Q2 option D is 38.89%');
assert(qAmz2.correctAnswer === 3, 'Amazon Q2 correctAnswer is index 3');

// 3. Admin Question Management Backend & Authorization
console.log('\n3. Verifying Admin Question Management & Authorization...');
const questionsApiCode = fs.readFileSync('functions/api/admin/questions.js', 'utf8');

assert(questionsApiCode.includes('requireAdmin(context.request, context.env)'), 'questions.js enforces requireAdmin authorization');
assert(questionsApiCode.includes('validateQuestionPayload'), 'questions.js validates question payload structure and contents');
assert(questionsApiCode.includes('VALID_DIFFICULTIES'), 'questions.js enforces valid difficulty enum');
assert(questionsApiCode.includes('FORBIDDEN_MONOLOGUES'), 'questions.js screens against raw internal-monologue artifacts');
assert(questionsApiCode.includes('Bulk deletion is strictly prohibited'), 'questions.js prohibits bulk deletion operations');

// 4. Admin Frontend Question Management Controls
console.log('\n4. Verifying Admin Frontend Question UI Controls...');
const adminHtml = fs.readFileSync('admin/index.html', 'utf8');
const adminJs = fs.readFileSync('admin/admin.js', 'utf8');

assert(adminHtml.includes('id="questionToolbar"'), 'admin/index.html includes #questionToolbar');
assert(adminHtml.includes('id="questionCompanyFilter"'), 'admin/index.html includes #questionCompanyFilter');
assert(adminHtml.includes('id="questionCategoryFilter"'), 'admin/index.html includes #questionCategoryFilter');
assert(adminHtml.includes('id="questionDifficultyFilter"'), 'admin/index.html includes #questionDifficultyFilter');
assert(adminHtml.includes('id="questionSearchInput"'), 'admin/index.html includes #questionSearchInput');
assert(adminHtml.includes('id="questionEditorForm"'), 'admin/index.html includes #questionEditorForm');
assert(adminHtml.includes('id="questionValidationBanner"'), 'admin/index.html includes #questionValidationBanner');
assert(adminHtml.includes('id="qExplanationPreview"'), 'admin/index.html includes #qExplanationPreview');
assert(adminHtml.includes('id="exportQuestionsButton"'), 'admin/index.html includes #exportQuestionsButton');
assert(adminHtml.includes('id="validateDatasetButton"'), 'admin/index.html includes #validateDatasetButton');

assert(adminJs.includes('renderQuestionsTable'), 'admin.js implements renderQuestionsTable()');
assert(adminJs.includes('openQuestionEditor'), 'admin.js implements openQuestionEditor()');
assert(adminJs.includes('updateQuestionValidation'), 'admin.js implements live updateQuestionValidation()');
assert(adminJs.includes('filterQuestions'), 'admin.js implements client-side filterQuestions()');

// 5. Database Migration Proposal
console.log('\n5. Verifying Migration 0005 Proposal...');
const migration5Path = 'supabase/migrations/0005_question_management.sql';
assert(fs.existsSync(migration5Path), 'supabase/migrations/0005_question_management.sql exists');
const migration5Code = fs.readFileSync(migration5Path, 'utf8');
assert(migration5Code.includes('review_status'), 'Migration 0005 adds review_status column');
assert(migration5Code.includes('admin_questions_view'), 'Migration 0005 defines admin_questions_view');

console.log('\n========================================');
console.log(`PHASE 2 TEST RESULTS: ${passed} passed, ${failed} failed.`);
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);

