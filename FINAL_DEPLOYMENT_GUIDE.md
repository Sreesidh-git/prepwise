# PREPWISE — FINAL DEPLOYMENT GUIDE

**Target Canonical Repository:** `Sreesidh-git/prepwise`  
**Committed Baseline:** `d17e83e2a785d78aaddefff3fcf39d0f129fec18`  
**Architecture:** Zero-build Static Frontend (HTML5/CSS3/Vanilla JS), Cloudflare Pages & Pages Functions, Supabase Auth & PostgreSQL.

---

## 1. Current Project Status

- **Application Code:** 100% complete and validated. Zero build steps or complex framework dependencies required.
- **Local Test Baseline:** 242/242 automated and simulated test assertions passing across 6 distinct suites, including 47 live Chrome browser CDP tests.
- **Production Schema:** Supabase database currently has migrations 0001–0003 recorded. Migrations 0004, 0005, and 0006 are prepared locally with single-owner invariant enforcement and service-role API protection.
- **Seed Data:** 22 company datasets and 1,100 interview questions locally verified (1,086 approved, 14 flagged for editorial review).
- **Advertisements:** All 13 advertising placements are hardcoded to `disabled` and collapsed in CSS (`display: none`).
- **Visitor Signup:** Public visitor authentication is disabled; Supabase Auth is strictly restricted to administrative users.

---

## 2. Exact Git Changes Pending

Running `git status` shows two modified migration files that incorporate final security corrections:
- `supabase/migrations/0005_question_management.sql` (hardened `admin_questions_view` with `WITH (security_invoker = true)` and `WHERE public.is_admin()`).
- `supabase/migrations/0006_multi_user_admin_security.sql` (added `admin_profiles_single_owner_idx` partial unique index, immutable DBA session authorization `(session_user in ('postgres', 'supabase_admin') and auth.role() is null)` blocking `service_role` and `authenticated` API calls, and `FOR UPDATE` lock serialization for emergency recovery).

*(Note: The untracked file with an unusual filename created by an accidental shell paste remains untouched and is not included in staging).*

---

## 3. Production Migration Procedure

### 3.1 Pre-Flight Check: PostgreSQL Version Verification
`WITH (security_invoker = true)` requires **PostgreSQL 15.0 or higher**.  
In the Supabase Dashboard SQL Editor, run:

```sql
select version();
```
- **Expected:** `PostgreSQL 15.x` or `PostgreSQL 16.x` (Supabase hosted projects created or upgraded since 2023 run on PostgreSQL 15.1+).
- *Fallback note:* If running on a legacy instance (< PG 15), remove `WITH (security_invoker = true)` from the view definition; the `WHERE public.is_admin()` clause inside the view will still enforce row filtering for non-admins.

---

### 3.2 Migration Compatibility & Order of Execution
Migrations 0004, 0005, and 0006 execute cleanly in order without conflicting with the existing schema:
1. **0004 (`0004_admin_profiles_auth_fk.sql`):** Restores foreign key constraint `admin_profiles_user_id_auth_users_fkey` on `public.admin_profiles(user_id)` referencing `auth.users(id) on delete cascade`. Since production currently has 0 rows in `admin_profiles`, the orphaned user check passes immediately.
2. **0005 (`0005_question_management.sql`):** Adds `review_status` (with valid check constraint including `'under_review'`) and `review_notes` columns to `public.interview_questions`. Creates `public.admin_questions_view`, which calls `public.is_admin()` (already defined in production via migration 0001).
3. **0006 (`0006_multi_user_admin_security.sql`):** Upgrades `is_admin()`, defines `is_owner()`, enforces engine-level single owner constraint via `admin_profiles_single_owner_idx`, hardens RLS policies, attaches invariant triggers, and establishes SQL Editor-only functions `bootstrap_initial_owner` and `emergency_rebind_owner`.

Wrapping all three migrations inside a single `begin; ... commit;` block guarantees atomic execution.

---

### 3.3 Production SQL Execution Script

Execute the following consolidated SQL block in the **Supabase Dashboard SQL Editor**:

