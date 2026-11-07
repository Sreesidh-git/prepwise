# Cloudflare Pages Functions

These functions are server-side entry points for a Cloudflare Pages deployment. They are not served by the local Python static server.

## Routes

- `GET /api/health` — deployment health check; contains no secrets.
- `POST /api/feedback` — validates and stores anonymous public feedback.
- `GET|POST|PATCH|DELETE /api/admin/<resource>` — owner-authenticated content operations.

Admin requests must include:

```text
Authorization: Bearer <Supabase Auth access token>
```

The function validates that token with Supabase Auth and checks the active `admin_profiles` record before allowing a mutation. The service-role key is read only from the Cloudflare server environment and is never returned to the browser.

## Cloudflare environment bindings

Configure these as encrypted server-side variables:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The local Python HTTP server cannot execute these functions. Use `wrangler pages dev` or a deployed Cloudflare Pages project after installing and authenticating the Wrangler CLI.
