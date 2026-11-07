# Supabase setup

The SQL migrations in [`migrations/`](./migrations/) define the production data model and Row Level Security policies. They do not contain credentials or seed content.

## Required project values

Create a Supabase project and copy these values into a local `.env` file or Cloudflare Pages environment variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` for public browser operations protected by RLS
- `SUPABASE_SECRET_KEY` for server-only migration/import jobs
- `SUPABASE_OWNER_USER_ID` for the one authorized owner identity used by Pages Functions

The publishable/anon key may be used by public browser reads. The service-role key must only be used by trusted migration tooling or server-side functions.

## Apply migrations

The repository currently has no Supabase CLI dependency. After installing the official Supabase CLI, link the local repository to the project and apply migrations:

```powershell
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

Do not paste keys into source files or commit them. The migration/import tooling will be added separately and will use environment variables.

## Import existing JSON content

After applying the schema, run the repeatable importer from the repository root in a trusted PowerShell session:

```powershell
$env:SUPABASE_URL = "https://your-project-ref.supabase.co"
$env:SUPABASE_SECRET_KEY = "server-only-secret"
python .\scripts\import_json_to_supabase.py
```

The importer reads the existing JSON files, upserts normalized categories/countries/companies/questions/news, creates one published full-test quiz per company, and links each quiz to its questions. It does not modify or delete the local JSON files.

The importer has not been run in this checkout because no Supabase project URL or service-role key is available.

## Initial owner setup

After the schema is applied:

1. Create the owner account from the Supabase Auth dashboard or a controlled server-side setup process.
2. Insert that user's UUID into `public.admin_profiles` with `role = 'owner'` and `is_active = true`.
3. Do not enable public sign-up in the application.
4. Verify that an anonymous client can only read published content and cannot read or modify admin/analytics tables.

The schema intentionally does not create an owner automatically because doing so would require committing or transmitting credentials.

## Admin dashboard

The private dashboard is at `/admin/`. Copy [`admin/config.example.js`](../admin/config.example.js) to `admin/config.js` for local connected testing and add the public Supabase URL and anon/publishable key. The owner still must authenticate through Supabase Auth and have an active row in `admin_profiles`; the browser key does not grant administrator access.

Cloudflare Pages must receive `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and `SUPABASE_OWNER_USER_ID` as encrypted environment variables for the Pages Functions under [`functions/`](../functions/) to serve owner operations.