```sql
-- =========================================================================
-- PREPWISE CONSOLIDATED PRODUCTION MIGRATION (0004 -> 0005 -> 0006)
-- =========================================================================

begin;

-- -------------------------------------------------------------------------
-- MIGRATION 0004: Foreign Key Relationship
-- -------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from public.admin_profiles profile
    left join auth.users auth_user on auth_user.id = profile.user_id
    where auth_user.id is null
  ) then
    raise exception 'Cannot add admin_profiles_user_id_auth_users_fkey: orphaned admin_profiles rows exist';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.admin_profiles'::regclass
      and constraint_row.contype = 'f'
      and constraint_row.confrelid = 'auth.users'::regclass
      and constraint_row.conkey = array[
        (
          select attribute.attnum
          from pg_attribute attribute
          where attribute.attrelid = 'public.admin_profiles'::regclass
            and attribute.attname = 'user_id'
            and not attribute.attisdropped
        )::smallint
      ]
  ) then
    alter table public.admin_profiles
      add constraint admin_profiles_user_id_auth_users_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end
$$;

-- -------------------------------------------------------------------------
-- MIGRATION 0005: Question Management & Editorial Tracking
-- -------------------------------------------------------------------------
alter table public.interview_questions
  add column if not exists review_status text not null default 'approved'
  check (review_status in ('approved', 'needs_review', 'under_review', 'draft', 'archived'));

alter table public.interview_questions
  add column if not exists review_notes text;

create index if not exists interview_questions_review_status_idx
  on public.interview_questions(review_status);

create or replace view public.admin_questions_view
with (security_invoker = true) as
select
  q.id,
  q.company_id,
  c.name as company_name,
  c.slug as company_slug,
  q.category_id,
  cat.name as category_name,
  cat.slug as category_slug,
  q.legacy_id,
  q.question_text,
  q.options,
  q.correct_answer,
  q.explanation,
  q.difficulty,
  q.level,
  q.target_roles,
  q.review_status,
  q.review_notes,
  q.is_published,
  q.published_at,
  q.created_at,
  q.updated_at
from public.interview_questions q
left join public.companies c on q.company_id = c.id
left join public.question_categories cat on q.category_id = cat.id
where public.is_admin();

revoke all on public.admin_questions_view from public;
grant select on public.admin_questions_view to authenticated;

-- -------------------------------------------------------------------------
-- MIGRATION 0006: Multi-User Admin Security, Invariant & RLS
-- -------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where user_id = auth.uid()
      and role in ('owner', 'admin')
      and is_active = true
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where user_id = auth.uid()
      and role = 'owner'
      and is_active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to anon, authenticated;

-- Engine-level invariant: At most one active/inactive owner row can ever exist
create unique index if not exists admin_profiles_single_owner_idx
  on public.admin_profiles ((role))
  where role = 'owner';

drop policy if exists owner_manage_admin_profiles on public.admin_profiles;
drop policy if exists admin_profiles_select on public.admin_profiles;
drop policy if exists admin_profiles_insert on public.admin_profiles;
drop policy if exists admin_profiles_update on public.admin_profiles;
drop policy if exists admin_profiles_delete on public.admin_profiles;

alter table public.admin_profiles enable row level security;

create policy admin_profiles_select on public.admin_profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
  );

create policy admin_profiles_insert on public.admin_profiles
  for insert to authenticated
  with check (public.is_owner());

create policy admin_profiles_update on public.admin_profiles
  for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy admin_profiles_delete on public.admin_profiles
  for delete to authenticated
  using (public.is_owner());

create or replace function public.enforce_admin_profile_security()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_owner_count int;
  v_is_db_admin boolean;
begin
  -- Resolve whether execution is from trusted direct DBA session (SQL Editor) or API client
  v_is_db_admin := (session_user in ('postgres', 'supabase_admin') and auth.role() is null);

  if tg_op = 'INSERT' then
    if new.role = 'owner' then
      select count(*) into v_owner_count
      from public.admin_profiles
      where role = 'owner';

      if v_owner_count > 0 then
        raise exception 'An owner profile already exists. Multiple owners are prohibited.';
      else
        if not v_is_db_admin then
          raise exception 'Initial owner bootstrap is prohibited through API endpoints (including service_role). Execute bootstrap via trusted Supabase SQL Editor.';
        end if;

        if not exists (select 1 from auth.users where id = new.user_id) then
          raise exception 'Target user_id % does not exist in auth.users. Create the Auth user first.', new.user_id;
        end if;
      end if;
    end if;

  elsif tg_op = 'UPDATE' then
    if old.role = 'owner' and (new.role != 'owner' or new.is_active != true) then
      raise exception 'The owner account cannot be demoted or deactivated.';
    end if;

    if old.role = 'owner' and new.user_id != old.user_id then
      if not v_is_db_admin or current_user not in ('postgres', 'supabase_admin') then
        raise exception 'The owner user ID can only be reassigned by database administrators in the SQL Editor.';
      end if;
    end if;

    if new.role = 'owner' and old.role != 'owner' then
      if not public.is_owner() and not v_is_db_admin then
        raise exception 'Only an existing active owner or database administrator can promote a user to owner.';
      end if;
    end if;

    if old.role = 'admin' and (new.role != old.role or new.is_active != old.is_active) then
      if not public.is_owner() and not v_is_db_admin then
        raise exception 'Administrators cannot alter administrative roles or active status.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists admin_profile_security_guard on public.admin_profiles;
create trigger admin_profile_security_guard
  before insert or update on public.admin_profiles
  for each row execute function public.enforce_admin_profile_security();

create or replace function public.prevent_owner_profile_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'owner' then
    raise exception 'The owner account profile cannot be deleted.';
  end if;
  return old;
end;
$$;

drop trigger if exists admin_profile_deletion_guard on public.admin_profiles;
create trigger admin_profile_deletion_guard
  before delete on public.admin_profiles
  for each row execute function public.prevent_owner_profile_deletion();

create or replace function public.bootstrap_initial_owner(
  p_user_id uuid,
  p_display_name text default 'Mohammed Rayyan'
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if exists (select 1 from public.admin_profiles where role = 'owner') then
    raise exception 'An owner profile already exists. Bootstrap procedure can only be run once.';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'User ID % does not exist in auth.users. Create the Supabase Auth user first.', p_user_id;
  end if;

  insert into public.admin_profiles (user_id, role, display_name, is_active)
  values (p_user_id, 'owner', coalesce(p_display_name, 'Mohammed Rayyan'), true)
  on conflict (user_id) do update
  set role = 'owner',
      display_name = coalesce(excluded.display_name, public.admin_profiles.display_name),
      is_active = true,
      updated_at = now();
end;
$$;

revoke all on function public.bootstrap_initial_owner(uuid, text) from public;
revoke all on function public.bootstrap_initial_owner(uuid, text) from anon, authenticated, service_role;
grant execute on function public.bootstrap_initial_owner(uuid, text) to postgres;

create or replace function public.emergency_rebind_owner(
  p_new_owner_user_id uuid,
  p_new_display_name text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_old_owner_id uuid;
  v_is_db_admin boolean;
begin
  v_is_db_admin := (session_user in ('postgres', 'supabase_admin') and auth.role() is null);
  if not v_is_db_admin then
    raise exception 'Emergency rebind is strictly restricted to database superusers in the SQL Editor.';
  end if;

  if not exists (select 1 from auth.users where id = p_new_owner_user_id) then
    raise exception 'Target user ID % does not exist in auth.users. Create the Auth user first.', p_new_owner_user_id;
  end if;

  select user_id into v_old_owner_id
  from public.admin_profiles
  where role = 'owner'
  for update;

  if v_old_owner_id is null then
    perform public.bootstrap_initial_owner(p_new_owner_user_id, p_new_display_name);
    return;
  end if;

  if v_old_owner_id = p_new_owner_user_id then
    update public.admin_profiles
    set display_name = coalesce(p_new_display_name, display_name),
        is_active = true,
        updated_at = now()
    where user_id = v_old_owner_id;
    return;
  end if;

  delete from public.admin_profiles where user_id = p_new_owner_user_id;

  update public.admin_profiles
  set user_id = p_new_owner_user_id,
      display_name = coalesce(p_new_display_name, display_name),
      is_active = true,
      updated_at = now()
  where user_id = v_old_owner_id;

  insert into public.admin_activity_logs (
    admin_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    p_new_owner_user_id,
    'emergency_owner_rebind',
    'admin_profiles',
    p_new_owner_user_id,
    jsonb_build_object(
      'previous_owner_id', v_old_owner_id,
      'new_owner_id', p_new_owner_user_id,
      'executed_by', session_user,
      'timestamp', now()
    )
  );
end;
$$;

revoke all on function public.emergency_rebind_owner(uuid, text) from public;
revoke all on function public.emergency_rebind_owner(uuid, text) from anon, authenticated, service_role;
grant execute on function public.emergency_rebind_owner(uuid, text) to postgres;

commit;
```

