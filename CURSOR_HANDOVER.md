# PrepWise Cursor handover

## Architecture

PrepWise is a zero-build static website: HTML, CSS, browser JavaScript, JSON
datasets, Cloudflare Pages Functions, and Supabase Auth/PostgreSQL. Public
visitors do not register or log in. `/admin/` is a private owner dashboard.

## Important directories

- `index.html`, `about.html`, `company.html`, `quiz.html`: public routes.
- `js/`: public application, quiz, analytics, and advertising code.
- `data/`: companies, news, countries, and 22 question datasets.
- `admin/`: owner dashboard shell, styles, and controller.
- `functions/api/`: Cloudflare Pages Functions.
- `functions/_shared/supabase.js`: shared server authorization and REST client.
- `supabase/migrations/`: local-only database migrations.
- `scripts/validate_question_data.py`: deterministic question data validator.

## Completed locally

- Fixed `js/analytics.js` scoping bug where `alreadyTracked()` was declared inside `identifier()`, restoring analytics runtime across all pages.
- Fixed `css/style.css` cascade so `.ad-slot-sidebar` and `.ad-slot-halfpage` remain completely collapsed when disabled (`.is-enabled` required).
- Updated `_headers` CSP to allow `https://cdn.jsdelivr.net` in `script-src` so Chart.js renders cleanly without console violations.
- Relocated `ad-homepage-inline-secondary` in `index.html` to immediately below `#companiesGrid` as specified in `ADVERTISING_PLACEMENTS.md`.
- Implemented the Admin Quiz panel in `admin/index.html` and `admin/admin.js` (`loadQuiz()`, `renderQuiz()`) with real attempt counts, completion rates, category stats, and company breakdowns.
- Owner-only admin authorization requires a valid Auth token, exact `SUPABASE_OWNER_USER_ID`, and an active `role = 'owner'` profile.
- Corrected 24 total unambiguous questions (15 in Phase 1, 9 in Phase 2) with verified calculations, correct answer indexes, and structured 4-part explanations (Given, Formula/Method, Step-by-Step, Final Answer).
- Converted TCS Q9 (milk-and-water ratio) to include '35 litres' as Option C, resolving the calculation cleanly without altering question wording.
- Only 14 genuinely ambiguous/contradictory questions remain registered in `MANUAL_REVIEW_REGISTRY` in `scripts/validate_question_data.py`.
- Enhanced `js/quiz.js` explanation review detection to show an unambiguous warning alert when a question is under manual review.
- Built safe owner-only Question Management workflow:
  - Backend `functions/api/admin/questions.js` with `requireAdmin` enforcement, rigorous input validation (4 distinct options, valid index, clean explanation, difficulty enum), single-record deletion with audit logs, and strict prohibition of bulk deletion.
  - Frontend controls in `admin/index.html` and `admin/admin.js`: `#questionToolbar`, filter by company/category/difficulty, review status filter, search input, structured `#questionEditorForm`, real-time validation feedback, live explanation preview, and JSON export.
  - Local migration proposal `supabase/migrations/0005_question_management.sql` proposing `review_status`, `review_notes`, and `admin_questions_view`.
