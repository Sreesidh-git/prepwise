/**
 * PrepWise Phase 8 — Multi-User Administration & Authorization Test Suite
 *
 * NOTE ON TEST EXECUTION CONTEXT:
 * - Sections 1 and 2 are MOCKED UNIT / INTEGRATION TESTS executing against
 *   Cloudflare Pages Functions and JavaScript runtime modules.
 * - Sections 3 and 4 are STATIC CONTRACT & LOGICAL SIMULATION TESTS verifying
 *   PostgreSQL RLS policies, trigger rules, and bootstrap procedures in SQL files.
 * - ACTUAL REMOTE POSTGRESQL EXECUTION has NOT been performed, preserving
 *   zero-mutation constraints prior to owner authorization.
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
  console.log('\n============================================================');
  console.log('PREPWISE PHASE 8 — SECURE MULTI-USER ADMINISTRATION TESTS');
  console.log('============================================================\n');

  const supabaseShared = await import('../functions/_shared/supabase.js');
  const administratorsMod = await import('../functions/api/admin/administrators.js');
  const overviewMod = await import('../functions/api/admin/overview.js');
  const companiesMod = await import('../functions/api/admin/companies.js');
  const questionsMod = await import('../functions/api/admin/questions.js');

  const OWNER_UID = '11111111-1111-4111-a111-111111111111';
  const ADMIN_UID = '22222222-2222-4222-a222-222222222222';
  const INACTIVE_ADMIN_UID = '33333333-3333-4333-a333-333333333333';
  const ORDINARY_USER_UID = '44444444-4444-4444-a444-444444444444';

  const mockEnv = {
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
    SUPABASE_SECRET_KEY: 'test-secret-key',
    SUPABASE_OWNER_USER_ID: OWNER_UID
  };

  const originalFetch = global.fetch;

  function setMockDatabaseProfiles(profilesMap) {
    global.fetch = async (url, options = {}) => {
      const urlStr = String(url);

      // 1. Supabase Auth token validation
      if (urlStr.includes('/auth/v1/user')) {
        const authHeader = options.headers?.Authorization || '';
        const token = authHeader.replace('Bearer ', '').trim();

        if (token === 'owner-token') {
          return new Response(JSON.stringify({ id: OWNER_UID, email: 'owner@prepwise.com' }), { status: 200 });
        }
        if (token === 'admin-token') {
          return new Response(JSON.stringify({ id: ADMIN_UID, email: 'admin@prepwise.com' }), { status: 200 });
        }
        if (token === 'inactive-admin-token') {
          return new Response(JSON.stringify({ id: INACTIVE_ADMIN_UID, email: 'inactive@prepwise.com' }), { status: 200 });
        }
        if (token === 'ordinary-user-token') {
          return new Response(JSON.stringify({ id: ORDINARY_USER_UID, email: 'user@prepwise.com' }), { status: 200 });
        }
        if (token === 'imposter-token') {
          return new Response(JSON.stringify({ id: '99999999-9999-4999-a999-999999999999', email: 'imposter@prepwise.com' }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: 'invalid_token' }), { status: 401 });
      }

      // 2. PostgREST admin_profiles query
      if (urlStr.includes('/rest/v1/admin_profiles')) {
        if (!options.method || options.method === 'GET') {
          const match = urlStr.match(/user_id=eq\.([a-f0-9-]+)/i);
          if (match) {
            const uid = match[1];
            const p = profilesMap[uid];
            return new Response(JSON.stringify(p ? [p] : []), { status: 200 });
          }
          return new Response(JSON.stringify(Object.values(profilesMap)), { status: 200 });
        }

        if (options.method === 'POST') {
          const body = JSON.parse(options.body || '[]');
          return new Response(JSON.stringify(body), { status: 201 });
        }
        if (options.method === 'PATCH') {
          const body = JSON.parse(options.body || '[]');
          return new Response(JSON.stringify(body), { status: 200 });
        }
        if (options.method === 'DELETE') {
          return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
      }

      // 3. Activity logs mock
      if (urlStr.includes('/rest/v1/admin_activity_logs')) {
        return new Response(JSON.stringify([]), { status: 201 });
      }

      // 4. Targeted Admin user email lookup
      if (urlStr.includes('/auth/v1/admin/users/')) {
        const uid = urlStr.split('/').pop();
        if (uid === OWNER_UID) return new Response(JSON.stringify({ id: OWNER_UID, email: 'owner@prepwise.com' }), { status: 200 });
        if (uid === ADMIN_UID) return new Response(JSON.stringify({ id: ADMIN_UID, email: 'admin@prepwise.com' }), { status: 200 });
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
      }

      return new Response(JSON.stringify([]), { status: 200 });
    };
  }

  const testProfiles = {
    [OWNER_UID]: {
      user_id: OWNER_UID,
      role: 'owner',
      display_name: 'Mohammed Rayyan',
      is_active: true,
      created_at: new Date().toISOString()
    },
    [ADMIN_UID]: {
      user_id: ADMIN_UID,
      role: 'admin',
      display_name: 'Collaborator Sreesidh',
      is_active: true,
      created_at: new Date().toISOString()
    },
    [INACTIVE_ADMIN_UID]: {
      user_id: INACTIVE_ADMIN_UID,
      role: 'admin',
      display_name: 'Deactivated User',
      is_active: false,
      created_at: new Date().toISOString()
    }
  };

  setMockDatabaseProfiles(testProfiles);

  // ==========================================
  // SECTION 1: MOCKED UNIT TESTS — API GATEWAY
  // ==========================================
  console.log('--- 1. MOCKED UNIT TESTS: AUTHENTICATION & ACCESS GATES ---');

  await testAsync('1. Anonymous request to requireAdmin is rejected with HTTP 401', async () => {
    const req = mockRequest('GET', 'http://localhost/api/admin/overview');
    const auth = await supabaseShared.requireAdmin(req, mockEnv);
    assert(auth.response, 'Expected rejection response');
    assert.strictEqual(auth.response.status, 401);
  });

  await testAsync('1b. Anonymous request to requireOwner is rejected with HTTP 401', async () => {
    const req = mockRequest('GET', 'http://localhost/api/admin/administrators');
    const auth = await supabaseShared.requireOwner(req, mockEnv);
    assert(auth.response, 'Expected rejection response');
    assert.strictEqual(auth.response.status, 401);
  });

  await testAsync('2. Forged or expired token is rejected with HTTP 401', async () => {
    const req = mockRequest('GET', 'http://localhost/api/admin/overview', { Authorization: 'Bearer forged-bad-token' });
    const auth = await supabaseShared.requireAdmin(req, mockEnv);
    assert(auth.response, 'Expected rejection response');
    assert.strictEqual(auth.response.status, 401);
  });

  await testAsync('3. Valid Owner can access requireAdmin and is marked as isOwner=true', async () => {
    const req = mockRequest('GET', 'http://localhost/api/admin/overview', { Authorization: 'Bearer owner-token' });
    const auth = await supabaseShared.requireAdmin(req, mockEnv);
    assert.strictEqual(auth.response, undefined);
    assert.strictEqual(auth.role, 'owner');
    assert.strictEqual(auth.isOwner, true);
    assert.strictEqual(auth.user.id, OWNER_UID);
  });

  await testAsync('3b. Valid Owner can access requireOwner', async () => {
    const req = mockRequest('GET', 'http://localhost/api/admin/administrators', { Authorization: 'Bearer owner-token' });
    const auth = await supabaseShared.requireOwner(req, mockEnv);
    assert.strictEqual(auth.response, undefined);
    assert.strictEqual(auth.role, 'owner');
    assert.strictEqual(auth.isOwner, true);
  });

  await testAsync('4. Valid Full Admin can access requireAdmin and is marked as isOwner=false', async () => {
    const req = mockRequest('GET', 'http://localhost/api/admin/overview', { Authorization: 'Bearer admin-token' });
    const auth = await supabaseShared.requireAdmin(req, mockEnv);
    assert.strictEqual(auth.response, undefined);
    assert.strictEqual(auth.role, 'admin');
    assert.strictEqual(auth.isOwner, false);
    assert.strictEqual(auth.user.id, ADMIN_UID);
  });

  await testAsync('5. Inactive Admin is rejected with HTTP 403 (Account is deactivated)', async () => {
    const req = mockRequest('GET', 'http://localhost/api/admin/overview', { Authorization: 'Bearer inactive-admin-token' });
    const auth = await supabaseShared.requireAdmin(req, mockEnv);
    assert(auth.response, 'Expected rejection response');
    assert.strictEqual(auth.response.status, 403);
    const body = await auth.response.json();
    assert.strictEqual(body.error, 'Account is deactivated');
  });

  await testAsync('6. Ordinary Auth user without an admin profile is rejected with HTTP 403', async () => {
    const req = mockRequest('GET', 'http://localhost/api/admin/overview', { Authorization: 'Bearer ordinary-user-token' });
    const auth = await supabaseShared.requireAdmin(req, mockEnv);
    assert(auth.response, 'Expected rejection response');
    assert.strictEqual(auth.response.status, 403);
  });

  await testAsync('7. Full Admin cannot access requireOwner (HTTP 403: Owner access required)', async () => {
    const req = mockRequest('GET', 'http://localhost/api/admin/administrators', { Authorization: 'Bearer admin-token' });
    const auth = await supabaseShared.requireOwner(req, mockEnv);
    assert(auth.response, 'Expected rejection response');
    assert.strictEqual(auth.response.status, 403);
    const body = await auth.response.json();
    assert.strictEqual(body.error, 'Owner access required');
  });

  await testAsync('8. Imposter claiming role=owner without matching SUPABASE_OWNER_USER_ID is rejected', async () => {
    const imposterUid = '99999999-9999-4999-a999-999999999999';
    const originalProfiles = { ...testProfiles };
    testProfiles[imposterUid] = {
      user_id: imposterUid,
      role: 'owner',
      display_name: 'Imposter User',
      is_active: true
    };

    const req = mockRequest('GET', 'http://localhost/api/admin/overview', { Authorization: 'Bearer imposter-token' });
    const auth = await supabaseShared.requireAdmin(req, mockEnv);
    assert(auth.response, 'Expected rejection response');
    assert.strictEqual(auth.response.status, 403);

    delete testProfiles[imposterUid];
  });

  // ==========================================
  // SECTION 2: MOCKED PRIVILEGED API TESTS
  // ==========================================
  console.log('\n--- 2. MOCKED UNIT TESTS: ADMINISTRATOR MANAGEMENT API ---');

  await testAsync('9. Full Admin cannot call GET /api/admin/administrators (HTTP 403)', async () => {
    const req = mockRequest('GET', 'http://localhost/api/admin/administrators', { Authorization: 'Bearer admin-token' });
    const res = await administratorsMod.onRequestGet({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 403);
  });

  await testAsync('10. Full Admin cannot call POST /api/admin/administrators (HTTP 403)', async () => {
    const req = mockRequest('POST', 'http://localhost/api/admin/administrators', { Authorization: 'Bearer admin-token' }, {
      user_id: '55555555-5555-4555-a555-555555555555',
      display_name: 'New Collaborator'
    });
    const res = await administratorsMod.onRequestPost({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 403);
  });

  await testAsync('11. Owner CAN call GET /api/admin/administrators and receive list', async () => {
    const req = mockRequest('GET', 'http://localhost/api/admin/administrators', { Authorization: 'Bearer owner-token' });
    const res = await administratorsMod.onRequestGet({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert(Array.isArray(body.data), 'Expected array of admin profiles');
    assert(body.data.length >= 2, 'Expected at least 2 profiles');
  });

  await testAsync('12. Owner cannot deactivate the Owner profile (HTTP 403)', async () => {
    const req = mockRequest('PATCH', 'http://localhost/api/admin/administrators', { Authorization: 'Bearer owner-token' }, {
      user_id: OWNER_UID,
      is_active: false
    });
    const res = await administratorsMod.onRequestPatch({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error, 'Cannot deactivate the Owner profile.');
  });

  await testAsync('13. Owner cannot demote the Owner profile (HTTP 403)', async () => {
    const req = mockRequest('PATCH', 'http://localhost/api/admin/administrators', { Authorization: 'Bearer owner-token' }, {
      user_id: OWNER_UID,
      role: 'admin'
    });
    const res = await administratorsMod.onRequestPatch({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error, 'Cannot demote the Owner profile.');
  });

  await testAsync('14. Cannot promote an administrator to Owner through API (HTTP 403)', async () => {
    const req = mockRequest('PATCH', 'http://localhost/api/admin/administrators', { Authorization: 'Bearer owner-token' }, {
      user_id: ADMIN_UID,
      role: 'owner'
    });
    const res = await administratorsMod.onRequestPatch({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error, 'Cannot promote administrators to owner.');
  });

  await testAsync('15. Cannot delete the Owner profile (HTTP 403)', async () => {
    const req = mockRequest('DELETE', `http://localhost/api/admin/administrators?user_id=${OWNER_UID}`, { Authorization: 'Bearer owner-token' });
    const res = await administratorsMod.onRequestDelete({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error, 'Cannot remove the Owner profile.');
  });

  await testAsync('16. Owner can create a valid Full Admin profile (HTTP 201)', async () => {
    const newUid = '55555555-5555-4555-a555-555555555555';
    const req = mockRequest('POST', 'http://localhost/api/admin/administrators', { Authorization: 'Bearer owner-token' }, {
      user_id: newUid,
      display_name: 'Collaborator Friend'
    });
    const res = await administratorsMod.onRequestPost({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.role, 'admin');
    assert.strictEqual(body.data.is_active, true);
  });

  await testAsync('17. Owner can deactivate a Full Admin (HTTP 200)', async () => {
    const req = mockRequest('PATCH', 'http://localhost/api/admin/administrators', { Authorization: 'Bearer owner-token' }, {
      user_id: ADMIN_UID,
      is_active: false
    });
    const res = await administratorsMod.onRequestPatch({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
  });

  await testAsync('18. Bootstrap gate: Unauthenticated/empty profiles reject API attempts', async () => {
    setMockDatabaseProfiles({}); // Empty profiles map (bootstrap state)
    const req = mockRequest('GET', 'http://localhost/api/admin/overview', { Authorization: 'Bearer owner-token' });
    const auth = await supabaseShared.requireAdmin(req, mockEnv);
    assert(auth.response, 'Should reject when admin_profiles is empty');
    assert.strictEqual(auth.response.status, 403);
    setMockDatabaseProfiles(testProfiles); // Restore
  });

  // Restore fetch
  global.fetch = originalFetch;

  // ==========================================
  // SECTION 3: CONTRACT VERIFICATION — SQL DDL
  // ==========================================
  console.log('\n--- 3. CONTRACT VERIFICATION: POSTGRESQL RLS & SCHEMA POLICIES ---');

  const migration0006Path = path.join(__dirname, '..', 'supabase', 'migrations', '0006_multi_user_admin_security.sql');
  const sql = fs.readFileSync(migration0006Path, 'utf8');

  test('Migration 0006 file exists locally', () => {
    assert(fs.existsSync(migration0006Path), '0006_multi_user_admin_security.sql does not exist');
  });

  test('Migration 0006 updates is_admin() to include both owner and admin', () => {
    assert(sql.includes("role in ('owner', 'admin')"), 'is_admin() must check both owner and admin');
    assert(sql.includes('is_active = true'), 'is_admin() must require active status');
    assert(sql.includes('security definer'), 'is_admin() must be security definer');
    assert(sql.includes('set search_path = public'), 'is_admin() must set safe search_path');
  });

  test('Migration 0006 defines is_owner() to strictly identify active owner', () => {
    assert(sql.includes('create or replace function public.is_owner()'), 'is_owner() function missing');
    assert(sql.includes("role = 'owner'"), 'is_owner() must check role = owner');
    assert(sql.includes('is_active = true'), 'is_owner() must check active status');
    assert(sql.includes('security definer'), 'is_owner() must be security definer');
    assert(sql.includes('set search_path = public'), 'is_owner() must set safe search_path');
  });

  test('Migration 0006 defines non-recursive admin_profiles_select policy', () => {
    assert(sql.includes('create policy admin_profiles_select on public.admin_profiles'), 'select policy missing');
    assert(sql.includes('user_id = auth.uid()'), 'select policy must include non-recursive own-row check');
    assert(sql.includes('public.is_admin()'), 'select policy must include is_admin()');
  });

  test('Migration 0006 restricts admin_profiles mutations strictly to is_owner()', () => {
    assert(sql.includes('create policy admin_profiles_insert on public.admin_profiles'), 'insert policy missing');
    assert(sql.includes('with check (public.is_owner())'), 'insert must check is_owner()');
    assert(sql.includes('create policy admin_profiles_update on public.admin_profiles'), 'update policy missing');
    assert(sql.includes('using (public.is_owner())'), 'update using must check is_owner()');
    assert(sql.includes('with check (public.is_owner())'), 'update with check must check is_owner()');
    assert(sql.includes('create policy admin_profiles_delete on public.admin_profiles'), 'delete policy missing');
    assert(sql.includes('using (public.is_owner())'), 'delete using must check is_owner()');
  });

  // ==========================================
  // SECTION 4: SIMULATION OF TRIGGER & BOOTSTRAP
  // ==========================================
  console.log('\n--- 4. SIMULATION: BOOTSTRAP MECHANISM & INVARIANT TRIGGERS ---');

  // Exact trigger logic simulated in JS for deterministic testing of edge conditions
  function simulateEnforceAdminSecurity(tg_op, oldRow, newRow, context) {
    const { existingOwnersCount, isOwner, currentUser, authRole, authUsersList } = context;

    if (tg_op === 'INSERT') {
      if (newRow.role === 'owner') {
        if (existingOwnersCount > 0) {
          if (!isOwner && !['postgres', 'supabase_admin'].includes(currentUser)) {
            throw new Error('An owner profile already exists. Only an existing active owner can assign the owner role.');
          }
        } else {
          // Bootstrap state
          if (authRole === 'authenticated') {
            throw new Error('Initial owner bootstrap is prohibited through client API. Execute via trusted Supabase SQL Editor.');
          }
          if (!authUsersList.includes(newRow.user_id)) {
            throw new Error(`Target user_id ${newRow.user_id} does not exist in auth.users. Create the Auth user first.`);
          }
        }
      }
    } else if (tg_op === 'UPDATE') {
      if (oldRow.role === 'owner' && (newRow.role !== 'owner' || newRow.is_active !== true)) {
        throw new Error('The owner account cannot be demoted or deactivated.');
      }
      if (oldRow.role === 'owner' && newRow.user_id !== oldRow.user_id) {
        if (!['postgres', 'supabase_admin'].includes(currentUser)) {
          throw new Error('The owner user ID can only be reassigned by database administrators in the SQL Editor.');
        }
      }
      if (newRow.role === 'owner' && oldRow.role !== 'owner') {
        if (!isOwner && !['postgres', 'supabase_admin'].includes(currentUser)) {
          throw new Error('Only an existing active owner or database administrator can promote a user to owner.');
        }
      }
      if (oldRow.role === 'admin' && (newRow.role !== oldRow.role || newRow.is_active !== oldRow.is_active)) {
        if (!isOwner && !['postgres', 'supabase_admin'].includes(currentUser)) {
          throw new Error('Administrators cannot alter administrative roles or active status.');
        }
      }
    }
    return newRow;
  }

  function simulatePreventOwnerDeletion(oldRow) {
    if (oldRow.role === 'owner') {
      throw new Error('The owner account profile cannot be deleted.');
    }
  }

  test('Simulated Trigger: Initial Owner bootstrap succeeds in SQL Editor (postgres role)', () => {
    const context = {
      existingOwnersCount: 0,
      isOwner: false,
      currentUser: 'postgres',
      authRole: null,
      authUsersList: [OWNER_UID]
    };
    const newRow = { user_id: OWNER_UID, role: 'owner', display_name: 'Mohammed Rayyan', is_active: true };
    const res = simulateEnforceAdminSecurity('INSERT', null, newRow, context);
    assert.strictEqual(res.role, 'owner');
  });

  test('Simulated Trigger: Initial Owner bootstrap fails when attempted via client API (authenticated role)', () => {
    const context = {
      existingOwnersCount: 0,
      isOwner: false,
      currentUser: 'authenticated',
      authRole: 'authenticated',
      authUsersList: [OWNER_UID]
    };
    const newRow = { user_id: OWNER_UID, role: 'owner', display_name: 'Mohammed Rayyan', is_active: true };
    assert.throws(
      () => simulateEnforceAdminSecurity('INSERT', null, newRow, context),
      /Initial owner bootstrap is prohibited through client API/
    );
  });

  test('Simulated Trigger: Initial Owner bootstrap fails if user does not exist in auth.users', () => {
    const context = {
      existingOwnersCount: 0,
      isOwner: false,
      currentUser: 'postgres',
      authRole: null,
      authUsersList: [] // Empty Auth users
    };
    const newRow = { user_id: 'unknown-uuid', role: 'owner', display_name: 'Fake', is_active: true };
    assert.throws(
      () => simulateEnforceAdminSecurity('INSERT', null, newRow, context),
      /does not exist in auth\.users/
    );
  });

  test('Simulated Trigger: Existing Owner cannot be demoted (UPDATE error)', () => {
    const context = { existingOwnersCount: 1, isOwner: true, currentUser: 'postgres', authRole: null, authUsersList: [OWNER_UID] };
    const oldRow = { user_id: OWNER_UID, role: 'owner', is_active: true };
    const newRow = { user_id: OWNER_UID, role: 'admin', is_active: true };
    assert.throws(
      () => simulateEnforceAdminSecurity('UPDATE', oldRow, newRow, context),
      /The owner account cannot be demoted or deactivated/
    );
  });

  test('Simulated Trigger: Existing Owner cannot be deactivated (UPDATE error)', () => {
    const context = { existingOwnersCount: 1, isOwner: true, currentUser: 'postgres', authRole: null, authUsersList: [OWNER_UID] };
    const oldRow = { user_id: OWNER_UID, role: 'owner', is_active: true };
    const newRow = { user_id: OWNER_UID, role: 'owner', is_active: false };
    assert.throws(
      () => simulateEnforceAdminSecurity('UPDATE', oldRow, newRow, context),
      /The owner account cannot be demoted or deactivated/
    );
  });

  test('Simulated Trigger: Existing Owner cannot be deleted (DELETE error)', () => {
    const oldRow = { user_id: OWNER_UID, role: 'owner', is_active: true };
    assert.throws(
      () => simulatePreventOwnerDeletion(oldRow),
      /The owner account profile cannot be deleted/
    );
  });

  test('Simulated Trigger: Admin cannot promote themselves to Owner', () => {
    const context = { existingOwnersCount: 1, isOwner: false, currentUser: 'authenticated', authRole: 'authenticated', authUsersList: [OWNER_UID, ADMIN_UID] };
    const oldRow = { user_id: ADMIN_UID, role: 'admin', is_active: true };
    const newRow = { user_id: ADMIN_UID, role: 'owner', is_active: true };
    assert.throws(
      () => simulateEnforceAdminSecurity('UPDATE', oldRow, newRow, context),
      /Only an existing active owner or database administrator can promote a user to owner/
    );
  });

  test('Simulated Trigger: Admin cannot modify another admin or alter status', () => {
    const context = { existingOwnersCount: 1, isOwner: false, currentUser: 'authenticated', authRole: 'authenticated', authUsersList: [OWNER_UID, ADMIN_UID, INACTIVE_ADMIN_UID] };
    const oldRow = { user_id: INACTIVE_ADMIN_UID, role: 'admin', is_active: false };
    const newRow = { user_id: INACTIVE_ADMIN_UID, role: 'admin', is_active: true };
    assert.throws(
      () => simulateEnforceAdminSecurity('UPDATE', oldRow, newRow, context),
      /Administrators cannot alter administrative roles or active status/
    );
  });

  test('Migration 0006 includes explicit bootstrap_initial_owner with narrow postgres-only grant', () => {
    assert(sql.includes('create or replace function public.bootstrap_initial_owner'), 'bootstrap_initial_owner missing');
    assert(sql.includes('An owner profile already exists. Bootstrap procedure can only be run once'), 'Idempotency guard missing');
    assert(sql.includes('grant execute on function public.bootstrap_initial_owner(uuid, text) to postgres;'), 'Postgres-only permission grant missing');
    assert(sql.includes('revoke all on function public.bootstrap_initial_owner(uuid, text) from anon, authenticated, service_role;'), 'Anon, authenticated, and service_role revoke missing');
  });

  test('Migration 0006 includes audited emergency_rebind_owner procedure', () => {
    assert(sql.includes('create or replace function public.emergency_rebind_owner'), 'emergency_rebind_owner missing');
    assert(sql.includes('grant execute on function public.emergency_rebind_owner(uuid, text) to postgres;'), 'Postgres-only permission grant missing');
    assert(sql.includes('revoke all on function public.emergency_rebind_owner(uuid, text) from anon, authenticated, service_role;'), 'Anon, authenticated, and service_role revoke missing');
    assert(sql.includes("'emergency_owner_rebind'"), 'Audit log action name missing');
    assert(sql.includes('entity_type'), 'Audit insert must use entity_type (not target_resource)');
    assert(sql.includes('entity_id'), 'Audit insert must use entity_id (not target_id)');
  });

  // Simulation of emergency rebind logic (matches corrected 0006 function)
  function simulateEmergencyRebind(newOwnerUid, newDisplayName, context) {
    const { currentUser, authUsersList, profiles, auditLog } = context;
    if (!['postgres', 'supabase_admin'].includes(currentUser)) {
      throw new Error('Emergency rebind is strictly restricted to database superusers in the SQL Editor.');
    }
    if (!authUsersList.includes(newOwnerUid)) {
      throw new Error(`Target user ID ${newOwnerUid} does not exist in auth.users. Create the Auth user first.`);
    }
    const currentOwner = Object.values(profiles).find(p => p.role === 'owner');
    const oldOwnerId = currentOwner ? currentOwner.user_id : null;

    if (oldOwnerId === null) {
      // No owner exists — delegate to bootstrap
      profiles[newOwnerUid] = {
        user_id: newOwnerUid,
        role: 'owner',
        display_name: newDisplayName || 'Mohammed Rayyan',
        is_active: true
      };
      return { action: 'bootstrap_delegated', new_owner_id: newOwnerUid };
    }

    if (oldOwnerId === newOwnerUid) {
      // Same user — just reactivate and optionally update display name
      profiles[newOwnerUid].is_active = true;
      if (newDisplayName) profiles[newOwnerUid].display_name = newDisplayName;
      return { action: 'same_user_reactivated', owner_id: newOwnerUid };
    }

    // If a profile already exists for the new UUID (e.g. as admin), remove it first
    // prevent_owner_profile_deletion trigger: only blocks if old.role = 'owner'
    if (profiles[newOwnerUid]) {
      if (profiles[newOwnerUid].role === 'owner') {
        throw new Error('The owner account profile cannot be deleted.');
      }
      delete profiles[newOwnerUid];
    }

    // Rebind: update owner row's user_id (PK update)
    const ownerProfile = profiles[oldOwnerId];
    delete profiles[oldOwnerId];
    ownerProfile.user_id = newOwnerUid;
    ownerProfile.display_name = newDisplayName || ownerProfile.display_name;
    ownerProfile.is_active = true;
    profiles[newOwnerUid] = ownerProfile;

    // Audit log (uses corrected column names: entity_type, entity_id, metadata)
    const entry = {
      admin_user_id: newOwnerUid,
      action: 'emergency_owner_rebind',
      entity_type: 'admin_profiles',
      entity_id: newOwnerUid,
      metadata: {
        previous_owner_id: oldOwnerId,
        new_owner_id: newOwnerUid,
        executed_by: currentUser,
        timestamp: new Date().toISOString()
      }
    };
    if (auditLog) auditLog.push(entry);

    return {
      action: 'emergency_owner_rebind',
      previous_owner_id: oldOwnerId,
      new_owner_id: newOwnerUid,
      executed_by: currentUser
    };
  }

  test('Simulated Recovery: Emergency rebind fails when executed by non-superuser (authenticated)', () => {
    const context = { currentUser: 'authenticated', authUsersList: ['new-uid'], profiles: { [OWNER_UID]: { user_id: OWNER_UID, role: 'owner', is_active: true } } };
    assert.throws(
      () => simulateEmergencyRebind('new-uid', null, context),
      /Emergency rebind is strictly restricted to database superusers/
    );
  });

  test('Simulated Recovery: Emergency rebind fails if new owner does not exist in auth.users', () => {
    const context = { currentUser: 'postgres', authUsersList: [OWNER_UID], profiles: { [OWNER_UID]: { user_id: OWNER_UID, role: 'owner', is_active: true } } };
    assert.throws(
      () => simulateEmergencyRebind('non-existent-uid', null, context),
      /does not exist in auth\.users/
    );
  });

  test('Simulated Recovery: Emergency rebind successfully reassigns owner profile and generates audit entry', () => {
    const newOwnerUid = '88888888-8888-4888-a888-888888888888';
    const mockProfiles = { [OWNER_UID]: { user_id: OWNER_UID, role: 'owner', is_active: true, display_name: 'Mohammed Rayyan' } };
    const auditLog = [];
    const context = { currentUser: 'postgres', authUsersList: [OWNER_UID, newOwnerUid], profiles: mockProfiles, auditLog };
    const audit = simulateEmergencyRebind(newOwnerUid, 'New Owner', context);
    assert.strictEqual(audit.action, 'emergency_owner_rebind');
    assert.strictEqual(audit.previous_owner_id, OWNER_UID);
    assert.strictEqual(audit.new_owner_id, newOwnerUid);
    assert.strictEqual(mockProfiles[newOwnerUid].role, 'owner');
    assert.strictEqual(mockProfiles[newOwnerUid].display_name, 'New Owner');
    assert.strictEqual(mockProfiles[OWNER_UID], undefined);
    assert.strictEqual(auditLog.length, 1);
    assert.strictEqual(auditLog[0].entity_type, 'admin_profiles');
    assert.strictEqual(auditLog[0].entity_id, newOwnerUid);
  });

  // --- Phase 8C: Comprehensive Emergency Rebind Edge Cases ---
  console.log('\n--- 4b. PHASE 8C: EMERGENCY REBIND EDGE CASES ---');

  test('Rebind Scenario 1: Replacement Auth user has NO existing profile', () => {
    const NEW_UUID = 'aaaa1111-1111-4111-a111-111111111111';
    const mockProfiles = { [OWNER_UID]: { user_id: OWNER_UID, role: 'owner', is_active: true, display_name: 'Mohammed Rayyan' } };
    const auditLog = [];
    const context = { currentUser: 'postgres', authUsersList: [OWNER_UID, NEW_UUID], profiles: mockProfiles, auditLog };
    const result = simulateEmergencyRebind(NEW_UUID, 'Replacement Owner', context);
    assert.strictEqual(result.action, 'emergency_owner_rebind');
    assert.strictEqual(result.previous_owner_id, OWNER_UID);
    assert.strictEqual(mockProfiles[NEW_UUID].role, 'owner');
    assert.strictEqual(mockProfiles[NEW_UUID].is_active, true);
    assert.strictEqual(mockProfiles[OWNER_UID], undefined, 'Old owner profile should be removed');
    assert.strictEqual(auditLog.length, 1, 'Audit log should have exactly 1 entry');
  });

  test('Rebind Scenario 2: Replacement Auth user ALREADY has an admin profile', () => {
    const NEW_UUID = 'bbbb2222-2222-4222-a222-222222222222';
    const mockProfiles = {
      [OWNER_UID]: { user_id: OWNER_UID, role: 'owner', is_active: true, display_name: 'Mohammed Rayyan' },
      [NEW_UUID]: { user_id: NEW_UUID, role: 'admin', is_active: true, display_name: 'Existing Admin' }
    };
    const auditLog = [];
    const context = { currentUser: 'postgres', authUsersList: [OWNER_UID, NEW_UUID], profiles: mockProfiles, auditLog };
    // Should delete existing admin profile for NEW_UUID, then rebind owner PK
    const result = simulateEmergencyRebind(NEW_UUID, null, context);
    assert.strictEqual(result.action, 'emergency_owner_rebind');
    assert.strictEqual(mockProfiles[NEW_UUID].role, 'owner', 'New UUID should now be owner');
    assert.strictEqual(mockProfiles[OWNER_UID], undefined, 'Old owner should be gone');
    assert.strictEqual(Object.keys(mockProfiles).length, 1, 'Exactly 1 profile remaining');
    assert.strictEqual(auditLog.length, 1);
  });

  test('Rebind Scenario 3: Existing owner profile is ACTIVE (standard path)', () => {
    const NEW_UUID = 'cccc3333-3333-4333-a333-333333333333';
    const mockProfiles = { [OWNER_UID]: { user_id: OWNER_UID, role: 'owner', is_active: true, display_name: 'Active Owner' } };
    const auditLog = [];
    const context = { currentUser: 'postgres', authUsersList: [OWNER_UID, NEW_UUID], profiles: mockProfiles, auditLog };
    const result = simulateEmergencyRebind(NEW_UUID, 'New Active Owner', context);
    assert.strictEqual(result.action, 'emergency_owner_rebind');
    assert.strictEqual(mockProfiles[NEW_UUID].role, 'owner');
    assert.strictEqual(mockProfiles[NEW_UUID].is_active, true);
  });

  test('Rebind Scenario 4: Existing owner profile is INACTIVE (theoretical edge case)', () => {
    const NEW_UUID = 'dddd4444-4444-4444-a444-444444444444';
    // is_active=false should be impossible due to trigger guards, but test emergency path handles it
    const mockProfiles = { [OWNER_UID]: { user_id: OWNER_UID, role: 'owner', is_active: false, display_name: 'Inactive Owner' } };
    const auditLog = [];
    const context = { currentUser: 'postgres', authUsersList: [OWNER_UID, NEW_UUID], profiles: mockProfiles, auditLog };
    const result = simulateEmergencyRebind(NEW_UUID, null, context);
    assert.strictEqual(result.action, 'emergency_owner_rebind');
    assert.strictEqual(mockProfiles[NEW_UUID].role, 'owner');
    assert.strictEqual(mockProfiles[NEW_UUID].is_active, true, 'Rebind should reactivate the profile');
    assert.strictEqual(auditLog.length, 1);
  });

  test('Rebind Scenario 5: NO owner profile exists (routes to bootstrap)', () => {
    const NEW_UUID = 'eeee5555-5555-4555-a555-555555555555';
    const mockProfiles = {}; // Empty — no owner
    const context = { currentUser: 'postgres', authUsersList: [NEW_UUID], profiles: mockProfiles };
    const result = simulateEmergencyRebind(NEW_UUID, 'Bootstrap Owner', context);
    assert.strictEqual(result.action, 'bootstrap_delegated');
    assert.strictEqual(result.new_owner_id, NEW_UUID);
    assert.strictEqual(mockProfiles[NEW_UUID].role, 'owner');
    assert.strictEqual(mockProfiles[NEW_UUID].is_active, true);
  });

  test('Rebind Scenario 6: New Auth UUID does NOT exist — transaction should fail cleanly', () => {
    const mockProfiles = { [OWNER_UID]: { user_id: OWNER_UID, role: 'owner', is_active: true } };
    const context = { currentUser: 'postgres', authUsersList: [OWNER_UID], profiles: mockProfiles };
    assert.throws(
      () => simulateEmergencyRebind('non-existent-uuid', null, context),
      /does not exist in auth\.users/
    );
    // Verify no state was mutated (simulating transactional rollback)
    assert.strictEqual(mockProfiles[OWNER_UID].role, 'owner', 'Original owner should be unchanged after failure');
    assert.strictEqual(mockProfiles['non-existent-uuid'], undefined, 'No phantom profile should exist');
  });

  test('Rebind: Same user rebind reactivates without creating audit log', () => {
    const mockProfiles = { [OWNER_UID]: { user_id: OWNER_UID, role: 'owner', is_active: false, display_name: 'Mohammed Rayyan' } };
    const auditLog = [];
    const context = { currentUser: 'postgres', authUsersList: [OWNER_UID], profiles: mockProfiles, auditLog };
    const result = simulateEmergencyRebind(OWNER_UID, 'Updated Name', context);
    assert.strictEqual(result.action, 'same_user_reactivated');
    assert.strictEqual(mockProfiles[OWNER_UID].is_active, true, 'Should be reactivated');
    assert.strictEqual(mockProfiles[OWNER_UID].display_name, 'Updated Name');
    assert.strictEqual(auditLog.length, 0, 'Same-user rebind should not produce audit entry');
  });

  // --- Migration 0006 column name correctness check ---
  console.log('\n--- 4c. MIGRATION 0006 AUDIT LOG COLUMN CORRECTNESS ---');

  test('Migration 0006 emergency_rebind_owner uses correct admin_activity_logs column names', () => {
    // The admin_activity_logs table (0001) has: admin_user_id, action, entity_type, entity_id (uuid), metadata (jsonb)
    // Migration 0006 must NOT use: target_resource, target_id, details (wrong column names)
    assert(sql.includes('entity_type'), 'emergency_rebind_owner must use entity_type column');
    assert(sql.includes('entity_id'), 'emergency_rebind_owner must use entity_id column');
    assert(sql.includes('metadata'), 'emergency_rebind_owner must use metadata column');
    assert(!sql.includes('target_resource'), 'emergency_rebind_owner must NOT reference non-existent target_resource');
    assert(!sql.includes('target_id'), 'emergency_rebind_owner must NOT reference non-existent target_id');
    // 'details' might appear in comments, but NOT as a column reference in the INSERT
    const insertBlock = sql.substring(sql.indexOf('insert into public.admin_activity_logs'));
    assert(!insertBlock.includes('details'), 'INSERT into admin_activity_logs must NOT use non-existent details column');
  });

  test('Migration 0006 emergency_rebind_owner entity_id uses uuid (not text cast)', () => {
    const insertBlock = sql.substring(sql.indexOf('insert into public.admin_activity_logs'));
    assert(!insertBlock.includes('::text'), 'entity_id is uuid — no text cast needed');
  });

  // --- Phase 8D: Auth Deletion, Foreign Key & Recovery Consistency ---
  console.log('\n--- 4d. PHASE 8D: AUTH DELETION, CASCADE & RECOVERY CONSISTENCY ---');

  test('Migration 0006 prevents owner user_id reassignments by non-superusers', () => {
    assert(sql.includes('new.user_id != old.user_id'), 'Trigger must check for user_id reassignments');
    assert(sql.includes("current_user not in ('postgres', 'supabase_admin')"), 'user_id reassignment must be superuser only');
  });

  test('Simulated Trigger: Ordinary caller cannot alter owner user_id via UPDATE', () => {
    const context = { existingOwnersCount: 1, isOwner: true, currentUser: 'authenticated', authRole: 'authenticated', authUsersList: [OWNER_UID] };
    const oldRow = { user_id: OWNER_UID, role: 'owner', is_active: true };
    const newRow = { user_id: '99999999-9999-4999-a999-999999999999', role: 'owner', is_active: true };
    assert.throws(
      () => simulateEnforceAdminSecurity('UPDATE', oldRow, newRow, context),
      /The owner user ID can only be reassigned by database administrators/
    );
  });

  // PostgreSQL Engine Simulator: foreign keys + cascading deletes + before-delete triggers + transactions
  function createPostgreSQLEngine(initialState) {
    let authUsers = new Set(initialState.authUsers || []);
    let adminProfiles = JSON.parse(JSON.stringify(initialState.adminProfiles || {}));
    let auditLogs = JSON.parse(JSON.stringify(initialState.auditLogs || []));

    return {
      getAuthUsers: () => Array.from(authUsers),
      getProfiles: () => adminProfiles,
      getAuditLogs: () => auditLogs,

      // Simulates: DELETE FROM auth.users WHERE id = uid;
      deleteAuthUser: (uid) => {
        if (!authUsers.has(uid)) return false;

        // Foreign key ON DELETE CASCADE activates on public.admin_profiles
        if (adminProfiles[uid]) {
          const profile = adminProfiles[uid];
          // BEFORE DELETE trigger (prevent_owner_profile_deletion)
          if (profile.role === 'owner') {
            throw new Error('The owner account profile cannot be deleted.');
          }
          // If admin, cascade delete proceeds
          delete adminProfiles[uid];
        }

        authUsers.delete(uid);
        return true;
      },

      // Simulates direct: DELETE FROM public.admin_profiles WHERE user_id = uid;
      deleteAdminProfile: (uid) => {
        if (!adminProfiles[uid]) return false;
        const profile = adminProfiles[uid];
        if (profile.role === 'owner') {
          throw new Error('The owner account profile cannot be deleted.');
        }
        delete adminProfiles[uid];
        return true;
      },

      // Simulates: SELECT public.emergency_rebind_owner(newUid, displayName);
      emergencyRebindOwner: (newUid, displayName = null, currentUser = 'postgres', simulateAuditFailure = false) => {
        const snapshotAuth = new Set(authUsers);
        const snapshotProfiles = JSON.parse(JSON.stringify(adminProfiles));
        const snapshotLogs = JSON.parse(JSON.stringify(auditLogs));

        try {
          if (!['postgres', 'supabase_admin'].includes(currentUser)) {
            throw new Error('Emergency rebind is strictly restricted to database superusers in the SQL Editor.');
          }
          if (!authUsers.has(newUid)) {
            throw new Error(`Target user ID ${newUid} does not exist in auth.users. Create the Auth user first.`);
          }

          const currentOwner = Object.values(adminProfiles).find(p => p.role === 'owner');
          const oldOwnerId = currentOwner ? currentOwner.user_id : null;

          if (!oldOwnerId) {
            adminProfiles[newUid] = { user_id: newUid, role: 'owner', display_name: displayName || 'Mohammed Rayyan', is_active: true };
            return { action: 'bootstrap' };
          }

          if (oldOwnerId === newUid) {
            adminProfiles[newUid].is_active = true;
            if (displayName) adminProfiles[newUid].display_name = displayName;
            return { action: 'reactivated' };
          }

          // Step 4: Remove any existing profile for newUid (if admin)
          if (adminProfiles[newUid]) {
            if (adminProfiles[newUid].role === 'owner') {
              throw new Error('The owner account profile cannot be deleted.');
            }
            delete adminProfiles[newUid];
          }

          // Step 5: Primary key update
          const ownerRow = adminProfiles[oldOwnerId];
          delete adminProfiles[oldOwnerId];
          ownerRow.user_id = newUid;
          if (displayName) ownerRow.display_name = displayName;
          ownerRow.is_active = true;
          adminProfiles[newUid] = ownerRow;

          // Step 6: Audit log insert
          if (simulateAuditFailure) {
            throw new Error('Simulated database error during activity log insert');
          }

          auditLogs.push({
            admin_user_id: newUid,
            action: 'emergency_owner_rebind',
            entity_type: 'admin_profiles',
            entity_id: newUid,
            metadata: {
              previous_owner_id: oldOwnerId,
              new_owner_id: newUid,
              executed_by: currentUser,
              timestamp: new Date().toISOString()
            }
          });

          return { action: 'rebound', previous_owner_id: oldOwnerId, new_owner_id: newUid };
        } catch (err) {
          // Transaction aborts & rolls back
          authUsers = snapshotAuth;
          adminProfiles = snapshotProfiles;
          auditLogs = snapshotLogs;
          throw err;
        }
      }
    };
  }

  test('PostgreSQL Engine: Owner Auth deletion with cascade is blocked by deletion trigger', () => {
    const db = createPostgreSQLEngine({
      authUsers: [OWNER_UID],
      adminProfiles: { [OWNER_UID]: { user_id: OWNER_UID, role: 'owner', is_active: true, display_name: 'Mohammed Rayyan' } }
    });

    assert.throws(
      () => db.deleteAuthUser(OWNER_UID),
      /The owner account profile cannot be deleted/
    );

    // Verify both Auth user and profile remain intact
    assert(db.getAuthUsers().includes(OWNER_UID), 'Owner Auth user must not be deleted');
    assert(db.getProfiles()[OWNER_UID], 'Owner profile must not be deleted');
  });

  test('PostgreSQL Engine: Owner profile direct deletion is blocked by deletion trigger', () => {
    const db = createPostgreSQLEngine({
      authUsers: [OWNER_UID],
      adminProfiles: { [OWNER_UID]: { user_id: OWNER_UID, role: 'owner', is_active: true } }
    });

    assert.throws(
      () => db.deleteAdminProfile(OWNER_UID),
      /The owner account profile cannot be deleted/
    );
    assert(db.getProfiles()[OWNER_UID], 'Owner profile must remain');
  });

  test('PostgreSQL Engine: Replacement Auth account provisioning does not mutate admin_profiles', () => {
    const NEW_UID = '77777777-7777-4777-a777-777777777777';
    const db = createPostgreSQLEngine({
      authUsers: [OWNER_UID],
      adminProfiles: { [OWNER_UID]: { user_id: OWNER_UID, role: 'owner', is_active: true } }
    });

    // Simulates creating new Auth account
    db.getAuthUsers().push(NEW_UID);

    assert.strictEqual(db.getProfiles()[OWNER_UID].role, 'owner');
    assert.strictEqual(db.getProfiles()[NEW_UID], undefined, 'New user has no profile initially');
  });

  test('PostgreSQL Engine: Emergency rebind cleanly transfers owner profile to replacement user and generates atomic audit log', () => {
    const RECOVERY_UID = '77777777-7777-4777-a777-777777777777';
    const db = createPostgreSQLEngine({
      authUsers: [OWNER_UID, RECOVERY_UID],
      adminProfiles: { [OWNER_UID]: { user_id: OWNER_UID, role: 'owner', is_active: true, display_name: 'Mohammed Rayyan' } }
    });

    const res = db.emergencyRebindOwner(RECOVERY_UID, 'Mohammed Rayyan Recovered');
    assert.strictEqual(res.action, 'rebound');
    assert.strictEqual(res.previous_owner_id, OWNER_UID);
    assert.strictEqual(res.new_owner_id, RECOVERY_UID);

    // Profile now belongs to RECOVERY_UID
    assert.strictEqual(db.getProfiles()[RECOVERY_UID].role, 'owner');
    assert.strictEqual(db.getProfiles()[RECOVERY_UID].display_name, 'Mohammed Rayyan Recovered');
    assert.strictEqual(db.getProfiles()[OWNER_UID], undefined, 'Old owner profile unlinked');

    // Audit log recorded
    assert.strictEqual(db.getAuditLogs().length, 1);
    assert.strictEqual(db.getAuditLogs()[0].entity_type, 'admin_profiles');
    assert.strictEqual(db.getAuditLogs()[0].entity_id, RECOVERY_UID);
  });

  test('PostgreSQL Engine: Deletion of old Auth user AFTER emergency rebind succeeds cleanly', () => {
    const RECOVERY_UID = '77777777-7777-4777-a777-777777777777';
    const db = createPostgreSQLEngine({
      authUsers: [OWNER_UID, RECOVERY_UID],
      adminProfiles: { [OWNER_UID]: { user_id: OWNER_UID, role: 'owner', is_active: true } }
    });

    // 1. Rebind owner to new UUID
    db.emergencyRebindOwner(RECOVERY_UID);

    // 2. Now old OWNER_UID is no longer referenced by admin_profiles
    const deleted = db.deleteAuthUser(OWNER_UID);
    assert.strictEqual(deleted, true);
    assert(!db.getAuthUsers().includes(OWNER_UID), 'Old Auth user now successfully deleted');
    assert.strictEqual(db.getProfiles()[RECOVERY_UID].role, 'owner', 'New owner profile intact');
  });

  test('PostgreSQL Engine: Rollback if audit logging fails during emergency rebind', () => {
    const RECOVERY_UID = '77777777-7777-4777-a777-777777777777';
    const db = createPostgreSQLEngine({
      authUsers: [OWNER_UID, RECOVERY_UID],
      adminProfiles: { [OWNER_UID]: { user_id: OWNER_UID, role: 'owner', is_active: true, display_name: 'Mohammed Rayyan' } }
    });

    // Execute with simulated audit log failure
    assert.throws(
      () => db.emergencyRebindOwner(RECOVERY_UID, 'New Name', 'postgres', true),
      /Simulated database error during activity log insert/
    );

    // Verify entire transaction rolled back: original owner remains, no orphan created
    assert.strictEqual(db.getProfiles()[OWNER_UID].role, 'owner');
    assert.strictEqual(db.getProfiles()[OWNER_UID].display_name, 'Mohammed Rayyan');
    assert.strictEqual(db.getProfiles()[RECOVERY_UID], undefined, 'No partial rebind');
    assert.strictEqual(db.getAuditLogs().length, 0, 'No dangling audit log');
  });

  test('PostgreSQL Engine: Admin Auth deletion successfully cascades to delete admin profile', () => {
    const db = createPostgreSQLEngine({
      authUsers: [OWNER_UID, ADMIN_UID],
      adminProfiles: {
        [OWNER_UID]: { user_id: OWNER_UID, role: 'owner', is_active: true },
        [ADMIN_UID]: { user_id: ADMIN_UID, role: 'admin', is_active: true, display_name: 'Collaborator' }
      }
    });

    // Deleting admin from auth.users cascades to admin_profiles
    const deleted = db.deleteAuthUser(ADMIN_UID);
    assert.strictEqual(deleted, true);
    assert(!db.getAuthUsers().includes(ADMIN_UID), 'Admin user deleted from auth.users');
    assert.strictEqual(db.getProfiles()[ADMIN_UID], undefined, 'Admin profile deleted via cascade');
    assert.strictEqual(db.getProfiles()[OWNER_UID].role, 'owner', 'Owner unaffected');
  });

  test('PostgreSQL Engine: Direct deletion of admin profile succeeds while preserving Auth user', () => {
    const db = createPostgreSQLEngine({
      authUsers: [OWNER_UID, ADMIN_UID],
      adminProfiles: {
        [OWNER_UID]: { user_id: OWNER_UID, role: 'owner', is_active: true },
        [ADMIN_UID]: { user_id: ADMIN_UID, role: 'admin', is_active: true }
      }
    });

    // Deleting admin profile directly (e.g. from Admin UI)
    const deleted = db.deleteAdminProfile(ADMIN_UID);
    assert.strictEqual(deleted, true);
    assert.strictEqual(db.getProfiles()[ADMIN_UID], undefined, 'Admin profile removed');
    assert(db.getAuthUsers().includes(ADMIN_UID), 'Auth user remains in auth.users');
  });

  // ==========================================
  // SECTION 5: PUBLIC ACCESS INTEGRITY
  // ==========================================
  console.log('\n--- 5. PUBLIC ACCESS INTEGRITY ---');

  test('Public routes require no authentication or login scripts', () => {
    const publicPages = ['index.html', 'about.html', 'company.html', 'quiz.html'];
    for (const page of publicPages) {
      const content = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
      assert(!content.includes('supabase.auth.signIn'), `Public page ${page} should not require login`);
      assert(!content.includes('requireAdmin'), `Public page ${page} should not contain admin authorization logic`);
    }
  });

  console.log('\n============================================================');
  console.log(`PHASE 8D AUDIT SUMMARY: ${passedTests}/${totalTests} tests passed.`);
  console.log('============================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
})();