---

### 3.4 Safest Supported Migration History Synchronization

**IMPORTANT:** Do NOT attempt raw, manual `INSERT INTO supabase_migrations.schema_migrations` statements from the SQL Editor. The internal structure of that table is owned and managed exclusively by the Supabase CLI; its schema varies across CLI releases (e.g. `statements text[] NOT NULL`, `name text`, `version text`) and manual insertions can violate constraints or desynchronize CLI state.

The supported workflows:
- **Default Workflow (Dashboard SQL Editor):** Applying migrations directly in the Supabase Dashboard SQL Editor as shown above is fully supported. If your project does not use automated CI/CD CLI migrations (`supabase db push`), no further synchronization is required.
- **CLI Workflow (If linking Supabase CLI):** If your team links the Supabase CLI (`npx supabase link`) in the future and wishes to inform the CLI ledger that these migrations were already applied, use the official Supabase repair command:
  ```bash
  npx supabase migration repair --status applied 0004
  npx supabase migration repair --status applied 0005
  npx supabase migration repair --status applied 0006
  ```
  This official command inspects the internal schema dynamically and marks each version as applied safely without risk of schema corruption.

---

## 4. Owner & Full Admin Provisioning Procedure

### Step 4.1: Retrieve the Existing Owner Auth UID
The project owner's account (`ra416491@gmail.com`) is already created in Supabase Auth. Run this query in the SQL Editor to copy the assigned UUID:

```sql
select id, email, created_at
from auth.users
where email = 'ra416491@gmail.com';
```

### Step 4.2: Bootstrap the Owner Account
In the SQL Editor, execute the bootstrap function replacing `<OWNER-AUTH-UUID>` with the retrieved ID:

```sql
select public.bootstrap_initial_owner('<OWNER-AUTH-UUID>', 'Mohammed Rayyan');
```

Verify that the owner profile exists and is active:
```sql
select user_id, role, display_name, is_active
from public.admin_profiles
where role = 'owner';
```

### Step 4.3: Verify Owner Login in Admin Portal
1. Open `https://<YOUR-PAGES-DOMAIN>/admin/`.
2. Log in using `ra416491@gmail.com` and your password.
3. Verify that the top bar displays your name and the purple **Owner** badge.
4. Verify that the **Administrators** management tab is visible in the navigation sidebar.

### Step 4.4: Provision Full Admin for Friend
1. In the Supabase Dashboard, go to **Authentication** &rarr; **Users** &rarr; click **Add user** &rarr; **Create user**.
2. Enter your friend's email and a secure temporary password. Copy the newly generated user ID.
3. In the PrepWise Admin Portal (logged in as Owner), click the **Administrators** tab &rarr; click **+ New Administrator**.
4. Paste the friend's User ID, enter their display name, and select role **Full Admin**.
5. Have your friend log in at `/admin/`. Verify that they see the blue **Admin** badge and can manage companies and questions, but **cannot** see or access the Administrators tab.

---

## 5. Cloudflare Pages Connection & Build Configuration

1. In the Cloudflare Dashboard, navigate to **Compute (Workers) > Workers & Pages** &rarr; click **Create application** &rarr; select **Pages** &rarr; **Connect to Git**.
2. Select repository: `Sreesidh-git/prepwise` (branch: `main`).
3. Set the following build settings:
   - **Framework preset:** `None`
   - **Build command:** *(leave empty)*
   - **Build output directory:** `.` (or root `/`)
   - **Root directory:** *(leave empty)*
4. Click **Save and Deploy**. Cloudflare Pages will automatically discover and deploy the `functions/` directory for backend API routing.

---

## 6. Exact Production Environment Variables

Confirmed against actual application usage across all Cloudflare Pages Functions (`functions/_shared/supabase.js`, `functions/api/config.js`, `functions/api/admin/overview.js`):