- Phase 3 Complete Admin Control Centre:
  - **Admin Overview**: Enhanced `functions/api/admin/overview.js` with date filtering (`today`, `7`, `30`, `90`, `custom`), aggregating real records: `databaseRecords` (companies, questions, news), `metrics` (pageViews, visitorSessions, uniqueVisitors, quizAttempts, quizStarts, quizCompletions, completedAttempts, completionRate), `popularCompanies`, `popularCategories`, `recentActivity`, and `systemHealth`.
  - **Company Management**: Implemented `functions/api/admin/companies.js` with `requireAdmin`, slug regex validation (`^[a-z0-9]+(?:-[a-z0-9]+)*$`), founded year validation (1800-2200), single deletion guard (strictly prohibiting bulk deletion), activity audit logging, and JSON export. In `admin/index.html` & `admin.js`, added `#companyToolbar` and `#companyEditorForm` with live card preview and validation.
  - **Central Content Section**: Implemented `functions/api/admin/content-summary.js` reporting 22 companies, 1,100 questions, 1,086 approved, 14 under review, 0 malformed. Rendered `#contentSummaryCards` with a 1-click jump button "View 14 Flagged" that navigates directly to `interview_questions` and applies `#questionStatusFilter = 'under_review'`.
  - **Question Batch Import**: Built `#questionImportModal` supporting JSON file upload or paste, client-side batch validation (max 500 questions, 4 unique options check, answer index 0..3 check, monologue check, duplicate text detection), preview summary, and submit to `POST /api/admin/questions`.
  - **Quiz Analytics**: Added `#quizFilters` (preset & custom date ranges), score distribution bar chart, daily quiz trends line chart, quiz events breakdown, and category/company performance tables.
  - **Visitor Analytics**: Added `#visitorPopularPages` and `#visitorPopularCompanies` tables alongside the paginated event stream, event filtering, sorting, and CSV export.
  - **Advertising Management**: Connected `window.PREPWISE_AD_REGISTRY.placements` (all 13 slots). Rendered `#advertisingSummaryCards` (Total Placements: 13, All Disabled, Provider: None, Monetization: Locked) and full placements table without fake metrics.
  - **System Health**: Enhanced `functions/api/admin/system.js` and `loadHealth()` returning all 6 operational indicators: Backend Connectivity, Database Availability, Admin API Health, Content Validation Status, Analytics Availability, Advertising Configuration, plus response time and checkedAt timestamp.

- Phase 4 Full Integration, Security & Reliability Audit:
  - Hardened `functions/_shared/supabase.js` `requireAdmin()` with comprehensive error handling (HTTP 500 on missing server configuration, HTTP 503 on Supabase service outage).
  - Fixed Cloudflare Pages context unpacking in `functions/api/admin/[resource].js`.
  - Added malformed JSON body handling (HTTP 400) and duplicate slug conflict handling (HTTP 409) in `functions/api/admin/companies.js`.
  - Added malformed JSON body handling (HTTP 400) in `functions/api/admin/questions.js`.
  - Updated company lookup in `js/company.js` to match both `id` and `slug` case-insensitively.
  - Added universal module export in `js/ad-registry.js` for testing in Node.js and browser.
  - Added idempotency guard in `admin/admin.js` (`setupQuestionImport.initialized`) and smooth section switching for `jumpToReviewQuestions`.
  - Created and executed comprehensive integration test suite `scripts/test_phase4_integration.js` (35/35 passing).
  - Total automated test suite covers 171 passing checks across 4 suites.
- Phase 5 Live Browser Testing, UX Polish & Security Hardening:
  - Spawned live Wrangler Pages development environment (`npx wrangler pages dev . --port 8788`) with live Cloudflare Pages Functions compilation and environment binding.
  - Built `scripts/test_live_browser.js` using isolated Chrome 155 profile over Chrome DevTools Protocol (CDP) via native Node.js WebSocket.
  - Validated homepage, real-time debounced company search, card brand avatars, role counts, salary tags, zero console errors, zero 4xx/5xx network failures.
  - Validated company detail routing across multiple companies (`google`, `tcs`, `amazon`, `infosys`) including slug and uppercase normalization (`company.html?id=TCS`).
  - Validated quiz engine interactions: startup, question text rendering, option selection state updates, score tracking, TCS Q9 (35 litres calculation), and under-review warning banner visibility on Google Q16.
  - Validated advertising safety across all viewports: all 13 ad slots remain collapsed (`display: none`, `clientHeight: 0`).
  - Validated multi-viewport responsiveness at 360px, 390px, 768px, and 1366px with zero horizontal page overflow.
  - Validated mobile navigation hamburger toggle (`.navbar-nav.open`) at 360px width.
  - Validated form accessibility labels and placeholders.
  - Hardened `functions/_shared/supabase.js` `requireAdmin()` to validate incoming Bearer tokens with Supabase Auth first, returning HTTP 401 on invalid/bogus tokens across all admin endpoints.
  - Total verified checks: 218 passing assertions across 5 suites.

