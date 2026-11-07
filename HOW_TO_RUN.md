# How To Run and Work on PrepWise

## Start the local server

From the project root:

```powershell
python -m http.server 3456
```

Visit <http://localhost:3456>. The default homepage is [`index.html`](./index.html).

If port `3456` is already in use, choose another port:

```powershell
python -m http.server 8000
```

Then visit <http://localhost:8000>.

## Check a specific page

```text
http://localhost:3456/about.html
http://localhost:3456/company.html?id=google
http://localhost:3456/quiz.html?company=amazon&category=Technical
http://localhost:3456/quiz.html?company=tcs&level=Beginner
```

## Work on the frontend

1. Edit the HTML, CSS, JavaScript, or JSON file.
2. Refresh the browser.
3. Use the browser developer tools:
   - **Console** for JavaScript and JSON errors
   - **Network** for failed `fetch()` requests
   - **Elements** for generated markup and CSS
4. Test the changed page and at least one related page.

There is currently no build command, test runner, lint configuration, or dependency manifest in the repository. Manual browser testing is the available validation path.

The `functions/` directory contains Cloudflare Pages Functions and is not executed by the Python server. See [`functions/README.md`](./functions/README.md) for deployment-side API behavior.

## Configure public analytics

The browser-safe placeholders live in [`js/public-config.js`](./js/public-config.js) and [`admin/config.js`](./admin/config.js). Keep the values empty for a local static-only run. For a deployed site, set the Supabase project URL, publishable key, and optional GA4 Measurement ID there through the deployment process. Never put `SUPABASE_SECRET_KEY`, `SUPABASE_OWNER_USER_ID`, or Google Search Console credentials in browser files.

The former demo advertising runtime is disabled and is not loaded by any public page.

## Deployment preparation

Cloudflare Pages can deploy the repository root as the static output and automatically discover the `functions/` directory. Before production deployment:

1. Replace `YOUR-DOMAIN.example` in [`robots.txt`](./robots.txt) and [`sitemap.xml`](./sitemap.xml) with the verified site domain.
2. Configure the encrypted server variables listed in [`functions/README.md`](./functions/README.md).
3. Configure the browser-safe values in [`js/public-config.js`](./js/public-config.js).
4. Apply the Supabase migrations and run the importer only after a real Supabase project and service-role secret are available.

## Work on data

The browser reads JSON directly:

- `data/companies.json` for company profiles and roles
- `data/countries.json` for country filtering
- `data/news.json` for hiring news
- `data/questions/<id>.json` for quiz questions

After editing JSON, reload the page and check the browser console.

## Run the Python content scripts

The scripts are optional tools for generating or enriching JSON. Before running one:

1. Open the script.
2. Update its `base_dir` to the local repository path if needed.
3. Confirm which files it reads and writes.
4. Run it from PowerShell.
5. Review `git diff` before accepting the generated changes.

Example:

```powershell
python .\generate_extra_questions.py
git diff -- data
```

The current scripts may rewrite large JSON files. Do not run them casually on a worktree containing uncommitted content.

## Stop and reset a local server

Press `Ctrl+C` in the terminal running `python -m http.server`.

## Release checklist

- Start the server from the repository root.
- Open the homepage and one company profile.
- Run one full quiz and one filtered quiz.
- Test search, country, category, and level filters.
- Check a narrow browser viewport.
- Inspect the browser console for errors.
- Review JSON and code changes with `git diff`.
- Verify that links to company ids and question files still match.
