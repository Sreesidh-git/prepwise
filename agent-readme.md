# PrepWise Agent Handoff

> This file is the durable continuation record for autonomous coding agents.
> Read it before changing the project. Update it after every meaningful step,
> phase, test run, commit, credential gate, or blocked operation.

## Continuation prompt

Copy this prompt into a new coding-agent session:

```text
Continue the existing PrepWise production migration from agent-readme.md.

First read agent-readme.md, README.md, HOW_TO_RUN.md, PHASE1_AUDIT.md, and the
latest git history. Do not rebuild the project, migrate to React/Next.js, discard
completed work, reset history, or overwrite unrelated user changes.

Work incrementally and autonomously. Before and after every meaningful step:
1. Update agent-readme.md with the current phase, files changed, decisions,
   tests, commit hash, blockers, and next action.
2. Keep the existing static frontend, branding, public URLs, zero-login public
   access, and SEO behavior operational.
3. Never invent credentials. Never expose SUPABASE_SECRET_KEY or
   SUPABASE_OWNER_USER_ID to browser code, HTML, JavaScript bundles, API
   responses, GitHub, or committed files.
4. Use the canonical variables SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,
   SUPABASE_SECRET_KEY, SUPABASE_OWNER_USER_ID, PUBLIC_SITE_URL, and
   PUBLIC_GA4_MEASUREMENT_ID.
5. Do not run Supabase migrations or import data until the user explicitly
   confirms and provides the real project values through the ignored .env or
   .dev.vars mechanism.
6. Run focused validation after each implementation step. Do not claim real
   Supabase verification until a real project connection succeeds.
7. Create a Git checkpoint after each completed phase, including the
   Co-authored-by trailer required by the repository instructions.

When credits or context run low, finish the current safe step, update this file,
commit only completed work, and leave the exact next action under "Next action".
```

## Current status

- **Repository:** `Sreesidh-git/prepwise`
- **User deployment repository:** `RayyanShajahan/prepwise`
- **Branch:** `main`
- **Architecture:** static HTML/CSS/JavaScript frontend, JSON source datasets,
  Cloudflare Pages Functions, Supabase PostgreSQL/Auth, no build system.
- **Public access:** no registration or login required.
- **Private access:** `/admin/` requires Supabase Auth and the configured owner.
- **Advertising:** demo advertising runtime and sponsored placements are disabled.
- **Supabase credentials:** URL, publishable key, and secret key are set in
  `.env`; owner ID and optional public values are still empty. No secret value
  is recorded here.
- **Supabase CLI:** available through `npx supabase` version `3.0.0`; no global
  installation was performed.
- **Supabase project ref:** `jwkllwqabixzmtfiuncd` (provided by user; no
  project connection has been attempted).
- **Production migrations/import:** intentionally not executed.

## Completed work

### Public site and content

- Preserved the existing static routes:
  - `/index.html`
  - `/about.html`
  - `/company.html?id=<company-id>`
  - `/quiz.html?company=<company-id>&category=<category>&level=<level>`
- Fixed broken CTA and company hiring links.
- Corrected SAP hiring destination.
- Randomized answer option order across the question datasets while preserving
  correct answers.
- Added beginner documentation and project audit documentation.
- Removed placeholder `href="#"` links.

### Supabase schema and security

- Added the initial relational schema in
  `supabase/migrations/0001_initial_schema.sql`.
- Added analytics events in `supabase/migrations/0002_analytics_events.sql`.
- Added owner-only policy hardening in
  `supabase/migrations/0003_owner_only_policies.sql`.
- Added tables and relationships for companies, categories, countries,
  questions, quizzes, news, settings, feedback, analytics, sessions,
  attempts, and activity logs.
- Enabled RLS and restricted administrative operations to an active
  `role = 'owner'` profile.
- Server-side authorization additionally requires the authenticated user ID to
  equal `SUPABASE_OWNER_USER_ID`.

### Runtime and server integration

- Added Cloudflare Pages Functions for health, public runtime configuration,
  feedback, analytics ingestion, owner authorization, admin CRUD, and overview
  counts.
- `/api/config` exposes only:
  - Supabase project URL
  - Supabase publishable key
  - public site URL
  - optional GA4 measurement ID
- The secret key and owner ID remain server-only.
- Public analytics uses anonymous IDs with defensive localStorage handling.
- The project intentionally uses REST from the zero-build frontend and
  standard-library Python importer; no SDK dependency was added because there
  is no frontend build/runtime dependency manager.

### Importer and configuration

- `scripts/import_json_to_supabase.py` performs repeatable PostgREST upserts.
- It does not delete database records or rewrite local JSON.
- It maps company names, short names, and legacy IDs for news relationships.
- It reports imported, skipped, and failed records.
- Canonical environment names are documented in `.env.example`.
- `.dev.vars.example` documents Cloudflare local bindings.
- `.env`, `.dev.vars`, and local `admin/config.js` are ignored.
- `admin/config.example.js` is the safe browser configuration template.

### Deployment and SEO