- Phase 6 Supabase Production Readiness & Owner Authentication:
  - Performed read-only schema audit against Supabase project (`jwkllwqabixzmtfiuncd`): verified 18 remote tables/views exist; confirmed migrations 0001, 0002, 0003 are applied; confirmed `companies`, `interview_questions`, and `admin_profiles` exist with 0 rows; confirmed migration 0005 columns (`review_status`, `review_notes`) are pending.
  - Reviewed migration safety for 0001–0005: verified 0004 and 0005 are idempotent and safe to apply. Updated 0005 check constraint to include `under_review`.
  - Built read-only synchronization dry-run tool `scripts/sync_data_dry_run.js` comparing local static datasets against remote tables: verified 22 companies and 1,100 questions map cleanly (0 fatal errors, 0 mutations performed).
  - Prepared manual 7-step owner onboarding and authentication setup guide.

- Phase 7 Production Launch, Deployment & Live Verification:
  - Executed end-to-end pre-deployment audit across all public pages, admin control center, Pages Functions, and question datasets.
  - Engineered CLI seed import tool `scripts/import_seed_data.js` with safe default `--dry-run` mode. Verified 22 companies and 1,100 questions map accurately with zero mutations.
  - Created branded `404.html` with full navigation and return paths.
  - Generated `favicon.svg` and binary `favicon.ico`, eliminating browser 404 network errors; linked across all public and admin pages.
  - Updated `sitemap.xml` with all 22 company preparation routes, priority ratings, and change frequencies.
  - Verified all 13 advertising placement slots remain strictly disabled and collapsed in CSS.
  - Confirmed 218/218 automated and live browser tests pass (Chrome 155 via CDP).

- Phase 7B Final Production Handoff Reconciliation:
  - Reconciled `public.admin_profiles` schema across remote database, migrations 0001, 0003, 0004, and `functions/_shared/supabase.js`. Definitive primary key is `user_id` (UUID), display name is `display_name`, no `email` or `id` column exists in table (email is in `auth.users`).
  - Corrected owner profile insertion SQL to match exact schema with conflict resolution on `(user_id)`.
  - Verified migrations 0004 and 0005 are safe, idempotent, and non-destructive.
  - Enhanced `scripts/import_seed_data.js` with idempotency filter against existing `(company_id, legacy_id)` records to prevent duplicate key collisions upon re-running.
  - Documented hybrid source-of-truth model: public site reads CDN-cached static `data/` files; admin modifications in Supabase are synchronized via Admin `Export JSON` buttons and Git commit.

- Phase 8 Secure Multi-User Administration & Phase 8A Bootstrap Audit:
  - Upgraded authorization architecture from single-user to secure dual-role model (`owner` vs `admin`).
  - Mohammed Rayyan is designated as the sole `owner` with exclusive security privileges.
  - The collaborator receives the `admin` role with full operational access (companies, questions, batch import/export, analytics, CSV exports, system health).
  - Implemented `requireOwner(request, env)` in `functions/_shared/supabase.js` to strictly enforce owner-only access on privileged administrative actions.
  - Built `functions/api/admin/administrators.js` supporting list, create, status toggle, and delete of administrators, strictly restricted to `requireOwner()`.
  - Created and hardened `supabase/migrations/0006_multi_user_admin_security.sql`:
    - Resolved chicken-and-egg bootstrap deadlock where `is_owner()` required an existing owner profile to permit creating the first owner.
    - Added bootstrap check in `admin_profile_security_guard`: blocks client API bootstrapping (`auth.role() = 'authenticated'`), allows trusted SQL Editor bootstrapping (`current_user = 'postgres'`), and verifies user existence in `auth.users`.
    - Added dedicated `bootstrap_initial_owner(uuid, text)` helper procedure granted exclusively to `postgres` and `service_role`.
    - Added fast-path non-recursive check to `admin_profiles_select` (`user_id = auth.uid() or public.is_admin()`).
    - Added database triggers preventing owner demotion, deactivation, or deletion at the PostgreSQL level.
  - Enhanced Admin Control Centre (`admin/index.html`, `admin/admin.js`, `admin/admin.css`) with `#nav-administrators`, `#section-administrators`, role badges, and status toggle/deletion controls.
  - Phase 8C & 8D Preflight Hardening & Recovery Invariants:
    - Tested all 6 emergency owner recovery edge cases.
    - Verified foreign key cascade + trigger interactions: Owner Auth user cannot be accidentally deleted from Supabase Auth (protected by PostgreSQL trigger).
    - Fixed schema column mismatch bug in `emergency_rebind_owner()` (`entity_type`, `entity_id` [UUID], `metadata` [JSONB]).
    - Added guard against client-side tampering with owner primary key `user_id`.
    - Verified complete migrations 0001–0006 compatibility against remote schema.
    - Expanded test suite to 58 assertions in `scripts/test_phase8_multi_user.js`.
    - Total verified project assertions now at 280 passing checks (233 automated assertions + 47 browser assertions).

