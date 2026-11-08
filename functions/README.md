# Cloudflare Pages Functions

These functions are server-side entry points for a Cloudflare Pages deployment. They are not served by the local Python static server.

## Routes

- `GET /api/health` — deployment health check; contains no secrets.
- `GET /api/config` — exposes only the public Supabase URL/key and optional public analytics values.
- `POST /api/feedback` — validates and stores anonymous public feedback.
- `POST /api/analytics` — validates anonymous first-party events and stores them server-side.
- `GET|POST|PATCH|DELETE /api/admin/<resource>` — owner-authenticated content operations.
- `GET /api/admin/analytics` — owner-only date-filtered analytics summaries,
  paginated activity, sorting, and bounded CSV export.
- `GET /api/admin/system` — owner-only Supabase reachability and content health.

Admin requests must include:

```text
Authorization: Bearer <Supabase Auth access token>
```

The function validates that token with Supabase Auth, checks the configured owner identity, and requires an active `admin_profiles` record whose role is exactly `owner` before allowing a mutation. The secret key is read only from the Cloudflare server environment and is never returned to the browser.

Analytics responses omit anonymous IDs, email addresses, IP addresses,
passwords, tokens, and raw search text.

## Cloudflare environment bindings

Configure these as encrypted server-side variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_OWNER_USER_ID`

The local Python HTTP server cannot execute these functions. Use `wrangler pages dev` or a deployed Cloudflare Pages project after installing and authenticating the Wrangler CLI.

For local Pages Functions testing, create an ignored `.dev.vars` file with the same names. The browser only receives the URL and publishable key through the static public configuration files; the secret key and owner ID must never be placed there.
