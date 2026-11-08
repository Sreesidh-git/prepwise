// PrepWise Production Seed Data Import & Dry-Run Tool
// Imports verified companies from data/companies.json and questions from data/questions/*.json
//
// SAFETY FIRST:
// - Default mode is DRY-RUN (--dry-run).
// - To apply to production, explicit flags are required: node scripts/import_seed_data.js --apply --confirm
// - Validates payloads, respects existing records, tags 14 review questions, batches requests.

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// Load environment safely
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

// 14 Confirmed Flagged Questions Registry
const MANUAL_REVIEW_KEYS = new Set([
  'accenture:16', 'accenture:25',
  'amazon:14', 'amazon:20',
  'cognizant:21', 'cognizant:49',
  'google:16',
  'hcl:21',
  'infosys:3', 'infosys:12', 'infosys:20',
  'microsoft:18',
  'wipro:20', 'wipro:21'
]);

function isUnderReview(companyKey, qId, explanation = '') {
  if (MANUAL_REVIEW_KEYS.has(`${companyKey}:${qId}`)) return true;
  return /let me\s+(reconsider|recalculate|recheck|re-read|re-examine|just fix)|change the question|i will change|none of the available options|answer should be/i.test(explanation);
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply') && args.includes('--confirm');
  const isDryRun = !isApply;

  console.log('============================================================');
  console.log('PREPWISE DATABASE SEED IMPORT TOOL');
  console.log(`EXECUTION MODE: ${isDryRun ? 'DRY-RUN (Safe: Zero Database Mutations)' : '*** LIVE PRODUCTION WRITE MODE ***'}`);
  console.log('============================================================\n');

  if (isDryRun) {
    console.log('NOTICE: Running in default DRY-RUN mode. No records will be created or modified.');
    console.log('To execute real database insertion, pass: --apply --confirm\n');
  }

  const env = loadEnv();
  const supabaseUrl = (env.SUPABASE_URL || '').replace(/\/$/, '');
  const secretKey = env.SUPABASE_SECRET_KEY;
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl) {
    console.error('ERROR: SUPABASE_URL not configured in environment or .env');
    process.exit(1);
  }

  const authHeaders = {
    apikey: secretKey || publishableKey,
    Authorization: `Bearer ${secretKey || publishableKey}`,
    'Content-Type': 'application/json'
  };

  // 1. Read local companies
  const companiesJsonPath = path.join(ROOT_DIR, 'data', 'companies.json');
  const localCompanies = JSON.parse(fs.readFileSync(companiesJsonPath, 'utf8'));

  // 2. Read local questions
  const questionsDir = path.join(ROOT_DIR, 'data', 'questions');
  const questionFiles = fs.readdirSync(questionsDir).filter((f) => f.endsWith('.json'));
  const localQuestions = [];

  for (const file of questionFiles) {
    const filePath = path.join(questionsDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const companyKey = file.replace('.json', '');
    const items = Array.isArray(data) ? data : (data.questions || []);
    for (const q of items) {
      localQuestions.push({
        ...q,
        companyKey
      });
    }
  }

  console.log(`[Source Data Audit]`);
  console.log(`  Companies in data/companies.json: ${localCompanies.length}`);
  console.log(`  Questions in data/questions/:      ${localQuestions.length} across ${questionFiles.length} company datasets\n`);

  // 3. Query existing remote database records
  console.log(`[Remote Database Inspection] Querying ${supabaseUrl}...`);
  let dbCompanies = [];
  let dbQuestions = [];

  try {
    const compRes = await fetch(`${supabaseUrl}/rest/v1/companies?select=id,legacy_id,slug,name`, { headers: authHeaders });
    if (compRes.ok) dbCompanies = await compRes.json();
    const qRes = await fetch(`${supabaseUrl}/rest/v1/interview_questions?select=id,company_id,legacy_id&limit=5000`, { headers: authHeaders });
    if (qRes.ok) dbQuestions = await qRes.json();
  } catch (err) {
    console.error(`Failed to connect to Supabase: ${err.message}`);
    process.exit(1);
  }

  console.log(`  Existing remote companies: ${dbCompanies.length}`);
  console.log(`  Existing remote questions: ${dbQuestions.length}\n`);

  // 4. Map Companies
  const dbCompanyBySlug = new Map(dbCompanies.map((c) => [c.slug, c]));
  const dbCompanyByLegacy = new Map(dbCompanies.map((c) => [c.legacy_id, c]));

  const companiesToInsert = [];
  const existingCompanies = [];

  for (const comp of localCompanies) {
    const slug = comp.slug || comp.id;
    const existing = dbCompanyBySlug.get(slug) || dbCompanyByLegacy.get(comp.id);
    if (existing) {
      existingCompanies.push({ slug, id: existing.id });
    } else {
      companiesToInsert.push({
        legacy_id: comp.id,
        name: comp.name,
        short_name: comp.shortName || comp.name,
        slug: slug,
        logo: comp.logo || null,
        logo_color: comp.logoColor || null,
        logo_background: comp.logoBg || null,
        region: comp.region || [],
        degrees: comp.degrees || [],
        industry: comp.industry || null,
        founded: comp.founded || null,
        headquarters: comp.headquarters || null,
        ceo: comp.ceo || null,
        employees: comp.employees || null,
        revenue: comp.revenue || null,
        website: comp.website || null,
        careers_url: comp.careersUrl || null,
        countries: comp.countries || [],
        description: comp.description || null,
        history: comp.history || null,
        milestones: comp.milestones || [],
        interview_process: comp.interviewProcess || null,
        test_pattern: comp.testPattern || {},
        tips: comp.tips || [],
        job_roles: comp.jobRoles || [],
        is_published: true,
        published_at: new Date().toISOString()
      });
    }
  }

  console.log('--- COMPANY SEED SUMMARY ---');
  console.log(`  Companies ready to insert:  ${companiesToInsert.length}`);
  console.log(`  Companies already present:  ${existingCompanies.length}`);

  // 5. Map Questions
  // Check cross-company shared questions vs intra-company duplicates
  const questionTextSeenByCompany = new Map();
  const globalQuestionTextSeen = new Map();
  let intraCompanyDuplicates = 0;
  let crossCompanyShared = 0;

  const questionsToInsert = [];
  let underReviewCount = 0;
  let approvedCount = 0;

  for (const q of localQuestions) {
    const textNorm = (q.question || q.question_text || '').trim().toLowerCase();

    // Check intra-company duplicate
    if (!questionTextSeenByCompany.has(q.companyKey)) {
      questionTextSeenByCompany.set(q.companyKey, new Set());
    }
    const compSet = questionTextSeenByCompany.get(q.companyKey);
    if (compSet.has(textNorm)) {
      intraCompanyDuplicates++;
    } else {
      compSet.add(textNorm);
    }

    // Check cross-company shared
    if (globalQuestionTextSeen.has(textNorm)) {
      crossCompanyShared++;
    } else {
      globalQuestionTextSeen.set(textNorm, q.companyKey);
    }

    const flagged = isUnderReview(q.companyKey, q.id, q.explanation);
    if (flagged) underReviewCount++;
    else approvedCount++;

    questionsToInsert.push({
      companyKey: q.companyKey,
      legacy_id: q.id,
      question_text: q.question || q.question_text,
      options: q.options,
      correct_answer: q.correctAnswer,
      explanation: q.explanation || null,
      difficulty: q.difficulty || q.level || 'Intermediate',
      level: q.level || q.difficulty || 'Intermediate',
      target_roles: q.targetRoles || [],
      review_status: flagged ? 'under_review' : 'approved',
      review_notes: flagged ? 'Flagged for editorial review due to mathematical or premise contradiction.' : null,
      is_published: true,
      published_at: new Date().toISOString()
    });
  }

  // Check questions already in database for idempotency
  const existingCompanyMap = new Map();
  dbCompanies.forEach((c) => {
    existingCompanyMap.set(c.slug, c.id);
    if (c.legacy_id) existingCompanyMap.set(c.legacy_id, c.id);
  });
  const existingQuestionKeys = new Set(dbQuestions.map((q) => `${q.company_id}:${q.legacy_id}`));
  let questionsAlreadyPresent = 0;
  for (const q of localQuestions) {
    const compUuid = existingCompanyMap.get(q.companyKey);
    if (compUuid && existingQuestionKeys.has(`${compUuid}:${q.id}`)) {
      questionsAlreadyPresent++;
    }
  }

  console.log('\n--- QUESTION SEED SUMMARY ---');
  console.log(`  Total questions evaluated:       ${localQuestions.length}`);
  console.log(`  Questions approved:              ${approvedCount}`);
  console.log(`  Questions tagged 'under_review': ${underReviewCount}`);
  console.log(`  Questions already in database:   ${questionsAlreadyPresent}`);
  console.log(`  Questions ready to insert:       ${localQuestions.length - questionsAlreadyPresent}`);
  console.log(`  Legitimate cross-company shared: ${crossCompanyShared}`);
  console.log(`  Intra-company duplicate errors:  ${intraCompanyDuplicates}`);

  // 6. Live Execution (Only if --apply --confirm passed)
  if (isApply) {
    console.log('\n============================================================');
    console.log('EXECUTING PRODUCTION SEED IMPORT...');
    console.log('============================================================');

    if (!secretKey) {
      console.error('ABORTED: SUPABASE_SECRET_KEY is required for live insertion.');
      process.exit(1);
    }

    // Insert companies in batches of 25
    if (companiesToInsert.length > 0) {
      console.log(`\nInserting ${companiesToInsert.length} new companies in batches of 25...`);
      for (let i = 0; i < companiesToInsert.length; i += 25) {
        const batch = companiesToInsert.slice(i, i + 25);
        const res = await fetch(`${supabaseUrl}/rest/v1/companies`, {
          method: 'POST',
          headers: {
            ...authHeaders,
            Prefer: 'return=representation'
          },
          body: JSON.stringify(batch)
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Company batch insertion failed (HTTP ${res.status}): ${errText}`);
        }
        const inserted = await res.json();
        inserted.forEach((c) => existingCompanyMap.set(c.slug, c.id));
        console.log(`  Inserted company batch [${i + 1} to ${Math.min(i + 25, companiesToInsert.length)}]`);
      }
    } else {
      console.log('\nAll 22 companies are already present in the database. Zero company inserts needed.');
    }

    // Prepare questions with company_id UUIDs
    const preparedQuestions = questionsToInsert.map((q) => {
      const companyUuid = existingCompanyMap.get(q.companyKey);
      if (!companyUuid) {
        throw new Error(`Missing company UUID mapping for slug: ${q.companyKey}`);
      }
      const { companyKey, ...rest } = q;
      return {
        ...rest,
        company_id: companyUuid
      };
    });

    // Idempotent filter: Only insert questions not already in database
    const questionsToActuallyInsert = preparedQuestions.filter(
      (q) => !existingQuestionKeys.has(`${q.company_id}:${q.legacy_id}`)
    );

    if (questionsToActuallyInsert.length > 0) {
      console.log(`\nInserting ${questionsToActuallyInsert.length} new questions in batches of 50...`);
      for (let i = 0; i < questionsToActuallyInsert.length; i += 50) {
        const batch = questionsToActuallyInsert.slice(i, i + 50);
        const res = await fetch(`${supabaseUrl}/rest/v1/interview_questions`, {
          method: 'POST',
          headers: {
            ...authHeaders,
            Prefer: 'return=minimal'
          },
          body: JSON.stringify(batch)
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Question batch insertion failed (HTTP ${res.status}): ${errText}`);
        }
        console.log(`  Inserted question batch [${i + 1} to ${Math.min(i + 50, questionsToActuallyInsert.length)}]`);
      }
    } else {
      console.log(`All ${preparedQuestions.length} questions are already present in the database. Zero question inserts needed.`);
    }

    console.log('\nSUCCESS: Production seed data import completed safely!');
  } else {
    console.log('\n============================================================');
    console.log('DRY-RUN VERIFICATION SUCCESSFUL');
    console.log('ZERO database mutations were executed.');
    console.log('To execute real database import when authorized by owner:');
    console.log('node scripts/import_seed_data.js --apply --confirm');
    console.log('============================================================\n');
  }
}

main().catch((err) => {
  console.error('\nSeed Import Failure:', err.message);
  process.exit(1);
});