## Security rules

Never put `SUPABASE_SECRET_KEY` or `SUPABASE_OWNER_USER_ID` in browser files,
HTML, committed configuration, or chat. Never weaken `requireAdmin()`. Do not
apply migrations, import production data, create an owner account, deploy,
commit, or push without explicit owner approval.

## Database status

Migrations `0001` through `0003` are verified applied remotely.
`0004_admin_profiles_auth_fk.sql`, `0005_question_management.sql`, and `0006_multi_user_admin_security.sql`
are prepared, idempotent, and ready to be applied by the owner via the Supabase SQL editor.
Zero remote database mutations were executed in this phase.

## Multi-User Administration & Roles

PrepWise implements a dual-role administration model:
- **`owner` (Mohammed Rayyan)**: Exclusive authority over security, environment variables, Supabase settings, and administrator provisioning. The owner cannot be deactivated, demoted, or deleted via API or database triggers.
- **`admin` (Collaborator)**: Broad operational access. Can manage companies, interview questions, review statuses, question batch imports, JSON exports, analytics views, CSV reports, and system health checks. Cannot access the Administrators management panel or modify administrator accounts.

### How to Provision the Collaborator (Full Admin)
1. **Create Supabase Auth Account**: In Supabase Dashboard > Authentication > Users > click "Add User" > Create user with collaborator's email and temporary password (or send invite).
2. **Retrieve Collaborator UUID**: Copy the new user's UUID from the Supabase Users list.
3. **Provision Admin Profile**:
   - Option A (Via Owner UI): Log into `/admin/` as Mohammed Rayyan > Click **Administrators** in the sidebar > Paste collaborator's UUID in the "Create Administrator Profile" form > Enter display name > Click **Grant Admin Access**.
   - Option B (Via SQL Editor): Run:
     ```sql
     insert into public.admin_profiles (user_id, role, display_name, is_active)
     values ('<COLLABORATOR_AUTH_UUID>', 'admin', 'Collaborator Name', true)
     on conflict (user_id) do update set role = 'admin', is_active = true;
     ```
4. **Login**: Collaborator signs in at `https://<domain>/admin/` with their own credentials. They will see the `ADMIN` role badge and operational panels, with the Administrators panel hidden.

### Emergency Collaborator Deactivation
If the collaborator's access must be revoked immediately:
- **Via Owner UI**: Navigate to `/admin/` > Administrators > Click **Deactivate** next to the collaborator. Their active session is immediately blocked on the next request with HTTP 403 (`Account is deactivated`).
- **Via SQL Editor**:
  ```sql
  update public.admin_profiles set is_active = false where user_id = '<COLLABORATOR_AUTH_UUID>';
  ```

### Emergency Owner Recovery & Auth Deletion Invariants

**PostgreSQL Protection Guarantee**:
The active Owner's Auth user **cannot be accidentally deleted from the Supabase Dashboard**. Because of the foreign key `ON DELETE CASCADE` linked to the `admin_profile_deletion_guard` trigger on `public.admin_profiles`, any attempt to delete the Owner user in Supabase Auth will be rejected by PostgreSQL with:
`ERROR: The owner account profile cannot be deleted.`

