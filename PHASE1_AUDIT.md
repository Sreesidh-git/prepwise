# Phase 1 Audit: PrepWise

## Audit status

Completed on 2026-11-07. The existing public website remains a static site and is still runnable with `python -m http.server 3456`.

## Current architecture

PrepWise has no build system or server runtime. The browser loads four HTML documents, one shared stylesheet, five JavaScript modules, and JSON datasets directly from the repository.

| Area | Current implementation |
| --- | --- |
| Public pages | `index.html`, `company.html`, `quiz.html`, `about.html` |
| Styling | `css/style.css` |
| Homepage behavior | `js/app.js` |
| Company behavior | `js/company.js` |
| Quiz behavior | `js/quiz.js` |
| News behavior | `js/news.js` |
| Advertising behavior | Disabled during migration; the former demo ad runtime was removed |
| Company data | `data/companies.json` |
| Country data | `data/countries.json` |
| Hiring news | `data/news.json` |
| Questions | `data/questions/<company-id>.json` |
| Data tooling | Five standalone Python scripts |
| Hosting assumption | Any static HTTP host, including Cloudflare Pages |

## URL and data flow

- `/` and `/index.html` load company and country JSON, then render searchable/filterable company cards.
- `/company.html?id=<id>` loads the company record and `data/questions/<id>.json`.
- `/quiz.html?company=<id>&category=<category>&level=<level>&role=<role>` loads the company record and question file, then filters questions in the browser.
- `/about.html` is a static informational page.
- `news.js` loads `data/news.json` and also contains a simulated alert pool. This must be replaced with published database content and clearly labelled runtime behavior.
- The former demo ad runtime created wallpaper, anchor, floating-video, and sponsored UI. It has been removed because the production specification explicitly requires advertising preparation only.

## Repository inventory

- 4 HTML pages
- 1 CSS file
- 5 JavaScript files
- 5 Python scripts
- 25 JSON files
- 22 companies
- 50 countries
- 22 question files
- 1,100 questions
- 14 news records
- 0 package manifests
- 0 environment templates
- 0 SQL migrations
- 0 backend/API routes
- 0 authentication implementation
- 0 analytics implementation
- 0 automated tests

## Existing dependencies

The frontend has no npm dependencies. It references Google Fonts remotely. The Python scripts use only the Python standard library. The future migration will add a browser-safe Supabase client dependency or a vendored/module-compatible equivalent, plus Chart.js for the private dashboard.

No Supabase, service-role, GA4, Search Console, or Cloudflare credentials are present in the repository.

## Existing strengths to preserve

- Existing SEO-friendly HTML routes and query-string company/quiz URLs.
- Public zero-login browsing and quiz flow.
- Responsive CSS design system and existing brand identity.
- Existing JSON content, question explanations, role data, country filters, and news presentation.
- Static hosting compatibility for the public site.

## Migration risks and required decisions already specified

1. **Database source transition:** public pages currently depend on local JSON. The migration must preserve a local/static fallback or use published database reads without breaking the pages when Supabase is unavailable.
2. **Admin security:** `/admin` must not rely on a hidden URL. Supabase Auth, server-side authorization, RLS, and protected mutation paths are required.
3. **Secret boundary:** the browser may use only the Supabase publishable/anon key. Service-role credentials must remain server-side or in migration tooling.
4. **Static hosting limitation:** Cloudflare Pages can host the public assets, but protected mutations and Search Console/GA administration require Pages Functions or another server-side boundary.
5. **Analytics truthfulness:** no dashboard counters may be fabricated. First-party event storage needs consent, anonymous identifiers, validation, rate limiting, and admin exclusion.
6. **Advertising scope:** current fake/demo ad UI conflicts with the requested production scope and must be disabled before the production migration is considered complete.
7. **Content quality:** salary, hiring, “verified”, and live-news claims are repository content and need a review/status model in the database.
8. **Generator paths:** all five Python scripts contain an older absolute Windows workspace path and need a configurable path before being used as repeatable migration tooling.

## Proposed migration boundaries

### Supabase/PostgreSQL

Use normalized tables for companies, categories, questions, question categories, quizzes, quiz-question relationships, hiring news, settings, admin profiles, anonymous analytics, quiz attempts, searches, feedback, and activity logs. Published content should be readable through narrowly scoped RLS policies; writes should be owner/admin-only.

### Cloudflare Pages

Keep the four public HTML entry points and static CSS/JS. Add Pages Functions for protected server-side operations, analytics ingestion, and integrations that must not expose secrets. Use environment bindings for public Supabase configuration and server-only secrets.

### Public frontend

Preserve current routes and UI. Introduce a data-access layer that can read published Supabase content and fall back to versioned static JSON where appropriate during rollout. Do not add public authentication.

### Private dashboard

Add `/admin` as a separate owner-authenticated surface. It must not be included in the public navigation and must use Supabase Auth plus RLS-backed queries and server-side authorization.

## Phase 1 checkpoint

The current worktree includes the earlier documentation, link, content, and quiz-answer fixes. This audit records that state before database/backend work begins. The checkpoint commit is intentionally separate from later Supabase implementation commits.
