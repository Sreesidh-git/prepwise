/**
 * PrepWise Admin Panel Audit & Repair Verification Test Suite
 *
 * Verifies:
 * 1. Administrators tab panel and form visibility (no illegal hidden attribute)
 * 2. Role assignment selector in Administrator Creation form
 * 3. Dedicated empty states and tables for Feedback, Website Settings, and Activity Logs
 * 4. Website Settings primary key handling and mutation in [resource].js
 * 5. Robust activity logging (safe non-UUID entity fallback)
 * 6. Owner-only API security enforcement on administrators endpoint
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
let total = 0;

function test(description, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✓ ${description}`);
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${err.message}`);
  }
}

async function testAsync(description, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${description}`);
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${err.message}`);
  }
}

(async () => {
  console.log('\n============================================================');
  console.log('PREPWISE ADMIN PANEL AUDIT & REPAIR VERIFICATION');
  console.log('============================================================\n');

  const indexPath = path.join(__dirname, '..', 'admin', 'index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf-8');

  const adminJsPath = path.join(__dirname, '..', 'admin', 'admin.js');
  const adminJs = fs.readFileSync(adminJsPath, 'utf-8');

  // --- 1. ADMINISTRATORS TAB VISIBILITY & FORM ---
  console.log('--- 1. ADMINISTRATORS TAB VISIBILITY & CONTROLS ---');

  test('admin/index.html: #section-administrators does NOT have the hidden attribute', () => {
    assert(
      /<section class="panel" id="section-administrators">/i.test(indexHtml),
      'section-administrators must be a panel without hidden attribute'
    );
    assert(
      !/<section class="panel" id="section-administrators"\s+hidden/i.test(indexHtml),
      'section-administrators must not have hidden attribute'
    );
  });

  test('admin/index.html: #nav-administrators exists with hidden attribute for Owner-only reveal', () => {
    assert(
      /<button class="nav-item" id="nav-administrators" data-section="administrators" hidden>/i.test(indexHtml),
      'nav-administrators button must exist and be hidden by default'
    );
  });

  test('admin/index.html: Administrator creation form includes Full Admin role selector', () => {
    assert(
      indexHtml.includes('id="adminRoleInput"'),
      'adminRoleInput selector must be present'
    );
    assert(
      indexHtml.includes('Full Admin (Operational Management)'),
      'Full Admin role option must be present'
    );
    assert(
      indexHtml.includes('disabled'),
      'Role selector must be locked/disabled to prevent delegating Owner status'
    );
  });

  test('admin/index.html: Administrators panel includes Refresh button', () => {
    assert(
      indexHtml.includes('id="refreshAdminsButton"'),
      'refreshAdminsButton must be present in section-administrators'
    );
  });

  // --- 2. DEDICATED EMPTY STATES & TABLE RENDERERS ---
  console.log('\n--- 2. DEDICATED EMPTY STATES & TABLE RENDERERS ---');

  test('admin.js: renderTable routes to renderFeedbackTable', () => {
    assert(adminJs.includes("if (state.resource === 'feedback') {"), 'Must check state.resource === feedback');
    assert(adminJs.includes('renderFeedbackTable(container, records)'), 'Must call renderFeedbackTable');
  });

  test('admin.js: renderFeedbackTable provides polite empty state without error implication', () => {
    assert(adminJs.includes('No feedback submissions yet'), 'Must display friendly no-feedback message');
  });

  test('admin.js: renderTable routes to renderSettingsTable', () => {
    assert(adminJs.includes("if (state.resource === 'website_settings') {"), 'Must check state.resource === website_settings');
    assert(adminJs.includes('renderSettingsTable(container, records)'), 'Must call renderSettingsTable');
  });

  test('admin.js: renderSettingsTable provides helpful empty state and add setting button', () => {
    assert(adminJs.includes('No custom website settings configured'), 'Must display friendly no-settings message');
    assert(adminJs.includes('emptyNewSettingBtn'), 'Must have add setting button in empty state');
  });

  test('admin.js: renderTable routes to renderActivityLogsTable', () => {
    assert(adminJs.includes("if (state.resource === 'admin_activity_logs') {"), 'Must check state.resource === admin_activity_logs');
    assert(adminJs.includes('renderActivityLogsTable(container, records)'), 'Must call renderActivityLogsTable');
  });

  test('admin.js: renderActivityLogsTable explains audit trail in empty state', () => {
    assert(adminJs.includes('No administrative activity logged yet'), 'Must display informative no-activity message');
  });

  test('admin.js: navigation click handler removes hidden attribute when panel becomes active', () => {
    assert(adminJs.includes("panel.removeAttribute('hidden')"), 'Must remove hidden attribute on active panel');
  });

  // --- 3. SETTINGS & ACTIVITY LOG BACKEND LOGIC ---
  console.log('\n--- 3. BACKEND RESOURCE HANDLING & AUDIT INTEGRITY ---');

  const resourceMod = await import('../functions/api/admin/[resource].js');
  const supabaseShared = await import('../functions/_shared/supabase.js');

  await testAsync('supabase.js: writeActivityLog handles non-UUID entity IDs safely', async () => {
    let captured = null;
    const mockEnv = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SECRET_KEY: 'test-key',
      SUPABASE_PUBLISHABLE_KEY: 'test-pub'
    };

    const originalFetch = global.fetch;
    global.fetch = async (url, opts) => {
      if (String(url).includes('/admin_activity_logs')) {
        captured = JSON.parse(opts.body);
        return { ok: true, text: async () => '[]' };
      }
      return { ok: true, text: async () => '{}' };
    };

    try {
      await supabaseShared.writeActivityLog(
        mockEnv,
        'test-token',
        '11111111-1111-1111-1111-111111111111',
        'test_action',
        'website_settings',
        'site_name', // string key, NOT a uuid
        { foo: 'bar' }
      );

      assert(captured !== null, 'Activity log request must be sent');
      assert.strictEqual(captured[0].entity_id, null, 'Non-UUID entity must be passed as null to entity_id column');
      assert.strictEqual(captured[0].metadata.target_id, 'site_name', 'Non-UUID entity must be recorded in metadata.target_id');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await testAsync('[resource].js: handles website_settings key-based queries and mutations', async () => {
    const originalFetch = global.fetch;
    let requestedUrl = null;
    let requestedMethod = null;

    global.fetch = async (url, opts = {}) => {
      const urlStr = String(url);
      // Mock auth user
      if (urlStr.includes('/auth/v1/user')) {
        return {
          ok: true,
          json: async () => ({ id: '11111111-1111-4111-a111-111111111111', email: 'owner@prepwise.com' })
        };
      }
      // Mock admin profile
      if (urlStr.includes('/rest/v1/admin_profiles')) {
        return {
          ok: true,
          text: async () => JSON.stringify([{ user_id: '11111111-1111-4111-a111-111111111111', role: 'owner', is_active: true }])
        };
      }
      // Mock website settings request
      if (urlStr.includes('/rest/v1/website_settings')) {
        requestedUrl = urlStr;
        requestedMethod = opts.method || 'GET';
        return {
          ok: true,
          text: async () => JSON.stringify([{ key: 'contact_email', value: { email: 'hello@prepwise.com' }, is_public: true }])
        };
      }
      if (urlStr.includes('/rest/v1/admin_activity_logs')) {
        return { ok: true, text: async () => '[]' };
      }
      return { ok: true, text: async () => '{}' };
    };

    const mockEnv = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SECRET_KEY: 'test-secret',
      SUPABASE_PUBLISHABLE_KEY: 'test-pub',
      SUPABASE_OWNER_USER_ID: '11111111-1111-4111-a111-111111111111'
    };

    try {
      // 1. GET settings
      const getReq = {
        method: 'GET',
        url: 'http://localhost/api/admin/website_settings',
        headers: { get: (name) => (name.toLowerCase() === 'authorization' ? 'Bearer valid-owner-token' : null) }
      };
      const getRes = await resourceMod.onRequestGet({ request: getReq, env: mockEnv, params: { resource: 'website_settings' } });
      assert.strictEqual(getRes.status, 200, 'GET website_settings should return 200');

      // 2. POST create setting with text key
      const postReq = {
        method: 'POST',
        url: 'http://localhost/api/admin/website_settings',
        headers: { get: (name) => (name.toLowerCase() === 'authorization' ? 'Bearer valid-owner-token' : null) },
        json: async () => ({ key: 'contact_email', value: { email: 'ra416491@gmail.com' }, is_public: true }),
        text: async () => JSON.stringify({ key: 'contact_email', value: { email: 'ra416491@gmail.com' }, is_public: true })
      };
      const postRes = await resourceMod.onRequestPost({ request: postReq, env: mockEnv, params: { resource: 'website_settings' } });
      assert.strictEqual(postRes.status, 200, 'POST website_settings by key should return 200');

      // 3. PATCH update setting by key
      const patchReq = {
        method: 'PATCH',
        url: 'http://localhost/api/admin/website_settings?key=contact_email',
        headers: { get: (name) => (name.toLowerCase() === 'authorization' ? 'Bearer valid-owner-token' : null) },
        json: async () => ({ value: { email: 'new@prepwise.com' }, is_public: true }),
        text: async () => JSON.stringify({ value: { email: 'new@prepwise.com' }, is_public: true })
      };
      const patchRes = await resourceMod.onRequestPatch({ request: patchReq, env: mockEnv, params: { resource: 'website_settings' } });
      assert.strictEqual(patchRes.status, 200, 'PATCH website_settings by key should return 200');
      assert(requestedUrl.includes('key=eq.contact_email'), 'Query must target key=eq.contact_email');

      // 4. DELETE setting by key
      const deleteReq = {
        method: 'DELETE',
        url: 'http://localhost/api/admin/website_settings?key=contact_email',
        headers: { get: (name) => (name.toLowerCase() === 'authorization' ? 'Bearer valid-owner-token' : null) }
      };
      const deleteRes = await resourceMod.onRequestDelete({ request: deleteReq, env: mockEnv, params: { resource: 'website_settings' } });
      assert.strictEqual(deleteRes.status, 200, 'DELETE website_settings by key should return 200');
      assert(requestedUrl.includes('key=eq.contact_email'), 'DELETE query must target key=eq.contact_email');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await testAsync('[resource].js: handles feedback and activity logs read requests', async () => {
    const originalFetch = global.fetch;
    let accessedResource = null;

    global.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/v1/user')) {
        return { ok: true, json: async () => ({ id: '11111111-1111-4111-a111-111111111111', email: 'owner@prepwise.com' }) };
      }
      if (urlStr.includes('/rest/v1/admin_profiles')) {
        return { ok: true, text: async () => JSON.stringify([{ user_id: '11111111-1111-4111-a111-111111111111', role: 'owner', is_active: true }]) };
      }
      if (urlStr.includes('/rest/v1/feedback')) {
        accessedResource = 'feedback';
        return { ok: true, text: async () => '[]' };
      }
      if (urlStr.includes('/rest/v1/admin_activity_logs')) {
        accessedResource = 'admin_activity_logs';
        return { ok: true, text: async () => '[]' };
      }
      return { ok: true, text: async () => '{}' };
    };

    const mockEnv = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SECRET_KEY: 'test-secret',
      SUPABASE_PUBLISHABLE_KEY: 'test-pub',
      SUPABASE_OWNER_USER_ID: '11111111-1111-4111-a111-111111111111'
    };

    try {
      const fbReq = {
        method: 'GET',
        url: 'http://localhost/api/admin/feedback',
        headers: { get: (name) => (name.toLowerCase() === 'authorization' ? 'Bearer valid-owner-token' : null) }
      };
      const fbRes = await resourceMod.onRequestGet({ request: fbReq, env: mockEnv, params: { resource: 'feedback' } });
      assert.strictEqual(fbRes.status, 200, 'GET /api/admin/feedback returns 200');
      assert.strictEqual(accessedResource, 'feedback');

      const actReq = {
        method: 'GET',
        url: 'http://localhost/api/admin/admin_activity_logs',
        headers: { get: (name) => (name.toLowerCase() === 'authorization' ? 'Bearer valid-owner-token' : null) }
      };
      const actRes = await resourceMod.onRequestGet({ request: actReq, env: mockEnv, params: { resource: 'admin_activity_logs' } });
      assert.strictEqual(actRes.status, 200, 'GET /api/admin/admin_activity_logs returns 200');
      assert.strictEqual(accessedResource, 'admin_activity_logs');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // --- 4. VERIFIED CONTACT EMAIL INTEGRITY ---
  console.log('\n--- 4. VERIFIED CONTACT EMAIL INTEGRITY ---');

  test('Public trust pages strictly contain ra416491@gmail.com and zero instances of incorrect address', () => {
    const rootDir = path.join(__dirname, '..');
    const checkedFiles = ['contact.html', 'privacy.html', 'terms.html', 'disclaimer.html', 'FINAL_DEPLOYMENT_GUIDE.md'];

    checkedFiles.forEach(file => {
      const fullPath = path.join(rootDir, file);
      assert(fs.existsSync(fullPath), `File ${file} must exist`);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert(!content.includes('rayyanshajahan416@gmail.com'), `Incorrect email found in ${file}`);
      assert(content.includes('ra416491@gmail.com'), `Verified email ra416491@gmail.com missing in ${file}`);
    });
  });

  // --- 4. COLLABORATOR FULL ADMIN GRANTING VIA OWNER-ONLY INTERFACE ---
  console.log('\n--- 4. COLLABORATOR FULL ADMIN GRANTING VIA OWNER-ONLY INTERFACE ---');

  const administratorsMod = await import('../functions/api/admin/administrators.js');
  const COLLABORATOR_UUID = 'bc9a49fc-4392-4097-a115-113583846d26';
  const COLLABORATOR_EMAIL = 'sreesidh7@gmail.com';

  await testAsync('Owner can grant Full Admin role to existing collaborator account via administrators.js POST', async () => {
    const originalFetch = global.fetch;
    let insertedPayload = null;
    let loggedAction = null;

    global.fetch = async (url, opts) => {
      const urlStr = String(url);
      // Owner auth check
      if (urlStr.includes('/auth/v1/user')) {
        return {
          ok: true,
          json: async () => ({ id: '11111111-1111-4111-a111-111111111111', email: 'owner@prepwise.com' })
        };
      }
      // Owner admin_profiles check
      if (urlStr.includes('/rest/v1/admin_profiles') && opts.method !== 'POST') {
        return {
          ok: true,
          text: async () => JSON.stringify([{ user_id: '11111111-1111-4111-a111-111111111111', role: 'owner', is_active: true }])
        };
      }
      // Insertion into admin_profiles
      if (urlStr.includes('/rest/v1/admin_profiles') && opts.method === 'POST') {
        insertedPayload = JSON.parse(opts.body);
        return {
          ok: true,
          status: 201,
          text: async () => JSON.stringify(insertedPayload)
        };
      }
      // Activity logging
      if (urlStr.includes('/rest/v1/admin_activity_logs')) {
        loggedAction = JSON.parse(opts.body);
        return { ok: true, status: 201, text: async () => '[]' };
      }
      return { ok: true, text: async () => '{}' };
    };

    const mockEnv = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SECRET_KEY: 'test-secret',
      SUPABASE_PUBLISHABLE_KEY: 'test-pub',
      SUPABASE_OWNER_USER_ID: '11111111-1111-4111-a111-111111111111'
    };

    try {
      const req = {
        method: 'POST',
        url: 'http://localhost/api/admin/administrators',
        headers: {
          get: (name) => (name.toLowerCase() === 'authorization' ? 'Bearer valid-owner-token' : null)
        },
        json: async () => ({
          user_id: COLLABORATOR_UUID,
          display_name: 'Sreesidh',
          role: 'owner' // Attempted privilege escalation should be neutralized
        }),
        text: async () => JSON.stringify({
          user_id: COLLABORATOR_UUID,
          display_name: 'Sreesidh',
          role: 'owner'
        })
      };

      const res = await administratorsMod.onRequestPost({
        request: req,
        env: mockEnv
      });

      assert.strictEqual(res.status, 201, 'Owner request must return HTTP 201');
      assert(insertedPayload !== null, 'Profile insert must be dispatched');
      assert.strictEqual(insertedPayload[0].user_id, COLLABORATOR_UUID, 'Must assign collaborator UUID');
      assert.strictEqual(insertedPayload[0].role, 'admin', 'Role must strictly be admin (escalation neutralized)');
      assert.strictEqual(insertedPayload[0].display_name, 'Sreesidh', 'Must preserve display name');
      assert.strictEqual(insertedPayload[0].is_active, true, 'Account must be marked active');
      assert(loggedAction !== null, 'Audit log entry must be created');
      assert.strictEqual(loggedAction[0].action, 'create_administrator', 'Must record create_administrator action');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await testAsync('Non-owner cannot grant Full Admin role to collaborator (HTTP 403)', async () => {
    const originalFetch = global.fetch;

    global.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/v1/user')) {
        return {
          ok: true,
          json: async () => ({ id: '22222222-2222-4222-a222-222222222222', email: 'admin@prepwise.com' })
        };
      }
      if (urlStr.includes('/rest/v1/admin_profiles')) {
        return {
          ok: true,
          text: async () => JSON.stringify([{ user_id: '22222222-2222-4222-a222-222222222222', role: 'admin', is_active: true }])
        };
      }
      return { ok: true, text: async () => '{}' };
    };

    const mockEnv = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SECRET_KEY: 'test-secret',
      SUPABASE_PUBLISHABLE_KEY: 'test-pub',
      SUPABASE_OWNER_USER_ID: '11111111-1111-4111-a111-111111111111'
    };

    try {
      const req = {
        method: 'POST',
        url: 'http://localhost/api/admin/administrators',
        headers: {
          get: (name) => (name.toLowerCase() === 'authorization' ? 'Bearer valid-admin-token' : null)
        },
        json: async () => ({ user_id: COLLABORATOR_UUID, display_name: 'Sreesidh' }),
        text: async () => JSON.stringify({ user_id: COLLABORATOR_UUID, display_name: 'Sreesidh' })
      };

      const res = await administratorsMod.onRequestPost({
        request: req,
        env: mockEnv
      });

      assert.strictEqual(res.status, 403, 'Non-owner must be rejected with HTTP 403');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // --- 5. ADVERTISING INVARIANT VERIFICATION ---
  console.log('\n--- 5. ADVERTISING INVARIANT CHECK ---');

  test('Non-candidate advertising placements remain strictly disabled', () => {
    const registry = require('../js/ad-registry.js');
    const nonCandidates = registry.placements.filter(p => !p.selectedForLaunch);
    assert.strictEqual(nonCandidates.length, 10, 'Expected 10 non-candidate placements');
    nonCandidates.forEach(p => {
      assert.strictEqual(p.enabled, false, `Placement ${p.id} must be disabled`);
    });
  });

  console.log('\n============================================================');
  console.log(`ADMIN PANEL VERIFICATION SUMMARY: ${passed}/${total} tests passed.`);
  console.log('============================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
})();