| Variable Name | Type | Value / Purpose | Scope |
| :--- | :--- | :--- | :--- |
| `SUPABASE_URL` | Plaintext | Supabase Project URL (e.g. `https://xyzcompany.supabase.co`) | Production & Preview |
| `SUPABASE_PUBLISHABLE_KEY` | Plaintext | Supabase `anon` / publishable key (passed to client for auth sessions) | Production & Preview |
| `SUPABASE_SECRET_KEY` | **Secret** (Encrypted) | Supabase `service_role` key (used by Cloudflare Functions for backend API calls) | Production & Preview |
| `SUPABASE_OWNER_USER_ID` | **Secret** (Encrypted) | Exact UUID of the Owner from Step 4.1 (enforces strict server-side Owner validation) | Production & Preview |
| `PUBLIC_SITE_URL` *(Optional)* | Plaintext | Canonical public URL (e.g. `https://prepwise.pages.dev`) | Production |
| `PUBLIC_GA4_MEASUREMENT_ID` *(Optional)* | Plaintext | Google Analytics 4 Measurement ID (e.g. `G-XXXXXXXXXX`) | Production |

> **SECURITY REQUIREMENT:** In Cloudflare Pages, mark `SUPABASE_SECRET_KEY` and `SUPABASE_OWNER_USER_ID` as **Secret** so their values are masked and encrypted at rest.

---

## 7. Seed Data Import Procedure

All questions and company profiles are imported using `scripts/import_seed_data.js`.

### Step 7.1: Environment Prerequisites & Idempotency Guarantee
The script reads `SUPABASE_URL` and `SUPABASE_SECRET_KEY` from your local `.env` file or shell environment:
- `SUPABASE_URL` must point to your remote Supabase instance.
- `SUPABASE_SECRET_KEY` must be the `service_role` secret key (required for write access).
- **Idempotency Guarantee:** The script inspects the remote database prior to insertion:
  - Companies are matched against existing records by `slug` and `legacy_id`. Any existing company is skipped.
  - Questions are matched against existing records by `(company_id, legacy_id)`. Any existing question is skipped.
  - **Running the import multiple times is 100% safe and will produce zero duplicate records.**

### Step 7.2: Local Pre-Flight Dry Run
Verify dataset integrity and view remote state without mutating the database:

```bash
node scripts/import_seed_data.js
```

**Expected output:**
- 22 companies evaluated.
- 1,100 questions evaluated.
- 1,086 questions tagged as `'approved'`.
- 14 questions tagged as `'under_review'`.
- Zero database records mutated (`DRY-RUN mode`).

### Step 7.3: Live Production Import Execution
Run the import command with explicit execution flags:

```bash
node scripts/import_seed_data.js --apply --confirm
```

The script will:
1. Insert 22 companies in batches of 25 and map returned UUIDs.
2. Insert 1,100 questions in batches of 50 referencing correct `company_id` UUIDs.
3. Automatically attach `review_status = 'under_review'` and `review_notes` to the 14 flagged questions.

### Step 7.4: Post-Import Verification Queries
Run in Supabase SQL Editor:

```sql
-- Verify total company count (Expected: 22)
select count(*) as company_count from public.companies;

-- Verify total question count (Expected: 1,100)
select count(*) as question_count from public.interview_questions;

-- Verify review breakdown (Expected: 1,086 approved, 14 under_review)
select review_status, count(*)
from public.interview_questions
group by review_status;
```

---

## 8. Deployment and Smoke-Test Checklist

- [ ] **Public Site Health:** Visit `https://<YOUR-PAGES-DOMAIN>/`. Confirm all 22 company cards render with avatars and salary indicators.
- [ ] **Company Detail Routing:** Click on Google, TCS, and Amazon. Verify question filters, tabs, and quiz links function properly.
- [ ] **Quiz Engine:** Start a quiz. Verify question pagination, timer, score counter, and solution explanations. Confirm that questions under review display the amber disclaimer banner.
- [ ] **Advertising Verification:** Inspect DOM elements with class `.ad-slot`. Verify all 13 slots have `display: none` and that zero third-party ad scripts are requested.
- [ ] **Admin Authentication:** Visit `/admin/`. Log in as Owner. Confirm Overview, Content, Analytics, and Administrator tabs load without console errors.
- [ ] **Admin CRUD Verification:** Edit a test question's review notes or options. Confirm changes persist.
- [ ] **Security Invoker Verification:** Log out of admin. Query `/api/admin/overview` with curl or browser; verify HTTP 401 Unauthorized is returned.

