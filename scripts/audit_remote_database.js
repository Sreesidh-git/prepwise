// Read-only inspection of Supabase remote schema and table counts
// NEVER prints or exposes secrets. Uses process.env from .env

const fs = require('fs');
const path = require('path');

// Parse .env locally without printing
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
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

async function audit() {
  const env = loadEnv();
  const supabaseUrl = (env.SUPABASE_URL || '').replace(/\/$/, '');
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY;
  const secretKey = env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    console.log('STATUS: SUPABASE_URL not found in .env');
    return;
  }

  console.log(`Connecting read-only to Supabase project URL: ${supabaseUrl}`);

  // Test reachability
  try {
    const healthRes = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: publishableKey || secretKey }
    });
    console.log(`Supabase Auth health status: ${healthRes.status} ${healthRes.statusText}`);
  } catch (err) {
    console.log(`Supabase Auth health check failed: ${err.message}`);
  }

  // Inspect PostgREST OpenAPI schema (which lists all available tables and columns)
  const authHeaders = {
    apikey: secretKey || publishableKey,
    Authorization: `Bearer ${secretKey || publishableKey}`
  };

  try {
    const schemaRes = await fetch(`${supabaseUrl}/rest/v1/`, { headers: authHeaders });
    if (!schemaRes.ok) {
      console.log(`PostgREST root schema query returned status ${schemaRes.status}`);
    } else {
      const schema = await schemaRes.json();
      const definitions = schema.definitions || {};
      const tables = Object.keys(definitions);
      console.log(`\nDiscovered ${tables.length} tables/views in remote schema:`);
      tables.sort().forEach((t) => {
        const cols = Object.keys(definitions[t].properties || {});
        console.log(`  - ${t} (${cols.length} columns: ${cols.slice(0, 8).join(', ')}${cols.length > 8 ? '...' : ''})`);
      });

      // Check specific tables
      const targetTables = [
        'companies',
        'interview_questions',
        'company_categories',
        'countries',
        'quizzes',
        'quiz_questions',
        'hiring_news',
        'admin_profiles',
        'analytics_events',
        'visitor_sessions',
        'visitor_events',
        'quiz_attempts',
        'feedback_reports',
        'admin_activity_logs',
        'website_settings',
        'admin_questions_view',
        'schema_migrations'
      ];

      console.log('\n--- TARGET TABLE & ROW COUNT AUDIT ---');
      for (const table of targetTables) {
        if (!definitions[table]) {
          console.log(`  [MISSING] ${table} is NOT present in remote schema definitions`);
          continue;
        }

        // Get row count safely
        try {
          const countRes = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*`, {
            headers: {
              ...authHeaders,
              Prefer: 'count=exact',
              Range: '0-0'
            }
          });
          const contentRange = countRes.headers.get('content-range') || '';
          const count = contentRange.split('/')[1] || 'unknown';
          console.log(`  [EXISTS]  ${table} exists (rows: ${count})`);

          // If interview_questions, check if review_status column exists
          if (table === 'interview_questions') {
            const props = definitions[table].properties || {};
            console.log(`            Columns: ${Object.keys(props).join(', ')}`);
            console.log(`            Has review_status column: ${!!props.review_status}`);
            console.log(`            Has review_notes column: ${!!props.review_notes}`);
          }
          if (table === 'admin_profiles') {
            const props = definitions[table].properties || {};
            console.log(`            Columns: ${Object.keys(props).join(', ')}`);
          }
        } catch (e) {
          console.log(`  [EXISTS]  ${table} exists (count query failed: ${e.message})`);
        }
      }
    }
  } catch (err) {
    console.log(`Failed to fetch PostgREST schema: ${err.message}`);
  }

  // Check Supabase Migration History table
  try {
    const migRes = await fetch(`${supabaseUrl}/rest/v1/schema_migrations?select=*`, { headers: authHeaders });
    if (migRes.ok) {
      const migs = await migRes.json();
      console.log('\nRemote Supabase migration records (schema_migrations):', migs);
    } else {
      console.log(`\nRemote schema_migrations table returned HTTP ${migRes.status} (likely hidden in internal schema)`);
    }
  } catch (e) {}
}

audit().catch(console.error);