- Added Cloudflare security headers in `_headers`.
- Added `robots.txt` and `sitemap.xml` with a domain placeholder that must be
  replaced before deployment.
- Added Cloudflare and Supabase setup instructions to the documentation.

## Git checkpoints

- `ed0f08b` — Phase 1 audit checkpoint
- `688ff88` — Supabase schema/security foundation
- `b135a4e` — JSON content importer
- `ffedb56` — secure Pages Functions APIs
- `6433fbf` — admin dashboard foundation
- `1c5bbc6` — protected admin route correction
- `fc84939` — analytics and demo advertising cleanup
- `e7b7770` — About page analytics wiring
- `2cf9654` — Cloudflare and SEO deployment files
- `ee14113` — canonical Supabase environment configuration
- `d8ba96f` — secure runtime Supabase configuration
- `3c3fafc` — owner dashboard publishable-key alignment
- `cc290ac` — importer hardening and owner setup documentation
- `bc3f969` — ignored local admin configuration and removed tracked local file

## Validation completed without credentials

- JavaScript syntax checks pass for changed browser, function, and admin files.
- Python syntax check passes for the importer.
- All 25 JSON data files parse successfully.
- SQL structure contains the required tables, relationships, indexes, RLS
  enablement, and policy markers.
- Public configuration runtime test confirmed the secret key is not returned.
- Owner authorization rejection test confirmed a non-owner receives HTTP 403.
- Public smoke tests return HTTP 200 for homepage, About, company, quiz, and
  admin shell.
- The Python importer safely refuses to run when credentials are absent.
- Static Python hosting correctly returns 404 for `/api/config`; this is
  expected because Pages Functions require Cloudflare Pages/Wrangler.

## Waiting for credentials

The user must provide values privately in the ignored local `.env` file:

```dotenv
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_OWNER_USER_ID=
PUBLIC_SITE_URL=
PUBLIC_GA4_MEASUREMENT_ID=
```

Do not ask the user to paste secret values into chat. The secret key is needed
only for the trusted importer and Cloudflare server functions.

## Next action

After the user confirms that setup may proceed and fills the ignored `.env`:

1. Install or verify the official Supabase CLI.
2. Run `supabase login`.
3. Run `supabase link --project-ref <project-ref>`.
4. Ask for explicit confirmation before `supabase db push`.
5. Apply migrations only after that confirmation.
6. Create the Supabase Auth owner account and insert its UUID into
   `public.admin_profiles` with `role = 'owner'` and `is_active = true`.
7. Set `SUPABASE_OWNER_USER_ID` to the same UUID.
8. Run the importer from a trusted PowerShell session.
9. Verify RLS with anonymous, owner, and non-owner tests.
10. Configure the same canonical variables as encrypted Cloudflare Pages
    environment variables.
11. Replace `YOUR-DOMAIN.example` in `robots.txt` and `sitemap.xml`.
12. Run the deployment smoke, security, performance, accessibility, and SEO
    checks, then create the next checkpoint.

## Phase update protocol

Every future agent must append a dated entry below after each meaningful step.
Include the phase, exact files changed, validation command and result, commit
hash if created, blockers, and the next action. Never remove prior entries.

## Update log

### 2026-11-07

- Added this handoff file for continuation across agent sessions.
- Removed tracked `admin/config.js` and added it to `.gitignore` so local
  publishable configuration cannot be committed accidentally.
- Created checkpoint `bc3f969` and pushed it to `RayyanShajahan/prepwise`.
- Current work is credential-free and safe to continue.
- Resumed the handoff and verified `.env` variables without exposing values:
  all six canonical variables are empty.
- Verified `supabase --version` is unavailable; the Supabase CLI is not
  installed on PATH.
- No migration, import, link, login, or production command was executed.
- User confirmed credentials are not ready and declined CLI setup for now.
- User provided the project URL
  `https://jwkllwqabixzmtfiuncd.supabase.co/rest/v1/`; the usable project ref
  is `jwkllwqabixzmtfiuncd`.
- Read-only connectivity checks found that `.env` currently stores the project
  URL with the `/rest/v1/` suffix. It must be the base URL
  `https://jwkllwqabixzmtfiuncd.supabase.co`; no credential file was edited.
- With the suffixed URL, the publishable key reaches the project endpoint but
  table/API probes cannot be trusted; migrations remain unapplied.
- Browser secret audit found no `SUPABASE_SECRET_KEY` or owner ID references;
  server-side references are limited to the expected functions/importer.
- Read-only link verification succeeded for project `jwkllwqabixzmtfiuncd`
  (`Prepwise`, production). Remote migration history is empty for local
  migrations `0001`, `0002`, and `0003`.
- `npx supabase db push --remote --dry-run` succeeded and previewed exactly:
  `0001_initial_schema.sql`, `0002_analytics_events.sql`, and
  `0003_owner_only_policies.sql`. No seeds or roles were included.
- The dry run confirms pending migration history but does not prove that no
  manually-created remote objects conflict with these names. No production SQL
  was executed; a remote schema diff would be a separate read-only review.
- Next action is to wait for the user to fill `.env` and explicitly approve
  migration execution.