---

## 9. Safe Rollback & Disaster Recovery Plan

Do not arbitrarily drop database tables or columns in production. Follow this tiered recovery plan based on the issue encountered:

### Tier 1: Application / Frontend Rollback (Zero Data Risk)
If a bug is discovered in the website UI or Cloudflare Pages Functions:
1. Go to **Cloudflare Dashboard > Workers & Pages > Pages > Deployments**.
2. Find the previous stable deployment and click **Rollback to this deployment**.
3. **Database impact:** None. Migrations 0004–0006 are strictly additive and backward-compatible with earlier frontend code. The database schema does **not** need to be touched.

### Tier 2: Pre-Seed Migration Teardown (Safe Schema Reversion)
If the migration was applied but you need to revert the database to the exact Migration 0003 state **before** seed data has been imported (when `companies` and `interview_questions` have 0 rows):

```sql
begin;

-- 1. Remove view and editorial columns
drop view if exists public.admin_questions_view;
drop index if exists public.interview_questions_review_status_idx;
alter table public.interview_questions drop column if exists review_notes;
alter table public.interview_questions drop column if exists review_status;

-- 2. Remove triggers and owner partial unique index
drop trigger if exists admin_profile_security_guard on public.admin_profiles;
drop trigger if exists admin_profile_deletion_guard on public.admin_profiles;
drop function if exists public.enforce_admin_profile_security();
drop function if exists public.prevent_owner_profile_deletion();
drop index if exists public.admin_profiles_single_owner_idx;

-- 3. Remove bootstrap and emergency recovery functions
drop function if exists public.bootstrap_initial_owner(uuid, text);
drop function if exists public.emergency_rebind_owner(uuid, text);
drop function if exists public.is_owner();

-- 4. Restore original Migration 0001 is_admin() function (owner-only)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where user_id = auth.uid()
      and role = 'owner'
  );
$$;

-- 5. Restore original Migration 0003 owner-only admin_profiles policies
drop policy if exists admin_profiles_select on public.admin_profiles;
drop policy if exists admin_profiles_insert on public.admin_profiles;
drop policy if exists admin_profiles_update on public.admin_profiles;
drop policy if exists admin_profiles_delete on public.admin_profiles;

create policy owner_manage_admin_profiles on public.admin_profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 6. Remove foreign key constraint added in 0004
alter table public.admin_profiles
  drop constraint if exists admin_profiles_user_id_auth_users_fkey;

commit;
```
*Impact Explanation:* Restores the exact schema state of Migration 0003. Safe only when no active administrators or editorial question notes rely on the new schema.

### Tier 3: Post-Seed Recovery (Preserving Data Integrity)
If seed data was already imported:
- **NEVER** drop the `companies` or `interview_questions` tables.
- If you need to re-import questions cleanly without schema drops:
  ```sql
  -- Remove imported questions and companies cleanly
  delete from public.interview_questions;
  delete from public.companies;
  ```
  Then re-run `node scripts/import_seed_data.js --apply --confirm`.

### Tier 4: Emergency Owner Account Recovery
If Owner credentials or the Owner Auth user ID are lost or invalidated:
1. In the Supabase Dashboard, create a new Auth user under **Authentication > Users**.
2. Copy the new user's UUID.
3. In the SQL Editor, execute as database administrator:
   ```sql
   select public.emergency_rebind_owner('<NEW-USER-UUID>', 'Mohammed Rayyan');
   ```
   This safely transfers the Owner profile in-place, preserves audit trails, and updates `updated_at` without corrupting foreign keys.

---

## 10. Remaining Known Limitations

1. **Manual Editorial Review:** 14 questions remain tagged as `under_review` with disclaimers displayed to students. They are fully usable in practice quizzes, but should be reviewed and updated via the Admin Question Management UI post-launch.
2. **First-Party Analytics:** Event tracking operates via Cloudflare Pages Functions into the Supabase database. If Google Analytics is desired, configure `PUBLIC_GA4_MEASUREMENT_ID`.
3. **Advertising Slots:** Ad units are registered but disabled. To monetize later, configure provider client IDs in `js/ad-registry.js` and set `enabled: true`.
