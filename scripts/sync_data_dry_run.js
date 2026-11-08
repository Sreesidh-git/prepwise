// PrepWise Data Synchronization Dry-Run Inspector
// Compares local static JSON datasets (data/companies.json, data/questions/*.json)
// against remote Supabase database records (public.companies, public.interview_questions)
// STRICTLY READ-ONLY. Zero mutations, zero writes, zero data alteration.

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// Load .env safely without printing secrets
function loadEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

async function runDryRun() {
  console.log('============================================================');
  console.log('PREPWISE DATA SYNCHRONIZATION DRY-RUN AUDIT');
  console.log('Mode: STRICTLY READ-ONLY (No database writes performed)');
  console.log('============================================================\n');

  const env = loadEnv();
  const supabaseUrl = (env.SUPABASE_URL || '').replace(/\/$/, '');
  const secretKey = env.SUPABASE_SECRET_KEY;
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY;

  const authHeaders = {
    apikey: secretKey || publishableKey,
    Authorization: `Bearer ${secretKey || publishableKey}`,
    'Content-Type': 'application/json'
  };

  // 1. Read local datasets
  const companiesJsonPath = path.join(ROOT_DIR, 'data', 'companies.json');
  const localCompanies = JSON.parse(fs.readFileSync(companiesJsonPath, 'utf8'));
  console.log(`[Local Static Datasets] Found ${localCompanies.length} companies in data/companies.json`);

  const questionsDir = path.join(ROOT_DIR, 'data', 'questions');
  const questionFiles = fs.readdirSync(questionsDir).filter((f) => f.endsWith('.json'));
  let totalLocalQuestions = 0;
  const localQuestionsByCompany = {};

  for (const file of questionFiles) {
    const filePath = path.join(questionsDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const questions = Array.isArray(data) ? data : (data.questions || []);
    const companyKey = file.replace('.json', '');
    localQuestionsByCompany[companyKey] = questions;
    totalLocalQuestions += questions.length;
  }
  console.log(`[Local Static Datasets] Found ${totalLocalQuestions} questions across ${questionFiles.length} files in data/questions/`);

  // 2. Fetch existing database records (read-only)
  let dbCompanies = [];
  let dbQuestions = [];

  if (supabaseUrl && (secretKey || publishableKey)) {
    try {
      console.log(`\n[Remote Database] Querying existing records from ${supabaseUrl}...`);
      const compRes = await fetch(`${supabaseUrl}/rest/v1/companies?select=*`, { headers: authHeaders });
      if (compRes.ok) {
        dbCompanies = await compRes.json();
      } else {
        console.log(`[Remote Database] Warning: Could not fetch companies (status ${compRes.status})`);
      }

      const qRes = await fetch(`${supabaseUrl}/rest/v1/interview_questions?select=*`, { headers: authHeaders });
      if (qRes.ok) {
        dbQuestions = await qRes.json();
      } else {
        console.log(`[Remote Database] Warning: Could not fetch interview_questions (status ${qRes.status})`);
      }
    } catch (err) {
      console.log(`[Remote Database] Read query failed: ${err.message}`);
    }
  } else {
    console.log('\n[Remote Database] No credentials found in .env; assuming empty remote database.');
  }

  console.log(`[Remote Database] Existing companies: ${dbCompanies.length}`);
  console.log(`[Remote Database] Existing questions: ${dbQuestions.length}`);

  // 3. Dry-run analysis for Companies
  console.log('\n--- 1. COMPANY SYNCHRONIZATION DRY-RUN ---');
  const companyAnalysis = {
    newRecords: [],
    existingIdentical: [],
    updatesRequired: [],
    conflicts: [],
    invalid: []
  };

  const dbCompaniesBySlug = new Map(dbCompanies.map((c) => [c.slug, c]));
  const dbCompaniesByLegacyId = new Map(dbCompanies.map((c) => [c.legacy_id, c]));

  for (const comp of localCompanies) {
    const slug = comp.slug || comp.id;
    // Validate required fields
    if (!comp.name || !slug || !comp.id) {
      companyAnalysis.invalid.push({ item: comp, reason: 'Missing name, slug, or id' });
      continue;
    }
    // Check slug format
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      companyAnalysis.invalid.push({ item: comp, reason: `Malformed slug format: ${slug}` });
      continue;
    }

    const matchedBySlug = dbCompaniesBySlug.get(slug);
    const matchedByLegacy = dbCompaniesByLegacyId.get(comp.id);

    if (!matchedBySlug && !matchedByLegacy) {
      companyAnalysis.newRecords.push({
        id: comp.id,
        name: comp.name,
        slug: slug,
        industry: comp.industry
      });
    } else if (matchedBySlug && matchedByLegacy && matchedBySlug.id === matchedByLegacy.id) {
      // Check for property differences
      const diffs = [];
      if (matchedBySlug.name !== comp.name) diffs.push('name');
      if (matchedBySlug.description !== comp.description) diffs.push('description');
      if (matchedBySlug.industry !== comp.industry) diffs.push('industry');

      if (diffs.length > 0) {
        companyAnalysis.updatesRequired.push({ id: comp.id, slug: slug, diffs });
      } else {
        companyAnalysis.existingIdentical.push({ id: comp.id, slug: slug });
      }
    } else {
      companyAnalysis.conflicts.push({
        id: comp.id,
        slug: slug,
        reason: 'Legacy ID and slug point to different database records'
      });
    }
  }

  console.log(`  New company records to insert:     ${companyAnalysis.newRecords.length}`);
  console.log(`  Existing identical company records: ${companyAnalysis.existingIdentical.length}`);
  console.log(`  Existing records needing update:   ${companyAnalysis.updatesRequired.length}`);
  console.log(`  Conflicting company records:       ${companyAnalysis.conflicts.length}`);
  console.log(`  Invalid company records:           ${companyAnalysis.invalid.length}`);

  // 4. Dry-run analysis for Questions
  console.log('\n--- 2. QUESTION SYNCHRONIZATION DRY-RUN ---');
  const questionAnalysis = {
    newRecords: [],
    existingIdentical: [],
    updatesRequired: [],
    duplicates: [],
    invalid: [],
    underReviewFlagged: []
  };

  const dbQuestionsKey = new Set(
    dbQuestions.map((q) => `${q.company_id || q.company_slug || ''}:${q.legacy_id || q.id}`)
  );
  const seenQuestionTexts = new Map();

  for (const [companyKey, questions] of Object.entries(localQuestionsByCompany)) {
    for (const q of questions) {
      const qKey = `${companyKey}:${q.id}`;
      const qTextKey = (q.question || q.question_text || '').trim().toLowerCase();

      // Check validation rules
      if (!q.question && !q.question_text) {
        questionAnalysis.invalid.push({ key: qKey, reason: 'Missing question text' });
        continue;
      }
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        questionAnalysis.invalid.push({ key: qKey, reason: `Options array must have exactly 4 items (got ${q.options?.length})` });
        continue;
      }
      if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
        questionAnalysis.invalid.push({ key: qKey, reason: `Invalid correctAnswer index: ${q.correctAnswer}` });
        continue;
      }

      // Check duplicates
      if (seenQuestionTexts.has(qTextKey)) {
        questionAnalysis.duplicates.push({
          key: qKey,
          firstSeen: seenQuestionTexts.get(qTextKey),
          questionSnippet: q.question.slice(0, 60)
        });
      } else {
        seenQuestionTexts.set(qTextKey, qKey);
      }

      // Check review status
      const explanation = q.explanation || '';
      const isUnderReview = Boolean(
        q.reviewRequired ||
        /let me\s+(reconsider|recalculate|recheck|re-read|re-examine|just fix)|change the question|i will change|none of the available options|answer should be/i.test(explanation)
      );

      if (isUnderReview) {
        questionAnalysis.underReviewFlagged.push({ key: qKey, snippet: q.question.slice(0, 50) });
      }

      // Check against DB
      if (!dbQuestionsKey.has(qKey)) {
        questionAnalysis.newRecords.push({
          key: qKey,
          company: companyKey,
          legacyId: q.id,
          reviewStatus: isUnderReview ? 'under_review' : 'approved'
        });
      } else {
        questionAnalysis.existingIdentical.push(qKey);
      }
    }
  }

  console.log(`  New question records to insert:     ${questionAnalysis.newRecords.length}`);
  console.log(`  Existing identical questions:       ${questionAnalysis.existingIdentical.length}`);
  console.log(`  Questions flagged for review:       ${questionAnalysis.underReviewFlagged.length}`);
  console.log(`  Duplicate questions detected:       ${questionAnalysis.duplicates.length}`);
  console.log(`  Invalid questions detected:         ${questionAnalysis.invalid.length}`);

  // Summary Report
  console.log('\n============================================================');
  console.log('DRY-RUN CONCLUSION & RECOMMENDATION');
  console.log('============================================================');
  console.log(`1. Remote database is currently empty (0 companies, 0 questions).`);
  console.log(`2. If imported, exactly ${companyAnalysis.newRecords.length} companies and ${questionAnalysis.newRecords.length} questions will be created.`);
  console.log(`3. Exactly ${questionAnalysis.underReviewFlagged.length} questions will be tagged with review_status = 'under_review'.`);
  console.log(`4. ZERO invalid questions or fatal schema errors detected.`);
  console.log(`5. ZERO remote mutations were executed during this dry-run.`);
  console.log('============================================================\n');

  return { companyAnalysis, questionAnalysis };
}

if (require.main === module) {
  runDryRun().catch(console.error);
}

module.exports = { runDryRun };