If owner login credentials are lost, the MFA device is lost, or the owner Auth UID must be rotated:
1. **Password / Credentials Loss**:
   In Supabase Dashboard > Authentication > Users > Mohammed Rayyan > "Send Password Reset" or "Edit User" > "Change Password". The Auth UUID is unchanged; zero SQL execution required.
2. **Lost Access / Account Rotation / New Owner Auth UUID**:
   Do NOT attempt to delete the old Auth user first (PostgreSQL will block it). Instead, execute this exact 4-step sequence:
   - **Step 1 (Provision Replacement Auth User)**: In Supabase Dashboard > Authentication > Users, create the new Auth user for Mohammed Rayyan (or invite the new email). Copy the `<NEW_OWNER_AUTH_UUID>`.
   - **Step 2 (Execute Emergency Rebind)**: In the Supabase SQL Editor (as `postgres`), execute:
     ```sql
     select public.emergency_rebind_owner('<NEW_OWNER_AUTH_UUID>', 'Mohammed Rayyan');
     ```
     This procedure verifies `<NEW_OWNER_AUTH_UUID>` exists in `auth.users`, atomically rebinds the owner primary key in `admin_profiles`, reactivates the profile, and records an audited `emergency_owner_rebind` entry in `admin_activity_logs`.
   - **Step 3 (Delete Old Auth User - Optional)**: NOW that the old Auth account is completely unlinked from `admin_profiles`, you may safely delete the old Auth user from Supabase Dashboard > Authentication > Users (the deletion will now succeed cleanly).
   - **Step 4 (Sync Cloudflare)**: Update `SUPABASE_OWNER_USER_ID` in Cloudflare Pages Settings > Environment variables to match `<NEW_OWNER_AUTH_UUID>`.
3. **Cloudflare Sync**: Update `SUPABASE_OWNER_USER_ID` in Cloudflare Pages environment variables to match `<NEW_OWNER_AUTH_UUID>`.

## Dual GitHub Repository Configuration & Workflow

PrepWise is configured to support two synchronized GitHub repositories:
1. **Canonical Shared Repository**: `origin` & `upstream` -> `https://github.com/Sreesidh-git/prepwise.git`
   - Primary collaborative repository between Mohammed Rayyan and Sreesidh.
   - Connected to Cloudflare Pages for continuous deployment.
   - Upstream tracking branch for local `main` (`origin/main`).
2. **Personal Mirror Repository**: `personal` & `rayyan` -> `https://github.com/RayyanShajahan/prepwise.git`
   - Mohammed Rayyan's personal mirror and backup repository.

### Divergence Status
- `origin/main`: Commit `47fdd59`
- `personal/main`: Commit `47fdd59`
- Divergence: `0 ahead, 0 behind` (both remotes share identical history and identical HEAD).

### Safe Dual-Push Workflow
When changes have passed all automated tests (247 passing assertions):
```powershell
# 1. Pull any remote updates from canonical repository
git pull --ff-only origin main

# 2. Stage and commit approved changes
git add <files>
git commit -m "Your descriptive commit message"

# 3. Push to canonical shared repository (triggers Cloudflare Pages build if linked)
git push origin main

# 4. Push to personal mirror repository
git push personal main
```

### Credential & Secret Safety Rules
- HTTPS remotes use system Git Credential Manager (GCM). Never hardcode PATs or passwords in remote URLs.
- `.env`, `.dev.vars`, `admin/config.js`, and local secrets are strictly ignored by `.gitignore`.
- Always inspect `git status` before staging to verify no secret or credential files are added.

## Local validation

```powershell
# 1. Start Cloudflare Pages local development server (executes Pages Functions):
npx wrangler pages dev . --port 8788

# 2. Run live browser test suite (Chrome Headless CDP across mobile/desktop):
node scripts\test_live_browser.js

# 3. Run regression and integration test suites:
node scripts\test_phase8_multi_user.js
node scripts\test_phase4_integration.js
node scripts\test_phase3_admin_suite.js
node scripts\test_phase2_content_management.js
node scripts\test_all_requirements.js

# 4. Run question bank validator, database dry-run and git diff check:
python scripts\validate_question_data.py --report-json scripts\question_validation_report.json
node scripts\import_seed_data.js --dry-run
git diff --check
```

