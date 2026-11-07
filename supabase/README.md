# Supabase setup

The SQL migrations in [`migrations/`](./migrations/) define the production data model and Row Level Security policies. They do not contain credentials or seed content.

## Required project values

Create a Supabase project and copy these values into a local `.env` file or Cloudflare Pages environment variables:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` for server-only migration/import jobs

The publishable/anon key may be used by public browser reads. The service-role key must only be used by trusted migration tooling or server-side functions.

## Apply migrations

The repository currently has no Supabase CLI dependency. After installing the official Supabase CLI, link the local repository to the project and apply migrations:

```powershell
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

Do not paste keys into source files or commit them. The migration/import tooling will be added separately and will use environment variables.

## Initial owner setup

After the schema is applied:

1. Create the owner account from the Supabase Auth dashboard or a controlled server-side setup process.
2. Insert that user's UUID into `public.admin_profiles` with `role = 'owner'` and `is_active = true`.
3. Do not enable public sign-up in the application.
4. Verify that an anonymous client can only read published content and cannot read or modify admin/analytics tables.

The schema intentionally does not create an administrator automatically because doing so would require committing or transmitting credentials.