Live browser testing (Chrome 155 via CDP), Cloudflare Pages Functions runtime testing
(Wrangler dev server on port 8788), multi-viewport responsive testing (360px, 390px,
768px, 1366px), and multi-user authorization flows have all been verified locally.
Remote production Supabase execution and production deployment have not been executed.

## Authoritative 13-Step Production Launch Sequence

| Step | Action | Status | Notes |
|---|---|:---:|---|
| **1** | Disable Public Signup | **PENDING OWNER** | Supabase Dashboard > Authentication > Providers > Email > Turn OFF "Enable Email Signup". |
| **2** | Retrieve Existing Owner UID | **COMPLETED & CONFIRMED** | Mohammed Rayyan's Auth user is **already created** in Supabase. Go to Supabase Dashboard > Authentication > Users, copy existing User UID. Do NOT create duplicate. |
| **3** | Execute Migrations 0004, 0005 & 0006 | **PENDING OWNER** | SQL Editor: Run in strict order: `0004_admin_profiles_auth_fk.sql`, then `0005_question_management.sql`, then `0006_multi_user_admin_security.sql`. |
| **4** | Bootstrap Owner Profile | **PENDING OWNER** | SQL Editor: Run `select public.bootstrap_initial_owner('<EXISTING_OWNER_UUID>', 'Mohammed Rayyan');` |
| **5** | Verify Owner Profile | **PENDING OWNER** | SQL Editor: Run `select * from public.admin_profiles;` (confirms `role = 'owner'`, `is_active = true`). |
| **6** | Configure Cloudflare Env Vars | **PENDING OWNER** | Cloudflare Pages Settings > Environment Variables: set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_OWNER_USER_ID` (matches `<EXISTING_OWNER_UUID>`), `SUPABASE_PUBLISHABLE_KEY`, `PUBLIC_SITE_URL`. |
| **7** | Seed Import Dry-Run | **COMPLETED & VERIFIED** | Run `node scripts/import_seed_data.js --dry-run` (22 companies, 1,100 questions verified, 0 mutations). |
| **8** | Approved Seed Import | **PENDING OWNER APPROVAL** | Run `node scripts/import_seed_data.js --apply --confirm` to populate production database. |
| **9** | Git Commit & Push | **PENDING OWNER APPROVAL** | Review `git status`, commit local files with co-author trailer, and push to remote repository. |
| **10** | Cloudflare Deployment | **PENDING OWNER APPROVAL** | Cloudflare Pages deploys branch `main` with build command `None` and output dir `/`. |
| **11** | Live Owner Login Verification | **PENDING LIVE LAUNCH** | Log into `https://<domain>/admin/` with owner credentials; verify overview, companies, questions, and administrators panel. |
| **12** | Provision Collaborator Admin | **POST-LAUNCH STEP** | In Supabase Auth, add collaborator user; in Admin Control Centre, grant `admin` role via Administrators panel. |
| **13** | Public Site Verification | **PENDING LIVE LAUNCH** | Test homepage, company pages, quiz engine, 404, favicons, mobile navigation; verify zero errors. |

## Known Blockers & Editorial Queue

1. 14 questions remain registered in `MANUAL_REVIEW_REGISTRY` with `review_status = 'under_review'`.
2. Supabase Auth signup toggle, migration execution, and owner credential provisioning require the project owner.
3. Review ad network compliance before enabling any of the 13 registered ad units in `js/ad-registry.js`.

## What Cursor must not overwrite

Preserve the existing uncommitted security, migration, advertising, analytics,
and dataset changes. Do not reset or clean the worktree. Do not migrate the
frontend to a framework. Do not activate ads or fabricate analytics.

## Opening in Cursor

Open the repository folder `C:\Users\ra416\OneDrive\Desktop\prepwise`, read this
file and `agent-readme.md`, inspect `git status`, then continue from the
priority list above. Keep all secrets in ignored `.env` or `.dev.vars` files.
